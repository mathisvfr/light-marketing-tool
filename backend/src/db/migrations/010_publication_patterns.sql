-- 010_publication_patterns.sql
--
-- Recurring publication templates for the Kalender flow (Slice 2). A pattern
-- defines "channel X, on weekdays Y, at time Z" and is applied on demand to
-- approved marketing posts via a dropdown on the preview panel. Patterns do
-- NOT auto-fire — they are quick-schedule shortcuts, gated behind Luke's
-- approval per CLAUDE.md.

CREATE TABLE IF NOT EXISTS publication_patterns (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT        NOT NULL CHECK (name <> ''),
  channel      TEXT        NOT NULL CHECK (channel IN ('linkedin', 'facebook', 'instagram')),
  -- ISO weekdays 1..7 (Mon..Sun). Non-empty, no out-of-range values.
  weekdays     SMALLINT[]  NOT NULL CHECK (
    array_length(weekdays, 1) BETWEEN 1 AND 7
    AND weekdays <@ ARRAY[1,2,3,4,5,6,7]::smallint[]
  ),
  -- Wall-clock time in Europe/Amsterdam; server applies the zone when
  -- resolving the next slot to UTC. TIME (no zone) is the right column type.
  time_of_day  TIME        NOT NULL,
  is_active    BOOLEAN     NOT NULL DEFAULT true,
  created_by   UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_publication_patterns_active
  ON publication_patterns (is_active)
  WHERE is_active;

CREATE INDEX IF NOT EXISTS idx_publication_patterns_channel
  ON publication_patterns (channel);
