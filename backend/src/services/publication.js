const { supabase } = require('../db/client');
const { publishToIndeed } = require('./indeed');
const bufferChannel = require('./channels/buffer');
const wordpressChannel = require('./channels/wordpress');
const { getCredential } = require('./integrations');

const REQUEST_TIMEOUT_MS = 15000;

function getDraftTitle(formData) {
  if (!formData || typeof formData !== 'object') {
    return 'Zonder titel';
  }

  return formData.functietitel || formData.onderwerp || formData.title || formData.titel || 'Zonder titel';
}

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

function contentForChannel(draft) {
  if (draft.type === 'marketing-post') {
    return {
      linkedin_post: draft.linkedin_post,
      facebook_post: draft.social_nl,
    };
  }

  return {
    vacature_nl: draft.content_nl,
    social_nl: draft.social_nl,
    vacature_pl: draft.content_pl,
    social_pl: draft.social_pl,
  };
}

async function publishToGoogleMijnBedrijf(draft) {
  const apiUrl = process.env.GMB_API_URL;
  const credential = await getCredential('google_mijn_bedrijf');
  const token = credential?.access_token || process.env.GMB_ACCESS_TOKEN;

  if (!apiUrl || !token) {
    return { status: 'failed', error: 'Google Mijn Bedrijf API is niet geconfigureerd.' };
  }

  const result = await postJson(
    apiUrl,
    {
      draftId: draft.id,
      type: draft.type,
      title: getDraftTitle(draft.form_data),
      formData: draft.form_data,
      content: contentForChannel(draft),
    },
    { Authorization: `Bearer ${token}` }
  );

  return {
    status: result?.status === 'failed' ? 'failed' : 'success',
    externalId: result?.externalId || result?.external_id || result?.name || null,
    error: result?.error || result?.error_message || null,
  };
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
  if (channel === 'indeed') {
    return publishToIndeed(draft);
  }

  if (channel === 'google_mijn_bedrijf') {
    return publishToGoogleMijnBedrijf(draft);
  }

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
  // Placeholder for direct per-channel expire actions (Indeed/WordPress/GMB).
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