const express = require('express');
const { supabase } = require('../db/client');
const { requireRole } = require('../middleware/auth');
const dbSnapshotter = require('../services/metrics/db_snapshotter');
const { upsertMetric } = require('../services/metrics/upsert');

const router = express.Router();

const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET || '';

function normalizeMetrics(pub) {
  if (!pub.metrics || typeof pub.metrics !== 'object') return null;
  const m = {};
  for (const [k, v] of Object.entries(pub.metrics)) {
    m[k.toLowerCase()] = Number(v) || 0;
  }
  return {
    likes: m.reactions || m.likes || 0,
    comments: m.comments || 0,
    reach: m.impressions || m.reach || 0,
    clicks: m.clicks || 0,
    shares: m.shares || m.reposts || 0,
  };
}

function trendPct(current, previous) {
  if (!previous || previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

// GET /api/rapportage
router.get('/', async (req, res, next) => {
  try {
    const { range } = req.query;
    const now = new Date();

    let from;
    const to = now;
    if (range === 'month') {
      from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else {
      from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }
    if (req.query.from) {
      from = new Date(req.query.from);
    }

    // Previous period (same length, for trend calculation)
    const rangeDuration = to.getTime() - from.getTime();
    const prevFrom = new Date(from.getTime() - rangeDuration);
    const prevTo = from;

    // Check freshness -- refresh on demand if stale
    const { data: latestDb } = await supabase
      .from('metric_snapshot')
      .select('captured_at')
      .eq('source', 'db')
      .order('captured_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
    if (!latestDb || new Date(latestDb.captured_at) < sixHoursAgo) {
      await dbSnapshotter.run();
    }

    // Fetch all snapshots
    const { data: snapshots, error } = await supabase
      .from('metric_snapshot')
      .select('metric_key, dimensions, value, value_json, captured_at, source, bucket_date')
      .order('captured_at', { ascending: false });
    if (error) throw error;

    const latest = {};
    for (const row of snapshots || []) {
      const dimKey = JSON.stringify(row.dimensions || {});
      const compositeKey = `${row.metric_key}::${dimKey}`;
      if (!latest[compositeKey]) {
        latest[compositeKey] = row;
      }
    }

    const getValue = (key) => {
      const row = latest[`${key}::{}`];
      return row ? (row.value ?? row.value_json) : null;
    };

    const getWithDimensions = (key) => {
      const entries = [];
      for (const [compositeKey, row] of Object.entries(latest)) {
        if (compositeKey.startsWith(`${key}::`)) {
          entries.push({ dimensions: row.dimensions, value: row.value, value_json: row.value_json, captured_at: row.captured_at });
        }
      }
      return entries;
    };

    // --- Fetch ALL successful publications (engagement totals are cumulative) ---
    const { data: pubRowsAll, error: pubErr } = await supabase
      .from('publications')
      .select('channel, status, metrics, published_at, metrics_updated_at')
      .eq('status', 'success');
    if (pubErr) throw pubErr;

    // Filter to date range for charts + trends
    const pubRowsCurrent = (pubRowsAll || []).filter(
      (p) => p.published_at && new Date(p.published_at) >= from
    );
    const pubRowsPrev = (pubRowsAll || []).filter(
      (p) => p.published_at && new Date(p.published_at) >= prevFrom && new Date(p.published_at) < prevTo
    );

    // --- Aggregate engagement (current + previous + per-channel) ---
    function aggregateEngagement(rows) {
      const total = { likes: 0, comments: 0, reach: 0, clicks: 0, shares: 0 };
      const byChannel = {};
      for (const pub of rows || []) {
        const m = normalizeMetrics(pub);
        if (!m) continue;
        total.likes += m.likes;
        total.comments += m.comments;
        total.reach += m.reach;
        total.clicks += m.clicks;
        total.shares += m.shares;
        const ch = pub.channel || 'unknown';
        if (!byChannel[ch]) byChannel[ch] = { likes: 0, comments: 0, reach: 0, clicks: 0, shares: 0 };
        byChannel[ch].likes += m.likes;
        byChannel[ch].comments += m.comments;
        byChannel[ch].reach += m.reach;
        byChannel[ch].clicks += m.clicks;
        byChannel[ch].shares += m.shares;
      }
      return { total, byChannel };
    }

    // Cumulative totals (all-time) for the engagement card
    const allTime = aggregateEngagement(pubRowsAll);
    // Current period + previous period for trends
    const current = aggregateEngagement(pubRowsCurrent);
    const prev = aggregateEngagement(pubRowsPrev);

    // Engagement trends
    const engagementTrend = {};
    for (const key of Object.keys(current.total)) {
      engagementTrend[key] = trendPct(current.total[key], prev.total[key]);
    }

    // Channel breakdown from live data (#3 -- filtered to date range)
    const channelBreakdown = {};
    for (const pub of pubRowsCurrent || []) {
      const ch = pub.channel || 'unknown';
      if (!channelBreakdown[ch]) channelBreakdown[ch] = { success: 0, pending: 0, scheduled: 0, failed: 0 };
      channelBreakdown[ch].success++;
    }
    // Also count non-success in range
    const { data: allPubsInRange } = await supabase
      .from('publications')
      .select('channel, status')
      .gte('published_at', from.toISOString());
    for (const pub of allPubsInRange || []) {
      const ch = pub.channel || 'unknown';
      if (!channelBreakdown[ch]) channelBreakdown[ch] = { success: 0, pending: 0, scheduled: 0, failed: 0 };
      if (pub.status !== 'success' && channelBreakdown[ch][pub.status] !== undefined) {
        channelBreakdown[ch][pub.status]++;
      }
    }

    // Per-channel engagement (#7)
    // Per-channel: all-time totals (#7)
    const engagementByChannel = Object.entries(allTime.byChannel).map(([channel, metrics]) => ({
      channel,
      ...metrics,
    }));

    // --- Website application counts ---
    const websiteAppEntries = getWithDimensions('website.applications');
    const sollicitatiesWebsite = websiteAppEntries.reduce((sum, e) => sum + (e.value || 0), 0);

    // --- Vacature page views from Umami (#5) ---
    const allTopPages = getValue('website.pages.top') || [];
    const topVacaturePages = allTopPages
      .filter((p) => p.url && p.url.startsWith('/vacatures/') && p.url !== '/vacatures')
      .slice(0, 10);

    // --- Trend calculations for DB metrics (#1) ---
    // Compare latest snapshot vs second-latest for the same key
    function getSnapshotTrend(key) {
      const rows = (snapshots || []).filter((r) => r.metric_key === key && JSON.stringify(r.dimensions || {}) === '{}');
      if (rows.length < 2) return 0;
      const curr = rows[0].value ?? 0;
      const prev2 = rows[1].value ?? 0;
      return trendPct(curr, prev2);
    }

    const actiefCount = getValue('drafts.actief.count') ?? 0;
    const nieuwDezeWeek = getValue('drafts.vacature.new_this_week') ?? 0;

    // --- Website stats + trend (#1) ---
    const websiteStats = getValue('website.stats.daily') || { pageviews: 0, visitors: 0, bounces: 0, totaltime: 0 };
    // For website trends, fetch Umami comparison if available
    // The snapshotter stores daily stats; compare today vs yesterday from snapshots
    const websiteRows = (snapshots || []).filter((r) => r.metric_key === 'website.stats.daily');
    let websiteStatsTrend = { pageviews: 0, visitors: 0, bounces: 0 };
    if (websiteRows.length >= 2) {
      const currWs = websiteRows[0].value_json || {};
      const prevWs = websiteRows[1].value_json || {};
      websiteStatsTrend = {
        pageviews: trendPct(currWs.pageviews || 0, prevWs.pageviews || 0),
        visitors: trendPct(currWs.visitors || 0, prevWs.visitors || 0),
        bounces: trendPct(currWs.bounces || 0, prevWs.bounces || 0),
      };
    }

    // --- Per-section timestamps (#4) ---
    const latestDbCaptured = latestDb?.captured_at || null;
    const latestMarketingUpdated = (pubRowsAll || [])
      .map((p) => p.metrics_updated_at)
      .filter(Boolean)
      .sort()
      .pop() || null;
    const latestWebsite = websiteRows.length > 0 ? websiteRows[0].captured_at : null;

    // --- Weekly pageviews (#8) ---
    const pageviewsWeekly = getValue('website.pageviews.weekly') || [];

    return res.json({
      vacatures: {
        actief: actiefCount,
        actief_trend: getSnapshotTrend('drafts.actief.count'),
        nieuwDezeWeek,
        nieuwDezeWeek_trend: getSnapshotTrend('drafts.vacature.new_this_week'),
        sollicitatiesJobit: getValue('jobit.applications.count') ?? 0,
        sollicitatiesWebsite,
        topVacaturePages,
      },
      marketing: {
        postsGepubliceerd: (pubRowsAll || []).length,
        postsGepubliceerd_trend: trendPct((pubRowsCurrent || []).length, (pubRowsPrev || []).length),
        engagement: allTime.total,
        engagement_trend: engagementTrend,
        engagementByChannel,
        channelBreakdown: Object.entries(channelBreakdown).map(([channel, counts]) => ({
          channel,
          ...counts,
        })),
        contentPerWeek: getValue('content.published_per_week') || {},
      },
      website: {
        stats: websiteStats,
        stats_trend: websiteStatsTrend,
        topPages: allTopPages,
        referrers: getValue('website.referrers.top') || [],
        pageviewsWeekly,
      },
      meta: {
        lastUpdated: {
          vacatures: latestDbCaptured,
          marketing: latestMarketingUpdated,
          website: latestWebsite,
        },
        range: { from: from.toISOString(), to: to.toISOString() },
      },
    });
  } catch (error) {
    return next(error);
  }
});

// POST /api/rapportage/application
router.post('/application', async (req, res, next) => {
  try {
    if (INTERNAL_API_SECRET) {
      const provided = req.headers['x-internal-secret'] || '';
      if (provided !== INTERNAL_API_SECRET) {
        return res.status(403).json({ error: 'Ongeldige interne sleutel.' });
      }
    }

    const { vacature_id, vacature_titel, source } = req.body || {};
    if (!vacature_id) {
      return res.status(400).json({ error: 'vacature_id is verplicht.' });
    }

    await upsertMetric({
      metric_key: 'website.applications',
      dimensions: { vacature_id, titel: vacature_titel || '' },
      source: source || 'website',
      value: 1,
      captured_at: new Date(),
    });

    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' });
    const { data: existing } = await supabase
      .from('metric_snapshot')
      .select('id, value')
      .eq('metric_key', 'website.applications')
      .eq('bucket_date', today)
      .eq('dimensions', { vacature_id, titel: vacature_titel || '' })
      .maybeSingle();

    if (existing) {
      await supabase
        .from('metric_snapshot')
        .update({ value: (existing.value || 0) + 1, captured_at: new Date().toISOString() })
        .eq('id', existing.id);
    }

    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

// POST /api/rapportage/refresh
router.post('/refresh', requireRole(['owner', 'manager']), async (req, res, next) => {
  try {
    const result = await dbSnapshotter.run();
    return res.json({ success: true, ...result });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
