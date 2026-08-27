-- 012_notification_log.sql
--
-- Notification idempotency + failure audit. Every attempt to notify() a user
-- about a draft state transition writes a row here. The UNIQUE index prevents
-- double-fires (double-click on Approve, retried background job, etc). Failed
-- transports (Resend down, DNS not verified) still write a row with
-- status='failed' so we can reconcile later.
--
-- Eng review flagged idempotency + silent-Resend-failure logging as HIGH.
-- This table addresses both.

CREATE TABLE IF NOT EXISTS notification_log (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event              TEXT        NOT NULL CHECK (event IN (
    'draft.submitted', 'draft.approved', 'draft.rejected', 'publication.fired',
    'seo_submitted', 'seo_approved', 'seo_rejected', 'seo_published'
  )),
  draft_id           UUID        REFERENCES drafts(id) ON DELETE CASCADE,
  recipient_user_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status             TEXT        NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  transport          TEXT        NOT NULL,
  error_message      TEXT,
  sent_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Idempotency: one (event, draft, recipient) tuple, ever. Retries no-op.
CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_log_event_draft_recipient
  ON notification_log (event, draft_id, recipient_user_id);

CREATE INDEX IF NOT EXISTS idx_notification_log_recipient
  ON notification_log (recipient_user_id, sent_at DESC);
