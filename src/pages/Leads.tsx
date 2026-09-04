import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Lead, LeadStage } from '../types';
import Header from '../components/layout/Header';
import Modal from '../components/ui/Modal';
import Badge, { getLeadStageBadge } from '../components/ui/Badge';
import { Plus, ChevronRight, Search, Filter, User, Phone, Mail, DollarSign, Calendar } from 'lucide-react';

const ACTIVE_STAGES: LeadStage[] = [
  'New Lead', 'Contacted', 'Discovery Scheduled', 'Discovery Complete',
  'Proposal Drafting', 'Proposal Sent', 'Negotiation', 'Verbal Agreement',
  'Agreement Signed', 'Invoice Sent', 'Client Onboarding', 'Project Created',
];

const ALL_STAGES: LeadStage[] = [
  ...ACTIVE_STAGES,
  'Proposal Lost', 'No Response', 'Not a Fit', 'Future Opportunity',
];

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

export default function Leads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [form, setForm] = useState<Partial<Lead>>(emptyLead());
  const [saving, setSaving] = useState(false);
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

  const filtered = leads.filter(l => {
    const matchSearch = !search ||
      l.business_name.toLowerCase().includes(search.toLowerCase()) ||
      (l.contact_name ?? '').toLowerCase().includes(search.toLowerCase());
    const matchStage = stageFilter === 'all' || l.stage === stageFilter;
    return matchSearch && matchStage;
  });

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

  const pipelineStages = ACTIVE_STAGES.filter(s =>
    filtered.some(l => l.stage === s) || true
  ).slice(0, 6);

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="Leads"
        subtitle={`${leads.length} total`}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode(v => v === 'list' ? 'pipeline' : 'list')}
              className="btn-secondary py-1.5 px-3 text-xs"
            >
              {viewMode === 'list' ? 'Pipeline View' : 'List View'}
            </button>
            <button onClick={openNew} className="btn-primary py-1.5 px-3 text-xs">
              <Plus size={14} /> Add Lead
            </button>
          </div>
        }
      />

      <div className="flex-1 p-6 flex flex-col gap-4 overflow-y-auto">
        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400" />
            <input
              className="form-input pl-9 py-1.5 text-xs"
              placeholder="Search leads..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={13} className="text-navy-400" />
            <select
              className="form-select py-1.5 text-xs w-44"
              value={stageFilter}
              onChange={e => setStageFilter(e.target.value)}
            >
              <option value="all">All Stages</option>
              {ALL_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-navy-400 text-sm">Loading leads...</div>
        ) : viewMode === 'pipeline' ? (
          /* Pipeline View */
          <div className="flex gap-4 overflow-x-auto pb-4">
            {ACTIVE_STAGES.map(stage => {
              const stageLeads = filtered.filter(l => l.stage === stage);
              const badge = getLeadStageBadge(stage);
              return (
                <div key={stage} className="flex-shrink-0 w-64">
                  <div className="flex items-center justify-between mb-2.5 px-1">
                    <div className="flex items-center gap-2">
                      <Badge label={stage} variant={badge.variant} size="xs" />
                    </div>
                    <span className="text-xs font-semibold text-navy-500">{stageLeads.length}</span>
                  </div>
                  <div className="space-y-2">
                    {stageLeads.map(lead => (
                      <div key={lead.id} className="card p-3 cursor-pointer hover:shadow-card-hover transition-all" onClick={() => openDetail(lead)}>
                        <div className="font-medium text-sm text-navy-800 mb-1 truncate">{lead.business_name}</div>
                        {lead.contact_name && <div className="text-xs text-navy-400 truncate">{lead.contact_name}</div>}
                        {lead.estimated_deal_value && (
                          <div className="text-xs font-semibold text-emerald-700 mt-1">${lead.estimated_deal_value.toLocaleString()}</div>
                        )}
                        {lead.follow_up_date && (
                          <div className="text-2xs text-navy-400 mt-1 flex items-center gap-1">
                            <Calendar size={10} />Follow up: {lead.follow_up_date}
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
          /* List View */
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">Business</th>
                  <th className="table-header">Contact</th>
                  <th className="table-header">Opportunity</th>
                  <th className="table-header">Stage</th>
                  <th className="table-header">Value</th>
                  <th className="table-header">Follow Up</th>
                  <th className="table-header w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="table-cell text-center text-navy-400 py-12">No leads found</td>
                  </tr>
                ) : filtered.map(lead => {
                  const badge = getLeadStageBadge(lead.stage);
                  return (
                    <tr key={lead.id} className="hover:bg-surface-50 transition-colors cursor-pointer" onClick={() => openDetail(lead)}>
                      <td className="table-cell">
                        <div className="font-medium text-navy-800">{lead.business_name}</div>
                        {lead.industry && <div className="text-xs text-navy-400">{lead.industry}</div>}
                      </td>
                      <td className="table-cell">
                        <div className="text-navy-700">{lead.contact_name ?? '—'}</div>
                        {lead.email && <div className="text-xs text-navy-400">{lead.email}</div>}
                      </td>
                      <td className="table-cell">
                        <div className="text-sm text-navy-600 max-w-xs truncate">{lead.opportunity_type ?? '—'}</div>
                      </td>
                      <td className="table-cell">
                        <Badge label={badge.label} variant={badge.variant} />
                      </td>
                      <td className="table-cell">
                        {lead.estimated_deal_value ? (
                          <span className="font-semibold text-emerald-700">${lead.estimated_deal_value.toLocaleString()}</span>
                        ) : '—'}
                      </td>
                      <td className="table-cell text-xs text-navy-500">{lead.follow_up_date ?? '—'}</td>
                      <td className="table-cell">
                        <button
                          onClick={e => { e.stopPropagation(); openEdit(lead); }}
                          className="text-navy-400 hover:text-navy-700 transition-colors"
                        >
                          <ChevronRight size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
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
    </div>
  );
}
