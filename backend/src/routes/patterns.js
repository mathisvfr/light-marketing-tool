const express = require('express');
const { supabase } = require('../db/client');
const { nextSlot } = require('../services/patternScheduler');

const router = express.Router();

const ALLOWED_CHANNELS = ['linkedin', 'facebook', 'instagram'];
const HHMM_RE = /^(\d{1,2}):(\d{2})$/;

function requireOwner(req, res, next) {
  if (req.user?.role !== 'owner') {
    return res.status(403).json({ error: 'Je hebt geen toegang tot deze actie.' });
  }
  return next();
}

// Client sends weekdays as an array of numbers. Sanitize: keep only ints in
// 1..7, dedupe, sort. Empty result → 400 upstream.
function sanitizeWeekdays(input) {
  if (!Array.isArray(input)) return [];
  const cleaned = new Set();
  for (const item of input) {
    const n = Number(item);
    if (Number.isInteger(n) && n >= 1 && n <= 7) {
      cleaned.add(n);
    }
  }
  return Array.from(cleaned).sort((a, b) => a - b);
}

function sanitizeTime(input) {
  const match = String(input || '').trim().match(HHMM_RE);
  if (!match) return null;
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function validatePayload(body) {
  const errors = [];
  const name = String(body?.name || '').trim().slice(0, 80);
  if (!name) errors.push('Naam is verplicht.');

  const channel = String(body?.channel || '').trim().toLowerCase();
  if (!ALLOWED_CHANNELS.includes(channel)) errors.push('Kanaal is ongeldig.');

  const weekdays = sanitizeWeekdays(body?.weekdays);
  if (weekdays.length === 0) errors.push('Kies minimaal één weekdag.');

  const time = sanitizeTime(body?.time_of_day);
  if (!time) errors.push('Tijd moet HH:MM zijn (00:00 tot 23:59).');

  const isActive = body?.is_active === undefined ? true : Boolean(body.is_active);

  return {
    errors,
    fields: {
      name,
      channel,
      weekdays,
      time_of_day: time,
      is_active: isActive,
    },
  };
}

function formatPatternForResponse(row) {
  return {
    id: row.id,
    name: row.name,
    channel: row.channel,
    weekdays: row.weekdays || [],
    timeOfDay: row.time_of_day,
    isActive: row.is_active,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// GET /patterns — everyone authed can list (owner writes them, but Sandra/Liza
// see them in the MarketingPost dropdown).
router.get('/', async (_req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('publication_patterns')
      .select('id, name, channel, weekdays, time_of_day, is_active, created_by, created_at, updated_at')
      .order('created_at', { ascending: true });

    if (error) throw error;

    return res.json({ patterns: (data || []).map(formatPatternForResponse) });
  } catch (err) {
    return next(err);
  }
});

router.post('/', requireOwner, async (req, res, next) => {
  try {
    const { errors, fields } = validatePayload(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join(' ') });
    }

    const { data, error } = await supabase
      .from('publication_patterns')
      .insert({
        ...fields,
        created_by: req.user.id,
        updated_at: new Date().toISOString(),
      })
      .select('id, name, channel, weekdays, time_of_day, is_active, created_by, created_at, updated_at')
      .single();

    if (error) throw error;
    return res.status(201).json({ pattern: formatPatternForResponse(data) });
  } catch (err) {
    return next(err);
  }
});

router.put('/:id', requireOwner, async (req, res, next) => {
  try {
    const { errors, fields } = validatePayload(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join(' ') });
    }

    const { data, error } = await supabase
      .from('publication_patterns')
      .update({
        ...fields,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select('id, name, channel, weekdays, time_of_day, is_active, created_by, created_at, updated_at')
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Patroon niet gevonden.' });

    return res.json({ pattern: formatPatternForResponse(data) });
  } catch (err) {
    return next(err);
  }
});

router.delete('/:id', requireOwner, async (req, res, next) => {
  try {
    const { error, count } = await supabase
      .from('publication_patterns')
      .delete({ count: 'exact' })
      .eq('id', req.params.id);

    if (error) throw error;
    if (!count) return res.status(404).json({ error: 'Patroon niet gevonden.' });

    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

// GET /patterns/:id/next-slot — resolves the ISO instant that the pattern would
// fire next. Powers the dropdown "Inplannen via patroon" that shows the resolved
// slot inline before the user commits.
router.get('/:id/next-slot', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('publication_patterns')
      .select('id, weekdays, time_of_day, is_active')
      .eq('id', req.params.id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Patroon niet gevonden.' });
    if (!data.is_active) {
      return res.status(400).json({ error: 'Patroon is niet actief.' });
    }

    try {
      const slot = nextSlot({ weekdays: data.weekdays, time_of_day: data.time_of_day });
      return res.json({ nextSlot: slot.toISOString() });
    } catch (err) {
      return res.status(400).json({ error: err.message || 'Kon volgend moment niet berekenen.' });
    }
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
