const express = require('express');
const { fromZonedTime } = require('date-fns-tz');
const { supabase } = require('../db/client');
const bufferChannel = require('../services/channels/buffer');

const router = express.Router();

const APP_TIMEZONE = 'Europe/Amsterdam';

function requireOwner(req, res, next) {
  if (req.user?.role !== 'owner') {
    return res.status(403).json({ error: 'Je hebt geen toegang tot deze actie.' });
  }
  return next();
}

// Normalize a datetime-local wall-clock or full-ISO string into a UTC ISO
// instant. Same shape as publish.js — extracted here so both routes stay
// in sync.
function normalizeDueAt(raw) {
  if (!raw) return null;
  const s = String(raw);
  const hasOffset = /Z$|[+-]\d{2}:?\d{2}$/.test(s);
  const parsed = hasOffset ? new Date(s) : fromZonedTime(s, APP_TIMEZONE);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function loadPublication(id) {
  const { data, error } = await supabase
    .from('publications')
    .select('id, draft_id, channel, status, external_id, scheduled_for, published_at, cancelled_at')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// POST /publications/:id/reschedule — atomic via Buffer editPost. Only allowed
// for rows still in 'scheduled' state; anything else is a 409 to prevent
// accidental double-fire (Design + Eng consensus at autoplan review).
router.post('/:id/reschedule', requireOwner, async (req, res, next) => {
  try {
    const parsed = normalizeDueAt(req.body?.dueAt);
    if (!parsed) return res.status(400).json({ error: 'Ongeldige planningsdatum.' });
    if (parsed.getTime() <= Date.now() + 60_000) {
      return res.status(400).json({ error: 'Planningsdatum moet minstens 1 minuut in de toekomst liggen.' });
    }

    const publication = await loadPublication(req.params.id);
    if (!publication) return res.status(404).json({ error: 'Publicatie niet gevonden.' });
    if (publication.status !== 'scheduled') {
      return res.status(409).json({ error: 'Alleen ingeplande posts kunnen verplaatst worden.' });
    }
    if (!publication.external_id) {
      return res.status(409).json({ error: 'Publicatie heeft geen Buffer-ID.' });
    }
    if (publication.channel === 'wordpress') {
      return res.status(400).json({ error: 'WordPress-posts kunnen niet ingepland worden.' });
    }

    const result = await bufferChannel.editPost({
      externalId: publication.external_id,
      dueAt: parsed.toISOString(),
    });

    if (result.status !== 'success') {
      return res.status(502).json({ error: `Buffer weigerde de wijziging: ${result.error || 'onbekende fout'}.` });
    }

    const { error: updateErr } = await supabase
      .from('publications')
      .update({ scheduled_for: parsed.toISOString() })
      .eq('id', publication.id);

    if (updateErr) throw updateErr;

    return res.json({ success: true, scheduledFor: parsed.toISOString() });
  } catch (err) {
    return next(err);
  }
});

// POST /publications/:id/cancel — delete the Buffer post and mark our row.
// Idempotent: if Buffer already forgot about it, we still flip the local
// state so the UI stops showing it as scheduled.
router.post('/:id/cancel', requireOwner, async (req, res, next) => {
  try {
    const publication = await loadPublication(req.params.id);
    if (!publication) return res.status(404).json({ error: 'Publicatie niet gevonden.' });
    if (publication.status !== 'scheduled') {
      return res.status(409).json({ error: 'Alleen ingeplande posts kunnen geannuleerd worden.' });
    }
    if (!publication.external_id) {
      // Nothing to cancel at Buffer, just flip our own state.
      const { error } = await supabase
        .from('publications')
        .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
        .eq('id', publication.id);
      if (error) throw error;
      return res.json({ success: true, alreadyGone: true });
    }
    if (publication.channel === 'wordpress') {
      return res.status(400).json({ error: 'WordPress-posts kunnen niet via deze route geannuleerd worden.' });
    }

    const result = await bufferChannel.deletePost({ externalId: publication.external_id });
    if (result.status !== 'success') {
      return res.status(502).json({ error: `Buffer weigerde het verwijderen: ${result.error || 'onbekende fout'}.` });
    }

    const { error: updateErr } = await supabase
      .from('publications')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('id', publication.id);

    if (updateErr) throw updateErr;

    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
