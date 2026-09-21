const express = require('express');
const { supabase } = require('../db/client');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    let query = supabase
      .from('activity_log')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Owner/manager sees all, others see own activity only
    if (!['owner', 'manager'].includes(req.user.role)) {
      query = query.eq('user_id', req.user.id);
    }

    // Optional filters
    if (req.query.action) {
      query = query.eq('action', req.query.action);
    }
    if (req.query.user_id) {
      query = query.eq('user_id', req.query.user_id);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    return res.json({
      items: data || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
