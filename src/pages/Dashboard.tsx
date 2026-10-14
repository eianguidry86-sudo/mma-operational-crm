import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import TitleBand from '../components/ledger/TitleBand';
import { ArrowRight } from 'lucide-react';
import { getProjectStatusBadge } from '../components/ui/Badge';

interface DashboardStats {
  activeClients: number;
  newClientsThisQuarter: number;
  activeProjects: number;
  overdueProjects: number;
  openLeads: number;
  newLeadsLast30: number;
  monthlyRevenue: number;
  monthlyRevenueDeltaPct: number | null;
  outstandingInvoices: number;
  pastDueInvoiceCount: number;
  tasksDueToday: number;
}

interface PriorityItem {
  id: string;
  tag: string;
  label: string;
  detail?: string;
  dueText?: string;
  urgent: boolean;
}

interface RecentActivity {
  id: string;
  action: string;
  entity_name: string | null;
  entity_type: string | null;
  created_at: string;
}

const PIPELINE_ORDER = [
  'New Lead', 'Contacted', 'Discovery Scheduled', 'Discovery Complete',
  'Proposal Drafting', 'Proposal Sent', 'Negotiation', 'Verbal Agreement', 'Agreement Signed',
];

const fmt = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${Math.round(n).toLocaleString()}`;
const fmtFull = (n: number) => `$${Math.round(n).toLocaleString()}`;

const timeAgo = (ts: string) => {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

export default function Dashboard({ onNavigate }: { onNavigate: (page: string) => void }) {
  const [stats, setStats] = useState<DashboardStats>({
    activeClients: 0, newClientsThisQuarter: 0, activeProjects: 0, overdueProjects: 0,
    openLeads: 0, newLeadsLast30: 0, monthlyRevenue: 0, monthlyRevenueDeltaPct: null,
    outstandingInvoices: 0, pastDueInvoiceCount: 0, tasksDueToday: 0,
  });
  const [priorityItems, setPriorityItems] = useState<PriorityItem[]>([]);
  const [pipelineByValue, setPipelineByValue] = useState<Record<string, number>>({});
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [receivables, setReceivables] = useState({ pastDue: 0, dueSoon: 0, current: 0 });
  const [projectsByStage, setProjectsByStage] = useState<{ status: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);
    try {
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
      const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1).toISOString().split('T')[0];
      const last30 = new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0];
      const in14 = new Date(now.getTime() + 14 * 86400000).toISOString().split('T')[0];

      const [
        { count: activeClients },
        { count: newClientsThisQuarter },
        { count: activeProjects },
        { count: overdueProjects },
        { count: openLeads },
        { count: newLeadsLast30 },
        { data: invoiceData },
        { data: taskData },
        { data: activityData },
        { data: leadsData },
        { data: projectsData },
        { data: blocked },
      ] = await Promise.all([
        supabase.from('clients').select('*', { count: 'exact', head: true }).eq('status', 'Active'),
        supabase.from('clients').select('*', { count: 'exact', head: true }).gte('created_at', quarterStart),
        supabase.from('projects').select('*', { count: 'exact', head: true }).not('status', 'in', '("Completed","On Hold")'),
        supabase.from('projects').select('*', { count: 'exact', head: true }).lt('due_date', today).not('status', 'in', '("Completed","On Hold")'),
        supabase.from('leads').select('*', { count: 'exact', head: true }).not('stage', 'in', '("Proposal Lost","No Response","Not a Fit","Future Opportunity","Project Created")'),
        supabase.from('leads').select('*', { count: 'exact', head: true }).gte('created_at', last30),
        supabase.from('invoices').select('amount, status, due_date, payment_date'),
        supabase.from('tasks').select('id, title, due_date, priority, status, clients(business_name), projects(project_name)').neq('status', 'Completed').neq('status', 'Cancelled').lte('due_date', today).not('due_date', 'is', null),
        supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(8),
        supabase.from('leads').select('stage, estimated_deal_value').not('stage', 'in', '("Proposal Lost","No Response","Not a Fit","Project Created")'),
        supabase.from('projects').select('status').not('status', 'eq', 'Completed'),
        supabase.from('projects').select('id, project_name, due_date, waiting_on, clients(business_name)').not('waiting_on', 'is', null).not('status', 'in', '("Completed","On Hold")'),
      ]);

      // billing calcs
      const allInvoices = invoiceData ?? [];
      const outstanding = allInvoices.filter(i => ['Sent', 'Overdue'].includes(i.status)).reduce((s, i) => s + (i.amount ?? 0), 0);
      const thisMonth = allInvoices.filter(i => i.status === 'Paid' && i.payment_date >= monthStart).reduce((s, i) => s + (i.amount ?? 0), 0);
      const lastMonth = allInvoices.filter(i => i.status === 'Paid' && i.payment_date >= lastMonthStart && i.payment_date < monthStart).reduce((s, i) => s + (i.amount ?? 0), 0);
      const monthlyRevenueDeltaPct = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : null;

      const pastDueInvoices = allInvoices.filter(i => i.status === 'Overdue' || (i.status === 'Sent' && i.due_date && i.due_date < today));
      const pastDue = pastDueInvoices.reduce((s, i) => s + (i.amount ?? 0), 0);
      const dueSoon = allInvoices
        .filter(i => i.status === 'Sent' && i.due_date && i.due_date >= today && i.due_date <= in14)
        .reduce((s, i) => s + (i.amount ?? 0), 0);
      const current = Math.max(0, outstanding - pastDue - dueSoon);
      setReceivables({ pastDue, dueSoon, current });

      // pipeline by weighted $ value
      const stageValues: Record<string, number> = {};
      (leadsData ?? []).forEach(l => { stageValues[l.stage] = (stageValues[l.stage] ?? 0) + (l.estimated_deal_value ?? 0); });
      setPipelineByValue(stageValues);

      // projects by stage
      const stageCt: Record<string, number> = {};
      (projectsData ?? []).forEach(p => { stageCt[p.status] = (stageCt[p.status] ?? 0) + 1; });
      setProjectsByStage(Object.entries(stageCt).map(([status, count]) => ({ status, count })));

      // priority items: overdue tasks (urgent) + blocked projects (non-urgent, waiting on someone else)
      const priority: PriorityItem[] = [];
      (taskData ?? []).forEach(t => {
        priority.push({
          id: `task-${t.id}`,
          tag: 'TASK',
          label: t.title,
          detail: (t as any).clients?.business_name ?? (t as any).projects?.project_name,
          dueText: t.due_date ? `Due ${new Date(t.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : undefined,
          urgent: true,
        });
      });
      (blocked ?? []).forEach(p => {
        priority.push({
          id: `project-${p.id}`,
          tag: (p.waiting_on ?? '').replace(/^Waiting on /, '').toUpperCase() || 'BLOCKED',
          label: p.project_name,
          detail: (p as any).clients?.business_name,
          dueText: p.due_date ? `Due ${new Date(p.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : undefined,
          urgent: false,
        });
      });
      setPriorityItems(priority.slice(0, 10));

      setStats({
        activeClients: activeClients ?? 0,
        newClientsThisQuarter: newClientsThisQuarter ?? 0,
        activeProjects: activeProjects ?? 0,
        overdueProjects: overdueProjects ?? 0,
        openLeads: openLeads ?? 0,
        newLeadsLast30: newLeadsLast30 ?? 0,
        monthlyRevenue: thisMonth,
        monthlyRevenueDeltaPct,
        outstandingInvoices: outstanding,
        pastDueInvoiceCount: pastDueInvoices.length,
        tasksDueToday: taskData?.length ?? 0,
      });

      setRecentActivity(activityData ?? []);
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  }

  const totalPipelineValue = Object.values(pipelineByValue).reduce((s, v) => s + v, 0);
  const maxStageValue = Math.max(1, ...Object.values(pipelineByValue));
  const totalReceivables = receivables.pastDue + receivables.dueSoon + receivables.current;

  const metrics = [
    {
      label: 'Accounts', value: stats.activeClients.toString(),
      note: stats.newClientsThisQuarter > 0 ? `+${stats.newClientsThisQuarter} this qtr` : undefined, tone: 'green', page: 'clients',
    },
    {
      label: 'Open Leads', value: stats.openLeads.toString(),
      note: stats.newLeadsLast30 > 0 ? `+${stats.newLeadsLast30} last 30d` : undefined, tone: 'green', page: 'leads',
    },
    {
      label: 'In Delivery', value: stats.activeProjects.toString(),
      note: stats.overdueProjects > 0 ? `${stats.overdueProjects} overdue` : undefined, tone: 'crimson', page: 'projects',
    },
    {
      label: 'Revenue MTD', value: fmt(stats.monthlyRevenue),
      note: stats.monthlyRevenueDeltaPct !== null ? `${stats.monthlyRevenueDeltaPct >= 0 ? '+' : ''}${stats.monthlyRevenueDeltaPct.toFixed(0)}% vs last mo` : undefined,
      tone: stats.monthlyRevenueDeltaPct !== null && stats.monthlyRevenueDeltaPct < 0 ? 'crimson' : 'green', page: 'billing',
    },
    {
      label: 'Receivables', value: fmt(stats.outstandingInvoices),
      note: stats.pastDueInvoiceCount > 0 ? `${stats.pastDueInvoiceCount} past due` : undefined, tone: 'crimson', page: 'billing',
    },
    {
      label: 'Tasks Due', value: stats.tasksDueToday.toString(),
      note: stats.tasksDueToday > 0 ? 'today or overdue' : undefined, tone: 'default', page: 'tasks',
    },
  ] as const;

  const noteTone: Record<string, string> = {
    green: 'text-ledger-green', crimson: 'text-ledger-crimson', default: 'text-ledger-muted',
  };

  return (
    <>
      <TitleBand
        breadcrumb={`Workspace / ${new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })}`}
        title="Command"
        stats={[{ label: 'Revenue MTD', value: fmt(stats.monthlyRevenue) }]}
      />

      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-ledger-muted font-plexMono text-xs uppercase tracking-widest">
            Loading…
          </div>
        ) : (
          <>
            {/* Metric strip */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 bg-white border-b border-ledger-hairline">
              {metrics.map((m, i) => (
                <button
                  key={m.label}
                  onClick={() => onNavigate(m.page)}
                  className={`text-left px-5 py-5 border-ledger-hairline2 hover:bg-ledger-rowHover transition-colors ${
                    i % 3 !== 2 ? 'sm:border-r' : ''
                  } ${i !== metrics.length - 1 ? 'lg:border-r' : ''} ${i < 3 ? 'border-b lg:border-b-0' : ''}`}
                >
                  <div className="font-plexMono text-[9px] uppercase tracking-[0.14em] text-ledger-muted mb-2">{m.label}</div>
                  <div className="font-serifLedger text-[31px] leading-none text-ledger-navy mb-2 tabular-nums">{m.value}</div>
                  {m.note && (
                    <div className={`font-plexMono text-[10px] ${noteTone[m.tone as string]}`}>{m.note}</div>
                  )}
                </button>
              ))}
            </div>

            {/* Priority */}
            <div className="grid grid-cols-[168px_1fr] border-b border-ledger-hairline">
              <div className="px-5 py-5 border-r border-ledger-hairline2">
                <div className="font-plexMono text-[9px] uppercase tracking-[0.14em] text-ledger-soft mb-2">Priority</div>
                <p className="font-plexSans text-[11px] text-ledger-faint leading-snug mb-2">
                  Items blocking revenue or delivery today.
                </p>
                {priorityItems.some(p => p.urgent) && (
                  <div className="font-plexMono text-[10px] text-ledger-crimson uppercase tracking-[0.1em]">
                    {priorityItems.filter(p => p.urgent).length} overdue
                  </div>
                )}
              </div>
              <div>
                {priorityItems.length === 0 ? (
                  <div className="py-16 text-center font-plexMono text-[10px] uppercase tracking-[0.14em] text-ledger-muted">
                    All clear — nothing blocking right now
                  </div>
                ) : (
                  priorityItems.map(item => (
                    <div
                      key={item.id}
                      className={`flex items-center gap-4 pl-4 pr-6 py-3 border-b border-ledger-hairline2 last:border-b-0 hover:bg-ledger-rowHover transition-colors ${
                        item.urgent ? 'border-l-[3px] border-l-ledger-crimson bg-white' : 'border-l-[3px] border-l-transparent'
                      }`}
                    >
                      <span className="w-[110px] flex-shrink-0 font-plexMono text-[9px] uppercase tracking-[0.1em] text-ledger-muted">
                        {item.tag}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-plexSans text-[13px] font-medium text-ledger-navy truncate">{item.label}</div>
                        {item.detail && <div className="font-plexSans text-[11px] text-ledger-faint truncate">{item.detail}</div>}
                      </div>
                      {item.dueText && (
                        <span className={`font-plexMono text-[10px] whitespace-nowrap ${item.urgent ? 'text-ledger-crimson' : 'text-ledger-faint'}`}>
                          {item.dueText}
                        </span>
                      )}
                      <ArrowRight size={12} className="text-ledger-muted flex-shrink-0" />
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Pipeline */}
            <div className="grid grid-cols-[168px_1fr] border-b border-ledger-hairline">
              <div className="px-5 py-5 border-r border-ledger-hairline2">
                <div className="font-plexMono text-[9px] uppercase tracking-[0.14em] text-ledger-soft mb-2">Pipeline</div>
                <div className="font-serifLedger text-[26px] leading-none text-ledger-navy tabular-nums">{fmt(totalPipelineValue)}</div>
                <p className="font-plexSans text-[11px] text-ledger-faint leading-snug mt-1">Total weighted value, open leads</p>
              </div>
              <div className="px-6 py-5 space-y-2.5">
                {PIPELINE_ORDER.filter(s => pipelineByValue[s]).map(stage => (
                  <div key={stage} className="flex items-center gap-3">
                    <span className="w-[150px] flex-shrink-0 font-plexMono text-[10px] uppercase tracking-[0.06em] text-ledger-soft truncate">
                      {stage}
                    </span>
                    <div className="flex-1 h-[7px] bg-ledger-zebra">
                      <div
                        className="h-full bg-ledger-navy"
                        style={{ width: `${Math.min(100, ((pipelineByValue[stage] ?? 0) / maxStageValue) * 100)}%` }}
                      />
                    </div>
                    <span className="w-16 flex-shrink-0 text-right font-plexMono text-[11px] font-medium text-ledger-navy tabular-nums">
                      {fmt(pipelineByValue[stage] ?? 0)}
                    </span>
                  </div>
                ))}
                {Object.keys(pipelineByValue).length === 0 && (
                  <div className="py-6 text-center font-plexMono text-[10px] uppercase tracking-[0.14em] text-ledger-muted">
                    No active leads
                  </div>
                )}
              </div>
            </div>

            {/* Ledger section: receivables / delivery by stage / activity */}
            <div className="grid grid-cols-1 lg:grid-cols-3">
              {/* Receivables */}
              <div className="border-b lg:border-b-0 lg:border-r border-ledger-hairline2">
                <div className="px-5 py-3 border-b border-ledger-hairline2">
                  <span className="font-plexMono text-[9px] uppercase tracking-[0.14em] text-ledger-soft">Receivables</span>
                </div>
                <div className="px-5 py-4">
                  {totalReceivables > 0 ? (
                    <div className="flex h-[6px] mb-4 overflow-hidden">
                      <div className="bg-ledger-crimson h-full" style={{ width: `${(receivables.pastDue / totalReceivables) * 100}%` }} />
                      <div className="bg-ledger-amber h-full" style={{ width: `${(receivables.dueSoon / totalReceivables) * 100}%` }} />
                      <div className="bg-ledger-blue h-full" style={{ width: `${(receivables.current / totalReceivables) * 100}%` }} />
                    </div>
                  ) : (
                    <div className="h-[6px] bg-ledger-zebra mb-4" />
                  )}
                  <div className="space-y-2.5">
                    {[
                      { label: 'Past due', value: receivables.pastDue, color: 'text-ledger-crimson' },
                      { label: 'Due soon (14d)', value: receivables.dueSoon, color: 'text-ledger-amber' },
                      { label: 'Current', value: receivables.current, color: 'text-ledger-blue' },
                    ].map(row => (
                      <div key={row.label} className="flex items-baseline gap-2">
                        <span className="font-plexMono text-[10px] uppercase tracking-[0.06em] text-ledger-faint whitespace-nowrap">{row.label}</span>
                        <span className="flex-1 border-b border-dotted border-ledger-hairline translate-y-[-3px]" />
                        <span className={`font-plexMono text-[11px] font-medium tabular-nums ${row.color}`}>{fmtFull(row.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Delivery by stage */}
              <div className="border-b lg:border-b-0 lg:border-r border-ledger-hairline2">
                <div className="px-5 py-3 border-b border-ledger-hairline2 flex items-center justify-between">
                  <span className="font-plexMono text-[9px] uppercase tracking-[0.14em] text-ledger-soft">Delivery by stage</span>
                  <button onClick={() => onNavigate('projects')} className="font-plexMono text-[9px] uppercase tracking-[0.1em] text-ledger-faint hover:text-ledger-navy transition-colors">
                    View all
                  </button>
                </div>
                <div className="px-5 py-4 space-y-2.5">
                  {projectsByStage.map(({ status, count }) => {
                    const badge = getProjectStatusBadge(status);
                    const dotColor: Record<string, string> = {
                      green: 'bg-ledger-green', crimson: 'bg-ledger-crimson', blue: 'bg-ledger-blue',
                      yellow: 'bg-ledger-amber', orange: 'bg-ledger-amber', navy: 'bg-ledger-navy', gray: 'bg-ledger-muted',
                    };
                    return (
                      <div key={status} className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor[badge.variant as string] ?? 'bg-ledger-muted'}`} />
                        <span className="flex-1 font-plexSans text-[11px] text-ledger-body truncate">{status}</span>
                        <span className="font-plexMono text-[11px] font-medium text-ledger-navy tabular-nums">{count}</span>
                      </div>
                    );
                  })}
                  {projectsByStage.length === 0 && (
                    <div className="py-6 text-center font-plexMono text-[10px] uppercase tracking-[0.14em] text-ledger-muted">
                      No active projects
                    </div>
                  )}
                </div>
              </div>

              {/* Activity feed */}
              <div>
                <div className="px-5 py-3 border-b border-ledger-hairline2">
                  <span className="font-plexMono text-[9px] uppercase tracking-[0.14em] text-ledger-soft">Activity</span>
                </div>
                <div>
                  {recentActivity.length === 0 ? (
                    <div className="py-8 text-center font-plexMono text-[10px] uppercase tracking-[0.14em] text-ledger-muted">
                      No recent activity
                    </div>
                  ) : (
                    recentActivity.map(item => (
                      <div key={item.id} className="px-5 py-2.5 border-b border-ledger-hairline2 last:border-b-0">
                        <div className="font-plexSans text-[11px] text-ledger-body leading-snug">
                          {item.action}
                          {item.entity_name && <span className="font-medium"> {item.entity_name}</span>}
                        </div>
                        <div className="font-plexMono text-[9px] text-ledger-muted mt-0.5">
                          {item.entity_type && `${item.entity_type} · `}{timeAgo(item.created_at)}
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
    </>
  );
}
