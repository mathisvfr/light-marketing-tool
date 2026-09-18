const { createApi } = require('unsplash-js');

const APP_NAME = 'light_marketing_tool';

let client = null;

function getClient() {
  if (client) return client;

  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) return null;

  client = createApi({ accessKey });
  return client;
}

function isAvailable() {
  return Boolean(process.env.UNSPLASH_ACCESS_KEY);
}

async function search(query, { orientation, page = 1, perPage = 12 } = {}) {
  const api = getClient();
  if (!api) return { available: false, results: [], total: 0, total_pages: 0 };

  const params = {
    query,
    page,
    perPage,
    contentFilter: 'high',
  };
  if (orientation) params.orientation = orientation;

  const result = await api.search.getPhotos(params);

  if (result.errors) {
    const msg = Array.isArray(result.errors) ? result.errors.join(', ') : String(result.errors);
    throw new Error(`Unsplash zoeken mislukt: ${msg}`);
  }

  const response = result.response;
  return {
    available: true,
    results: (response.results || []).map(formatPhoto),
    total: response.total || 0,
    total_pages: response.total_pages || 0,
  };
}

function formatPhoto(photo) {
  return {
    id: photo.id,
    urls: {
      regular: photo.urls?.regular || '',
      small: photo.urls?.small || '',
      thumb: photo.urls?.thumb || '',
    },
    alt_description: photo.alt_description || photo.description || '',
    width: photo.width,
    height: photo.height,
    color: photo.color,
    user: {
      name: photo.user?.name || '',
      username: photo.user?.username || '',
      link: `https://unsplash.com/@${photo.user?.username || ''}?utm_source=${APP_NAME}&utm_medium=referral`,
    },
    download_location: photo.links?.download_location || '',
  };
}

async function trackDownload(downloadLocation) {
  if (!downloadLocation) return;

  const api = getClient();
  if (!api) return;

  try {
    // The download_location URL must be called with the access key.
    // unsplash-js handles auth automatically.
    const accessKey = process.env.UNSPLASH_ACCESS_KEY;
    await fetch(downloadLocation + (downloadLocation.includes('?') ? '&' : '?') + `client_id=${accessKey}`, {
      method: 'GET',
    });
  } catch (_err) {
    // Fire-and-forget: log but don't throw
    if (process.env.NODE_ENV !== 'production') {
      console.log('[unsplash] Download tracking failed:', _err.message);
    }
  }
}

module.exports = { isAvailable, search, trackDownload };
