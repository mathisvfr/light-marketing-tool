// DB snapshotter — reads drafts + publications tables directly and writes
// count/breakdown snapshots to metric_snapshot. Runs nightly and on-demand
// from /rapportage when the newest snapshot for a key is >6h old.

const { supabase } = require('../../db/client');
const { upsertMetric } = require('./upsert');

async function run({ from, to } = {}) {
  const now = new Date();
  const results = { written: 0, skipped: 0, errors: [] };

  try {
    // 1. Active vacatures count
    const { count: activeVacatures, error: e1 } = await supabase
      .from('drafts')
      .select('*', { count: 'exact', head: true })
      .eq('type', 'vacature')
      .eq('status', 'actief');
    if (e1) throw e1;

    await upsertMetric({
      metric_key: 'drafts.actief.count',
      source: 'db',
      value: activeVacatures || 0,
      captured_at: now,
    });
    results.written++;

    // 2. New vacatures this week (last 7 days)
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const { count: newVacatures, error: e2 } = await supabase
      .from('drafts')
      .select('*', { count: 'exact', head: true })
      .eq('type', 'vacature')
      .gte('created_at', weekAgo.toISOString());
    if (e2) throw e2;

    await upsertMetric({
      metric_key: 'drafts.vacature.new_this_week',
      source: 'db',
      value: newVacatures || 0,
      captured_at: now,
    });
    results.written++;

    // 3. Marketing posts published (via Buffer, status success)
    const { count: marketingPublished, error: e3 } = await supabase
      .from('publications')
      .select('*', { count: 'exact', head: true })
      .eq('via', 'buffer')
      .eq('status', 'success');
    if (e3) throw e3;

    await upsertMetric({
      metric_key: 'publications.buffer.success.count',
      source: 'db',
      value: marketingPublished || 0,
      captured_at: now,
    });
    results.written++;

    // 4. Per-channel publication breakdown
    const { data: channelBreakdown, error: e4 } = await supabase
      .from('publications')
      .select('channel, status');
    if (e4) throw e4;

    const channelCounts = {};
    for (const row of channelBreakdown || []) {
      const ch = row.channel || 'unknown';
      if (!channelCounts[ch]) {
        channelCounts[ch] = { success: 0, pending: 0, scheduled: 0, failed: 0 };
      }
      const s = row.status || 'pending';
      if (channelCounts[ch][s] !== undefined) {
        channelCounts[ch][s]++;
      }
    }

    for (const [channel, counts] of Object.entries(channelCounts)) {
      await upsertMetric({
        metric_key: 'publications.by_channel',
        dimensions: { channel },
        source: 'db',
        value_json: counts,
        captured_at: now,
      });
      results.written++;
    }

    // 5. Status distribution (all drafts)
    const { data: allDrafts, error: e5 } = await supabase
      .from('drafts')
      .select('status');
    if (e5) throw e5;

    const statusCounts = {};
    for (const row of allDrafts || []) {
      const s = row.status || 'draft';
      statusCounts[s] = (statusCounts[s] || 0) + 1;
    }

    await upsertMetric({
      metric_key: 'drafts.status_distribution',
      source: 'db',
      value_json: statusCounts,
      captured_at: now,
    });
    results.written++;

    // 6. Content published per week (last 8 weeks) — for the chart
    const eightWeeksAgo = new Date(now.getTime() - 8 * 7 * 24 * 60 * 60 * 1000);
    const { data: recentDrafts, error: e6 } = await supabase
      .from('drafts')
      .select('type, status, updated_at')
      .in('status', ['published', 'actief'])
      .gte('updated_at', eightWeeksAgo.toISOString());
    if (e6) throw e6;

    const weekBuckets = {};
    for (const row of recentDrafts || []) {
      const d = new Date(row.updated_at);
      const weekKey = getISOWeekLabel(d);
      if (!weekBuckets[weekKey]) {
        weekBuckets[weekKey] = { vacature: 0, marketing: 0 };
      }
      if (row.type === 'vacature') {
        weekBuckets[weekKey].vacature++;
      } else {
        weekBuckets[weekKey].marketing++;
      }
    }

    await upsertMetric({
      metric_key: 'content.published_per_week',
      source: 'db',
      value_json: weekBuckets,
      captured_at: now,
    });
    results.written++;

  } catch (err) {
    results.errors.push(err.message || String(err));
  }

  return results;
}

function getISOWeekLabel(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `W${String(weekNo).padStart(2, '0')}`;
}

module.exports = { run };
