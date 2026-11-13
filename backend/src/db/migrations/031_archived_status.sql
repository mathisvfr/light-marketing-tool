-- 031_archived_status.sql
--
-- Voegt 'archived' toe aan de drafts status CHECK constraint en
-- een archived_at timestamp voor auto-archive tracking.

DO $$
BEGIN
  -- Drop + recreate constraint (idempotent patroon uit 004)
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
        'rejected',
        'archived'
      )
    );
END
$$;

-- Tijdstip waarop het item gearchiveerd is (handmatig of automatisch).
-- NULL = niet gearchiveerd. Wordt teruggezet naar NULL bij de-archiveren.
ALTER TABLE drafts
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- De vorige status voordat het item gearchiveerd werd, zodat de-archiveren
-- de draft terugzet naar de oorspronkelijke status.
ALTER TABLE drafts
  ADD COLUMN IF NOT EXISTS pre_archive_status TEXT;

-- Index voor de auto-archive cron: vindt snel oude draft/rejected items.
CREATE INDEX IF NOT EXISTS idx_drafts_stale
  ON drafts(status, updated_at)
  WHERE status IN ('draft', 'rejected');
