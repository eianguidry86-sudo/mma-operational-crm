import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import TitleBand from '../components/ledger/TitleBand';
import { Users, FolderKanban, TrendingUp, Receipt, Download, Printer } from 'lucide-react';
import { Client, Project, Invoice, DataChecklist } from '../types';

interface ReportSummary {
  activeClients: number;
  newClientsThisMonth: number;
  activeProjects: number;
  completedProjectsThisMonth: number;
  openLeads: number;
  pipelineValue: number;
  revenueThisMonth: number;
  revenueYTD: number;
  outstandingInvoices: number;
  overdueInvoices: number;
  openTasks: number;
  overdueTasks: number;
}

interface ClientReportData {
  client: Client;
  projects: Project[];
  invoices: Invoice[];
}

const checklistProgress = (checklist: DataChecklist) => {
  const vals = Object.values(checklist ?? {});
  return { done: vals.filter(Boolean).length, total: vals.length || 7 };
};

export default function Reports() {
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingExport, setGeneratingExport] = useState(false);

  const [clientList, setClientList] = useState<{ id: string; business_name: string }[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [clientReport, setClientReport] = useState<ClientReportData | null>(null);
  const [clientLoading, setClientLoading] = useState(false);

  useEffect(() => { loadSummary(); loadClientList(); }, []);

  async function loadSummary() {
    setLoading(true);
    try {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const yearStart = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
      const today = now.toISOString().split('T')[0];

      const [
        { data: clients },
        { data: projects },
        { data: leads },
        { data: invoices },
        { data: tasks },
      ] = await Promise.all([
        supabase.from('clients').select('status, created_at'),
        supabase.from('projects').select('status, delivery_date'),
        supabase.from('leads').select('stage, estimated_deal_value'),
        supabase.from('invoices').select('amount, status, due_date, payment_date'),
        supabase.from('tasks').select('status, due_date'),
      ]);

      const activeClients = (clients ?? []).filter(c => c.status === 'Active').length;
      const newClientsThisMonth = (clients ?? []).filter(c => c.created_at >= monthStart).length;
      const activeProjects = (projects ?? []).filter(p => !['Completed', 'On Hold'].includes(p.status)).length;
      const completedProjectsThisMonth = (projects ?? []).filter(p => p.status === 'Completed' && p.delivery_date >= monthStart).length;
      const openLeads = (leads ?? []).filter(l => !['Proposal Lost', 'No Response', 'Not a Fit', 'Project Created'].includes(l.stage)).length;
      const pipelineValue = (leads ?? []).filter(l => !['Proposal Lost', 'No Response', 'Not a Fit'].includes(l.stage)).reduce((s, l) => s + (l.estimated_deal_value ?? 0), 0);

      const allInvoices = invoices ?? [];
      const revenueThisMonth = allInvoices.filter(i => i.status === 'Paid' && i.payment_date >= monthStart).reduce((s, i) => s + i.amount, 0);
      const revenueYTD = allInvoices.filter(i => i.status === 'Paid' && i.payment_date >= yearStart).reduce((s, i) => s + i.amount, 0);
      const outstandingInvoices = allInvoices.filter(i => ['Sent', 'Overdue'].includes(i.status)).reduce((s, i) => s + i.amount, 0);
      const overdueInvoices = allInvoices.filter(i => i.status === 'Overdue' || (i.status === 'Sent' && i.due_date && i.due_date < today)).length;

      const openTasks = (tasks ?? []).filter(t => ['Open', 'In Progress'].includes(t.status)).length;
      const overdueTasks = (tasks ?? []).filter(t => !['Completed', 'Cancelled'].includes(t.status) && t.due_date && t.due_date < today).length;

      setSummary({
        activeClients, newClientsThisMonth, activeProjects, completedProjectsThisMonth,
        openLeads, pipelineValue, revenueThisMonth, revenueYTD,
        outstandingInvoices, overdueInvoices, openTasks, overdueTasks,
      });
    } catch (err) {
      console.error('Reports load error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadClientList() {
    const { data } = await supabase.from('clients').select('id, business_name').order('business_name');
    setClientList(data ?? []);
  }

  async function loadClientReport(clientId: string) {
    setSelectedClientId(clientId);
    if (!clientId) { setClientReport(null); return; }
    setClientLoading(true);
    try {
      const [{ data: client }, { data: projects }, { data: invoices }] = await Promise.all([
        supabase.from('clients').select('*').eq('id', clientId).single(),
        supabase.from('projects').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
        supabase.from('invoices').select('*, projects(project_name)').eq('client_id', clientId).order('created_at', { ascending: false }),
      ]);
      if (client) {
        setClientReport({ client, projects: projects ?? [], invoices: invoices ?? [] });
      } else {
        setClientReport(null);
      }
    } finally {
      setClientLoading(false);
    }
  }

  async function exportCSV(type: string) {
    setGeneratingExport(true);
    try {
      let data: any[] = [];
      let filename = '';

      if (type === 'clients') {
        const { data: c } = await supabase.from('clients').select('*').order('business_name');
        data = c ?? [];
        filename = 'marketmap-clients.csv';
      } else if (type === 'leads') {
        const { data: l } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
        data = l ?? [];
        filename = 'marketmap-leads.csv';
      } else if (type === 'projects') {
        const { data: p } = await supabase.from('projects').select('*, clients(business_name)').order('created_at', { ascending: false });
        data = (p ?? []).map(row => ({ ...row, client_name: (row as any).clients?.business_name }));
        filename = 'marketmap-projects.csv';
      } else if (type === 'invoices') {
        const { data: i } = await supabase.from('invoices').select('*, clients(business_name), projects(project_name)').order('created_at', { ascending: false });
        data = (i ?? []).map(row => ({ ...row, client_name: (row as any).clients?.business_name, project_name: (row as any).projects?.project_name }));
        filename = 'marketmap-invoices.csv';
      }

      if (data.length === 0) { alert('No data to export.'); return; }

      const keys = Object.keys(data[0]).filter(k => typeof data[0][k] !== 'object');
      const csv = [keys.join(','), ...data.map(row => keys.map(k => JSON.stringify(row[k] ?? '')).join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    } finally {
      setGeneratingExport(false);
    }
  }

  function exportClientReportCSV() {
    if (!clientReport) return;
    const { client, projects, invoices } = clientReport;
    const lines: string[] = [];
    lines.push('MarketMap Analytics — Client Report');
    lines.push(`Client,${JSON.stringify(client.business_name)}`);
    lines.push(`Prepared,${new Date().toISOString().split('T')[0]}`);
    lines.push('');
    lines.push('Projects');
    lines.push('Project,Service Type,Status,Data Readiness,Due Date,Delivery Date');
    projects.forEach(p => {
      const prog = checklistProgress(p.data_checklist);
      lines.push([p.project_name, p.service_type ?? '', p.status, `${prog.done}/${prog.total}`, p.due_date ?? '', p.delivery_date ?? ''].map(v => JSON.stringify(v)).join(','));
    });
    lines.push('');
    lines.push('Invoices');
    lines.push('Invoice #,Amount,Status,Due Date,Payment Date');
    invoices.forEach(i => {
      lines.push([i.invoice_number, i.amount, i.status, i.due_date ?? '', i.payment_date ?? ''].map(v => JSON.stringify(v)).join(','));
    });
    const csv = lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `marketmap-${client.business_name.toLowerCase().replace(/\s+/g, '-')}-report.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const sections = summary ? [
    {
      title: 'Client Report',
      icon: Users,
      metrics: [
        { label: 'Active Clients', value: summary.activeClients },
        { label: 'New This Month', value: summary.newClientsThisMonth },
      ],
    },
    {
      title: 'Project Report',
      icon: FolderKanban,
      metrics: [
        { label: 'Active Projects', value: summary.activeProjects },
        { label: 'Completed This Month', value: summary.completedProjectsThisMonth },
      ],
    },
    {
      title: 'Sales Report',
      icon: TrendingUp,
      metrics: [
        { label: 'Open Leads', value: summary.openLeads },
        { label: 'Pipeline Value', value: `$${summary.pipelineValue.toLocaleString()}` },
      ],
    },
    {
      title: 'Revenue Report',
      icon: Receipt,
      metrics: [
        { label: 'Revenue This Month', value: `$${summary.revenueThisMonth.toLocaleString()}` },
        { label: 'Revenue YTD', value: `$${summary.revenueYTD.toLocaleString()}` },
        { label: 'Outstanding', value: `$${summary.outstandingInvoices.toLocaleString()}` },
        { label: 'Overdue Invoices', value: summary.overdueInvoices },
      ],
    },
  ] : [];

  const exports = [
    { label: 'Export Clients', type: 'clients', icon: Users },
    { label: 'Export Leads', type: 'leads', icon: TrendingUp },
    { label: 'Export Projects', type: 'projects', icon: FolderKanban },
    { label: 'Export Invoices', type: 'invoices', icon: Receipt },
  ];

  const totalPaid = clientReport ? clientReport.invoices.filter(i => i.status === 'Paid').reduce((s, i) => s + i.amount, 0) : 0;
  const totalOutstanding = clientReport ? clientReport.invoices.filter(i => ['Sent', 'Overdue'].includes(i.status)).reduce((s, i) => s + i.amount, 0) : 0;
  const activeProjectCount = clientReport ? clientReport.projects.filter(p => p.status !== 'Completed').length : 0;
  const completedProjectCount = clientReport ? clientReport.projects.filter(p => p.status === 'Completed').length : 0;

  return (
    <>
      <TitleBand
        breadcrumb="Workspace / Reports"
        title="Reports"
        stats={summary ? [
          { label: 'Revenue YTD', value: `$${summary.revenueYTD.toLocaleString()}` },
          { label: 'Pipeline', value: `$${summary.pipelineValue.toLocaleString()}` },
        ] : []}
      />

      <div className="flex-1 flex flex-col gap-9 px-8 py-6 overflow-y-auto">
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-ledger-soft font-plexSans text-sm">Generating report…</div>
        ) : (
          <>
            {/* Operational summary */}
            <section>
              <div className="mb-3 font-plexMono text-[10px] uppercase tracking-wider text-ledger-soft">Operational Summary</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-ledger-hairline border border-ledger-hairline">
                {sections.map(section => (
                  <div key={section.title} className="bg-white p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <section.icon size={14} className="text-ledger-navy" />
                      <h3 className="font-plexMono text-[11px] uppercase tracking-wide text-ledger-navy">{section.title}</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {section.metrics.map(m => (
                        <div key={m.label}>
                          <div className="font-plexMono text-xl font-medium text-ledger-navy tabular-nums">{m.value}</div>
                          <div className="font-plexSans text-[11px] text-ledger-muted mt-0.5">{m.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Raw data exports */}
            <section>
              <div className="mb-3 font-plexMono text-[10px] uppercase tracking-wider text-ledger-soft">Data Exports</div>
              <div className="flex flex-wrap gap-3">
                {exports.map(exp => (
                  <button
                    key={exp.type}
                    onClick={() => exportCSV(exp.type)}
                    disabled={generatingExport}
                    className="flex items-center gap-2 border border-ledger-hairline px-4 py-2.5 hover:border-ledger-navy hover:bg-ledger-rowHover transition-colors font-plexMono text-[11px] uppercase tracking-wide text-ledger-body disabled:opacity-50"
                  >
                    <exp.icon size={13} className="text-ledger-soft" />
                    {exp.label}
                    <Download size={12} className="text-ledger-faint" />
                  </button>
                ))}
              </div>
              <p className="font-plexSans text-[11px] text-ledger-faint mt-2">CSV format — compatible with Excel and Google Sheets</p>
            </section>

            {/* Client-facing report generator */}
            <section className="border-t border-ledger-hairline pt-7">
              <div className="flex items-end justify-between gap-6 flex-wrap mb-5">
                <div>
                  <div className="font-plexMono text-[10px] uppercase tracking-wider text-ledger-soft mb-1">Client-Facing Report</div>
                  <h2 className="font-serifLedger text-[26px] leading-none text-ledger-navy">Generate a report</h2>
                </div>
                <div className="flex items-center gap-3">
                  <select
                    className="border-b border-ledger-hairline bg-transparent py-1.5 pr-6 font-plexSans text-sm text-ledger-body focus:outline-none focus:border-ledger-navy"
                    value={selectedClientId}
                    onChange={e => loadClientReport(e.target.value)}
                  >
                    <option value="">Select a client…</option>
                    {clientList.map(c => <option key={c.id} value={c.id}>{c.business_name}</option>)}
                  </select>
                  {clientReport && (
                    <>
                      <button
                        onClick={exportClientReportCSV}
                        className="flex items-center gap-1.5 border border-ledger-hairline px-3 py-2 hover:border-ledger-navy hover:bg-ledger-rowHover transition-colors font-plexMono text-[11px] uppercase tracking-wide text-ledger-body"
                      >
                        <Download size={13} /> CSV
                      </button>
                      <button
                        onClick={() => window.print()}
                        className="flex items-center gap-1.5 bg-ledger-navy text-white px-4 py-2 hover:bg-ledger-navyHover transition-colors font-plexMono text-[11px] uppercase tracking-wide"
                      >
                        <Printer size={13} /> Print / Save PDF
                      </button>
                    </>
                  )}
                </div>
              </div>

              {clientLoading ? (
                <div className="py-16 text-center font-plexSans text-sm text-ledger-faint">Loading client report…</div>
              ) : !clientReport ? (
                <div className="py-16 text-center font-plexSans text-sm text-ledger-faint border border-dashed border-ledger-hairline">
                  Select a client above to generate their report.
                </div>
              ) : (
                <div id="client-report-print" className="border border-ledger-hairline bg-white px-10 py-9 max-w-3xl">
                  {/* Report letterhead */}
                  <div className="flex items-start justify-between border-b-2 border-ledger-navy pb-5 mb-6">
                    <div>
                      <div className="font-plexMono text-[10px] uppercase tracking-[0.15em] text-ledger-muted mb-2">MarketMap Analytics</div>
                      <h1 className="font-serifLedger text-[32px] leading-none text-ledger-navy">{clientReport.client.business_name}</h1>
                      <div className="font-plexSans text-xs text-ledger-mid mt-2">
                        {[clientReport.client.contact_name, clientReport.client.email, clientReport.client.phone].filter(Boolean).join(' · ') || '—'}
                      </div>
                    </div>
                    <div className="text-right font-plexMono text-[10px] uppercase tracking-wide text-ledger-muted">
                      Prepared {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </div>
                  </div>

                  {/* Engagement summary */}
                  <div className="grid grid-cols-3 gap-6 mb-8">
                    <div>
                      <div className="font-plexMono text-[9px] uppercase tracking-wide text-ledger-muted mb-1">Active Projects</div>
                      <div className="font-plexMono text-2xl font-medium text-ledger-navy tabular-nums">{activeProjectCount}</div>
                    </div>
                    <div>
                      <div className="font-plexMono text-[9px] uppercase tracking-wide text-ledger-muted mb-1">Completed</div>
                      <div className="font-plexMono text-2xl font-medium text-ledger-navy tabular-nums">{completedProjectCount}</div>
                    </div>
                    <div>
                      <div className="font-plexMono text-[9px] uppercase tracking-wide text-ledger-muted mb-1">Lifetime Value</div>
                      <div className="font-plexMono text-2xl font-medium text-ledger-navy tabular-nums">${(clientReport.client.lifetime_value ?? 0).toLocaleString()}</div>
                    </div>
                  </div>

                  {/* Project detail */}
                  <div className="mb-8">
                    <div className="font-plexMono text-[10px] uppercase tracking-wider text-ledger-soft mb-2">Project Status</div>
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b border-ledger-hairline">
                          <th className="py-2 pr-3 text-left font-plexMono text-[9px] uppercase tracking-wide text-ledger-soft">Project</th>
                          <th className="py-2 pr-3 text-left font-plexMono text-[9px] uppercase tracking-wide text-ledger-soft">Service</th>
                          <th className="py-2 pr-3 text-left font-plexMono text-[9px] uppercase tracking-wide text-ledger-soft">Status</th>
                          <th className="py-2 pr-3 text-left font-plexMono text-[9px] uppercase tracking-wide text-ledger-soft">Data Readiness</th>
                          <th className="py-2 pl-3 text-right font-plexMono text-[9px] uppercase tracking-wide text-ledger-soft">Due</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clientReport.projects.length === 0 ? (
                          <tr><td colSpan={5} className="py-6 text-center font-plexSans text-xs text-ledger-faint">No projects on file</td></tr>
                        ) : clientReport.projects.map(p => {
                          const prog = checklistProgress(p.data_checklist);
                          return (
                            <tr key={p.id} className="border-b border-ledger-hairline2">
                              <td className="py-2.5 pr-3 font-plexSans text-xs text-ledger-body">{p.project_name}</td>
                              <td className="py-2.5 pr-3 font-plexSans text-xs text-ledger-mid">{p.service_type ?? '—'}</td>
                              <td className="py-2.5 pr-3 font-plexSans text-xs text-ledger-mid">{p.status}</td>
                              <td className="py-2.5 pr-3 font-plexMono text-xs text-ledger-mid tabular-nums">{prog.done}/{prog.total}</td>
                              <td className="py-2.5 pl-3 text-right font-plexSans text-xs text-ledger-mid">{p.due_date ?? '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Financial summary */}
                  <div className="mb-2">
                    <div className="font-plexMono text-[10px] uppercase tracking-wider text-ledger-soft mb-2">Billing Summary</div>
                    <div className="flex items-center gap-8 mb-3">
                      <div>
                        <div className="font-plexMono text-[9px] uppercase tracking-wide text-ledger-muted mb-1">Paid to Date</div>
                        <div className="font-plexMono text-lg font-medium text-ledger-green tabular-nums">${totalPaid.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="font-plexMono text-[9px] uppercase tracking-wide text-ledger-muted mb-1">Outstanding Balance</div>
                        <div className={`font-plexMono text-lg font-medium tabular-nums ${totalOutstanding > 0 ? 'text-ledger-crimson' : 'text-ledger-navy'}`}>${totalOutstanding.toLocaleString()}</div>
                      </div>
                    </div>
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b border-ledger-hairline">
                          <th className="py-2 pr-3 text-left font-plexMono text-[9px] uppercase tracking-wide text-ledger-soft">Invoice #</th>
                          <th className="py-2 pr-3 text-left font-plexMono text-[9px] uppercase tracking-wide text-ledger-soft">Project</th>
                          <th className="py-2 pr-3 text-right font-plexMono text-[9px] uppercase tracking-wide text-ledger-soft">Amount</th>
                          <th className="py-2 pr-3 text-left font-plexMono text-[9px] uppercase tracking-wide text-ledger-soft">Status</th>
                          <th className="py-2 pl-3 text-right font-plexMono text-[9px] uppercase tracking-wide text-ledger-soft">Due</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clientReport.invoices.length === 0 ? (
                          <tr><td colSpan={5} className="py-6 text-center font-plexSans text-xs text-ledger-faint">No invoices on file</td></tr>
                        ) : clientReport.invoices.map(inv => (
                          <tr key={inv.id} className="border-b border-ledger-hairline2">
                            <td className="py-2.5 pr-3 font-plexMono text-xs text-ledger-body">{inv.invoice_number}</td>
                            <td className="py-2.5 pr-3 font-plexSans text-xs text-ledger-mid">{(inv as any).projects?.project_name ?? '—'}</td>
                            <td className="py-2.5 pr-3 text-right font-plexMono text-xs text-ledger-body tabular-nums">${inv.amount.toLocaleString()}</td>
                            <td className="py-2.5 pr-3 font-plexMono text-[10px] uppercase tracking-wide text-ledger-mid">{inv.status}</td>
                            <td className="py-2.5 pl-3 text-right font-plexSans text-xs text-ledger-mid">{inv.due_date ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-9 pt-4 border-t border-ledger-hairline flex items-center justify-between font-plexMono text-[9px] uppercase tracking-wide text-ledger-faint">
                    <span>MarketMap Analytics · GIS Small Business Consulting</span>
                    <span>Confidential — prepared for {clientReport.client.business_name}</span>
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </>
  );
}
