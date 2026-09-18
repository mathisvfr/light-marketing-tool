const express = require('express');
const unsplash = require('../services/unsplash');

const router = express.Router();

// GET /api/unsplash/status — is Unsplash geconfigureerd?
router.get('/status', (_req, res) => {
  return res.json({ available: unsplash.isAvailable() });
});

// GET /api/unsplash/search?query=...&orientation=...&page=1
router.get('/search', async (req, res, next) => {
  try {
    const query = String(req.query.query || '').trim();
    if (!query) {
      return res.status(400).json({ error: 'Zoekterm ontbreekt.' });
    }

    const orientation = req.query.orientation || undefined;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);

    const result = await unsplash.search(query, { orientation, page });

    if (!result.available) {
      return res.json({ available: false, results: [], total: 0, total_pages: 0 });
    }

    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

// POST /api/unsplash/track-download — fire-and-forget download tracking
router.post('/track-download', async (req, res) => {
  const downloadLocation = String(req.body?.downloadLocation || '').trim();

  // Fire-and-forget: respond immediately, track in background
  res.json({ ok: true });

  if (downloadLocation) {
    unsplash.trackDownload(downloadLocation).catch(() => {});
  }
});

module.exports = router;
