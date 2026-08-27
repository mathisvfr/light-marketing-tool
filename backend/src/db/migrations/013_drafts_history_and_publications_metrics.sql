-- 013_drafts_history_and_publications_metrics.sql
--
-- Two additive columns that unlock Push 2 (version history) and Push 3
-- (engagement stats). Idempotent, safe to re-run.
--
-- Bundled because both are pure "ADD COLUMN IF NOT EXISTS" and there's no
-- deploy value in shipping them separately. Migration 014 would have been the
-- same file with one line.

ALTER TABLE drafts       ADD COLUMN IF NOT EXISTS generation_history JSONB DEFAULT '[]'::JSONB;
ALTER TABLE publications ADD COLUMN IF NOT EXISTS metrics            JSONB;
ALTER TABLE publications ADD COLUMN IF NOT EXISTS metrics_updated_at TIMESTAMPTZ;
