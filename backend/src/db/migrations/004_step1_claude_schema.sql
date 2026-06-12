CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'recruiter', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('vacature', 'marketing-post')),
  form_data JSONB NOT NULL,
  titel TEXT,
  plaats TEXT,
  omschrijving_nl TEXT,
  omschrijving_pl TEXT,
  functie_eisen TEXT,
  wat_wij_bieden TEXT,
  salaris TEXT,
  uren TEXT,
  contract TEXT,
  sollicitatie_url TEXT,
  linkedin_post TEXT,
  facebook_post TEXT,
  instagram_caption TEXT,
  image_path TEXT,
  social_nl TEXT,
  social_pl TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (
      status IN (
        'draft',
        'pending_approval',
        'approved',
        'actief',
        'published',
        'expired',
        'rejected'
      )
    ),
  criticus_passed BOOLEAN DEFAULT false,
  criticus_notes TEXT,
  created_by UUID REFERENCES users(id),
  reviewed_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE drafts ADD COLUMN IF NOT EXISTS titel TEXT;
ALTER TABLE drafts ADD COLUMN IF NOT EXISTS plaats TEXT;
ALTER TABLE drafts ADD COLUMN IF NOT EXISTS omschrijving_nl TEXT;
ALTER TABLE drafts ADD COLUMN IF NOT EXISTS omschrijving_pl TEXT;
ALTER TABLE drafts ADD COLUMN IF NOT EXISTS functie_eisen TEXT;
ALTER TABLE drafts ADD COLUMN IF NOT EXISTS wat_wij_bieden TEXT;
ALTER TABLE drafts ADD COLUMN IF NOT EXISTS salaris TEXT;
ALTER TABLE drafts ADD COLUMN IF NOT EXISTS uren TEXT;
ALTER TABLE drafts ADD COLUMN IF NOT EXISTS contract TEXT;
ALTER TABLE drafts ADD COLUMN IF NOT EXISTS sollicitatie_url TEXT;
ALTER TABLE drafts ADD COLUMN IF NOT EXISTS facebook_post TEXT;
ALTER TABLE drafts ADD COLUMN IF NOT EXISTS instagram_caption TEXT;
ALTER TABLE drafts ADD COLUMN IF NOT EXISTS image_path TEXT;
ALTER TABLE drafts ADD COLUMN IF NOT EXISTS criticus_passed BOOLEAN DEFAULT false;
ALTER TABLE drafts ADD COLUMN IF NOT EXISTS criticus_notes TEXT;
ALTER TABLE drafts ADD COLUMN IF NOT EXISTS social_nl TEXT;
ALTER TABLE drafts ADD COLUMN IF NOT EXISTS social_pl TEXT;
ALTER TABLE drafts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'drafts'
      AND column_name = 'status'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE drafts ALTER COLUMN status SET NOT NULL;
  END IF;

  ALTER TABLE drafts ALTER COLUMN status SET DEFAULT 'draft';

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'drafts_status_check'
  ) THEN
    ALTER TABLE drafts DROP CONSTRAINT drafts_status_check;
  END IF;

  ALTER TABLE drafts
    ADD CONSTRAINT drafts_status_check
    CHECK (
      status IN (
        'draft',
        'pending_approval',
        'approved',
        'actief',
        'published',
        'expired',
        'rejected'
      )
    );
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'drafts_type_check'
  ) THEN
    ALTER TABLE drafts DROP CONSTRAINT drafts_type_check;
  END IF;

  ALTER TABLE drafts
    ADD CONSTRAINT drafts_type_check
    CHECK (type IN ('vacature', 'marketing-post'));
END
$$;

CREATE TABLE IF NOT EXISTS publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id UUID REFERENCES drafts(id),
  channel TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'success', 'failed')),
  external_id TEXT,
  error_message TEXT,
  published_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS channel_credentials (
  channel TEXT PRIMARY KEY,
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  status TEXT DEFAULT 'disconnected'
    CHECK (status IN ('connected', 'expiring', 'disconnected')),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS brand_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT,
  summary TEXT,
  source_links JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  summary TEXT,
  status TEXT DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT now()
);
