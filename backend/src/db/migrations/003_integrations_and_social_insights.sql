-- migration 003 — direct API integrations + social analytics snapshots
-- Apply in the Supabase SQL editor for project bdifrujfgmfmzvypowcz.

CREATE TABLE IF NOT EXISTS integration_credentials (
  provider TEXT PRIMARY KEY,
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS social_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  account_id TEXT NOT NULL,
  metric TEXT NOT NULL,
  period TEXT NOT NULL DEFAULT 'day',
  date DATE NOT NULL,
  value NUMERIC,
  raw JSONB,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, account_id, metric, period, date)
);

CREATE INDEX IF NOT EXISTS social_insights_provider_date_idx
  ON social_insights (provider, date DESC);
