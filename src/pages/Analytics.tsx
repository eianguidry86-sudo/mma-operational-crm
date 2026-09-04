import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import Header from '../components/layout/Header';
import { TrendingUp, Users, DollarSign, BarChart3, Target, Activity } from 'lucide-react';

interface AnalyticsData {
  totalClients: number;
  totalRevenue: number;
  avgDealSize: number;
  winRate: number;
  activeProjects: number;
  avgProjectDays: number;
  revenueByService: { service: string; amount: number }[];
  revenueByClient: { client: string; amount: number }[];
  leadsBySource: { source: string; count: number }[];
  clientsByIndustry: { industry: string; count: number }[];
  monthlyRevenue: { month: string; amount: number }[];
  projectsByStatus: { status: string; count: number }[];
}

export default function Analytics() {
  const [data, setData] = useState<AnalyticsData>({
    totalClients: 0, totalRevenue: 0, avgDealSize: 0, winRate: 0,
    activeProjects: 0, avgProjectDays: 0,
    revenueByService: [], revenueByClient: [], leadsBySource: [],
    clientsByIndustry: [], monthlyRevenue: [], projectsByStatus: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadAnalytics(); }, []);

  async function loadAnalytics() {
    setLoading(true);
    try {
      const [
        { data: clients },
        { data: invoices },
        { data: leads },
        { data: projects },
      ] = await Promise.all([
        supabase.from('clients').select('id, business_name, industry, created_at, status'),
        supabase.from('invoices').select('amount, status, payment_date, client_id, project_id, clients(business_name), projects(service_type)'),
        supabase.from('leads').select('stage, lead_source, estimated_deal_value'),
        supabase.from('projects').select('status, start_date, delivery_date, service_type'),
      ]);

      const paid = (invoices ?? []).filter(i => i.status === 'Paid');
      const totalRevenue = paid.reduce((s, i) => s + i.amount, 0);

      // Revenue by service
      const serviceMap: Record<string, number> = {};
      paid.forEach(i => {
        const svc = (i as any).projects?.service_type ?? 'Other';
        serviceMap[svc] = (serviceMap[svc] ?? 0) + i.amount;
      });
      const revenueByService = Object.entries(serviceMap)
        .map(([service, amount]) => ({ service, amount }))
        .sort((a, b) => b.amount - a.amount).slice(0, 6);

      // Revenue by client
      const clientMap: Record<string, number> = {};
      paid.forEach(i => {
        const cl = (i as any).clients?.business_name ?? 'Unknown';
        clientMap[cl] = (clientMap[cl] ?? 0) + i.amount;
      });
      const revenueByClient = Object.entries(clientMap)
        .map(([client, amount]) => ({ client, amount }))
        .sort((a, b) => b.amount - a.amount).slice(0, 8);

      // Leads by source
      const sourceMap: Record<string, number> = {};
      (leads ?? []).forEach(l => { const s = l.lead_source ?? 'Unknown'; sourceMap[s] = (sourceMap[s] ?? 0) + 1; });
      const leadsBySource = Object.entries(sourceMap).map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count);

      // Clients by industry
      const indMap: Record<string, number> = {};
      (clients ?? []).forEach(c => { const i = c.industry ?? 'Unknown'; indMap[i] = (indMap[i] ?? 0) + 1; });
      const clientsByIndustry = Object.entries(indMap).map(([industry, count]) => ({ industry, count })).sort((a, b) => b.count - a.count);

      // Win rate
      const closedLeads = (leads ?? []).filter(l => ['Project Created', 'Client Onboarding', 'Proposal Lost', 'No Response', 'Not a Fit'].includes(l.stage));
      const wonLeads = closedLeads.filter(l => ['Project Created', 'Client Onboarding'].includes(l.stage));
      const winRate = closedLeads.length > 0 ? (wonLeads.length / closedLeads.length) * 100 : 0;

      // Avg deal size
      const wonValues = (leads ?? []).filter(l => l.estimated_deal_value && ['Project Created', 'Client Onboarding', 'Agreement Signed'].includes(l.stage));
      const avgDealSize = wonValues.length > 0 ? wonValues.reduce((s, l) => s + (l.estimated_deal_value ?? 0), 0) / wonValues.length : 0;

      // Monthly revenue (last 6 months)
      const monthlyMap: Record<string, number> = {};
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        monthlyMap[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`] = 0;
      }
      paid.forEach(i => {
        if (!i.payment_date) return;
        const key = i.payment_date.substring(0, 7);
        if (key in monthlyMap) monthlyMap[key] = (monthlyMap[key] ?? 0) + i.amount;
      });
      const monthlyRevenue = Object.entries(monthlyMap).map(([month, amount]) => ({ month, amount }));

      // Projects by status
      const statusMap: Record<string, number> = {};
      (projects ?? []).forEach(p => { statusMap[p.status] = (statusMap[p.status] ?? 0) + 1; });
      const projectsByStatus = Object.entries(statusMap).map(([status, count]) => ({ status, count }));

      // Active projects
      const activeProjects = (projects ?? []).filter(p => !['Completed', 'On Hold'].includes(p.status)).length;

      setData({
        totalClients: (clients ?? []).filter(c => c.status === 'Active').length,
        totalRevenue, avgDealSize, winRate,
        activeProjects, avgProjectDays: 0,
        revenueByService, revenueByClient, leadsBySource,
        clientsByIndustry, monthlyRevenue, projectsByStatus,
      });
    } catch (err) {
      console.error('Analytics load error:', err);
    } finally {
      setLoading(false);
    }
  }

  const maxRevByService = Math.max(...data.revenueByService.map(r => r.amount), 1);
  const maxRevByClient = Math.max(...data.revenueByClient.map(r => r.amount), 1);
  const maxBySource = Math.max(...data.leadsBySource.map(r => r.count), 1);
  const maxMonthly = Math.max(...data.monthlyRevenue.map(r => r.amount), 1);

  const fmtMonth = (m: string) => {
    const [y, mo] = m.split('-');
    return new Date(+y, +mo - 1).toLocaleString('default', { month: 'short' });
  };

  return (
    <div className="flex-1 flex flex-col">
      <Header title="Analytics" subtitle="Business intelligence & insights" />
      <div className="flex-1 p-6 space-y-6 overflow-y-auto">
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-navy-400 text-sm">Loading analytics...</div>
        ) : (
          <>
            {/* KPI row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Active Clients', value: data.totalClients, icon: Users, color: 'text-navy-700', bg: 'bg-navy-50' },
                { label: 'Total Revenue', value: `$${data.totalRevenue.toLocaleString()}`, icon: DollarSign, color: 'text-emerald-700', bg: 'bg-emerald-50' },
                { label: 'Avg Deal Size', value: `$${Math.round(data.avgDealSize).toLocaleString()}`, icon: Target, color: 'text-blue-700', bg: 'bg-blue-50' },
                { label: 'Win Rate', value: `${data.winRate.toFixed(0)}%`, icon: TrendingUp, color: 'text-orange-700', bg: 'bg-orange-50' },
              ].map(card => (
                <div key={card.label} className="card p-5">
                  <div className={`w-9 h-9 rounded-xl ${card.bg} flex items-center justify-center mb-3`}>
                    <card.icon size={18} className={card.color} />
                  </div>
                  <div className="text-2xl font-bold text-navy-900">{card.value}</div>
                  <div className="text-xs text-navy-400 mt-0.5">{card.label}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Monthly Revenue Chart */}
              <div className="card p-5">
                <div className="flex items-center gap-2 mb-5">
                  <Activity size={15} className="text-navy-600" />
                  <h3 className="text-sm font-semibold text-navy-900">Monthly Revenue (Last 6 Months)</h3>
                </div>
                <div className="flex items-end gap-2 h-32">
                  {data.monthlyRevenue.map(({ month, amount }) => (
                    <div key={month} className="flex-1 flex flex-col items-center gap-1">
                      <div className="text-2xs text-navy-400 font-medium">${amount > 0 ? (amount / 1000).toFixed(0) + 'k' : '0'}</div>
                      <div
                        className="w-full bg-navy-700 rounded-t-md transition-all min-h-[4px]"
                        style={{ height: `${Math.max(4, (amount / maxMonthly) * 100)}px` }}
                      />
                      <div className="text-2xs text-navy-400">{fmtMonth(month)}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Revenue by Service */}
              <div className="card p-5">
                <div className="flex items-center gap-2 mb-5">
                  <BarChart3 size={15} className="text-navy-600" />
                  <h3 className="text-sm font-semibold text-navy-900">Revenue by Service Type</h3>
                </div>
                <div className="space-y-3">
                  {data.revenueByService.length === 0 ? (
                    <div className="text-center py-4 text-navy-400 text-sm">No data yet</div>
                  ) : data.revenueByService.map(({ service, amount }) => (
                    <div key={service}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-navy-600 truncate flex-1 pr-2">{service}</span>
                        <span className="text-xs font-bold text-navy-800">${amount.toLocaleString()}</span>
                      </div>
                      <div className="h-1.5 bg-surface-200 rounded-full overflow-hidden">
                        <div className="h-full bg-crimson-600 rounded-full" style={{ width: `${(amount / maxRevByService) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Revenue by Client */}
              <div className="card p-5">
                <div className="flex items-center gap-2 mb-5">
                  <Users size={15} className="text-navy-600" />
                  <h3 className="text-sm font-semibold text-navy-900">Revenue by Client</h3>
                </div>
                <div className="space-y-3">
                  {data.revenueByClient.length === 0 ? (
                    <div className="text-center py-4 text-navy-400 text-sm">No data yet</div>
                  ) : data.revenueByClient.map(({ client, amount }) => (
                    <div key={client}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-navy-600 truncate flex-1 pr-2">{client}</span>
                        <span className="text-xs font-bold text-navy-800">${amount.toLocaleString()}</span>
                      </div>
                      <div className="h-1.5 bg-surface-200 rounded-full overflow-hidden">
                        <div className="h-full bg-navy-600 rounded-full" style={{ width: `${(amount / maxRevByClient) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Lead Source Performance */}
              <div className="card p-5">
                <div className="flex items-center gap-2 mb-5">
                  <Target size={15} className="text-navy-600" />
                  <h3 className="text-sm font-semibold text-navy-900">Lead Source Performance</h3>
                </div>
                <div className="space-y-3">
                  {data.leadsBySource.length === 0 ? (
                    <div className="text-center py-4 text-navy-400 text-sm">No data yet</div>
                  ) : data.leadsBySource.map(({ source, count }) => (
                    <div key={source}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-navy-600">{source}</span>
                        <span className="text-xs font-bold text-navy-800">{count} leads</span>
                      </div>
                      <div className="h-1.5 bg-surface-200 rounded-full overflow-hidden">
                        <div className="h-full bg-orange-500 rounded-full" style={{ width: `${(count / maxBySource) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Client Distribution */}
            {data.clientsByIndustry.length > 0 && (
              <div className="card p-5">
                <div className="flex items-center gap-2 mb-5">
                  <BarChart3 size={15} className="text-navy-600" />
                  <h3 className="text-sm font-semibold text-navy-900">Client Distribution by Industry</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {data.clientsByIndustry.map(({ industry, count }) => (
                    <div key={industry} className="flex items-center gap-2 bg-surface-50 border border-surface-200 rounded-lg px-3 py-2">
                      <span className="text-xs text-navy-600">{industry}</span>
                      <span className="text-xs font-bold text-navy-800 bg-navy-100 px-1.5 py-0.5 rounded-full">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
