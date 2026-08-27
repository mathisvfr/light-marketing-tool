const express = require('express');
const fs = require('node:fs/promises');
const path = require('node:path');
const { supabase } = require('../db/client');
const { generate, criticus } = require('../services/claude');
const { renderSocialImage, saveUploadedImageDataUrl } = require('../services/render');

const router = express.Router();

// Resolve which Satori template + fields to render for a draft. Marketing posts
// choose between 'statement' and 'photo-feature'; vacatures between 'vacancy' and
// 'story'. The platform suffix (-li/-fb) picks the right canvas per primary channel.
function resolveRenderTemplate(type, formData, generated) {
  const kanalen = Array.isArray(formData?.kanalen) ? formData.kanalen : [];
  const primary = ['instagram', 'linkedin', 'facebook'].find((channel) => kanalen.includes(channel)) || 'instagram';
  const suffix = primary === 'linkedin' ? '-li' : primary === 'facebook' ? '-fb' : '';

  if (type === 'marketing-post') {
    const base = ['statement', 'photo-feature'].includes(formData?.template) ? formData.template : 'statement';
    return {
      name: base + suffix,
      fields: {
        headline: generated?.image_headline || formData?.onderwerp || undefined,
        accent: generated?.image_subline || undefined,
      },
      altText: formData?.onderwerp || 'Marketingpost',
    };
  }

  // Vacature: 'story' is Instagram-vertical only (no platform variant).
  const base = formData?.template === 'story' ? 'story' : 'vacancy';
  return {
    name: base === 'story' ? 'story' : 'vacancy' + suffix,
    fields: {
      title: formData?.functietitel || generated?.titel || undefined,
      location: formData?.locatie || undefined,
      hours: formData?.urenPerWeek || formData?.uren || undefined,
      category: formData?.sector || undefined,
    },
    altText: formData?.functietitel || 'Vacature',
  };
}

// Best-effort: register a freshly rendered image in the media library so it shows
// up in the content bibliotheek. Never throws (skips silently on any failure).
async function registerGeneratedImage(imagePath, altText, createdBy) {
  try {
    if (!imagePath) {
      return;
    }
    const filename = path.basename(imagePath);
    const absolute = path.resolve(__dirname, '..', '..', 'uploads', 'social', filename);
    const stats = await fs.stat(absolute);

    await supabase.from('media_library').insert({
      filename,
      path: imagePath,
      alt_text: altText || null,
      source: 'generated',
      created_by: createdBy || null,
      file_size: stats.size,
      mime_type: 'image/png',
    });
  } catch (_err) {
    // Non-fatal: the image still works via image_path even if not catalogued.
  }
}

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
    omschrijving_nl: draft.omschrijving_nl,
    functie_eisen: draft.functie_eisen,
    wat_wij_bieden: draft.wat_wij_bieden,
    omschrijving_pl: draft.omschrijving_pl,
    functie_eisen_pl: draft.functie_eisen_pl,
    wat_wij_bieden_pl: draft.wat_wij_bieden_pl,
    social_nl: draft.social_nl,
    social_pl: draft.social_pl,
    linkedin_post: draft.linkedin_post,
    instagram_caption: draft.instagram_caption,
    image_path: draft.image_path,
    criticus_passed: draft.criticus_passed,
    criticus_notes: draft.criticus_notes,
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
        'id, form_data, status, type, omschrijving_nl, functie_eisen, wat_wij_bieden, omschrijving_pl, functie_eisen_pl, wat_wij_bieden_pl, social_nl, social_pl, linkedin_post, instagram_caption, image_path, criticus_passed, criticus_notes, created_by'
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
        'id, form_data, status, type, omschrijving_nl, functie_eisen, wat_wij_bieden, omschrijving_pl, functie_eisen_pl, wat_wij_bieden_pl, social_nl, social_pl, linkedin_post, instagram_caption, image_path, criticus_passed, criticus_notes'
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

// Duplicate an existing draft into a fresh 'draft' owned by the current user.
// Copies only the form_data so the new draft starts clean (no criticus, no
// generated content, no image, no publications). Vacatures Sandra creates
// tend to share ~80% of the form, so this is the daily-workflow shortcut.
router.post('/:id/duplicate', async (req, res, next) => {
  try {
    if (!['owner', 'recruiter'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Je hebt geen toegang tot deze actie.' });
    }

    const sourceId = req.params.id;

    const { data: source, error: sourceError } = await supabase
      .from('drafts')
      .select('id, type, form_data')
      .eq('id', sourceId)
      .maybeSingle();

    if (sourceError) {
      throw sourceError;
    }

    if (!source) {
      return res.status(404).json({ error: 'Concept niet gevonden.' });
    }

    const { data: created, error: insertError } = await supabase
      .from('drafts')
      .insert({
        type: source.type,
        form_data: source.form_data || {},
        status: 'draft',
        created_by: req.user.id,
        updated_at: new Date().toISOString(),
      })
      .select('id, form_data, status, type')
      .single();

    if (insertError) {
      throw insertError;
    }

    return res.status(201).json({ draft: formatDraftForResponse(created) });
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
        'id, type, form_data, created_by, omschrijving_nl, functie_eisen, wat_wij_bieden, omschrijving_pl, functie_eisen_pl, wat_wij_bieden_pl, social_nl, social_pl, linkedin_post, instagram_caption, image_path'
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

    // Accept a form_data override on regenerate so the user can tweak inputs
    // (e.g. template, kanalen, tone) without needing a separate save step.
    const overrideForm = req.body?.formData;
    if (overrideForm && typeof overrideForm === 'object') {
      const mergedForm = { ...(draft.form_data || {}), ...overrideForm };
      const { data: updatedDraft, error: updateFormErr } = await supabase
        .from('drafts')
        .update({ form_data: mergedForm, updated_at: new Date().toISOString() })
        .eq('id', draft.id)
        .select('form_data')
        .single();

      if (updateFormErr) {
        throw updateFormErr;
      }
      draft.form_data = updatedDraft.form_data;
    }

    const generated = await generate(draft.type, draft.form_data);

    // Save generated content immediately (criticus_passed = null signals "pending")
    const updatePayload =
      draft.type === 'marketing-post'
        ? {
            linkedin_post: generated.linkedin_post || draft.linkedin_post || null,
            social_nl: generated.facebook_post || draft.social_nl || null,
            instagram_caption: generated.instagram_caption || draft.instagram_caption || null,
            image_path: draft.image_path || null,
            omschrijving_nl: null,
            functie_eisen: null,
            wat_wij_bieden: null,
            omschrijving_pl: null,
            social_pl: null,
            criticus_passed: null,
            criticus_notes: null,
            updated_at: new Date().toISOString(),
          }
        : {
            omschrijving_nl: generated.omschrijving_nl || draft.omschrijving_nl || null,
            functie_eisen: generated.functie_eisen || draft.functie_eisen || null,
            wat_wij_bieden: generated.wat_wij_bieden || draft.wat_wij_bieden || null,
            omschrijving_pl: generated.omschrijving_pl || null,
            functie_eisen_pl: generated.functie_eisen_pl || null,
            wat_wij_bieden_pl: generated.wat_wij_bieden_pl || null,
            social_nl: generated.social_nl || draft.social_nl || null,
            social_pl: generated.social_pl || null,
            linkedin_post: null,
            criticus_passed: null,
            criticus_notes: null,
            updated_at: new Date().toISOString(),
          };

    const { data: updatedDraft, error: updateError } = await supabase
      .from('drafts')
      .update(updatePayload)
      .eq('id', draft.id)
      .select(
        'id, form_data, status, type, omschrijving_nl, functie_eisen, wat_wij_bieden, omschrijving_pl, functie_eisen_pl, wat_wij_bieden_pl, social_nl, social_pl, linkedin_post, instagram_caption, image_path, criticus_passed, criticus_notes'
      )
      .single();

    if (updateError) {
      throw updateError;
    }

    // Respond immediately with generated content (criticus_passed = null)
    res.json({ draft: formatDraftForResponse(updatedDraft) });

    // Run criticus + image render in background (don't block the response)
    const backgroundTasks = [
      criticus({ type: draft.type, formData: draft.form_data, content: generated }),
    ];

    // Skip Satori render entirely when the user attached their own image up front.
    let renderInfo = null;
    if (!draft.image_path && (draft.type === 'marketing-post' || draft.type === 'vacature')) {
      renderInfo = resolveRenderTemplate(draft.type, draft.form_data, generated);
      backgroundTasks.push(renderSocialImage(renderInfo.name, renderInfo.fields));
    }

    Promise.all(backgroundTasks)
      .then(async ([criticusResult, renderedImagePath]) => {
        const bgUpdate = {
          criticus_passed: criticusResult.passed,
          criticus_notes: criticusResult.notes || null,
          updated_at: new Date().toISOString(),
        };

        if (renderedImagePath) {
          bgUpdate.image_path = renderedImagePath;
        }

        await supabase.from('drafts').update(bgUpdate).eq('id', draft.id);

        // Catalogue the auto-generated image so it appears in the media library.
        if (renderedImagePath && renderInfo) {
          await registerGeneratedImage(renderedImagePath, renderInfo.altText, draft.created_by);
        }
      })
      .catch((err) => {
        console.error('Background criticus/render failed:', err);
      });

    return;
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
      omschrijving_nl: req.body?.omschrijving_nl || null,
      functie_eisen: req.body?.functie_eisen || null,
      wat_wij_bieden: req.body?.wat_wij_bieden || null,
      omschrijving_pl: req.body?.omschrijving_pl || null,
      functie_eisen_pl: req.body?.functie_eisen_pl || null,
      wat_wij_bieden_pl: req.body?.wat_wij_bieden_pl || null,
      social_nl: req.body?.social_nl || null,
      social_pl: req.body?.social_pl || null,
      linkedin_post: req.body?.linkedin_post || null,
      instagram_caption: req.body?.instagram_caption || null,
      image_path: req.body?.image_path || null,
      criticus_passed: typeof req.body?.criticus_passed === 'boolean' ? req.body.criticus_passed : null,
      criticus_notes: req.body?.criticus_notes || null,
      status: req.body?.status || 'draft',
      updated_at: new Date().toISOString(),
    };

    const { data: updatedDraft, error: updateError } = await supabase
      .from('drafts')
      .update(payload)
      .eq('id', draft.id)
      .select(
        'id, form_data, status, type, omschrijving_nl, functie_eisen, wat_wij_bieden, omschrijving_pl, functie_eisen_pl, wat_wij_bieden_pl, social_nl, social_pl, linkedin_post, instagram_caption, image_path, criticus_passed, criticus_notes'
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
        'id, form_data, status, type, omschrijving_nl, functie_eisen, wat_wij_bieden, omschrijving_pl, functie_eisen_pl, wat_wij_bieden_pl, social_nl, social_pl, linkedin_post, instagram_caption, image_path, criticus_passed, criticus_notes'
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

    const { data: currentDraft, error: currentDraftError } = await supabase
      .from('drafts')
      .select('id, type, status')
      .eq('id', draftId)
      .maybeSingle();

    if (currentDraftError) {
      throw currentDraftError;
    }

    if (!currentDraft) {
      return res.status(404).json({ error: 'Concept niet gevonden.' });
    }

    const nextStatus = currentDraft.type === 'vacature' ? 'actief' : 'approved';

    const { data, error } = await supabase
      .from('drafts')
      .update({
        status: nextStatus,
        reviewed_by: req.user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', draftId)
      .select(
        'id, form_data, status, type, omschrijving_nl, functie_eisen, wat_wij_bieden, omschrijving_pl, functie_eisen_pl, wat_wij_bieden_pl, social_nl, social_pl, linkedin_post, instagram_caption, image_path, criticus_passed, criticus_notes'
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
        status: 'rejected',
        reviewed_by: req.user.id,
        form_data: formData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', draftId)
      .select(
        'id, form_data, status, type, omschrijving_nl, functie_eisen, wat_wij_bieden, omschrijving_pl, functie_eisen_pl, wat_wij_bieden_pl, social_nl, social_pl, linkedin_post, instagram_caption, image_path, criticus_passed, criticus_notes'
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

router.post('/:id/image-override', async (req, res, next) => {
  try {
    if (req.user.role !== 'owner') {
      return res.status(403).json({ error: 'Alleen owners mogen een afbeelding overschrijven.' });
    }

    const draftId = req.params.id;
    const dataUrl = String(req.body?.dataUrl || '').trim();

    if (!dataUrl) {
      return res.status(400).json({ error: 'Afbeeldingsdata ontbreekt.' });
    }

    const { data: draft, error: draftError } = await supabase
      .from('drafts')
      .select('id, type')
      .eq('id', draftId)
      .maybeSingle();

    if (draftError) {
      throw draftError;
    }

    if (!draft) {
      return res.status(404).json({ error: 'Concept niet gevonden.' });
    }

    if (draft.type !== 'marketing-post') {
      return res.status(400).json({ error: 'Alleen marketingposts hebben een social afbeelding.' });
    }

    const imagePath = await saveUploadedImageDataUrl(dataUrl);

    const { data: updated, error: updateError } = await supabase
      .from('drafts')
      .update({
        image_path: imagePath,
        updated_at: new Date().toISOString(),
      })
      .eq('id', draftId)
      .select('id, image_path')
      .single();

    if (updateError) {
      throw updateError;
    }

    return res.json({ draft: { id: updated.id, image_path: updated.image_path } });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
