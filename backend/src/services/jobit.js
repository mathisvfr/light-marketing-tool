/**
 * Jobit/Multiposter API integration.
 *
 * Fetches per-vacancy, per-platform publication status from the Jobit API
 * and matches vacancies to our drafts via the `number` field (= draft UUID).
 *
 * Also detects new platform errors and creates in-app notifications.
 */

const { supabase } = require('../db/client');

const JOBIT_API_BASE = 'https://app.jobit.nl/api';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let cachedData = null;
let cachedAt = 0;

function getApiKey() {
  return process.env.JOBIT_API_KEY || '';
}

/**
 * Fetch all vacancies from the Jobit API.
 * Returns raw array of vacancy objects with channels.
 */
async function fetchJobitVacancies() {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { vacancies: [], error: 'JOBIT_API_KEY niet geconfigureerd.' };
  }

  try {
    const response = await fetch(`${JOBIT_API_BASE}/vacancies`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return { vacancies: [], error: `Jobit API ${response.status}: ${text.slice(0, 200)}` };
    }

    const data = await response.json();
    return { vacancies: data?.data?.vacancies || [], error: null };
  } catch (err) {
    return { vacancies: [], error: `Jobit API fout: ${err.message}` };
  }
}

/**
 * Map a Jobit channel entry to a normalized shape.
 */
function mapChannel(ch) {
  return {
    name: ch.name,
    status: ch.status, // published, failed, pending, scheduled, disabled
    publishedAt: ch.published_at || null,
    failedAt: ch.failed_at || null,
    scheduledAt: ch.scheduled_at || null,
    errors: (ch.errors || []).map((e) => ({
      type: e.type,
      field: e.field || null,
      message: e.message,
      createdAt: e.created_at || null,
    })),
  };
}

/**
 * Filter out channels that are disabled or stale-pending.
 * - disabled: platform was turned off in Multiposter, won't process.
 * - stale pending: queued but never processed and no scheduled date —
 *   these are dead channels from platforms that were removed.
 */
const STALE_PENDING_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

function isRelevantChannel(ch) {
  if (ch.status === 'disabled') return false;

  // Pending channel with no publish date and no scheduled date = dead
  if (ch.status === 'pending' && !ch.publishedAt && !ch.scheduledAt) {
    return false;
  }

  return true;
}

/**
 * Get channel statuses for all active vacatures, matched to our draft IDs.
 * Uses a 5-minute cache to avoid hammering the Jobit API.
 *
 * Returns: { drafts: { [draftId]: { jobitId, channels, active } }, error }
 */
async function getChannelStatuses() {
  const now = Date.now();
  if (cachedData && (now - cachedAt) < CACHE_TTL_MS) {
    return cachedData;
  }

  const { vacancies, error } = await fetchJobitVacancies();
  if (error) {
    return { drafts: {}, error };
  }

  const drafts = {};
  for (const v of vacancies) {
    // `number` in Jobit = our draft UUID
    const draftId = v.number;
    if (!draftId) continue;

    drafts[draftId] = {
      jobitId: v.id,
      jobitTitle: v.title,
      active: Boolean(v.active),
      channels: (v.channels || []).map(mapChannel).filter(isRelevantChannel),
    };
  }

  cachedData = { drafts, error: null };
  cachedAt = now;
  return cachedData;
}

/**
 * Invalidate the cache (e.g., after approving/expiring a vacancy).
 */
function invalidateCache() {
  cachedData = null;
  cachedAt = 0;
}

/**
 * Check for platform errors and create in-app notifications for new ones.
 * Compares against previously seen errors stored in brand_settings.
 */
async function syncErrorNotifications() {
  const { drafts, error } = await getChannelStatuses();
  if (error) return { synced: false, error };

  // Load previously seen error keys
  const SEEN_KEY = 'jobit_seen_errors';
  const { data: seenRow } = await supabase
    .from('brand_settings')
    .select('value')
    .eq('key', SEEN_KEY)
    .maybeSingle();

  let seenErrors;
  try {
    seenErrors = new Set(JSON.parse(seenRow?.value || '[]'));
  } catch {
    seenErrors = new Set();
  }

  // Find owner/manager user IDs for notifications
  const { data: managers } = await supabase
    .from('users')
    .select('id')
    .in('role', ['owner', 'manager']);
  const managerIds = (managers || []).map((u) => u.id);

  const newErrors = [];
  const allErrorKeys = [];

  for (const [draftId, info] of Object.entries(drafts)) {
    for (const ch of info.channels) {
      for (const err of ch.errors) {
        const errorKey = `${draftId}:${ch.name}:${err.message}`;
        allErrorKeys.push(errorKey);

        if (!seenErrors.has(errorKey)) {
          newErrors.push({
            draftId,
            channel: ch.name,
            title: info.jobitTitle,
            error: err,
          });
        }
      }
    }
  }

  // Create notifications for new errors
  if (newErrors.length > 0 && managerIds.length > 0) {
    const notifications = [];
    for (const err of newErrors) {
      for (const userId of managerIds) {
        notifications.push({
          user_id: userId,
          type: 'jobit_channel_error',
          title: `${err.channel}: plaatsing mislukt`,
          message: `"${err.title}" — ${err.error.message}`,
          link: `/gepubliceerd?tab=vacatures`,
          created_at: err.error.createdAt || new Date().toISOString(),
        });
      }
    }

    await supabase.from('in_app_notifications').insert(notifications);
  }

  // Persist all current error keys (replaces old set)
  await supabase
    .from('brand_settings')
    .upsert(
      { key: SEEN_KEY, value: JSON.stringify(allErrorKeys), updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );

  return { synced: true, newErrors: newErrors.length };
}

module.exports = {
  getChannelStatuses,
  syncErrorNotifications,
  invalidateCache,
};
