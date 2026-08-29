const express = require('express');
const { fromZonedTime } = require('date-fns-tz');
const { supabase } = require('../db/client');
const { requireRole } = require('../middleware/auth');
const publishGateway = require('../services/publishGateway');
const { getCredential } = require('../services/integrations');

// The frontend datetime-local input returns a wall-clock string with no
// timezone (e.g. "2026-09-01T09:00"). new Date() interprets that in the
// process's local zone — on the Hetzner VPS that's UTC, so Luke's 09:00
// pick was scheduling posts for 09:00 UTC (11:00 Amsterdam in summer).
// fromZonedTime treats the string as Europe/Amsterdam wall-clock and
// returns the correct UTC Date. Belongs here at the boundary; anything
// deeper (Buffer, DB) already expects a proper ISO instant.
const APP_TIMEZONE = 'Europe/Amsterdam';

const router = express.Router();

function getDraftTitle(formData) {
  if (!formData || typeof formData !== 'object') {
    return 'Zonder titel';
  }

  return formData.functietitel || formData.onderwerp || formData.title || formData.titel || 'Zonder titel';
}

async function hasProviderConnection(provider) {
  if (provider === 'buffer') {
    const credential = await getCredential('buffer');
    return Boolean(credential?.access_token || process.env.BUFFER_API_KEY);
  }

  const credential = await getCredential(provider);
  return Boolean(credential?.access_token);
}

router.get('/', async (_req, res, next) => {
  try {
    // Include 'approved' drafts too — a draft that only has scheduled channels
    // stays 'approved' until at least one goes live. Filter downstream by
    // whether it has any publication rows.
    const { data: marketingDrafts, error: marketingError } = await supabase
      .from('drafts')
      .select('id, type, form_data, status, updated_at')
      .eq('type', 'marketing-post')
      .in('status', ['published', 'approved'])
      .order('updated_at', { ascending: false })
      .limit(500);

    if (marketingError) {
      throw marketingError;
    }

    const { data: activeVacatures, error: activeVacaturesError } = await supabase
      .from('drafts')
      .select('id, type, form_data, updated_at')
      .eq('type', 'vacature')
      .eq('status', 'actief')
      .order('updated_at', { ascending: false })
      .limit(500);

    if (activeVacaturesError) {
      throw activeVacaturesError;
    }

    const draftIds = (marketingDrafts || []).map((item) => item.id);
    let publications = [];

    if (draftIds.length > 0) {
      const { data, error } = await supabase
        .from('publications')
        .select('id, draft_id, channel, status, published_at, expired_at, scheduled_for, metrics, metrics_updated_at')
        .in('draft_id', draftIds)
        .order('published_at', { ascending: false });

      if (error) {
        throw error;
      }

      publications = data || [];
    }

    const byDraftId = new Map();

    for (const publication of publications) {
      const existing = byDraftId.get(publication.draft_id) || [];
      existing.push({
        id: publication.id,
        channel: publication.channel,
        status: publication.status,
        publishedAt: publication.published_at,
        expiredAt: publication.expired_at,
        scheduledFor: publication.scheduled_for,
        metrics: publication.metrics || null,
        metricsUpdatedAt: publication.metrics_updated_at || null,
      });
      byDraftId.set(publication.draft_id, existing);
    }

    // Split marketing drafts into 'published now' vs 'scheduled only'. A draft
    // with no publications rows and status='approved' is dropped from the read
    // (still in Content wachtrij where it belongs).
    const marketingItems = [];
    const scheduledItems = [];

    for (const draft of marketingDrafts || []) {
      const channels = byDraftId.get(draft.id) || [];
      if (channels.length === 0) {
        continue;
      }
      const hasLive = channels.some((c) => c.status === 'success' || c.status === 'failed');
      const target = hasLive ? marketingItems : scheduledItems;
      target.push({
        id: draft.id,
        title: getDraftTitle(draft.form_data),
        type: draft.type,
        publishedAt: draft.updated_at,
        channels,
      });
    }

    const vacatureItems = (activeVacatures || []).map((draft) => ({
      id: draft.id,
      title: getDraftTitle(draft.form_data),
      status: 'actief',
      updatedAt: draft.updated_at,
      stats: 'Nog niet beschikbaar',
    }));

    return res.json({
      marketingItems,
      vacatureItems,
      scheduledItems,
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/:id', requireRole('owner'), async (req, res, next) => {
  try {
    const draftId = req.params.id;

    const { data: draft, error: draftError } = await supabase
      .from('drafts')
      .select('id, status, form_data')
      .eq('id', draftId)
      .maybeSingle();

    if (draftError) {
      throw draftError;
    }

    if (!draft) {
      return res.status(404).json({ error: 'Concept niet gevonden.' });
    }

    const channels = Array.isArray(draft.form_data?.kanalen) ? draft.form_data.kanalen : [];

    const credentialMapping = {
      linkedin: 'buffer',
      facebook_instagram: 'buffer',
      instagram: 'buffer',
      facebook: 'buffer',
    };

    const requiredCredentialChannels = channels.filter((channel) => Boolean(credentialMapping[channel]));

    let connectedMap = new Map();
    if (requiredCredentialChannels.length > 0) {
      const requiredKeys = Array.from(new Set(requiredCredentialChannels.map((channel) => credentialMapping[channel])));
      const statuses = await Promise.all(
        requiredKeys.map(async (provider) => [provider, await hasProviderConnection(provider)])
      );
      connectedMap = new Map(statuses);
    }

    const publishableChannels = channels.filter((channel) => {
      const credentialKey = credentialMapping[channel];
      if (!credentialKey) {
        return true;
      }
      return connectedMap.get(credentialKey) === true;
    });

    if (publishableChannels.length === 0) {
      return res.status(400).json({
        error: 'Geen gekoppelde kanalen beschikbaar. Controleer kanaalstatus in Merk instellingen.',
      });
    }

    const { data: fullDraft, error: fullDraftError } = await supabase
      .from('drafts')
      .select('id, type, omschrijving_nl, social_nl, omschrijving_pl, social_pl, linkedin_post, instagram_caption, image_path, form_data')
      .eq('id', draftId)
      .single();

    if (fullDraftError) {
      throw fullDraftError;
    }

    const contentPayload = {
      omschrijving_nl: fullDraft.omschrijving_nl,
      social_nl: fullDraft.social_nl,
      omschrijving_pl: fullDraft.omschrijving_pl,
      social_pl: fullDraft.social_pl,
      linkedin_post: fullDraft.linkedin_post,
      instagram_caption: fullDraft.instagram_caption,
      image_path: fullDraft.image_path,
      form_data: fullDraft.form_data,
    };

    // Optional scheduling: if the caller supplies dueAt (ISO 8601 in future),
    // route it to Buffer as customScheduled. Guard against past dates so the
    // owner never accidentally posts an instant-publish thinking it's queued.
    let scheduledFor = null;
    if (req.body?.dueAt) {
      const raw = String(req.body.dueAt);
      // Accept both bare wall-clock strings (from datetime-local) and full ISO
      // strings with an explicit offset. The presence of Z or +/-HH:MM means
      // the client already normalized it; without it, treat as local Amsterdam.
      const hasOffset = /Z$|[+-]\d{2}:?\d{2}$/.test(raw);
      const parsed = hasOffset ? new Date(raw) : fromZonedTime(raw, APP_TIMEZONE);
      if (Number.isNaN(parsed.getTime())) {
        return res.status(400).json({ error: 'Ongeldige planningsdatum.' });
      }
      if (parsed.getTime() <= Date.now() + 60_000) {
        return res.status(400).json({ error: 'Planningsdatum moet minstens 1 minuut in de toekomst liggen.' });
      }
      scheduledFor = parsed.toISOString();
    }

    const publishResult = await publishGateway.publish(
      draftId,
      fullDraft.type,
      publishableChannels,
      contentPayload,
      { scheduledFor }
    );

    const anyProgress =
      (publishResult?.successCount || 0) + (publishResult?.scheduledCount || 0) > 0;

    if (!publishResult || !anyProgress) {
      const failedDetails = (publishResult?.rows || [])
        .filter((r) => r.status === 'failed')
        .map((r) => `${r.channel}: ${r.error || 'onbekende fout'}`)
        .join('; ');

      return res.status(400).json({
        error: failedDetails
          ? `Publiceren mislukt: ${failedDetails}`
          : 'Publiceren mislukt voor alle gekozen kanalen. Controleer de Buffer- of kanaalinstellingen.',
      });
    }

    // Only auto-advance the draft to 'published' when at least one channel
    // went live now. If everything is scheduled for later, keep the draft as
    // 'approved' so Content wachtrij still shows something actionable.
    const anyLive = (publishResult?.successCount || 0) > 0;
    if (anyLive) {
      const { error: updateError } = await supabase
        .from('drafts')
        .update({ status: 'published', reviewed_by: req.user.id, updated_at: new Date().toISOString() })
        .eq('id', draftId);

      if (updateError) {
        throw updateError;
      }
    }

    return res.json(
      scheduledFor
        ? {
            success: true,
            scheduledFor,
            scheduledCount: publishResult.scheduledCount || 0,
            liveCount: publishResult.successCount || 0,
          }
        : { success: true }
    );
  } catch (error) {
    return next(error);
  }
});

// Bulk publish for approved marketing-posts. Instant-publish only — bulk
// scheduling would need one dueAt per row, which is a footgun. Any row that
// isn't 'approved' marketing, or has no connected channel, or where every
// channel failed at Buffer, lands in skipped[] with a reason. Rows that
// publish live are flipped to 'published' individually so a partial batch
// still records the successful ones.
router.post('/bulk', requireRole('owner'), async (req, res, next) => {
  try {
    const rawIds = Array.isArray(req.body?.ids) ? req.body.ids : null;
    if (!rawIds || rawIds.length === 0) {
      return res.status(400).json({ error: 'Geen concepten geselecteerd.' });
    }
    if (rawIds.length > 100) {
      return res.status(400).json({ error: 'Maximaal 100 concepten per keer.' });
    }

    const ids = Array.from(new Set(rawIds.map((id) => String(id))));

    const { data: drafts, error: fetchError } = await supabase
      .from('drafts')
      .select('id, type, status, omschrijving_nl, social_nl, omschrijving_pl, social_pl, linkedin_post, instagram_caption, image_path, form_data')
      .in('id', ids);

    if (fetchError) {
      throw fetchError;
    }

    // Cache the buffer credential check across the batch — every marketing
    // post uses the same provider, and this endpoint routinely handles a
    // dozen rows at once. One check per unique provider per bulk call.
    const providerConnectionCache = new Map();
    async function isProviderConnected(provider) {
      if (providerConnectionCache.has(provider)) {
        return providerConnectionCache.get(provider);
      }
      const connected = await hasProviderConnection(provider);
      providerConnectionCache.set(provider, connected);
      return connected;
    }

    const credentialMapping = {
      linkedin: 'buffer',
      facebook_instagram: 'buffer',
      instagram: 'buffer',
      facebook: 'buffer',
    };

    const succeeded = [];
    const skipped = [];
    const nowIso = new Date().toISOString();

    for (const draft of drafts || []) {
      if (draft.type !== 'marketing-post') {
        skipped.push({ id: draft.id, reason: 'not-marketing' });
        continue;
      }
      if (draft.status !== 'approved') {
        skipped.push({ id: draft.id, reason: 'wrong-status', status: draft.status });
        continue;
      }

      const channels = Array.isArray(draft.form_data?.kanalen) ? draft.form_data.kanalen : [];
      const publishable = [];
      for (const channel of channels) {
        const provider = credentialMapping[channel];
        if (!provider) {
          publishable.push(channel);
          continue;
        }
        // eslint-disable-next-line no-await-in-loop
        if (await isProviderConnected(provider)) {
          publishable.push(channel);
        }
      }

      if (publishable.length === 0) {
        skipped.push({ id: draft.id, reason: 'no-connected-channels' });
        continue;
      }

      const contentPayload = {
        omschrijving_nl: draft.omschrijving_nl,
        social_nl: draft.social_nl,
        omschrijving_pl: draft.omschrijving_pl,
        social_pl: draft.social_pl,
        linkedin_post: draft.linkedin_post,
        instagram_caption: draft.instagram_caption,
        image_path: draft.image_path,
        form_data: draft.form_data,
      };

      let result;
      try {
        // eslint-disable-next-line no-await-in-loop
        result = await publishGateway.publish(draft.id, draft.type, publishable, contentPayload, { scheduledFor: null });
      } catch (error) {
        skipped.push({ id: draft.id, reason: 'publish-threw', error: error.message || 'onbekende fout' });
        continue;
      }

      const anyLive = (result?.successCount || 0) > 0;
      if (!anyLive) {
        const failedDetails = (result?.rows || [])
          .filter((r) => r.status === 'failed')
          .map((r) => `${r.channel}: ${r.error || 'onbekende fout'}`)
          .join('; ');
        skipped.push({ id: draft.id, reason: 'all-channels-failed', error: failedDetails });
        continue;
      }

      // eslint-disable-next-line no-await-in-loop
      const { error: updateError } = await supabase
        .from('drafts')
        .update({ status: 'published', reviewed_by: req.user.id, updated_at: nowIso })
        .eq('id', draft.id);

      if (updateError) {
        // The publish already happened at Buffer — surface the DB error but
        // don't roll back. Row will look 'approved' with success publications
        // until the owner retries or an admin fixes the row directly.
        skipped.push({ id: draft.id, reason: 'db-update-failed', error: updateError.message });
        continue;
      }

      succeeded.push({ id: draft.id, status: 'published', liveCount: result.successCount });
    }

    const notFound = ids
      .filter((id) => !(drafts || []).some((d) => d.id === id))
      .map((id) => ({ id, reason: 'not-found' }));

    return res.json({
      succeededCount: succeeded.length,
      skippedCount: skipped.length + notFound.length,
      succeeded,
      skipped: [...skipped, ...notFound],
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/expire', requireRole('owner'), async (req, res, next) => {
  try {
    const draftId = req.params.id;

    const { data: draft, error: draftError } = await supabase
      .from('drafts')
      .select('id, type, status')
      .eq('id', draftId)
      .maybeSingle();

    if (draftError) {
      throw draftError;
    }

    if (!draft) {
      return res.status(404).json({ error: 'Concept niet gevonden.' });
    }

    if (draft.type !== 'vacature') {
      return res.status(400).json({ error: 'Alleen vacatures kunnen worden gesloten.' });
    }

    const nowIso = new Date().toISOString();

    const { data: publicationRows, error: publicationReadError } = await supabase
      .from('publications')
      .select('external_id')
      .eq('draft_id', draftId)
      .not('external_id', 'is', null);

    if (publicationReadError) {
      throw publicationReadError;
    }

    const externalIds = (publicationRows || []).map((row) => row.external_id).filter(Boolean);
    await publishGateway.expire(draftId, externalIds);

    const { error: updateDraftError } = await supabase
      .from('drafts')
      .update({ status: 'expired', updated_at: nowIso })
      .eq('id', draftId);

    if (updateDraftError) {
      throw updateDraftError;
    }

    const { error: updatePublicationsError } = await supabase
      .from('publications')
      .update({ expired_at: nowIso })
      .eq('draft_id', draftId)
      .is('expired_at', null);

    if (updatePublicationsError) {
      throw updatePublicationsError;
    }

    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
