import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Project, Document, CrmCustomer, BusinessRecord } from '../types';
import { ArrowLeft, Users, Globe, Building, Search, TrendingUp, AlertTriangle, FileText, ExternalLink, Map as MapIcon } from 'lucide-react';
import MarketMapDashboard from '../components/map/MarketMapDashboard';

interface ProjectSnapshotProps {
  projectId: string;
  onBack: () => void;
}

export default function ProjectSnapshot({ projectId, onBack }: ProjectSnapshotProps) {
  const [project, setProject] = useState<Project | null>(null);
  const [reportDoc, setReportDoc] = useState<Document | null>(null);
  const [crmCustomers, setCrmCustomers] = useState<CrmCustomer[]>([]);
  const [businessRecord, setBusinessRecord] = useState<BusinessRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'raw' | 'report' | 'map'>('raw');

  useEffect(() => {
    async function loadData() {
      const [projRes, docRes, crmRes, bizRes] = await Promise.all([
        supabase
          .from('projects')
          .select('*, clients(business_name)')
          .eq('id', projectId)
          .single(),
        supabase
          .from('documents')
          .select('*')
          .eq('project_id', projectId)
          .eq('doc_type', 'Report')
          .order('created_at', { ascending: false })
          .limit(1),
        supabase
          .from('crm_customers')
          .select('*')
          .eq('business_owner_id', projectId),
        supabase
          .from('business_records')
          .select('*')
          .eq('project_id', projectId)
          .single()
      ]);
      setProject(projRes.data as Project);
      setReportDoc((docRes.data?.[0] as Document) || null);
      setCrmCustomers(crmRes.data as CrmCustomer[] || []);
      setBusinessRecord(bizRes.data as BusinessRecord || null);
      
      // Auto-select report tab if it exists
      if (projRes.data?.master_report_html) {
        setActiveTab('report');
      }
      
      setLoading(false);
    }
    loadData();
  }, [projectId]);

  if (loading) {
    return <div className="flex-1 flex items-center justify-center p-8 text-navy-400">Loading snapshot...</div>;
  }

  if (!project) {
    return <div className="flex-1 flex items-center justify-center p-8 text-crimson-500">Project not found</div>;
  }

  // Calculate dynamic stats
  const totalCustomers = crmCustomers.length;
  const missingEmails = totalCustomers ? Math.round((crmCustomers.filter(c => !c.email).length / totalCustomers) * 100) : 0;
  const missingPhones = totalCustomers ? Math.round((crmCustomers.filter(c => !c.phone).length / totalCustomers) * 100) : 0;
  const missingAddresses = totalCustomers ? Math.round((crmCustomers.filter(c => !c.address || c.address.length < 5).length / totalCustomers) * 100) : 0;

  const competitors = businessRecord?.competitor_landscape || [];
  const numCompetitors = competitors.length;
  const avgRating = numCompetitors 
    ? (competitors.reduce((sum, c) => sum + (c.rating || 0), 0) / numCompetitors).toFixed(1) 
    : 'N/A';

  const nicheSummary = project.analysis_data?.review_summary || "Web research analysis is still running. Summary data will populate here once the final pipeline finishes.";

  return (
    <div className="flex-1 flex flex-col bg-surface-100 h-full overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-surface-200 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-surface-100 rounded-lg text-navy-500 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-navy-900 flex items-center gap-2">
              {project.project_name} <span className="text-navy-400 font-normal text-lg">| Snapshot Dashboard</span>
            </h1>
            <p className="text-sm text-navy-500">
              {(project as any).clients?.business_name} • 'Before Analysis' Unified View
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {reportDoc?.url && (
            <a 
              href={reportDoc.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-1.5 bg-white text-navy-700 text-xs font-medium rounded border border-surface-200 hover:bg-surface-50 transition-colors"
            >
              <ExternalLink size={14} />
              Share Report
            </a>
          )}
          <span className="px-3 py-1 bg-surface-100 text-navy-700 text-xs font-medium rounded-full border border-surface-200">
            {project.status}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-surface-200 px-6 flex items-center gap-6 shrink-0">
        <button
          onClick={() => setActiveTab('raw')}
          className={`py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'raw' 
              ? 'border-navy-600 text-navy-900' 
              : 'border-transparent text-navy-500 hover:text-navy-700'
          }`}
        >
          Raw Data / Enrichment
        </button>
        {project.master_report_html && (
          <button
            onClick={() => setActiveTab('report')}
            className={`py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'report' 
                ? 'border-navy-600 text-navy-900' 
                : 'border-transparent text-navy-500 hover:text-navy-700'
            }`}
          >
            <FileText size={16} />
            Master Report
          </button>
        )}
        <button
          onClick={() => setActiveTab('map')}
          className={`py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'map' 
              ? 'border-navy-600 text-navy-900' 
              : 'border-transparent text-navy-500 hover:text-navy-700'
          }`}
        >
          <MapIcon size={16} />
          Map Canvas
        </button>
      </div>

      {/* Main Content Area */}
      <div className={`flex-1 overflow-y-auto ${activeTab === 'map' ? 'bg-surface-50' : 'p-6'}`}>
        {activeTab === 'raw' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-7xl mx-auto">
          
          {/* Column 1: Organic CRM Data */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-navy-800 mb-2">
              <Users size={18} className="text-emerald-600" />
              <h2 className="text-lg font-bold">Organic CRM Data</h2>
            </div>
            
            <div className="card p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-surface-100 pb-3">
                <h3 className="font-semibold text-navy-900 text-sm">Raw Customer List (Sample)</h3>
                <span className="text-xs text-navy-500 bg-surface-100 px-2 py-1 rounded">{totalCustomers.toLocaleString()} Records Uploaded</span>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-navy-400 text-xs uppercase border-b border-surface-100">
                      <th className="pb-2 font-medium">Customer Name</th>
                      <th className="pb-2 font-medium">Location</th>
                      <th className="pb-2 font-medium">LTV</th>
                      <th className="pb-2 font-medium">Last Order</th>
                    </tr>
                  </thead>
                  <tbody className="text-navy-700">
                    {crmCustomers.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-4 text-center text-navy-400 italic">No CRM records found.</td>
                      </tr>
                    ) : (
                      crmCustomers.slice(0, 4).map((c) => (
                        <tr key={c.id} className="border-b border-surface-50 hover:bg-surface-50">
                          <td className="py-2">{c.first_name} {c.last_name}</td>
                          <td className="py-2">{c.city || 'Unknown'}, {c.state || ''}</td>
                          <td className="py-2">${c.total_revenue?.toLocaleString() || '0'}</td>
                          <td className="py-2">{c.last_service_date || 'N/A'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              
              <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-100 mt-4">
                <h4 className="text-xs font-bold text-emerald-800 uppercase mb-2">Onboarding Data Quality</h4>
                <div className="space-y-2 text-sm text-emerald-700">
                  <div className="flex justify-between items-center">
                    <span>Missing Emails</span>
                    <span className={`font-semibold ${missingEmails > 10 ? 'text-amber-600' : 'text-emerald-600'}`}>{missingEmails}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Missing Phone Numbers</span>
                    <span className={`font-semibold ${missingPhones > 10 ? 'text-amber-600' : 'text-emerald-600'}`}>{missingPhones}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Invalid Addresses</span>
                    <span className={`font-semibold ${missingAddresses > 10 ? 'text-amber-600' : 'text-emerald-600'}`}>{missingAddresses}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Column 2: Enrichment / Web Research */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-navy-800 mb-2">
              <Globe size={18} className="text-blue-600" />
              <h2 className="text-lg font-bold">Enrichment / Web Research</h2>
            </div>

            <div className="space-y-4">
              {/* Apify Stats */}
              <div className="card p-5 border-l-4 border-blue-500">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-navy-900 text-sm flex items-center gap-2">
                    <Search size={15} className="text-blue-500"/> Apify Competitor Stats
                  </h3>
                  <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-100">Extracted Today</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-surface-50 p-3 rounded-lg border border-surface-100">
                    <div className="text-2xs text-navy-500 uppercase tracking-wider mb-1">Identified Competitors</div>
                    <div className="text-xl font-bold text-navy-800">{numCompetitors}</div>
                  </div>
                  <div className="bg-surface-50 p-3 rounded-lg border border-surface-100">
                    <div className="text-2xs text-navy-500 uppercase tracking-wider mb-1">Avg Rating (Google)</div>
                    <div className="text-xl font-bold text-navy-800">{avgRating} <span className="text-xs text-navy-400 font-normal">/ 5.0</span></div>
                  </div>
                </div>
              </div>

              {/* BBB Scores */}
              <div className="card p-5 border-l-4 border-indigo-500">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-navy-900 text-sm flex items-center gap-2">
                    <Building size={15} className="text-indigo-500"/> Better Business Bureau Data
                  </h3>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm border-b border-surface-50 pb-2">
                    <span className="text-navy-600">Client BBB Rating</span>
                    <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">{businessRecord?.bbb_rating || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm border-b border-surface-50 pb-2">
                    <span className="text-navy-600">Competitor Avg BBB</span>
                    <span className="font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">{businessRecord?.competitor_avg_bbb || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-navy-600">Reported Complaints (Market)</span>
                    <span className="font-bold text-crimson-600 flex items-center gap-1"><AlertTriangle size={12}/> {businessRecord?.reported_complaints || 0} in last yr</span>
                  </div>
                </div>
              </div>

              {/* Niche Summary */}
              <div className="card p-5 border-l-4 border-purple-500">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp size={15} className="text-purple-500"/>
                  <h3 className="font-semibold text-navy-900 text-sm">Niche Market Summary</h3>
                </div>
                <p className="text-sm text-navy-600 leading-relaxed">
                  {nicheSummary}
                </p>
              </div>
              
            </div>
          </div>
          
          </div>
        ) : activeTab === 'report' ? (
          <div className="max-w-5xl mx-auto bg-white p-8 rounded-xl shadow-sm border border-surface-200 min-h-full">
            <div 
              className="text-navy-900"
              style={{
                // Basic resets in case Claude's inline styles missed standard block spacing
                // Tailwind resets all typography by default.
              }}
              dangerouslySetInnerHTML={{ __html: project.master_report_html || '' }} 
            />
          </div>
        ) : activeTab === 'map' ? (
          <div className="h-full">
            <MarketMapDashboard project={project} businessRecord={businessRecord} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
