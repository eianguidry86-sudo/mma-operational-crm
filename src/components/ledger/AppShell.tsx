import { useEffect, useState } from 'react';
import { Bell, LogOut, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

export type LedgerPage =
  | 'dashboard' | 'leads' | 'market' | 'clients' | 'projects' | 'tasks'
  | 'billing' | 'data-requests' | 'reports' | 'analytics' | 'documents' | 'settings' | 'projections';

interface NavItem {
  id: LedgerPage;
  label: string;
}

// The Ledger mockup only specced 7 tabs (Overview/Leads/Accounts/Delivery/Tasks/Billing/Reports).
// The live app also has Data Requests, Analytics, Documents and Projections, which the mockup
// doesn't cover yet — folded in here as extra command-bar tabs rather than dropped. Settings
// lives behind the user chip instead of taking a tab. Revisit this grouping once Client Detail
// gets its Ledger pass, since some of these may move into per-client tabs there instead.
const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Overview' },
  { id: 'leads', label: 'Leads' },
  { id: 'market', label: 'Market Intel' },
  { id: 'clients', label: 'Accounts' },
  { id: 'projects', label: 'Delivery' },
  { id: 'data-requests', label: 'Data' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'documents', label: 'Documents' },
  { id: 'projections', label: 'Projections' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'billing', label: 'Billing' },
  { id: 'reports', label: 'Reports' },
];

interface NavCounts {
  leads: number | null;
  clients: number | null;
  projects: number | null;
  tasks: number | null;
  billing: number | null;
}

async function loadNavCounts(): Promise<NavCounts> {
  const [
    { count: leads },
    { count: clients },
    { count: projects },
    { count: tasks },
    { count: billing },
  ] = await Promise.all([
    supabase.from('leads').select('*', { count: 'exact', head: true })
      .not('stage', 'in', '("Proposal Lost","No Response","Not a Fit","Future Opportunity","Project Created")'),
    supabase.from('clients').select('*', { count: 'exact', head: true }).eq('status', 'Active'),
    supabase.from('projects').select('*', { count: 'exact', head: true })
      .not('status', 'in', '("Completed","On Hold")'),
    supabase.from('tasks').select('*', { count: 'exact', head: true })
      .not('status', 'in', '("Completed","Cancelled")'),
    supabase.from('invoices').select('*', { count: 'exact', head: true })
      .not('status', 'in', '("Paid","Cancelled")'),
  ]);
  return { leads, clients, projects, tasks, billing };
}

function badgeFor(id: LedgerPage, counts: NavCounts): number | null {
  switch (id) {
    case 'leads': return counts.leads;
    case 'clients': return counts.clients;
    case 'projects': return counts.projects;
    case 'tasks': return counts.tasks;
    case 'billing': return counts.billing;
    default: return null;
  }
}

interface AppShellProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  children: React.ReactNode;
}

export default function AppShell({ currentPage, onNavigate, children }: AppShellProps) {
  const { user, signOut } = useAuth();
  const [counts, setCounts] = useState<NavCounts>({
    leads: null, clients: null, projects: null, tasks: null, billing: null,
  });

  useEffect(() => {
    let cancelled = false;
    loadNavCounts().then(c => { if (!cancelled) setCounts(c); }).catch(err => {
      console.error('Nav count load error:', err);
    });
    return () => { cancelled = true; };
  }, [currentPage === 'dashboard']); // cheap refresh whenever we land back on the dashboard

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="min-h-screen w-full bg-[#E4E0D6] flex items-center justify-center p-0 lg:p-6">
      <div className="w-full h-screen lg:h-[calc(100vh-3rem)] lg:max-w-[1600px] bg-ledger-paper lg:border lg:border-ledger-navy/20 lg:shadow-ledger-frame flex flex-col overflow-hidden">
        {/* Command bar */}
        <div className="h-[50px] flex-shrink-0 bg-ledger-navy flex items-center px-4 gap-1">
          <button
            onClick={() => onNavigate('dashboard')}
            className="flex items-center gap-2.5 pr-4 mr-2 border-r border-white/10 h-full flex-shrink-0"
          >
            <div className="grid grid-cols-2 gap-0.5 w-5 h-5 flex-shrink-0">
              <div className="bg-white" />
              <div className="bg-white" />
              <div className="bg-white" />
              <div className="bg-ledger-crimson" />
            </div>
            <span className="font-geist font-semibold text-[16px] text-white leading-none hidden sm:inline">MarketMap</span>
          </button>

          <nav className="flex items-center h-full overflow-x-auto no-scrollbar">
            {NAV_ITEMS.map(item => {
              const active = currentPage === item.id;
              const count = badgeFor(item.id, counts);
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={`relative h-full flex items-center gap-1.5 px-3 font-plexMono text-[10px] tracking-[0.12em] uppercase whitespace-nowrap transition-colors ${
                    active ? 'text-white' : 'text-ledger-navInactive hover:text-white'
                  }`}
                >
                  {item.label}
                  {count !== null && count > 0 && (
                    <span className={`text-[9px] ${active ? 'text-white/70' : 'text-ledger-navInactive/70'}`}>{count}</span>
                  )}
                  {active && <span className="absolute left-0 right-0 bottom-0 h-[2px] bg-ledger-crimson" />}
                </button>
              );
            })}
          </nav>

          <div className="flex-1" />

          <div className="hidden md:flex items-center gap-2 px-3 h-7 bg-white/[0.06] mr-3">
            <Search size={12} className="text-ledger-navInactive" />
            <span className="font-plexMono text-[10px] text-ledger-navInactive">Search…</span>
            <span className="font-plexMono text-[9px] text-ledger-navInactive/70 border border-white/15 px-1">⌘K</span>
          </div>

          <button className="relative w-8 h-8 flex items-center justify-center text-ledger-navInactive hover:text-white transition-colors flex-shrink-0">
            <Bell size={15} />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-ledger-crimson" />
          </button>

          <button
            onClick={() => { if (confirm('Sign out?')) signOut(); }}
            title={user?.email ? `Sign out (${user.email})` : 'Sign out'}
            className="w-8 h-8 flex items-center justify-center text-ledger-navInactive hover:text-white transition-colors flex-shrink-0"
          >
            <LogOut size={15} />
          </button>

          <button
            onClick={() => onNavigate('settings')}
            title={user?.email ?? 'Settings'}
            className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 font-plexMono text-[10px] font-medium transition-colors ${
              currentPage === 'settings' ? 'bg-ledger-crimson text-white' : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            MM
          </button>
        </div>

        {/* Page body (each page renders its own title band + scrollable content) */}
        <div className="flex-1 min-h-0 flex flex-col bg-ledger-paper">
          {children}
        </div>

        {/* Status bar */}
        <div className="h-[26px] flex-shrink-0 bg-ledger-navy flex items-center px-4 justify-between">
          <span className="font-plexMono text-[9px] uppercase tracking-[0.1em] text-ledger-navInactive">
            MarketMap Analytics · Ledger build
          </span>
          <div className="flex items-center gap-4">
            <span className="font-plexMono text-[9px] uppercase tracking-[0.1em] text-ledger-navInactive">{today}</span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="font-plexMono text-[9px] uppercase tracking-[0.1em] text-ledger-navInactive">Systems nominal</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
