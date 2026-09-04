-- Migration: Create crm_customers table for client CSV ingestion

CREATE TABLE IF NOT EXISTS crm_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_owner_id uuid NOT NULL, -- references projects(id) conceptually
  
  -- Required fields from canonical schema
  customer_id text NOT NULL,
  address text NOT NULL,
  total_revenue numeric NOT NULL,
  total_visits integer NOT NULL,
  
  -- Optional fields
  first_name text,
  last_name text,
  city text,
  state text,
  zip_code text,
  primary_service_type text,
  first_service_date date,
  last_service_date date,
  avg_ticket_size numeric,
  lifetime_value numeric,
  status text,
  acquisition_channel text,
  
  -- Geocoding (calculated in UI before saving)
  lat numeric,
  lng numeric,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE crm_customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_crm_customers" ON crm_customers;
CREATE POLICY "anon_select_crm_customers" ON crm_customers FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_crm_customers" ON crm_customers;
CREATE POLICY "anon_insert_crm_customers" ON crm_customers FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_crm_customers" ON crm_customers;
CREATE POLICY "anon_update_crm_customers" ON crm_customers FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_crm_customers" ON crm_customers;
CREATE POLICY "anon_delete_crm_customers" ON crm_customers FOR DELETE TO anon, authenticated USING (true);
