import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Client, Project, Invoice, Communication, Document } from '../types';
import TitleBand from '../components/ledger/TitleBand';
import Modal from '../components/ui/Modal';
import Badge from '../components/ui/Badge';
import { getInvoiceStatusBadge, getProjectStatusBadge } from '../components/ui/Badge';
import {
  Building2, ArrowRight,
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
  const [aggregates, setAggregates] = useState<Record<string, { projects: number; openAR: number; touchedAt: string | null }>>({});

  useEffect(() => { loadClients(); }, []);

  async function loadClients() {
    setLoading(true);
    const [{ data }, { data: allProjects }, { data: allInvoices }] = await Promise.all([
      supabase.from('clients').select('*').order('business_name'),
      supabase.from('projects').select('id, client_id, updated_at'),
      supabase.from('invoices').select('client_id, amount, status, updated_at'),
    ]);
    setClients(data ?? []);

    const agg: Record<string, { projects: number; openAR: number; touchedAt: string | null }> = {};
    (data ?? []).forEach(c => { agg[c.id] = { projects: 0, openAR: 0, touchedAt: c.updated_at ?? null }; });
    (allProjects ?? []).forEach(p => {
      if (!agg[p.client_id]) return;
      agg[p.client_id].projects += 1;
      if (p.updated_at && (!agg[p.client_id].touchedAt || p.updated_at > agg[p.client_id].touchedAt!)) {
        agg[p.client_id].touchedAt = p.updated_at;
      }
    });
    (allInvoices ?? []).forEach(i => {
      if (!agg[i.client_id]) return;
      if (['Sent', 'Overdue'].includes(i.status)) agg[i.client_id].openAR += i.amount ?? 0;
      if (i.updated_at && (!agg[i.client_id].touchedAt || i.updated_at > agg[i.client_id].touchedAt!)) {
        agg[i.client_id].touchedAt = i.updated_at;
      }
    });
    setAggregates(agg);
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

  const filtered = clients
    .filter(c =>
      !search ||
      c.business_name.toLowerCase().includes(search.toLowerCase()) ||
      (c.contact_name ?? '').toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => (b.lifetime_value ?? 0) - (a.lifetime_value ?? 0));

  const activeCount = clients.filter(c => c.status === 'Active').length;
  const totalLifetimeValue = clients.reduce((s, c) => s + (c.lifetime_value ?? 0), 0);

  const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

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

  const fmt = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toLocaleString()}`;

  return (
    <>
      <TitleBand
        breadcrumb="Pipeline / Accounts"
        title="Accounts"
        stats={[
          { label: 'Active', value: activeCount.toString() },
          { label: 'Lifetime value', value: fmt(totalLifetimeValue) },
        ]}
        actionLabel="Add account"
        onAction={openNew}
      />

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="flex-shrink-0 flex items-center justify-between px-7 py-2.5 border-b border-ledger-hairline bg-white">
          <span className="font-plexMono text-[9px] uppercase tracking-[0.14em] text-ledger-muted">Ranked by lifetime value</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search accounts…"
            className="w-48 bg-transparent font-plexSans text-[12px] text-ledger-navy placeholder-ledger-muted border-b border-transparent focus:border-ledger-navy focus:outline-none py-1"
          />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-48 text-ledger-muted font-plexMono text-xs uppercase tracking-widest">
              Loading…
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 font-plexMono text-[10px] uppercase tracking-[0.14em] text-ledger-muted">
              No accounts found
            </div>
          ) : (
            filtered.map((client, idx) => {
              const agg = aggregates[client.id] ?? { projects: 0, openAR: 0, touchedAt: null };
              return (
                <div
                  key={client.id}
                  onClick={() => openDetail(client)}
                  className={`flex items-center gap-5 px-7 py-4 border-b border-ledger-hairline2 last:border-b-0 cursor-pointer hover:bg-ledger-rowHover transition-colors ${
                    idx % 2 === 1 ? 'bg-ledger-zebra' : 'bg-white'
                  }`}
                >
                  <span className="w-9 flex-shrink-0 font-serifLedger text-[26px] text-ledger-muted text-right tabular-nums">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <span className="w-9 h-9 flex-shrink-0 flex items-center justify-center bg-ledger-navy/5 border border-ledger-hairline font-plexMono text-[10px] font-medium text-ledger-navy">
                    {initials(client.business_name)}
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="font-serifLedger text-[21px] leading-tight text-ledger-navy truncate">{client.business_name}</div>
                    <div className="font-plexMono text-[10px] uppercase tracking-[0.08em] text-ledger-muted mt-0.5 truncate">
                      {[client.contact_name, client.industry, agg.touchedAt ? `touched ${timeAgo(agg.touchedAt)}` : null]
                        .filter(Boolean).join(' · ')}
                    </div>
                  </div>

                  <div className="flex items-center gap-8 flex-shrink-0">
                    <div className="text-right">
                      <div className="font-plexMono text-[9px] uppercase tracking-[0.1em] text-ledger-muted mb-0.5">Lifetime</div>
                      <div className="font-plexMono text-[13px] font-medium text-ledger-navy tabular-nums">{fmt(client.lifetime_value ?? 0)}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-plexMono text-[9px] uppercase tracking-[0.1em] text-ledger-muted mb-0.5">Projects</div>
                      <div className="font-plexMono text-[13px] font-medium text-ledger-navy tabular-nums">{agg.projects}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-plexMono text-[9px] uppercase tracking-[0.1em] text-ledger-muted mb-0.5">Open AR</div>
                      <div className={`font-plexMono text-[13px] font-medium tabular-nums ${agg.openAR > 0 ? 'text-ledger-crimson' : 'text-ledger-navy'}`}>
                        {fmt(agg.openAR)}
                      </div>
                    </div>
                    <ArrowRight size={13} className="text-ledger-muted" />
                  </div>
                </div>
              );
            })
          )}
        </div>
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
    </>
  );
}
