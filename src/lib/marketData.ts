import { supabase } from './supabase';
import { ANGLE_LABEL, type MarketBusiness, type ScoreBreakdown } from './prospectScoring';

export interface ProspectBoardRow {
  iusa_number: string;
  business_name: string;
  status: 'working' | 'dismissed';
  score: number | null;
  snapshot: Partial<MarketBusiness> & { breakdown?: ScoreBreakdown };
  lead_id: string | null;
  keystone_status: 'pending' | 'synced' | 'error' | 'skipped';
  keystone_ref: string | null;
  keystone_error: string | null;
  moved_at: string;
}

export type BusinessDetail = MarketBusiness & {
  county: string | null;
  linkedin_url: string | null;
  company_description: string | null;
  square_footage: string | null;
  credit_score_alpha: string | null;
  neighborhood: string | null;
  sic_codes: { code: string; description: string | null }[] | null;
  naics_codes: { code: string; description: string | null }[] | null;
  raw: Record<string, string> | null;
};

async function callMarketData<T>(query: string): Promise<T> {
  const { data, error } = await supabase.functions.invoke(`market-data?${query}`, { method: 'GET' });
  if (error) {
    // FunctionsHttpError carries the response; surface the function's own message.
    const ctx = (error as { context?: Response }).context;
    const body = ctx && typeof ctx.json === 'function' ? await ctx.json().catch(() => null) : null;
    throw new Error(body?.error ?? error.message);
  }
  return data as T;
}

export async function loadBusinesses(): Promise<MarketBusiness[]> {
  return (await callMarketData<{ rows: MarketBusiness[] }>('mode=slim')).rows;
}

export function loadBusinessDetail(iusa: string): Promise<BusinessDetail> {
  return callMarketData<BusinessDetail>(`mode=detail&iusa=${encodeURIComponent(iusa)}`);
}

export async function loadBoard(): Promise<ProspectBoardRow[]> {
  const { data, error } = await supabase.from('prospect_board').select('*').order('moved_at', { ascending: false });
  if (error) throw error;
  return data as ProspectBoardRow[];
}

const titleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

/** Lead contract v1 payload (docs/schemas/lead.v1.schema.json) for a Data Axle business. */
export function leadPayload(b: MarketBusiness, s: ScoreBreakdown) {
  const owner = [b.executive_first_name, b.executive_last_name].filter(Boolean).join(' ') || null;
  return {
    contract_version: 1,
    source: 'reference_solutions',
    source_ref: `Data Axle Reference Solutions, IUSA ${b.iusa_number} (Market Intel score ${s.total})`,
    business: {
      name: b.company_name,
      industry: b.primary_sic_description,
      services: [],
      website: b.website,
      size_signal: [b.employee_size_range && `${b.employee_size_range} employees`, b.sales_volume_range && `sales ${b.sales_volume_range}`]
        .filter(Boolean).join(', ') || null,
    },
    contact: { owner_name: owner ? titleCase(owner) : null, email: null, phone: b.phone },
    location: { address: b.address, city: b.city, state: 'FL', zip: b.zip_code, service_area: [] },
    footprint: {
      no_digital_footprint: !b.website && !b.facebook_url,
      socials: b.facebook_url ? { facebook: b.facebook_url } : {},
    },
    angle: {
      key: s.angle,
      reasoning: `Suggested from industry (${s.industryLabel}): ${ANGLE_LABEL[s.angle]}. Not yet researched - confirm before outreach.`,
    },
    caveats: ['Imported from Data Axle; not yet researched.', ...(b.home_business ? ['Home-based business.'] : [])],
    outreach: null,
    report_markdown: null,
  };
}

export async function promoteProspect(b: MarketBusiness, s: ScoreBreakdown) {
  const { data, error } = await supabase.rpc('promote_prospect', {
    p_iusa: b.iusa_number,
    p_name: b.company_name,
    p_score: s.total,
    p_snapshot: { ...b, breakdown: s },
    p_lead: leadPayload(b, s),
  });
  if (error) throw error;
  return data as { lead_id: string; created: boolean };
}

export async function dismissProspect(b: MarketBusiness, score: number | null) {
  const { error } = await supabase.from('prospect_board').upsert({
    iusa_number: b.iusa_number,
    business_name: b.company_name,
    status: 'dismissed',
    score,
    snapshot: b,
    keystone_status: 'skipped',
  });
  if (error) throw error;
}

export async function restoreProspect(iusa: string) {
  const { error } = await supabase.from('prospect_board').delete().eq('iusa_number', iusa).eq('status', 'dismissed');
  if (error) throw error;
}

export function websiteHost(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

export function websiteHref(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}
