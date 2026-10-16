import { useEffect, useState } from 'react';
import { ExternalLink, Globe, Loader2, MapPin, Phone, X } from 'lucide-react';
import { loadBusinessDetail, websiteHost, websiteHref, type BusinessDetail } from '../../lib/marketData';
import { ANGLE_LABEL, scoreBusiness, type MarketBusiness } from '../../lib/prospectScoring';

interface BusinessCardProps {
  business: MarketBusiness | null;
  onClose: () => void;
  onPromote?: (b: MarketBusiness) => void;
  promoted?: boolean;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const PROPERTY_FIELDS = [
  'Owns Location', 'Own or Lease', 'Property Owner', 'Building Square Footage', 'Land Square Footage',
  'Original Construction Year', 'Market Value', 'Appraised Value', 'Recorded Sale Date', 'Sale Price',
];
const EXPENSE_FIELDS = [
  'Advertising  Expenses', 'Payroll and Benefits Expenses', 'Rent Expenses', 'Insurance Expenses', 'Computer Expenses',
  'Contract Labor Expenses', 'Utilities Expenses', 'Telcom Expenses', 'Accounting Expenses', 'Legal Expenses',
  'Office Supplies Expense', 'Management/Administration Expenses', 'Purchase Print Expenses', 'Package Container Expense',
];

function Logo({ name, website }: { name: string; website: string | null }) {
  const host = websiteHost(website);
  const [failed, setFailed] = useState(false);
  const initials = name.replace(/[^A-Za-z0-9 ]/g, '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  if (host && !failed) {
    return (
      <img
        src={`https://www.google.com/s2/favicons?domain=${host}&sz=128`}
        alt=""
        onError={() => setFailed(true)}
        onLoad={e => { if ((e.target as HTMLImageElement).naturalWidth <= 16) setFailed(true); }}
        className="w-14 h-14 bg-white p-1.5 object-contain flex-shrink-0"
      />
    );
  }
  return (
    <div className="w-14 h-14 bg-ledger-crimson text-white flex items-center justify-center font-serifLedger text-[26px] flex-shrink-0">
      {initials || '?'}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="px-3 py-2.5 border-r border-ledger-hairline last:border-r-0 min-w-0">
      <div className="font-plexMono text-[8.5px] uppercase tracking-[0.14em] text-ledger-muted">{label}</div>
      <div className="font-plexMono text-[14px] text-ledger-navy mt-0.5 truncate">{value || '—'}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0">
      <h3 className="font-plexMono text-[9px] uppercase tracking-[0.15em] text-ledger-crimson border-b border-ledger-hairline pb-1.5 mb-2.5">{title}</h3>
      {children}
    </section>
  );
}

function Rows({ rows }: { rows: [string, React.ReactNode][] }) {
  const shown = rows.filter(([, v]) => v !== null && v !== undefined && v !== '');
  if (!shown.length) return <p className="font-plexSans text-[12px] text-ledger-muted">Nothing on file.</p>;
  return (
    <dl className="grid grid-cols-[minmax(110px,40%)_1fr] gap-x-3 gap-y-1.5">
      {shown.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="font-plexSans text-[11.5px] text-ledger-muted">{k}</dt>
          <dd className="font-plexSans text-[12.5px] text-ledger-body break-words min-w-0">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

const fmtTime = (t?: string) => (t ? t.replace(/^0/, '') : '');

export default function BusinessCard({ business, onClose, onPromote, promoted }: BusinessCardProps) {
  const [detail, setDetail] = useState<BusinessDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!business) return;
    setDetail(null);
    setError(null);
    let cancelled = false;
    loadBusinessDetail(business.iusa_number)
      .then(d => { if (!cancelled) setDetail(d); })
      .catch(e => { if (!cancelled) setError(e.message); });
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { cancelled = true; document.removeEventListener('keydown', onKey); };
  }, [business, onClose]);

  if (!business) return null;
  const b = detail ?? business;
  const raw = detail?.raw ?? {};
  const score = scoreBusiness(business);
  const age = b.year_established ? new Date().getFullYear() - b.year_established : null;

  const executives: string[] = [];
  for (let i = 1; i <= 50; i++) {
    const n = [raw[`Executive First Name ${i}`], raw[`Executive Last Name ${i}`]].filter(Boolean).join(' ');
    if (n) executives.push(raw[`Executive Title ${i}`] ? `${n}, ${raw[`Executive Title ${i}`]}` : n);
  }
  if (!executives.length && (b.executive_first_name || b.executive_last_name)) {
    executives.push([b.executive_first_name, b.executive_last_name].filter(Boolean).join(' ') + (b.executive_title ? `, ${b.executive_title}` : ''));
  }
  const hours = DAYS.map(d => [d.slice(0, 3), raw[`${d} Open`] ? `${fmtTime(raw[`${d} Open`])} – ${fmtTime(raw[`${d} Close`])}` : null] as [string, string | null])
    .filter(([, v]) => v);
  const link = (url: string | null | undefined, label?: string) =>
    url ? <a href={websiteHref(url)} target="_blank" rel="noreferrer" className="text-ledger-blue hover:underline inline-flex items-center gap-1">{label ?? websiteHost(url) ?? url}<ExternalLink size={10} /></a> : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 animate-fade-in">
      <div className="absolute inset-0 bg-ledger-navy/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-3xl max-h-[92vh] flex flex-col bg-ledger-paper border border-ledger-navy shadow-ledger-frame animate-slide-up">
        {/* Header band */}
        <div className="bg-ledger-navy text-white px-5 py-4 flex items-start gap-4">
          <Logo name={b.company_name} website={b.website} />
          <div className="min-w-0 flex-1">
            <div className="font-plexMono text-[9px] uppercase tracking-[0.15em] text-ledger-navInactive">
              {b.primary_sic_description ?? 'Business'} · IUSA {b.iusa_number}
            </div>
            <h2 className="font-serifLedger text-[28px] leading-tight truncate">{b.company_name}</h2>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 font-plexSans text-[12px] text-white/80">
              {(b.address || b.city) && <span className="inline-flex items-center gap-1"><MapPin size={11} />{[b.address, b.city, b.zip_code].filter(Boolean).join(', ')}</span>}
              {b.phone && <a href={`tel:${b.phone}`} className="inline-flex items-center gap-1 hover:text-white"><Phone size={11} />{b.phone}</a>}
              {b.website && <a href={websiteHref(b.website)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-white"><Globe size={11} />{websiteHost(b.website)}</a>}
            </div>
          </div>
          {score && (
            <div className="text-center flex-shrink-0">
              <div className="font-plexMono text-[8.5px] uppercase tracking-[0.14em] text-ledger-navInactive">Fit</div>
              <div className="font-serifLedger text-[34px] leading-none">{score.total}</div>
            </div>
          )}
          <button onClick={onClose} className="text-white/60 hover:text-white flex-shrink-0" aria-label="Close"><X size={18} /></button>
        </div>

        {/* Stat strip */}
        <div className="grid grid-cols-3 sm:grid-cols-6 bg-white border-b border-ledger-navy">
          <Stat label="Employees" value={b.employee_size_actual ?? b.employee_size_range} />
          <Stat label="Sales" value={b.sales_volume_actual ?? b.sales_volume_range} />
          <Stat label="Established" value={b.year_established ? `${b.year_established}${age != null ? ` (${age}y)` : ''}` : null} />
          <Stat label="Yrs in data" value={b.years_in_database} />
          <Stat label="Credit" value={detail?.credit_score_alpha} />
          <Stat label="Sq ft" value={detail?.square_footage} />
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {error && <p className="font-plexSans text-[12px] text-ledger-crimson mb-3">Couldn't load the full record: {error}</p>}
          {!detail && !error && (
            <p className="font-plexMono text-[10px] uppercase tracking-[0.12em] text-ledger-muted mb-3 inline-flex items-center gap-2">
              <Loader2 size={12} className="animate-spin" /> Loading full record…
            </p>
          )}

          {detail?.company_description && (
            <p className="font-plexSans text-[13px] text-ledger-body leading-relaxed mb-4 border-l-2 border-ledger-crimson pl-3">{detail.company_description}</p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
            {score && (
              <Section title="Avatar fit">
                <div className="space-y-1.5">
                  {score.parts.map(p => (
                    <div key={p.label}>
                      <div className="flex justify-between font-plexSans text-[11.5px]">
                        <span className="text-ledger-body">{p.label}</span>
                        <span className="font-plexMono text-ledger-navy">{p.points}/{p.max}</span>
                      </div>
                      <div className="h-1 bg-ledger-hairline2"><div className="h-1 bg-ledger-navy" style={{ width: `${(p.points / p.max) * 100}%` }} /></div>
                      <div className="font-plexSans text-[10.5px] text-ledger-muted">{p.note}</div>
                    </div>
                  ))}
                  <div className="font-plexSans text-[11.5px] text-ledger-body pt-1">Suggested angle: <b>{ANGLE_LABEL[score.angle]}</b></div>
                </div>
              </Section>
            )}

            <Section title="Contact & online">
              <Rows rows={[
                ['Address', [b.address, b.city, 'FL', b.zip_code].filter(Boolean).join(', ')],
                ['County', detail?.county],
                ['Neighborhood', detail?.neighborhood],
                ['Phone', b.phone],
                ['Toll free', raw['Toll Free Number Combined']],
                ['Website', link(b.website)],
                ['Facebook', link(b.facebook_url, 'Facebook')],
                ['LinkedIn', link(detail?.linkedin_url, 'LinkedIn')],
                ['Twitter', link(raw['Twitter'], 'Twitter')],
                ['Mailing address', raw['Mailing Address'] ? `${raw['Mailing Address']}, ${raw['Mailing City'] ?? ''} ${raw['Mailing Zip Code'] ?? ''}` : null],
              ]} />
            </Section>

            <Section title="People">
              {executives.length
                ? <ul className="space-y-1">{executives.map(e => <li key={e} className="font-plexSans text-[12.5px] text-ledger-body">{e}</li>)}</ul>
                : <p className="font-plexSans text-[12px] text-ledger-muted">No executives on file.</p>}
            </Section>

            <Section title="Business profile">
              <Rows rows={[
                ['Legal name', raw['Legal Name']],
                ['Type', b.type_of_business],
                ['Location type', b.location_type],
                ['Home business', b.home_business == null ? null : b.home_business ? 'Yes' : 'No'],
                ['Franchise', b.franchise_description],
                ['Parent company', b.parent_company_name],
                ['Employees (range)', b.employee_size_range],
                ['Sales (range)', b.sales_volume_range],
                ['Corporate employees', raw['Corporate Employee Size Actual']],
                ['Cards accepted', raw['Credit Cards Accepted']],
                ['Data last updated', raw['Last Updated On']],
              ]} />
            </Section>

            <Section title="Industry codes">
              <Rows rows={[
                ['Primary SIC', b.primary_sic_code ? `${b.primary_sic_code} · ${b.primary_sic_description ?? ''}` : null],
                ['Primary NAICS', b.primary_naics_description],
                ['All SIC', detail?.sic_codes?.length ? detail.sic_codes.map(c => c.description ?? c.code).join(' · ') : null],
                ['All NAICS', detail?.naics_codes?.length ? detail.naics_codes.map(c => c.description ?? c.code).join(' · ') : null],
              ]} />
            </Section>

            <Section title="Hours">
              <Rows rows={hours} />
            </Section>

            <Section title="Property">
              <Rows rows={PROPERTY_FIELDS.map(f => [f, raw[f]] as [string, string | undefined])} />
            </Section>

            <Section title="Estimated annual expenses">
              <Rows rows={EXPENSE_FIELDS.map(f => [f.replace(/\s+Expenses?$/, '').replace(/\s+/g, ' '), raw[f]] as [string, string | undefined])} />
            </Section>
          </div>
        </div>

        {onPromote && score && (
          <div className="flex-shrink-0 border-t border-ledger-hairline bg-white px-5 py-3 flex items-center justify-end gap-3">
            {promoted
              ? <span className="font-plexMono text-[10px] uppercase tracking-[0.12em] text-ledger-green">In Working · lead created</span>
              : (
                <button
                  onClick={() => onPromote(business)}
                  className="bg-ledger-navy text-white font-plexMono text-[10px] uppercase tracking-[0.1em] px-4 py-2.5 hover:bg-ledger-navyHover"
                >
                  Move to Working
                </button>
              )}
          </div>
        )}
      </div>
    </div>
  );
}
