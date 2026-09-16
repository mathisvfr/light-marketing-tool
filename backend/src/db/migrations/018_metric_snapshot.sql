-- 018_metric_snapshot
-- Extensible metrics layer for the /rapportage page.
-- One row per metric per day per dimension-set. Snapshotters upsert via
-- ON CONFLICT so re-runs never duplicate.

CREATE TABLE IF NOT EXISTS metric_snapshot (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_key    TEXT NOT NULL,
  dimensions    JSONB NOT NULL DEFAULT '{}',
  value         NUMERIC,
  value_json    JSONB,
  captured_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  source        TEXT NOT NULL,
  bucket_date   DATE GENERATED ALWAYS AS ((captured_at AT TIME ZONE 'Europe/Amsterdam')::date) STORED
);

-- Upsert key: one row per metric per day per dimension-set.
CREATE UNIQUE INDEX IF NOT EXISTS uq_metric_snapshot_key_date_dims
  ON metric_snapshot (metric_key, bucket_date, md5(dimensions::text));

-- Read index: newest snapshots per metric.
CREATE INDEX IF NOT EXISTS idx_metric_snapshot_key_captured
  ON metric_snapshot (metric_key, captured_at DESC);

-- Retention queries filter on captured_at.
CREATE INDEX IF NOT EXISTS idx_metric_snapshot_captured
  ON metric_snapshot (captured_at);
