-- 037: Add ON DELETE CASCADE/SET NULL to FK constraints referencing drafts(id).
-- Without this, deleting a draft with publications or activity_log rows fails
-- with a foreign key violation.

-- publications: cascade — delete publications when draft is deleted
ALTER TABLE publications
  DROP CONSTRAINT IF EXISTS publications_draft_id_fkey;
ALTER TABLE publications
  ADD CONSTRAINT publications_draft_id_fkey
    FOREIGN KEY (draft_id) REFERENCES drafts(id) ON DELETE CASCADE;

-- activity_log: set null — keep the log entry but clear the draft reference
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'activity_log_draft_id_fkey'
      AND table_name = 'activity_log'
  ) THEN
    ALTER TABLE activity_log DROP CONSTRAINT activity_log_draft_id_fkey;
    ALTER TABLE activity_log
      ADD CONSTRAINT activity_log_draft_id_fkey
        FOREIGN KEY (draft_id) REFERENCES drafts(id) ON DELETE SET NULL;
  END IF;
END $$;
