const APP_NAME = 'light_marketing_tool';
const BASE_URL = 'https://api.unsplash.com';

// In-memory cache: same query → same results for 15 minutes.
// Prevents the 50 req/hour demo limit from being burned by repeated searches.
const cache = new Map();
const CACHE_TTL = 15 * 60 * 1000;

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

  const cacheKey = `${query.toLowerCase().trim()}|${orientation || ''}|${page}|${perPage}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.data;
  }

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

  if (response.status === 403) {
    return { available: true, results: [], total: 0, total_pages: 0, rateLimited: true };
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Unsplash zoeken mislukt (${response.status}): ${body.slice(0, 200)}`);
  }

  const data = await response.json();
  const result = {
    available: true,
    results: (data.results || []).map(formatPhoto),
    total: data.total || 0,
    total_pages: data.total_pages || 0,
  };

  cache.set(cacheKey, { data: result, ts: Date.now() });

  // Evict old entries to avoid unbounded growth
  if (cache.size > 200) {
    const now = Date.now();
    for (const [k, v] of cache) {
      if (now - v.ts > CACHE_TTL) cache.delete(k);
    }
  }

  return result;
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
