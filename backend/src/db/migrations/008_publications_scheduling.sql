-- 008_publications_scheduling.sql
--
-- Tracks Buffer-scheduled posts inside our own DB so the Gepubliceerd view can
-- show what is queued for the future without a round-trip to Buffer's UI.
-- Idempotent: safe to re-run.

ALTER TABLE publications ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ;

-- The original status CHECK constraint from 001_init.sql only allows
-- ('pending','success','failed'). Extend to include 'scheduled' so we can
-- distinguish "Buffer accepted for future publication" from "already live".
-- Drop-and-recreate is necessary because Postgres has no ALTER CONSTRAINT
-- for CHECK; done idempotently by looking up the constraint name first.
DO $$
DECLARE
  status_check_name TEXT;
BEGIN
  SELECT conname INTO status_check_name
  FROM pg_constraint
  WHERE conrelid = 'public.publications'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%status%';

  IF status_check_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE publications DROP CONSTRAINT %I', status_check_name);
  END IF;

  ALTER TABLE publications
    ADD CONSTRAINT publications_status_check
    CHECK (status IN ('pending', 'success', 'failed', 'scheduled'));
END $$;

CREATE INDEX IF NOT EXISTS idx_publications_scheduled_for
  ON publications (scheduled_for)
  WHERE scheduled_for IS NOT NULL;
