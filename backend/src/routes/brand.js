const express = require('express');
const { supabase } = require('../db/client');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

const SETTING_KEYS = [
  'bedrijfsnaam',
  'tone_of_voice',
  'aanbod_werknemers',
  'aanbod_opdrachtgevers',
  'doelgroep_werknemers',
  'doelgroep_opdrachtgevers',
];

function buildApiStatus() {
  const explicitProvider = String(process.env.AI_PROVIDER || '').trim().toLowerCase();
  const effectiveProvider =
    explicitProvider ||
    (process.env.GREENPT_API_KEY
      ? 'greenpt'
      : process.env.GOOGLE_AI_STUDIO_API_KEY
      ? 'gemini'
      : 'anthropic');

  return {
    linkedin_jobs: Boolean(process.env.N8N_WEBHOOK_VACATURE),
    indeed: Boolean(process.env.N8N_WEBHOOK_VACATURE),
    facebook_instagram: Boolean(
      process.env.N8N_WEBHOOK_VACATURE || process.env.N8N_WEBHOOK_MARKETING
    ),
    wordpress: Boolean(process.env.N8N_WEBHOOK_VACATURE),
    linkedin: Boolean(process.env.N8N_WEBHOOK_MARKETING),
    ai_provider: effectiveProvider,
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    gemini: Boolean(process.env.GOOGLE_AI_STUDIO_API_KEY),
    greenpt: Boolean(process.env.GREENPT_API_KEY),
  };
}

router.get('/', async (_req, res, next) => {
  try {
    const { data, error } = await supabase.from('brand_settings').select('key, value');

    if (error) {
      throw error;
    }

    const settings = Object.fromEntries((data || []).map((row) => [row.key, row.value]));

    return res.json({
      settings,
      apiStatus: buildApiStatus(),
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
