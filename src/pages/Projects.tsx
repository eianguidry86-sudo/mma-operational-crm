import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Project, Client, ProjectStatus, WaitingOn, DataChecklist } from '../types';
import Header from '../components/layout/Header';
import Modal from '../components/ui/Modal';
import Badge, { getProjectStatusBadge } from '../components/ui/Badge';
import { Plus, Search, Filter, CheckSquare, Calendar, AlertCircle } from 'lucide-react';
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

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
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

  const filtered = projects.filter(p => {
    const matchSearch = !search ||
      p.project_name.toLowerCase().includes(search.toLowerCase()) ||
      (p.clients?.business_name ?? '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const isOverdue = (p: Project) => p.due_date && new Date(p.due_date) < new Date() && p.status !== 'Completed';

  const checklistProgress = (checklist: DataChecklist) => {
    const vals = Object.values(checklist);
    return { done: vals.filter(Boolean).length, total: vals.length };
  };

  if (viewingSnapshot) {
    return <ProjectSnapshot projectId={viewingSnapshot} onBack={() => setViewingSnapshot(null)} />;
  }

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="Projects"
        subtitle={`${projects.filter(p => p.status !== 'Completed').length} active`}
        actions={
          <button onClick={openNew} className="btn-primary py-1.5 px-3 text-xs">
            <Plus size={14} /> New Project
          </button>
        }
      />

      <div className="flex-1 p-6 flex flex-col gap-4 overflow-y-auto">
        <div className="flex items-center gap-3">
          <div className="relative max-w-xs flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400" />
            <input className="form-input pl-9 py-1.5 text-xs" placeholder="Search projects..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={13} className="text-navy-400" />
            <select className="form-select py-1.5 text-xs w-52" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="all">All Statuses</option>
              {PROJECT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-navy-400 text-sm">Loading projects...</div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">Project</th>
                  <th className="table-header">Client</th>
                  <th className="table-header">Service</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Waiting On</th>
                  <th className="table-header">Due Date</th>
                  <th className="table-header">Data</th>
                  <th className="table-header w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} className="table-cell text-center text-navy-400 py-12">No projects found</td></tr>
                ) : filtered.map(p => {
                  const badge = getProjectStatusBadge(p.status);
                  const prog = checklistProgress(p.data_checklist);
                  const overdue = isOverdue(p);
                  return (
                    <tr key={p.id} className="hover:bg-surface-50 transition-colors cursor-pointer" onClick={() => openDetail(p)}>
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          {overdue && <AlertCircle size={13} className="text-crimson-500 flex-shrink-0" />}
                          <div className="font-medium text-navy-800">{p.project_name}</div>
                        </div>
                      </td>
                      <td className="table-cell text-navy-500 text-xs">{(p as any).clients?.business_name ?? '—'}</td>
                      <td className="table-cell text-navy-500 text-xs max-w-32 truncate">{p.service_type ?? '—'}</td>
                      <td className="table-cell"><Badge label={badge.label} variant={badge.variant} /></td>
                      <td className="table-cell">
                        {p.waiting_on ? (
                          <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">{p.waiting_on}</span>
                        ) : '—'}
                      </td>
                      <td className={`table-cell text-xs ${overdue ? 'text-crimson-600 font-semibold' : 'text-navy-500'}`}>
                        {p.due_date ?? '—'}
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-1.5">
                          <div className="w-16 h-1.5 bg-surface-200 rounded-full overflow-hidden">
                            <div className="h-full bg-navy-600 rounded-full" style={{ width: `${(prog.done / prog.total) * 100}%` }} />
                          </div>
                          <span className="text-2xs text-navy-400">{prog.done}/{prog.total}</span>
                        </div>
                      </td>
                      <td className="table-cell">
                        <button
                          onClick={e => { e.stopPropagation(); openEdit(p); }}
                          className="text-navy-400 hover:text-navy-700 transition-colors text-xs px-2 py-1 rounded hover:bg-surface-100"
                        >
                          Edit
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
    </div>
  );
}
