-- 035_calendar_scheduling.sql
--
-- Extends the schema for the content calendar & scheduling feature (#10, #11).
-- Design spec: docs/designs/content-calendar-scheduling.md
--
-- Changes:
--   1. Widen publication_patterns.channel CHECK to include 'feed' and 'website'
--   2. Add content_type column to publication_patterns
--   3. Add scheduled_for column to drafts (for vacatures/blogs calendar display)
--   4. Add parent_draft_id column to drafts (cross-type blog->social)
--   5. Indexes for calendar date-range queries and pattern lookups
--   6. Seed default patterns for vacatures and blogs

-- 1. Widen channel CHECK constraint so 'feed' and 'website' are also allowed.
-- Existing constraint only allows 'linkedin','facebook','instagram'.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'publication_patterns_channel_check'
  ) THEN
    ALTER TABLE publication_patterns DROP CONSTRAINT publication_patterns_channel_check;
  END IF;

  ALTER TABLE publication_patterns
    ADD CONSTRAINT publication_patterns_channel_check
    CHECK (channel IN ('linkedin', 'facebook', 'instagram', 'feed', 'website'));
END
$$;

-- 2. Add content_type to publication_patterns. Existing rows default to 'marketing-post'.
ALTER TABLE publication_patterns
  ADD COLUMN IF NOT EXISTS content_type TEXT
    NOT NULL DEFAULT 'marketing-post'
    CHECK (content_type IN ('vacature', 'marketing-post', 'blog'));

-- Index for smart-schedule lookups by type + channel
CREATE INDEX IF NOT EXISTS idx_patterns_type_channel
  ON publication_patterns (content_type, channel)
  WHERE is_active;

-- 3. Add scheduled_for to drafts (vacatures and blogs use this for calendar display
-- and delayed activation; marketing-posts keep using publications.scheduled_for).
ALTER TABLE drafts
  ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ;

-- Index for calendar date-range queries
CREATE INDEX IF NOT EXISTS idx_drafts_scheduled_for
  ON drafts (scheduled_for) WHERE scheduled_for IS NOT NULL;

-- 4. Cross-type link: which draft triggered a derived draft
ALTER TABLE drafts
  ADD COLUMN IF NOT EXISTS parent_draft_id UUID REFERENCES drafts(id);

-- 5. Seed default patterns for new content types.
-- vacature/feed: Ma-Vr 08:00
INSERT INTO publication_patterns (name, channel, content_type, weekdays, time_of_day, is_active)
VALUES ('Vacatures werkdagen ochtend', 'feed', 'vacature', ARRAY[1,2,3,4,5]::smallint[], '08:00', true)
ON CONFLICT DO NOTHING;

-- blog/website: Di, Do 10:00
INSERT INTO publication_patterns (name, channel, content_type, weekdays, time_of_day, is_active)
VALUES ('Blog dinsdag en donderdag', 'website', 'blog', ARRAY[2,4]::smallint[], '10:00', true)
ON CONFLICT DO NOTHING;
