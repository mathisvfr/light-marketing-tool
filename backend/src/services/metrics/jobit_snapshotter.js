// Jobit snapshotter -- polls the Jobit API nightly for candidate/application
// data and writes counts to metric_snapshot. Graceful no-op when JOBIT_API_KEY
// is missing. Endpoint shape is probed on first run and logged if unexpected.

const { supabase } = require('../../db/client');
const { upsertMetric } = require('./upsert');

const JOBIT_API_URL = process.env.JOBIT_API_URL || 'https://app.jobit.nl/api';
const JOBIT_API_KEY = process.env.JOBIT_API_KEY;
const JOBIT_CHANNEL_ID = process.env.JOBIT_CHANNEL_ID;
const MAX_API_CALLS = 50;
const CALL_SPACING_MS = 200;

function isConfigured() {
  return Boolean(JOBIT_API_KEY);
}

async function jobitGet(path) {
  const url = `${JOBIT_API_URL}${path}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${JOBIT_API_KEY}`,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`Jobit ${response.status}: ${url}`);
  }
  return response.json();
}

async function run() {
  const results = { written: 0, skipped: 0, errors: [] };

  if (!isConfigured()) {
    return { ...results, skipped: 1, reason: 'Jobit niet geconfigureerd (JOBIT_API_KEY ontbreekt).' };
  }

  const now = new Date();

  try {
    // Try fetching candidates/applications. The exact endpoint shape is unknown,
    // so we probe and adapt. Common patterns:
    //   GET /candidates              -- flat list
    //   GET /candidates?channel_id=X -- filtered by channel
    const channelParam = JOBIT_CHANNEL_ID ? `?channel_id=${JOBIT_CHANNEL_ID}` : '';
    let candidates;

    try {
      candidates = await jobitGet(`/candidates${channelParam}`);
    } catch (err) {
      // If /candidates fails, try /vacancies/{channel}/candidates as fallback
      if (JOBIT_CHANNEL_ID) {
        try {
          candidates = await jobitGet(`/vacancies/channel/${JOBIT_CHANNEL_ID}/candidates`);
        } catch (err2) {
          results.errors.push(`Beide endpoints gefaald: ${err.message}, ${err2.message}`);
          return results;
        }
      } else {
        results.errors.push(err.message);
        return results;
      }
    }

    // Normalize response: expect an array or { data: [...] }
    let items = [];
    if (Array.isArray(candidates)) {
      items = candidates;
    } else if (candidates && Array.isArray(candidates.data)) {
      items = candidates.data;
    } else if (candidates && typeof candidates === 'object') {
      // Log the shape so we can adapt
      const keys = Object.keys(candidates).slice(0, 10);
      results.errors.push(`Onverwachte response-structuur. Keys: ${keys.join(', ')}`);
      return results;
    }

    // Count total applications
    await upsertMetric({
      metric_key: 'jobit.applications.count',
      source: 'jobit',
      value: items.length,
      captured_at: now,
    });
    results.written++;

    // Count per vacancy (look for common field names for the vacancy reference)
    const perVacancy = {};
    for (const item of items) {
      const vacId = item.vacancy_id || item.vacature_id || item.jobit_id
        || item.vacancy?.id || item.job_id || null;
      if (vacId) {
        perVacancy[vacId] = (perVacancy[vacId] || 0) + 1;
      }
    }

    let apiCalls = 0;
    for (const [vacancyId, count] of Object.entries(perVacancy)) {
      if (apiCalls >= MAX_API_CALLS) break;

      // Try to match Jobit vacancy ID to our draft ID via the XML feed
      // (our feed uses draft UUID as Nummer)
      const { data: draft } = await supabase
        .from('drafts')
        .select('id, titel')
        .or(`id.eq.${vacancyId},form_data->>jobit_id.eq.${vacancyId}`)
        .maybeSingle();

      await upsertMetric({
        metric_key: 'jobit.applications.by_vacancy',
        dimensions: { vacancy_id: vacancyId, draft_id: draft?.id || null, titel: draft?.titel || '' },
        source: 'jobit',
        value: count,
        captured_at: now,
      });
      results.written++;
      apiCalls++;

      if (apiCalls < Object.keys(perVacancy).length) {
        await new Promise((r) => setTimeout(r, CALL_SPACING_MS));
      }
    }

  } catch (err) {
    results.errors.push(err.message || String(err));
  }

  return results;
}

module.exports = { run, isConfigured };
