const APP_NAME = 'light_marketing_tool';
const BASE_URL = 'https://api.unsplash.com';

function isAvailable() {
  return Boolean(process.env.UNSPLASH_ACCESS_KEY);
}

function headers() {
  return {
    Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`,
    'Accept-Version': 'v1',
  };
}

async function search(query, { orientation, page = 1, perPage = 12 } = {}) {
  if (!isAvailable()) return { available: false, results: [], total: 0, total_pages: 0 };

  const params = new URLSearchParams({
    query,
    page: String(page),
    per_page: String(perPage),
    content_filter: 'high',
  });
  if (orientation) params.set('orientation', orientation);

  const response = await fetch(`${BASE_URL}/search/photos?${params.toString()}`, {
    headers: headers(),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Unsplash zoeken mislukt (${response.status}): ${body.slice(0, 200)}`);
  }

  const data = await response.json();
  return {
    available: true,
    results: (data.results || []).map(formatPhoto),
    total: data.total || 0,
    total_pages: data.total_pages || 0,
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
  if (!downloadLocation || !isAvailable()) return;

  try {
    await fetch(downloadLocation, { headers: headers() });
  } catch (_err) {
    // Fire-and-forget
  }
}

module.exports = { isAvailable, search, trackDownload };
