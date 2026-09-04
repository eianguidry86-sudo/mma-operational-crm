import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import Header from '../components/layout/Header';
import {
  Building2, FolderKanban, Users, DollarSign, Receipt, CheckSquare,
  AlertCircle, Clock, ArrowRight, TrendingUp, Activity
} from 'lucide-react';
import Badge, { getProjectStatusBadge, getLeadStageBadge } from '../components/ui/Badge';

interface DashboardStats {
  activeClients: number;
  activeProjects: number;
  openLeads: number;
  monthlyRevenue: number;
  outstandingInvoices: number;
  tasksDueToday: number;
}

interface PriorityItem {
  id: string;
  label: string;
  type: string;
  detail?: string;
}

interface RecentActivity {
  id: string;
  action: string;
  entity_name: string | null;
  entity_type: string | null;
  created_at: string;
}

export default function Dashboard({ onNavigate }: { onNavigate: (page: string) => void }) {
  const [stats, setStats] = useState<DashboardStats>({
    activeClients: 0, activeProjects: 0, openLeads: 0,
    monthlyRevenue: 0, outstandingInvoices: 0, tasksDueToday: 0,
  });
  const [priorityItems, setPriorityItems] = useState<PriorityItem[]>([]);
  const [pipelineSnapshot, setPipelineSnapshot] = useState<Record<string, number>>({});
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [billingSnapshot, setBillingSnapshot] = useState({
    outstanding: 0, upcoming: 0, thisMonth: 0, ytd: 0,
  });
  const [projectsByStage, setProjectsByStage] = useState<{ status: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
      const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];

      const [
        { count: activeClients },
        { count: activeProjects },
        { count: openLeads },
        { data: invoiceData },
        { data: taskData },
        { data: activityData },
        { data: leadsData },
        { data: projectsData },
      ] = await Promise.all([
        supabase.from('clients').select('*', { count: 'exact', head: true }).eq('status', 'Active'),
        supabase.from('projects').select('*', { count: 'exact', head: true }).not('status', 'in', '("Completed","On Hold")'),
        supabase.from('leads').select('*', { count: 'exact', head: true }).not('stage', 'in', '("Proposal Lost","No Response","Not a Fit","Future Opportunity","Project Created")'),
        supabase.from('invoices').select('amount, status, due_date, payment_date'),
        supabase.from('tasks').select('id, title, due_date, priority, status, clients(business_name), projects(project_name)').neq('status', 'Completed').neq('status', 'Cancelled').lte('due_date', today).not('due_date', 'is', null),
        supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(8),
        supabase.from('leads').select('stage').not('stage', 'in', '("Proposal Lost","No Response","Not a Fit","Project Created")'),
        supabase.from('projects').select('status').not('status', 'eq', 'Completed'),
      ]);

      // billing calcs
      const allInvoices = invoiceData ?? [];
      const outstanding = allInvoices.filter(i => ['Sent', 'Overdue'].includes(i.status)).reduce((s, i) => s + (i.amount ?? 0), 0);
      const upcoming = allInvoices.filter(i => i.status === 'Draft').reduce((s, i) => s + (i.amount ?? 0), 0);
      const thisMonth = allInvoices.filter(i => i.status === 'Paid' && i.payment_date >= monthStart).reduce((s, i) => s + (i.amount ?? 0), 0);
      const ytd = allInvoices.filter(i => i.status === 'Paid' && i.payment_date >= yearStart).reduce((s, i) => s + (i.amount ?? 0), 0);

      setBillingSnapshot({ outstanding, upcoming, thisMonth, ytd });

      // pipeline snapshot
      const stageCounts: Record<string, number> = {};
      (leadsData ?? []).forEach(l => { stageCounts[l.stage] = (stageCounts[l.stage] ?? 0) + 1; });
      setPipelineSnapshot(stageCounts);

      // projects by stage
      const stageCt: Record<string, number> = {};
      (projectsData ?? []).forEach(p => { stageCt[p.status] = (stageCt[p.status] ?? 0) + 1; });
      setProjectsByStage(Object.entries(stageCt).map(([status, count]) => ({ status, count })));

      // priority items
      const priority: PriorityItem[] = [];
      (taskData ?? []).forEach(t => {
        priority.push({ id: t.id, label: t.title, type: 'Overdue Task', detail: (t as any).clients?.business_name });
      });

      // waiting on blockers
      const { data: blocked } = await supabase.from('projects').select('id, project_name, waiting_on, clients(business_name)').not('waiting_on', 'is', null).not('status', 'in', '("Completed","On Hold")');
      (blocked ?? []).forEach(p => {
        priority.push({ id: p.id, label: p.project_name, type: p.waiting_on, detail: (p as any).clients?.business_name });
      });

      setPriorityItems(priority.slice(0, 10));

      setStats({
        activeClients: activeClients ?? 0,
        activeProjects: activeProjects ?? 0,
        openLeads: openLeads ?? 0,
        monthlyRevenue: thisMonth,
        outstandingInvoices: outstanding,
        tasksDueToday: taskData?.length ?? 0,
      });

      setRecentActivity(activityData ?? []);
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  }

  const kpiCards = [
    { label: 'Active Clients', value: stats.activeClients, icon: Building2, color: 'text-navy-700', bg: 'bg-navy-50', page: 'clients' },
    { label: 'Active Projects', value: stats.activeProjects, icon: FolderKanban, color: 'text-blue-700', bg: 'bg-blue-50', page: 'projects' },
    { label: 'Open Leads', value: stats.openLeads, icon: Users, color: 'text-orange-600', bg: 'bg-orange-50', page: 'leads' },
    { label: 'Revenue This Month', value: `$${stats.monthlyRevenue.toLocaleString()}`, icon: DollarSign, color: 'text-emerald-700', bg: 'bg-emerald-50', page: 'billing' },
    { label: 'Outstanding Invoices', value: `$${stats.outstandingInvoices.toLocaleString()}`, icon: Receipt, color: 'text-crimson-600', bg: 'bg-crimson-50', page: 'billing' },
    { label: 'Tasks Due Today', value: stats.tasksDueToday, icon: CheckSquare, color: 'text-amber-700', bg: 'bg-amber-50', page: 'tasks' },
  ];

  const pipelineOrder = [
    'New Lead', 'Contacted', 'Discovery Scheduled', 'Discovery Complete',
    'Proposal Drafting', 'Proposal Sent', 'Negotiation', 'Verbal Agreement', 'Agreement Signed',
  ];

  const fmt = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toLocaleString()}`;
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
      <Header title="Dashboard" subtitle="Command Center" />
      <div className="flex-1 p-6 space-y-6 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-navy-400 text-sm">Loading dashboard...</div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {kpiCards.map(card => (
                <button
                  key={card.label}
                  onClick={() => onNavigate(card.page)}
                  className="card p-4 text-left hover:shadow-card-hover transition-all duration-200 group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className={`w-8 h-8 rounded-lg ${card.bg} flex items-center justify-center`}>
                      <card.icon size={16} className={card.color} />
                    </div>
                    <ArrowRight size={12} className="text-surface-400 group-hover:text-navy-500 transition-colors mt-1" />
                  </div>
                  <div className="text-2xl font-bold text-navy-900 leading-none mb-1">{card.value}</div>
                  <div className="text-xs text-navy-400 font-medium">{card.label}</div>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Priority Center */}
              <div className="xl:col-span-2 card">
                <div className="px-5 py-4 border-b border-surface-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle size={15} className="text-crimson-600" />
                    <h2 className="text-sm font-semibold text-navy-900">Priority Center</h2>
                  </div>
                  <span className="text-xs text-navy-400">{priorityItems.length} items</span>
                </div>
                <div className="divide-y divide-surface-100">
                  {priorityItems.length === 0 ? (
                    <div className="px-5 py-8 text-center text-navy-400 text-sm">All clear — no urgent items</div>
                  ) : (
                    priorityItems.map(item => (
                      <div key={item.id} className="px-5 py-3 flex items-center gap-3 hover:bg-surface-50 transition-colors">
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                          item.type.includes('Overdue') ? 'bg-crimson-500' :
                          item.type.includes('Payment') ? 'bg-amber-500' :
                          item.type.includes('Client Data') ? 'bg-orange-500' : 'bg-blue-500'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-navy-800 truncate">{item.label}</div>
                          {item.detail && <div className="text-xs text-navy-400 truncate">{item.detail}</div>}
                        </div>
                        <span className="text-xs text-navy-400 whitespace-nowrap bg-surface-100 px-2 py-0.5 rounded-full">{item.type}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Billing Snapshot */}
              <div className="card">
                <div className="px-5 py-4 border-b border-surface-200 flex items-center gap-2">
                  <DollarSign size={15} className="text-emerald-600" />
                  <h2 className="text-sm font-semibold text-navy-900">Billing Snapshot</h2>
                </div>
                <div className="p-5 space-y-4">
                  {[
                    { label: 'Outstanding', value: billingSnapshot.outstanding, color: 'text-crimson-600' },
                    { label: 'Upcoming (Draft)', value: billingSnapshot.upcoming, color: 'text-amber-600' },
                    { label: 'Revenue This Month', value: billingSnapshot.thisMonth, color: 'text-emerald-600' },
                    { label: 'Revenue YTD', value: billingSnapshot.ytd, color: 'text-navy-700' },
                  ].map(item => (
                    <div key={item.label} className="flex items-center justify-between">
                      <span className="text-xs text-navy-400 font-medium">{item.label}</span>
                      <span className={`text-sm font-bold ${item.color}`}>{fmt(item.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Lead Pipeline Snapshot */}
              <div className="card">
                <div className="px-5 py-4 border-b border-surface-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp size={15} className="text-navy-600" />
                    <h2 className="text-sm font-semibold text-navy-900">Lead Pipeline</h2>
                  </div>
                  <button onClick={() => onNavigate('leads')} className="text-xs text-navy-500 hover:text-navy-800 transition-colors">View all</button>
                </div>
                <div className="p-4 space-y-2">
                  {pipelineOrder.filter(s => pipelineSnapshot[s]).map(stage => (
                    <div key={stage} className="flex items-center justify-between">
                      <span className="text-xs text-navy-600 truncate flex-1">{stage}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-surface-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-navy-600 rounded-full"
                            style={{ width: `${Math.min(100, ((pipelineSnapshot[stage] ?? 0) / Math.max(...Object.values(pipelineSnapshot))) * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-navy-800 w-4 text-right">{pipelineSnapshot[stage] ?? 0}</span>
                      </div>
                    </div>
                  ))}
                  {Object.keys(pipelineSnapshot).length === 0 && (
                    <div className="text-center py-4 text-navy-400 text-xs">No active leads</div>
                  )}
                </div>
              </div>

              {/* Projects by Stage */}
              <div className="card">
                <div className="px-5 py-4 border-b border-surface-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FolderKanban size={15} className="text-blue-600" />
                    <h2 className="text-sm font-semibold text-navy-900">Projects by Stage</h2>
                  </div>
                  <button onClick={() => onNavigate('projects')} className="text-xs text-navy-500 hover:text-navy-800 transition-colors">View all</button>
                </div>
                <div className="p-4 space-y-2">
                  {projectsByStage.map(({ status, count }) => {
                    const badge = getProjectStatusBadge(status);
                    return (
                      <div key={status} className="flex items-center justify-between gap-2">
                        <Badge label={status} variant={badge.variant} size="xs" />
                        <span className="text-xs font-semibold text-navy-800">{count}</span>
                      </div>
                    );
                  })}
                  {projectsByStage.length === 0 && (
                    <div className="text-center py-4 text-navy-400 text-xs">No active projects</div>
                  )}
                </div>
              </div>

              {/* Recent Activity */}
              <div className="card">
                <div className="px-5 py-4 border-b border-surface-200 flex items-center gap-2">
                  <Activity size={15} className="text-navy-500" />
                  <h2 className="text-sm font-semibold text-navy-900">Recent Activity</h2>
                </div>
                <div className="divide-y divide-surface-100">
                  {recentActivity.length === 0 ? (
                    <div className="px-5 py-8 text-center text-navy-400 text-xs">No recent activity</div>
                  ) : (
                    recentActivity.map(item => (
                      <div key={item.id} className="px-5 py-3 flex items-start gap-2.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-navy-400 mt-1.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-navy-700">{item.action}{item.entity_name && <span className="font-medium"> {item.entity_name}</span>}</div>
                          <div className="flex items-center gap-1 mt-0.5">
                            {item.entity_type && <span className="text-2xs text-navy-400">{item.entity_type}</span>}
                            <span className="text-2xs text-navy-300">• {timeAgo(item.created_at)}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
