const { Buffer } = require('node:buffer');

async function publish(content) {
  const baseUrl = process.env.WORDPRESS_API_URL;
  const username = process.env.WORDPRESS_USERNAME;
  const appPassword = process.env.WORDPRESS_APP_PASSWORD;

  if (!baseUrl || !username || !appPassword) {
    return { status: 'failed', externalId: null, error: 'WordPress API is niet geconfigureerd.' };
  }

  const endpoint = `${baseUrl.replace(/\/$/, '')}/wp-json/wp/v2/posts`;
  const basicToken = Buffer.from(`${username}:${appPassword}`).toString('base64');
  const title =
    content?.form_data?.functietitel ||
    content?.form_data?.onderwerp ||
    content?.form_data?.title ||
    content?.form_data?.titel ||
    'Zonder titel';

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${basicToken}`,
    },
    body: JSON.stringify({
      title,
      status: 'publish',
      content: content?.omschrijving_nl || content?.linkedin_post || content?.social_nl || '',
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      status: 'failed',
      externalId: null,
      error: payload?.message || payload?.error || `WordPress fout (${response.status})`,
    };
  }

  return {
    status: 'success',
    externalId: payload?.id ? String(payload.id) : payload?.link || null,
    error: null,
  };
}

module.exports = {
  publish,
};
