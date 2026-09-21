const express = require('express');
const { supabase } = require('../db/client');
const { requireRole } = require('../middleware/auth');
const { getJobsFeedStatus } = require('../services/feed');
const { getAllCredentialStatuses } = require('../services/integrations');
const { notifyAfterCommit } = require('../services/notifications');
const { validateVacatureForApproval } = require('../services/vacatureValidation');
const { logActivity } = require('../services/activityLog');

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

function formatActivityTitle(item) {
  const name = item.user_name || 'Iemand';
  const title = item.metadata?.title || '';
  switch (item.action) {
    case 'login': return `${name} is ingelogd`;
    case 'draft.created': return `${name} heeft '${title}' aangemaakt`;
    case 'draft.submitted': return `${name} heeft '${title}' ingediend`;
    case 'draft.approved': return `${name} heeft '${title}' goedgekeurd`;
    case 'draft.rejected': return `${name} heeft '${title}' afgewezen`;
    case 'draft.published': return `${name} heeft '${title}' gepubliceerd`;
    case 'draft.expired': return `${name} heeft '${title}' gesloten`;
    case 'user.created': return `${name} heeft ${item.metadata?.newUserName || 'een gebruiker'} toegevoegd`;
    case 'user.role_changed': return `${name} heeft een rol gewijzigd naar ${item.metadata?.newRole}`;
    case 'user.deleted': return `${name} heeft een gebruiker verwijderd`;
    case 'brand.updated': return `${name} heeft merkinstellingen bijgewerkt`;
    case 'profile.updated': return `${name} heeft profiel bijgewerkt`;
    case 'password.changed': return `${name} heeft wachtwoord gewijzigd`;
    default: return `${name}: ${item.action}`;
  }
}

function actionToStatus(action) {
  const map = {
    'draft.approved': 'approved',
    'draft.rejected': 'rejected',
    'draft.published': 'published',
    'draft.submitted': 'pending_approval',
    'draft.created': 'draft',
    'draft.expired': 'expired',
  };
  return map[action] || 'draft';
}

function toIsoWeekAgo() {
  const date = new Date();
  date.setDate(date.getDate() - 7);
  return date.toISOString();
}

function getKnownChannels() {
  return ['buffer'];
}

function getCredentialState(provider) {
  if (!provider?.hasAccessToken) {
    return 'disconnected';
  }

  if (!provider?.expiresAt) {
    return 'connected';
  }

  const expiresAt = new Date(provider.expiresAt);
  if (Number.isNaN(expiresAt.getTime())) {
    return 'connected';
  }

  const daysLeft = (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  if (daysLeft <= 7) {
    return 'expiring';
  }

  return 'connected';
}

router.get('/summary', async (req, res, next) => {
  try {
    const weekAgoIso = toIsoWeekAgo();

    // Recruiter (and viewer) see their OWN activity. Owner sees the whole team.
    // Design review: each user's dashboard should reflect their own work; the
    // 'Jouw' affordance in the frontend expects created_by-filtered counts here.
    const isPersonal = !['owner', 'manager'].includes(req.user.role);
    const personalFilter = (query) =>
      isPersonal ? query.eq('created_by', req.user.id) : query;

    const [
      pendingApprovalResult,
      publishedThisWeekResult,
      activeVacaturesResult,
      recentActivityResult,
      channelRowsResult,
      approvalQueueResult,
      feedStatusResult,
      teamPendingCountResult,
      teamPublishedCountResult,
      teamActiveVacaturesResult,
    ] = await Promise.all([
      personalFilter(
        supabase.from('drafts').select('*', { count: 'exact', head: true }).eq('status', 'pending_approval')
      ),
      personalFilter(
        supabase
          .from('drafts')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'published')
          .gte('updated_at', weekAgoIso)
      ),
      personalFilter(
        supabase
          .from('drafts')
          .select('*', { count: 'exact', head: true })
          .eq('type', 'vacature')
          .eq('status', 'actief')
      ),
      (async () => {
        let q = supabase
          .from('activity_log')
          .select('id, user_id, user_name, action, resource_type, resource_id, metadata, created_at')
          .order('created_at', { ascending: false })
          .limit(10);
        if (isPersonal) {
          q = q.eq('user_id', req.user.id);
        }
        return q;
      })(),
      getAllCredentialStatuses().then((data) => ({ data, error: null })),
      // "Openstaande concepten" widget. Owner sees all pending_approval items
      // (the classic approval queue) PLUS their own drafts (Mathis is the sole
      // author, so pending_approval was always empty and the widget was dead).
      // Recruiter sees only their own drafts — nothing they'd approve, but
      // they need a "concepten die ik nog moet afmaken" surface.
      // Viewer sees nothing (falls through to []).
      ['owner', 'manager'].includes(req.user.role)
        ? supabase
            .from('drafts')
            .select('id, type, status, created_at, form_data, created_by, creator:users!drafts_created_by_fkey(name)')
            .or(`status.eq.pending_approval,and(status.eq.draft,created_by.eq.${req.user.id})`)
            .order('created_at', { ascending: true })
            .limit(10)
        : req.user.role === 'recruiter'
        ? supabase
            .from('drafts')
            .select('id, type, status, created_at, form_data, created_by, creator:users!drafts_created_by_fkey(name)')
            .eq('created_by', req.user.id)
            .eq('status', 'draft')
            .order('created_at', { ascending: true })
            .limit(10)
        : Promise.resolve({ data: [], error: null }),
      ['owner', 'manager'].includes(req.user.role)
        ? getJobsFeedStatus().then((data) => ({ data, error: null }))
        : Promise.resolve({ data: null, error: null }),
      // Owner also gets team-wide totals rendered in the 'Team totaal' section.
      ['owner', 'manager'].includes(req.user.role)
        ? supabase.from('drafts').select('*', { count: 'exact', head: true }).eq('status', 'pending_approval')
        : Promise.resolve({ count: 0, error: null }),
      ['owner', 'manager'].includes(req.user.role)
        ? supabase
            .from('drafts')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'published')
            .gte('updated_at', weekAgoIso)
        : Promise.resolve({ count: 0, error: null }),
      ['owner', 'manager'].includes(req.user.role)
        ? supabase
            .from('drafts')
            .select('*', { count: 'exact', head: true })
            .eq('type', 'vacature')
            .eq('status', 'actief')
        : Promise.resolve({ count: 0, error: null }),
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
      channelMap.set(row.provider, {
        channel: row.provider,
        status: getCredentialState(row),
        updatedAt: row.updatedAt,
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
      title: formatActivityTitle(item),
      action: item.action,
      userName: item.user_name,
      metadata: item.metadata,
      status: actionToStatus(item.action),
      updatedAt: item.created_at,
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
      // Personal counts for the caller. Frontend renders these under 'Jouw'.
      counts: {
        pendingApproval: pendingApprovalResult.count || 0,
        publishedThisWeek: publishedThisWeekResult.count || 0,
        activeVacatures: activeVacaturesResult.count || 0,
      },
      // Team totals (owner only). Frontend renders these beneath 'Team totaal'.
      teamCounts: ['owner', 'manager'].includes(req.user.role)
        ? {
            pendingApproval: teamPendingCountResult.count || 0,
            publishedThisWeek: teamPublishedCountResult.count || 0,
            activeVacatures: teamActiveVacaturesResult.count || 0,
          }
        : null,
      viewScope: isPersonal ? 'personal' : 'team',
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

router.post('/queue/:id/approve', requireRole(['owner', 'manager']), async (req, res, next) => {
  try {
    const { id } = req.params;

    // Fetch draft to determine type (vacatures → actief, others → approved)
    const { data: draft, error: fetchError } = await supabase
      .from('drafts')
      .select('id, type, status, created_by, form_data, sollicitatie_url, omschrijving_nl')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) throw fetchError;

    if (!draft || !['draft', 'pending_approval'].includes(draft.status)) {
      return res.status(404).json({ error: 'Concept niet gevonden of niet meer in wachtrij.' });
    }

    const validationError = validateVacatureForApproval(draft);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const nextStatus = draft.type === 'vacature' ? 'actief' : 'approved';

    const { error } = await supabase
      .from('drafts')
      .update({
        status: nextStatus,
        reviewed_by: req.user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;

    logActivity(req.user.id, req.user.name, 'draft.approved', 'draft', id, { title: getDraftTitle(draft.form_data) });

    if (draft.created_by && draft.created_by !== req.user.id) {
      notifyAfterCommit('draft.approved', {
        draft_id: id,
        actor_name: req.user.name || req.user.email || 'De eigenaar',
        title: getDraftTitle(draft.form_data) || 'concept',
        recipient_user_ids: [draft.created_by],
      });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    return next(error);
  }
});

router.post('/queue/:id/reject', requireRole(['owner', 'manager']), async (req, res, next) => {
  try {
    const { id } = req.params;
    const comment = String(req.body?.comment || '').trim();

    const { data: draft, error: fetchError } = await supabase
      .from('drafts')
      .select('id, status, created_by, form_data')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) throw fetchError;

    if (!draft || !['draft', 'pending_approval'].includes(draft.status)) {
      return res.status(404).json({ error: 'Concept niet gevonden of niet meer in wachtrij.' });
    }

    const formData = { ...(draft.form_data || {}), review_comment: comment || null };

    const { error } = await supabase
      .from('drafts')
      .update({
        status: 'rejected',
        reviewed_by: req.user.id,
        form_data: formData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;

    logActivity(req.user.id, req.user.name, 'draft.rejected', 'draft', id, { title: getDraftTitle(draft.form_data), reason: comment });

    if (draft.created_by && draft.created_by !== req.user.id) {
      notifyAfterCommit('draft.rejected', {
        draft_id: id,
        actor_name: req.user.name || req.user.email || 'De eigenaar',
        title: getDraftTitle(draft.form_data) || 'concept',
        reason: comment,
        recipient_user_ids: [draft.created_by],
      });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
