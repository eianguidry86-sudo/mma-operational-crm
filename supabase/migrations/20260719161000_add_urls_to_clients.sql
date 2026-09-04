-- Migration: Add social URLs to clients table for n8n scraping

ALTER TABLE clients
ADD COLUMN IF NOT EXISTS google_maps_url text,
ADD COLUMN IF NOT EXISTS facebook_url text;
