import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Lead, LeadStage } from '../types';
import TitleBand from '../components/ledger/TitleBand';
import Modal from '../components/ui/Modal';
import Badge, { getLeadStageBadge } from '../components/ui/Badge';
import { ArrowRight, User, Phone, Mail, Calendar } from 'lucide-react';

const ACTIVE_STAGES: LeadStage[] = [
  'New Lead', 'Contacted', 'Discovery Scheduled', 'Discovery Complete',
  'Proposal Drafting', 'Proposal Sent', 'Negotiation', 'Verbal Agreement',
  'Agreement Signed', 'Invoice Sent', 'Client Onboarding', 'Project Created',
];

const ALL_STAGES: LeadStage[] = [
  ...ACTIVE_STAGES,
  'Proposal Lost', 'No Response', 'Not a Fit', 'Future Opportunity',
];

const OPEN_STAGES: LeadStage[] = ACTIVE_STAGES.filter(s => s !== 'Project Created');
const PROPOSAL_STAGES: LeadStage[] = ['Proposal Drafting', 'Proposal Sent', 'Negotiation', 'Verbal Agreement'];

const OPPORTUNITY_TYPES = [
  'Market Expansion Analysis', 'Competitor Landscape Analysis', 'Site Selection',
  'Territory Optimization', 'Demographic Analysis', 'Commercial Real Estate Intelligence',
];

const LEAD_SOURCES = ['Referral', 'LinkedIn', 'Cold Outreach', 'Website', 'Conference', 'Social Media', 'Other'];

const emptyLead = (): Partial<Lead> => ({
  business_name: '', contact_name: '', email: '', phone: '', website: '',
  industry: '', service_area: '', business_size: '', crm_used: '',
  opportunity_type: '', problem_being_solved: '', lead_source: '',
  estimated_deal_value: undefined, expected_close_date: '',
  stage: 'New Lead', notes: '', next_action: '', follow_up_date: '',
});

type FilterKey = 'all' | 'followup' | 'proposal' | 'won';

const STAGE_DOT: Record<string, { dot: string; text: string }> = {
  'New Lead': { dot: 'bg-ledger-gray', text: 'text-ledger-gray' },
  'Contacted': { dot: 'bg-ledger-blue', text: 'text-ledger-blue' },
  'Discovery Scheduled': { dot: 'bg-ledger-blue', text: 'text-ledger-blue' },
  'Discovery Complete': { dot: 'bg-ledger-blue', text: 'text-ledger-blue' },
  'Negotiation': { dot: 'bg-ledger-blue', text: 'text-ledger-blue' },
  'Verbal Agreement': { dot: 'bg-ledger-blue', text: 'text-ledger-blue' },
  'Proposal Drafting': { dot: 'bg-ledger-amber', text: 'text-ledger-amber' },
  'Proposal Sent': { dot: 'bg-ledger-amber', text: 'text-ledger-amber' },
  'Agreement Signed': { dot: 'bg-ledger-green', text: 'text-ledger-green' },
  'Invoice Sent': { dot: 'bg-ledger-green', text: 'text-ledger-green' },
  'Client Onboarding': { dot: 'bg-ledger-green', text: 'text-ledger-green' },
  'Project Created': { dot: 'bg-ledger-green', text: 'text-ledger-green' },
  'Proposal Lost': { dot: 'bg-ledger-crimson', text: 'text-ledger-crimson' },
  'No Response': { dot: 'bg-ledger-gray', text: 'text-ledger-gray' },
  'Not a Fit': { dot: 'bg-ledger-gray', text: 'text-ledger-gray' },
  'Future Opportunity': { dot: 'bg-ledger-gray', text: 'text-ledger-gray' },
};

export default function Leads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [form, setForm] = useState<Partial<Lead>>(emptyLead());
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'pipeline'>('list');

  useEffect(() => { loadLeads(); }, []);

  async function loadLeads() {
    setLoading(true);
    const { data } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
    setLeads(data ?? []);
    setLoading(false);
  }

  async function logActivity(action: string, name: string) {
    await supabase.from('activity_log').insert({ action, entity_type: 'Lead', entity_name: name });
  }

  async function saveLead() {
    if (!form.business_name?.trim()) return;
    setSaving(true);
    const now = new Date().toISOString();
    if (selected) {
      const { error } = await supabase.from('leads').update({ ...form, updated_at: now }).eq('id', selected.id);
      if (!error) { await logActivity('Updated lead', form.business_name!); }
    } else {
      const { error } = await supabase.from('leads').insert({ ...form, created_at: now, updated_at: now });
      if (!error) { await logActivity('Created lead', form.business_name!); }
    }
    setSaving(false);
    setModalOpen(false);
    setSelected(null);
    setForm(emptyLead());
    loadLeads();
  }

  async function deleteLead(id: string, name: string) {
    if (!confirm(`Delete lead "${name}"?`)) return;
    await supabase.from('leads').delete().eq('id', id);
    await logActivity('Deleted lead', name);
    loadLeads();
  }

  async function updateStage(id: string, stage: LeadStage) {
    await supabase.from('leads').update({ stage, updated_at: new Date().toISOString() }).eq('id', id);
    setLeads(prev => prev.map(l => l.id === id ? { ...l, stage } : l));
    const lead = leads.find(l => l.id === id);
    if (lead) await logActivity(`Moved lead to ${stage}`, lead.business_name);
  }

  async function convertLead(lead: Lead) {
    if (!confirm(`Convert "${lead.business_name}" to a client account?`)) return;
    setConverting(lead.id);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase.from('clients').insert({
        business_name: lead.business_name,
        contact_name: lead.contact_name,
        email: lead.email,
        phone: lead.phone,
        website: lead.website,
        industry: lead.industry,
        service_area: lead.service_area,
        business_size: lead.business_size,
        notes: lead.notes,
        status: 'Active',
        lifetime_value: lead.estimated_deal_value ?? 0,
        lead_id: lead.id,
        created_at: now,
        updated_at: now,
      });
      if (error) throw error;
      await supabase.from('leads').update({ stage: 'Project Created', updated_at: now }).eq('id', lead.id);
      await logActivity('Converted lead to client', lead.business_name);
      await loadLeads();
    } catch (err) {
      console.error('Convert lead error:', err);
      alert('Could not convert this lead — check the console for details.');
    } finally {
      setConverting(null);
    }
  }

  const today = new Date().toISOString().split('T')[0];
  const openLeads = leads.filter(l => OPEN_STAGES.includes(l.stage));
  const needsFollowUp = openLeads.filter(l => l.follow_up_date && l.follow_up_date <= today);
  const proposalOut = openLeads.filter(l => PROPOSAL_STAGES.includes(l.stage));
  const won = openLeads.filter(l => l.stage === 'Agreement Signed');

  const tabs: { key: FilterKey; label: string; rows: Lead[] }[] = [
    { key: 'all', label: 'All stages', rows: openLeads },
    { key: 'followup', label: 'Needs follow-up', rows: needsFollowUp },
    { key: 'proposal', label: 'Proposal out', rows: proposalOut },
    { key: 'won', label: 'Won', rows: won },
  ];

  const tabRows = tabs.find(t => t.key === filter)?.rows ?? openLeads;
  const filtered = search
    ? tabRows.filter(l =>
        l.business_name.toLowerCase().includes(search.toLowerCase()) ||
        (l.contact_name ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : tabRows;
  const weighted = openLeads.reduce((s, l) => s + (l.estimated_deal_value ?? 0), 0);

  function openEdit(lead: Lead) {
    setSelected(lead);
    setForm({ ...lead });
    setModalOpen(true);
  }

  function openNew() {
    setSelected(null);
    setForm(emptyLead());
    setModalOpen(true);
  }

  function openDetail(lead: Lead) {
    setSelected(lead);
    setDetailOpen(true);
  }

  const set = (k: keyof Lead, v: any) => setForm(f => ({ ...f, [k]: v }));

  const fmt = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toLocaleString()}`;

  return (
    <>
      <TitleBand
        breadcrumb="Pipeline / Leads"
        title="Leads"
        stats={[
          { label: 'Open', value: openLeads.length.toString() },
          { label: 'Weighted', value: fmt(weighted) },
        ]}
        actionLabel="Add lead"
        onAction={openNew}
      />

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* Filter tabs */}
        <div className="flex-shrink-0 flex items-center gap-6 px-7 border-b border-ledger-hairline bg-white">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`relative py-3 font-plexMono text-[10px] uppercase tracking-[0.12em] transition-colors ${
                filter === tab.key ? 'text-ledger-navy' : 'text-ledger-muted hover:text-ledger-navy'
              }`}
            >
              {tab.label} {tab.rows.length}
              {filter === tab.key && <span className="absolute left-0 right-0 -bottom-px h-[2px] bg-ledger-crimson" />}
            </button>
          ))}

          <div className="flex-1" />

          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search leads…"
            className="w-40 bg-transparent font-plexSans text-[12px] text-ledger-navy placeholder-ledger-muted border-b border-transparent focus:border-ledger-navy focus:outline-none py-3"
          />

          <button
            onClick={() => setViewMode(v => v === 'list' ? 'pipeline' : 'list')}
            className="font-plexMono text-[9px] uppercase tracking-[0.1em] text-ledger-faint hover:text-ledger-navy transition-colors whitespace-nowrap"
          >
            {viewMode === 'list' ? 'Pipeline view' : 'List view'}
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-48 text-ledger-muted font-plexMono text-xs uppercase tracking-widest">
              Loading…
            </div>
          ) : viewMode === 'pipeline' ? (
            <div className="flex gap-4 overflow-x-auto p-6">
              {ACTIVE_STAGES.map(stage => {
                const stageLeads = filtered.filter(l => l.stage === stage);
                const dot = STAGE_DOT[stage] ?? STAGE_DOT['New Lead'];
                return (
                  <div key={stage} className="flex-shrink-0 w-64">
                    <div className="flex items-center justify-between mb-2.5 px-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${dot.dot}`} />
                        <span className={`font-plexMono text-[9px] uppercase tracking-[0.1em] ${dot.text}`}>{stage}</span>
                      </div>
                      <span className="font-plexMono text-[10px] text-ledger-muted">{stageLeads.length}</span>
                    </div>
                    <div className="space-y-2">
                      {stageLeads.map(lead => (
                        <div
                          key={lead.id}
                          className="bg-white border border-ledger-hairline2 p-3 cursor-pointer hover:bg-ledger-rowHover transition-colors"
                          onClick={() => openDetail(lead)}
                        >
                          <div className="font-plexSans text-[12px] font-medium text-ledger-navy truncate">{lead.business_name}</div>
                          {lead.contact_name && <div className="font-plexMono text-[10px] text-ledger-muted truncate mt-0.5">{lead.contact_name}</div>}
                          {lead.estimated_deal_value && (
                            <div className="font-plexMono text-[11px] font-medium text-ledger-green mt-1.5 tabular-nums">{fmt(lead.estimated_deal_value)}</div>
                          )}
                          {lead.follow_up_date && (
                            <div className="font-plexMono text-[9px] text-ledger-muted mt-1 flex items-center gap-1">
                              <Calendar size={10} />{lead.follow_up_date}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-ledger-hairline">
                  {['Business', 'Contact', 'Opportunity', 'Stage', 'Value', 'Follow up', ''].map((h, i) => (
                    <th
                      key={h || i}
                      className={`px-4 py-2.5 font-plexMono text-[9px] uppercase tracking-[0.12em] text-ledger-muted font-medium ${
                        i === 4 || i === 5 ? 'text-right' : 'text-left'
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-16 font-plexMono text-[10px] uppercase tracking-[0.14em] text-ledger-muted">
                      No leads match this filter
                    </td>
                  </tr>
                ) : filtered.map((lead, idx) => {
                  const dot = STAGE_DOT[lead.stage] ?? STAGE_DOT['New Lead'];
                  const isWon = lead.stage === 'Agreement Signed';
                  const isOverdue = !!lead.follow_up_date && lead.follow_up_date < today;
                  return (
                    <tr
                      key={lead.id}
                      onClick={() => openDetail(lead)}
                      className={`cursor-pointer border-b border-ledger-hairline2 last:border-b-0 hover:bg-ledger-rowHover transition-colors ${
                        isOverdue ? 'border-l-[3px] border-l-ledger-crimson bg-white' :
                        isWon ? 'border-l-[3px] border-l-ledger-green bg-white' :
                        `border-l-[3px] border-l-transparent ${idx % 2 === 1 ? 'bg-ledger-zebra' : 'bg-white'}`
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-plexSans text-[13px] font-medium text-ledger-navy">{lead.business_name}</div>
                        {lead.industry && (
                          <div className="font-plexMono text-[9px] uppercase tracking-[0.08em] text-ledger-muted mt-0.5">{lead.industry}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-plexSans text-[12px] text-ledger-body">{lead.contact_name ?? '—'}</div>
                        {lead.email && <div className="font-plexMono text-[10px] text-ledger-muted mt-0.5">{lead.email}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-plexSans text-[12px] text-ledger-mid max-w-xs truncate">{lead.opportunity_type ?? '—'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot.dot}`} />
                          <span className={`font-plexMono text-[10px] uppercase tracking-[0.08em] ${dot.text}`}>{lead.stage}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-plexMono text-[12px] font-medium text-ledger-navy tabular-nums">
                          {lead.estimated_deal_value ? fmt(lead.estimated_deal_value) : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-plexMono text-[10px] tabular-nums ${isOverdue ? 'text-ledger-crimson' : 'text-ledger-faint'}`}>
                          {lead.follow_up_date ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isWon ? (
                          <button
                            onClick={e => { e.stopPropagation(); convertLead(lead); }}
                            disabled={converting === lead.id}
                            className="font-plexMono text-[9px] uppercase tracking-[0.1em] bg-ledger-navy text-white px-3 py-1.5 hover:bg-ledger-navyHover transition-colors disabled:opacity-50"
                          >
                            {converting === lead.id ? 'Converting…' : 'Convert'}
                          </button>
                        ) : (
                          <ArrowRight size={13} className="text-ledger-muted inline-block" />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Lead Detail Modal */}
      <Modal
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={selected?.business_name ?? ''}
        size="lg"
        footer={
          <>
            <button onClick={() => { setDetailOpen(false); selected && openEdit(selected); }} className="btn-secondary">Edit Lead</button>
            {selected && <button onClick={() => { setDetailOpen(false); deleteLead(selected.id, selected.business_name); }} className="btn-danger">Delete</button>}
          </>
        }
      >
        {selected && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              {(() => { const b = getLeadStageBadge(selected.stage); return <Badge label={b.label} variant={b.variant} />; })()}
              {selected.estimated_deal_value && (
                <span className="text-sm font-bold text-emerald-700">${selected.estimated_deal_value.toLocaleString()}</span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {[
                { icon: User, label: 'Contact', value: selected.contact_name },
                { icon: Mail, label: 'Email', value: selected.email },
                { icon: Phone, label: 'Phone', value: selected.phone },
                { icon: Calendar, label: 'Follow Up', value: selected.follow_up_date },
              ].map(({ icon: Icon, label, value }) => value ? (
                <div key={label} className="flex items-start gap-2">
                  <Icon size={14} className="text-navy-400 mt-0.5" />
                  <div>
                    <div className="text-2xs text-navy-400 font-semibold uppercase tracking-wide">{label}</div>
                    <div className="text-navy-700">{value}</div>
                  </div>
                </div>
              ) : null)}
            </div>
            {selected.opportunity_type && (
              <div>
                <div className="form-label">Opportunity Type</div>
                <div className="text-sm text-navy-700">{selected.opportunity_type}</div>
              </div>
            )}
            {selected.problem_being_solved && (
              <div>
                <div className="form-label">Problem Being Solved</div>
                <div className="text-sm text-navy-700">{selected.problem_being_solved}</div>
              </div>
            )}
            {selected.notes && (
              <div>
                <div className="form-label">Notes</div>
                <div className="text-sm text-navy-700 whitespace-pre-wrap">{selected.notes}</div>
              </div>
            )}
            {selected.next_action && (
              <div>
                <div className="form-label">Next Action</div>
                <div className="text-sm text-navy-700">{selected.next_action}</div>
              </div>
            )}
            <div>
              <div className="form-label mb-2">Update Stage</div>
              <div className="flex flex-wrap gap-2">
                {ALL_STAGES.map(s => (
                  <button
                    key={s}
                    onClick={() => { updateStage(selected.id, s); setSelected(prev => prev ? { ...prev, stage: s } : prev); }}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      selected.stage === s
                        ? 'bg-navy-800 text-white border-navy-800'
                        : 'border-surface-300 text-navy-600 hover:border-navy-500 hover:text-navy-800'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={selected ? 'Edit Lead' : 'New Lead'}
        size="xl"
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={saveLead} disabled={saving} className="btn-primary">
              {saving ? 'Saving...' : selected ? 'Save Changes' : 'Create Lead'}
            </button>
          </>
        }
      >
        <div className="space-y-5">
          <div>
            <h3 className="text-xs font-bold text-navy-500 uppercase tracking-widest mb-3">Contact Information</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="form-label">Business Name *</label>
                <input className="form-input" value={form.business_name ?? ''} onChange={e => set('business_name', e.target.value)} />
              </div>
              <div>
                <label className="form-label">Contact Name</label>
                <input className="form-input" value={form.contact_name ?? ''} onChange={e => set('contact_name', e.target.value)} />
              </div>
              <div>
                <label className="form-label">Email</label>
                <input className="form-input" type="email" value={form.email ?? ''} onChange={e => set('email', e.target.value)} />
              </div>
              <div>
                <label className="form-label">Phone</label>
                <input className="form-input" value={form.phone ?? ''} onChange={e => set('phone', e.target.value)} />
              </div>
              <div>
                <label className="form-label">Website</label>
                <input className="form-input" value={form.website ?? ''} onChange={e => set('website', e.target.value)} />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold text-navy-500 uppercase tracking-widest mb-3">Business Information</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">Industry / Vertical</label>
                <input className="form-input" value={form.industry ?? ''} onChange={e => set('industry', e.target.value)} />
              </div>
              <div>
                <label className="form-label">Geographic Service Area</label>
                <input className="form-input" value={form.service_area ?? ''} onChange={e => set('service_area', e.target.value)} />
              </div>
              <div>
                <label className="form-label">Estimated Business Size</label>
                <input className="form-input" value={form.business_size ?? ''} onChange={e => set('business_size', e.target.value)} />
              </div>
              <div>
                <label className="form-label">CRM Currently Used</label>
                <input className="form-input" value={form.crm_used ?? ''} onChange={e => set('crm_used', e.target.value)} />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold text-navy-500 uppercase tracking-widest mb-3">Opportunity Information</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">Opportunity Type</label>
                <select className="form-select" value={form.opportunity_type ?? ''} onChange={e => set('opportunity_type', e.target.value)}>
                  <option value="">Select...</option>
                  {OPPORTUNITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Lead Source</label>
                <select className="form-select" value={form.lead_source ?? ''} onChange={e => set('lead_source', e.target.value)}>
                  <option value="">Select...</option>
                  {LEAD_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Estimated Deal Value ($)</label>
                <input className="form-input" type="number" value={form.estimated_deal_value ?? ''} onChange={e => set('estimated_deal_value', e.target.value ? parseFloat(e.target.value) : null)} />
              </div>
              <div>
                <label className="form-label">Expected Close Date</label>
                <input className="form-input" type="date" value={form.expected_close_date ?? ''} onChange={e => set('expected_close_date', e.target.value)} />
              </div>
              <div>
                <label className="form-label">Stage</label>
                <select className="form-select" value={form.stage} onChange={e => set('stage', e.target.value)}>
                  {ALL_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Follow-Up Date</label>
                <input className="form-input" type="date" value={form.follow_up_date ?? ''} onChange={e => set('follow_up_date', e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className="form-label">Problem Being Solved</label>
                <textarea className="form-input resize-none" rows={2} value={form.problem_being_solved ?? ''} onChange={e => set('problem_being_solved', e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className="form-label">Next Action</label>
                <input className="form-input" value={form.next_action ?? ''} onChange={e => set('next_action', e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className="form-label">Notes</label>
                <textarea className="form-input resize-none" rows={3} value={form.notes ?? ''} onChange={e => set('notes', e.target.value)} />
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
