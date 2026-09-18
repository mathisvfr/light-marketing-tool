-- 019_unsplash_support.sql
-- Voegt Unsplash als bron toe aan media_library met attributie-metadata.

-- Sta 'unsplash' toe als source
ALTER TABLE media_library
  DROP CONSTRAINT media_library_source_check,
  ADD CONSTRAINT media_library_source_check
    CHECK (source IN ('upload', 'generated', 'unsplash'));

-- Unsplash attributie-metadata (NULL voor upload/generated items)
ALTER TABLE media_library
  ADD COLUMN IF NOT EXISTS unsplash_photo_id TEXT,
  ADD COLUMN IF NOT EXISTS unsplash_photographer TEXT,
  ADD COLUMN IF NOT EXISTS unsplash_photographer_url TEXT;

-- Snel opzoeken of een Unsplash-foto al in de library staat (dedup)
CREATE INDEX IF NOT EXISTS idx_media_library_unsplash_id
  ON media_library (unsplash_photo_id) WHERE unsplash_photo_id IS NOT NULL;
