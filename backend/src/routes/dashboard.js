const express = require('express');
const { supabase } = require('../db/client');
const { requireRole } = require('../middleware/auth');
const { getJobsFeedStatus } = require('../services/feed');

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

function getKnownChannels() {
  return ['linkedin', 'meta', 'wordpress'];
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
      feedStatusResult,
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
        .eq('status', 'actief'),
      supabase
        .from('drafts')
        .select('id, type, status, updated_at, form_data')
        .order('updated_at', { ascending: false })
        .limit(10),
      supabase
        .from('channel_credentials')
        .select('channel, status, updated_at')
        .order('updated_at', { ascending: false }),
      req.user.role === 'owner'
        ? supabase
            .from('drafts')
            .select('id, type, status, created_at, form_data, created_by, creator:users!drafts_created_by_fkey(name)')
            .eq('status', 'pending_approval')
            .order('created_at', { ascending: true })
            .limit(10)
        : Promise.resolve({ data: [], error: null }),
      req.user.role === 'owner'
        ? getJobsFeedStatus().then((data) => ({ data, error: null }))
        : Promise.resolve({ data: null, error: null }),
    ]);

    const errors = [
      pendingApprovalResult.error,
      publishedThisWeekResult.error,
      activeVacaturesResult.error,
      recentActivityResult.error,
      channelRowsResult.error,
      approvalQueueResult.error,
      feedStatusResult.error,
    ].filter(Boolean);

    if (errors.length > 0) {
      throw errors[0];
    }

    const channelMap = new Map();
    const channelRows = channelRowsResult.data || [];

    for (const row of channelRows) {
      channelMap.set(row.channel, {
        channel: row.channel,
        status: row.status || 'disconnected',
        updatedAt: row.updated_at,
      });
    }

    for (const channel of getKnownChannels()) {
      if (!channelMap.has(channel)) {
        channelMap.set(channel, {
          channel,
          status: 'disconnected',
          updatedAt: null,
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
      feedHealth: feedStatusResult.data,
      channelHealth: Array.from(channelMap.values())
        .map(({ channel, status, updatedAt }) => ({ channel, status, updatedAt }))
        .sort((a, b) => a.channel.localeCompare(b.channel)),
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
        status: 'rejected',
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
