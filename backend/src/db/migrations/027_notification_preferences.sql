-- 027_notification_preferences.sql
--
-- Per-user notification preferences. Controls whether email and in-app
-- notifications are sent. Event-level columns (email_draft_*) override
-- the master email_enabled toggle when explicitly set (non-null).
-- Null = follow master toggle (default behaviour).

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  in_app_enabled BOOLEAN NOT NULL DEFAULT true,
  email_draft_submitted BOOLEAN,
  email_draft_approved BOOLEAN,
  email_draft_rejected BOOLEAN,
  email_publication_fired BOOLEAN,
  updated_at TIMESTAMPTZ DEFAULT now()
);
