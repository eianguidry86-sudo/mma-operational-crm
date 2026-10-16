import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, Copy, Loader2, RotateCcw, Search, X } from 'lucide-react';
import TitleBand from '../components/ledger/TitleBand';
import BusinessCard from '../components/market/BusinessCard';
import {
  dismissProspect, loadBoard, loadBusinesses, promoteProspect, restoreProspect, type ProspectBoardRow,
} from '../lib/marketData';
import {
  EMPLOYEE_ORDER, SALES_ORDER, YEARS_ORDER, majorGroup, nameKey, normRange, scoreBusiness, tieBreak, yearsBucket,
  type MarketBusiness, type ScoreBreakdown,
} from '../lib/prospectScoring';
import { supabase } from '../lib/supabase';

interface Filters {
  q: string;
  city: string;
  zip: string;
  sector: string;
  niche: string;
  employees: string;
  sales: string;
  years: string;
  independent: boolean;
  website: boolean;
  fitOnly: boolean;
}
const EMPTY: Filters = {
  q: '', city: '', zip: '', sector: '', niche: '', employees: '', sales: '', years: '',
  independent: false, website: false, fitOnly: false,
};

type Scored = MarketBusiness & {
  _score: ScoreBreakdown | null; _tie: number; _sector: string; _years: string; _sales: string | null;
};

/** CRM names often carry a suffix ("America's Home Place - Gainesville, FL Building Center"), so match on prefix too. */
function isExistingLead(name: string, leadNames: Set<string>) {
  const k = nameKey(name);
  if (leadNames.has(k)) return true;
  for (const l of leadNames) {
    if (Math.min(k.length, l.length) >= 8 && (k.startsWith(l) || l.startsWith(k))) return true;
  }
  return false;
}

const pct = (n: number, d: number) => (d ? `${((n / d) * 100).toFixed(n / d < 0.1 ? 1 : 0)}%` : '0%');
const nf = new Intl.NumberFormat('en-US');

function countBy(rows: Scored[], key: (r: Scored) => string | null | undefined) {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = key(r) || 'Unknown';
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

function ordered(m: Map<string, number>, order?: string[], limit = 12): [string, number][] {
  const entries = [...m.entries()];
  if (order) {
    return entries.sort((a, b) => {
      const ia = order.indexOf(a[0]); const ib = order.indexOf(b[0]);
      return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
    });
  }
  return entries.sort((a, b) => b[1] - a[1]).slice(0, limit);
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1 min-w-0">
      <span className="font-plexMono text-[8.5px] uppercase tracking-[0.14em] text-ledger-muted">{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`h-8 border px-2 font-plexSans text-[12px] bg-white min-w-0 ${value ? 'border-ledger-navy text-ledger-navy' : 'border-ledger-hairline text-ledger-body'}`}
      >
        <option value="">All</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`h-8 px-2.5 border font-plexMono text-[9.5px] uppercase tracking-[0.1em] whitespace-nowrap ${
        on ? 'bg-ledger-navy border-ledger-navy text-white' : 'bg-white border-ledger-hairline text-ledger-soft hover:border-ledger-navy'
      }`}
    >
      {label}
    </button>
  );
}

function Panel({ title, rows, total, active, onPick }: {
  title: string; rows: [string, number][]; total: number; active?: string; onPick?: (k: string) => void;
}) {
  const max = Math.max(1, ...rows.map(r => r[1]));
  return (
    <div className="bg-white border border-ledger-hairline p-4 min-w-0">
      <h3 className="font-plexMono text-[9px] uppercase tracking-[0.15em] text-ledger-crimson mb-3">{title}</h3>
      <div className="space-y-1.5">
        {rows.map(([k, n]) => (
          <button
            key={k}
            onClick={() => onPick?.(active === k ? '' : k)}
            disabled={!onPick}
            className={`w-full text-left group ${onPick ? 'cursor-pointer' : 'cursor-default'}`}
            title={onPick ? (active === k ? 'Clear this filter' : 'Filter to this') : undefined}
          >
            <div className="flex justify-between gap-2 font-plexSans text-[11.5px]">
              <span className={`truncate ${active === k ? 'text-ledger-crimson font-medium' : 'text-ledger-body group-hover:text-ledger-navy'}`}>{k}</span>
              <span className="font-plexMono text-[10.5px] text-ledger-mid flex-shrink-0">{nf.format(n)} · {pct(n, total)}</span>
            </div>
            <div className="h-1.5 bg-ledger-hairline2 mt-0.5">
              <div className={`h-1.5 ${active === k ? 'bg-ledger-crimson' : 'bg-ledger-navy/80'}`} style={{ width: `${(n / max) * 100}%` }} />
            </div>
          </button>
        ))}
        {!rows.length && <p className="font-plexSans text-[12px] text-ledger-muted">No businesses match.</p>}
      </div>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white border border-ledger-hairline px-4 py-3 min-w-0">
      <div className="font-plexMono text-[8.5px] uppercase tracking-[0.14em] text-ledger-muted">{label}</div>
      <div className="font-serifLedger text-[28px] leading-none text-ledger-navy mt-1">{value}</div>
      {sub && <div className="font-plexSans text-[11px] text-ledger-muted mt-1">{sub}</div>}
    </div>
  );
}

const KEYSTONE_LABEL: Record<ProspectBoardRow['keystone_status'], [string, string]> = {
  pending: ['Queued for Keystone', 'text-ledger-amber'],
  synced: ['In Keystone', 'text-ledger-green'],
  error: ['Keystone sync error', 'text-ledger-crimson'],
  skipped: ['', ''],
};

export default function MarketIntel() {
  const [rows, setRows] = useState<Scored[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [board, setBoard] = useState<ProspectBoardRow[]>([]);
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [open, setOpen] = useState<MarketBusiness | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [copied, setCopied] = useState(false);
  const [page, setPage] = useState(0);
  const [showDismissed, setShowDismissed] = useState(false);
  const [leadNames, setLeadNames] = useState<Set<string>>(new Set());
  const closeCard = useCallback(() => setOpen(null), []);

  useEffect(() => {
    loadBusinesses()
      .then(list => setRows(list.map(b => ({
        ...b,
        _score: scoreBusiness(b),
        _tie: tieBreak(b),
        _sector: majorGroup(b.primary_sic_code),
        _years: yearsBucket(b),
        _sales: normRange(b.sales_volume_range),
      }))))
      .catch(e => setLoadError(e.message));
    loadBoard().then(setBoard).catch(e => setActionError(e.message));
    // Businesses already in the CRM (roadside, inbound, earlier promotions) never resurface in the Top 10.
    supabase.from('leads').select('business_name').then(({ data }) =>
      setLeadNames(new Set((data ?? []).map(l => nameKey(l.business_name)))));
  }, []);

  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => { setFilters(f => ({ ...f, [k]: v })); setPage(0); };

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = filters.q.trim().toLowerCase();
    return rows.filter(r =>
      (!q || `${r.company_name} ${r.primary_sic_description} ${r.executive_last_name ?? ''}`.toLowerCase().includes(q)) &&
      (!filters.city || r.city === filters.city) &&
      (!filters.zip || r.zip_code === filters.zip) &&
      (!filters.sector || r._sector === filters.sector) &&
      (!filters.niche || r.primary_sic_description === filters.niche) &&
      (!filters.employees || r.employee_size_range === filters.employees) &&
      (!filters.sales || r._sales === filters.sales) &&
      (!filters.years || r._years === filters.years) &&
      (!filters.independent || (r.location_type === 'Single Loc' && !r.franchise_description && !r.parent_company_name)) &&
      (!filters.website || !!r.website) &&
      (!filters.fitOnly || (r._score?.total ?? 0) >= 60));
  }, [rows, filters]);

  const options = useMemo(() => {
    const uniq = (f: (r: Scored) => string | null | undefined) =>
      [...new Set((rows ?? []).map(f).filter((v): v is string => !!v))].sort();
    return {
      city: uniq(r => r.city),
      zip: uniq(r => r.zip_code),
      sector: uniq(r => r._sector),
      niche: uniq(r => r.primary_sic_description),
      employees: EMPLOYEE_ORDER.filter(e => rows?.some(r => r.employee_size_range === e)),
      sales: SALES_ORDER.filter(s => rows?.some(r => r._sales === s)),
      years: YEARS_ORDER,
    };
  }, [rows]);

  const onBoard = useMemo(() => new Map(board.map(b => [b.iusa_number, b])), [board]);
  const working = board.filter(b => b.status === 'working');
  const dismissed = board.filter(b => b.status === 'dismissed');

  const top10 = useMemo(() => filtered
    .filter(r => r._score && !onBoard.has(r.iusa_number) && !isExistingLead(r.company_name, leadNames))
    .sort((a, b) => (b._score!.total - a._score!.total) || (b._tie - a._tie))
    .slice(0, 10), [filtered, onBoard, leadNames]);

  const total = rows?.length ?? 0;
  const n = filtered.length;
  const fits = filtered.filter(r => (r._score?.total ?? 0) >= 60).length;
  const withSite = filtered.filter(r => r.website).length;
  const indep = filtered.filter(r => r.location_type === 'Single Loc' && !r.franchise_description && !r.parent_company_name).length;
  const under10 = filtered.filter(r => r.employee_size_range === '1 to 4' || r.employee_size_range === '5 to 9').length;

  const scope = [filters.city || 'the five-city area', filters.zip && `ZIP ${filters.zip}`].filter(Boolean).join(', ');
  const subject = filters.niche || filters.sector || null;
  const insight = !rows ? '' : subject
    ? `${subject} accounts for ${nf.format(n)} of ${nf.format(total)} businesses in ${scope} (${pct(n, total)}). ` +
      `${pct(under10, n)} of them have fewer than 10 employees, ${pct(withSite, n)} list a website, and ${pct(indep, n)} are independent single-location businesses.`
    : `${nf.format(n)} of ${nf.format(total)} businesses in ${scope} match these filters (${pct(n, total)}). ` +
      `${pct(under10, n)} have fewer than 10 employees and ${pct(withSite, n)} list a website.`;

  const promote = useCallback(async (b: MarketBusiness) => {
    const s = scoreBusiness(b);
    if (!s || onBoard.get(b.iusa_number)?.status === 'working') return;
    setBusy(b.iusa_number);
    setActionError(null);
    try {
      await promoteProspect(b, s);
      setLeadNames(prev => new Set(prev).add(nameKey(b.company_name)));
      setBoard(await loadBoard());
    } catch (e) {
      setActionError(`Couldn't move ${b.company_name}: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  }, [onBoard]);

  const dismiss = async (r: Scored) => {
    setBusy(r.iusa_number);
    try { await dismissProspect(r, r._score?.total ?? null); setBoard(await loadBoard()); }
    catch (e) { setActionError((e as Error).message); }
    finally { setBusy(null); }
  };

  const restore = async (iusa: string) => {
    try { await restoreProspect(iusa); setBoard(await loadBoard()); }
    catch (e) { setActionError((e as Error).message); }
  };

  const listed = [...filtered].sort((a, b) => ((b._score?.total ?? -1) - (a._score?.total ?? -1)) || (b._tie - a._tie));
  const PAGE = 25;
  const activeCount = Object.entries(filters).filter(([k, v]) => k !== 'q' && v).length + (filters.q ? 1 : 0);

  return (
    <>
      <TitleBand
        breadcrumb="Market Intel · Data Axle Reference Solutions"
        title="Gainesville market"
        stats={[
          { label: 'In view', value: rows ? `${nf.format(n)} / ${nf.format(total)}` : '…' },
          { label: 'Avatar fits', value: rows ? nf.format(fits) : '…', tone: 'crimson' },
          { label: 'Working', value: String(working.length), tone: 'green' },
        ]}
      />

      <div className="flex-1 overflow-y-auto">
        {loadError && (
          <div className="m-6 border border-ledger-crimson bg-white p-4 font-plexSans text-[13px] text-ledger-body">
            <b className="text-ledger-crimson">Market data didn't load.</b> {loadError}
            {/MMA_DATA_SERVICE_KEY/.test(loadError) && (
              <p className="mt-1 text-ledger-muted">Add the mma-data service-role key as the <code>MMA_DATA_SERVICE_KEY</code> Edge Function secret on the mma-crm project (Supabase dashboard → Edge Functions → Secrets).</p>
            )}
          </div>
        )}
        {!rows && !loadError && (
          <div className="p-10 flex items-center gap-2 font-plexMono text-[10px] uppercase tracking-[0.15em] text-ledger-muted">
            <Loader2 size={14} className="animate-spin" /> Loading businesses…
          </div>
        )}

        {rows && (
          <>
            {/* Filters */}
            <div className="sticky top-0 z-10 bg-ledger-paper/95 backdrop-blur border-b border-ledger-hairline px-4 sm:px-7 py-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 items-end">
                <label className="flex flex-col gap-1 col-span-2 sm:col-span-4 lg:col-span-2">
                  <span className="font-plexMono text-[8.5px] uppercase tracking-[0.14em] text-ledger-muted">Search</span>
                  <div className="h-8 border border-ledger-hairline bg-white flex items-center px-2 gap-1.5">
                    <Search size={12} className="text-ledger-muted" />
                    <input value={filters.q} onChange={e => set('q', e.target.value)} placeholder="Name, niche, owner…"
                      className="flex-1 min-w-0 bg-transparent font-plexSans text-[12px] outline-none" />
                  </div>
                </label>
                <Select label="City" value={filters.city} options={options.city} onChange={v => set('city', v)} />
                <Select label="ZIP" value={filters.zip} options={options.zip} onChange={v => set('zip', v)} />
                <Select label="Sector" value={filters.sector} options={options.sector} onChange={v => set('sector', v)} />
                <Select label="Niche" value={filters.niche} options={options.niche} onChange={v => set('niche', v)} />
                <Select label="Employees" value={filters.employees} options={options.employees} onChange={v => set('employees', v)} />
                <Select label="Sales" value={filters.sales} options={options.sales} onChange={v => set('sales', v)} />
              </div>
              <div className="flex flex-wrap items-end gap-2 mt-2">
                <div className="w-36"><Select label="Years in business" value={filters.years} options={options.years} onChange={v => set('years', v)} /></div>
                <Toggle label="Independent only" on={filters.independent} onChange={v => set('independent', v)} />
                <Toggle label="Has website" on={filters.website} onChange={v => set('website', v)} />
                <Toggle label="Avatar fit 60+" on={filters.fitOnly} onChange={v => set('fitOnly', v)} />
                {activeCount > 0 && (
                  <button onClick={() => { setFilters(EMPTY); setPage(0); }} className="h-8 px-2.5 inline-flex items-center gap-1 font-plexMono text-[9.5px] uppercase tracking-[0.1em] text-ledger-crimson hover:underline">
                    <RotateCcw size={11} /> Reset ({activeCount})
                  </button>
                )}
              </div>
            </div>

            <div className="px-4 sm:px-7 py-5 space-y-6">
              {/* Insight */}
              <div className="flex items-start gap-3 bg-white border-l-2 border-ledger-crimson border-y border-r border-y-ledger-hairline border-r-ledger-hairline px-4 py-3">
                <p className="flex-1 font-plexSans text-[13.5px] text-ledger-body leading-relaxed">{insight}</p>
                <button
                  onClick={() => { navigator.clipboard?.writeText(insight); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                  className="flex-shrink-0 text-ledger-muted hover:text-ledger-navy" title="Copy for a client report"
                >
                  {copied ? <Check size={15} className="text-ledger-green" /> : <Copy size={15} />}
                </button>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <Kpi label="Businesses in view" value={nf.format(n)} sub={`${pct(n, total)} of ${nf.format(total)}`} />
                <Kpi label="Avatar fits (60+)" value={nf.format(fits)} sub={pct(fits, n)} />
                <Kpi label="Under 10 employees" value={pct(under10, n)} sub={`${nf.format(under10)} businesses`} />
                <Kpi label="List a website" value={pct(withSite, n)} sub={`${nf.format(withSite)} businesses`} />
                <Kpi label="Independent, single site" value={pct(indep, n)} sub={`${nf.format(indep)} businesses`} />
              </div>

              {/* Prospect board */}
              <section>
                <div className="flex items-end justify-between mb-2">
                  <h2 className="font-serifLedger text-[24px] text-ledger-navy leading-none">Prospect board</h2>
                  <span className="font-plexSans text-[11.5px] text-ledger-muted">
                    Top 10 follows the filters above. Drag a card to Working (or use the arrow) to create the lead and queue a Keystone task.
                  </span>
                </div>
                {actionError && <p className="font-plexSans text-[12px] text-ledger-crimson mb-2">{actionError}</p>}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="bg-ledger-zebra border border-ledger-hairline p-3">
                    <div className="font-plexMono text-[9px] uppercase tracking-[0.15em] text-ledger-navy mb-2">Top 10 · best avatar fits</div>
                    <div className="space-y-2">
                      {top10.map((r, i) => (
                        <div
                          key={r.iusa_number}
                          draggable
                          onDragStart={e => e.dataTransfer.setData('text/plain', r.iusa_number)}
                          onClick={() => setOpen(r)}
                          className={`bg-white border border-ledger-hairline hover:border-ledger-navy px-3 py-2.5 flex items-center gap-3 cursor-grab active:cursor-grabbing ${busy === r.iusa_number ? 'opacity-50' : ''}`}
                        >
                          <span className="font-plexMono text-[10px] text-ledger-muted w-4">{i + 1}</span>
                          <div className="min-w-0 flex-1">
                            <div className="font-plexSans text-[13px] font-medium text-ledger-navy truncate">{r.company_name}</div>
                            <div className="font-plexSans text-[11px] text-ledger-muted truncate">
                              {r.primary_sic_description} · {r.city} · {r.employee_size_range ?? '?'} emp
                            </div>
                          </div>
                          <span className="font-serifLedger text-[22px] text-ledger-navy leading-none" title="Avatar fit score">{r._score!.total}</span>
                          <button onClick={e => { e.stopPropagation(); dismiss(r); }} title="Not a fit: skip" className="text-ledger-muted hover:text-ledger-crimson"><X size={14} /></button>
                          <button onClick={e => { e.stopPropagation(); promote(r); }} title="Move to Working" className="text-ledger-navy hover:text-ledger-crimson"><ArrowRight size={15} /></button>
                        </div>
                      ))}
                      {!top10.length && <p className="font-plexSans text-[12px] text-ledger-muted p-2">No scored businesses left for these filters.</p>}
                    </div>
                    {dismissed.length > 0 && (
                      <button onClick={() => setShowDismissed(s => !s)} className="mt-2 font-plexMono text-[9px] uppercase tracking-[0.12em] text-ledger-muted hover:text-ledger-navy">
                        {showDismissed ? 'Hide' : 'Show'} skipped ({dismissed.length})
                      </button>
                    )}
                    {showDismissed && (
                      <ul className="mt-1 space-y-1">
                        {dismissed.map(d => (
                          <li key={d.iusa_number} className="flex items-center justify-between font-plexSans text-[11.5px] text-ledger-muted">
                            <span className="truncate">{d.business_name}</span>
                            <button onClick={() => restore(d.iusa_number)} className="text-ledger-blue hover:underline flex-shrink-0">restore</button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={e => {
                      e.preventDefault();
                      setDragOver(false);
                      const r = rows.find(x => x.iusa_number === e.dataTransfer.getData('text/plain'));
                      if (r) promote(r);
                    }}
                    className={`border p-3 transition-colors ${dragOver ? 'bg-white border-ledger-crimson border-dashed' : 'bg-ledger-zebra border-ledger-hairline'}`}
                  >
                    <div className="font-plexMono text-[9px] uppercase tracking-[0.15em] text-ledger-navy mb-2">Working · {working.length}</div>
                    <div className="space-y-2">
                      {busy && !working.some(w => w.iusa_number === busy) && top10.some(t => t.iusa_number === busy) && (
                        <div className="bg-white border border-dashed border-ledger-hairline px-3 py-2.5 font-plexMono text-[10px] uppercase tracking-[0.12em] text-ledger-muted inline-flex items-center gap-2 w-full">
                          <Loader2 size={12} className="animate-spin" /> Creating lead…
                        </div>
                      )}
                      {working.map(w => {
                        const r = rows.find(x => x.iusa_number === w.iusa_number);
                        const [ks, ksClass] = KEYSTONE_LABEL[w.keystone_status];
                        return (
                          <div
                            key={w.iusa_number}
                            onClick={() => setOpen(r ?? (w.snapshot as MarketBusiness))}
                            className="bg-white border border-ledger-hairline hover:border-ledger-navy px-3 py-2.5 flex items-center gap-3 cursor-pointer"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="font-plexSans text-[13px] font-medium text-ledger-navy truncate">{w.business_name}</div>
                              <div className="font-plexSans text-[11px] text-ledger-muted truncate">
                                {w.snapshot.primary_sic_description} · {w.snapshot.city} · moved {new Date(w.moved_at).toLocaleDateString()}
                              </div>
                            </div>
                            <span className={`font-plexMono text-[9px] uppercase tracking-[0.1em] ${ksClass}`} title={w.keystone_error ?? undefined}>{ks}</span>
                            <span className="font-serifLedger text-[20px] text-ledger-navy/70 leading-none">{w.score ?? '–'}</span>
                          </div>
                        );
                      })}
                      {!working.length && (
                        <p className="font-plexSans text-[12px] text-ledger-muted p-6 text-center border border-dashed border-ledger-hairline">
                          Drop a business here to start working it.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              {/* Distributions */}
              <section>
                <h2 className="font-serifLedger text-[24px] text-ledger-navy leading-none mb-3">Market breakdown</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  <Panel title="Share by sector" rows={ordered(countBy(filtered, r => r._sector))} total={n} active={filters.sector} onPick={v => set('sector', v)} />
                  <Panel title="Top niches" rows={ordered(countBy(filtered, r => r.primary_sic_description), undefined, 15)} total={n} active={filters.niche} onPick={v => set('niche', v)} />
                  <Panel title="Employees (this location)" rows={ordered(countBy(filtered, r => r.employee_size_range), [...EMPLOYEE_ORDER, 'Unknown'])} total={n} active={filters.employees} onPick={v => set('employees', v === 'Unknown' ? '' : v)} />
                  <Panel title="Sales volume (this location)" rows={ordered(countBy(filtered, r => r._sales), [...SALES_ORDER, 'Unknown'])} total={n} active={filters.sales} onPick={v => set('sales', v === 'Unknown' ? '' : v)} />
                  <Panel title="Years in business" rows={ordered(countBy(filtered, r => r._years), YEARS_ORDER)} total={n} active={filters.years} onPick={v => set('years', v)} />
                  <Panel title="City" rows={ordered(countBy(filtered, r => r.city))} total={n} active={filters.city} onPick={v => set('city', v)} />
                  <Panel title="Top ZIP codes" rows={ordered(countBy(filtered, r => r.zip_code))} total={n} active={filters.zip} onPick={v => set('zip', v)} />
                  <Panel title="Location type" rows={ordered(countBy(filtered, r => r.location_type))} total={n} />
                  <Panel title="Avatar fit tier" rows={ordered(countBy(filtered, r => !r._score ? 'Outside the avatar' : r._score.total >= 75 ? 'Strong (75+)' : r._score.total >= 60 ? 'Good (60-74)' : r._score.total >= 40 ? 'Possible (40-59)' : 'Weak (<40)'),
                    ['Strong (75+)', 'Good (60-74)', 'Possible (40-59)', 'Weak (<40)', 'Outside the avatar'])} total={n} />
                </div>
              </section>

              {/* Browse */}
              <section>
                <div className="flex items-end justify-between mb-2">
                  <h2 className="font-serifLedger text-[24px] text-ledger-navy leading-none">Businesses</h2>
                  <span className="font-plexMono text-[10px] text-ledger-muted">
                    {nf.format(n)} · sorted by avatar fit · page {page + 1} of {Math.max(1, Math.ceil(n / PAGE))}
                  </span>
                </div>
                <div className="bg-white border border-ledger-hairline overflow-x-auto">
                  <table className="w-full min-w-[720px]">
                    <thead>
                      <tr className="border-b border-ledger-navy">
                        {['Business', 'Niche', 'City / ZIP', 'Employees', 'Sales', 'Online', 'Fit'].map(h => (
                          <th key={h} className="text-left font-plexMono text-[8.5px] uppercase tracking-[0.14em] text-ledger-muted px-3 py-2">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {listed.slice(page * PAGE, page * PAGE + PAGE).map((r, i) => (
                        <tr key={r.iusa_number} onClick={() => setOpen(r)}
                          className={`cursor-pointer hover:bg-ledger-rowHover ${i % 2 ? 'bg-ledger-zebra' : ''}`}>
                          <td className="px-3 py-2 font-plexSans text-[12.5px] text-ledger-navy font-medium">
                            {r.company_name}
                            {onBoard.get(r.iusa_number)?.status === 'working' && <span className="ml-2 font-plexMono text-[8.5px] uppercase text-ledger-green">working</span>}
                          </td>
                          <td className="px-3 py-2 font-plexSans text-[12px] text-ledger-body">{r.primary_sic_description}</td>
                          <td className="px-3 py-2 font-plexSans text-[12px] text-ledger-body">{r.city} {r.zip_code}</td>
                          <td className="px-3 py-2 font-plexMono text-[11px] text-ledger-body">{r.employee_size_range ?? '—'}</td>
                          <td className="px-3 py-2 font-plexMono text-[11px] text-ledger-body">{r._sales ?? '—'}</td>
                          <td className="px-3 py-2 font-plexMono text-[10px] text-ledger-muted">{[r.website && 'web', r.facebook_url && 'fb'].filter(Boolean).join(' · ') || '—'}</td>
                          <td className="px-3 py-2 font-plexMono text-[12px] text-ledger-navy">{r._score?.total ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end gap-2 mt-2">
                  <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="h-7 px-3 border border-ledger-hairline bg-white font-plexMono text-[9.5px] uppercase disabled:opacity-40">Prev</button>
                  <button disabled={(page + 1) * PAGE >= n} onClick={() => setPage(p => p + 1)} className="h-7 px-3 border border-ledger-hairline bg-white font-plexMono text-[9.5px] uppercase disabled:opacity-40">Next</button>
                </div>
              </section>
            </div>
          </>
        )}
      </div>

      <BusinessCard
        business={open}
        onClose={closeCard}
        onPromote={b => promote(b)}
        promoted={!!open && onBoard.get(open.iusa_number)?.status === 'working'}
      />
    </>
  );
}
