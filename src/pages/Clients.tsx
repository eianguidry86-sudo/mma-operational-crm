import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Client, Project, Invoice, Communication, Document } from '../types';
import Header from '../components/layout/Header';
import Modal from '../components/ui/Modal';
import Badge from '../components/ui/Badge';
import { getInvoiceStatusBadge, getProjectStatusBadge } from '../components/ui/Badge';
import {
  Plus, Search, Building2, Mail, Phone, Globe, ChevronRight,
  DollarSign, FolderKanban, MessageSquare, FileText, TrendingUp, PieChart
} from 'lucide-react';
import CsvUploader from '../components/CsvUploader';

const emptyClient = (): Partial<Client> => ({
  business_name: '', contact_name: '', email: '', phone: '', website: '',
  industry: '', service_area: '', business_size: '', notes: '', status: 'Active',
});

type ClientTab = 'overview' | 'projects' | 'billing' | 'communications' | 'documents' | 'analytics' | 'snapshot';

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Client | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [tab, setTab] = useState<ClientTab>('overview');
  const [form, setForm] = useState<Partial<Client>>(emptyClient());
  const [saving, setSaving] = useState(false);
  const [clientProjects, setClientProjects] = useState<Project[]>([]);
  const [clientInvoices, setClientInvoices] = useState<Invoice[]>([]);
  const [clientComms, setClientComms] = useState<Communication[]>([]);
  const [clientDocs, setClientDocs] = useState<Document[]>([]);
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [csvData, setCsvData] = useState<any[] | null>(null);

  useEffect(() => { loadClients(); }, []);

  async function loadClients() {
    setLoading(true);
    const { data } = await supabase.from('clients').select('*').order('business_name');
    setClients(data ?? []);
    setLoading(false);
  }

  async function loadClientData(clientId: string) {
    const [{ data: projects }, { data: invoices }, { data: comms }, { data: docs }] = await Promise.all([
      supabase.from('projects').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
      supabase.from('invoices').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
      supabase.from('communications').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
      supabase.from('documents').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
    ]);
    setClientProjects(projects ?? []);
    setClientInvoices(invoices ?? []);
    setClientComms(comms ?? []);
    setClientDocs(docs ?? []);
  }

  async function logActivity(action: string, name: string) {
    await supabase.from('activity_log').insert({ action, entity_type: 'Client', entity_name: name });
  }

  async function saveClient() {
    if (!form.business_name?.trim()) return;
    setSaving(true);
    const now = new Date().toISOString();
    let createdClientId = selected?.id;

    // Remove fields that don't exist in the Supabase clients table schema
    const { google_maps_url, facebook_url, ...clientData } = form;

    if (selected) {
      const { error } = await supabase.from('clients').update({ ...clientData, updated_at: now }).eq('id', selected.id);
      if (error) { alert("Error updating client: " + error.message); setSaving(false); return; }
      await logActivity('Updated client', form.business_name!);
    } else {
      const { data: newClient, error } = await supabase.from('clients').insert({ ...clientData, created_at: now, updated_at: now }).select().single();
      if (error) { alert("Error creating client: " + error.message); setSaving(false); return; }
      if (newClient) {
        createdClientId = newClient.id;
        await logActivity('Created client', form.business_name!);
      }
    }

    if (createdClientId) {
       let targetProjectId = null;
       
       if (selected) {
         // Late Ingest: Find most recent project
         const { data: existingProjs } = await supabase.from('projects').select('id').eq('client_id', createdClientId).order('created_at', { ascending: false }).limit(1);
         if (existingProjs && existingProjs.length > 0) {
            targetProjectId = existingProjs[0].id;
         }
       }
       
       if (!targetProjectId) {
         // Create a Project for this data
         const { data: newProj, error: projError } = await supabase.from('projects').insert({
           client_id: createdClientId,
           project_name: `${form.business_name} - Initial Research`,
           status: 'In Progress',
           created_at: now,
           updated_at: now
         }).select().single();
         if (projError) { alert("Error creating project: " + projError.message); }
         if (newProj) targetProjectId = newProj.id;
       }
       
       if (targetProjectId) {
          // 2. Attach project ID to CSV data and bulk insert
          if (csvData && csvData.length > 0) {
              for (let i = 0; i < csvData.length; i += 100) {
                 const chunk = csvData.slice(i, i + 100).map(row => ({ ...row, business_owner_id: targetProjectId }));
                 await supabase.from('crm_customers').insert(chunk);
              }
          }
          
          if (selected) {
            // Late Ingest: Ping Python Engine directly to update snapshot
            if (csvData && csvData.length > 0) {
                try {
                   await fetch('http://localhost:8000/api/v1/analyze', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ project_id: targetProjectId })
                   });
                } catch(e) { console.error('Python Webhook failed', e); }
            }
          } else {
            // New Client: Trigger Master Orchestrator Webhook
            try {
               await fetch('http://localhost:5678/webhook/pipeline', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ 
                     project_id: targetProjectId,
                     client_id: createdClientId,
                     business_name: form.business_name,
                     google_maps_url: form.google_maps_url,
                     facebook_url: form.facebook_url,
                     industry: form.industry,
                     service_area: form.service_area
                  })
               });
            } catch(e) { console.error('Webhook failed', e); }
          }
       }
    }

    setSaving(false);
    setModalOpen(false);
    setSelected(null);
    setForm(emptyClient());
    setCsvData(null);
    loadClients();
  }

  async function deleteClient(client: Client) {
    if (!confirm(`Delete client "${client.business_name}"? This will delete all associated projects, invoices and data.`)) return;
    await supabase.from('clients').delete().eq('id', client.id);
    await logActivity('Deleted client', client.business_name);
    setDetailOpen(false);
    loadClients();
  }

  async function addNote() {
    if (!newNote.trim() || !selected) return;
    setAddingNote(true);
    await supabase.from('communications').insert({
      client_id: selected.id, type: 'note', subject: 'Note', body: newNote, created_at: new Date().toISOString(),
    });
    setNewNote('');
    setAddingNote(false);
    loadClientData(selected.id);
  }

  function openDetail(client: Client) {
    setSelected(client);
    setTab('overview');
    setDetailOpen(true);
    loadClientData(client.id);
  }

  function openEdit(client: Client) {
    setSelected(client);
    setForm({ ...client });
    setCsvData(null);
    setModalOpen(true);
  }

  function openNew() {
    setSelected(null);
    setForm(emptyClient());
    setCsvData(null);
    setModalOpen(true);
  }

  const set = (k: keyof Client, v: any) => setForm(f => ({ ...f, [k]: v }));

  const filtered = clients.filter(c =>
    !search ||
    c.business_name.toLowerCase().includes(search.toLowerCase()) ||
    (c.contact_name ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const totalRevenue = clientInvoices.filter(i => i.status === 'Paid').reduce((s, i) => s + i.amount, 0);
  const outstanding = clientInvoices.filter(i => ['Sent', 'Overdue'].includes(i.status)).reduce((s, i) => s + i.amount, 0);

  const tabs: { id: ClientTab; label: string; icon: any }[] = [
    { id: 'overview', label: 'Overview', icon: Building2 },
    { id: 'projects', label: 'Projects', icon: FolderKanban },
    { id: 'billing', label: 'Billing', icon: DollarSign },
    { id: 'communications', label: 'Communications', icon: MessageSquare },
    { id: 'documents', label: 'Documents', icon: FileText },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp },
    { id: 'snapshot', label: 'Snapshot', icon: PieChart },
  ];

  const timeAgo = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="Clients"
        subtitle={`${clients.filter(c => c.status === 'Active').length} active`}
        actions={
          <button onClick={openNew} className="btn-primary py-1.5 px-3 text-xs">
            <Plus size={14} /> Add Client
          </button>
        }
      />

      <div className="flex-1 p-6 flex flex-col gap-4 overflow-y-auto">
        <div className="relative max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400" />
          <input className="form-input pl-9 py-1.5 text-xs" placeholder="Search clients..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-navy-400 text-sm">Loading clients...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.length === 0 ? (
              <div className="col-span-3 text-center py-16 text-navy-400">No clients found</div>
            ) : filtered.map(client => (
              <div
                key={client.id}
                className="card p-5 cursor-pointer hover:shadow-card-hover transition-all group"
                onClick={() => openDetail(client)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-navy-100 flex items-center justify-center flex-shrink-0">
                    <Building2 size={18} className="text-navy-600" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-2xs font-semibold px-2 py-0.5 rounded-full ${
                      client.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-surface-200 text-navy-500'
                    }`}>{client.status}</span>
                    <ChevronRight size={14} className="text-surface-400 group-hover:text-navy-500 transition-colors" />
                  </div>
                </div>
                <h3 className="font-semibold text-navy-900 mb-0.5 truncate">{client.business_name}</h3>
                {client.contact_name && <p className="text-xs text-navy-400 mb-3">{client.contact_name}</p>}
                <div className="space-y-1">
                  {client.email && (
                    <div className="flex items-center gap-1.5 text-xs text-navy-500">
                      <Mail size={11} /> <span className="truncate">{client.email}</span>
                    </div>
                  )}
                  {client.phone && (
                    <div className="flex items-center gap-1.5 text-xs text-navy-500">
                      <Phone size={11} /> {client.phone}
                    </div>
                  )}
                  {client.industry && (
                    <div className="flex items-center gap-1.5 text-xs text-navy-400">
                      <Globe size={11} /> {client.industry}
                    </div>
                  )}
                </div>
                {client.lifetime_value > 0 && (
                  <div className="mt-3 pt-3 border-t border-surface-100 flex items-center justify-between">
                    <span className="text-2xs text-navy-400">Lifetime Value</span>
                    <span className="text-sm font-bold text-emerald-700">${client.lifetime_value.toLocaleString()}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Client Detail Modal */}
      <Modal
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={selected?.business_name ?? ''}
        size="xl"
        footer={
          <>
            <button onClick={() => { setDetailOpen(false); selected && openEdit(selected); }} className="btn-secondary">Edit</button>
            {selected && <button onClick={() => deleteClient(selected)} className="btn-danger">Delete</button>}
          </>
        }
      >
        {selected && (
          <div>
            {/* Tabs */}
            <div className="flex gap-1 mb-5 border-b border-surface-200 -mx-6 px-6">
              {tabs.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors -mb-px ${
                    tab === t.id ? 'border-navy-800 text-navy-900' : 'border-transparent text-navy-400 hover:text-navy-700'
                  }`}
                >
                  <t.icon size={13} /> {t.label}
                </button>
              ))}
            </div>

            {tab === 'overview' && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Contact', value: selected.contact_name },
                    { label: 'Email', value: selected.email },
                    { label: 'Phone', value: selected.phone },
                    { label: 'Website', value: selected.website },
                    { label: 'Industry', value: selected.industry },
                    { label: 'Service Area', value: selected.service_area },
                    { label: 'Business Size', value: selected.business_size },
                    { label: 'Status', value: selected.status },
                  ].map(({ label, value }) => value ? (
                    <div key={label}>
                      <div className="form-label">{label}</div>
                      <div className="text-sm text-navy-700">{value}</div>
                    </div>
                  ) : null)}
                </div>
                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-surface-200">
                  <div className="bg-surface-50 rounded-xl p-3 text-center">
                    <div className="text-2xl font-bold text-navy-900">{clientProjects.length}</div>
                    <div className="text-xs text-navy-400">Projects</div>
                  </div>
                  <div className="bg-emerald-50 rounded-xl p-3 text-center">
                    <div className="text-2xl font-bold text-emerald-700">${totalRevenue.toLocaleString()}</div>
                    <div className="text-xs text-navy-400">Total Revenue</div>
                  </div>
                  <div className="bg-amber-50 rounded-xl p-3 text-center">
                    <div className="text-2xl font-bold text-amber-700">${outstanding.toLocaleString()}</div>
                    <div className="text-xs text-navy-400">Outstanding</div>
                  </div>
                </div>
                {selected.notes && (
                  <div>
                    <div className="form-label">Notes</div>
                    <div className="text-sm text-navy-700 whitespace-pre-wrap">{selected.notes}</div>
                  </div>
                )}
              </div>
            )}

            {tab === 'projects' && (
              <div className="space-y-2">
                {clientProjects.length === 0 ? (
                  <div className="text-center py-8 text-navy-400 text-sm">No projects yet</div>
                ) : clientProjects.map(p => {
                  const badge = getProjectStatusBadge(p.status);
                  return (
                    <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-surface-50 border border-surface-200">
                      <div>
                        <div className="text-sm font-medium text-navy-800">{p.project_name}</div>
                        <div className="text-xs text-navy-400">{p.service_type}</div>
                      </div>
                      <Badge label={badge.label} variant={badge.variant} />
                    </div>
                  );
                })}
              </div>
            )}

            {tab === 'billing' && (
              <div className="space-y-2">
                {clientInvoices.length === 0 ? (
                  <div className="text-center py-8 text-navy-400 text-sm">No invoices yet</div>
                ) : clientInvoices.map(inv => {
                  const badge = getInvoiceStatusBadge(inv.status);
                  return (
                    <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg bg-surface-50 border border-surface-200">
                      <div>
                        <div className="text-sm font-medium text-navy-800">{inv.invoice_number}</div>
                        <div className="text-xs text-navy-400">Due: {inv.due_date ?? '—'}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-navy-700">${inv.amount.toLocaleString()}</span>
                        <Badge label={badge.label} variant={badge.variant} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {tab === 'communications' && (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <textarea
                    className="form-input flex-1 resize-none text-xs"
                    rows={2}
                    placeholder="Add a note..."
                    value={newNote}
                    onChange={e => setNewNote(e.target.value)}
                  />
                  <button onClick={addNote} disabled={addingNote || !newNote.trim()} className="btn-primary self-end px-3 py-2 text-xs">
                    {addingNote ? '...' : 'Add'}
                  </button>
                </div>
                <div className="space-y-2">
                  {clientComms.length === 0 ? (
                    <div className="text-center py-6 text-navy-400 text-sm">No communications yet</div>
                  ) : clientComms.map(c => (
                    <div key={c.id} className="p-3 rounded-lg bg-surface-50 border border-surface-200">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-2xs font-bold text-navy-500 uppercase">{c.type}</span>
                        <span className="text-2xs text-navy-400">{timeAgo(c.created_at)}</span>
                      </div>
                      <div className="text-sm text-navy-700">{c.body}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === 'documents' && (
              <div className="text-center py-8 text-navy-400 text-sm">
                Documents are managed in the <button className="text-navy-600 underline">Documents</button> section.
              </div>
            )}

            {tab === 'analytics' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-surface-50 rounded-xl p-4">
                  <div className="text-xs text-navy-400 mb-1">Lifetime Value</div>
                  <div className="text-2xl font-bold text-navy-900">${(selected.lifetime_value ?? 0).toLocaleString()}</div>
                </div>
                <div className="bg-surface-50 rounded-xl p-4">
                  <div className="text-xs text-navy-400 mb-1">Total Revenue</div>
                  <div className="text-2xl font-bold text-emerald-700">${totalRevenue.toLocaleString()}</div>
                </div>
                <div className="bg-surface-50 rounded-xl p-4">
                  <div className="text-xs text-navy-400 mb-1">Projects Completed</div>
                  <div className="text-2xl font-bold text-navy-900">{clientProjects.filter(p => p.status === 'Completed').length}</div>
                </div>
                <div className="bg-surface-50 rounded-xl p-4">
                  <div className="text-xs text-navy-400 mb-1">Services Used</div>
                  <div className="text-sm font-medium text-navy-700 mt-1">
                    {[...new Set(clientProjects.map(p => p.service_type).filter(Boolean))].join(', ') || '—'}
                  </div>
                </div>
              </div>
            )}

            {tab === 'snapshot' && (
              <div className="space-y-6">
                {clientDocs.filter(d => d.doc_type === 'Report' && d.url).length > 0 ? (
                  clientDocs.filter(d => d.doc_type === 'Report' && d.url).map(doc => (
                    <div key={doc.id} className="card overflow-hidden">
                      <div className="px-5 py-4 border-b border-surface-200 flex items-center justify-between bg-surface-50">
                        <h3 className="font-semibold text-navy-900 flex items-center gap-2">
                          <PieChart size={16} className="text-navy-500" />
                          {doc.name}
                        </h3>
                        <a href={doc.url!} target="_blank" rel="noreferrer" className="btn-secondary py-1.5 px-3 text-xs">
                          Open Full Screen
                        </a>
                      </div>
                      <div className="w-full h-[600px] bg-white">
                        <iframe src={doc.url!} className="w-full h-full border-none" title={doc.name} />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 card bg-surface-50 border-dashed border-2 border-surface-200">
                    <PieChart size={32} className="mx-auto text-navy-300 mb-3" />
                    <div className="text-navy-900 font-medium mb-1">No Snapshot Available</div>
                    <div className="text-navy-400 text-sm">
                      Attach a document of type 'Report' with a URL to display the interactive deliverable here.
                    </div>
                  </div>
                )}
                
                {clientProjects.some(p => p.analysis_data) && (
                  <div>
                    <h3 className="text-sm font-semibold text-navy-900 mb-3 flex items-center gap-2">
                      <TrendingUp size={16} className="text-navy-500" />
                      Key Metrics
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {clientProjects.filter(p => p.analysis_data).map(p => 
                        Object.entries(p.analysis_data!).map(([key, value]) => (
                          <div key={`${p.id}-${key}`} className="bg-white rounded-xl p-4 border border-surface-200 shadow-sm">
                            <div className="text-xs text-navy-400 mb-1 uppercase tracking-wider font-semibold">{key.replace(/_/g, ' ')}</div>
                            <div className="text-xl font-bold text-navy-900">
                              {typeof value === 'number' ? value.toLocaleString() : String(value)}
                            </div>
                            <div className="text-2xs text-navy-400 mt-2 truncate max-w-[120px]" title={p.project_name}>Proj: {p.project_name}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={selected ? 'Edit Client' : 'New Client'}
        size="lg"
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={saveClient} disabled={saving} className="btn-primary">
              {saving ? 'Saving...' : selected ? 'Save Changes' : 'Create Client'}
            </button>
          </>
        }
      >
          <div className="space-y-5">
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
                <label className="form-label">Status</label>
                <select className="form-select" value={form.status ?? 'Active'} onChange={e => set('status', e.target.value)}>
                  <option>Active</option>
                  <option>Inactive</option>
                  <option>On Hold</option>
                </select>
              </div>
              <div className="col-span-2">
              <label className="form-label">Google Maps URL</label>
              <input className="form-input" placeholder="https://maps.google.com/..." value={form.google_maps_url ?? ''} onChange={e => set('google_maps_url', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="form-label">Facebook Page URL</label>
              <input className="form-input" placeholder="https://facebook.com/..." value={form.facebook_url ?? ''} onChange={e => set('facebook_url', e.target.value)} />
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
              <div>
                <label className="form-label">Industry</label>
                <input className="form-input" value={form.industry ?? ''} onChange={e => set('industry', e.target.value)} />
              </div>
              <div>
                <label className="form-label">Service Area</label>
                <input className="form-input" value={form.service_area ?? ''} onChange={e => set('service_area', e.target.value)} />
              </div>
              <div>
                <label className="form-label">Business Size</label>
                <input className="form-input" value={form.business_size ?? ''} onChange={e => set('business_size', e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className="form-label">Notes</label>
                <textarea className="form-input resize-none" rows={3} value={form.notes ?? ''} onChange={e => set('notes', e.target.value)} />
              </div>
            </div>
            
            <div className="pt-4 border-t border-surface-200 mt-4">
               <h3 className="font-bold text-navy-900 mb-2">Operational Data (Optional)</h3>
               {!csvData ? (
                 <>
                   <p className="text-sm text-navy-500 mb-4">Upload the client's CRM export to automatically map fields, geocode addresses, and kick off the market research pipelines.</p>
                   <CsvUploader onComplete={(data) => setCsvData(data)} onCancel={() => setModalOpen(false)} />
                 </>
               ) : (
                 <div className="p-8 text-center bg-emerald-50 rounded-xl border border-emerald-100">
                    <h3 className="text-xl font-bold text-emerald-800 mb-2">Ready to Ingest</h3>
                    <p className="text-emerald-700">Successfully mapped and geocoded {csvData.length} records.</p>
                    <button onClick={() => setCsvData(null)} className="text-sm text-emerald-600 underline mt-4">Upload a different file</button>
                 </div>
               )}
            </div>
          </div>
      </Modal>
    </div>
  );
}
