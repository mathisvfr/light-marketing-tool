// Buffer snapshotter — nightly cron that pulls per-post engagement metrics
// from Buffer's GraphQL API and writes aggregated snapshots to metric_snapshot.
//
// Strategy: iterate published posts from the last 30 days (from publications
// table where via='buffer'), oldest-refresh-first. Rate-limit: 200ms spacing,
// hard cap of 100 API calls per run. Unfinished posts resume next night.

const { supabase } = require('../../db/client');
const { upsertMetric } = require('./upsert');

const BUFFER_API_URL = process.env.BUFFER_API_URL || 'https://api.buffer.com';
const MAX_API_CALLS = 100;
const CALL_SPACING_MS = 200;

async function getBufferToken() {
  const { data } = await supabase
    .from('channel_credentials')
    .select('access_token')
    .eq('provider', 'buffer')
    .maybeSingle();
  return data?.access_token || process.env.BUFFER_API_KEY || null;
}

async function fetchPostMetrics(externalId, token) {
  const query = `
    query BufferPostMetrics {
      post(id: ${JSON.stringify(externalId)}) {
        id
        metrics { name value }
        sentAt
      }
    }
  `;
  const response = await fetch(BUFFER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`Buffer HTTP ${response.status}`);
  }
  const payload = await response.json();
  if (payload?.errors?.length) {
    throw new Error(payload.errors[0]?.message || 'Buffer error');
  }
  return payload?.data?.post || null;
}

async function run() {
  const results = { written: 0, skipped: 0, errors: [] };

  const token = await getBufferToken();
  if (!token) {
    results.skipped = 1;
    return results;
  }

  // Get published Buffer posts from last 30 days, oldest metrics_updated_at first
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const { data: posts, error } = await supabase
    .from('publications')
    .select('id, external_id, channel, metrics_updated_at')
    .eq('via', 'buffer')
    .eq('status', 'success')
    .not('external_id', 'is', null)
    .gte('published_at', thirtyDaysAgo.toISOString())
    .order('metrics_updated_at', { ascending: true, nullsFirst: true })
    .limit(MAX_API_CALLS);

  if (error) {
    results.errors.push(error.message);
    return results;
  }

  if (!posts || posts.length === 0) {
    return results;
  }

  // Aggregate metrics across all posts for today's snapshot
  const totals = { likes: 0, comments: 0, reach: 0, clicks: 0, shares: 0 };
  const perChannel = {};
  let apiCalls = 0;

  for (const pub of posts) {
    if (apiCalls >= MAX_API_CALLS) break;

    try {
      const post = await fetchPostMetrics(pub.external_id, token);
      apiCalls++;

      if (post?.metrics) {
        const metrics = {};
        for (const m of post.metrics) {
          if (m?.name && typeof m.value !== 'undefined') {
            metrics[m.name] = Number(m.value) || 0;
          }
        }

        // Accumulate totals
        totals.likes += metrics.likes || metrics.reactions || 0;
        totals.comments += metrics.comments || 0;
        totals.reach += metrics.reach || metrics.impressions || 0;
        totals.clicks += metrics.clicks || 0;
        totals.shares += metrics.shares || metrics.reposts || 0;

        // Per-channel accumulation
        const ch = pub.channel || 'unknown';
        if (!perChannel[ch]) {
          perChannel[ch] = { likes: 0, comments: 0, reach: 0, clicks: 0, shares: 0 };
        }
        perChannel[ch].likes += metrics.likes || metrics.reactions || 0;
        perChannel[ch].comments += metrics.comments || 0;
        perChannel[ch].reach += metrics.reach || metrics.impressions || 0;
        perChannel[ch].clicks += metrics.clicks || 0;
        perChannel[ch].shares += metrics.shares || metrics.reposts || 0;

        // Update the publication's metrics_updated_at so next run picks older ones first
        await supabase
          .from('publications')
          .update({ metrics_updated_at: new Date().toISOString() })
          .eq('id', pub.id);
      }
    } catch (err) {
      results.errors.push(`${pub.external_id}: ${err.message}`);
    }

    // Rate-limit spacing
    if (apiCalls < posts.length) {
      await new Promise((r) => setTimeout(r, CALL_SPACING_MS));
    }
  }

  const now = new Date();

  // Write aggregated engagement snapshot
  await upsertMetric({
    metric_key: 'buffer.engagement.totals',
    source: 'buffer',
    value_json: totals,
    captured_at: now,
  });
  results.written++;

  // Write per-channel engagement snapshots
  for (const [channel, metrics] of Object.entries(perChannel)) {
    await upsertMetric({
      metric_key: 'buffer.engagement.by_channel',
      dimensions: { channel },
      source: 'buffer',
      value_json: metrics,
      captured_at: now,
    });
    results.written++;
  }

  return results;
}

module.exports = { run };
