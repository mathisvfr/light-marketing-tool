-- 009_users_onboarded_at.sql
--
-- Per-user "has seen the onboarding checklist" flag. Backfills existing users
-- to their created_at so nobody who has been using the tool suddenly sees the
-- checklist on their next login.

ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ;

UPDATE users SET onboarded_at = created_at WHERE onboarded_at IS NULL;
