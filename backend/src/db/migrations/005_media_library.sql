-- 005_media_library.sql

CREATE TABLE media_library (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  filename    TEXT        NOT NULL,
  path        TEXT        NOT NULL,
  alt_text    TEXT,
  tags        TEXT[]      NOT NULL DEFAULT '{}',
  source      TEXT        NOT NULL CHECK (source IN ('upload', 'generated')),
  created_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  file_size   INTEGER,
  mime_type   TEXT
);

CREATE INDEX idx_media_library_source     ON media_library (source);
CREATE INDEX idx_media_library_created_at ON media_library (created_at DESC);
CREATE INDEX idx_media_library_tags       ON media_library USING GIN (tags);
