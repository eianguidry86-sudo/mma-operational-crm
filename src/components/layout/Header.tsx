import { Bell, Search } from 'lucide-react';

interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export default function Header({ title, subtitle, actions }: HeaderProps) {
  return (
    <header className="bg-white border-b border-surface-200 h-14 flex items-center px-6 gap-4 sticky top-0 z-20">
      <div className="flex-1 min-w-0">
        <h1 className="text-base font-semibold text-navy-900 leading-none truncate">{title}</h1>
        {subtitle && <p className="text-xs text-navy-400 mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">
        {actions}
        <button className="w-8 h-8 rounded-lg flex items-center justify-center text-navy-400 hover:bg-surface-100 hover:text-navy-700 transition-colors">
          <Search size={16} />
        </button>
        <button className="w-8 h-8 rounded-lg flex items-center justify-center text-navy-400 hover:bg-surface-100 hover:text-navy-700 transition-colors">
          <Bell size={16} />
        </button>
      </div>
    </header>
  );
}
