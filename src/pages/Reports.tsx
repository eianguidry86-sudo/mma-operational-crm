import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import Header from '../components/layout/Header';
import { FileText, Download, TrendingUp, Users, FolderKanban, Receipt } from 'lucide-react';

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

export default function Reports() {
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingExport, setGeneratingExport] = useState(false);

  useEffect(() => { loadSummary(); }, []);

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

  const sections = summary ? [
    {
      title: 'Client Report',
      icon: Users,
      color: 'text-navy-700',
      bg: 'bg-navy-50',
      metrics: [
        { label: 'Active Clients', value: summary.activeClients },
        { label: 'New This Month', value: summary.newClientsThisMonth },
      ],
    },
    {
      title: 'Project Report',
      icon: FolderKanban,
      color: 'text-blue-700',
      bg: 'bg-blue-50',
      metrics: [
        { label: 'Active Projects', value: summary.activeProjects },
        { label: 'Completed This Month', value: summary.completedProjectsThisMonth },
      ],
    },
    {
      title: 'Sales Report',
      icon: TrendingUp,
      color: 'text-orange-700',
      bg: 'bg-orange-50',
      metrics: [
        { label: 'Open Leads', value: summary.openLeads },
        { label: 'Pipeline Value', value: `$${summary.pipelineValue.toLocaleString()}` },
      ],
    },
    {
      title: 'Revenue Report',
      icon: Receipt,
      color: 'text-emerald-700',
      bg: 'bg-emerald-50',
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

  return (
    <div className="flex-1 flex flex-col">
      <Header title="Reports" subtitle="Operational summaries & exports" />
      <div className="flex-1 p-6 space-y-6 overflow-y-auto">
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-navy-400 text-sm">Generating report...</div>
        ) : (
          <>
            {/* Report Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sections.map(section => (
                <div key={section.title} className="card p-5">
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className={`w-8 h-8 rounded-lg ${section.bg} flex items-center justify-center`}>
                      <section.icon size={16} className={section.color} />
                    </div>
                    <h3 className="text-sm font-semibold text-navy-900">{section.title}</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {section.metrics.map(m => (
                      <div key={m.label} className="bg-surface-50 rounded-lg p-3">
                        <div className="text-xl font-bold text-navy-900">{m.value}</div>
                        <div className="text-xs text-navy-400 mt-0.5">{m.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Data Exports */}
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Download size={15} className="text-navy-600" />
                <h3 className="text-sm font-semibold text-navy-900">Export Data</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {exports.map(exp => (
                  <button
                    key={exp.type}
                    onClick={() => exportCSV(exp.type)}
                    disabled={generatingExport}
                    className="flex items-center gap-2.5 px-4 py-3 rounded-lg border border-surface-300 hover:border-navy-400 hover:bg-navy-50 transition-all text-sm text-navy-700 font-medium"
                  >
                    <exp.icon size={15} className="text-navy-500" />
                    <span className="text-xs">{exp.label}</span>
                    <Download size={12} className="text-navy-400 ml-auto" />
                  </button>
                ))}
              </div>
              <p className="text-2xs text-navy-400 mt-3">CSV format — compatible with Excel and Google Sheets</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
