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

module.exports = router;
