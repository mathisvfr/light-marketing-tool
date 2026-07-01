const express = require('express');
const { supabase } = require('../db/client');
const { requireRole } = require('../middleware/auth');
const { getCredential } = require('../services/integrations');

const router = express.Router();

const SETTING_KEYS = [
  'bedrijfsnaam',
  'tone_of_voice',
  'aanbod_werknemers',
  'aanbod_opdrachtgevers',
  'doelgroep_werknemers',
  'doelgroep_opdrachtgevers',
];

// Mirrors the credential check used in routes/publish.js so the status shown in the
// UI matches what actually gates publishing.
async function hasProviderConnection(provider) {
  if (provider === 'buffer') {
    const credential = await getCredential('buffer');
    return Boolean(credential?.access_token || process.env.BUFFER_API_KEY);
  }

  if (provider === 'wordpress') {
    const credential = await getCredential('wordpress');
    return Boolean(
      credential?.access_token ||
        (process.env.WORDPRESS_API_URL && process.env.WORDPRESS_USERNAME && process.env.WORDPRESS_APP_PASSWORD)
    );
  }

  const credential = await getCredential(provider);
  return Boolean(credential?.access_token);
}

async function buildApiStatus() {
  const explicitProvider = String(process.env.AI_PROVIDER || '').trim().toLowerCase();
  const effectiveProvider =
    explicitProvider ||
    (process.env.GREENPT_API_KEY
      ? 'greenpt'
      : process.env.GOOGLE_AI_STUDIO_API_KEY
      ? 'gemini'
      : 'anthropic');

  const [bufferConnected, wordpressConnected] = await Promise.all([
    hasProviderConnection('buffer'),
    hasProviderConnection('wordpress'),
  ]);

  return {
    // Type A vacatures distribueren via de publieke XML feed -> Multiposter.
    // De feed wordt altijd geserveerd, dus dit kanaal is altijd beschikbaar.
    feed: true,
    // Type B social loopt via Buffer (LinkedIn/Facebook/Instagram).
    linkedin: bufferConnected,
    facebook_instagram: bufferConnected,
    // Website/blogs via WordPress REST API.
    wordpress: wordpressConnected,
    ai_provider: effectiveProvider,
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    gemini: Boolean(process.env.GOOGLE_AI_STUDIO_API_KEY),
    greenpt: Boolean(process.env.GREENPT_API_KEY),
  };
}

router.get('/', async (_req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('brand_settings')
      .select('key, value')
      .in('key', SETTING_KEYS);

    if (error) {
      throw error;
    }

    const settings = Object.fromEntries((data || []).map((row) => [row.key, row.value]));

    return res.json({
      settings,
      apiStatus: await buildApiStatus(),
    });
  } catch (error) {
    return next(error);
  }
});

router.put('/', requireRole('owner'), async (req, res, next) => {
  try {
    const incomingSettings = req.body?.settings;

    if (!incomingSettings || typeof incomingSettings !== 'object') {
      return res.status(400).json({ error: 'Instellingen ontbreken.' });
    }

    const rows = [];

    for (const key of SETTING_KEYS) {
      if (Object.prototype.hasOwnProperty.call(incomingSettings, key)) {
        rows.push({
          key,
          value: String(incomingSettings[key] || ''),
          updated_at: new Date().toISOString(),
        });
      }
    }

    if (rows.length === 0) {
      return res.status(400).json({ error: 'Geen geldige instellingen ontvangen.' });
    }

    const { error } = await supabase.from('brand_settings').upsert(rows, {
      onConflict: 'key',
    });

    if (error) {
      throw error;
    }

    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
