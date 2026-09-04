import { useState } from 'react';
import Sidebar from './components/layout/Sidebar';
import Dashboard from './pages/Dashboard';
import Leads from './pages/Leads';
import Clients from './pages/Clients';
import Projects from './pages/Projects';
import Tasks from './pages/Tasks';
import Billing from './pages/Billing';
import DataRequests from './pages/DataRequests';
import Reports from './pages/Reports';
import Analytics from './pages/Analytics';
import Documents from './pages/Documents';
import Settings from './pages/Settings';
import FinancialProjections from './pages/FinancialProjections';

type Page =
  | 'dashboard' | 'leads' | 'clients' | 'projects' | 'tasks'
  | 'billing' | 'data-requests' | 'reports' | 'analytics' | 'documents' | 'settings' | 'projections';

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <Dashboard onNavigate={p => setCurrentPage(p as Page)} />;
      case 'leads': return <Leads />;
      case 'clients': return <Clients />;
      case 'projects': return <Projects />;
      case 'tasks': return <Tasks />;
      case 'billing': return <Billing />;
      case 'data-requests': return <DataRequests />;
      case 'reports': return <Reports />;
      case 'analytics': return <Analytics />;
      case 'documents': return <Documents />;
      case 'settings': return <Settings />;
      case 'projections': return <FinancialProjections />;
      default: return <Dashboard onNavigate={p => setCurrentPage(p as Page)} />;
    }
  };

  return (
    <div className="flex h-screen bg-surface-100 overflow-hidden">
      <Sidebar currentPage={currentPage} onNavigate={p => setCurrentPage(p as Page)} />
      <main className="flex-1 ml-56 flex flex-col min-h-screen overflow-hidden">
        {renderPage()}
      </main>
    </div>
  );
}
