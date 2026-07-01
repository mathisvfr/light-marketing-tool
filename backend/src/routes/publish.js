const express = require('express');
const { supabase } = require('../db/client');
const { requireRole } = require('../middleware/auth');
const publishGateway = require('../services/publishGateway');
const { getCredential } = require('../services/integrations');

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

  if (provider === 'wordpress') {
    const credential = await getCredential('wordpress');
    return Boolean(
      credential?.access_token ||
      (process.env.WORDPRESS_API_URL && process.env.WORDPRESS_USERNAME && process.env.WORDPRESS_APP_PASSWORD)
    );
  }

  if (provider === 'google_mijn_bedrijf') {
    const credential = await getCredential('google_mijn_bedrijf');
    return Boolean(credential?.access_token || process.env.GMB_ACCESS_TOKEN);
  }

  const credential = await getCredential(provider);
  return Boolean(credential?.access_token);
}

router.get('/', async (_req, res, next) => {
  try {
    const { data: marketingDrafts, error: marketingError } = await supabase
      .from('drafts')
      .select('id, type, form_data, status, updated_at')
      .eq('type', 'marketing-post')
      .eq('status', 'published')
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
        .select('draft_id, channel, status, published_at, expired_at')
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
        channel: publication.channel,
        status: publication.status,
        publishedAt: publication.published_at,
        expiredAt: publication.expired_at,
      });
      byDraftId.set(publication.draft_id, existing);
    }

    const marketingItems = (marketingDrafts || []).map((draft) => ({
      id: draft.id,
      title: getDraftTitle(draft.form_data),
      type: draft.type,
      publishedAt: draft.updated_at,
      channels: byDraftId.get(draft.id) || [],
    }));

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
      wordpress: 'wordpress',
      google_mijn_bedrijf: 'google_mijn_bedrijf',
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

    const publishResult = await publishGateway.publish(draftId, fullDraft.type, publishableChannels, contentPayload);

    if (!publishResult || publishResult.successCount === 0) {
      return res.status(400).json({
        error: 'Publiceren mislukt voor alle gekozen kanalen. Controleer de Buffer- of kanaalinstellingen.',
      });
    }

    const { error: updateError } = await supabase
      .from('drafts')
      .update({ status: 'published', reviewed_by: req.user.id, updated_at: new Date().toISOString() })
      .eq('id', draftId);

    if (updateError) {
      throw updateError;
    }
    return res.json({ success: true });
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
