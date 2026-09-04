const express = require('express');
const fs = require('node:fs/promises');
const path = require('node:path');
const { supabase } = require('../db/client');
const { generate, criticus, translateVacature, SUPPORTED_TRANSLATION_LANGS } = require('../services/claude');
const { renderSocialImage, saveUploadedImageDataUrl } = require('../services/render');
const { notifyAfterCommit } = require('../services/notifications');

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

const VALID_DRAFT_TYPES = ['vacature', 'marketing-post', 'blog'];

function normalizeDraftType(type) {
  if (VALID_DRAFT_TYPES.includes(type)) {
    return type;
  }
  throw new Error(`Ongeldig content-type: "${type}". Gebruik: ${VALID_DRAFT_TYPES.join(', ')}`);
}

function normalizeTranslations(value) {
  if (!value || typeof value !== 'object') {
    return {};
  }
  const result = {};
  for (const lang of SUPPORTED_TRANSLATION_LANGS) {
    const entry = value[lang];
    if (entry && typeof entry === 'object') {
      result[lang] = {
        omschrijving: entry.omschrijving || '',
        functie_eisen: entry.functie_eisen || '',
        wat_wij_bieden: entry.wat_wij_bieden || '',
        social: entry.social || '',
      };
    }
  }
  return result;
}

function normalizeTalen(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set();
  const result = [];
  for (const raw of value) {
    const code = String(raw || '').trim().toLowerCase();
    if (SUPPORTED_TRANSLATION_LANGS.includes(code) && !seen.has(code)) {
      seen.add(code);
      result.push(code);
    }
  }
  return result;
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
    social_nl: draft.social_nl,
    translations: normalizeTranslations(draft.translations),
    linkedin_post: draft.linkedin_post,
    instagram_caption: draft.instagram_caption,
    image_path: draft.image_path,
    blog_titel: draft.blog_titel || null,
    blog_html: draft.blog_html || null,
    criticus_passed: draft.criticus_passed,
    criticus_notes: draft.criticus_notes,
    generation_history: Array.isArray(draft.generation_history) ? draft.generation_history : [],
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
        'id, form_data, status, type, omschrijving_nl, functie_eisen, wat_wij_bieden, social_nl, translations, linkedin_post, instagram_caption, image_path, criticus_passed, criticus_notes, created_by, generation_history, blog_titel, blog_html'
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
        'id, form_data, status, type, omschrijving_nl, functie_eisen, wat_wij_bieden, social_nl, translations, linkedin_post, instagram_caption, image_path, criticus_passed, criticus_notes'
      )
      .single();

    if (error) {
      throw error;
    }

    // Auto-onboarding: marking the user as onboarded the first time they
    // create a draft is a stronger signal than "dashboard was non-empty."
    // The empty-state checklist stops re-appearing after this even if they
    // later delete every draft. Best-effort — never blocks the response.
    if (!req.user.onboarded_at) {
      supabase
        .from('users')
        .update({ onboarded_at: new Date().toISOString() })
        .eq('id', req.user.id)
        .then(({ error: onboardErr }) => {
          if (onboardErr) {
            console.error('Auto-onboard update failed:', onboardErr);
          }
        });
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

// Restore a previous generated-content snapshot. Body: { index } — 0 = most
// recent snapshot, 2 = oldest of the 3 we keep. The current content BEFORE
// the restore is pushed to history so the operation is undoable in kind.
router.post('/:id/restore-version', async (req, res, next) => {
  try {
    if (!['owner', 'recruiter'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Je hebt geen toegang tot deze actie.' });
    }

    const draftId = req.params.id;
    const rawIndex = Number(req.body?.index);
    if (!Number.isInteger(rawIndex) || rawIndex < 0 || rawIndex > 2) {
      return res.status(400).json({ error: 'Ongeldige versie-index.' });
    }

    const { data: draft, error: draftError } = await supabase
      .from('drafts')
      .select(
        'id, type, form_data, created_by, omschrijving_nl, functie_eisen, wat_wij_bieden, social_nl, translations, linkedin_post, instagram_caption, generation_history, blog_titel, blog_html'
      )
      .eq('id', draftId)
      .maybeSingle();

    if (draftError) throw draftError;
    if (!draft) return res.status(404).json({ error: 'Concept niet gevonden.' });
    if (!canEditDraft(req.user, draft)) {
      return res.status(403).json({ error: 'Je mag dit concept niet aanpassen.' });
    }

    const history = Array.isArray(draft.generation_history) ? draft.generation_history : [];
    const target = history[rawIndex];
    if (!target?.content) {
      return res.status(404).json({ error: 'Deze versie bestaat niet meer.' });
    }

    const currentSnapshot = {
      at: new Date().toISOString(),
      type: draft.type,
      content: {
        omschrijving_nl: draft.omschrijving_nl || null,
        functie_eisen: draft.functie_eisen || null,
        wat_wij_bieden: draft.wat_wij_bieden || null,
        social_nl: draft.social_nl || null,
        translations: draft.translations && typeof draft.translations === 'object' ? draft.translations : {},
        linkedin_post: draft.linkedin_post || null,
        instagram_caption: draft.instagram_caption || null,
      },
    };
    const newHistory = [currentSnapshot, ...history.filter((_, i) => i !== rawIndex)].slice(0, 3);

    // Restore only known columns. Oude snapshots kunnen nog omschrijving_pl
    // etc. bevatten van vóór de translations-migratie — die kolommen bestaan
    // niet meer, dus filter ze eruit en verplaats PL-content naar
    // translations.pl waar mogelijk.
    const rawContent = target.content || {};
    const restoredContent = {
      omschrijving_nl: rawContent.omschrijving_nl ?? null,
      functie_eisen: rawContent.functie_eisen ?? null,
      wat_wij_bieden: rawContent.wat_wij_bieden ?? null,
      social_nl: rawContent.social_nl ?? null,
      translations: rawContent.translations && typeof rawContent.translations === 'object'
        ? rawContent.translations
        : {},
      linkedin_post: rawContent.linkedin_post ?? null,
      instagram_caption: rawContent.instagram_caption ?? null,
    };
    if (rawContent.omschrijving_pl || rawContent.functie_eisen_pl || rawContent.wat_wij_bieden_pl || rawContent.social_pl) {
      restoredContent.translations = {
        ...restoredContent.translations,
        pl: {
          omschrijving: rawContent.omschrijving_pl || restoredContent.translations.pl?.omschrijving || '',
          functie_eisen: rawContent.functie_eisen_pl || restoredContent.translations.pl?.functie_eisen || '',
          wat_wij_bieden: rawContent.wat_wij_bieden_pl || restoredContent.translations.pl?.wat_wij_bieden || '',
          social: rawContent.social_pl || restoredContent.translations.pl?.social || '',
        },
      };
    }

    const updatePayload = {
      ...restoredContent,
      generation_history: newHistory,
      updated_at: new Date().toISOString(),
    };

    const { data: updatedDraft, error: updateError } = await supabase
      .from('drafts')
      .update(updatePayload)
      .eq('id', draft.id)
      .select(
        'id, form_data, status, type, omschrijving_nl, functie_eisen, wat_wij_bieden, social_nl, translations, linkedin_post, instagram_caption, image_path, criticus_passed, criticus_notes, generation_history, blog_titel, blog_html'
      )
      .single();

    if (updateError) throw updateError;
    return res.json({ draft: formatDraftForResponse(updatedDraft) });
  } catch (err) {
    return next(err);
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
        'id, type, form_data, created_by, omschrijving_nl, functie_eisen, wat_wij_bieden, social_nl, translations, linkedin_post, instagram_caption, image_path, generation_history'
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
    let updatePayload;
    if (draft.type === 'marketing-post') {
      updatePayload = {
        linkedin_post: generated.linkedin_post || draft.linkedin_post || null,
        social_nl: generated.facebook_post || draft.social_nl || null,
        instagram_caption: generated.instagram_caption || draft.instagram_caption || null,
        image_path: draft.image_path || null,
        omschrijving_nl: null,
        functie_eisen: null,
        wat_wij_bieden: null,
        translations: {},
        criticus_passed: null,
        criticus_notes: null,
        updated_at: new Date().toISOString(),
      };
    } else if (draft.type === 'blog') {
      // Blog: store structured fields in blog_titel/blog_html columns,
      // metadata in form_data. Author derived from created_by user.
      const formData = { ...(draft.form_data || {}) };
      formData.teaser = generated.teaser || formData.teaser || '';
      formData.lead = generated.lead || formData.lead || '';
      formData.meta_description = generated.meta_description || formData.meta_description || '';
      formData.leestijd = generated.leestijd || formData.leestijd || '';
      // Stable slug: generate once, never change (protects published URLs)
      if (!formData.slug) {
        const slugBase = (generated.blog_titel || formData.onderwerp || 'blog')
          .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        formData.slug = `${slugBase}-${draft.id.substring(0, 8)}`;
      }
      // Store author from the user who created the draft
      if (draft.created_by && !formData.author) {
        const { data: authorUser } = await supabase
          .from('users')
          .select('name, role')
          .eq('id', draft.created_by)
          .single();
        if (authorUser) {
          formData.author = authorUser.name;
          formData.authorRole = authorUser.role === 'owner' ? 'Directie' : 'Redactie';
        }
      }
      updatePayload = {
        blog_titel: generated.blog_titel || draft.blog_titel || null,
        blog_html: generated.blog_html || draft.blog_html || null,
        form_data: formData,
        omschrijving_nl: null,
        functie_eisen: null,
        wat_wij_bieden: null,
        social_nl: null,
        linkedin_post: null,
        instagram_caption: null,
        translations: {},
        criticus_passed: null,
        criticus_notes: null,
        updated_at: new Date().toISOString(),
      };
    } else {
      // Vacature (default)
      updatePayload = {
        omschrijving_nl: generated.omschrijving_nl || draft.omschrijving_nl || null,
        functie_eisen: generated.functie_eisen || draft.functie_eisen || null,
        wat_wij_bieden: generated.wat_wij_bieden || draft.wat_wij_bieden || null,
        social_nl: generated.social_nl || draft.social_nl || null,
        // Vertalingen worden hieronder async gegenereerd; reset naar leeg
        // zodat oude vertalingen niet blijven hangen na een regeneratie.
        translations: {},
        linkedin_post: null,
        criticus_passed: null,
        criticus_notes: null,
        updated_at: new Date().toISOString(),
      };
    }

    // Version history: snapshot the CURRENT generated fields (before we
    // overwrite them). Image_path is excluded — it lives on its own column
    // and we don't want 3 copies of it (T21). Cap at 3 entries.
    const hasCurrentGen =
      draft.omschrijving_nl ||
      draft.social_nl ||
      draft.linkedin_post ||
      draft.instagram_caption ||
      draft.wat_wij_bieden ||
      draft.functie_eisen;
    if (hasCurrentGen) {
      const snapshot = {
        at: new Date().toISOString(),
        type: draft.type,
        content: {
          omschrijving_nl: draft.omschrijving_nl || null,
          functie_eisen: draft.functie_eisen || null,
          wat_wij_bieden: draft.wat_wij_bieden || null,
          social_nl: draft.social_nl || null,
          translations: draft.translations && typeof draft.translations === 'object' ? draft.translations : {},
          linkedin_post: draft.linkedin_post || null,
          instagram_caption: draft.instagram_caption || null,
        },
      };
      const existingHistory = Array.isArray(draft.generation_history) ? draft.generation_history : [];
      const newHistory = [snapshot, ...existingHistory].slice(0, 3);
      updatePayload.generation_history = newHistory;
    }

    const { data: updatedDraft, error: updateError } = await supabase
      .from('drafts')
      .update(updatePayload)
      .eq('id', draft.id)
      .select(
        'id, form_data, status, type, omschrijving_nl, functie_eisen, wat_wij_bieden, social_nl, translations, linkedin_post, instagram_caption, image_path, criticus_passed, criticus_notes, generation_history, blog_titel, blog_html'
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
    } else if (!draft.image_path && draft.type === 'blog') {
      renderInfo = {
        name: 'blog-header',
        fields: { title: generated.blog_titel || draft.form_data?.onderwerp || 'Blog', category: draft.form_data?.categorie || 'Bedrijfsnieuws' },
        altText: generated.blog_titel || 'Blog header',
      };
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

    // Vertalingen naar extra talen: parallel op de achtergrond. NL is al terug
    // in de response; iedere taal die klaar is wordt los in translations[lang]
    // weggeschreven zodat de UI 'm kan oppikken via polling. Falen van één taal
    // blokkeert nooit de anderen.
    if (draft.type === 'vacature') {
      const talen = normalizeTalen(draft.form_data?.talen);
      for (const lang of talen) {
        translateVacature(lang, draft.form_data, generated)
          .then(async (translation) => {
            // Read-modify-write: merge into the current translations object so
            // parallel completions don't clobber each other. Small racy window
            // is acceptable — worst case one language re-runs on manual refresh.
            const { data: currentRow } = await supabase
              .from('drafts')
              .select('translations')
              .eq('id', draft.id)
              .maybeSingle();
            const merged = {
              ...(currentRow?.translations && typeof currentRow.translations === 'object'
                ? currentRow.translations
                : {}),
              [lang]: translation,
            };
            await supabase
              .from('drafts')
              .update({ translations: merged, updated_at: new Date().toISOString() })
              .eq('id', draft.id);
          })
          .catch((err) => {
            console.error(`Vertaling ${lang} mislukt voor draft ${draft.id}:`, err.message || err);
          });
      }
    }

    return;
  } catch (error) {
    return next(error);
  }
});

// Autosave endpoint: merges form_data only, never touches generated fields or
// status. The main PUT nulls unspecified columns, so a debounced form-input
// autosave must not go through it — it would wipe criticus_notes and content.
router.patch('/:id/form-data', async (req, res, next) => {
  try {
    if (!['owner', 'recruiter'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Je hebt geen toegang tot deze actie.' });
    }

    const draftId = req.params.id;
    const incoming = req.body?.formData;

    if (!incoming || typeof incoming !== 'object') {
      return res.status(400).json({ error: 'Formuliergegevens ontbreken.' });
    }

    const { data: draft, error: draftError } = await supabase
      .from('drafts')
      .select('id, created_by, status, form_data')
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

    const merged = { ...(draft.form_data || {}), ...incoming };

    const { error: updateErr } = await supabase
      .from('drafts')
      .update({ form_data: merged, updated_at: new Date().toISOString() })
      .eq('id', draft.id);

    if (updateErr) {
      throw updateErr;
    }

    return res.json({ saved_at: new Date().toISOString() });
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
      social_nl: req.body?.social_nl || null,
      translations: normalizeTranslations(req.body?.translations),
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
        'id, form_data, status, type, omschrijving_nl, functie_eisen, wat_wij_bieden, social_nl, translations, linkedin_post, instagram_caption, image_path, criticus_passed, criticus_notes'
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
        'id, form_data, status, type, omschrijving_nl, functie_eisen, wat_wij_bieden, social_nl, translations, linkedin_post, instagram_caption, image_path, criticus_passed, criticus_notes'
      )
      .single();

    if (updateError) {
      throw updateError;
    }

    // Fire draft.submitted to all owners AFTER the DB commit. Never blocks
    // the response — worst case the notify writes a failed log row.
    const { data: owners } = await supabase.from('users').select('id').eq('role', 'owner');
    const ownerIds = (owners || []).map((row) => row.id).filter((id) => id !== req.user.id);
    if (ownerIds.length > 0) {
      notifyAfterCommit('draft.submitted', {
        draft_id: draft.id,
        actor_name: req.user.name || req.user.email || 'Iemand',
        title: getDraftTitle(updatedDraft?.form_data) || 'concept',
        recipient_user_ids: ownerIds,
      });
    }

    return res.json({ draft: formatDraftForResponse(updatedDraft) });
  } catch (error) {
    return next(error);
  }
});

// Bulk approve: owner-only single-round-trip approval. Mirrors the per-id
// approve semantics (vacature → 'actief', others → 'approved') but skips the
// N chatty requests the wachtrij was doing. Guards against runaway payloads
// with a hard cap of 100 ids per call.
router.post('/bulk-approve', async (req, res, next) => {
  try {
    if (req.user.role !== 'owner') {
      return res.status(403).json({ error: 'Je hebt geen toegang tot deze actie.' });
    }

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
      .select('id, type, status, sollicitatie_url, form_data, omschrijving_nl')
      .in('id', ids);

    if (fetchError) {
      throw fetchError;
    }

    // Owner may bulk-approve directly from 'draft' status too (skip the
    // pending_approval gate). Recruiter is not allowed on this route at all
    // (owner-only check above), so no need to branch by role here.
    const APPROVABLE_STATUSES = new Set(['pending_approval', 'draft']);
    const eligible = (drafts || []).filter((d) => APPROVABLE_STATUSES.has(d.status));
    const skipped = (drafts || [])
      .filter((d) => !APPROVABLE_STATUSES.has(d.status))
      .map((d) => ({ id: d.id, reason: 'wrong-status', status: d.status }));
    const notFound = ids
      .filter((id) => !(drafts || []).some((d) => d.id === id))
      .map((id) => ({ id, reason: 'not-found' }));

    // Vacatures moeten dezelfde validatie doorstaan als de single-approve
    // route: geldige sollicitatie_url + NL-omschrijving. Skip degenen die
    // falen zodat de rest in de bulk toch door kan.
    const vacatureCandidates = eligible.filter((d) => d.type === 'vacature');
    const vacatureIds = [];

    for (const draft of vacatureCandidates) {
      const sollicitatieUrl = String(
        draft.sollicitatie_url || draft.form_data?.sollicitatie_url || ''
      ).trim();
      const hasValidUrl = sollicitatieUrl && /^https?:\/\//i.test(sollicitatieUrl);
      const hasNlDescription = draft.omschrijving_nl && String(draft.omschrijving_nl).trim();

      if (!hasValidUrl) {
        skipped.push({ id: draft.id, reason: 'missing-sollicitatie-url' });
        continue;
      }

      if (!hasNlDescription) {
        skipped.push({ id: draft.id, reason: 'missing-nl-description' });
        continue;
      }

      vacatureIds.push(draft.id);
    }

    const otherIds = eligible.filter((d) => d.type !== 'vacature').map((d) => d.id);
    const nowIso = new Date().toISOString();
    const succeeded = [];

    if (vacatureIds.length > 0) {
      const { error } = await supabase
        .from('drafts')
        .update({ status: 'actief', reviewed_by: req.user.id, updated_at: nowIso })
        .in('id', vacatureIds);

      if (error) {
        throw error;
      }
      for (const id of vacatureIds) {
        succeeded.push({ id, status: 'actief' });
      }
    }

    if (otherIds.length > 0) {
      const { error } = await supabase
        .from('drafts')
        .update({ status: 'approved', reviewed_by: req.user.id, updated_at: nowIso })
        .in('id', otherIds);

      if (error) {
        throw error;
      }
      for (const id of otherIds) {
        succeeded.push({ id, status: 'approved' });
      }
    }

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

// Shared bulk-input parser: enforces the array shape + 100-item cap and returns
// the deduped id list. Kept here (not helper file) so every bulk route uses the
// same error copy — the frontend surfaces these strings directly.
function parseBulkIds(rawIds) {
  const ids = Array.isArray(rawIds) ? rawIds : null;
  if (!ids || ids.length === 0) {
    return { error: 'Geen concepten geselecteerd.' };
  }
  if (ids.length > 100) {
    return { error: 'Maximaal 100 concepten per keer.' };
  }
  return { ids: Array.from(new Set(ids.map((id) => String(id)))) };
}

// Owner-only. Rejects pending_approval drafts in one shot. Any row not in
// pending_approval lands in skipped[] with a reason so the UI can explain
// partial results.
router.post('/bulk-reject', async (req, res, next) => {
  try {
    if (req.user.role !== 'owner') {
      return res.status(403).json({ error: 'Je hebt geen toegang tot deze actie.' });
    }

    const parsed = parseBulkIds(req.body?.ids);
    if (parsed.error) {
      return res.status(400).json({ error: parsed.error });
    }

    const { data: drafts, error: fetchError } = await supabase
      .from('drafts')
      .select('id, status')
      .in('id', parsed.ids);

    if (fetchError) {
      throw fetchError;
    }

    const eligible = (drafts || []).filter((d) => d.status === 'pending_approval');
    const skipped = (drafts || [])
      .filter((d) => d.status !== 'pending_approval')
      .map((d) => ({ id: d.id, reason: 'wrong-status', status: d.status }));
    const notFound = parsed.ids
      .filter((id) => !(drafts || []).some((d) => d.id === id))
      .map((id) => ({ id, reason: 'not-found' }));

    const succeeded = [];
    if (eligible.length > 0) {
      const { error } = await supabase
        .from('drafts')
        .update({ status: 'rejected', reviewed_by: req.user.id, updated_at: new Date().toISOString() })
        .in('id', eligible.map((d) => d.id));

      if (error) {
        throw error;
      }
      for (const draft of eligible) {
        succeeded.push({ id: draft.id, status: 'rejected' });
      }
    }

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

// Owner deletes anything; recruiter deletes only own drafts. Recruiter's
// other-author selections land in skipped, so a mixed batch still deletes
// what it can. Delete is hard — no soft-delete column exists.
router.post('/bulk-delete', async (req, res, next) => {
  try {
    if (!['owner', 'recruiter'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Je hebt geen toegang tot deze actie.' });
    }

    const parsed = parseBulkIds(req.body?.ids);
    if (parsed.error) {
      return res.status(400).json({ error: parsed.error });
    }

    const { data: drafts, error: fetchError } = await supabase
      .from('drafts')
      .select('id, created_by')
      .in('id', parsed.ids);

    if (fetchError) {
      throw fetchError;
    }

    const skipped = [];
    const eligibleIds = [];

    for (const draft of drafts || []) {
      if (req.user.role === 'owner' || draft.created_by === req.user.id) {
        eligibleIds.push(draft.id);
      } else {
        skipped.push({ id: draft.id, reason: 'not-owner' });
      }
    }

    const notFound = parsed.ids
      .filter((id) => !(drafts || []).some((d) => d.id === id))
      .map((id) => ({ id, reason: 'not-found' }));

    if (eligibleIds.length > 0) {
      const { error } = await supabase.from('drafts').delete().in('id', eligibleIds);
      if (error) {
        throw error;
      }
    }

    return res.json({
      succeededCount: eligibleIds.length,
      skippedCount: skipped.length + notFound.length,
      succeeded: eligibleIds.map((id) => ({ id, status: 'deleted' })),
      skipped: [...skipped, ...notFound],
    });
  } catch (error) {
    return next(error);
  }
});

// Owner submits anything; recruiter submits only own. Only 'draft' rows
// eligible — resubmitting a rejected or already-pending row is a UI mistake
// and shouldn't be silently allowed.
router.post('/bulk-submit', async (req, res, next) => {
  try {
    if (!['owner', 'recruiter'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Je hebt geen toegang tot deze actie.' });
    }

    const parsed = parseBulkIds(req.body?.ids);
    if (parsed.error) {
      return res.status(400).json({ error: parsed.error });
    }

    const { data: drafts, error: fetchError } = await supabase
      .from('drafts')
      .select('id, status, created_by')
      .in('id', parsed.ids);

    if (fetchError) {
      throw fetchError;
    }

    const skipped = [];
    const eligibleIds = [];

    for (const draft of drafts || []) {
      if (draft.status !== 'draft') {
        skipped.push({ id: draft.id, reason: 'wrong-status', status: draft.status });
        continue;
      }
      if (req.user.role !== 'owner' && draft.created_by !== req.user.id) {
        skipped.push({ id: draft.id, reason: 'not-owner' });
        continue;
      }
      eligibleIds.push(draft.id);
    }

    const notFound = parsed.ids
      .filter((id) => !(drafts || []).some((d) => d.id === id))
      .map((id) => ({ id, reason: 'not-found' }));

    if (eligibleIds.length > 0) {
      const { error } = await supabase
        .from('drafts')
        .update({ status: 'pending_approval', updated_at: new Date().toISOString() })
        .in('id', eligibleIds);

      if (error) {
        throw error;
      }
    }

    return res.json({
      succeededCount: eligibleIds.length,
      skippedCount: skipped.length + notFound.length,
      succeeded: eligibleIds.map((id) => ({ id, status: 'pending_approval' })),
      skipped: [...skipped, ...notFound],
    });
  } catch (error) {
    return next(error);
  }
});

// Owner-only. Vacatures met status 'actief' -> 'expired'. Publicaties krijgen
// dezelfde expired_at zodat de "Gepubliceerd"-tab en de feed synchroon blijven.
// Non-vacature rows worden overgeslagen (marketing-posts hebben geen 'actief').
router.post('/bulk-expire', async (req, res, next) => {
  try {
    if (req.user.role !== 'owner') {
      return res.status(403).json({ error: 'Je hebt geen toegang tot deze actie.' });
    }

    const parsed = parseBulkIds(req.body?.ids);
    if (parsed.error) {
      return res.status(400).json({ error: parsed.error });
    }

    const { data: drafts, error: fetchError } = await supabase
      .from('drafts')
      .select('id, type, status')
      .in('id', parsed.ids);

    if (fetchError) {
      throw fetchError;
    }

    const skipped = [];
    const eligibleIds = [];

    for (const draft of drafts || []) {
      if (draft.type !== 'vacature') {
        skipped.push({ id: draft.id, reason: 'not-vacature' });
        continue;
      }
      if (draft.status !== 'actief') {
        skipped.push({ id: draft.id, reason: 'wrong-status', status: draft.status });
        continue;
      }
      eligibleIds.push(draft.id);
    }

    const notFound = parsed.ids
      .filter((id) => !(drafts || []).some((d) => d.id === id))
      .map((id) => ({ id, reason: 'not-found' }));

    const nowIso = new Date().toISOString();

    if (eligibleIds.length > 0) {
      const { error: draftUpdateError } = await supabase
        .from('drafts')
        .update({ status: 'expired', updated_at: nowIso })
        .in('id', eligibleIds);

      if (draftUpdateError) {
        throw draftUpdateError;
      }

      const { error: pubUpdateError } = await supabase
        .from('publications')
        .update({ expired_at: nowIso })
        .in('draft_id', eligibleIds)
        .is('expired_at', null);

      if (pubUpdateError) {
        throw pubUpdateError;
      }
    }

    return res.json({
      succeededCount: eligibleIds.length,
      skippedCount: skipped.length + notFound.length,
      succeeded: eligibleIds.map((id) => ({ id, status: 'expired' })),
      skipped: [...skipped, ...notFound],
    });
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
      .select('id, type, status, created_by, sollicitatie_url, form_data, omschrijving_nl')
      .eq('id', draftId)
      .maybeSingle();

    if (currentDraftError) {
      throw currentDraftError;
    }

    if (!currentDraft) {
      return res.status(404).json({ error: 'Concept niet gevonden.' });
    }

    if (currentDraft.type === 'vacature') {
      // Sollicitatie-URL is de enige weg voor kandidaten om te reageren via de
      // feed. Zonder geldige URL komt niemand ergens; blokkeer daarom activering.
      const sollicitatieUrl = String(
        currentDraft.sollicitatie_url || currentDraft.form_data?.sollicitatie_url || ''
      ).trim();

      if (!sollicitatieUrl || !/^https?:\/\//i.test(sollicitatieUrl)) {
        return res.status(400).json({
          error:
            'Sollicitatie-URL ontbreekt of is ongeldig. Zonder geldige URL komen kandidaten via de feed nergens terecht.',
        });
      }

      if (!currentDraft.omschrijving_nl || !String(currentDraft.omschrijving_nl).trim()) {
        return res.status(400).json({
          error: 'Nederlandse omschrijving ontbreekt; Jobit vereist een NL-omschrijving.',
        });
      }
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
        'id, form_data, status, type, omschrijving_nl, functie_eisen, wat_wij_bieden, social_nl, translations, linkedin_post, instagram_caption, image_path, criticus_passed, criticus_notes'
      )
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return res.status(404).json({ error: 'Concept niet gevonden.' });
    }

    // Notify the creator (post-commit). Suppress if the owner is the creator
    // (self-approval doesn't need a notification).
    if (currentDraft.created_by && currentDraft.created_by !== req.user.id) {
      notifyAfterCommit('draft.approved', {
        draft_id: draftId,
        actor_name: req.user.name || req.user.email || 'De eigenaar',
        title: getDraftTitle(data.form_data) || 'concept',
        recipient_user_ids: [currentDraft.created_by],
      });
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
      .select('id, form_data, created_by')
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
        'id, form_data, status, type, omschrijving_nl, functie_eisen, wat_wij_bieden, social_nl, translations, linkedin_post, instagram_caption, image_path, criticus_passed, criticus_notes'
      )
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (currentDraft.created_by && currentDraft.created_by !== req.user.id) {
      notifyAfterCommit('draft.rejected', {
        draft_id: draftId,
        actor_name: req.user.name || req.user.email || 'De eigenaar',
        title: getDraftTitle(data?.form_data) || 'concept',
        reason: comment,
        recipient_user_ids: [currentDraft.created_by],
      });
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
