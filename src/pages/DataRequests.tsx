import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Project, DataChecklist } from '../types';
import Header from '../components/layout/Header';
import { Database, CheckSquare, Circle } from 'lucide-react';

const CHECKLIST_LABELS: Record<keyof DataChecklist, string> = {
  crm_data_received: 'CRM Data Received',
  crm_data_validated: 'CRM Data Validated',
  reference_solutions_acquired: 'Reference Solutions Acquired',
  census_data_acquired: 'Census Data Acquired',
  google_places_acquired: 'Google Places Acquired',
  review_data_acquired: 'Review Data Acquired',
  additional_sources_acquired: 'Additional Sources Acquired',
};

const DATA_STAGES = [
  { key: 'data_needed', label: 'Data Needed', color: 'bg-crimson-100 text-crimson-700' },
  { key: 'data_requested', label: 'Data Requested', color: 'bg-amber-100 text-amber-700' },
  { key: 'data_received', label: 'Data Received', color: 'bg-blue-100 text-blue-700' },
  { key: 'data_validated', label: 'Data Validated', color: 'bg-navy-100 text-navy-700' },
  { key: 'analysis_ready', label: 'Analysis Ready', color: 'bg-emerald-100 text-emerald-700' },
];

export default function DataRequests() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadProjects(); }, []);

  async function loadProjects() {
    setLoading(true);
    const { data } = await supabase
      .from('projects')
      .select('*, clients(business_name)')
      .not('status', 'in', '("Completed","On Hold")')
      .order('created_at', { ascending: false });
    setProjects(data ?? []);
    setLoading(false);
  }

  async function updateChecklist(projectId: string, key: keyof DataChecklist, value: boolean) {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    const updated = { ...project.data_checklist, [key]: value };
    await supabase.from('projects').update({ data_checklist: updated }).eq('id', projectId);
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, data_checklist: updated } : p));
  }

  const getDataStage = (checklist: DataChecklist) => {
    const vals = Object.values(checklist);
    const done = vals.filter(Boolean).length;
    if (done === 0) return 'data_needed';
    if (!checklist.crm_data_received) return 'data_requested';
    if (!checklist.crm_data_validated) return 'data_received';
    const allAcquired = checklist.census_data_acquired && checklist.google_places_acquired && checklist.review_data_acquired;
    if (!allAcquired) return 'data_validated';
    return 'analysis_ready';
  };

  const getProgress = (checklist: DataChecklist) => {
    const vals = Object.values(checklist);
    return { done: vals.filter(Boolean).length, total: vals.length };
  };

  return (
    <div className="flex-1 flex flex-col">
      <Header title="Data Requests" subtitle="Track data acquisition across projects" />
      <div className="flex-1 p-6 space-y-5 overflow-y-auto">
        {/* Stage Overview */}
        <div className="grid grid-cols-5 gap-3">
          {DATA_STAGES.map(stage => {
            const count = projects.filter(p => getDataStage(p.data_checklist) === stage.key).length;
            return (
              <div key={stage.key} className="card p-4 text-center">
                <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold mb-2 ${stage.color}`}>
                  {stage.label}
                </div>
                <div className="text-2xl font-bold text-navy-900">{count}</div>
                <div className="text-xs text-navy-400">projects</div>
              </div>
            );
          })}
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-navy-400 text-sm">Loading projects...</div>
        ) : (
          <div className="space-y-4">
            {projects.length === 0 ? (
              <div className="card p-12 text-center text-navy-400">No active projects</div>
            ) : projects.map(project => {
              const prog = getProgress(project.data_checklist);
              const stage = DATA_STAGES.find(s => s.key === getDataStage(project.data_checklist));
              return (
                <div key={project.id} className="card overflow-hidden">
                  <div className="px-5 py-4 border-b border-surface-200 flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-navy-900">{project.project_name}</h3>
                      <p className="text-xs text-navy-400 mt-0.5">{(project as any).clients?.business_name} • {project.service_type}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-surface-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-navy-700 rounded-full transition-all"
                            style={{ width: `${(prog.done / prog.total) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-navy-500">{prog.done}/{prog.total}</span>
                      </div>
                      {stage && (
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${stage.color}`}>{stage.label}</span>
                      )}
                    </div>
                  </div>
                  <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-3">
                    {(Object.entries(CHECKLIST_LABELS) as [keyof DataChecklist, string][]).map(([key, label]) => (
                      <label key={key} className="flex items-center gap-2.5 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={project.data_checklist[key]}
                          onChange={e => updateChecklist(project.id, key, e.target.checked)}
                          className="w-4 h-4 rounded border-surface-300 text-navy-800 focus:ring-navy-800/20 flex-shrink-0"
                        />
                        <div className="flex items-center gap-1.5">
                          {project.data_checklist[key]
                            ? <CheckSquare size={12} className="text-emerald-500 flex-shrink-0" />
                            : <Circle size={12} className="text-surface-300 flex-shrink-0" />
                          }
                          <span className={`text-xs transition-colors ${
                            project.data_checklist[key] ? 'text-navy-400 line-through' : 'text-navy-700 group-hover:text-navy-900'
                          }`}>{label}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
