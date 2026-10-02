// Shared upsert helper for all snapshotters. Writes one metric row to
// metric_snapshot, upserting on (metric_key, bucket_date, dimensions hash).

const { supabase } = require('../../db/client');

/**
 * Upsert a single metric snapshot row.
 *
 * @param {object} opts
 * @param {string} opts.metric_key  e.g. 'drafts.actief.count'
 * @param {object} [opts.dimensions]  e.g. { channel: 'linkedin' }
 * @param {number|null} [opts.value]
 * @param {object|null} [opts.value_json]
 * @param {string} opts.source  e.g. 'db', 'buffer', 'manual'
 * @param {Date}   [opts.captured_at]  defaults to now
 */
async function upsertMetric({ metric_key, dimensions = {}, value = null, value_json = null, source, captured_at }) {
  const capturedAt = captured_at || new Date();

  const row = {
    metric_key,
    dimensions,
    value,
    value_json,
    source,
    captured_at: capturedAt.toISOString(),
  };

  const { error: insertError } = await supabase.from('metric_snapshot').insert(row);

  if (insertError) {
    // 23505 = unique_violation — row already exists for this key+date+dims.
    // Delete the old row and re-insert. Supabase JS can't reliably .eq() on
    // JSONB dimensions, and the unique index uses md5(dimensions::text) which
    // we can't target from the client. Delete+insert is safe because the
    // unique index guarantees at most one row per key+date+dims.
    if (insertError.code === '23505') {
      const bucketDate = toBucketDate(capturedAt);
      const { error: deleteError } = await supabase
        .from('metric_snapshot')
        .delete()
        .eq('metric_key', metric_key)
        .eq('bucket_date', bucketDate)
        .filter('dimensions', 'eq', JSON.stringify(dimensions));

      if (deleteError) throw deleteError;

      const { error: reinsertError } = await supabase.from('metric_snapshot').insert(row);
      if (reinsertError) throw reinsertError;
      return 'updated';
    }
    throw insertError;
  }

  return 'inserted';
}

/** Convert a JS Date to a YYYY-MM-DD string in Europe/Amsterdam timezone. */
function toBucketDate(date) {
  return date.toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' });
}

module.exports = { upsertMetric, toBucketDate };
