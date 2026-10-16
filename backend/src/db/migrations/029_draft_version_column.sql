-- Optimistic locking for draft lifecycle operations (approve, reject, submit, publish).
-- Only status-changing operations increment the version; autosave PATCHes to
-- form_data do NOT, so concurrent autosave and approval don't conflict.
ALTER TABLE drafts ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
