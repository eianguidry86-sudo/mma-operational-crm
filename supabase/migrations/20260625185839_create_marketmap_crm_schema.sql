
/*
# MarketMap Analytics CRM & Operations Platform — Full Schema

## Summary
Creates all core tables for the CRM: leads, clients, projects, tasks, invoices,
communications, documents, and an activity log. This is a single-tenant (solo founder)
app — no user_id isolation is needed. All policies allow anon + authenticated access.

## Tables

### leads
Tracks prospective clients through the full sales pipeline.
Columns: id, business_name, contact_name, email, phone, website, industry, service_area,
business_size, crm_used, opportunity_type, problem_being_solved, lead_source,
estimated_deal_value, expected_close_date, stage, notes, next_action, follow_up_date,
created_at, updated_at

### clients
Active client records converted from leads.
Columns: id, business_name, contact_name, email, phone, website, industry, service_area,
business_size, notes, status, lifetime_value, created_at, updated_at

### projects
Projects linked to clients. Tracks workflow stage, waiting status, data acquisition.
Columns: id, client_id, project_name, service_type, project_summary, status, waiting_on,
start_date, due_date, delivery_date, invoice_status, payment_status, internal_notes,
data_checklist (jsonb), created_at, updated_at

### tasks
Tasks linkable to leads, clients, projects, or internal operations.
Columns: id, title, description, priority, due_date, status, assigned_to,
lead_id, client_id, project_id, task_type, created_at, updated_at

### invoices
Billing records tied to clients and projects.
Columns: id, invoice_number, client_id, project_id, amount, due_date, status,
payment_date, deposit_required, deposit_amount, deposit_received, notes, created_at, updated_at

### communications
Notes, email history, and call history per client.
Columns: id, client_id, lead_id, type (note/email/call), subject, body, created_at

### documents
Document metadata per client (contracts, proposals, reports).
Columns: id, client_id, project_id, name, doc_type, url, created_at

### activity_log
Recent activity feed for the dashboard.
Columns: id, action, entity_type, entity_id, entity_name, created_at

## Security
- RLS enabled on all tables.
- Policies: TO anon, authenticated with USING (true) / WITH CHECK (true)
  because this is a single-admin app with no per-user data isolation needed.
*/

-- ───────────────────────────── LEADS ─────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name text NOT NULL,
  contact_name text,
  email text,
  phone text,
  website text,
  industry text,
  service_area text,
  business_size text,
  crm_used text,
  opportunity_type text,
  problem_being_solved text,
  lead_source text,
  estimated_deal_value numeric(12,2),
  expected_close_date date,
  stage text NOT NULL DEFAULT 'New Lead',
  notes text,
  next_action text,
  follow_up_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_leads" ON leads;
CREATE POLICY "anon_select_leads" ON leads FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_leads" ON leads;
CREATE POLICY "anon_insert_leads" ON leads FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_leads" ON leads;
CREATE POLICY "anon_update_leads" ON leads FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_leads" ON leads;
CREATE POLICY "anon_delete_leads" ON leads FOR DELETE TO anon, authenticated USING (true);

-- ───────────────────────────── CLIENTS ─────────────────────────────
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name text NOT NULL,
  contact_name text,
  email text,
  phone text,
  website text,
  industry text,
  service_area text,
  business_size text,
  notes text,
  status text NOT NULL DEFAULT 'Active',
  lifetime_value numeric(12,2) DEFAULT 0,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_clients" ON clients;
CREATE POLICY "anon_select_clients" ON clients FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_clients" ON clients;
CREATE POLICY "anon_insert_clients" ON clients FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_clients" ON clients;
CREATE POLICY "anon_update_clients" ON clients FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_clients" ON clients;
CREATE POLICY "anon_delete_clients" ON clients FOR DELETE TO anon, authenticated USING (true);

-- ───────────────────────────── PROJECTS ─────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  project_name text NOT NULL,
  service_type text,
  project_summary text,
  status text NOT NULL DEFAULT 'Project Acceptance',
  waiting_on text,
  start_date date,
  due_date date,
  delivery_date date,
  invoice_status text DEFAULT 'Not Invoiced',
  payment_status text DEFAULT 'Unpaid',
  internal_notes text,
  data_checklist jsonb DEFAULT '{
    "crm_data_received": false,
    "crm_data_validated": false,
    "reference_solutions_acquired": false,
    "census_data_acquired": false,
    "google_places_acquired": false,
    "review_data_acquired": false,
    "additional_sources_acquired": false
  }'::jsonb,
  analysis_data jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_projects" ON projects;
CREATE POLICY "anon_select_projects" ON projects FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_projects" ON projects;
CREATE POLICY "anon_insert_projects" ON projects FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_projects" ON projects;
CREATE POLICY "anon_update_projects" ON projects FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_projects" ON projects;
CREATE POLICY "anon_delete_projects" ON projects FOR DELETE TO anon, authenticated USING (true);

-- ───────────────────────────── TASKS ─────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  priority text NOT NULL DEFAULT 'Medium',
  due_date date,
  status text NOT NULL DEFAULT 'Open',
  assigned_to text,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  task_type text DEFAULT 'Internal Operations',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_tasks" ON tasks;
CREATE POLICY "anon_select_tasks" ON tasks FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_tasks" ON tasks;
CREATE POLICY "anon_insert_tasks" ON tasks FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_tasks" ON tasks;
CREATE POLICY "anon_update_tasks" ON tasks FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_tasks" ON tasks;
CREATE POLICY "anon_delete_tasks" ON tasks FOR DELETE TO anon, authenticated USING (true);

-- ───────────────────────────── INVOICES ─────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text UNIQUE NOT NULL,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  due_date date,
  status text NOT NULL DEFAULT 'Draft',
  payment_date date,
  deposit_required boolean DEFAULT false,
  deposit_amount numeric(12,2),
  deposit_received boolean DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_invoices" ON invoices;
CREATE POLICY "anon_select_invoices" ON invoices FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_invoices" ON invoices;
CREATE POLICY "anon_insert_invoices" ON invoices FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_invoices" ON invoices;
CREATE POLICY "anon_update_invoices" ON invoices FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_invoices" ON invoices;
CREATE POLICY "anon_delete_invoices" ON invoices FOR DELETE TO anon, authenticated USING (true);

-- ───────────────────────────── COMMUNICATIONS ─────────────────────────────
CREATE TABLE IF NOT EXISTS communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'note',
  subject text,
  body text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE communications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_communications" ON communications;
CREATE POLICY "anon_select_communications" ON communications FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_communications" ON communications;
CREATE POLICY "anon_insert_communications" ON communications FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_communications" ON communications;
CREATE POLICY "anon_update_communications" ON communications FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_communications" ON communications;
CREATE POLICY "anon_delete_communications" ON communications FOR DELETE TO anon, authenticated USING (true);

-- ───────────────────────────── DOCUMENTS ─────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  name text NOT NULL,
  doc_type text NOT NULL DEFAULT 'Other',
  url text,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_documents" ON documents;
CREATE POLICY "anon_select_documents" ON documents FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_documents" ON documents;
CREATE POLICY "anon_insert_documents" ON documents FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_documents" ON documents;
CREATE POLICY "anon_update_documents" ON documents FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_documents" ON documents;
CREATE POLICY "anon_delete_documents" ON documents FOR DELETE TO anon, authenticated USING (true);

-- ───────────────────────────── ACTIVITY LOG ─────────────────────────────
CREATE TABLE IF NOT EXISTS activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  entity_name text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_activity_log" ON activity_log;
CREATE POLICY "anon_select_activity_log" ON activity_log FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_activity_log" ON activity_log;
CREATE POLICY "anon_insert_activity_log" ON activity_log FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_activity_log" ON activity_log;
CREATE POLICY "anon_update_activity_log" ON activity_log FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_activity_log" ON activity_log;
CREATE POLICY "anon_delete_activity_log" ON activity_log FOR DELETE TO anon, authenticated USING (true);

-- ───────────────────────────── INDEXES ─────────────────────────────
CREATE INDEX IF NOT EXISTS idx_projects_client_id ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_tasks_client_id ON tasks(client_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_lead_id ON tasks(lead_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_project_id ON invoices(project_id);
CREATE INDEX IF NOT EXISTS idx_communications_client_id ON communications(client_id);
CREATE INDEX IF NOT EXISTS idx_communications_lead_id ON communications(lead_id);
CREATE INDEX IF NOT EXISTS idx_documents_client_id ON documents(client_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage);
CREATE INDEX IF NOT EXISTS idx_leads_follow_up_date ON leads(follow_up_date);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
