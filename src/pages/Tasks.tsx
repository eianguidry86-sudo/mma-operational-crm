import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Task, TaskPriority, TaskStatus, TaskType, Client, Project } from '../types';
import Header from '../components/layout/Header';
import Modal from '../components/ui/Modal';
import Badge, { getTaskPriorityBadge } from '../components/ui/Badge';
import { Plus, Search, Filter, CheckSquare, Circle } from 'lucide-react';

const PRIORITIES: TaskPriority[] = ['Critical', 'High', 'Medium', 'Low'];
const STATUSES: TaskStatus[] = ['Open', 'In Progress', 'Completed', 'Cancelled'];
const TASK_TYPES: TaskType[] = ['Lead', 'Client', 'Project', 'Billing', 'Internal Operations'];

const emptyTask = (): Partial<Task> => ({
  title: '', description: '', priority: 'Medium', due_date: '',
  status: 'Open', assigned_to: '', task_type: 'Internal Operations',
  lead_id: null, client_id: null, project_id: null,
});

const priorityOrder: Record<TaskPriority, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };

export default function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('open');
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

  const filtered = tasks
    .filter(t => {
      const matchSearch = !search || t.title.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' ? true : statusFilter === 'open' ? ['Open', 'In Progress'].includes(t.status) : t.status === statusFilter;
      const matchPriority = priorityFilter === 'all' || t.priority === priorityFilter;
      return matchSearch && matchStatus && matchPriority;
    })
    .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  const today = new Date().toISOString().split('T')[0];
  const isOverdue = (t: Task) => t.due_date && t.due_date < today && !['Completed', 'Cancelled'].includes(t.status);
  const isDueToday = (t: Task) => t.due_date === today && !['Completed', 'Cancelled'].includes(t.status);

  const statusIcon = (status: TaskStatus) => {
    if (status === 'Completed') return <CheckSquare size={16} className="text-emerald-500" />;
    if (status === 'In Progress') return <Circle size={16} className="text-blue-500 fill-blue-100" />;
    return <Circle size={16} className="text-surface-400" />;
  };

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="Tasks"
        subtitle={`${tasks.filter(t => ['Open', 'In Progress'].includes(t.status)).length} open`}
        actions={
          <button onClick={openNew} className="btn-primary py-1.5 px-3 text-xs">
            <Plus size={14} /> Add Task
          </button>
        }
      />

      <div className="flex-1 p-6 flex flex-col gap-4 overflow-y-auto">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative max-w-xs flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400" />
            <input className="form-input pl-9 py-1.5 text-xs" placeholder="Search tasks..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={13} className="text-navy-400" />
            <select className="form-select py-1.5 text-xs w-36" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="open">Open</option>
              <option value="all">All</option>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className="form-select py-1.5 text-xs w-32" value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
              <option value="all">All Priority</option>
              {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-navy-400 text-sm">Loading tasks...</div>
        ) : (
          <div className="card divide-y divide-surface-100 overflow-hidden">
            {filtered.length === 0 ? (
              <div className="text-center py-12 text-navy-400 text-sm">No tasks found</div>
            ) : filtered.map(task => {
              const badge = getTaskPriorityBadge(task.priority);
              const overdue = isOverdue(task);
              const dueToday = isDueToday(task);
              return (
                <div
                  key={task.id}
                  className={`flex items-center gap-3 px-5 py-3 hover:bg-surface-50 transition-colors ${
                    task.status === 'Completed' ? 'opacity-60' : ''
                  }`}
                >
                  <button onClick={() => toggleStatus(task)} className="flex-shrink-0 hover:scale-110 transition-transform">
                    {statusIcon(task.status)}
                  </button>
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openEdit(task)}>
                    <div className={`text-sm font-medium text-navy-800 ${task.status === 'Completed' ? 'line-through' : ''}`}>
                      {task.title}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {task.clients && <span className="text-2xs text-navy-400">{(task as any).clients?.business_name}</span>}
                      {task.projects && <span className="text-2xs text-navy-400">• {(task as any).projects?.project_name}</span>}
                      <span className="text-2xs text-surface-400 bg-surface-100 px-1.5 py-0.5 rounded">{task.task_type}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge label={badge.label} variant={badge.variant} size="xs" />
                    {task.due_date && (
                      <span className={`text-2xs px-2 py-0.5 rounded-full font-medium ${
                        overdue ? 'bg-crimson-100 text-crimson-700' :
                        dueToday ? 'bg-amber-100 text-amber-700' :
                        'bg-surface-100 text-navy-500'
                      }`}>
                        {overdue ? 'Overdue' : dueToday ? 'Today' : task.due_date}
                      </span>
                    )}
                    <button
                      onClick={() => deleteTask(task.id, task.title)}
                      className="text-surface-400 hover:text-crimson-500 transition-colors text-xs"
                    >
                      ×
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
    </div>
  );
}
