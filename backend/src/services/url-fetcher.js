'use strict';

const dns = require('node:dns');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');

// ---------------------------------------------------------------------------
// Custom error for clean 422 responses
// ---------------------------------------------------------------------------
class UrlFetchError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UrlFetchError';
  }
}

// ---------------------------------------------------------------------------
// extractUrls — find http/https URLs in a string
// ---------------------------------------------------------------------------
function extractUrls(text) {
  if (!text || typeof text !== 'string') return [];
  const re = /https?:\/\/[^\s<>"')\]},]+/gi;
  return (text.match(re) || []).map((u) => u.replace(/[.,:;!?]+$/, ''));
}

// ---------------------------------------------------------------------------
// SSRF protection — block private / loopback addresses
// ---------------------------------------------------------------------------
function isPrivateIp(ip) {
  if (!ip) return true;
  // IPv6 loopback
  if (ip === '::1' || ip === '::ffff:127.0.0.1') return true;
  // IPv4
  const parts = ip.replace('::ffff:', '').split('.').map(Number);
  if (parts.length !== 4) return true; // non-IPv4 we can't verify → block
  const [a, b] = parts;
  if (a === 10) return true;                      // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true;          // 192.168.0.0/16
  if (a === 169 && b === 254) return true;          // link-local
  if (a === 127) return true;                       // loopback
  if (a === 0) return true;                         // 0.0.0.0/8
  return false;
}

async function assertPublicHost(url) {
  const hostname = new URL(url).hostname;
  const { address } = await dns.promises.lookup(hostname);
  if (isPrivateIp(address)) {
    throw new UrlFetchError('URL verwijst naar een intern adres en kan niet opgehaald worden.');
  }
}

// ---------------------------------------------------------------------------
// fetchArticleContent — fetch + parse a single URL
// ---------------------------------------------------------------------------
const MAX_BODY_BYTES = 2 * 1024 * 1024; // 2 MB
const MAX_WORDS = 3000;
const MIN_CONTENT_CHARS = 200;

async function fetchArticleContent(url, timeoutMs = 10000) {
  // SSRF check
  await assertPublicHost(url);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'LightMarketingBot/1.0 (content enrichment)',
        Accept: 'text/html',
      },
    });
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new UrlFetchError(`Tijd verstreken bij ophalen van ${url}.`);
    }
    throw new UrlFetchError(`Kon ${url} niet bereiken: ${err.message}`);
  }
  clearTimeout(timer);

  if (!response.ok) {
    throw new UrlFetchError(`Server gaf foutcode ${response.status} voor ${url}.`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    throw new UrlFetchError(`URL is geen HTML-pagina (content-type: ${contentType}).`);
  }

  // Stream body with size limit
  const reader = response.body?.getReader();
  if (!reader) {
    throw new UrlFetchError(`Kon de inhoud van ${url} niet lezen.`);
  }

  const chunks = [];
  let totalBytes = 0;
  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.length;
      if (totalBytes > MAX_BODY_BYTES) {
        reader.cancel();
        throw new UrlFetchError(`Pagina is groter dan 2 MB en wordt niet verwerkt.`);
      }
      chunks.push(value);
    }
  } catch (err) {
    if (err instanceof UrlFetchError) throw err;
    throw new UrlFetchError(`Fout bij lezen van ${url}: ${err.message}`);
  }

  const html = Buffer.concat(chunks).toString('utf-8');

  // Parse with jsdom + Readability
  const dom = new JSDOM(html, { url });
  let article;
  try {
    const reader2 = new Readability(dom.window.document);
    article = reader2.parse();
  } finally {
    dom.window.close(); // prevent memory leaks
  }

  if (!article || !article.textContent || article.textContent.trim().length < MIN_CONTENT_CHARS) {
    throw new UrlFetchError('De pagina bevat te weinig leesbare tekst.');
  }

  let content = article.textContent.trim();

  // Truncate to MAX_WORDS
  const words = content.split(/\s+/);
  if (words.length > MAX_WORDS) {
    content = words.slice(0, MAX_WORDS).join(' ') + ' [Artikel ingekort voor verwerking]';
  }

  return {
    url,
    title: article.title || '',
    content,
  };
}

// ---------------------------------------------------------------------------
// contentFilter — best-effort prompt injection defense
// ---------------------------------------------------------------------------
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous/i,
  /system\s+prompt/i,
  /you\s+are\s+now/i,
  /output\s+the/i,
  /disregard/i,
  /forget\s+your\s+instructions/i,
];

function contentFilter(text) {
  if (!text || typeof text !== 'string') return text;
  return text
    .split('\n')
    .map((line) => {
      for (const pattern of INJECTION_PATTERNS) {
        if (pattern.test(line)) return '[content verwijderd]';
      }
      return line;
    })
    .join('\n');
}

// ---------------------------------------------------------------------------
// sanitizeTextField — strip zero-width chars, collapse whitespace
// ---------------------------------------------------------------------------
function sanitizeTextField(text) {
  if (!text || typeof text !== 'string') return text;
  return text
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ---------------------------------------------------------------------------
// enrichFormDataWithUrls — main entry point
// ---------------------------------------------------------------------------
async function enrichFormDataWithUrls(formData, fields = ['onderwerp', 'beschrijving']) {
  if (!formData || typeof formData !== 'object') return formData;

  // Collect URLs from specified fields
  const allUrls = [];
  for (const field of fields) {
    const value = formData[field];
    if (typeof value === 'string') {
      allUrls.push(...extractUrls(value));
    }
  }

  // Deduplicate
  const uniqueUrls = [...new Set(allUrls)];

  // No URLs → passthrough
  if (uniqueUrls.length === 0) return formData;

  // Check cache: if _cached_articles exists and URLs match, reuse
  if (Array.isArray(formData._cached_articles) && formData._cached_articles.length > 0) {
    const cachedUrls = formData._cached_articles.map((a) => a.url).sort();
    const currentUrls = [...uniqueUrls].sort();
    if (
      cachedUrls.length === currentUrls.length &&
      cachedUrls.every((u, i) => u === currentUrls[i])
    ) {
      return {
        ...formData,
        fetched_articles: formData._cached_articles,
        warnings: [],
        _cached_articles: formData._cached_articles,
      };
    }
  }

  // Fetch each URL
  const fetchedArticles = [];
  const warnings = [];

  for (const url of uniqueUrls) {
    try {
      const article = await fetchArticleContent(url);
      article.content = contentFilter(article.content);
      fetchedArticles.push(article);
    } catch (err) {
      warnings.push(`Artikel kon niet opgehaald worden van ${url}: ${err.message}`);
    }
  }

  // If ALL URLs failed, throw
  if (fetchedArticles.length === 0 && uniqueUrls.length > 0) {
    throw new UrlFetchError(
      `Geen enkel artikel kon opgehaald worden. ${warnings.join(' ')}`
    );
  }

  // Sanitize all string fields in formData
  const sanitized = {};
  for (const [key, value] of Object.entries(formData)) {
    sanitized[key] = typeof value === 'string' ? sanitizeTextField(value) : value;
  }

  return {
    ...sanitized,
    fetched_articles: fetchedArticles,
    warnings,
    _cached_articles: fetchedArticles,
  };
}

module.exports = {
  extractUrls,
  fetchArticleContent,
  contentFilter,
  sanitizeTextField,
  enrichFormDataWithUrls,
  UrlFetchError,
  // Exported for testing
  isPrivateIp,
};
