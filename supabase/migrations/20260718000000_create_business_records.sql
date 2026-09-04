-- Migration: Create business_records table to align with Python Scoring Engine

CREATE TABLE IF NOT EXISTS business_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  industry text,
  lat numeric,
  lng numeric,
  zip_code text,
  own_reviews_summary text,
  reddit_sentiment_summary text,
  competitor_landscape jsonb,
  bbb_rating text,
  
  -- Python Engine Output Scores
  marketmap_opportunity_score numeric,
  demographic_score numeric,
  competition_score numeric,
  events_score numeric,
  timing_score numeric,
  resources_score numeric,
  environmental_score numeric,
  scored_at timestamptz,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE business_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_business_records" ON business_records;
CREATE POLICY "anon_select_business_records" ON business_records FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_business_records" ON business_records;
CREATE POLICY "anon_insert_business_records" ON business_records FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_business_records" ON business_records;
CREATE POLICY "anon_update_business_records" ON business_records FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_business_records" ON business_records;
CREATE POLICY "anon_delete_business_records" ON business_records FOR DELETE TO anon, authenticated USING (true);
