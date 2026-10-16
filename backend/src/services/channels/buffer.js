const { getCredential } = require('../integrations');

// Buffer's GraphQL API lives on api.buffer.com (graph.buffer.com redirects
// there). Override via env if Buffer moves the endpoint.
const BUFFER_API_URL = process.env.BUFFER_API_URL || 'https://api.buffer.com';

function getEnvMetadata() {
  return {
    channelIds: {
      linkedin: process.env.BUFFER_LINKEDIN_CHANNEL_ID || null,
      facebook: process.env.BUFFER_FACEBOOK_CHANNEL_ID || null,
      instagram: process.env.BUFFER_INSTAGRAM_CHANNEL_ID || null,
    },
    publicBaseUrl: process.env.PUBLIC_APP_URL || process.env.APP_BASE_URL || null,
    defaultImageUrl: process.env.BUFFER_DEFAULT_IMAGE_URL || null,
  };
}

async function getBufferCredential() {
  const credential = await getCredential('buffer');

  const envMeta = getEnvMetadata();
  const dbMeta = credential?.metadata || {};

  return {
    access_token: credential?.access_token || process.env.BUFFER_API_KEY || null,
    metadata: {
      ...envMeta,
      ...dbMeta,
      // Deep-merge channelIds so DB values don't erase env vars
      channelIds: {
        ...envMeta.channelIds,
        ...(dbMeta.channelIds || {}),
      },
    },
  };
}

function contentForChannel(channel, draft) {
  if (channel === 'linkedin') {
    return draft.linkedin_post || draft.social_nl || draft.content_nl || '';
  }

  if (channel === 'instagram') {
    return draft.instagram_caption || draft.social_nl || draft.linkedin_post || draft.content_nl || '';
  }

  return draft.social_nl || draft.linkedin_post || draft.content_nl || '';
}

function getChannelId(metadata, channel) {
  return metadata?.channelIds?.[channel] || metadata?.[`${channel}ChannelId`] || null;
}

function getPublicImageUrl(imagePath, metadata) {
  if (!imagePath) {
    return metadata.defaultImageUrl || null;
  }

  if (/^https?:\/\//i.test(imagePath)) {
    return imagePath;
  }

  const baseUrl = metadata.publicBaseUrl || '';
  if (!baseUrl) {
    return metadata.defaultImageUrl || null;
  }

  return `${baseUrl.replace(/\/$/, '')}${imagePath}`;
}

// Translate common English Buffer error messages to Dutch for end users.
function translateBufferError(msg) {
  if (!msg || typeof msg !== 'string') return 'Buffer API fout.';
  const lower = msg.toLowerCase();
  if (lower.includes('too many requests')) {
    return 'Te veel verzoeken naar Buffer. Probeer het over een minuut opnieuw.';
  }
  if (lower.includes('unauthorized') || lower.includes('authentication')) {
    return 'Buffer-authenticatie mislukt. Controleer de API-key in Merk instellingen.';
  }
  if (lower.includes('forbidden')) {
    return 'Geen toegang tot Buffer. Controleer de API-key rechten.';
  }
  if (lower.includes('not found')) {
    return 'Buffer-kanaal of bericht niet gevonden.';
  }
  if (lower.includes('network') || lower.includes('econnrefused') || lower.includes('fetch failed')) {
    return 'Kan geen verbinding maken met Buffer. Controleer de internetverbinding.';
  }
  // Return original if no translation matches — it's already Dutch or unknown
  return msg;
}

const RETRY_DELAYS = [3000, 8000, 15000]; // exponential backoff: 3s, 8s, 15s

async function callBuffer(query, accessToken) {
  let lastError;

  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      const response = await fetch(BUFFER_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });

      const payload = await response.json().catch(() => ({}));

      // Rate limited — respect Retry-After header if present, else use backoff
      if (response.status === 429 && attempt < RETRY_DELAYS.length) {
        const retryAfterSec = parseInt(response.headers.get('retry-after'), 10);
        const delay = retryAfterSec > 0
          ? retryAfterSec * 1000
          : RETRY_DELAYS[attempt];
        console.log(`[Buffer] Rate limited (429), retry-after=${retryAfterSec || 'n/a'}, waiting ${delay}ms (poging ${attempt + 2}/${RETRY_DELAYS.length + 1}). Response: ${JSON.stringify(payload)}`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      if (!response.ok) {
        console.log(`[Buffer] HTTP ${response.status}: ${JSON.stringify(payload)}`);
        const rawMsg = payload?.errors?.[0]?.message || `Buffer API fout (${response.status})`;
        throw new Error(translateBufferError(rawMsg));
      }

      if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
        throw new Error(translateBufferError(payload.errors[0]?.message));
      }

      return payload?.data || {};
    } catch (err) {
      lastError = err;
      // Retry on network errors (fetch failures), not on business logic errors
      const isNetworkError = err.cause?.code === 'ECONNREFUSED'
        || err.message?.includes('fetch failed')
        || err.message?.includes('network');
      if (isNetworkError && attempt < RETRY_DELAYS.length) {
        const delay = RETRY_DELAYS[attempt];
        console.log(`[Buffer] Network error, retrying in ${delay}ms (poging ${attempt + 2}/${RETRY_DELAYS.length + 1}): ${err.message}`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw new Error(translateBufferError(err.message));
    }
  }

  throw lastError || new Error('Buffer API fout na meerdere pogingen.');
}

async function createPost({ accessToken, channelId, channel, text, imageUrl, dueAt }) {
  const assetBlock = imageUrl
    ? `
          assets: [
            {
              image: {
                url: ${JSON.stringify(imageUrl)}
              }
            }
          ]`
    : '';

  // Scheduling: customScheduled is used for both explicit schedules AND
  // "publish now" (no dueAt). For immediate publishing we set dueAt to
  // 2 minutes from now, which bypasses Buffer's queue slots and posts
  // almost immediately. addToQueue would wait for the next queue slot.
  const scheduledIso = dueAt
    ? new Date(dueAt).toISOString()
    : new Date(Date.now() + 2 * 60_000).toISOString();
  const modeBlock = `mode: customScheduled\n          dueAt: ${JSON.stringify(scheduledIso)}`;

  // Facebook and Instagram require metadata with type (post/story/reel).
  // Instagram also requires shouldShareToFeed. LinkedIn needs no metadata.
  let metadataBlock = '';
  if (channel === 'facebook') {
    metadataBlock = `
          metadata: {
            facebook: { type: post }
          }`;
  } else if (channel === 'instagram') {
    metadataBlock = `
          metadata: {
            instagram: { type: post, shouldShareToFeed: true }
          }`;
  }

  const query = `
    mutation CreateBufferPost {
      createPost(
        input: {
          text: ${JSON.stringify(text)}
          channelId: ${JSON.stringify(channelId)}
          schedulingType: automatic
          ${modeBlock}${metadataBlock}${assetBlock}
        }
      ) {
        __typename
        ... on PostActionSuccess {
          post {
            id
            dueAt
          }
        }
        ... on MutationError {
          message
        }
        ... on InvalidInputError {
          message
        }
      }
    }
  `;

  const data = await callBuffer(query, accessToken);
  const result = data?.createPost;

  if (process.env.NODE_ENV !== 'production' || process.env.BUFFER_DEBUG) {
    console.log('[Buffer createPost] channelId=%s response=%j', channelId, result);
  }

  if (!result) {
    return {
      status: 'failed',
      externalId: null,
      error: 'Buffer gaf geen antwoord terug.',
    };
  }

  if (result.__typename === 'MutationError' || result.__typename === 'InvalidInputError') {
    return {
      status: 'failed',
      externalId: null,
      error: translateBufferError(result.message) || 'Buffer kon het bericht niet aanmaken.',
    };
  }

  const postId = result?.post?.id || null;
  if (!postId) {
    return {
      status: 'failed',
      externalId: null,
      error: `Buffer gaf geen post-ID terug (type: ${result.__typename || 'onbekend'}) — het bericht is waarschijnlijk niet aangemaakt.`,
    };
  }

  return {
    status: 'success',
    externalId: postId,
    error: null,
  };
}

async function publishSingle(channel, draft) {
  const credential = await getBufferCredential();

  if (!credential.access_token) {
    return {
      status: 'failed',
      externalId: null,
      error: 'Buffer is niet gekoppeld. Stel BUFFER_API_KEY in of koppel Buffer in Merk instellingen.',
    };
  }

  const text = contentForChannel(channel, draft).trim();
  if (!text) {
    return {
      status: 'failed',
      externalId: null,
      error: `Geen ${channel}-tekst om te publiceren.`,
    };
  }

  const channelId = getChannelId(credential.metadata, channel);
  if (!channelId) {
    return {
      status: 'failed',
      externalId: null,
      error: `Buffer kanaal-ID ontbreekt voor ${channel}. Vul het channel-ID in bij Merk instellingen.`,
    };
  }

  // All channels (including LinkedIn) receive the image. If Buffer's createPost
  // rejects image assets for a specific channel, that channel's post will fail
  // with the Buffer error surfaced to the user — check https://buffer.com (API).
  const imageUrl = getPublicImageUrl(draft.image_path, credential.metadata);

  try {
    return await createPost({
      accessToken: credential.access_token,
      channelId,
      channel,
      text,
      imageUrl,
      dueAt: draft.scheduledFor || null,
    });
  } catch (error) {
    return {
      status: 'failed',
      externalId: null,
      error: translateBufferError(error.message) || `Publiceren naar ${channel} via Buffer mislukt.`,
    };
  }
}

async function publish(draft, requestedChannel) {
  if (requestedChannel === 'facebook_instagram') {
    const results = [];
    const subChannels = ['facebook', 'instagram'];

    for (let i = 0; i < subChannels.length; i++) {
      const channel = subChannels[i];
      // Delay between sub-channel posts to avoid Buffer rate limits
      if (i > 0) await new Promise((r) => setTimeout(r, 2000));
      try {
        const result = await publishSingle(channel, draft);
        results.push({ channel, ...result });
      } catch (error) {
        results.push({
          channel,
          status: 'failed',
          externalId: null,
          error: translateBufferError(error.message) || `${channel} publiceren mislukt.`,
        });
      }
    }

    const success = results.some((entry) => entry.status === 'success');

    return {
      status: success ? 'success' : 'failed',
      externalId: JSON.stringify(results.map((item) => ({ channel: item.channel, id: item.externalId }))),
      error: success ? null : results.map((item) => `${item.channel}: ${item.error || 'mislukt'}`).join(' | '),
      details: results,
    };
  }

  return publishSingle(requestedChannel, draft);
}

// Reschedule an existing Buffer post to a new dueAt (ISO 8601). Uses the
// editPost mutation which is atomic on Buffer's side — no cancel-then-recreate
// window and no race with the fire moment. Confirmed via schema probe.
async function editPost({ externalId, dueAt }) {
  const credential = await getBufferCredential();
  if (!credential.access_token) {
    return { status: 'failed', error: 'Buffer is niet gekoppeld.' };
  }

  const iso = new Date(dueAt).toISOString();
  const query = `
    mutation EditBufferPost {
      editPost(
        input: {
          id: ${JSON.stringify(externalId)}
          dueAt: ${JSON.stringify(iso)}
          mode: customScheduled
        }
      ) {
        __typename
        ... on PostActionSuccess { post { id dueAt } }
        ... on MutationError { message }
      }
    }
  `;

  try {
    const data = await callBuffer(query, credential.access_token);
    const result = data?.editPost;
    if (!result) return { status: 'failed', error: 'Buffer gaf geen antwoord.' };
    if (result.__typename === 'MutationError') {
      return { status: 'failed', error: result.message || 'Buffer kon het bericht niet aanpassen.' };
    }
    return { status: 'success', scheduledFor: result?.post?.dueAt || iso };
  } catch (err) {
    return { status: 'failed', error: err.message || 'Bericht aanpassen via Buffer mislukt.' };
  }
}

// Cancel (delete) a scheduled or drafted Buffer post. 404-style responses are
// treated as success ("already gone from Buffer") so the caller can idempotently
// mark our local row as cancelled.
async function deletePost({ externalId }) {
  const credential = await getBufferCredential();
  if (!credential.access_token) {
    return { status: 'failed', error: 'Buffer is niet gekoppeld.' };
  }

  const query = `
    mutation DeleteBufferPost {
      deletePost(input: { id: ${JSON.stringify(externalId)} }) {
        __typename
        ... on PostActionSuccess { post { id } }
        ... on MutationError { message }
      }
    }
  `;

  try {
    const data = await callBuffer(query, credential.access_token);
    const result = data?.deletePost;
    if (!result) return { status: 'failed', error: 'Buffer gaf geen antwoord.' };
    if (result.__typename === 'MutationError') {
      // Not-found / already-deleted → treat as success for idempotency.
      const msg = result.message || '';
      if (/not.?found|already|does not exist/i.test(msg)) {
        return { status: 'success', alreadyGone: true };
      }
      return { status: 'failed', error: msg || 'Buffer kon het bericht niet verwijderen.' };
    }
    return { status: 'success' };
  } catch (err) {
    return { status: 'failed', error: err.message || 'Bericht verwijderen via Buffer mislukt.' };
  }
}

module.exports = {
  publish,
  editPost,
  deletePost,
};