const express = require('express');
const { supabase } = require('../db/client');
const { requireRole } = require('../middleware/auth');
const { fetchMetaInsights } = require('../services/meta');

const router = express.Router();

function toIsoDate(value, fallback) {
  if (!value) {
    return fallback;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }
  return date.toISOString().slice(0, 10);
}

function flattenMetrics(provider, accountId, metrics) {
  const rows = [];

  for (const metric of metrics || []) {
    const values = Array.isArray(metric.values) ? metric.values : [];

    for (const point of values) {
      const day = point?.end_time ? String(point.end_time).slice(0, 10) : null;
      if (!day) {
        continue;
      }

      rows.push({
        provider,
        account_id: accountId,
        metric: metric.name,
        period: metric.period || 'day',
        date: day,
        value: Number(point.value || 0),
        raw: point,
        fetched_at: new Date().toISOString(),
      });
    }
  }

  return rows;
}

router.post('/insights/sync', requireRole('owner'), async (req, res, next) => {
  try {
    const today = new Date();
    const defaultSince = new Date(today);
    defaultSince.setDate(defaultSince.getDate() - 30);

    const since = toIsoDate(req.body?.since, defaultSince.toISOString().slice(0, 10));
    const until = toIsoDate(req.body?.until, today.toISOString().slice(0, 10));

    const snapshot = await fetchMetaInsights({ since, until });

    const rows = [
      ...flattenMetrics('facebook', snapshot.facebookPageId, snapshot.facebook),
      ...flattenMetrics('instagram', snapshot.instagramUserId, snapshot.instagram),
    ];

    if (rows.length > 0) {
      const { error } = await supabase.from('social_insights').upsert(rows, {
        onConflict: 'provider,account_id,metric,period,date',
      });

      if (error) {
        throw error;
      }
    }

    return res.json({
      synced: rows.length,
      since,
      until,
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/insights', requireRole('owner'), async (req, res, next) => {
  try {
    const provider = String(req.query?.provider || 'facebook').trim();
    const days = Math.min(180, Math.max(1, Number(req.query?.days || 30)));
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    const { data, error } = await supabase
      .from('social_insights')
      .select('provider, account_id, metric, period, date, value, fetched_at')
      .eq('provider', provider)
      .gte('date', fromDate.toISOString().slice(0, 10))
      .order('date', { ascending: true })
      .limit(5000);

    if (error) {
      throw error;
    }

    return res.json({
      provider,
      days,
      rows: data || [],
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
