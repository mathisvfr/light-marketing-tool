const express = require('express');
const fs = require('node:fs/promises');
const path = require('node:path');
const { supabase } = require('../db/client');
const { saveDataUrlToLibrary, renderSvgToLibrary } = require('../services/render');
const unsplash = require('../services/unsplash');

const router = express.Router();

// Only owners and recruiters may create media; viewers are read-only.
function requireWriteRole(req, res, next) {
  if (!['owner', 'manager', 'recruiter'].includes(req.user?.role)) {
    return res.status(403).json({ error: 'Je hebt geen toegang tot deze actie.' });
  }
  return next();
}

// GET /api/media — lijst ophalen
// Query params:
//   source ('upload'|'generated')
//   search (zoekterm; matched against filename + alt_text)
//   tags (comma-separated; items must have ALL specified tags)
router.get('/', async (req, res, next) => {
  try {
    const { source, search, tags } = req.query;

    let query = supabase
      .from('media_library')
      .select('id, filename, path, alt_text, tags, source, created_by, created_at, file_size, mime_type, unsplash_photo_id, unsplash_photographer, unsplash_photographer_url')
      .order('created_at', { ascending: false });

    if (source === 'upload' || source === 'generated' || source === 'unsplash') {
      query = query.eq('source', source);
    }

    if (search && String(search).trim()) {
      const term = String(search).trim().replace(/[%_]/g, '\\$&');
      // Match either filename or alt_text — Sandra remembers filenames she
      // uploaded, and alt_text captures the description.
      query = query.or(`filename.ilike.%${term}%,alt_text.ilike.%${term}%`);
    }

    if (tags && String(tags).trim()) {
      const list = String(tags)
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      if (list.length > 0) {
        // Postgres array contains: all requested tags must be present.
        query = query.contains('tags', list);
      }
    }

    const { data, error } = await query;

    if (error) throw error;

    // Also return the top tags (up to 8) so the MediaPicker can render chips
    // without a second round trip. Ordered by usage frequency descending.
    const tagCounts = new Map();
    for (const item of data || []) {
      for (const tag of item.tags || []) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }
    const topTags = Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tag]) => tag);

    return res.json({ items: data || [], topTags });
  } catch (err) {
    return next(err);
  }
});

// POST /api/media/upload — eigen foto uploaden (allen)
router.post('/upload', requireWriteRole, async (req, res, next) => {
  try {
    const dataUrl = String(req.body?.dataUrl || '').trim();
    const altText = String(req.body?.altText || '').trim().slice(0, 255);
    // Accept comma-separated string or array. Sanitize: dedupe, lowercase,
    // strip spaces, cap length. Cap of 10 tags per asset — anything more is
    // organisational overkill for a 3-user tool.
    const rawTags = req.body?.tags;
    const tags = (Array.isArray(rawTags) ? rawTags : String(rawTags || '').split(','))
      .map((t) => String(t).trim().toLowerCase().slice(0, 40))
      .filter(Boolean);
    const uniqueTags = Array.from(new Set(tags)).slice(0, 10);

    if (!dataUrl) {
      return res.status(400).json({ error: 'Afbeeldingsdata ontbreekt.' });
    }

    const { filePath, filename, mimeType, fileSize } = await saveDataUrlToLibrary(dataUrl);

    const { data: item, error } = await supabase
      .from('media_library')
      .insert({
        filename,
        path: filePath,
        alt_text: altText || null,
        tags: uniqueTags,
        source: 'upload',
        created_by: req.user.id,
        file_size: fileSize,
        mime_type: mimeType,
      })
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json({ item });
  } catch (err) {
    return next(err);
  }
});

// POST /api/media/generate — nieuwe branded afbeelding genereren
router.post('/generate', requireWriteRole, async (req, res, next) => {
  try {
    const onderwerp = String(req.body?.onderwerp || '').trim();
    const caption = String(req.body?.caption || '').trim();
    const altText = String(req.body?.altText || onderwerp || '').trim().slice(0, 255);

    const { filePath, filename, mimeType, fileSize } = await renderSvgToLibrary({
      headline: onderwerp || undefined,
      accent: caption || undefined,
    });

    const { data: item, error } = await supabase
      .from('media_library')
      .insert({
        filename,
        path: filePath,
        alt_text: altText || null,
        source: 'generated',
        created_by: req.user.id,
        file_size: fileSize,
        mime_type: mimeType,
      })
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json({ item });
  } catch (err) {
    return next(err);
  }
});

// POST /api/media/unsplash-select — Unsplash-foto selecteren en opslaan in library
router.post('/unsplash-select', requireWriteRole, async (req, res, next) => {
  try {
    const unsplashPhotoId = String(req.body?.unsplashPhotoId || '').trim();
    const url = String(req.body?.url || '').trim();
    const altText = String(req.body?.altText || '').trim().slice(0, 255);
    const photographer = String(req.body?.photographer || '').trim();
    const photographerUrl = String(req.body?.photographerUrl || '').trim();
    const downloadLocation = String(req.body?.downloadLocation || '').trim();

    if (!unsplashPhotoId || !url) {
      return res.status(400).json({ error: 'Unsplash foto-ID en URL zijn verplicht.' });
    }
    if (!photographer || !photographerUrl) {
      return res.status(400).json({ error: 'Fotograaf-informatie is verplicht voor attributie.' });
    }

    // Dedup: als dezelfde foto al in de library staat, retourneer die
    const { data: existing, error: findError } = await supabase
      .from('media_library')
      .select('id, filename, path, alt_text, tags, source, created_by, created_at, file_size, mime_type, unsplash_photo_id, unsplash_photographer, unsplash_photographer_url')
      .eq('unsplash_photo_id', unsplashPhotoId)
      .maybeSingle();

    if (findError) throw findError;
    if (existing) {
      return res.status(200).json({ item: existing, reused: true });
    }

    // Nieuwe entry aanmaken
    const { data: item, error: insertError } = await supabase
      .from('media_library')
      .insert({
        filename: `unsplash-${unsplashPhotoId}.jpg`,
        path: url,
        alt_text: altText || null,
        tags: [],
        source: 'unsplash',
        created_by: req.user.id,
        unsplash_photo_id: unsplashPhotoId,
        unsplash_photographer: photographer,
        unsplash_photographer_url: photographerUrl,
      })
      .select('id, filename, path, alt_text, tags, source, created_by, created_at, file_size, mime_type, unsplash_photo_id, unsplash_photographer, unsplash_photographer_url')
      .single();

    if (insertError) throw insertError;

    // Download tracking (fire-and-forget, Unsplash TOS)
    if (downloadLocation) {
      unsplash.trackDownload(downloadLocation).catch(() => {});
    }

    return res.status(201).json({ item, reused: false });
  } catch (err) {
    return next(err);
  }
});

// DELETE /api/media/:id — verwijderen (owner only)
router.delete('/:id', async (req, res, next) => {
  try {
    if (!['owner', 'manager'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Alleen owners en managers mogen afbeeldingen verwijderen.' });
    }

    const { data: item, error: fetchError } = await supabase
      .from('media_library')
      .select('id, path')
      .eq('id', req.params.id)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!item) return res.status(404).json({ error: 'Afbeelding niet gevonden.' });

    // Bestand van schijf verwijderen
    const absolutePath = path.resolve(__dirname, '..', '..', 'uploads', 'library', path.basename(item.path));
    try {
      await fs.unlink(absolutePath);
    } catch (_err) {
      // Bestand al weg — geen probleem
    }

    const { error: deleteError } = await supabase
      .from('media_library')
      .delete()
      .eq('id', item.id);

    if (deleteError) throw deleteError;

    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
