const { getCredential } = require('../integrations');

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

  return {
    access_token: credential?.access_token || process.env.BUFFER_API_KEY || null,
    metadata: {
      ...getEnvMetadata(),
      ...(credential?.metadata || {}),
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

async function callBuffer(query, accessToken) {
  const response = await fetch(BUFFER_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.errors?.[0]?.message || `Buffer API fout (${response.status})`);
  }

  if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
    throw new Error(payload.errors[0]?.message || 'Buffer API fout.');
  }

  return payload?.data || {};
}

async function createPost({ accessToken, channelId, text, imageUrl }) {
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

  const query = `
    mutation CreateBufferPost {
      createPost(
        input: {
          text: ${JSON.stringify(text)}
          channelId: ${JSON.stringify(channelId)}
          schedulingType: automatic
          mode: addToQueue${assetBlock}
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
      }
    }
  `;

  const data = await callBuffer(query, accessToken);
  const result = data?.createPost;

  if (!result) {
    throw new Error('Buffer gaf geen antwoord terug.');
  }

  if (result.__typename === 'MutationError') {
    throw new Error(result.message || 'Buffer kon het bericht niet aanmaken.');
  }

  return {
    status: 'success',
    externalId: result?.post?.id || null,
    error: null,
  };
}

async function publishSingle(channel, draft) {
  const credential = await getBufferCredential();

  if (!credential.access_token) {
    throw new Error('Buffer is niet gekoppeld.');
  }

  const text = contentForChannel(channel, draft).trim();
  if (!text) {
    throw new Error(`Geen ${channel}-tekst om te publiceren.`);
  }

  const channelId = getChannelId(credential.metadata, channel);
  if (!channelId) {
    throw new Error(`Buffer kanaal-ID ontbreekt voor ${channel}.`);
  }

  const imageUrl = channel === 'linkedin' ? null : getPublicImageUrl(draft.image_path, credential.metadata);

  return createPost({
    accessToken: credential.access_token,
    channelId,
    text,
    imageUrl,
  });
}

async function publish(draft, requestedChannel) {
  if (requestedChannel === 'facebook_instagram') {
    const results = [];

    for (const channel of ['facebook', 'instagram']) {
      try {
        const result = await publishSingle(channel, draft);
        results.push({ channel, ...result });
      } catch (error) {
        results.push({
          channel,
          status: 'failed',
          externalId: null,
          error: error.message || `${channel} publiceren mislukt.`,
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

module.exports = {
  publish,
};