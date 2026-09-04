import Header from '../components/layout/Header';
import { Settings as SettingsIcon, User, Building2, Bell, Shield, Link, Puzzle } from 'lucide-react';

const FUTURE_INTEGRATIONS = [
  { name: 'QuickBooks', desc: 'Sync invoices and financial data', icon: '📊', status: 'Coming Soon' },
  { name: 'Stripe', desc: 'Accept payments and automate billing', icon: '💳', status: 'Coming Soon' },
  { name: 'Gmail', desc: 'Sync email communications', icon: '📧', status: 'Coming Soon' },
  { name: 'Outlook', desc: 'Sync email and calendar events', icon: '📅', status: 'Coming Soon' },
  { name: 'Google Calendar', desc: 'Sync meetings and follow-ups', icon: '🗓️', status: 'Coming Soon' },
  { name: 'n8n', desc: 'Workflow automation engine', icon: '⚡', status: 'Coming Soon' },
  { name: 'MarketMap Platform', desc: 'Connect market analysis tools', icon: '🗺️', status: 'Coming Soon' },
];

export default function Settings() {
  return (
    <div className="flex-1 flex flex-col">
      <Header title="Settings" subtitle="Platform configuration" />
      <div className="flex-1 p-6 space-y-6 overflow-y-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Company Profile */}
          <div className="card p-5">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-8 h-8 rounded-lg bg-navy-100 flex items-center justify-center">
                <Building2 size={16} className="text-navy-700" />
              </div>
              <h3 className="text-sm font-semibold text-navy-900">Company Profile</h3>
            </div>
            <div className="space-y-3">
              <div>
                <label className="form-label">Company Name</label>
                <input className="form-input" defaultValue="MarketMap Analytics" />
              </div>
              <div>
                <label className="form-label">Website</label>
                <input className="form-input" placeholder="https://..." />
              </div>
              <div>
                <label className="form-label">Industry</label>
                <input className="form-input" defaultValue="Data Analytics & Location Intelligence" />
              </div>
              <button className="btn-primary text-xs py-1.5">Save Changes</button>
            </div>
          </div>

          {/* Administrator */}
          <div className="card p-5">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-8 h-8 rounded-lg bg-navy-100 flex items-center justify-center">
                <User size={16} className="text-navy-700" />
              </div>
              <h3 className="text-sm font-semibold text-navy-900">Administrator</h3>
            </div>
            <div className="space-y-3">
              <div>
                <label className="form-label">Full Name</label>
                <input className="form-input" placeholder="Your name" />
              </div>
              <div>
                <label className="form-label">Email</label>
                <input className="form-input" type="email" placeholder="admin@marketmapanalytics.com" />
              </div>
              <div>
                <label className="form-label">Role</label>
                <input className="form-input bg-surface-100 cursor-not-allowed" defaultValue="Owner / Administrator" disabled />
              </div>
              <button className="btn-primary text-xs py-1.5">Update Profile</button>
            </div>
          </div>

          {/* Notifications */}
          <div className="card p-5">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                <Bell size={16} className="text-amber-600" />
              </div>
              <h3 className="text-sm font-semibold text-navy-900">Notifications</h3>
              <span className="text-xs text-navy-400 bg-surface-100 px-2 py-0.5 rounded-full ml-auto">Coming Soon</span>
            </div>
            <div className="space-y-3 opacity-50 pointer-events-none">
              {['Task due reminders', 'Invoice overdue alerts', 'Lead follow-up reminders', 'Project deadline warnings'].map(item => (
                <div key={item} className="flex items-center justify-between">
                  <span className="text-sm text-navy-700">{item}</span>
                  <div className="w-9 h-5 bg-surface-200 rounded-full" />
                </div>
              ))}
            </div>
          </div>

          {/* Security */}
          <div className="card p-5">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                <Shield size={16} className="text-emerald-600" />
              </div>
              <h3 className="text-sm font-semibold text-navy-900">Security & Access</h3>
            </div>
            <div className="space-y-3">
              <div className="p-3 bg-surface-50 rounded-lg border border-surface-200">
                <div className="text-xs font-semibold text-navy-700 mb-0.5">Role-Based Access Control</div>
                <div className="text-xs text-navy-400">Planned for team expansion. Currently single-admin mode.</div>
              </div>
              <div className="p-3 bg-surface-50 rounded-lg border border-surface-200">
                <div className="text-xs font-semibold text-navy-700 mb-0.5">Data Encryption</div>
                <div className="text-xs text-navy-400">All data encrypted at rest via Supabase.</div>
              </div>
              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                <div className="text-xs font-semibold text-emerald-700 mb-0.5">Database Status</div>
                <div className="text-xs text-emerald-600">Connected · Supabase PostgreSQL</div>
              </div>
            </div>
          </div>
        </div>

        {/* Future Integrations */}
        <div className="card p-5">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <Puzzle size={16} className="text-blue-600" />
            </div>
            <h3 className="text-sm font-semibold text-navy-900">Planned Integrations</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {FUTURE_INTEGRATIONS.map(int => (
              <div key={int.name} className="p-3 rounded-xl border border-surface-200 bg-surface-50 opacity-70">
                <div className="text-xl mb-2">{int.icon}</div>
                <div className="text-sm font-semibold text-navy-800">{int.name}</div>
                <div className="text-xs text-navy-400 mt-0.5">{int.desc}</div>
                <div className="text-2xs text-navy-300 mt-2 font-medium">{int.status}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Platform Info */}
        <div className="card p-5">
          <div className="flex items-center gap-2.5 mb-3">
            <SettingsIcon size={15} className="text-navy-500" />
            <h3 className="text-sm font-semibold text-navy-900">Platform Information</h3>
          </div>
          <div className="grid grid-cols-3 gap-4 text-xs">
            {[
              { label: 'Platform', value: 'MarketMap Analytics CRM' },
              { label: 'Version', value: '1.0.0' },
              { label: 'Stack', value: 'React + TypeScript + Supabase' },
              { label: 'Database', value: 'PostgreSQL via Supabase' },
              { label: 'Auth', value: 'Supabase Auth (ready)' },
              { label: 'Architecture', value: 'Multi-role ready' },
            ].map(({ label, value }) => (
              <div key={label}>
                <div className="text-navy-400 font-semibold uppercase tracking-wide mb-0.5">{label}</div>
                <div className="text-navy-700">{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
