-- publications: laat draft-delete doorgaan, ruim publicatie-rijen mee op
ALTER TABLE publications
  DROP CONSTRAINT publications_draft_id_fkey,
  ADD CONSTRAINT publications_draft_id_fkey
    FOREIGN KEY (draft_id) REFERENCES drafts(id) ON DELETE CASCADE;

-- activity_log: uses generic resource_id (no FK to drafts), so no constraint
-- change needed. Deleted draft references stay as orphaned resource_id values
-- with resource_type='draft'; the log entry itself is preserved.
