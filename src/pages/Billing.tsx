import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Invoice, InvoiceStatus, Client, Project } from '../types';
import Header from '../components/layout/Header';
import Modal from '../components/ui/Modal';
import Badge, { getInvoiceStatusBadge } from '../components/ui/Badge';
import { Plus, Search, Filter, DollarSign, TrendingUp, AlertCircle, Clock } from 'lucide-react';

const INVOICE_STATUSES: InvoiceStatus[] = ['Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled'];

const emptyInvoice = (): Partial<Invoice> => ({
  invoice_number: '', amount: 0, due_date: '', status: 'Draft',
  payment_date: '', deposit_required: false, deposit_amount: undefined,
  deposit_received: false, notes: '',
});

export default function Billing() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<Partial<Invoice>>(emptyInvoice());
  const [clientId, setClientId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [{ data: inv }, { data: c }, { data: p }] = await Promise.all([
      supabase.from('invoices').select('*, clients(business_name), projects(project_name)').order('created_at', { ascending: false }),
      supabase.from('clients').select('id, business_name').order('business_name'),
      supabase.from('projects').select('id, project_name, client_id').order('project_name'),
    ]);
    setInvoices(inv ?? []);
    setClients(c ?? []);
    setProjects(p ?? []);
    setLoading(false);
  }

  async function logActivity(action: string, name: string) {
    await supabase.from('activity_log').insert({ action, entity_type: 'Invoice', entity_name: name });
  }

  function generateInvoiceNumber() {
    const now = new Date();
    return `INV-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(Math.floor(Math.random() * 900) + 100)}`;
  }

  async function saveInvoice() {
    if (!form.amount || !clientId) return;
    setSaving(true);
    const now = new Date().toISOString();
    const payload = {
      ...form,
      client_id: clientId,
      project_id: projectId || null,
      invoice_number: form.invoice_number || generateInvoiceNumber(),
      due_date: form.due_date || null,
      payment_date: form.payment_date || null,
      deposit_amount: form.deposit_required ? form.deposit_amount : null,
    };
    if (selected) {
      await supabase.from('invoices').update({ ...payload, updated_at: now }).eq('id', selected.id);
      await logActivity('Updated invoice', payload.invoice_number!);
    } else {
      await supabase.from('invoices').insert({ ...payload, created_at: now, updated_at: now });
      await logActivity('Created invoice', payload.invoice_number!);
    }
    setSaving(false);
    setModalOpen(false);
    setSelected(null);
    setForm(emptyInvoice());
    setClientId('');
    setProjectId('');
    loadData();
  }

  async function updateStatus(id: string, status: InvoiceStatus) {
    const updates: Partial<Invoice> = { status, updated_at: new Date().toISOString() } as any;
    if (status === 'Paid') updates.payment_date = new Date().toISOString().split('T')[0];
    await supabase.from('invoices').update(updates).eq('id', id);
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i));
  }

  async function deleteInvoice(id: string, num: string) {
    if (!confirm(`Delete invoice ${num}?`)) return;
    await supabase.from('invoices').delete().eq('id', id);
    await logActivity('Deleted invoice', num);
    loadData();
  }

  function openEdit(inv: Invoice) {
    setSelected(inv);
    setForm({ ...inv });
    setClientId(inv.client_id);
    setProjectId(inv.project_id ?? '');
    setModalOpen(true);
  }

  function openNew() {
    setSelected(null);
    setForm({ ...emptyInvoice(), invoice_number: generateInvoiceNumber() });
    setClientId('');
    setProjectId('');
    setModalOpen(true);
  }

  const set = (k: keyof Invoice, v: any) => setForm(f => ({ ...f, [k]: v }));

  const filtered = invoices.filter(i => {
    const matchSearch = !search || i.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
      ((i as any).clients?.business_name ?? '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || i.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const today = new Date().toISOString().split('T')[0];
  const totalOutstanding = invoices.filter(i => ['Sent', 'Overdue'].includes(i.status)).reduce((s, i) => s + i.amount, 0);
  const totalPaidThisMonth = invoices.filter(i => {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    return i.status === 'Paid' && i.payment_date && i.payment_date >= monthStart;
  }).reduce((s, i) => s + i.amount, 0);
  const overdueCount = invoices.filter(i => i.status === 'Overdue' || (i.status === 'Sent' && i.due_date && i.due_date < today)).length;

  const filteredProjects = projects.filter(p => !clientId || p.client_id === clientId);

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="Billing"
        subtitle={`${invoices.length} invoices`}
        actions={
          <button onClick={openNew} className="btn-primary py-1.5 px-3 text-xs">
            <Plus size={14} /> New Invoice
          </button>
        }
      />

      <div className="flex-1 p-6 flex flex-col gap-5 overflow-y-auto">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={15} className="text-emerald-600" />
              <span className="text-xs font-semibold text-navy-500">Revenue This Month</span>
            </div>
            <div className="text-2xl font-bold text-emerald-700">${totalPaidThisMonth.toLocaleString()}</div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock size={15} className="text-amber-600" />
              <span className="text-xs font-semibold text-navy-500">Outstanding</span>
            </div>
            <div className="text-2xl font-bold text-amber-700">${totalOutstanding.toLocaleString()}</div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle size={15} className="text-crimson-600" />
              <span className="text-xs font-semibold text-navy-500">Overdue</span>
            </div>
            <div className="text-2xl font-bold text-crimson-600">{overdueCount} invoices</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="relative max-w-xs flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400" />
            <input className="form-input pl-9 py-1.5 text-xs" placeholder="Search invoices..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={13} className="text-navy-400" />
            <select className="form-select py-1.5 text-xs w-36" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="all">All Statuses</option>
              {INVOICE_STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-navy-400 text-sm">Loading invoices...</div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">Invoice #</th>
                  <th className="table-header">Client</th>
                  <th className="table-header">Project</th>
                  <th className="table-header">Amount</th>
                  <th className="table-header">Due Date</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} className="table-cell text-center text-navy-400 py-12">No invoices found</td></tr>
                ) : filtered.map(inv => {
                  const badge = getInvoiceStatusBadge(inv.status);
                  const isOverdue = inv.due_date && inv.due_date < today && inv.status === 'Sent';
                  return (
                    <tr key={inv.id} className="hover:bg-surface-50 transition-colors">
                      <td className="table-cell font-mono text-xs text-navy-700">{inv.invoice_number}</td>
                      <td className="table-cell font-medium text-navy-800">{(inv as any).clients?.business_name ?? '—'}</td>
                      <td className="table-cell text-xs text-navy-500">{(inv as any).projects?.project_name ?? '—'}</td>
                      <td className="table-cell">
                        <span className="font-bold text-navy-900">${inv.amount.toLocaleString()}</span>
                        {inv.deposit_required && (
                          <span className={`ml-1 text-2xs px-1.5 py-0.5 rounded-full ${inv.deposit_received ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                            {inv.deposit_received ? 'Deposit ✓' : `Deposit $${inv.deposit_amount}`}
                          </span>
                        )}
                      </td>
                      <td className={`table-cell text-xs ${isOverdue ? 'text-crimson-600 font-semibold' : 'text-navy-500'}`}>
                        {inv.due_date ?? '—'}
                        {isOverdue && ' (Overdue)'}
                      </td>
                      <td className="table-cell">
                        <select
                          className="text-xs border border-surface-200 rounded-lg px-2 py-1 bg-white text-navy-700 focus:outline-none focus:ring-1 focus:ring-navy-800/20"
                          value={inv.status}
                          onChange={e => updateStatus(inv.id, e.target.value as InvoiceStatus)}
                        >
                          {INVOICE_STATUSES.map(s => <option key={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          <button onClick={() => openEdit(inv)} className="text-xs text-navy-500 hover:text-navy-800 transition-colors">Edit</button>
                          <button onClick={() => deleteInvoice(inv.id, inv.invoice_number)} className="text-xs text-crimson-500 hover:text-crimson-700 transition-colors">Delete</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={selected ? `Edit Invoice ${selected.invoice_number}` : 'New Invoice'}
        size="lg"
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={saveInvoice} disabled={saving} className="btn-primary">
              {saving ? 'Saving...' : selected ? 'Save Changes' : 'Create Invoice'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Invoice Number</label>
              <input className="form-input font-mono" value={form.invoice_number ?? ''} onChange={e => set('invoice_number', e.target.value)} />
            </div>
            <div>
              <label className="form-label">Status</label>
              <select className="form-select" value={form.status} onChange={e => set('status', e.target.value)}>
                {INVOICE_STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Client *</label>
              <select className="form-select" value={clientId} onChange={e => { setClientId(e.target.value); setProjectId(''); }}>
                <option value="">Select client...</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.business_name}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Project</label>
              <select className="form-select" value={projectId} onChange={e => setProjectId(e.target.value)}>
                <option value="">None</option>
                {filteredProjects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Amount ($) *</label>
              <input className="form-input" type="number" step="0.01" value={form.amount ?? ''} onChange={e => set('amount', parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <label className="form-label">Due Date</label>
              <input className="form-input" type="date" value={form.due_date ?? ''} onChange={e => set('due_date', e.target.value)} />
            </div>
            <div>
              <label className="form-label">Payment Date</label>
              <input className="form-input" type="date" value={form.payment_date ?? ''} onChange={e => set('payment_date', e.target.value)} />
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input type="checkbox" id="deposit" checked={form.deposit_required ?? false} onChange={e => set('deposit_required', e.target.checked)} className="w-4 h-4 rounded" />
              <label htmlFor="deposit" className="text-sm text-navy-700">Deposit Required</label>
            </div>
            {form.deposit_required && (
              <>
                <div>
                  <label className="form-label">Deposit Amount ($)</label>
                  <input className="form-input" type="number" step="0.01" value={form.deposit_amount ?? ''} onChange={e => set('deposit_amount', parseFloat(e.target.value) || null)} />
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <input type="checkbox" id="dep-recv" checked={form.deposit_received ?? false} onChange={e => set('deposit_received', e.target.checked)} className="w-4 h-4 rounded" />
                  <label htmlFor="dep-recv" className="text-sm text-navy-700">Deposit Received</label>
                </div>
              </>
            )}
            <div className="col-span-2">
              <label className="form-label">Notes</label>
              <textarea className="form-input resize-none" rows={2} value={form.notes ?? ''} onChange={e => set('notes', e.target.value)} />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
