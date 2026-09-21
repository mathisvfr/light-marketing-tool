const express = require('express');
const { supabase } = require('../db/client');

const router = express.Router();

// GET /api/notifications — list own notifications (paginated, unread first)
router.get('/', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const offset = parseInt(req.query.offset, 10) || 0;

    const { data, error } = await supabase
      .from('in_app_notifications')
      .select('*')
      .eq('user_id', userId)
      .order('read_at', { ascending: true, nullsFirst: true })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return res.status(500).json({ error: 'Kon notificaties niet ophalen.' });
    }

    return res.json({ notifications: data || [] });
  } catch (err) {
    return next(err);
  }
});

// GET /api/notifications/unread-count — returns { count: N }
router.get('/unread-count', async (req, res, next) => {
  try {
    const userId = req.user.id;

    const { count, error } = await supabase
      .from('in_app_notifications')
      .select('*', { head: true, count: 'exact' })
      .eq('user_id', userId)
      .is('read_at', null);

    if (error) {
      return res.status(500).json({ error: 'Kon aantal ongelezen notificaties niet ophalen.' });
    }

    return res.json({ count: count || 0 });
  } catch (err) {
    return next(err);
  }
});

// GET /api/notifications/stream — SSE endpoint for real-time updates
router.get('/stream', async (req, res) => {
  const userId = req.user.id;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

  let lastCheck = new Date().toISOString();

  const interval = setInterval(async () => {
    try {
      const { data, error } = await supabase
        .from('in_app_notifications')
        .select('id', { count: 'exact' })
        .eq('user_id', userId)
        .is('read_at', null)
        .gt('created_at', lastCheck);

      if (!error && data && data.length > 0) {
        // Also get total unread count
        const { count } = await supabase
          .from('in_app_notifications')
          .select('*', { head: true, count: 'exact' })
          .eq('user_id', userId)
          .is('read_at', null);

        res.write(`data: ${JSON.stringify({ type: 'notification', count: count || 0 })}\n\n`);
      }

      lastCheck = new Date().toISOString();
    } catch (_e) {
      // SSE poll error — ignore, will retry next interval
    }
  }, 5000);

  req.on('close', () => {
    clearInterval(interval);
  });
});

// PATCH /api/notifications/:id/read — mark single as read
router.patch('/:id/read', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const { data, error } = await supabase
      .from('in_app_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .maybeSingle();

    if (error) {
      return res.status(500).json({ error: 'Kon notificatie niet als gelezen markeren.' });
    }

    if (!data) {
      return res.status(404).json({ error: 'Notificatie niet gevonden.' });
    }

    return res.json({ notification: data });
  } catch (err) {
    return next(err);
  }
});

// POST /api/notifications/read-all — mark all as read
router.post('/read-all', async (req, res, next) => {
  try {
    const userId = req.user.id;

    const { error } = await supabase
      .from('in_app_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('read_at', null);

    if (error) {
      return res.status(500).json({ error: 'Kon notificaties niet als gelezen markeren.' });
    }

    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
