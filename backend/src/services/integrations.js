const { supabase } = require('../db/client');
const { encryptValue, decryptValue } = require('./crypto');

const BUFFER_API_URL = process.env.BUFFER_API_URL || 'https://graph.buffer.com';
const SUPPORTED_PROVIDERS = ['buffer'];
const INTEGRATION_KEY_PREFIX = 'integration_';

function integrationKey(provider) {
  return `${INTEGRATION_KEY_PREFIX}${provider}`;
}

function isSupportedProvider(provider) {
  return SUPPORTED_PROVIDERS.includes(provider);
}

function sanitizeCredential(row) {
  if (!row) {
    return null;
  }

  let payload = {};

  try {
    if (typeof row.value === 'string' && row.value.trim()) {
      payload = JSON.parse(decryptValue(row.value));
    } else if (row.value && typeof row.value === 'object') {
      payload = row.value;
    } else {
      payload = {};
    }
  } catch (_error) {
    payload = {};
  }

  const provider = row.key.replace(INTEGRATION_KEY_PREFIX, '');
  const bufferConnected = provider === 'buffer' && Boolean(process.env.BUFFER_API_KEY);

  return {
    provider,
    hasAccessToken: Boolean(payload.access_token) || bufferConnected,
    hasRefreshToken: Boolean(payload.refresh_token),
    expiresAt: payload.expires_at || null,
    metadata: payload.metadata || {},
    updatedAt: payload.updated_at || row.updated_at || null,
  };
}

async function getCredential(provider) {
  const { data, error } = await supabase
    .from('brand_settings')
    .select('key, value, updated_at')
    .eq('key', integrationKey(provider))
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (data) {
    return data;
  }

  if (provider === 'buffer' && process.env.BUFFER_API_KEY) {
    return {
      key: integrationKey(provider),
      value: JSON.stringify({
        access_token: process.env.BUFFER_API_KEY,
        metadata: {},
      }),
      updated_at: null,
    };
  }

  return null;
}

async function getCredentialStatus(provider) {
  const row = await getCredential(provider);
  return sanitizeCredential(row);
}

async function getAllCredentialStatuses() {
  const fallbackRows = [];

  if (process.env.BUFFER_API_KEY) {
    fallbackRows.push({
      key: integrationKey('buffer'),
      value: JSON.stringify({
        access_token: process.env.BUFFER_API_KEY,
        metadata: {},
      }),
      updated_at: null,
    });
  }

  const { data, error } = await supabase
    .from('brand_settings')
    .select('key, value, updated_at')
    .in('key', SUPPORTED_PROVIDERS.map((provider) => integrationKey(provider)))
    .order('key', { ascending: true });

  if (error) {
    throw error;
  }

  const map = new Map(
    [...fallbackRows, ...(data || [])].map((row) => [row.key.replace(INTEGRATION_KEY_PREFIX, ''), sanitizeCredential(row)])
  );
  return SUPPORTED_PROVIDERS.map((provider) => map.get(provider) || {
    provider,
    hasAccessToken: false,
    hasRefreshToken: false,
    expiresAt: null,
    metadata: {},
    updatedAt: null,
  });
}

async function upsertCredential(provider, input) {
  const credentialPayload = {
    access_token: input.accessToken || null,
    refresh_token: input.refreshToken || null,
    expires_at: input.expiresAt || null,
    metadata: input.metadata || {},
    updated_at: new Date().toISOString(),
  };

  const row = {
    key: integrationKey(provider),
    value: encryptValue(JSON.stringify(credentialPayload)),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('brand_settings')
    .upsert(row, { onConflict: 'key' })
    .select('key, value, updated_at')
    .single();

  if (error) {
    throw error;
  }

  return sanitizeCredential(data);
}

async function callBufferGraphQL(accessToken, query, variables = {}) {
  const response = await fetch(BUFFER_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
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

const BUFFER_SERVICE_MAP = {
  linkedin: 'linkedin',
  linkedin_page: 'linkedin',
  linkedinpage: 'linkedin',
  facebook: 'facebook',
  facebook_page: 'facebook',
  facebookpage: 'facebook',
  instagram: 'instagram',
  instagram_business: 'instagram',
  instagrambusiness: 'instagram',
};

function summarizeDiscovery(discovery) {
  const channelIds = {};
  const channelNames = {};
  let primaryOrganization = null;

  for (const organization of discovery?.organizations || []) {
    if (!primaryOrganization && organization?.channels?.length) {
      primaryOrganization = organization;
    }

    for (const channel of organization?.channels || []) {
      const service = String(channel?.service || '').toLowerCase();
      const canonical = BUFFER_SERVICE_MAP[service];

      // First hit wins per service — Light has one page per platform. If they
      // ever add a second, this needs to become a picker rather than "first."
      if (canonical && !channelIds[canonical]) {
        channelIds[canonical] = channel.id;
        channelNames[canonical] = channel.name || null;
      }
    }
  }

  return {
    channelIds,
    channelNames,
    organizationId: primaryOrganization?.id || null,
    organizationName: primaryOrganization?.name || null,
  };
}

async function getBufferAccessToken() {
  const row = await getCredential('buffer');

  if (!row) {
    return { accessToken: null, storedMetadata: {} };
  }

  let payload = {};

  try {
    if (typeof row.value === 'string' && row.value.trim()) {
      payload = JSON.parse(decryptValue(row.value));
    } else if (row.value && typeof row.value === 'object') {
      payload = row.value;
    }
  } catch (_error) {
    payload = {};
  }

  return {
    accessToken: payload.access_token || process.env.BUFFER_API_KEY || null,
    storedMetadata: payload.metadata || {},
    storedRefreshToken: payload.refresh_token || null,
    storedExpiresAt: payload.expires_at || null,
  };
}

async function refreshBufferChannels() {
  const { accessToken, storedMetadata, storedRefreshToken, storedExpiresAt } =
    await getBufferAccessToken();

  if (!accessToken) {
    throw new Error(
      'Buffer is niet gekoppeld. Vul eerst een Buffer API-key in bij Merk instellingen.'
    );
  }

  const discovery = await discoverBufferChannels(accessToken);
  const summary = summarizeDiscovery(discovery);

  const nextMetadata = {
    ...storedMetadata,
    channelIds: {
      ...(storedMetadata.channelIds || {}),
      ...summary.channelIds,
    },
    channelNames: {
      ...(storedMetadata.channelNames || {}),
      ...summary.channelNames,
    },
    organizationId: summary.organizationId || storedMetadata.organizationId || null,
    organizationName: summary.organizationName || storedMetadata.organizationName || null,
    channelsRefreshedAt: new Date().toISOString(),
  };

  const status = await upsertCredential('buffer', {
    accessToken,
    refreshToken: storedRefreshToken,
    expiresAt: storedExpiresAt,
    metadata: nextMetadata,
  });

  return { status, discovery, summary };
}

async function discoverBufferChannels(accessToken) {
  const accountResult = await callBufferGraphQL(
    accessToken,
    `query BufferAccount { account { id organizations { id name } } }`
  );

  const organizations = accountResult?.account?.organizations || [];

  const organizationDetails = await Promise.all(
    organizations.map(async (organization) => {
      const channelsResult = await callBufferGraphQL(
        accessToken,
        `query BufferChannels($organizationId: OrganizationId!) {
          channels(input: { organizationId: $organizationId }) {
            id
            name
            service
          }
        }`,
        { organizationId: organization.id }
      );

      return {
        id: organization.id,
        name: organization.name,
        channels: channelsResult?.channels || [],
      };
    })
  );

  return {
    accountId: accountResult?.account?.id || null,
    organizations: organizationDetails,
  };
}

module.exports = {
  SUPPORTED_PROVIDERS,
  isSupportedProvider,
  getCredential,
  getCredentialStatus,
  getAllCredentialStatuses,
  upsertCredential,
  discoverBufferChannels,
  refreshBufferChannels,
  getBufferAccessToken,
};
