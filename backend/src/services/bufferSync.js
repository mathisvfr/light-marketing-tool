const { supabase } = require('../db/client');
const { notifyAfterCommit } = require('./notifications');

// Poll Buffer for the current status of every publication row still marked
// 'scheduled', reconcile our local state, and fire publication.fired
// notifications on successful transitions. Also opportunistically pulls
// per-post metrics (Push 3) since Buffer returns them on the same query.
//
// Rate-limit strategy per Eng review: sequential per-row queries with 200ms
// spacing, hard cap of 50 rows per pass. Buffer schema has no bulk-by-id
// query as of probe (see plan risks section for the probe result).

const BUFFER_API_URL = process.env.BUFFER_API_URL || 'https://api.buffer.com';
const POLL_MAX_ROWS = 50;
const POLL_SPACING_MS = 200;

async function getBufferToken() {
  // Prefer stored credential; fall back to env. Matches buffer.js pattern.
  const { data } = await supabase
    .from('channel_credentials')
    .select('access_token')
    .eq('provider', 'buffer')
    .maybeSingle();
  return data?.access_token || process.env.BUFFER_API_KEY || null;
}

async function fetchBufferPost(externalId, token) {
  const query = `
    query BufferPost {
      post(id: ${JSON.stringify(externalId)}) {
        id
        status
        sentAt
        error { message }
        metrics { name value }
      }
    }
  `;
  const response = await fetch(BUFFER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`Buffer HTTP ${response.status}`);
  }
  const payload = await response.json();
  if (payload?.errors?.length) {
    throw new Error(payload.errors[0]?.message || 'Buffer returned errors');
  }
  return payload?.data?.post || null;
}

// Buffer's PostStatus enum values observed in practice: needs_approval,
// draft, queued, scheduled, sent, error. Map to our internal states.
function mapBufferStatus(bufferStatus) {
  const s = String(bufferStatus || '').toLowerCase();
  if (s === 'sent') return 'success';
  if (s === 'error') return 'failed';
  // Everything else (queued/scheduled/needs_approval/draft) stays scheduled.
  return null;
}

function extractMetrics(metricsArr) {
  if (!Array.isArray(metricsArr)) return null;
  const out = {};
  for (const m of metricsArr) {
    if (m?.name && typeof m.value !== 'undefined') {
      out[m.name] = m.value;
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

async function loadScheduledPublications(limit) {
  const cutoff = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // now + 30min
  const { data, error } = await supabase
    .from('publications')
    .select('id, draft_id, channel, external_id, scheduled_for')
    .eq('status', 'scheduled')
    .not('external_id', 'is', null)
    .lt('scheduled_for', cutoff)
    .order('scheduled_for', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

async function reconcileRow(row, token) {
  let bufferPost;
  try {
    bufferPost = await fetchBufferPost(row.external_id, token);
  } catch (err) {
    return { row, action: 'error', error: err.message };
  }

  if (!bufferPost) {
    return { row, action: 'missing' };
  }

  const nextStatus = mapBufferStatus(bufferPost.status);
  const metrics = extractMetrics(bufferPost.metrics);
  const now = new Date().toISOString();

  const update = {};
  if (nextStatus === 'success') {
    update.status = 'success';
    update.published_at = bufferPost.sentAt || now;
  } else if (nextStatus === 'failed') {
    update.status = 'failed';
    update.error_message = bufferPost.error?.message || 'Buffer meldde een fout.';
    update.published_at = now;
  }
  if (metrics) {
    update.metrics = metrics;
    update.metrics_updated_at = now;
  }

  if (Object.keys(update).length === 0) {
    return { row, action: 'noop' };
  }

  const { error: updateErr } = await supabase.from('publications').update(update).eq('id', row.id);
  if (updateErr) {
    return { row, action: 'error', error: updateErr.message };
  }

  // Fire publication.fired to the owner on successful transitions.
  if (nextStatus === 'success') {
    // We need the draft's created_by and form_data for the notification.
    const { data: draft } = await supabase
      .from('drafts')
      .select('id, form_data, created_by')
      .eq('id', row.draft_id)
      .maybeSingle();
    // Notify the creator + all other owners (bulk approvers). Dedupe via
    // notification_log's UNIQUE index, so we can double-target safely.
    const { data: owners } = await supabase.from('users').select('id').eq('role', 'owner');
    const recipients = new Set((owners || []).map((u) => u.id));
    if (draft?.created_by) recipients.add(draft.created_by);
    notifyAfterCommit('publication.fired', {
      draft_id: row.draft_id,
      actor_name: 'Buffer',
      title: draft?.form_data?.onderwerp || draft?.form_data?.functietitel || 'post',
      channel: row.channel,
      recipient_user_ids: Array.from(recipients),
    });
  }

  return { row, action: nextStatus || 'metrics-only' };
}

async function runOnce() {
  const token = await getBufferToken();
  if (!token) {
    return { attempted: 0, reason: 'no-token' };
  }

  const rows = await loadScheduledPublications(POLL_MAX_ROWS);
  if (rows.length === 0) return { attempted: 0, reason: 'no-rows' };

  const results = [];
  for (const row of rows) {
    const result = await reconcileRow(row, token);
    results.push(result);
    // Space out to stay well under Buffer's rate limits.
    await new Promise((r) => setTimeout(r, POLL_SPACING_MS));
  }

  return {
    attempted: rows.length,
    updated: results.filter((r) => r.action === 'success' || r.action === 'failed').length,
    metricsOnly: results.filter((r) => r.action === 'metrics-only').length,
    errors: results.filter((r) => r.action === 'error').length,
  };
}

// Called by index.js at boot. No-op in tests via NODE_ENV check.
function startCron(intervalMs = 15 * 60 * 1000) {
  if (process.env.NODE_ENV === 'test') return null;
  const handle = setInterval(() => {
    runOnce().catch((err) => console.error('[bufferSync] pass failed:', err.message));
  }, intervalMs);
  if (handle.unref) handle.unref();
  return handle;
}

module.exports = { runOnce, startCron, __testables: { mapBufferStatus, extractMetrics } };
