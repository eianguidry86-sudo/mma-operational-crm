import {
  LayoutDashboard, Users, Building2, FolderKanban, CheckSquare,
  Receipt, Database, BarChart3, TrendingUp, FileText, Settings, ChevronRight, Calculator
} from 'lucide-react';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'leads', label: 'Leads', icon: Users },
  { id: 'clients', label: 'Clients', icon: Building2 },
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare },
  { id: 'billing', label: 'Billing', icon: Receipt },
  { id: 'data-requests', label: 'Data Requests', icon: Database },
  { id: 'reports', label: 'Reports', icon: FileText },
  { id: 'analytics', label: 'Analytics', icon: TrendingUp },
  { id: 'documents', label: 'Documents', icon: BarChart3 },
  { id: 'projections', label: 'Projections', icon: Calculator },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  return (
    <aside className="fixed left-0 top-0 h-screen w-56 bg-navy-900 flex flex-col z-30 select-none">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-navy-800">
        <div className="flex items-center gap-2.5">
          <div className="grid grid-cols-2 gap-0.5 w-7 h-7 flex-shrink-0">
            <div className="rounded-sm bg-navy-500" />
            <div className="rounded-sm bg-navy-500" />
            <div className="rounded-sm bg-navy-500" />
            <div className="rounded-sm bg-crimson-600" />
          </div>
          <div>
            <div className="text-white font-bold text-sm leading-tight">MarketMap</div>
            <div className="text-navy-400 text-2xs leading-tight">Analytics CRM</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <ul className="space-y-0.5">
          {navItems.map(({ id, label, icon: Icon }) => {
            const active = currentPage === id;
            return (
              <li key={id}>
                <button
                  onClick={() => onNavigate(id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group ${
                    active
                      ? 'bg-navy-700 text-white'
                      : 'text-navy-300 hover:bg-navy-800 hover:text-white'
                  }`}
                >
                  <Icon size={16} className={active ? 'text-crimson-400' : 'text-navy-400 group-hover:text-navy-300'} />
                  <span className="flex-1 text-left">{label}</span>
                  {active && <ChevronRight size={12} className="text-navy-400" />}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-navy-800">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-navy-700 flex items-center justify-center">
            <span className="text-xs font-bold text-white">MM</span>
          </div>
          <div className="min-w-0">
            <div className="text-white text-xs font-semibold truncate">Administrator</div>
            <div className="text-navy-400 text-2xs truncate">Owner</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
