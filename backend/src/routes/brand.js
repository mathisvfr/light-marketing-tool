const express = require('express');
const { supabase } = require('../db/client');
const { requireRole } = require('../middleware/auth');
const { getCredentialStatus } = require('../services/integrations');

const router = express.Router();

const DEFAULT_CHANNELS = [
  'linkedin_jobs',
  'indeed',
  'facebook_instagram',
  'wordpress',
  'google_mijn_bedrijf',
];
const SETTING_KEYS = [
  'bedrijfsnaam',
  'tone_of_voice',
  'aanbod_werknemers',
  'aanbod_opdrachtgevers',
  'doelgroep_werknemers',
  'doelgroep_opdrachtgevers',
  'configured_channels',
];

async function buildApiStatus() {
  const [indeedCred, metaCred, gmbCred, wordpressCred] = await Promise.all([
    getCredentialStatus('indeed'),
    getCredentialStatus('meta'),
    getCredentialStatus('google_mijn_bedrijf'),
    getCredentialStatus('wordpress'),
  ]);

  const metaConnected = Boolean(metaCred?.hasAccessToken);

  return {
    linkedin_jobs: false,
    indeed: Boolean(indeedCred?.hasAccessToken || process.env.INDEED_API_KEY),
    facebook_instagram: metaConnected,
    wordpress: Boolean(
      wordpressCred?.hasAccessToken ||
      process.env.WORDPRESS_API_URL &&
        process.env.WORDPRESS_USERNAME &&
        process.env.WORDPRESS_APP_PASSWORD
    ),
    linkedin: false,
    google_mijn_bedrijf: Boolean(gmbCred?.hasAccessToken || process.env.GMB_ACCESS_TOKEN),
    notifications: String(process.env.NOTIFICATIONS_ENABLED || 'false').toLowerCase() === 'true',
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
  };
}

function parseConfiguredChannels(value) {
  if (!value) {
    return DEFAULT_CHANNELS;
  }

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch (_error) {
    const split = String(value)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    if (split.length > 0) {
      return split;
    }
  }

  return DEFAULT_CHANNELS;
}

router.get('/', async (_req, res, next) => {
  try {
    const { data, error } = await supabase.from('brand_settings').select('key, value');

    if (error) {
      throw error;
    }

    const settings = Object.fromEntries((data || []).map((row) => [row.key, row.value]));
    const configuredChannels = parseConfiguredChannels(settings.configured_channels);

    return res.json({
      settings,
      configuredChannels,
      apiStatus: await buildApiStatus(),
    });
  } catch (error) {
    return next(error);
  }
});

router.put('/', requireRole('owner'), async (req, res, next) => {
  try {
    const incomingSettings = req.body?.settings;
    const configuredChannels = Array.isArray(req.body?.configuredChannels)
      ? req.body.configuredChannels
      : [];

    if (!incomingSettings || typeof incomingSettings !== 'object') {
      return res.status(400).json({ error: 'Instellingen ontbreken.' });
    }

    const rows = [];

    for (const key of SETTING_KEYS) {
      if (key === 'configured_channels') {
        rows.push({
          key,
          value: JSON.stringify(configuredChannels),
          updated_at: new Date().toISOString(),
        });
        continue;
      }

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
