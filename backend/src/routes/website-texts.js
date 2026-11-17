const express = require('express');
const { supabase } = require('../db/client');
const { requireRole } = require('../middleware/auth');
const { logActivity } = require('../services/activityLog');

const router = express.Router();

const TRANSLATION_MODEL = 'claude-haiku-5-5';
const LOCALES = ['pl', 'en', 'bg', 'sk', 'lv', 'hu', 'ro', 'uk', 'de', 'es', 'ru'];

const LOCALE_NAMES = {
  pl: 'Pools',
  en: 'Engels',
  bg: 'Bulgaars',
  sk: 'Slowaaks',
  lv: 'Lets',
  hu: 'Hongaars',
  ro: 'Roemeens',
  uk: 'Oekraïens',
  de: 'Duits',
  es: 'Spaans',
  ru: 'Russisch',
};

const EDITABLE_SECTIONS = {
  'Hero': ['hero.eyebrow', 'hero.title', 'hero.lead', 'hero.btn_vacatures', 'hero.btn_opdrachtgevers', 'hero.sector_productie', 'hero.sector_logistiek', 'hero.sector_schoonmaak', 'hero.sna_badge', 'hero.sna_sub'],
  'Tegels': ['tiles.tile1_title', 'tiles.tile1_body', 'tiles.tile2_title', 'tiles.tile2_body', 'tiles.tile3_title', 'tiles.tile3_body'],
  'Over ons': ['about.eyebrow', 'about.title', 'about.intro', 'about.value1_title', 'about.value1_body', 'about.value2_title', 'about.value2_body', 'about.value3_title', 'about.value3_body', 'about.offer_eyebrow', 'about.offer_title', 'about.check1', 'about.check2', 'about.check3', 'about.check4'],
  'Diensten': ['services.eyebrow', 'services.title', 'services.intro', 'services.card1_title', 'services.card1_body', 'services.card2_title', 'services.card2_body', 'services.card3_title', 'services.card3_body', 'services.card4_title', 'services.card4_body'],
  'Contact': ['contact.eyebrow', 'contact.title', 'contact.intro', 'contact.audience1_tag', 'contact.audience1_title', 'contact.audience1_body', 'contact.audience2_tag', 'contact.audience2_title', 'contact.audience2_body', 'contact.details_eyebrow', 'contact.details_title'],
  'Vacatures': ['vacatures.eyebrow', 'vacatures.title', 'vacatures.intro', 'vacatures.cta_title', 'vacatures.cta_body', 'vacatures.cta_btn'],
  'CTA & Feed': ['cta.statement', 'cta.body', 'cta.btn', 'vacancy_feed.eyebrow', 'vacancy_feed.title'],
  'Blog': ['blog.eyebrow', 'blog.title', 'blog.intro'],
  'SEO': ['page_titles.home', 'page_titles.diensten', 'page_titles.over_ons', 'page_titles.contact', 'page_titles.vacatures', 'page_titles.blog', 'meta.home', 'meta.diensten', 'meta.over_ons', 'meta.contact', 'meta.vacatures', 'meta.blog'],
};

// All known keys (flat)
const ALL_KEYS = Object.values(EDITABLE_SECTIONS).flat();

// ── GET /api/website-texts ──────────────────────────────────────────
router.get('/', async (_req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('website_texts')
      .select('key, locale, value, updated_at');

    if (error) {
      throw error;
    }

    // Group by key → { [locale]: value }
    const byKey = {};
    for (const row of data || []) {
      if (!byKey[row.key]) {
        byKey[row.key] = {};
      }
      byKey[row.key][row.locale] = row.value;
    }

    // Build sections response
    const sections = {};
    for (const [sectionName, keys] of Object.entries(EDITABLE_SECTIONS)) {
      sections[sectionName] = {};
      for (const key of keys) {
        sections[sectionName][key] = byKey[key] || {};
      }
    }

    return res.json({ sections });
  } catch (error) {
    return next(error);
  }
});

// ── GET /api/website-texts/translation-status ───────────────────────
router.get('/translation-status', async (_req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('website_texts')
      .select('key, locale, updated_at');

    if (error) {
      throw error;
    }

    // For each key that has an NL entry, check if all other locales exist
    // and have updated_at >= the NL updated_at
    const byKey = {};
    for (const row of data || []) {
      if (!byKey[row.key]) {
        byKey[row.key] = {};
      }
      byKey[row.key][row.locale] = new Date(row.updated_at).getTime();
    }

    const pending = [];
    const complete = [];

    for (const key of ALL_KEYS) {
      const locales = byKey[key];
      if (!locales || !locales.nl) {
        // No NL source yet — skip
        continue;
      }

      const nlTime = locales.nl;
      const allTranslated = LOCALES.every(
        (loc) => locales[loc] && locales[loc] >= nlTime
      );

      if (allTranslated) {
        complete.push(key);
      } else {
        pending.push(key);
      }
    }

    return res.json({ pending, complete });
  } catch (error) {
    return next(error);
  }
});

// ── PUT /api/website-texts ──────────────────────────────────────────
router.put('/', requireRole('owner'), async (req, res, next) => {
  try {
    const { texts } = req.body || {};

    if (!texts || typeof texts !== 'object') {
      return res.status(400).json({ error: 'Teksten ontbreken.' });
    }

    // Filter to only known keys
    const validTexts = {};
    for (const key of ALL_KEYS) {
      if (Object.prototype.hasOwnProperty.call(texts, key)) {
        validTexts[key] = String(texts[key] || '');
      }
    }

    if (Object.keys(validTexts).length === 0) {
      return res.status(400).json({ error: 'Geen geldige teksten ontvangen.' });
    }

    // Upsert NL values
    const rows = Object.entries(validTexts).map(([key, value]) => ({
      key,
      locale: 'nl',
      value,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('website_texts')
      .upsert(rows, { onConflict: 'key,locale' });

    if (error) {
      throw error;
    }

    logActivity(req.user.id, req.user.name, 'website_texts.updated', 'website_texts', null, {
      keys: Object.keys(validTexts),
    });

    // Fire-and-forget background translations
    translateWebsiteTexts(validTexts);

    return res.json({ success: true, translating: true });
  } catch (error) {
    return next(error);
  }
});

// ── Translation helpers ─────────────────────────────────────────────

async function translateBatch(changedTexts, locale) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY ontbreekt — vertalingen overgeslagen.');
  }

  const localeName = LOCALE_NAMES[locale] || locale;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: TRANSLATION_MODEL,
      max_tokens: 4096,
      system: `Je bent een professionele vertaler. Vertaal de volgende website-teksten van het Nederlands naar het ${localeName}. Geef ALLEEN een JSON object terug met dezelfde keys en de vertaalde waarden. Houd de teksten kort en bondig — dit zijn websiteteksten, geen artikelen. Behoud eventuele HTML-tags ongewijzigd.`,
      messages: [
        {
          role: 'user',
          content: JSON.stringify(changedTexts),
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`Anthropic API error (${response.status}): ${errorBody}`);
  }

  const json = await response.json();
  const text = json?.content?.find((item) => item.type === 'text')?.text;

  if (!text) {
    throw new Error('Geen tekst ontvangen van Anthropic API.');
  }

  // Parse JSON (strip markdown fences if present)
  let cleaned = text.trim();
  const fenceMatch = cleaned.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  return JSON.parse(cleaned);
}

function translateWebsiteTexts(changedTexts) {
  for (const locale of LOCALES) {
    translateBatch(changedTexts, locale)
      .then(async (translations) => {
        const rows = Object.entries(translations)
          .filter(([key]) => ALL_KEYS.includes(key))
          .map(([key, value]) => ({
            key,
            locale,
            value: String(value),
            updated_at: new Date().toISOString(),
          }));

        if (rows.length) {
          const { error } = await supabase
            .from('website_texts')
            .upsert(rows, { onConflict: 'key,locale' });

          if (error) {
            console.error(`Website teksten upsert ${locale} mislukt:`, error.message);
          }
        }
      })
      .catch((err) => {
        console.error(`Website teksten vertaling ${locale} mislukt:`, err.message || err);
      });
  }
}

module.exports = router;
