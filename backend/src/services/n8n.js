const { supabase } = require('../db/client');

const N8N_TIMEOUT_MS = 15000;

function getPublishWebhook(type) {
  if (type === 'marketing-post') {
    return process.env.N8N_WEBHOOK_MARKETING;
  }

  return process.env.N8N_WEBHOOK_VACATURE;
}

function normalizeChannelResult(channel, result) {
  return {
    channel,
    status: result?.status || 'pending',
    external_id: result?.externalId || result?.external_id || null,
    error_message: result?.error || result?.error_message || null,
    published_at: result?.publishedAt || new Date().toISOString(),
  };
}

async function savePublicationRows(draftId, rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return;
  }

  const payload = rows.map((row) => ({
    draft_id: draftId,
    channel: row.channel,
    status: row.status,
    external_id: row.external_id,
    error_message: row.error_message,
    published_at: row.published_at,
    expired_at: row.expired_at || null,
  }));

  const { error } = await supabase.from('publications').insert(payload);

  if (error) {
    throw error;
  }
}

async function postJsonWithTimeout(url, body) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), N8N_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`n8n webhook faalde met status ${response.status}`);
    }

    return response.json().catch(() => ({}));
  } finally {
    clearTimeout(timeoutId);
  }
}

async function pollPublishStatus(draftId, channels) {
  const statusWebhook = process.env.N8N_WEBHOOK_STATUS;

  if (!statusWebhook || !channels.length) {
    return;
  }

  try {
    const result = await postJsonWithTimeout(statusWebhook, { draftId, channels });

    const channelResults = result?.results || {};
    const rows = channels.map((channel) =>
      normalizeChannelResult(channel, channelResults[channel] || { status: 'pending' })
    );

    const { error } = await supabase.from('publications').upsert(
      rows.map((row) => ({
        draft_id: draftId,
        channel: row.channel,
        status: row.status,
        external_id: row.external_id,
        error_message: row.error_message,
        published_at: row.published_at,
      })),
      { onConflict: 'draft_id,channel' }
    );

    if (error) {
      throw error;
    }
  } catch (_error) {
    // Keep rows pending if polling fails.
  }
}

async function publish(draftId, type, channels, content) {
  const webhook = getPublishWebhook(type);

  if (!webhook) {
    throw new Error('n8n webhook is niet geconfigureerd voor publicatie.');
  }

  const requestedChannels = Array.isArray(channels) ? channels : [];

  try {
    const result = await postJsonWithTimeout(webhook, {
      draftId,
      type,
      channels: requestedChannels,
      content,
    });

    const channelResults = result?.results || {};
    const rows = requestedChannels.map((channel) =>
      normalizeChannelResult(channel, channelResults[channel] || { status: 'pending' })
    );

    await savePublicationRows(draftId, rows);
    return { timedOut: false, rows };
  } catch (error) {
    if (error.name === 'AbortError') {
      const rows = requestedChannels.map((channel) => ({
        channel,
        status: 'pending',
        external_id: null,
        error_message: null,
        published_at: new Date().toISOString(),
      }));

      await savePublicationRows(draftId, rows);
      await pollPublishStatus(draftId, requestedChannels);
      return { timedOut: true, rows };
    }

    throw error;
  }
}

async function expire(draftId, externalIds) {
  const webhook = process.env.N8N_WEBHOOK_EXPIRE;

  if (!webhook) {
    throw new Error('n8n expire-webhook is niet geconfigureerd.');
  }

  return postJsonWithTimeout(webhook, {
    draftId,
    externalIds,
  });
}

module.exports = {
  publish,
  expire,
};
