/*
  Lock down all tables to authenticated users only.

  Previously every table granted full read/write to `anon, authenticated`
  with USING (true) — meaning the public anon key alone (no login required)
  had complete access to every lead, client, and billing record. Now that
  the app has a real login screen (Supabase Auth, email/password), drop the
  anon grant and require an authenticated session for every operation.

  Access model stays flat: any signed-in user can read/write everything
  (no per-user or per-role isolation) — matches how the app is built today.

  Also brings niche_markets under RLS for the first time; it previously had
  RLS disabled entirely (fully open, no policy at all).

  Applied directly to the live project (mma-crm / mxqygojzoavwoyfvfdyw) via
  the Supabase MCP on 2026-09-09. This file mirrors that change for the
  local migration history.
*/

-- ───────────────────────────── LEADS ─────────────────────────────
DROP POLICY IF EXISTS "anon_select_leads" ON leads;
DROP POLICY IF EXISTS "anon_insert_leads" ON leads;
DROP POLICY IF EXISTS "anon_update_leads" ON leads;
DROP POLICY IF EXISTS "anon_delete_leads" ON leads;
CREATE POLICY "auth_select_leads" ON leads FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_leads" ON leads FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_leads" ON leads FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_leads" ON leads FOR DELETE TO authenticated USING (true);

-- ───────────────────────────── CLIENTS ─────────────────────────────
DROP POLICY IF EXISTS "anon_select_clients" ON clients;
DROP POLICY IF EXISTS "anon_insert_clients" ON clients;
DROP POLICY IF EXISTS "anon_update_clients" ON clients;
DROP POLICY IF EXISTS "anon_delete_clients" ON clients;
CREATE POLICY "auth_select_clients" ON clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_clients" ON clients FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_clients" ON clients FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_clients" ON clients FOR DELETE TO authenticated USING (true);

-- ───────────────────────────── PROJECTS ─────────────────────────────
DROP POLICY IF EXISTS "anon_select_projects" ON projects;
DROP POLICY IF EXISTS "anon_insert_projects" ON projects;
DROP POLICY IF EXISTS "anon_update_projects" ON projects;
DROP POLICY IF EXISTS "anon_delete_projects" ON projects;
CREATE POLICY "auth_select_projects" ON projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_projects" ON projects FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_projects" ON projects FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_projects" ON projects FOR DELETE TO authenticated USING (true);

-- ───────────────────────────── TASKS ─────────────────────────────
DROP POLICY IF EXISTS "anon_select_tasks" ON tasks;
DROP POLICY IF EXISTS "anon_insert_tasks" ON tasks;
DROP POLICY IF EXISTS "anon_update_tasks" ON tasks;
DROP POLICY IF EXISTS "anon_delete_tasks" ON tasks;
CREATE POLICY "auth_select_tasks" ON tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_tasks" ON tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_tasks" ON tasks FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_tasks" ON tasks FOR DELETE TO authenticated USING (true);

-- ───────────────────────────── INVOICES ─────────────────────────────
DROP POLICY IF EXISTS "anon_select_invoices" ON invoices;
DROP POLICY IF EXISTS "anon_insert_invoices" ON invoices;
DROP POLICY IF EXISTS "anon_update_invoices" ON invoices;
DROP POLICY IF EXISTS "anon_delete_invoices" ON invoices;
CREATE POLICY "auth_select_invoices" ON invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_invoices" ON invoices FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_invoices" ON invoices FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_invoices" ON invoices FOR DELETE TO authenticated USING (true);

-- ───────────────────────────── COMMUNICATIONS ─────────────────────────────
DROP POLICY IF EXISTS "anon_select_communications" ON communications;
DROP POLICY IF EXISTS "anon_insert_communications" ON communications;
DROP POLICY IF EXISTS "anon_update_communications" ON communications;
DROP POLICY IF EXISTS "anon_delete_communications" ON communications;
CREATE POLICY "auth_select_communications" ON communications FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_communications" ON communications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_communications" ON communications FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_communications" ON communications FOR DELETE TO authenticated USING (true);

-- ───────────────────────────── DOCUMENTS ─────────────────────────────
DROP POLICY IF EXISTS "anon_select_documents" ON documents;
DROP POLICY IF EXISTS "anon_insert_documents" ON documents;
DROP POLICY IF EXISTS "anon_update_documents" ON documents;
DROP POLICY IF EXISTS "anon_delete_documents" ON documents;
CREATE POLICY "auth_select_documents" ON documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_documents" ON documents FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_documents" ON documents FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_documents" ON documents FOR DELETE TO authenticated USING (true);

-- ───────────────────────────── ACTIVITY LOG ─────────────────────────────
DROP POLICY IF EXISTS "anon_select_activity_log" ON activity_log;
DROP POLICY IF EXISTS "anon_insert_activity_log" ON activity_log;
DROP POLICY IF EXISTS "anon_update_activity_log" ON activity_log;
DROP POLICY IF EXISTS "anon_delete_activity_log" ON activity_log;
CREATE POLICY "auth_select_activity_log" ON activity_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_activity_log" ON activity_log FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_activity_log" ON activity_log FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_activity_log" ON activity_log FOR DELETE TO authenticated USING (true);

-- ───────────────────────────── NICHE MARKETS ─────────────────────────────
-- Was fully exposed with RLS disabled entirely (not created by any migration
-- file in this repo — likely added directly via the dashboard or another
-- tool). Bring it in line with everything else.
ALTER TABLE niche_markets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_select_niche_markets" ON niche_markets;
DROP POLICY IF EXISTS "auth_insert_niche_markets" ON niche_markets;
DROP POLICY IF EXISTS "auth_update_niche_markets" ON niche_markets;
DROP POLICY IF EXISTS "auth_delete_niche_markets" ON niche_markets;
CREATE POLICY "auth_select_niche_markets" ON niche_markets FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_niche_markets" ON niche_markets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_niche_markets" ON niche_markets FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_niche_markets" ON niche_markets FOR DELETE TO authenticated USING (true);
