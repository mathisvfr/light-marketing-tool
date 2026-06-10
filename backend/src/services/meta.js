const { getCredential } = require('./integrations');

const META_API = process.env.META_GRAPH_API_BASE || 'https://graph.facebook.com/v20.0';

function contentFromDraft(draft) {
  if (draft.type === 'marketing-post') {
    return draft.social_nl || draft.linkedin_post || '';
  }

  return draft.social_nl || draft.content_nl || '';
}

function requireMetaConfig(credential, requiredKeys) {
  if (!credential || !credential.access_token) {
    throw new Error('Meta integratie is niet geconfigureerd (access token ontbreekt).');
  }

  const metadata = credential.metadata || {};
  const missing = requiredKeys.filter((key) => !metadata[key]);

  if (missing.length > 0) {
    throw new Error(`Meta metadata ontbreekt: ${missing.join(', ')}`);
  }

  return metadata;
}

async function callGraph(path, params, accessToken, method = 'GET') {
  const url = new URL(`${META_API}${path}`);

  if (method === 'GET') {
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });
    url.searchParams.set('access_token', accessToken);
  }

  const response = await fetch(url.toString(), {
    method,
    headers: method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {},
    body:
      method === 'POST'
        ? new URLSearchParams({
            ...(params || {}),
            access_token: accessToken,
          }).toString()
        : undefined,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload?.error) {
    throw new Error(payload?.error?.message || payload?.error || `Meta API fout (${response.status})`);
  }

  return payload;
}

async function publishFacebookPost(draft) {
  const credential = await getCredential('meta');
  const metadata = requireMetaConfig(credential, ['facebookPageId']);

  const result = await callGraph(
    `/${metadata.facebookPageId}/feed`,
    {
      message: contentFromDraft(draft),
    },
    credential.access_token,
    'POST'
  );

  return {
    status: 'success',
    externalId: result?.id || null,
    error: null,
  };
}

async function publishInstagramPost(draft) {
  const credential = await getCredential('meta');
  const metadata = requireMetaConfig(credential, ['instagramUserId']);

  const imageUrl = metadata.defaultImageUrl || process.env.IG_DEFAULT_IMAGE_URL;
  if (!imageUrl) {
    throw new Error('Instagram vereist een afbeelding (metadata.defaultImageUrl of IG_DEFAULT_IMAGE_URL).');
  }

  const container = await callGraph(
    `/${metadata.instagramUserId}/media`,
    {
      image_url: imageUrl,
      caption: contentFromDraft(draft),
    },
    credential.access_token,
    'POST'
  );

  const publishResult = await callGraph(
    `/${metadata.instagramUserId}/media_publish`,
    {
      creation_id: container?.id,
    },
    credential.access_token,
    'POST'
  );

  return {
    status: 'success',
    externalId: publishResult?.id || container?.id || null,
    error: null,
  };
}

async function publishFacebookInstagram(draft) {
  const results = [];

  try {
    const fb = await publishFacebookPost(draft);
    results.push({ channel: 'facebook', ...fb });
  } catch (error) {
    results.push({
      channel: 'facebook',
      status: 'failed',
      externalId: null,
      error: error.message || 'Facebook publiceren mislukt.',
    });
  }

  try {
    const ig = await publishInstagramPost(draft);
    results.push({ channel: 'instagram', ...ig });
  } catch (error) {
    results.push({
      channel: 'instagram',
      status: 'failed',
      externalId: null,
      error: error.message || 'Instagram publiceren mislukt.',
    });
  }

  const success = results.some((entry) => entry.status === 'success');

  return {
    status: success ? 'success' : 'failed',
    externalId: JSON.stringify(results.map((item) => ({ channel: item.channel, id: item.externalId }))),
    error: success ? null : results.map((item) => `${item.channel}: ${item.error || 'mislukt'}`).join(' | '),
    details: results,
  };
}

async function fetchMetaInsights({ since, until }) {
  const credential = await getCredential('meta');
  const metadata = requireMetaConfig(credential, ['facebookPageId', 'instagramUserId']);

  const fb = await callGraph(
    `/${metadata.facebookPageId}/insights`,
    {
      metric: 'page_impressions,page_engaged_users,page_post_engagements',
      period: 'day',
      since,
      until,
    },
    credential.access_token,
    'GET'
  );

  const ig = await callGraph(
    `/${metadata.instagramUserId}/insights`,
    {
      metric: 'impressions,reach,profile_views',
      period: 'day',
      since,
      until,
    },
    credential.access_token,
    'GET'
  );

  return {
    facebookPageId: metadata.facebookPageId,
    instagramUserId: metadata.instagramUserId,
    facebook: fb?.data || [],
    instagram: ig?.data || [],
  };
}

module.exports = {
  publishFacebookInstagram,
  fetchMetaInsights,
};
