import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Invoice, InvoiceStatus, Client, Project } from '../types';
import TitleBand from '../components/ledger/TitleBand';
import Modal from '../components/ui/Modal';

const INVOICE_STATUSES: InvoiceStatus[] = ['Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled'];

const emptyInvoice = (): Partial<Invoice> => ({
  invoice_number: '', amount: 0, due_date: '', status: 'Draft',
  payment_date: '', deposit_required: false, deposit_amount: undefined,
  deposit_received: false, notes: '',
});

const STATUS_DOT: Record<InvoiceStatus, { dot: string; text: string }> = {
  Draft: { dot: 'bg-ledger-gray', text: 'text-ledger-gray' },
  Sent: { dot: 'bg-ledger-blue', text: 'text-ledger-blue' },
  Paid: { dot: 'bg-ledger-green', text: 'text-ledger-green' },
  Overdue: { dot: 'bg-ledger-crimson', text: 'text-ledger-crimson' },
  Cancelled: { dot: 'bg-ledger-gray', text: 'text-ledger-gray' },
};

type BillingFilterKey = 'all' | 'outstanding' | 'overdue' | 'paid';

export default function Billing() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<BillingFilterKey>('all');
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

  const today = new Date().toISOString().split('T')[0];
  const isInvoiceOverdue = (i: Invoice) => i.status === 'Overdue' || (i.status === 'Sent' && !!i.due_date && i.due_date < today);

  const totalOutstanding = invoices.filter(i => ['Sent', 'Overdue'].includes(i.status)).reduce((s, i) => s + i.amount, 0);
  const totalPaidThisMonth = invoices.filter(i => {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    return i.status === 'Paid' && i.payment_date && i.payment_date >= monthStart;
  }).reduce((s, i) => s + i.amount, 0);

  const outstandingInvoices = invoices.filter(i => ['Sent', 'Overdue'].includes(i.status));
  const overdueInvoices = invoices.filter(isInvoiceOverdue);
  const paidInvoices = invoices.filter(i => i.status === 'Paid');

  const tabs: { key: BillingFilterKey; label: string; rows: Invoice[] }[] = [
    { key: 'all', label: 'All', rows: invoices },
    { key: 'outstanding', label: 'Outstanding', rows: outstandingInvoices },
    { key: 'overdue', label: 'Overdue', rows: overdueInvoices },
    { key: 'paid', label: 'Paid', rows: paidInvoices },
  ];
  const activeRows = tabs.find(t => t.key === filter)?.rows ?? invoices;

  const filtered = activeRows.filter(i => {
    if (!search) return true;
    const s = search.toLowerCase();
    return i.invoice_number.toLowerCase().includes(s) ||
      ((i as any).clients?.business_name ?? '').toLowerCase().includes(s);
  });

  const filteredProjects = projects.filter(p => !clientId || p.client_id === clientId);

  return (
    <>
      <TitleBand
        breadcrumb="Workspace / Billing"
        title="Billing"
        stats={[
          { label: 'Revenue MTD', value: `$${totalPaidThisMonth.toLocaleString()}` },
          { label: 'Outstanding', value: `$${totalOutstanding.toLocaleString()}`, tone: totalOutstanding > 0 ? 'crimson' : undefined },
        ]}
        actionLabel="New invoice"
        onAction={openNew}
      />

      <div className="flex-1 flex flex-col gap-4 px-8 py-6 overflow-y-auto">
        {/* Filter tabs */}
        <div className="flex items-center justify-between border-b border-ledger-hairline">
          <div className="flex items-center gap-6">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setFilter(t.key)}
                className={`relative pb-2.5 pt-1 font-plexMono text-[11px] uppercase tracking-wider transition-colors ${
                  filter === t.key ? 'text-ledger-navy' : 'text-ledger-soft hover:text-ledger-mid'
                }`}
              >
                {t.label} <span className="tabular-nums text-ledger-faint">({t.rows.length})</span>
                {filter === t.key && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-ledger-crimson" />}
              </button>
            ))}
          </div>
          <input
            className="w-56 bg-transparent border-b border-ledger-hairline py-1.5 font-plexSans text-xs text-ledger-body placeholder:text-ledger-faint focus:outline-none focus:border-ledger-navy"
            placeholder="Search invoices…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-ledger-soft font-plexSans text-sm">Loading invoices…</div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-ledger-hairline">
                <th className="py-2 pr-3 text-left font-plexMono text-[10px] uppercase tracking-wider text-ledger-soft">Invoice #</th>
                <th className="py-2 pr-3 text-left font-plexMono text-[10px] uppercase tracking-wider text-ledger-soft">Client</th>
                <th className="py-2 pr-3 text-left font-plexMono text-[10px] uppercase tracking-wider text-ledger-soft">Project</th>
                <th className="py-2 pr-3 text-right font-plexMono text-[10px] uppercase tracking-wider text-ledger-soft">Amount</th>
                <th className="py-2 pr-3 text-left font-plexMono text-[10px] uppercase tracking-wider text-ledger-soft">Due</th>
                <th className="py-2 pr-3 text-left font-plexMono text-[10px] uppercase tracking-wider text-ledger-soft">Status</th>
                <th className="py-2 pl-3 text-right font-plexMono text-[10px] uppercase tracking-wider text-ledger-soft">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="py-14 text-center font-plexSans text-sm text-ledger-faint">No invoices found</td></tr>
              ) : filtered.map((inv, i) => {
                const overdue = isInvoiceOverdue(inv);
                const dot = STATUS_DOT[inv.status];
                return (
                  <tr
                    key={inv.id}
                    className={`border-b border-ledger-hairline2 transition-colors hover:bg-ledger-rowHover ${
                      i % 2 === 1 ? 'bg-ledger-zebra' : ''
                    } ${overdue ? 'border-l-[3px] border-l-ledger-crimson' : 'border-l-[3px] border-l-transparent'}`}
                  >
                    <td className="py-3 pr-3 font-plexMono text-xs text-ledger-body">{inv.invoice_number}</td>
                    <td className="py-3 pr-3 font-plexSans text-sm text-ledger-body">{(inv as any).clients?.business_name ?? '—'}</td>
                    <td className="py-3 pr-3 font-plexSans text-xs text-ledger-mid">{(inv as any).projects?.project_name ?? '—'}</td>
                    <td className="py-3 pr-3 text-right">
                      <span className="font-plexMono text-sm font-medium text-ledger-body tabular-nums">${inv.amount.toLocaleString()}</span>
                      {inv.deposit_required && (
                        <div className={`mt-0.5 font-plexMono text-[10px] uppercase tracking-wide ${inv.deposit_received ? 'text-ledger-green' : 'text-ledger-amber'}`}>
                          {inv.deposit_received ? 'Deposit received' : `Deposit $${inv.deposit_amount}`}
                        </div>
                      )}
                    </td>
                    <td className={`py-3 pr-3 font-plexSans text-xs ${overdue ? 'font-semibold text-ledger-crimson' : 'text-ledger-mid'}`}>
                      {inv.due_date ?? '—'}
                      {overdue && ' · Overdue'}
                    </td>
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-2">
                        <span className={`h-1.5 w-1.5 rounded-full ${dot.dot}`} />
                        <select
                          className={`bg-transparent font-plexMono text-[11px] uppercase tracking-wide ${dot.text} focus:outline-none cursor-pointer`}
                          value={inv.status}
                          onChange={e => updateStatus(inv.id, e.target.value as InvoiceStatus)}
                        >
                          {INVOICE_STATUSES.map(s => <option key={s}>{s}</option>)}
                        </select>
                      </div>
                    </td>
                    <td className="py-3 pl-3">
                      <div className="flex items-center justify-end gap-3">
                        <button onClick={() => openEdit(inv)} className="font-plexMono text-[11px] uppercase tracking-wide text-ledger-soft hover:text-ledger-navy transition-colors">Edit</button>
                        <button onClick={() => deleteInvoice(inv.id, inv.invoice_number)} className="font-plexMono text-[11px] uppercase tracking-wide text-ledger-soft hover:text-ledger-crimson transition-colors">Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
    </>
  );
}
