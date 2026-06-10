const express = require('express');
const { supabase } = require('../db/client');
const { generate } = require('../services/claude');
const { publishSeoPage } = require('../services/publication');
const { notify } = require('../services/notifications');

const router = express.Router();

const SELECT_COLUMNS =
  'id, sector, locatie, doelgroep, slug, keywords, meta_title, meta_description, h1, body_html, status, external_id, created_by, reviewed_by, published_at, created_at, updated_at';

const VALID_DOELGROEP = ['werkzoekenden', 'opdrachtgevers'];

function canEdit(user, page) {
  if (user.role === 'owner') {
    return true;
  }

  return page.created_by === user.id;
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildSlug({ sector, locatie, doelgroep }) {
  const base =
    doelgroep === 'opdrachtgevers'
      ? `uitzendbureau-${sector}-${locatie}`
      : `${sector}-vacatures-${locatie}`;

  return slugify(base);
}

function formatPage(page) {
  return {
    id: page.id,
    sector: page.sector,
    locatie: page.locatie,
    doelgroep: page.doelgroep,
    slug: page.slug,
    keywords: page.keywords,
    metaTitle: page.meta_title,
    metaDescription: page.meta_description,
    h1: page.h1,
    bodyHtml: page.body_html,
    status: page.status,
    externalId: page.external_id,
    createdBy: page.created_by,
    publishedAt: page.published_at,
    createdAt: page.created_at,
    updatedAt: page.updated_at,
  };
}

async function ensureUniqueSlug(baseSlug, ignoreId) {
  let candidate = baseSlug || 'seo-pagina';
  let suffix = 1;

  // Try the base slug, then append -2, -3, ... until unique.
  for (;;) {
    let query = supabase.from('seo_pages').select('id').eq('slug', candidate);

    if (ignoreId) {
      query = query.neq('id', ignoreId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return candidate;
    }

    suffix += 1;
    candidate = `${baseSlug}-${suffix}`;
  }
}

router.get('/', async (req, res, next) => {
  try {
    const statusFilter = String(req.query?.status || 'all');
    const doelgroepFilter = String(req.query?.doelgroep || 'all');

    let query = supabase
      .from('seo_pages')
      .select(
        'id, sector, locatie, doelgroep, slug, status, external_id, created_by, published_at, created_at, updated_at, creator:users!seo_pages_created_by_fkey(id, name)'
      )
      .order('created_at', { ascending: false })
      .limit(500);

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    if (doelgroepFilter !== 'all' && VALID_DOELGROEP.includes(doelgroepFilter)) {
      query = query.eq('doelgroep', doelgroepFilter);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const pages = (data || []).map((item) => ({
      id: item.id,
      sector: item.sector,
      locatie: item.locatie,
      doelgroep: item.doelgroep,
      slug: item.slug,
      status: item.status,
      externalId: item.external_id,
      createdBy: item.created_by,
      authorName: item.creator?.name || 'Onbekend',
      publishedAt: item.published_at,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    }));

    return res.json({ pages });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('seo_pages')
      .select(SELECT_COLUMNS)
      .eq('id', req.params.id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return res.status(404).json({ error: 'SEO-pagina niet gevonden.' });
    }

    if (req.user.role === 'recruiter' && data.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Je hebt geen toegang tot deze pagina.' });
    }

    return res.json({ page: formatPage(data) });
  } catch (error) {
    return next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    if (!['owner', 'recruiter'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Je hebt geen toegang tot deze actie.' });
    }

    const sector = String(req.body?.sector || '').trim();
    const locatie = String(req.body?.locatie || '').trim();
    const doelgroep = String(req.body?.doelgroep || '').trim();
    const keywords = req.body?.keywords ? String(req.body.keywords).trim() : null;

    if (!sector || !locatie) {
      return res.status(400).json({ error: 'Sector en locatie zijn verplicht.' });
    }

    if (!VALID_DOELGROEP.includes(doelgroep)) {
      return res.status(400).json({ error: 'Ongeldige doelgroep.' });
    }

    const baseSlug = buildSlug({ sector, locatie, doelgroep });
    const slug = await ensureUniqueSlug(baseSlug);

    const payload = {
      sector,
      locatie,
      doelgroep,
      keywords,
      slug,
      status: 'draft',
      created_by: req.user.id,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('seo_pages')
      .insert(payload)
      .select(SELECT_COLUMNS)
      .single();

    if (error) {
      throw error;
    }

    return res.status(201).json({ page: formatPage(data) });
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/generate', async (req, res, next) => {
  try {
    if (!['owner', 'recruiter'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Je hebt geen toegang tot deze actie.' });
    }

    const { data: page, error: pageError } = await supabase
      .from('seo_pages')
      .select('id, sector, locatie, doelgroep, keywords, created_by, status')
      .eq('id', req.params.id)
      .maybeSingle();

    if (pageError) {
      throw pageError;
    }

    if (!page) {
      return res.status(404).json({ error: 'SEO-pagina niet gevonden.' });
    }

    if (!canEdit(req.user, page)) {
      return res.status(403).json({ error: 'Je mag deze pagina niet aanpassen.' });
    }

    const generated = await generate('seo-page', {
      sector: page.sector,
      locatie: page.locatie,
      doelgroep: page.doelgroep,
      keywords: page.keywords || '',
    });

    const updatePayload = {
      meta_title: generated.meta_title || null,
      meta_description: generated.meta_description || null,
      h1: generated.h1 || null,
      body_html: generated.body_html || null,
      keywords: generated.keywords || page.keywords || null,
      updated_at: new Date().toISOString(),
    };

    const { data: updated, error: updateError } = await supabase
      .from('seo_pages')
      .update(updatePayload)
      .eq('id', page.id)
      .select(SELECT_COLUMNS)
      .single();

    if (updateError) {
      throw updateError;
    }

    return res.json({ page: formatPage(updated) });
  } catch (error) {
    return next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    if (!['owner', 'recruiter'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Je hebt geen toegang tot deze actie.' });
    }

    const { data: page, error: pageError } = await supabase
      .from('seo_pages')
      .select('id, created_by')
      .eq('id', req.params.id)
      .maybeSingle();

    if (pageError) {
      throw pageError;
    }

    if (!page) {
      return res.status(404).json({ error: 'SEO-pagina niet gevonden.' });
    }

    if (!canEdit(req.user, page)) {
      return res.status(403).json({ error: 'Je mag deze pagina niet aanpassen.' });
    }

    const updatePayload = {
      meta_title: req.body?.metaTitle ?? null,
      meta_description: req.body?.metaDescription ?? null,
      h1: req.body?.h1 ?? null,
      body_html: req.body?.bodyHtml ?? null,
      keywords: req.body?.keywords ?? null,
      updated_at: new Date().toISOString(),
    };

    if (req.body?.status && ['draft', 'approved'].includes(req.body.status)) {
      updatePayload.status = req.body.status;
    }

    const { data: updated, error: updateError } = await supabase
      .from('seo_pages')
      .update(updatePayload)
      .eq('id', page.id)
      .select(SELECT_COLUMNS)
      .single();

    if (updateError) {
      throw updateError;
    }

    return res.json({ page: formatPage(updated) });
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/submit', async (req, res, next) => {
  try {
    if (!['owner', 'recruiter'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Je hebt geen toegang tot deze actie.' });
    }

    const { data: page, error: pageError } = await supabase
      .from('seo_pages')
      .select('id, created_by')
      .eq('id', req.params.id)
      .maybeSingle();

    if (pageError) {
      throw pageError;
    }

    if (!page) {
      return res.status(404).json({ error: 'SEO-pagina niet gevonden.' });
    }

    if (!canEdit(req.user, page)) {
      return res.status(403).json({ error: 'Je mag deze pagina niet indienen.' });
    }

    const { error: updateError } = await supabase
      .from('seo_pages')
      .update({ status: 'pending_approval', updated_at: new Date().toISOString() })
      .eq('id', page.id);

    if (updateError) {
      throw updateError;
    }

    await notify('seo_submitted', {
      pageId: page.id,
      slug: page.slug,
      submittedBy: req.user.email,
    });

    return res.json({ status: 'pending_approval' });
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/approve', async (req, res, next) => {
  try {
    if (req.user.role !== 'owner') {
      return res.status(403).json({ error: 'Alleen eigenaren kunnen goedkeuren.' });
    }

    const { error } = await supabase
      .from('seo_pages')
      .update({
        status: 'approved',
        reviewed_by: req.user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id);

    if (error) {
      throw error;
    }

    await notify('seo_approved', {
      pageId: req.params.id,
      approvedBy: req.user.email,
    });

    return res.json({ status: 'approved' });
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/reject', async (req, res, next) => {
  try {
    if (req.user.role !== 'owner') {
      return res.status(403).json({ error: 'Alleen eigenaren kunnen afwijzen.' });
    }

    const { error } = await supabase
      .from('seo_pages')
      .update({
        status: 'draft',
        reviewed_by: req.user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id);

    if (error) {
      throw error;
    }

    await notify('seo_rejected', {
      pageId: req.params.id,
      rejectedBy: req.user.email,
    });

    return res.json({ status: 'draft' });
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/publish', async (req, res, next) => {
  try {
    if (req.user.role !== 'owner') {
      return res.status(403).json({ error: 'Alleen eigenaren kunnen publiceren.' });
    }

    const { data: page, error: pageError } = await supabase
      .from('seo_pages')
      .select(SELECT_COLUMNS)
      .eq('id', req.params.id)
      .maybeSingle();

    if (pageError) {
      throw pageError;
    }

    if (!page) {
      return res.status(404).json({ error: 'SEO-pagina niet gevonden.' });
    }

    if (!page.body_html) {
      return res.status(400).json({ error: 'Genereer eerst de inhoud van de pagina.' });
    }

    const result = await publishSeoPage(page);

    const { data: updated, error: updateError } = await supabase
      .from('seo_pages')
      .update({
        status: result.status === 'failed' ? page.status : 'published',
        external_id: result.externalId || page.external_id,
        published_at: result.status === 'failed' ? page.published_at : new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', page.id)
      .select(SELECT_COLUMNS)
      .single();

    if (updateError) {
      throw updateError;
    }

    if (result.status === 'failed') {
      return res.status(502).json({
        error: result.error || 'Publiceren naar WordPress is mislukt.',
        page: formatPage(updated),
      });
    }

    await notify('seo_published', {
      pageId: page.id,
      slug: page.slug,
      publishedBy: req.user.email,
    });

    return res.json({ page: formatPage(updated) });
  } catch (error) {
    return next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { data: page, error: pageError } = await supabase
      .from('seo_pages')
      .select('id, created_by')
      .eq('id', req.params.id)
      .maybeSingle();

    if (pageError) {
      throw pageError;
    }

    if (!page) {
      return res.status(404).json({ error: 'SEO-pagina niet gevonden.' });
    }

    if (!canEdit(req.user, page)) {
      return res.status(403).json({ error: 'Je mag deze pagina niet verwijderen.' });
    }

    const { error } = await supabase.from('seo_pages').delete().eq('id', page.id);

    if (error) {
      throw error;
    }

    return res.json({ deleted: true });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
