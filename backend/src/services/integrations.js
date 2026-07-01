const { supabase } = require('../db/client');
const { encryptValue, decryptValue } = require('./crypto');

const BUFFER_API_URL = process.env.BUFFER_API_URL || 'https://api.buffer.com';
const SUPPORTED_PROVIDERS = ['buffer', 'wordpress'];
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
  const bufferFallback = process.env.BUFFER_API_KEY
    ? [{
        key: integrationKey('buffer'),
        value: JSON.stringify({
          access_token: process.env.BUFFER_API_KEY,
          metadata: {},
        }),
        updated_at: null,
      }]
    : [];

  const { data, error } = await supabase
    .from('brand_settings')
    .select('key, value, updated_at')
    .in('key', SUPPORTED_PROVIDERS.map((provider) => integrationKey(provider)))
    .order('key', { ascending: true });

  if (error) {
    throw error;
  }

  const map = new Map(
    [...bufferFallback, ...(data || [])].map((row) => [row.key.replace(INTEGRATION_KEY_PREFIX, ''), sanitizeCredential(row)])
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
};
