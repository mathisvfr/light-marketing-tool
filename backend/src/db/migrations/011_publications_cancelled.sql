-- 011_publications_cancelled.sql
--
-- Add a 'cancelled' status + cancelled_at timestamp so cancelled Buffer posts
-- can be distinguished from failed ones. Overloading status='failed' with
-- error_message='Handmatig geannuleerd' was flagged in the autoplan review
-- as a data-model bug (Design + Eng consensus).
--
-- The check constraint from migration 008 also needs to include 'cancelled'.
-- Drop-and-recreate via a DO block, same pattern.

ALTER TABLE publications ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

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
    CHECK (status IN ('pending', 'success', 'failed', 'scheduled', 'cancelled'));
END $$;

CREATE INDEX IF NOT EXISTS idx_publications_cancelled_at
  ON publications (cancelled_at)
  WHERE cancelled_at IS NOT NULL;
