const { getCredential } = require('./integrations');

const INDEED_GRAPHQL_URL = process.env.INDEED_GRAPHQL_URL || '';

function buildDefaultInput(draft, metadata) {
  return {
    externalJobId: draft.id,
    title:
      draft.form_data?.functietitel ||
      draft.form_data?.onderwerp ||
      draft.form_data?.title ||
      draft.form_data?.titel ||
      'Vacature',
    description: draft.content_nl || draft.social_nl || '',
    location: draft.form_data?.locatie || 'Rotterdam',
    employerId: metadata?.employerId || null,
    language: draft.form_data?.taal?.includes('Pools') ? 'nl,pl' : 'nl',
  };
}

async function publishIndeedViaWebhookLikeEndpoint(draft, credential) {
  const apiUrl = process.env.INDEED_API_URL;

  if (!apiUrl) {
    throw new Error('Indeed API URL ontbreekt.');
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: credential?.access_token ? `Bearer ${credential.access_token}` : '',
      'x-api-key': process.env.INDEED_API_KEY || '',
    },
    body: JSON.stringify({
      draftId: draft.id,
      type: draft.type,
      formData: draft.form_data,
      content: {
        content_nl: draft.content_nl,
        social_nl: draft.social_nl,
        content_pl: draft.content_pl,
        social_pl: draft.social_pl,
      },
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || payload?.message || `Indeed API fout (${response.status})`);
  }

  return {
    status: payload?.status === 'failed' ? 'failed' : 'success',
    externalId: payload?.externalId || payload?.external_id || payload?.id || null,
    error: payload?.error || payload?.error_message || null,
  };
}

async function publishIndeedViaGraphQL(draft, credential) {
  const mutation = process.env.INDEED_JOB_SYNC_MUTATION;

  if (!INDEED_GRAPHQL_URL) {
    throw new Error('INDEED_GRAPHQL_URL ontbreekt.');
  }

  if (!mutation) {
    throw new Error('INDEED_JOB_SYNC_MUTATION ontbreekt. Voeg je partner-mutatie toe in .env.');
  }

  const metadata = credential?.metadata || {};
  const variables = {
    input: {
      ...buildDefaultInput(draft, metadata),
      ...(metadata.jobSyncDefaults || {}),
    },
  };

  const response = await fetch(INDEED_GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: credential?.access_token ? `Bearer ${credential.access_token}` : '',
      'x-api-key': process.env.INDEED_API_KEY || '',
    },
    body: JSON.stringify({ query: mutation, variables }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.errors?.[0]?.message || `Indeed GraphQL fout (${response.status})`);
  }

  if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
    throw new Error(payload.errors[0]?.message || 'Indeed GraphQL gaf een fout terug.');
  }

  const data = payload?.data || {};
  const firstValue = Object.values(data)[0] || {};

  return {
    status: 'success',
    externalId: firstValue?.jobId || firstValue?.id || draft.id,
    error: null,
  };
}

async function publishToIndeed(draft) {
  const credential = await getCredential('indeed');

  if (INDEED_GRAPHQL_URL || process.env.INDEED_JOB_SYNC_MUTATION) {
    return publishIndeedViaGraphQL(draft, credential);
  }

  return publishIndeedViaWebhookLikeEndpoint(draft, credential);
}

module.exports = {
  publishToIndeed,
};
