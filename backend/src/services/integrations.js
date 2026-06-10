const { supabase } = require('../db/client');

const SUPPORTED_PROVIDERS = ['indeed', 'meta', 'google_mijn_bedrijf', 'wordpress'];

function isSupportedProvider(provider) {
  return SUPPORTED_PROVIDERS.includes(provider);
}

function sanitizeCredential(row) {
  if (!row) {
    return null;
  }

  return {
    provider: row.provider,
    hasAccessToken: Boolean(row.access_token),
    hasRefreshToken: Boolean(row.refresh_token),
    expiresAt: row.expires_at,
    metadata: row.metadata || {},
    updatedAt: row.updated_at,
  };
}

async function getCredential(provider) {
  const { data, error } = await supabase
    .from('integration_credentials')
    .select('provider, access_token, refresh_token, expires_at, metadata, updated_at')
    .eq('provider', provider)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
}

async function getCredentialStatus(provider) {
  const row = await getCredential(provider);
  return sanitizeCredential(row);
}

async function getAllCredentialStatuses() {
  const { data, error } = await supabase
    .from('integration_credentials')
    .select('provider, access_token, refresh_token, expires_at, metadata, updated_at')
    .in('provider', SUPPORTED_PROVIDERS)
    .order('provider', { ascending: true });

  if (error) {
    throw error;
  }

  const map = new Map((data || []).map((row) => [row.provider, sanitizeCredential(row)]));
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
  const payload = {
    provider,
    access_token: input.accessToken || null,
    refresh_token: input.refreshToken || null,
    expires_at: input.expiresAt || null,
    metadata: input.metadata || {},
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('integration_credentials')
    .upsert(payload, { onConflict: 'provider' })
    .select('provider, access_token, refresh_token, expires_at, metadata, updated_at')
    .single();

  if (error) {
    throw error;
  }

  return sanitizeCredential(data);
}

module.exports = {
  SUPPORTED_PROVIDERS,
  isSupportedProvider,
  getCredential,
  getCredentialStatus,
  getAllCredentialStatuses,
  upsertCredential,
};
