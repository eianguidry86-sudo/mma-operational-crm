// Customer-avatar scoring for the Market Intel prospect board.
// Source: "Customer Avatar - GIS" (small local owner-operated businesses that run service
// territories or neighborhood storefronts, moderately tech-comfortable, growth-minded).
// Every weight lives here; each card shows the breakdown so the score is never a black box.

export interface MarketBusiness {
  iusa_number: string;
  company_name: string;
  address: string | null;
  city: string | null;
  zip_code: string | null;
  phone: string | null;
  executive_first_name: string | null;
  executive_last_name: string | null;
  executive_title: string | null;
  primary_sic_code: string | null;
  primary_sic_description: string | null;
  primary_naics_description: string | null;
  employee_size_range: string | null;
  employee_size_actual: number | null;
  sales_volume_range: string | null;
  sales_volume_actual: string | null;
  location_type: string | null;
  type_of_business: string | null;
  home_business: boolean | null;
  year_established: number | null;
  years_in_database: number | null;
  website: string | null;
  facebook_url: string | null;
  franchise_description: string | null;
  parent_company_name: string | null;
  export_date: string | null;
}

export type FitTier = 'route' | 'storefront' | 'adjacent' | 'other' | 'excluded';
export type AngleKey =
  | 'route_density' | 'parcel_targeting' | 'territory_drive_time'
  | 'expansion_scoring' | 'competitive_density' | 'baseline_density';

interface IndustryRule {
  sic4: string[];           // 4-digit SIC prefixes (Data Axle codes are 6 digits)
  tier: FitTier;
  points: number;
  angle?: AngleKey;
  label: string;
}

// Order matters: first match wins.
const INDUSTRY_RULES: IndustryRule[] = [
  { label: 'Lawn, landscape & tree', tier: 'route', points: 40, angle: 'route_density', sic4: ['0781', '0782', '0783'] },
  { label: 'Pest, cleaning & janitorial', tier: 'route', points: 40, angle: 'route_density', sic4: ['7342', '7349', '7217'] },
  { label: 'Pet services', tier: 'route', points: 40, angle: 'route_density', sic4: ['0752'] },
  { label: 'Home trades', tier: 'route', points: 40, angle: 'territory_drive_time',
    sic4: ['1711', '1721', '1731', '1741', '1742', '1743', '1751', '1752', '1761', '1771', '1781', '1791', '1793', '1794', '1795', '1796', '1799'] },
  { label: 'Hauling & moving', tier: 'route', points: 40, angle: 'territory_drive_time', sic4: ['4212', '4214', '4953'] },
  { label: 'Fitness & sports', tier: 'storefront', points: 30, angle: 'expansion_scoring', sic4: ['7991', '7997', '7999', '7032'] },
  { label: 'Garden centers', tier: 'storefront', points: 30, angle: 'expansion_scoring', sic4: ['5261'] },
  { label: 'Specialty retail', tier: 'storefront', points: 25, angle: 'expansion_scoring',
    sic4: ['5941', '5942', '5943', '5944', '5945', '5946', '5947', '5948', '5949', '5992', '5993', '5994', '5999', '5651', '5699', '5714', '5719', '5731', '5734', '5736'] },
  { label: 'Auto detailing & repair', tier: 'adjacent', points: 25, angle: 'competitive_density', sic4: ['7542', '7532', '7538', '7549', '7699'] },
  { label: 'Personal services', tier: 'adjacent', points: 20, angle: 'competitive_density', sic4: ['7231', '7241', '7299', '7212', '7215', '7216'] },
  { label: 'Eating & drinking', tier: 'adjacent', points: 15, angle: 'expansion_scoring', sic4: ['5812', '5813'] },
  { label: 'Child care', tier: 'adjacent', points: 15, angle: 'competitive_density', sic4: ['8351'] },
  // Not the avatar: regulated professions, finance, government, religion, big-box and fuel.
  { label: 'Excluded', tier: 'excluded', points: 0,
    sic4: ['5411', '5311', '5331', '5399', '5541', '5983', '5984', '5912', '7011', '4311', '4911', '4924', '4931', '4941'] },
];

// Whole SIC major groups (first two digits) that are never the avatar.
const EXCLUDED_MAJOR = new Set(['43', '49', '60', '61', '62', '63', '64', '65', '67', '80', '81', '82', '83', '84', '86', '91', '92', '93', '94', '95', '96', '97', '99']);

const COFFEE = /coffee|espresso|cafe|café|tea house|juice|smoothie|bakery|donut|ice cream|yogurt/i;

export interface ScoreBreakdown {
  total: number;
  tier: FitTier;
  industryLabel: string;
  angle: AngleKey;
  parts: { label: string; points: number; max: number; note: string }[];
}

function industryFor(b: MarketBusiness): { rule: IndustryRule | null; excluded: boolean; points: number; note: string } {
  const sic = b.primary_sic_code ?? '';
  if (EXCLUDED_MAJOR.has(sic.slice(0, 2))) return { rule: null, excluded: true, points: 0, note: 'Outside the avatar (SIC major group)' };
  const rule = INDUSTRY_RULES.find(r => r.sic4.some(p => sic.startsWith(p))) ?? null;
  if (!rule) return { rule: null, excluded: false, points: 10, note: 'Other industry' };
  if (rule.tier === 'excluded') return { rule, excluded: true, points: 0, note: 'Outside the avatar' };
  // Coffee shops are named in the avatar; general restaurants are only adjacent.
  if (rule.label === 'Eating & drinking' && COFFEE.test(`${b.company_name} ${b.primary_sic_description}`)) {
    return { rule: { ...rule, tier: 'storefront', points: 30 }, excluded: false, points: 30, note: 'Coffee / cafe' };
  }
  return { rule, excluded: false, points: rule.points, note: rule.label };
}

function sizePoints(n: number | null): [number, string] {
  if (n == null) return [8, 'Size unknown'];
  if (n >= 5 && n <= 19) return [25, `${n} employees: growth-stage small business`];
  if (n >= 20 && n <= 49) return [15, `${n} employees`];
  if (n >= 2 && n <= 4) return [12, `${n} employees`];
  if (n === 1) return [5, 'Solo operator'];
  return [0, `${n} employees: larger than the avatar`];
}

/** Older exports write "$500,000 - 1 Million", newer ones "$500,000-1 Million". */
export function normRange(r: string | null): string | null {
  return r ? r.replace(/\s*-\s*/g, '-').trim() : null;
}

function salesPoints(raw: string | null): [number, string] {
  const range = normRange(raw);
  if (!range) return [5, 'Sales unknown'];
  if (/500,000-1 Million|1-2\.5 Million|2\.5-5 Million/.test(range)) return [15, range];
  if (/Less Than \$500,000/i.test(range)) return [7, range];
  if (/5-10 Million/.test(range)) return [6, range];
  return [0, range];
}

export function scoreBusiness(b: MarketBusiness): ScoreBreakdown | null {
  const ind = industryFor(b);
  if (ind.excluded) return null;
  if (b.type_of_business === 'Branch of Public Company' || b.type_of_business === 'Public') return null;

  const [sp, sn] = sizePoints(b.employee_size_actual);
  const [vp, vn] = salesPoints(b.sales_volume_range);

  const franchise = !!b.franchise_description || !!b.parent_company_name;
  const loc = b.location_type ?? '';
  const indep = loc === 'Single Loc' && !franchise ? 10 : loc === 'Headquarter' && !franchise ? 6 : 0;
  const indepNote = indep === 10 ? 'Single location, independent' : indep === 6 ? 'Independent HQ' : franchise ? 'Franchise or has a parent company' : `Location type: ${loc || 'unknown'}`;

  const online = (b.website ? 6 : 0) + (b.facebook_url ? 4 : 0);
  const onlineNote = [b.website ? 'website' : null, b.facebook_url ? 'Facebook' : null].filter(Boolean).join(' + ') || 'No website or Facebook on file';

  const parts = [
    { label: 'Industry fit', points: ind.points, max: 40, note: ind.note },
    { label: 'Size', points: sp, max: 25, note: sn },
    { label: 'Sales', points: vp, max: 15, note: vn },
    { label: 'Independent', points: indep, max: 10, note: indepNote },
    { label: 'Online presence', points: online, max: 10, note: onlineNote },
  ];
  return {
    total: parts.reduce((s, p) => s + p.points, 0),
    tier: ind.rule?.tier ?? 'other',
    industryLabel: ind.rule?.label ?? 'Other',
    angle: ind.rule?.angle ?? 'competitive_density',
    parts,
  };
}

/** Ordering within equal scores: right-sized first, then sales band, then years operating. */
export function tieBreak(b: MarketBusiness): number {
  const n = b.employee_size_actual ?? 0;
  const sizeFit = n >= 5 && n <= 19 ? 3 : n >= 2 && n <= 49 ? 2 : 1;
  const sales = normRange(b.sales_volume_range) ?? '';
  const salesFit = /500,000-1 Million|1-2\.5 Million/.test(sales) ? 2 : /2\.5-5 Million/.test(sales) ? 1 : 0;
  const yrs = b.year_established ? new Date().getFullYear() - b.year_established : b.years_in_database ?? 0;
  return sizeFit * 100 + salesFit * 10 + Math.min(yrs, 9);
}

/** Lower-cased alphanumerics, for matching Data Axle names against CRM lead names. */
export const nameKey = (s: string | null | undefined) =>
  (s ?? '').toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\b(services?|svcs?)\b/g, 'svc')        // Data Axle abbreviates: "Carter's Painting Svc"
    .replace(/\b(llc|inc|corp|co|company|the)\b/g, '')
    .replace(/[^a-z0-9]/g, '');

export const ANGLE_LABEL: Record<AngleKey, string> = {
  route_density: 'Route density',
  parcel_targeting: 'Parcel targeting',
  territory_drive_time: 'Territory / drive time',
  expansion_scoring: 'Expansion scoring',
  competitive_density: 'Competitive density',
  baseline_density: 'Baseline density',
};

// Standard SIC major-group names, used for the "share of businesses" view.
const MAJOR_GROUPS: Record<string, string> = {
  '01': 'Agriculture', '02': 'Agriculture', '07': 'Agricultural services', '08': 'Forestry', '09': 'Fishing',
  '15': 'Building construction', '16': 'Heavy construction', '17': 'Construction trades',
  '20': 'Manufacturing', '22': 'Manufacturing', '23': 'Manufacturing', '24': 'Manufacturing', '25': 'Manufacturing',
  '26': 'Manufacturing', '27': 'Printing & publishing', '28': 'Manufacturing', '30': 'Manufacturing', '32': 'Manufacturing',
  '33': 'Manufacturing', '34': 'Manufacturing', '35': 'Manufacturing', '36': 'Manufacturing', '37': 'Manufacturing',
  '38': 'Manufacturing', '39': 'Manufacturing',
  '40': 'Transportation', '41': 'Transportation', '42': 'Trucking & warehousing', '44': 'Transportation', '45': 'Transportation',
  '47': 'Transportation services', '48': 'Communications', '49': 'Utilities',
  '50': 'Wholesale', '51': 'Wholesale',
  '52': 'Building materials & garden', '53': 'General merchandise', '54': 'Food stores', '55': 'Auto dealers & gas',
  '56': 'Apparel stores', '57': 'Home furnishings', '58': 'Eating & drinking', '59': 'Specialty retail',
  '60': 'Banking', '61': 'Credit', '62': 'Securities', '63': 'Insurance', '64': 'Insurance agents', '65': 'Real estate', '67': 'Holding & investment',
  '70': 'Lodging', '72': 'Personal services', '73': 'Business services', '75': 'Auto repair & services', '76': 'Repair services',
  '78': 'Motion pictures', '79': 'Amusement & recreation', '80': 'Health services', '81': 'Legal services',
  '82': 'Education', '83': 'Social services', '84': 'Museums', '86': 'Membership orgs & churches', '87': 'Engineering & management',
  '88': 'Private households', '89': 'Other services', '91': 'Government', '92': 'Government', '93': 'Government',
  '94': 'Government', '95': 'Government', '96': 'Government', '97': 'Government', '99': 'Nonclassified',
};

export function majorGroup(sic: string | null): string {
  const g = (sic ?? '').slice(0, 2);
  return MAJOR_GROUPS[g] ?? (g ? `SIC ${g}` : 'Unknown');
}

export const EMPLOYEE_ORDER = ['1 to 4', '5 to 9', '10 to 19', '20 to 49', '50 to 99', '100 to 249', '250 to 499', '500 to 999', '1,000 to 4,999'];
export const SALES_ORDER = [
  'Less Than $500,000', '$500,000-1 Million', '$1-2.5 Million', '$2.5-5 Million', '$5-10 Million',
  '$10-20 Million', '$20-50 Million', '$50-100 Million', '$100-500 Million',
];

export function yearsBucket(b: MarketBusiness): string {
  const y = b.year_established ? new Date().getFullYear() - b.year_established : b.years_in_database;
  if (y == null) return 'Unknown';
  if (y < 3) return 'Under 3 yrs';
  if (y < 6) return '3-5 yrs';
  if (y < 11) return '6-10 yrs';
  if (y < 21) return '11-20 yrs';
  return '20+ yrs';
}
export const YEARS_ORDER = ['Under 3 yrs', '3-5 yrs', '6-10 yrs', '11-20 yrs', '20+ yrs', 'Unknown'];
