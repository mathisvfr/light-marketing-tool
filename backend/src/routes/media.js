const express = require('express');
const fs = require('node:fs/promises');
const path = require('node:path');
const { supabase } = require('../db/client');
const { saveDataUrlToLibrary, renderSvgToLibrary } = require('../services/render');

const router = express.Router();

// Only owners and recruiters may create media; viewers are read-only.
function requireWriteRole(req, res, next) {
  if (!['owner', 'recruiter'].includes(req.user?.role)) {
    return res.status(403).json({ error: 'Je hebt geen toegang tot deze actie.' });
  }
  return next();
}

// GET /api/media — lijst ophalen
// Query params: source ('upload'|'generated'), search (zoekterm op alt_text)
router.get('/', async (req, res, next) => {
  try {
    const { source, search } = req.query;

    let query = supabase
      .from('media_library')
      .select('id, filename, path, alt_text, tags, source, created_by, created_at, file_size, mime_type')
      .order('created_at', { ascending: false });

    if (source === 'upload' || source === 'generated') {
      query = query.eq('source', source);
    }

    if (search && String(search).trim()) {
      query = query.ilike('alt_text', `%${String(search).trim()}%`);
    }

    const { data, error } = await query;

    if (error) throw error;

    return res.json({ items: data || [] });
  } catch (err) {
    return next(err);
  }
});

// POST /api/media/upload — eigen foto uploaden (allen)
router.post('/upload', requireWriteRole, async (req, res, next) => {
  try {
    const dataUrl = String(req.body?.dataUrl || '').trim();
    const altText = String(req.body?.altText || '').trim().slice(0, 255);

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
      onderwerp,
      subtitle: 'Light Personeelsdiensten',
      caption,
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

// DELETE /api/media/:id — verwijderen (owner only)
router.delete('/:id', async (req, res, next) => {
  try {
    if (req.user.role !== 'owner') {
      return res.status(403).json({ error: 'Alleen owners mogen afbeeldingen verwijderen.' });
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
