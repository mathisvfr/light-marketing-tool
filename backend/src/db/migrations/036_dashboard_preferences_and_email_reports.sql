-- 036_dashboard_preferences_and_email_reports.sql
-- User-specific widget preferences for the rapportage dashboard.
CREATE TABLE IF NOT EXISTS user_dashboard_preferences (
  user_id     UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  visible_widgets   JSONB NOT NULL DEFAULT '[]',
  date_range_default TEXT DEFAULT 'month'
    CHECK (date_range_default IN ('week', 'month', 'quarter')),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- E-mail rapport configuratie (system-wide singleton, owner beheert).
CREATE TABLE IF NOT EXISTS email_report_config (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  frequency   TEXT NOT NULL CHECK (frequency IN ('monthly', 'disabled')),
  recipients  TEXT[] NOT NULL DEFAULT ARRAY['vacature@lightpersoneelsdiensten.nl'],
  include_sections JSONB NOT NULL DEFAULT '["vacatures","marketing","website"]',
  include_ai_insights BOOLEAN NOT NULL DEFAULT true,
  day_of_month INT DEFAULT 28,
  hour        INT DEFAULT 8,
  last_sent_at TIMESTAMPTZ,
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Seed default config with fixed UUID (idempotent)
INSERT INTO email_report_config (id, frequency)
VALUES ('00000000-0000-0000-0000-000000000001', 'disabled')
ON CONFLICT (id) DO NOTHING;
