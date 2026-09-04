import { useState } from 'react';
import { ProjectionsProvider } from '../lib/ProjectionsContext';
import PayrollGrid from '../components/finance/PayrollGrid';
import SalesGrid from '../components/finance/SalesGrid';


type Tab = 'inputs' | 'outputs';

export default function FinancialProjections() {
  return (
    <ProjectionsProvider>
      <FinancialProjectionsContent />
    </ProjectionsProvider>
  );
}

function FinancialProjectionsContent() {
  const [activeTab, setActiveTab] = useState<Tab>('inputs');

  return (
    <div className="flex flex-col h-full bg-surface-50">
      <div className="px-6 py-5 border-b border-surface-200 bg-white">
        <h1 className="text-2xl font-bold text-navy-900">Financial Projections</h1>
        <p className="text-sm text-navy-500 mt-1">Manage and forecast financial models.</p>
        
        <div className="mt-6 flex space-x-4 border-b border-surface-200">
          <button
            onClick={() => setActiveTab('inputs')}
            className={`pb-3 text-sm font-medium transition-colors relative ${
              activeTab === 'inputs' ? 'text-crimson-600' : 'text-navy-500 hover:text-navy-700'
            }`}
          >
            Inputs
            {activeTab === 'inputs' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-crimson-600 rounded-t-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('outputs')}
            className={`pb-3 text-sm font-medium transition-colors relative ${
              activeTab === 'outputs' ? 'text-crimson-600' : 'text-navy-500 hover:text-navy-700'
            }`}
          >
            Outputs
            {activeTab === 'outputs' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-crimson-600 rounded-t-full" />
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 bg-surface-50">
        {activeTab === 'inputs' ? (
          <div className="space-y-6">
            <SalesGrid />
            <PayrollGrid />
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-surface-200 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-navy-900 mb-4">Output Dashboards</h2>
            <p className="text-navy-600">Cash Flow, Income Statement, Balance Sheet, Breakeven Analysis</p>
            {/* Output Charts and Tables will go here */}
          </div>
        )}
      </div>
    </div>
  );
}
