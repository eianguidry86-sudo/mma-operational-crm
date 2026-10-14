import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Project, Client, ProjectStatus, WaitingOn, DataChecklist } from '../types';
import TitleBand from '../components/ledger/TitleBand';
import Modal from '../components/ui/Modal';
import Badge, { getProjectStatusBadge } from '../components/ui/Badge';
import { CheckSquare, ArrowRight } from 'lucide-react';
import ProjectSnapshot from './ProjectSnapshot';
const PROJECT_STATUSES: ProjectStatus[] = [
  'Project Acceptance', 'Data Acquisition / Validation', 'Analysis', 'Analysis QC',
  'Report Generation', 'Final Product QC', 'Delivery', 'Completed', 'On Hold',
];

const WAITING_ON: WaitingOn[] = [
  null, 'Waiting on Client Data', 'Waiting on Payment', 'Waiting on Internal Analysis',
  'Waiting on QC', 'Waiting on Report Review', 'Ready for Delivery',
];

const SERVICE_TYPES = [
  'Market Expansion Analysis', 'Competitor Landscape Analysis', 'Site Selection',
  'Territory Optimization', 'Demographic Analysis', 'Commercial Real Estate Intelligence',
];

const emptyProject = (): Partial<Project> => ({
  project_name: '', service_type: '', project_summary: '', status: 'Project Acceptance',
  waiting_on: null, start_date: '', due_date: '', delivery_date: '',
  invoice_status: 'Not Invoiced', payment_status: 'Unpaid', internal_notes: '',
  data_checklist: {
    crm_data_received: false, crm_data_validated: false, reference_solutions_acquired: false,
    census_data_acquired: false, google_places_acquired: false, review_data_acquired: false,
    additional_sources_acquired: false,
  },
});

const CHECKLIST_LABELS: Record<keyof DataChecklist, string> = {
  crm_data_received: 'CRM Data Received',
  crm_data_validated: 'CRM Data Validated',
  reference_solutions_acquired: 'Reference Solutions Acquired',
  census_data_acquired: 'Census Data Acquired',
  google_places_acquired: 'Google Places Acquired',
  review_data_acquired: 'Review Data Acquired',
  additional_sources_acquired: 'Additional Sources Acquired',
};

const STAGE_DOT: Record<string, { dot: string; text: string }> = {
  'Project Acceptance': { dot: 'bg-ledger-blue', text: 'text-ledger-blue' },
  'Data Acquisition / Validation': { dot: 'bg-ledger-amber', text: 'text-ledger-amber' },
  'Analysis': { dot: 'bg-ledger-amber', text: 'text-ledger-amber' },
  'Analysis QC': { dot: 'bg-ledger-amber', text: 'text-ledger-amber' },
  'Report Generation': { dot: 'bg-ledger-navy', text: 'text-ledger-navy' },
  'Final Product QC': { dot: 'bg-ledger-navy', text: 'text-ledger-navy' },
  'Delivery': { dot: 'bg-ledger-green', text: 'text-ledger-green' },
  'Completed': { dot: 'bg-ledger-green', text: 'text-ledger-green' },
  'On Hold': { dot: 'bg-ledger-gray', text: 'text-ledger-gray' },
};

type DeliveryFilterKey = 'all' | 'blocked' | 'overdue' | 'qc';

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<DeliveryFilterKey>('all');
  const [selected, setSelected] = useState<Project | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<Partial<Project>>(emptyProject());
  const [clientId, setClientId] = useState('');
  const [saving, setSaving] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [viewingSnapshot, setViewingSnapshot] = useState<string | null>(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [{ data: proj }, { data: cl }] = await Promise.all([
      supabase.from('projects').select('*, clients(business_name)').order('created_at', { ascending: false }),
      supabase.from('clients').select('id, business_name').eq('status', 'Active').order('business_name'),
    ]);
    setProjects(proj ?? []);
    setClients(cl ?? []);
    setLoading(false);
  }

  async function logActivity(action: string, name: string) {
    await supabase.from('activity_log').insert({ action, entity_type: 'Project', entity_name: name });
  }

  async function saveProject() {
    if (!form.project_name?.trim() || !clientId) return;
    setSaving(true);
    const now = new Date().toISOString();
    if (selected) {
      await supabase.from('projects').update({
        ...form, client_id: clientId, updated_at: now,
        due_date: form.due_date || null, start_date: form.start_date || null,
        delivery_date: form.delivery_date || null,
      }).eq('id', selected.id);
      await logActivity('Updated project', form.project_name!);
    } else {
      await supabase.from('projects').insert({
        ...form, client_id: clientId, created_at: now, updated_at: now,
        due_date: form.due_date || null, start_date: form.start_date || null,
        delivery_date: form.delivery_date || null,
      });
      await logActivity('Created project', form.project_name!);
    }
    setSaving(false);
    setModalOpen(false);
    setDetailOpen(false);
    setSelected(null);
    setForm(emptyProject());
    setClientId('');
    loadData();
  }

  async function updateChecklist(projectId: string, key: keyof DataChecklist, value: boolean) {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    const updated = { ...project.data_checklist, [key]: value };
    await supabase.from('projects').update({ data_checklist: updated }).eq('id', projectId);
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, data_checklist: updated } : p));
    if (selected?.id === projectId) setSelected(prev => prev ? { ...prev, data_checklist: updated } : prev);
  }

  async function deleteProject(id: string, name: string) {
    if (!confirm(`Delete project "${name}"?`)) return;
    await supabase.from('projects').delete().eq('id', id);
    await logActivity('Deleted project', name);
    setDetailOpen(false);
    loadData();
  }

  function openNew() {
    setSelected(null);
    setForm(emptyProject());
    setClientId(clients[0]?.id ?? '');
    setModalOpen(true);
  }

  function openEdit(project: Project) {
    setSelected(project);
    setForm({ ...project });
    setClientId(project.client_id);
    setModalOpen(true);
  }

  function openDetail(project: Project) {
    setSelected(project);
    setDetailOpen(true);
  }

  const set = (k: keyof Project, v: any) => setForm(f => ({ ...f, [k]: v }));

  const isOverdue = (p: Project) => !!p.due_date && new Date(p.due_date) < new Date() && p.status !== 'Completed';

  const checklistProgress = (checklist: DataChecklist) => {
    const vals = Object.values(checklist);
    return { done: vals.filter(Boolean).length, total: vals.length };
  };

  const activeProjects = projects.filter(p => p.status !== 'Completed');
  const blockedProjects = activeProjects.filter(p => !!p.waiting_on);
  const overdueProjects = activeProjects.filter(isOverdue);
  const qcProjects = activeProjects.filter(p => p.status === 'Analysis QC' || p.status === 'Final Product QC');

  const tabs: { key: DeliveryFilterKey; label: string; rows: Project[] }[] = [
    { key: 'all', label: 'All', rows: activeProjects },
    { key: 'blocked', label: 'Blocked', rows: blockedProjects },
    { key: 'overdue', label: 'Overdue', rows: overdueProjects },
    { key: 'qc', label: 'In QC', rows: qcProjects },
  ];

  const tabRows = tabs.find(t => t.key === filter)?.rows ?? activeProjects;
  const filtered = search
    ? tabRows.filter(p =>
        p.project_name.toLowerCase().includes(search.toLowerCase()) ||
        (p.clients?.business_name ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : tabRows;

  if (viewingSnapshot) {
    return <ProjectSnapshot projectId={viewingSnapshot} onBack={() => setViewingSnapshot(null)} />;
  }

  return (
    <>
      <TitleBand
        breadcrumb="Delivery / Projects"
        title="Delivery"
        stats={[
          { label: 'Active', value: activeProjects.length.toString() },
          { label: 'Blocked', value: blockedProjects.length.toString(), tone: blockedProjects.length > 0 ? 'crimson' : 'default' },
        ]}
        actionLabel="New project"
        onAction={openNew}
      />

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* Filter tabs */}
        <div className="flex-shrink-0 flex items-center gap-6 px-7 border-b border-ledger-hairline bg-white">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={`relative py-3 font-plexMono text-[10px] uppercase tracking-[0.12em] transition-colors ${
                filter === t.key ? 'text-ledger-navy' : 'text-ledger-muted hover:text-ledger-navy'
              }`}
            >
              {t.label} {t.rows.length}
              {filter === t.key && <span className="absolute left-0 right-0 -bottom-px h-[2px] bg-ledger-crimson" />}
            </button>
          ))}

          <div className="flex-1" />

          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search delivery…"
            className="w-44 bg-transparent font-plexSans text-[12px] text-ledger-navy placeholder-ledger-muted border-b border-transparent focus:border-ledger-navy focus:outline-none py-3"
          />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-48 text-ledger-muted font-plexMono text-xs uppercase tracking-widest">
              Loading…
            </div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-ledger-hairline">
                  {['Project', 'Service', 'Stage', 'Waiting on', 'Due', 'Data readiness', ''].map((h, i) => (
                    <th
                      key={h || i}
                      className={`px-4 py-2.5 font-plexMono text-[9px] uppercase tracking-[0.12em] text-ledger-muted font-medium ${
                        i === 4 ? 'text-right' : 'text-left'
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
                      No projects match this filter
                    </td>
                  </tr>
                ) : filtered.map((p, idx) => {
                  const stage = STAGE_DOT[p.status] ?? STAGE_DOT['Project Acceptance'];
                  const prog = checklistProgress(p.data_checklist);
                  const overdue = isOverdue(p);
                  return (
                    <tr
                      key={p.id}
                      onClick={() => openDetail(p)}
                      className={`cursor-pointer border-b border-ledger-hairline2 last:border-b-0 hover:bg-ledger-rowHover transition-colors ${
                        overdue
                          ? 'border-l-[3px] border-l-ledger-crimson bg-white'
                          : `border-l-[3px] border-l-transparent ${idx % 2 === 1 ? 'bg-ledger-zebra' : 'bg-white'}`
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-plexSans text-[13px] font-medium text-ledger-navy">{p.project_name}</div>
                        <div className="font-plexMono text-[9px] uppercase tracking-[0.08em] text-ledger-muted mt-0.5">
                          {(p as any).clients?.business_name ?? '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-plexSans text-[12px] text-ledger-mid max-w-[160px] truncate">{p.service_type ?? '—'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${stage.dot}`} />
                          <span className={`font-plexMono text-[10px] uppercase tracking-[0.08em] ${stage.text}`}>{p.status}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {p.waiting_on ? (
                          <span className="font-plexMono text-[10px] uppercase tracking-[0.06em] text-ledger-amber">{p.waiting_on}</span>
                        ) : (
                          <span className="font-plexMono text-[10px] text-ledger-faint">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-plexMono text-[11px] tabular-nums ${overdue ? 'font-semibold text-ledger-crimson' : 'text-ledger-faint'}`}>
                          {p.due_date ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex gap-[3px]">
                            {Array.from({ length: prog.total }).map((_, i) => (
                              <span
                                key={i}
                                className={`w-[7px] h-[7px] ${i < prog.done ? (prog.done === prog.total ? 'bg-ledger-green' : 'bg-ledger-navy') : 'bg-ledger-hairline2'}`}
                              />
                            ))}
                          </div>
                          <span className="font-plexMono text-[10px] text-ledger-muted whitespace-nowrap">{prog.done}/{prog.total}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <ArrowRight size={13} className="text-ledger-muted inline-block" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Project Detail Modal */}
      <Modal
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={selected?.project_name ?? ''}
        size="xl"
        footer={
          <>
            <button onClick={() => { setDetailOpen(false); selected && openEdit(selected); }} className="btn-secondary">Edit</button>
            <button 
              onClick={() => { setDetailOpen(false); selected && setViewingSnapshot(selected.id); }} 
              className="btn-primary"
            >
              View Snapshot Dashboard
            </button>
            {selected && <button onClick={() => deleteProject(selected.id, selected.project_name)} className="btn-danger">Delete</button>}
          </>
        }
      >
        {selected && (
          <div className="space-y-5">
            <div className="flex items-center gap-2 flex-wrap">
              {(() => { const b = getProjectStatusBadge(selected.status); return <Badge label={b.label} variant={b.variant} />; })()}
              {selected.waiting_on && (
                <span className="text-xs text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full">{selected.waiting_on}</span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {[
                { label: 'Client', value: (selected as any).clients?.business_name },
                { label: 'Service Type', value: selected.service_type },
                { label: 'Start Date', value: selected.start_date },
                { label: 'Due Date', value: selected.due_date },
                { label: 'Delivery Date', value: selected.delivery_date },
                { label: 'Invoice Status', value: selected.invoice_status },
                { label: 'Payment Status', value: selected.payment_status },
              ].map(({ label, value }) => value ? (
                <div key={label}>
                  <div className="form-label">{label}</div>
                  <div className="text-navy-700">{value}</div>
                </div>
              ) : null)}
            </div>
            {selected.project_summary && (
              <div>
                <div className="form-label">Project Summary</div>
                <div className="text-sm text-navy-700">{selected.project_summary}</div>
              </div>
            )}

            {/* Data Acquisition Checklist */}
            <div>
              <div className="form-label mb-2">Data Acquisition Checklist</div>
              <div className="grid grid-cols-1 gap-2">
                {Object.entries(CHECKLIST_LABELS).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={selected.data_checklist[key as keyof DataChecklist]}
                      onChange={e => updateChecklist(selected.id, key as keyof DataChecklist, e.target.checked)}
                      className="w-4 h-4 rounded border-surface-300 text-navy-800 focus:ring-navy-800/20"
                    />
                    <span className={`text-sm transition-colors ${
                      selected.data_checklist[key as keyof DataChecklist]
                        ? 'text-navy-400 line-through'
                        : 'text-navy-700 group-hover:text-navy-900'
                    }`}>{label}</span>
                    {selected.data_checklist[key as keyof DataChecklist] && (
                      <CheckSquare size={13} className="text-emerald-500" />
                    )}
                  </label>
                ))}
              </div>
            </div>

            {selected.internal_notes && (
              <div>
                <div className="form-label">Internal Notes</div>
                <div className="text-sm text-navy-700 whitespace-pre-wrap bg-surface-50 p-3 rounded-lg">{selected.internal_notes}</div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={selected ? 'Edit Project' : 'New Project'}
        size="xl"
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={saveProject} disabled={saving} className="btn-primary">
              {saving ? 'Saving...' : selected ? 'Save Changes' : 'Create Project'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="form-label">Project Name *</label>
              <input className="form-input" value={form.project_name ?? ''} onChange={e => set('project_name', e.target.value)} />
            </div>
            <div>
              <label className="form-label">Client *</label>
              <select className="form-select" value={clientId} onChange={e => setClientId(e.target.value)}>
                <option value="">Select client...</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.business_name}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Service Type</label>
              <select className="form-select" value={form.service_type ?? ''} onChange={e => set('service_type', e.target.value)}>
                <option value="">Select...</option>
                {SERVICE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Status</label>
              <select className="form-select" value={form.status} onChange={e => set('status', e.target.value)}>
                {PROJECT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Waiting On</label>
              <select className="form-select" value={form.waiting_on ?? ''} onChange={e => set('waiting_on', e.target.value || null)}>
                <option value="">None</option>
                {WAITING_ON.filter(Boolean).map(s => <option key={s!} value={s!}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Start Date</label>
              <input className="form-input" type="date" value={form.start_date ?? ''} onChange={e => set('start_date', e.target.value)} />
            </div>
            <div>
              <label className="form-label">Due Date</label>
              <input className="form-input" type="date" value={form.due_date ?? ''} onChange={e => set('due_date', e.target.value)} />
            </div>
            <div>
              <label className="form-label">Delivery Date</label>
              <input className="form-input" type="date" value={form.delivery_date ?? ''} onChange={e => set('delivery_date', e.target.value)} />
            </div>
            <div>
              <label className="form-label">Invoice Status</label>
              <select className="form-select" value={form.invoice_status ?? 'Not Invoiced'} onChange={e => set('invoice_status', e.target.value)}>
                {['Not Invoiced', 'Invoice Sent', 'Partially Paid', 'Fully Paid'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Payment Status</label>
              <select className="form-select" value={form.payment_status ?? 'Unpaid'} onChange={e => set('payment_status', e.target.value)}>
                {['Unpaid', 'Deposit Received', 'Paid in Full', 'Overdue'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="form-label">Project Summary</label>
              <textarea className="form-input resize-none" rows={2} value={form.project_summary ?? ''} onChange={e => set('project_summary', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="form-label">Internal Notes</label>
              <textarea className="form-input resize-none" rows={3} value={form.internal_notes ?? ''} onChange={e => set('internal_notes', e.target.value)} />
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
