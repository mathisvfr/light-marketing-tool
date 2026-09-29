-- publications: laat draft-delete doorgaan, ruim publicatie-rijen mee op
ALTER TABLE publications
  DROP CONSTRAINT publications_draft_id_fkey,
  ADD CONSTRAINT publications_draft_id_fkey
    FOREIGN KEY (draft_id) REFERENCES drafts(id) ON DELETE CASCADE;

-- activity_log: bewaar logrecord, zet draft_id op NULL
ALTER TABLE activity_log
  DROP CONSTRAINT activity_log_draft_id_fkey,
  ADD CONSTRAINT activity_log_draft_id_fkey
    FOREIGN KEY (draft_id) REFERENCES drafts(id) ON DELETE SET NULL;
