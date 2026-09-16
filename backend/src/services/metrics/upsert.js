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

  // Supabase JS doesn't support ON CONFLICT with generated columns directly,
  // so we use an RPC-style raw upsert via .rpc or fall back to a two-step
  // select+insert/update. The simplest reliable approach: use the Postgres
  // function via supabase.rpc, but since we may not have that function, we
  // do insert with onConflict.
  //
  // Actually, Supabase JS .upsert() supports onConflict columns. The unique
  // index is on (metric_key, bucket_date, md5(dimensions::text)) which
  // involves expressions, so .upsert() can't target it directly.
  //
  // Safest: try insert, catch unique violation, then update.
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
    // 23505 = unique_violation — row already exists for this key+date+dims
    if (insertError.code === '23505') {
      // Update existing row. We need to match on the same key+date+dims.
      // Use a raw filter to match the bucket_date and dimensions hash.
      const bucketDate = toBucketDate(capturedAt);
      const { error: updateError } = await supabase
        .from('metric_snapshot')
        .update({ value, value_json, captured_at: capturedAt.toISOString() })
        .eq('metric_key', metric_key)
        .eq('bucket_date', bucketDate)
        // dimensions match via equality (JSONB =)
        .eq('dimensions', dimensions);

      if (updateError) throw updateError;
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
