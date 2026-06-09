const express = require('express');
const { supabase } = require('../db/client');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

function getDraftTitle(formData) {
  if (!formData || typeof formData !== 'object') {
    return 'Zonder titel';
  }

  return (
    formData.functietitel ||
    formData.onderwerp ||
    formData.title ||
    formData.titel ||
    'Zonder titel'
  );
}

function toIsoWeekAgo() {
  const date = new Date();
  date.setDate(date.getDate() - 7);
  return date.toISOString();
}

const ANALYTICS_WEEKS = 8;

/**
 * Build N contiguous 7-day buckets ending at the end of today.
 * Returns oldest-first, each with { start, end, label } (label = dd-MM of start).
 */
function buildWeekBuckets(weeks = ANALYTICS_WEEKS) {
  const now = new Date();
  const buckets = [];

  for (let i = weeks - 1; i >= 0; i -= 1) {
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    end.setDate(end.getDate() - i * 7);

    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);

    const label = `${String(start.getDate()).padStart(2, '0')}-${String(
      start.getMonth() + 1,
    ).padStart(2, '0')}`;

    buckets.push({ start, end, label });
  }

  return buckets;
}

function bucketIndexFor(buckets, dateValue) {
  if (!dateValue) {
    return -1;
  }
  const time = new Date(dateValue).getTime();
  if (Number.isNaN(time)) {
    return -1;
  }
  return buckets.findIndex(
    (bucket) => time >= bucket.start.getTime() && time <= bucket.end.getTime(),
  );
}

router.get('/summary', async (req, res, next) => {
  try {
    const weekAgoIso = toIsoWeekAgo();

    const [
      pendingApprovalResult,
      publishedThisWeekResult,
      activeVacaturesResult,
      recentActivityResult,
      channelRowsResult,
      approvalQueueResult,
    ] = await Promise.all([
      supabase
        .from('drafts')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending_approval'),
      supabase
        .from('drafts')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'published')
        .gte('updated_at', weekAgoIso),
      supabase
        .from('drafts')
        .select('*', { count: 'exact', head: true })
        .eq('type', 'vacature')
        .eq('status', 'published'),
      supabase
        .from('drafts')
        .select('id, type, status, updated_at, form_data')
        .order('updated_at', { ascending: false })
        .limit(10),
      supabase
        .from('publications')
        .select('channel, status, published_at, expired_at')
        .limit(500),
      req.user.role === 'owner'
        ? supabase
            .from('drafts')
            .select('id, type, status, created_at, form_data, created_by, creator:users!drafts_created_by_fkey(name)')
            .eq('status', 'pending_approval')
            .order('created_at', { ascending: true })
            .limit(10)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const errors = [
      pendingApprovalResult.error,
      publishedThisWeekResult.error,
      activeVacaturesResult.error,
      recentActivityResult.error,
      channelRowsResult.error,
      approvalQueueResult.error,
    ].filter(Boolean);

    if (errors.length > 0) {
      throw errors[0];
    }

    const channelHealthMap = new Map();
    const channelRows = channelRowsResult.data || [];

    for (const row of channelRows) {
      const ts = row.published_at || row.expired_at || null;
      const score = ts ? new Date(ts).getTime() : 0;
      const existing = channelHealthMap.get(row.channel);

      if (!existing || score > existing.score) {
        channelHealthMap.set(row.channel, {
          channel: row.channel,
          status: row.status,
          updatedAt: ts,
          score,
        });
      }
    }

    const recentActivity = (recentActivityResult.data || []).map((item) => ({
      id: item.id,
      type: item.type,
      status: item.status,
      updatedAt: item.updated_at,
      title: getDraftTitle(item.form_data),
    }));

    const approvalQueue = (approvalQueueResult.data || []).map((item) => ({
      id: item.id,
      type: item.type,
      createdAt: item.created_at,
      status: item.status,
      title: getDraftTitle(item.form_data),
      creatorName: item.creator?.name || 'Onbekend',
    }));

    return res.json({
      counts: {
        pendingApproval: pendingApprovalResult.count || 0,
        publishedThisWeek: publishedThisWeekResult.count || 0,
        activeVacatures: activeVacaturesResult.count || 0,
      },
      approvalQueue,
      recentActivity,
      channelHealth: Array.from(channelHealthMap.values())
        .sort((a, b) => b.score - a.score)
        .map(({ channel, status, updatedAt }) => ({ channel, status, updatedAt })),
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/queue/:id/approve', requireRole('owner'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('drafts')
      .update({
        status: 'approved',
        reviewed_by: req.user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('status', 'pending_approval')
      .select('id')
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return res.status(404).json({ error: 'Concept niet gevonden of niet meer in wachtrij.' });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    return next(error);
  }
});

router.post('/queue/:id/reject', requireRole('owner'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('drafts')
      .update({
        status: 'draft',
        reviewed_by: req.user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('status', 'pending_approval')
      .select('id')
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return res.status(404).json({ error: 'Concept niet gevonden of niet meer in wachtrij.' });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    return next(error);
  }
});

router.get('/analytics', async (req, res, next) => {
  try {
    const buckets = buildWeekBuckets();

    const [draftsResult, publicationsResult] = await Promise.all([
      supabase
        .from('drafts')
        .select('id, type, status, created_at')
        .limit(5000),
      supabase
        .from('publications')
        .select(
          'draft_id, channel, status, published_at, expired_at, draft:drafts!publications_draft_id_fkey(type)',
        )
        .limit(5000),
    ]);

    if (draftsResult.error) {
      throw draftsResult.error;
    }
    if (publicationsResult.error) {
      throw publicationsResult.error;
    }

    const drafts = draftsResult.data || [];
    const publications = publicationsResult.data || [];

    // 1) Content created per week, split by type.
    const contentPerWeek = buckets.map((bucket) => ({
      week: bucket.label,
      vacature: 0,
      marketing: 0,
    }));

    for (const draft of drafts) {
      const index = bucketIndexFor(buckets, draft.created_at);
      if (index === -1) {
        continue;
      }
      if (draft.type === 'marketing-post') {
        contentPerWeek[index].marketing += 1;
      } else {
        contentPerWeek[index].vacature += 1;
      }
    }

    // 2) Publications per channel, split by outcome.
    const channelMap = new Map();
    for (const pub of publications) {
      const channel = pub.channel || 'onbekend';
      if (!channelMap.has(channel)) {
        channelMap.set(channel, { channel, success: 0, failed: 0, pending: 0 });
      }
      const entry = channelMap.get(channel);
      if (pub.status === 'success') {
        entry.success += 1;
      } else if (pub.status === 'failed') {
        entry.failed += 1;
      } else {
        entry.pending += 1;
      }
    }
    const publicationsByChannel = Array.from(channelMap.values()).sort((a, b) =>
      a.channel.localeCompare(b.channel),
    );

    // 3) Status distribution across all drafts.
    const statusOrder = [
      'draft',
      'pending_approval',
      'approved',
      'published',
      'expired',
    ];
    const statusCounts = new Map(statusOrder.map((status) => [status, 0]));
    for (const draft of drafts) {
      statusCounts.set(draft.status, (statusCounts.get(draft.status) || 0) + 1);
    }
    const statusDistribution = Array.from(statusCounts.entries())
      .filter(([, count]) => count > 0)
      .map(([status, count]) => ({ status, count }));

    // 4) Active vacatures per week (published & not yet expired at week end).
    const vacatureTiming = new Map();
    for (const pub of publications) {
      if (pub.draft?.type !== 'vacature' || !pub.published_at) {
        continue;
      }
      const existing = vacatureTiming.get(pub.draft_id) || {
        publishedAt: null,
        expiredAt: null,
      };

      const publishedTime = new Date(pub.published_at).getTime();
      if (existing.publishedAt === null || publishedTime < existing.publishedAt) {
        existing.publishedAt = publishedTime;
      }

      if (pub.expired_at) {
        const expiredTime = new Date(pub.expired_at).getTime();
        if (existing.expiredAt === null || expiredTime < existing.expiredAt) {
          existing.expiredAt = expiredTime;
        }
      }

      vacatureTiming.set(pub.draft_id, existing);
    }

    const activeVacaturesPerWeek = buckets.map((bucket) => {
      const weekEnd = bucket.end.getTime();
      let count = 0;
      for (const timing of vacatureTiming.values()) {
        if (
          timing.publishedAt !== null &&
          timing.publishedAt <= weekEnd &&
          (timing.expiredAt === null || timing.expiredAt > weekEnd)
        ) {
          count += 1;
        }
      }
      return { week: bucket.label, count };
    });

    return res.json({
      contentPerWeek,
      publicationsByChannel,
      statusDistribution,
      activeVacaturesPerWeek,
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
