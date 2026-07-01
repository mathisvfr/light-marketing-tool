-- 006_publications_expired_at.sql
--
-- Ensures publications.expired_at exists. routes/publish.js and
-- services/publication.js both read/write this column, but 004_step1_claude_schema.sql
-- recreates publications with `CREATE TABLE IF NOT EXISTS` and WITHOUT expired_at.
-- On a database created from 004 alone, the published-page query would 500.
-- Idempotent: safe to run whether or not the column already exists (e.g. from 001_init.sql).

ALTER TABLE publications ADD COLUMN IF NOT EXISTS expired_at TIMESTAMPTZ;
