const express = require('express');
const { supabase } = require('../db/client');
const { requireRole } = require('../middleware/auth');
const dbSnapshotter = require('../services/metrics/db_snapshotter');
const { upsertMetric } = require('../services/metrics/upsert');

const router = express.Router();

const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET || '';

// GET /api/rapportage -- main data endpoint. Any authenticated user.
// Reads exclusively from metric_snapshot. Structured as 3 sections:
// vacatures, marketing, website.
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

    // Group by metric_key, take latest per key+dimensions
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

    // Sum up website application counts from metric_snapshot
    const websiteAppEntries = getWithDimensions('website.applications');
    const sollicitatiesWebsite = websiteAppEntries.reduce((sum, e) => sum + (e.value || 0), 0);

    // --- Section 1: Vacatures ---
    const vacatures = {
      actief: getValue('drafts.actief.count') ?? 0,
      nieuwDezeWeek: getValue('drafts.vacature.new_this_week') ?? 0,
      sollicitatiesJobit: getValue('jobit.applications.count') ?? 0,
      sollicitatiesWebsite,
    };

    // --- Section 2: Marketing ---
    const marketing = {
      postsGepubliceerd: getValue('publications.buffer.success.count') ?? 0,
      engagement: getValue('buffer.engagement.totals') || { likes: 0, comments: 0, reach: 0, clicks: 0, shares: 0 },
      channelBreakdown: getWithDimensions('publications.by_channel').map((entry) => ({
        channel: entry.dimensions?.channel || 'unknown',
        ...entry.value_json,
      })),
      contentPerWeek: getValue('content.published_per_week') || {},
    };

    // --- Section 3: Website ---
    const website = {
      stats: getValue('website.stats.daily') || { pageviews: 0, visitors: 0, bounces: 0, totaltime: 0 },
      topPages: getValue('website.pages.top') || [],
      referrers: getValue('website.referrers.top') || [],
    };

    // --- Charts (cross-section) ---
    const charts = {
      statusDistribution: getValue('drafts.status_distribution') || {},
    };

    const oldestDbSnapshot = latestDb?.captured_at || null;

    return res.json({
      vacatures,
      marketing,
      website,
      charts,
      meta: {
        lastDbSnapshot: oldestDbSnapshot,
        range: { from: from.toISOString(), to: to.toISOString() },
      },
    });
  } catch (error) {
    return next(error);
  }
});

// POST /api/rapportage/application -- internal endpoint for the website to
// report a successful application. Validated via shared secret (INTERNAL_API_SECRET).
// Fire-and-forget from the website; never blocks the applicant's response.
router.post('/application', async (req, res, next) => {
  try {
    // Validate shared secret if configured
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

    // For cumulative counting: increment instead of upsert.
    // Since upsertMetric does upsert-per-day, we need to add to existing value.
    // Read current value for today and increment.
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

// POST /api/rapportage/refresh -- owner-only force-refresh of DB snapshots
router.post('/refresh', requireRole('owner'), async (req, res, next) => {
  try {
    const result = await dbSnapshotter.run();
    return res.json({ success: true, ...result });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
