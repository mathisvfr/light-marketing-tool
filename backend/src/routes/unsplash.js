const express = require('express');
const unsplash = require('../services/unsplash');

const router = express.Router();

// ── Translation cache (NL→EN for stock photo search) ──
const translationCache = new Map();
const TRANSLATION_CACHE_TTL = 60 * 60 * 1000; // 1 hour

function looksEnglish(text) {
  // Heuristic: skip translation only for clearly-English text.
  // Dutch words often look plausible as English to a simple regex,
  // so we err on the side of translating (worst case: English→English is fine).
  if (/[àáâãäåèéêëìíîïòóôõöùúûüýÿñçæœ]/i.test(text)) return false;

  // Common Dutch words, suffixes, and domain terms
  const commonDutch = /\b(een|het|de|van|voor|bij|met|naar|niet|ook|maar|nog|uit|worden|hebben|zijn|deze|dit|dat|dan|wel|als|aan|kan|mag|moet|weer|veel|meer|alle|andere|geen|hoe|wat|wie|waar|goed|werk|werken|werker|medewerker|medewerkers|baan|banen|vacature|vacatures|personeel|uitzend|schoon|schoonmaak|schoonmaker|magazijn|productie|logistiek|vervoer|monteur|chauffeur|reiniging|industrieel|kantoor|fabriek|rotterdam|nederland|betrouwbaar|flexibel|ervaren|zoeken|vinden|nodig|team|bedrijf|samenwerk|opdrachtgever|kandidaat)\b/i;
  if (commonDutch.test(text)) return false;

  // Dutch suffixes strongly indicate Dutch
  if (/\w+(heid|heid|lijk|atie|teit|ering|ting|baar|zaam|isch)\b/i.test(text)) return false;

  // If it's a single word and contains typical Dutch letter patterns
  const words = text.trim().split(/\s+/);
  if (words.length === 1) {
    // Dutch-specific digraphs
    if (/(?:ij|oe|ui|eu|aa|ee|oo|uu|sch|cht|nk)/i.test(text)) return false;
  }

  return true;
}

// GET /api/unsplash/translate?q=magazijnmedewerker
router.get('/translate', async (req, res, next) => {
  try {
    const original = String(req.query.q || '').trim();
    if (!original) {
      return res.status(400).json({ error: 'Zoekterm ontbreekt.' });
    }

    // If it already looks English, return as-is
    if (looksEnglish(original)) {
      return res.json({ translated: original, original });
    }

    // Check cache
    const cacheKey = original.toLowerCase();
    const cached = translationCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < TRANSLATION_CACHE_TTL) {
      return res.json({ translated: cached.translated, original });
    }

    // Translate via Haiku for speed
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      // Fail gracefully: return original
      return res.json({ translated: original, original });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-5-5',
        max_tokens: 100,
        messages: [
          {
            role: 'user',
            content: `Vertaal deze Nederlandse zoekterm naar het Engels voor een stock photo zoekopdracht. Geef ALLEEN de Engelse vertaling terug, geen uitleg.\n\n${original}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      // Fail gracefully
      return res.json({ translated: original, original });
    }

    const data = await response.json();
    const translated = (data.content?.[0]?.text || original).trim();

    // Cache the result
    translationCache.set(cacheKey, { translated, ts: Date.now() });

    // Evict old entries
    if (translationCache.size > 500) {
      const now = Date.now();
      for (const [k, v] of translationCache) {
        if (now - v.ts > TRANSLATION_CACHE_TTL) translationCache.delete(k);
      }
    }

    return res.json({ translated, original });
  } catch (err) {
    // Fail gracefully on any error
    const original = String(req.query.q || '').trim();
    return res.json({ translated: original, original });
  }
});

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

    if (result.rateLimited) {
      return res.json({
        available: true,
        results: [],
        total: 0,
        total_pages: 0,
        rateLimited: true,
        error: 'Unsplash limiet bereikt. Probeer het over een uur opnieuw, of kies een foto uit de bibliotheek.',
      });
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
