-- publications: laat draft-delete doorgaan, ruim publicatie-rijen mee op
ALTER TABLE publications
  DROP CONSTRAINT publications_draft_id_fkey,
  ADD CONSTRAINT publications_draft_id_fkey
    FOREIGN KEY (draft_id) REFERENCES drafts(id) ON DELETE CASCADE;

-- activity_log: bewaar logrecord, zet draft_id op NULL
-- Constraint may not exist (CREATE TABLE IF NOT EXISTS), so drop conditionally
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'activity_log'::regclass
      AND conname LIKE '%draft_id%'
  ) THEN
    EXECUTE 'ALTER TABLE activity_log DROP CONSTRAINT '
      || (SELECT conname FROM pg_constraint
          WHERE conrelid = 'activity_log'::regclass
            AND conname LIKE '%draft_id%' LIMIT 1);
  END IF;
END $$;
ALTER TABLE activity_log
  ADD CONSTRAINT activity_log_draft_id_fkey
    FOREIGN KEY (draft_id) REFERENCES drafts(id) ON DELETE SET NULL;
