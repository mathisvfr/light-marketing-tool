const { getCredential } = require('../integrations');

async function publish(content) {
  const credential = await getCredential('linkedin');

  if (!credential?.access_token) {
    return {
      status: 'failed',
      externalId: null,
      error: 'LinkedIn is niet gekoppeld.',
    };
  }

  const text = content?.linkedin_post || content?.social_nl || '';
  if (!text.trim()) {
    return {
      status: 'failed',
      externalId: null,
      error: 'Geen LinkedIn-tekst om te publiceren.',
    };
  }

  return {
    status: 'failed',
    externalId: null,
    error: 'LinkedIn Pages API nog niet geactiveerd in deze fase.',
  };
}

module.exports = {
  publish,
};
