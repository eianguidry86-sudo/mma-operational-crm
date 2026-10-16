-- Market Intel prospect board.
--
-- The "Top 10" column is computed in the app from mma-data business_records
-- (scored against the customer avatar); only businesses E has acted on are
-- stored here. Dragging a card to Working calls promote_prospect(), which
-- creates the CRM lead through ingest_lead() and queues the card for the
-- Keystone sync (an n8n workflow on the Pi reads keystone_status = 'pending',
-- POSTs the hub's /tasks, and writes back keystone_ref / 'synced').

create table if not exists public.prospect_board (
  iusa_number     text primary key,
  business_name   text not null,
  status          text not null check (status in ('working', 'dismissed')),
  score           integer,
  snapshot        jsonb not null default '{}'::jsonb,
  lead_id         uuid references public.leads(id) on delete set null,
  keystone_status text not null default 'pending'
                  check (keystone_status in ('pending', 'synced', 'error', 'skipped')),
  keystone_ref    text,
  keystone_error  text,
  moved_at        timestamptz not null default now(),
  synced_at       timestamptz
);

create index if not exists prospect_board_keystone_pending_idx
  on public.prospect_board (moved_at) where keystone_status = 'pending';

alter table public.prospect_board enable row level security;

create policy auth_select_prospect_board on public.prospect_board for select to authenticated using (true);
create policy auth_insert_prospect_board on public.prospect_board for insert to authenticated with check (true);
create policy auth_update_prospect_board on public.prospect_board for update to authenticated using (true) with check (true);
create policy auth_delete_prospect_board on public.prospect_board for delete to authenticated using (true);

-- Move a business to Working: create/refresh the CRM lead and queue the Keystone task.
create or replace function public.promote_prospect(
  p_iusa text, p_name text, p_score integer, p_snapshot jsonb, p_lead jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_result jsonb;
begin
  v_result := ingest_lead(p_lead);

  insert into prospect_board (iusa_number, business_name, status, score, snapshot, lead_id)
  values (p_iusa, p_name, 'working', p_score, coalesce(p_snapshot, '{}'::jsonb), (v_result->>'lead_id')::uuid)
  on conflict (iusa_number) do update set
    status          = 'working',
    business_name   = excluded.business_name,
    score           = excluded.score,
    snapshot        = excluded.snapshot,
    lead_id         = excluded.lead_id,
    moved_at        = now(),
    -- Don't create a second Keystone task for a card that already synced.
    keystone_status = case when prospect_board.keystone_status = 'synced' then 'synced' else 'pending' end;

  return v_result;
end;
$$;

revoke all on function public.promote_prospect(text, text, integer, jsonb, jsonb) from public, anon;
grant execute on function public.promote_prospect(text, text, integer, jsonb, jsonb) to authenticated, service_role;
