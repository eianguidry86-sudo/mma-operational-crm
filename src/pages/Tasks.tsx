import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Task, TaskPriority, TaskStatus, TaskType, Client, Project } from '../types';
import TitleBand from '../components/ledger/TitleBand';
import Modal from '../components/ui/Modal';
import { CheckSquare, Circle } from 'lucide-react';

const PRIORITIES: TaskPriority[] = ['Critical', 'High', 'Medium', 'Low'];
const STATUSES: TaskStatus[] = ['Open', 'In Progress', 'Completed', 'Cancelled'];
const TASK_TYPES: TaskType[] = ['Lead', 'Client', 'Project', 'Billing', 'Internal Operations'];

const emptyTask = (): Partial<Task> => ({
  title: '', description: '', priority: 'Medium', due_date: '',
  status: 'Open', assigned_to: '', task_type: 'Internal Operations',
  lead_id: null, client_id: null, project_id: null,
});

const priorityOrder: Record<TaskPriority, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };

const PRIORITY_STYLE: Record<TaskPriority, { dot: string; text: string }> = {
  Critical: { dot: 'bg-ledger-crimson', text: 'text-ledger-crimson' },
  High: { dot: 'bg-ledger-amber', text: 'text-ledger-amber' },
  Medium: { dot: 'bg-ledger-blue', text: 'text-ledger-blue' },
  Low: { dot: 'bg-ledger-gray', text: 'text-ledger-gray' },
};

type TaskFilterKey = 'open' | 'overdue' | 'today' | 'completed';

export default function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<TaskFilterKey>('open');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [selected, setSelected] = useState<Task | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<Partial<Task>>(emptyTask());
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [{ data: t }, { data: c }, { data: p }] = await Promise.all([
      supabase.from('tasks').select('*, clients(business_name), projects(project_name), leads(business_name)').order('due_date', { ascending: true, nullsFirst: false }),
      supabase.from('clients').select('id, business_name').order('business_name'),
      supabase.from('projects').select('id, project_name').not('status', 'eq', 'Completed').order('project_name'),
    ]);
    setTasks(t ?? []);
    setClients(c ?? []);
    setProjects(p ?? []);
    setLoading(false);
  }

  async function logActivity(action: string, name: string) {
    await supabase.from('activity_log').insert({ action, entity_type: 'Task', entity_name: name });
  }

  async function saveTask() {
    if (!form.title?.trim()) return;
    setSaving(true);
    const now = new Date().toISOString();
    const payload = {
      ...form,
      due_date: form.due_date || null,
      client_id: form.client_id || null,
      project_id: form.project_id || null,
      lead_id: form.lead_id || null,
    };
    if (selected) {
      await supabase.from('tasks').update({ ...payload, updated_at: now }).eq('id', selected.id);
      await logActivity('Updated task', form.title!);
    } else {
      await supabase.from('tasks').insert({ ...payload, created_at: now, updated_at: now });
      await logActivity('Created task', form.title!);
    }
    setSaving(false);
    setModalOpen(false);
    setSelected(null);
    setForm(emptyTask());
    loadData();
  }

  async function toggleStatus(task: Task) {
    const newStatus: TaskStatus = task.status === 'Completed' ? 'Open' : task.status === 'Open' ? 'In Progress' : 'Completed';
    await supabase.from('tasks').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', task.id);
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
  }

  async function deleteTask(id: string, title: string) {
    if (!confirm(`Delete task "${title}"?`)) return;
    await supabase.from('tasks').delete().eq('id', id);
    await logActivity('Deleted task', title);
    loadData();
  }

  function openEdit(task: Task) {
    setSelected(task);
    setForm({ ...task });
    setModalOpen(true);
  }

  function openNew() {
    setSelected(null);
    setForm(emptyTask());
    setModalOpen(true);
  }

  const set = (k: keyof Task, v: any) => setForm(f => ({ ...f, [k]: v }));

  const today = new Date().toISOString().split('T')[0];
  const isOverdue = (t: Task) => !!t.due_date && t.due_date < today && !['Completed', 'Cancelled'].includes(t.status);
  const isDueToday = (t: Task) => t.due_date === today && !['Completed', 'Cancelled'].includes(t.status);

  const openTasks = tasks.filter(t => ['Open', 'In Progress'].includes(t.status));
  const overdueTasks = tasks.filter(isOverdue);
  const dueTodayTasks = tasks.filter(isDueToday);
  const completedTasks = tasks.filter(t => t.status === 'Completed');

  const tabs: { key: TaskFilterKey; label: string; rows: Task[] }[] = [
    { key: 'open', label: 'Open', rows: openTasks },
    { key: 'overdue', label: 'Overdue', rows: overdueTasks },
    { key: 'today', label: 'Due today', rows: dueTodayTasks },
    { key: 'completed', label: 'Completed', rows: completedTasks },
  ];

  const tabRows = tabs.find(t => t.key === filter)?.rows ?? openTasks;
  const filtered = tabRows
    .filter(t => {
      const matchSearch = !search || t.title.toLowerCase().includes(search.toLowerCase());
      const matchPriority = priorityFilter === 'all' || t.priority === priorityFilter;
      return matchSearch && matchPriority;
    })
    .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  const statusIcon = (status: TaskStatus) => {
    if (status === 'Completed') return <CheckSquare size={15} className="text-ledger-green" />;
    if (status === 'In Progress') return <Circle size={15} className="text-ledger-blue fill-ledger-blue/15" />;
    return <Circle size={15} className="text-ledger-muted" />;
  };

  return (
    <>
      <TitleBand
        breadcrumb="Workspace / Tasks"
        title="Tasks"
        stats={[
          { label: 'Open', value: openTasks.length.toString() },
          { label: 'Overdue', value: overdueTasks.length.toString(), tone: overdueTasks.length > 0 ? 'crimson' : 'default' },
        ]}
        actionLabel="Add task"
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

          <select
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value)}
            className="bg-transparent font-plexMono text-[9px] uppercase tracking-[0.1em] text-ledger-faint focus:outline-none py-3 mr-4"
          >
            <option value="all">All priority</option>
            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>

          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search tasks…"
            className="w-40 bg-transparent font-plexSans text-[12px] text-ledger-navy placeholder-ledger-muted border-b border-transparent focus:border-ledger-navy focus:outline-none py-3"
          />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-48 text-ledger-muted font-plexMono text-xs uppercase tracking-widest">
              Loading…
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 font-plexMono text-[10px] uppercase tracking-[0.14em] text-ledger-muted">
              No tasks match this filter
            </div>
          ) : (
            filtered.map((task, idx) => {
              const pr = PRIORITY_STYLE[task.priority];
              const overdue = isOverdue(task);
              const dueToday = isDueToday(task);
              const context = [
                (task as any).clients?.business_name,
                (task as any).projects?.project_name,
              ].filter(Boolean).join(' · ');
              return (
                <div
                  key={task.id}
                  className={`flex items-center gap-3 px-7 py-3 border-b border-ledger-hairline2 last:border-b-0 hover:bg-ledger-rowHover transition-colors ${
                    overdue ? 'border-l-[3px] border-l-ledger-crimson bg-white' :
                    `border-l-[3px] border-l-transparent ${idx % 2 === 1 ? 'bg-ledger-zebra' : 'bg-white'}`
                  } ${task.status === 'Completed' ? 'opacity-60' : ''}`}
                >
                  <button onClick={() => toggleStatus(task)} className="flex-shrink-0">
                    {statusIcon(task.status)}
                  </button>

                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openEdit(task)}>
                    <div className={`font-plexSans text-[13px] font-medium text-ledger-navy ${task.status === 'Completed' ? 'line-through' : ''}`}>
                      {task.title}
                    </div>
                    <div className="font-plexMono text-[9px] uppercase tracking-[0.08em] text-ledger-muted mt-0.5">
                      {[context, task.task_type].filter(Boolean).join(' · ')}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 flex-shrink-0">
                    <span className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${pr.dot}`} />
                      <span className={`font-plexMono text-[9px] uppercase tracking-[0.08em] ${pr.text}`}>{task.priority}</span>
                    </span>
                    {task.due_date && (
                      <span className={`font-plexMono text-[10px] uppercase tracking-[0.06em] ${
                        overdue ? 'text-ledger-crimson font-medium' : dueToday ? 'text-ledger-amber font-medium' : 'text-ledger-faint'
                      }`}>
                        {overdue ? 'Overdue' : dueToday ? 'Today' : task.due_date}
                      </span>
                    )}
                    <button
                      onClick={() => deleteTask(task.id, task.title)}
                      className="text-ledger-muted hover:text-ledger-crimson transition-colors font-plexMono text-[13px] leading-none"
                    >
                      ×
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={selected ? 'Edit Task' : 'New Task'}
        size="md"
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={saveTask} disabled={saving} className="btn-primary">
              {saving ? 'Saving...' : selected ? 'Save Changes' : 'Create Task'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="form-label">Title *</label>
            <input className="form-input" value={form.title ?? ''} onChange={e => set('title', e.target.value)} />
          </div>
          <div>
            <label className="form-label">Description</label>
            <textarea className="form-input resize-none" rows={2} value={form.description ?? ''} onChange={e => set('description', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Priority</label>
              <select className="form-select" value={form.priority} onChange={e => set('priority', e.target.value)}>
                {PRIORITIES.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Status</label>
              <select className="form-select" value={form.status} onChange={e => set('status', e.target.value)}>
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Due Date</label>
              <input className="form-input" type="date" value={form.due_date ?? ''} onChange={e => set('due_date', e.target.value)} />
            </div>
            <div>
              <label className="form-label">Task Type</label>
              <select className="form-select" value={form.task_type} onChange={e => set('task_type', e.target.value)}>
                {TASK_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Client</label>
              <select className="form-select" value={form.client_id ?? ''} onChange={e => set('client_id', e.target.value || null)}>
                <option value="">None</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.business_name}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Project</label>
              <select className="form-select" value={form.project_id ?? ''} onChange={e => set('project_id', e.target.value || null)}>
                <option value="">None</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="form-label">Assigned To</label>
              <input className="form-input" value={form.assigned_to ?? ''} onChange={e => set('assigned_to', e.target.value)} />
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
