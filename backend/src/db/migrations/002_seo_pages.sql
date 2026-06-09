-- migration 002 — SEO content engine / location pages
-- Apply in the Supabase SQL editor for project bdifrujfgmfmzvypowcz.

CREATE TABLE IF NOT EXISTS seo_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sector TEXT NOT NULL,
  locatie TEXT NOT NULL,
  doelgroep TEXT NOT NULL CHECK (doelgroep IN ('werkzoekenden', 'opdrachtgevers')),
  slug TEXT UNIQUE NOT NULL,
  keywords TEXT,
  meta_title TEXT,
  meta_description TEXT,
  h1 TEXT,
  body_html TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_approval', 'approved', 'published', 'expired')),
  external_id TEXT,
  created_by UUID REFERENCES users(id),
  reviewed_by UUID REFERENCES users(id),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS seo_pages_status_idx ON seo_pages (status);
CREATE INDEX IF NOT EXISTS seo_pages_created_by_idx ON seo_pages (created_by);
