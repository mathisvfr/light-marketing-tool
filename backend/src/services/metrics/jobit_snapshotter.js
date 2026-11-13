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
    const params = new URLSearchParams({ type: 'application' });
    if (JOBIT_CHANNEL_ID) params.set('channel_id', JOBIT_CHANNEL_ID);
    let candidates;

    try {
      candidates = await jobitGet(`/candidates?${params}`);
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

    // Normalize response: Jobit returns { data: { candidates: [...] } }
    let items = [];
    if (Array.isArray(candidates)) {
      items = candidates;
    } else if (candidates?.data?.candidates && Array.isArray(candidates.data.candidates)) {
      items = candidates.data.candidates;
    } else if (candidates && Array.isArray(candidates.data)) {
      items = candidates.data;
    } else if (candidates && typeof candidates === 'object') {
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
      // Jobit nests vacancy as an object with id and number (our draft UUID)
      const vacId = item.vacancy?.id || item.vacancy_id || item.job_id || null;
      const draftUuid = item.vacancy?.number || null; // our draft UUID used as feed Nummer
      if (vacId) {
        if (!perVacancy[vacId]) perVacancy[vacId] = { count: 0, draftUuid, title: item.vacancy?.title || '' };
        perVacancy[vacId].count += 1;
      }
    }

    for (const [vacancyId, info] of Object.entries(perVacancy)) {
      // Match to our draft via the vacancy.number field (= our draft UUID)
      let draftId = null;
      let draftTitel = info.title || '';
      if (info.draftUuid) {
        const { data: draft } = await supabase
          .from('drafts')
          .select('id, titel')
          .eq('id', info.draftUuid)
          .maybeSingle();
        if (draft) {
          draftId = draft.id;
          draftTitel = draft.titel || draftTitel;
        }
      }

      await upsertMetric({
        metric_key: 'jobit.applications.by_vacancy',
        dimensions: { vacancy_id: vacancyId, draft_id: draftId, titel: draftTitel },
        source: 'jobit',
        value: info.count,
        captured_at: now,
      });
      results.written++;
    }

  } catch (err) {
    results.errors.push(err.message || String(err));
  }

  return results;
}

module.exports = { run, isConfigured };
