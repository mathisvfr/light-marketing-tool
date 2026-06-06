const express = require('express');
const { supabase } = require('../db/client');
const { generate } = require('../services/claude');

const router = express.Router();

function canEditDraft(user, draft) {
  if (user.role === 'owner') {
    return true;
  }

  return draft.created_by === user.id;
}

function normalizeDraftType(type) {
  if (type === 'marketing-post') {
    return 'marketing-post';
  }

  return 'vacature';
}

function formatDraftForResponse(draft) {
  return {
    id: draft.id,
    type: draft.type,
    status: draft.status,
    form_data: draft.form_data,
    content_nl: draft.content_nl,
    social_nl: draft.social_nl,
    content_pl: draft.content_pl,
    social_pl: draft.social_pl,
    linkedin_post: draft.linkedin_post,
  };
}

function getDraftTitle(formData) {
  if (!formData || typeof formData !== 'object') {
    return 'Zonder titel';
  }

  return formData.functietitel || formData.onderwerp || formData.title || formData.titel || 'Zonder titel';
}

router.get('/', async (req, res, next) => {
  try {
    const statusFilter = String(req.query?.status || 'all');
    const typeFilter = String(req.query?.type || 'all');
    const authorFilter = String(req.query?.auteur || 'all');

    let query = supabase
      .from('drafts')
      .select(
        'id, type, status, form_data, created_by, created_at, updated_at, creator:users!drafts_created_by_fkey(id, name, email)'
      )
      .order('created_at', { ascending: false })
      .limit(500);

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    if (typeFilter !== 'all') {
      const mappedType = typeFilter === 'marketing' ? 'marketing-post' : typeFilter;
      query = query.eq('type', mappedType);
    }

    if (authorFilter !== 'all') {
      query = query.eq('created_by', authorFilter);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const drafts = (data || []).map((item) => ({
      id: item.id,
      type: item.type,
      status: item.status,
      title: getDraftTitle(item.form_data),
      channels: Array.isArray(item.form_data?.kanalen) ? item.form_data.kanalen : [],
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      createdBy: item.created_by,
      authorName: item.creator?.name || 'Onbekend',
    }));

    return res.json({ drafts });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const draftId = req.params.id;

    const { data, error } = await supabase
      .from('drafts')
      .select(
        'id, form_data, status, type, content_nl, social_nl, content_pl, social_pl, linkedin_post, created_by'
      )
      .eq('id', draftId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return res.status(404).json({ error: 'Concept niet gevonden.' });
    }

    if (req.user.role === 'recruiter' && data.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Je hebt geen toegang tot dit concept.' });
    }

    return res.json({ draft: formatDraftForResponse(data) });
  } catch (error) {
    return next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    if (!['owner', 'recruiter'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Je hebt geen toegang tot deze actie.' });
    }

    const formData = req.body?.formData;
    const type = normalizeDraftType(req.body?.type);

    if (!formData || typeof formData !== 'object') {
      return res.status(400).json({ error: 'Formuliergegevens ontbreken.' });
    }

    const payload = {
      type,
      form_data: formData,
      status: 'draft',
      created_by: req.user.id,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('drafts')
      .insert(payload)
      .select(
        'id, form_data, status, type, content_nl, social_nl, content_pl, social_pl, linkedin_post'
      )
      .single();

    if (error) {
      throw error;
    }

    return res.status(201).json({ draft: formatDraftForResponse(data) });
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/generate', async (req, res, next) => {
  try {
    if (!['owner', 'recruiter'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Je hebt geen toegang tot deze actie.' });
    }

    const draftId = req.params.id;

    const { data: draft, error: draftError } = await supabase
      .from('drafts')
      .select(
        'id, type, form_data, created_by, content_nl, social_nl, content_pl, social_pl, linkedin_post'
      )
      .eq('id', draftId)
      .maybeSingle();

    if (draftError) {
      throw draftError;
    }

    if (!draft) {
      return res.status(404).json({ error: 'Concept niet gevonden.' });
    }

    if (!canEditDraft(req.user, draft)) {
      return res.status(403).json({ error: 'Je mag dit concept niet aanpassen.' });
    }

    const generated = await generate(draft.type, draft.form_data);

    const updatePayload =
      draft.type === 'marketing-post'
        ? {
            linkedin_post: generated.linkedin_post || draft.linkedin_post || null,
            social_nl: generated.facebook_post || draft.social_nl || null,
            content_nl: null,
            content_pl: null,
            social_pl: null,
            updated_at: new Date().toISOString(),
          }
        : {
            content_nl: generated.vacature_nl || draft.content_nl || null,
            social_nl: generated.social_nl || draft.social_nl || null,
            content_pl: generated.vacature_pl || null,
            social_pl: generated.social_pl || null,
            linkedin_post: null,
            updated_at: new Date().toISOString(),
          };

    const { data: updatedDraft, error: updateError } = await supabase
      .from('drafts')
      .update(updatePayload)
      .eq('id', draft.id)
      .select(
        'id, form_data, status, type, content_nl, social_nl, content_pl, social_pl, linkedin_post'
      )
      .single();

    if (updateError) {
      throw updateError;
    }

    return res.json({ draft: formatDraftForResponse(updatedDraft) });
  } catch (error) {
    return next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    if (!['owner', 'recruiter'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Je hebt geen toegang tot deze actie.' });
    }

    const draftId = req.params.id;

    const { data: draft, error: draftError } = await supabase
      .from('drafts')
      .select('id, created_by, status')
      .eq('id', draftId)
      .maybeSingle();

    if (draftError) {
      throw draftError;
    }

    if (!draft) {
      return res.status(404).json({ error: 'Concept niet gevonden.' });
    }

    if (!canEditDraft(req.user, draft)) {
      return res.status(403).json({ error: 'Je mag dit concept niet aanpassen.' });
    }

    const payload = {
      content_nl: req.body?.content_nl || null,
      social_nl: req.body?.social_nl || null,
      content_pl: req.body?.content_pl || null,
      social_pl: req.body?.social_pl || null,
      linkedin_post: req.body?.linkedin_post || null,
      status: req.body?.status || 'draft',
      updated_at: new Date().toISOString(),
    };

    const { data: updatedDraft, error: updateError } = await supabase
      .from('drafts')
      .update(payload)
      .eq('id', draft.id)
      .select(
        'id, form_data, status, type, content_nl, social_nl, content_pl, social_pl, linkedin_post'
      )
      .single();

    if (updateError) {
      throw updateError;
    }

    return res.json({ draft: formatDraftForResponse(updatedDraft) });
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/submit', async (req, res, next) => {
  try {
    if (!['owner', 'recruiter'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Je hebt geen toegang tot deze actie.' });
    }

    const draftId = req.params.id;

    const { data: draft, error: draftError } = await supabase
      .from('drafts')
      .select('id, created_by')
      .eq('id', draftId)
      .maybeSingle();

    if (draftError) {
      throw draftError;
    }

    if (!draft) {
      return res.status(404).json({ error: 'Concept niet gevonden.' });
    }

    if (!canEditDraft(req.user, draft)) {
      return res.status(403).json({ error: 'Je mag dit concept niet aanpassen.' });
    }

    const { data: updatedDraft, error: updateError } = await supabase
      .from('drafts')
      .update({ status: 'pending_approval', updated_at: new Date().toISOString() })
      .eq('id', draft.id)
      .select(
        'id, form_data, status, type, content_nl, social_nl, content_pl, social_pl, linkedin_post'
      )
      .single();

    if (updateError) {
      throw updateError;
    }

    return res.json({ draft: formatDraftForResponse(updatedDraft) });
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/approve', async (req, res, next) => {
  try {
    if (req.user.role !== 'owner') {
      return res.status(403).json({ error: 'Je hebt geen toegang tot deze actie.' });
    }

    const draftId = req.params.id;

    const { data, error } = await supabase
      .from('drafts')
      .update({
        status: 'approved',
        reviewed_by: req.user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', draftId)
      .select(
        'id, form_data, status, type, content_nl, social_nl, content_pl, social_pl, linkedin_post'
      )
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return res.status(404).json({ error: 'Concept niet gevonden.' });
    }

    return res.json({ draft: formatDraftForResponse(data) });
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/reject', async (req, res, next) => {
  try {
    if (req.user.role !== 'owner') {
      return res.status(403).json({ error: 'Je hebt geen toegang tot deze actie.' });
    }

    const draftId = req.params.id;
    const comment = String(req.body?.comment || '').trim();

    const { data: currentDraft, error: currentDraftError } = await supabase
      .from('drafts')
      .select('id, form_data')
      .eq('id', draftId)
      .maybeSingle();

    if (currentDraftError) {
      throw currentDraftError;
    }

    if (!currentDraft) {
      return res.status(404).json({ error: 'Concept niet gevonden.' });
    }

    const formData = {
      ...(currentDraft.form_data || {}),
      review_comment: comment || null,
    };

    const { data, error } = await supabase
      .from('drafts')
      .update({
        status: 'draft',
        reviewed_by: req.user.id,
        form_data: formData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', draftId)
      .select(
        'id, form_data, status, type, content_nl, social_nl, content_pl, social_pl, linkedin_post'
      )
      .maybeSingle();

    if (error) {
      throw error;
    }

    return res.json({ draft: formatDraftForResponse(data) });
  } catch (error) {
    return next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const draftId = req.params.id;

    const { data: draft, error: draftError } = await supabase
      .from('drafts')
      .select('id, created_by')
      .eq('id', draftId)
      .maybeSingle();

    if (draftError) {
      throw draftError;
    }

    if (!draft) {
      return res.status(404).json({ error: 'Concept niet gevonden.' });
    }

    if (req.user.role !== 'recruiter' || draft.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Je hebt geen toegang tot deze actie.' });
    }

    const { error } = await supabase.from('drafts').delete().eq('id', draftId);

    if (error) {
      throw error;
    }

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
