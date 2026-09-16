// Website snapshotter — pulls daily stats from the self-hosted Umami instance
// and writes them to metric_snapshot. Runs nightly alongside the other
// snapshotters. No-ops gracefully when Umami isn't configured yet.
//
// Required env vars (all optional — snapshotter skips when missing):
//   UMAMI_API_URL       — e.g. http://umami:3000 (internal Docker URL)
//   UMAMI_API_TOKEN     — Bearer token (generated in Umami → Settings → API)
//   UMAMI_WEBSITE_ID    — UUID of the tracked website in Umami

const { upsertMetric } = require('./upsert');

const UMAMI_API_URL = process.env.UMAMI_API_URL;
const UMAMI_API_TOKEN = process.env.UMAMI_API_TOKEN;
const UMAMI_WEBSITE_ID = process.env.UMAMI_WEBSITE_ID;

function isConfigured() {
  return Boolean(UMAMI_API_URL && UMAMI_API_TOKEN && UMAMI_WEBSITE_ID);
}

async function umamiGet(path) {
  const url = `${UMAMI_API_URL}/api/websites/${UMAMI_WEBSITE_ID}${path}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${UMAMI_API_TOKEN}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`Umami ${response.status}: ${url}`);
  }
  return response.json();
}

async function run() {
  const results = { written: 0, skipped: 0, errors: [] };

  if (!isConfigured()) {
    return { ...results, skipped: 1, reason: 'Umami niet geconfigureerd (UMAMI_API_URL/TOKEN/WEBSITE_ID ontbreekt).' };
  }

  const now = new Date();
  // Snapshot yesterday's full-day stats (complete data, no partial day)
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const startAt = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate()).getTime();
  const endAt = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const range = `startAt=${startAt}&endAt=${endAt}`;

  try {
    // 1. Overall stats: pageviews, visitors, bounces, totaltime
    const stats = await umamiGet(`/stats?${range}`);
    await upsertMetric({
      metric_key: 'website.stats.daily',
      source: 'website',
      value_json: {
        pageviews: stats.pageviews?.value ?? 0,
        visitors: stats.visitors?.value ?? 0,
        bounces: stats.bounces?.value ?? 0,
        totaltime: stats.totaltime?.value ?? 0,
      },
      captured_at: yesterday,
    });
    results.written++;
  } catch (err) {
    results.errors.push(`stats: ${err.message}`);
  }

  try {
    // 2. Top pages
    const pages = await umamiGet(`/metrics?type=url&${range}&limit=20`);
    await upsertMetric({
      metric_key: 'website.pages.top',
      source: 'website',
      value_json: (pages || []).map((p) => ({ url: p.x, views: p.y })),
      captured_at: yesterday,
    });
    results.written++;
  } catch (err) {
    results.errors.push(`pages: ${err.message}`);
  }

  try {
    // 3. Top referrers
    const referrers = await umamiGet(`/metrics?type=referrer&${range}&limit=20`);
    await upsertMetric({
      metric_key: 'website.referrers.top',
      source: 'website',
      value_json: (referrers || []).map((r) => ({ referrer: r.x, visits: r.y })),
      captured_at: yesterday,
    });
    results.written++;
  } catch (err) {
    results.errors.push(`referrers: ${err.message}`);
  }

  try {
    // 4. Devices / browsers (useful for Sandra's reader)
    const devices = await umamiGet(`/metrics?type=device&${range}&limit=10`);
    await upsertMetric({
      metric_key: 'website.devices',
      source: 'website',
      value_json: (devices || []).map((d) => ({ device: d.x, count: d.y })),
      captured_at: yesterday,
    });
    results.written++;
  } catch (err) {
    results.errors.push(`devices: ${err.message}`);
  }

  return results;
}

module.exports = { run, isConfigured };
