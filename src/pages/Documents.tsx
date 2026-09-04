import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Document, DocType, Client, Project } from '../types';
import Header from '../components/layout/Header';
import Modal from '../components/ui/Modal';
import { Plus, Search, FileText, Filter, ExternalLink } from 'lucide-react';

const DOC_TYPES: DocType[] = ['Contract', 'Proposal', 'Report', 'Other'];

const emptyDoc = (): Partial<Document> => ({
  name: '', doc_type: 'Contract', url: '', notes: '',
});

const docTypeColors: Record<DocType, string> = {
  Contract: 'bg-navy-100 text-navy-700',
  Proposal: 'bg-blue-100 text-blue-700',
  Report: 'bg-emerald-100 text-emerald-700',
  Other: 'bg-surface-200 text-navy-500',
};

export default function Documents() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selected, setSelected] = useState<Document | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<Partial<Document>>(emptyDoc());
  const [clientId, setClientId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [{ data: d }, { data: c }, { data: p }] = await Promise.all([
      supabase.from('documents').select('*, clients(business_name), projects(project_name)').order('created_at', { ascending: false }),
      supabase.from('clients').select('id, business_name').order('business_name'),
      supabase.from('projects').select('id, project_name, client_id').order('project_name'),
    ]);
    setDocs(d ?? []);
    setClients(c ?? []);
    setProjects(p ?? []);
    setLoading(false);
  }

  async function saveDoc() {
    if (!form.name?.trim()) return;
    setSaving(true);
    const now = new Date().toISOString();
    const payload = { ...form, client_id: clientId || null, project_id: projectId || null };
    if (selected) {
      await supabase.from('documents').update(payload).eq('id', selected.id);
    } else {
      await supabase.from('documents').insert({ ...payload, created_at: now });
      await supabase.from('activity_log').insert({ action: 'Added document', entity_type: 'Document', entity_name: form.name });
    }
    setSaving(false);
    setModalOpen(false);
    setSelected(null);
    setForm(emptyDoc());
    setClientId('');
    setProjectId('');
    loadData();
  }

  async function deleteDoc(id: string, name: string) {
    if (!confirm(`Delete "${name}"?`)) return;
    await supabase.from('documents').delete().eq('id', id);
    loadData();
  }

  function openEdit(doc: Document) {
    setSelected(doc);
    setForm({ ...doc });
    setClientId(doc.client_id ?? '');
    setProjectId(doc.project_id ?? '');
    setModalOpen(true);
  }

  function openNew() {
    setSelected(null);
    setForm(emptyDoc());
    setClientId('');
    setProjectId('');
    setModalOpen(true);
  }

  const set = (k: keyof Document, v: any) => setForm(f => ({ ...f, [k]: v }));

  const filtered = docs.filter(d => {
    const matchSearch = !search || d.name.toLowerCase().includes(search.toLowerCase()) ||
      ((d as any).clients?.business_name ?? '').toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'all' || d.doc_type === typeFilter;
    return matchSearch && matchType;
  });

  const filteredProjects = projects.filter(p => !clientId || p.client_id === clientId);

  const timeAgo = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    return `${days}d ago`;
  };

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="Documents"
        subtitle={`${docs.length} documents`}
        actions={
          <button onClick={openNew} className="btn-primary py-1.5 px-3 text-xs">
            <Plus size={14} /> Add Document
          </button>
        }
      />

      <div className="flex-1 p-6 flex flex-col gap-4 overflow-y-auto">
        <div className="flex items-center gap-3">
          <div className="relative max-w-xs flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400" />
            <input className="form-input pl-9 py-1.5 text-xs" placeholder="Search documents..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={13} className="text-navy-400" />
            <select className="form-select py-1.5 text-xs w-32" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
              <option value="all">All Types</option>
              {DOC_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-navy-400 text-sm">Loading documents...</div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">Document</th>
                  <th className="table-header">Type</th>
                  <th className="table-header">Client</th>
                  <th className="table-header">Project</th>
                  <th className="table-header">Added</th>
                  <th className="table-header">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="table-cell text-center text-navy-400 py-12">No documents found</td></tr>
                ) : filtered.map(doc => (
                  <tr key={doc.id} className="hover:bg-surface-50 transition-colors">
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <FileText size={14} className="text-navy-400 flex-shrink-0" />
                        <div>
                          <div className="font-medium text-navy-800">{doc.name}</div>
                          {doc.notes && <div className="text-xs text-navy-400 truncate max-w-xs">{doc.notes}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="table-cell">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${docTypeColors[doc.doc_type as DocType] ?? 'bg-surface-200 text-navy-500'}`}>
                        {doc.doc_type}
                      </span>
                    </td>
                    <td className="table-cell text-xs text-navy-500">{(doc as any).clients?.business_name ?? '—'}</td>
                    <td className="table-cell text-xs text-navy-500">{(doc as any).projects?.project_name ?? '—'}</td>
                    <td className="table-cell text-xs text-navy-400">{timeAgo(doc.created_at)}</td>
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        {doc.url && (
                          <a href={doc.url} target="_blank" rel="noreferrer" className="text-navy-500 hover:text-navy-800 transition-colors" onClick={e => e.stopPropagation()}>
                            <ExternalLink size={13} />
                          </a>
                        )}
                        <button onClick={() => openEdit(doc)} className="text-xs text-navy-500 hover:text-navy-800 transition-colors">Edit</button>
                        <button onClick={() => deleteDoc(doc.id, doc.name)} className="text-xs text-crimson-500 hover:text-crimson-700 transition-colors">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={selected ? 'Edit Document' : 'Add Document'}
        size="md"
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={saveDoc} disabled={saving} className="btn-primary">
              {saving ? 'Saving...' : selected ? 'Save Changes' : 'Add Document'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="form-label">Document Name *</label>
            <input className="form-input" value={form.name ?? ''} onChange={e => set('name', e.target.value)} />
          </div>
          <div>
            <label className="form-label">Type</label>
            <select className="form-select" value={form.doc_type ?? 'Contract'} onChange={e => set('doc_type', e.target.value)}>
              {DOC_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Client</label>
            <select className="form-select" value={clientId} onChange={e => { setClientId(e.target.value); setProjectId(''); }}>
              <option value="">None</option>
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
            <label className="form-label">URL / Link</label>
            <input className="form-input" type="url" placeholder="https://..." value={form.url ?? ''} onChange={e => set('url', e.target.value)} />
          </div>
          <div>
            <label className="form-label">Notes</label>
            <textarea className="form-input resize-none" rows={2} value={form.notes ?? ''} onChange={e => set('notes', e.target.value)} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
