const express = require('express');
const { supabase } = require('../db/client');
const { requireRole } = require('../middleware/auth');
const n8n = require('../services/n8n');

const router = express.Router();

function getDraftTitle(formData) {
  if (!formData || typeof formData !== 'object') {
    return 'Zonder titel';
  }

  return formData.functietitel || formData.onderwerp || formData.title || formData.titel || 'Zonder titel';
}

router.get('/', async (_req, res, next) => {
  try {
    const { data: drafts, error: draftsError } = await supabase
      .from('drafts')
      .select('id, type, form_data, status, updated_at')
      .eq('status', 'published')
      .order('updated_at', { ascending: false })
      .limit(500);

    if (draftsError) {
      throw draftsError;
    }

    const draftIds = (drafts || []).map((item) => item.id);
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

    const items = (drafts || []).map((draft) => ({
      id: draft.id,
      title: getDraftTitle(draft.form_data),
      type: draft.type,
      publishedAt: draft.updated_at,
      channels: byDraftId.get(draft.id) || [],
    }));

    return res.json({ items });
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

    const { data: fullDraft, error: fullDraftError } = await supabase
      .from('drafts')
      .select('id, type, content_nl, social_nl, content_pl, social_pl, linkedin_post, form_data')
      .eq('id', draftId)
      .single();

    if (fullDraftError) {
      throw fullDraftError;
    }

    const contentPayload = {
      content_nl: fullDraft.content_nl,
      social_nl: fullDraft.social_nl,
      content_pl: fullDraft.content_pl,
      social_pl: fullDraft.social_pl,
      linkedin_post: fullDraft.linkedin_post,
      form_data: fullDraft.form_data,
    };

    await n8n.publish(draftId, fullDraft.type, channels, contentPayload);

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
    await n8n.expire(draftId, externalIds);

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
