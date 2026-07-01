const { supabase } = require('../db/client');
const bufferChannel = require('./channels/buffer');
const wordpressChannel = require('./channels/wordpress');

const REQUEST_TIMEOUT_MS = 15000;

async function postJson(url, body, headers = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message = payload?.error || payload?.message || `HTTP ${response.status}`;
      throw new Error(message);
    }

    return payload;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function publishToWordPress(draft) {
  return wordpressChannel.publish({
    ...draft,
    content_nl: draft.content_nl,
    omschrijving_nl: draft.content_nl,
  });
}

function placeholderChannel(channel) {
  return {
    status: 'failed',
    error: `Kanaal '${channel}' heeft nog geen directe backend-integratie.`,
  };
}

async function publishChannel(channel, draft) {
  if (channel === 'linkedin' || channel === 'facebook_instagram' || channel === 'facebook' || channel === 'instagram') {
    return bufferChannel.publish(draft, channel);
  }

  if (channel === 'wordpress') {
    return publishToWordPress(draft);
  }

  return placeholderChannel(channel);
}

async function savePublicationRows(draftId, rows) {
  if (!rows.length) {
    return;
  }

  const payload = rows.map((row) => ({
    draft_id: draftId,
    channel: row.channel,
    status: row.status,
    external_id: row.externalId || null,
    error_message: row.error || null,
    published_at: row.publishedAt,
    expired_at: row.expiredAt || null,
  }));

  const { error } = await supabase.from('publications').insert(payload);

  if (error) {
    throw error;
  }
}

async function publishDraft(draft, channels) {
  const requestedChannels = Array.isArray(channels) ? channels.filter(Boolean) : [];

  const rows = [];

  for (const channel of requestedChannels) {
    try {
      const result = await publishChannel(channel, draft);
      rows.push({
        channel,
        status: result.status || 'failed',
        externalId: result.externalId || null,
        error: result.error || null,
        publishedAt: new Date().toISOString(),
      });
    } catch (error) {
      rows.push({
        channel,
        status: 'failed',
        externalId: null,
        error: error.message || 'Publicatie mislukt.',
        publishedAt: new Date().toISOString(),
      });
    }
  }

  await savePublicationRows(draft.id, rows);

  const successCount = rows.filter((row) => row.status === 'success').length;

  return {
    rows,
    successCount,
    failedCount: rows.length - successCount,
  };
}

async function expirePublishedDraft(_draft, publicationRows) {
  // Placeholder for direct per-channel expire actions (WordPress).
  // We still mark drafts/publications as expired in the DB route layer.
  return {
    attempted: Array.isArray(publicationRows) ? publicationRows.length : 0,
  };
}

async function publishSeoPage(page) {
  const baseUrl = process.env.WORDPRESS_API_URL;
  const username = process.env.WORDPRESS_USERNAME;
  const appPassword = process.env.WORDPRESS_APP_PASSWORD;

  if (!baseUrl || !username || !appPassword) {
    return {
      status: 'failed',
      externalId: null,
      error: 'WordPress API is niet geconfigureerd.',
    };
  }

  const endpoint = `${baseUrl.replace(/\/$/, '')}/wp-json/wp/v2/pages`;
  const basicToken = Buffer.from(`${username}:${appPassword}`).toString('base64');

  try {
    const result = await postJson(
      endpoint,
      {
        title: page.meta_title || page.h1 || `${page.sector} ${page.locatie}`,
        slug: page.slug,
        status: 'publish',
        content: page.body_html,
        excerpt: page.meta_description || '',
      },
      { Authorization: `Basic ${basicToken}` }
    );

    return {
      status: 'success',
      externalId: result?.id ? String(result.id) : result?.link || null,
      error: null,
    };
  } catch (error) {
    return {
      status: 'failed',
      externalId: null,
      error: error.message || 'Publiceren naar WordPress mislukt.',
    };
  }
}

module.exports = {
  publishDraft,
  expirePublishedDraft,
  publishSeoPage,
};