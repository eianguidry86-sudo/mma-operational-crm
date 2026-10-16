-- Lead intake contract v1 (docs/plans/lead-intake-contract.md, docs/schemas/lead.v1.schema.json)
--
-- Additive only: new nullable/defaulted columns, a lead link on documents, and
-- ingest_lead(payload jsonb). Does NOT touch the stage vocabulary; that ships
-- with the Leads kanban rewrite (part B) so the UI and data change together.

-- 1. leads: structured fields from the contract --------------------------------
alter table public.leads
  add column if not exists source text
    check (source in ('roadside', 'last30', 'niche', 'reference_solutions', 'inbound')),
  add column if not exists source_ref text,
  add column if not exists address text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists zip text,
  add column if not exists services text[] not null default '{}',
  add column if not exists footprint jsonb not null default '{}'::jsonb,
  add column if not exists marketmap_angle text
    check (marketmap_angle in ('route_density', 'parcel_targeting', 'territory_drive_time',
                               'expansion_scoring', 'competitive_density', 'baseline_density')),
  add column if not exists angle_reasoning text,
  add column if not exists caveats text[] not null default '{}',
  add column if not exists outreach_draft jsonb;

-- 2. documents: attach to a lead and hold markdown inline -----------------------
alter table public.documents
  add column if not exists lead_id uuid references public.leads(id) on delete cascade,
  add column if not exists content text;

create index if not exists documents_lead_id_idx on public.documents (lead_id);

-- 3. ingest_lead: the single intake every source goes through -------------------
-- Runs as the caller (security invoker), so RLS still applies: only a signed-in
-- CRM user can call it. Automated sources will reach it later through an Edge
-- Function holding the service key.
--
-- Dedupe: same last-10 phone digits, or same normalized name + city.
-- On a repeat: research fields are refreshed from the new payload, E's own
-- fields (stage, notes, next_action, follow_up_date, estimated_deal_value) are
-- never touched, and a new Research document is added alongside the old one.
create or replace function public.ingest_lead(payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_source   text := payload->>'source';
  v_name     text := nullif(btrim(payload#>>'{business,name}'), '');
  v_phone    text := nullif(btrim(payload#>>'{contact,phone}'), '');
  v_city     text := nullif(btrim(payload#>>'{location,city}'), '');
  v_digits   text := right(regexp_replace(coalesce(v_phone, ''), '\D', '', 'g'), 10);
  v_namekey  text;
  v_angle    text := payload#>>'{angle,key}';
  v_opp      text;
  v_services text[];
  v_caveats  text[];
  v_area     text;
  v_lead_id  uuid;
  v_created  boolean := false;
begin
  if (payload->>'contract_version')::int is distinct from 1 then
    raise exception 'ingest_lead: unsupported contract_version %', payload->>'contract_version';
  end if;
  if v_source is null or v_source not in ('roadside', 'last30', 'niche', 'reference_solutions', 'inbound') then
    raise exception 'ingest_lead: invalid source %', v_source;
  end if;
  if v_name is null then
    raise exception 'ingest_lead: business.name is required';
  end if;

  v_namekey := lower(regexp_replace(v_name, '[^A-Za-z0-9]', '', 'g'))
            || '|' || lower(regexp_replace(coalesce(v_city, ''), '[^A-Za-z0-9]', '', 'g'));

  select coalesce(array_agg(x), '{}') into v_services
    from jsonb_array_elements_text(coalesce(payload#>'{business,services}', '[]')) x;
  select coalesce(array_agg(x), '{}') into v_caveats
    from jsonb_array_elements_text(coalesce(payload->'caveats', '[]')) x;
  select nullif(string_agg(x, ', '), '') into v_area
    from jsonb_array_elements_text(coalesce(payload#>'{location,service_area}', '[]')) x;

  -- Existing opportunity_type vocabulary used by the Leads page.
  v_opp := case v_angle
    when 'route_density'        then 'Territory Optimization'
    when 'territory_drive_time' then 'Territory Optimization'
    when 'expansion_scoring'    then 'Market Expansion Analysis'
    when 'competitive_density'  then 'Competitor Landscape Analysis'
    when 'parcel_targeting'     then 'Site Selection'
    when 'baseline_density'     then 'Demographic Analysis'
  end;

  select id into v_lead_id
    from leads l
   where (length(v_digits) = 10
          and right(regexp_replace(coalesce(l.phone, ''), '\D', '', 'g'), 10) = v_digits)
      or (lower(regexp_replace(l.business_name, '[^A-Za-z0-9]', '', 'g'))
          || '|' || lower(regexp_replace(coalesce(l.city, ''), '[^A-Za-z0-9]', '', 'g'))) = v_namekey
   order by created_at
   limit 1;

  if v_lead_id is null then
    insert into leads (
      business_name, contact_name, email, phone, website, industry, service_area,
      business_size, opportunity_type, lead_source, stage,
      source, source_ref, address, city, state, zip, services, footprint,
      marketmap_angle, angle_reasoning, caveats, outreach_draft
    ) values (
      v_name,
      payload#>>'{contact,owner_name}',
      payload#>>'{contact,email}',
      v_phone,
      payload#>>'{business,website}',
      payload#>>'{business,industry}',
      v_area,
      payload#>>'{business,size_signal}',
      v_opp,
      v_source,
      'New Lead',
      v_source,
      payload->>'source_ref',
      payload#>>'{location,address}',
      v_city,
      coalesce(payload#>>'{location,state}', 'FL'),
      payload#>>'{location,zip}',
      v_services,
      coalesce(payload->'footprint', '{}'::jsonb),
      v_angle,
      payload#>>'{angle,reasoning}',
      v_caveats,
      nullif(payload->'outreach', 'null'::jsonb)
    )
    returning id into v_lead_id;
    v_created := true;
  else
    update leads set
      contact_name     = coalesce(payload#>>'{contact,owner_name}', contact_name),
      email            = coalesce(payload#>>'{contact,email}', email),
      phone            = coalesce(v_phone, phone),
      website          = coalesce(payload#>>'{business,website}', website),
      industry         = coalesce(payload#>>'{business,industry}', industry),
      service_area     = coalesce(v_area, service_area),
      business_size    = coalesce(payload#>>'{business,size_signal}', business_size),
      opportunity_type = coalesce(opportunity_type, v_opp),
      source           = coalesce(source, v_source),
      source_ref       = coalesce(payload->>'source_ref', source_ref),
      address          = coalesce(payload#>>'{location,address}', address),
      city             = coalesce(v_city, city),
      state            = coalesce(payload#>>'{location,state}', state),
      zip              = coalesce(payload#>>'{location,zip}', zip),
      services         = case when cardinality(v_services) > 0 then v_services else services end,
      footprint        = footprint || coalesce(payload->'footprint', '{}'::jsonb),
      marketmap_angle  = coalesce(v_angle, marketmap_angle),
      angle_reasoning  = coalesce(payload#>>'{angle,reasoning}', angle_reasoning),
      caveats          = case when cardinality(v_caveats) > 0 then v_caveats else caveats end,
      -- Only replace the draft while nothing has been sent yet.
      outreach_draft   = case when stage = 'New Lead'
                              then coalesce(nullif(payload->'outreach', 'null'::jsonb), outreach_draft)
                              else outreach_draft end,
      updated_at       = now()
    where id = v_lead_id;
  end if;

  if nullif(btrim(payload->>'report_markdown'), '') is not null then
    insert into documents (lead_id, name, doc_type, content, notes)
    values (
      v_lead_id,
      v_name || ' - research (' || v_source || ', ' || to_char(now(), 'YYYY-MM-DD') || ')',
      'Research',
      payload->>'report_markdown',
      payload->>'source_ref'
    );
  end if;

  insert into activity_log (action, entity_type, entity_id, entity_name)
  values (case when v_created then 'Lead ingested (' || v_source || ')'
               else 'Lead refreshed (' || v_source || ')' end,
          'lead', v_lead_id, v_name);

  return jsonb_build_object('lead_id', v_lead_id, 'created', v_created);
end;
$$;

revoke all on function public.ingest_lead(jsonb) from public, anon;
grant execute on function public.ingest_lead(jsonb) to authenticated, service_role;
