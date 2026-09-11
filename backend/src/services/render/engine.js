const fs = require('node:fs/promises');
const path = require('node:path');
const templates = require('./templates');

const fontsDir = path.resolve(__dirname, '..', 'fonts');

// Allowed base directory for local image resolution. Any path that resolves
// outside this directory is rejected to prevent path traversal attacks.
const UPLOADS_BASE = path.resolve(__dirname, '..', '..', '..', 'uploads');

let fontsCache = null;

async function loadFonts() {
  if (fontsCache) return fontsCache;

  const fontFiles = [
    { name: 'Montserrat', file: 'Montserrat-Bold.ttf', weight: 700, style: 'normal' },
    { name: 'Montserrat', file: 'Montserrat-ExtraBold.ttf', weight: 800, style: 'normal' },
    { name: 'Montserrat', file: 'Montserrat-Black.ttf', weight: 900, style: 'normal' },
    { name: 'Open Sans', file: 'OpenSans-Regular.ttf', weight: 400, style: 'normal' },
    { name: 'Open Sans', file: 'OpenSans-SemiBold.ttf', weight: 600, style: 'normal' },
    { name: 'Open Sans', file: 'OpenSans-Bold.ttf', weight: 700, style: 'normal' },
  ];

  fontsCache = await Promise.all(
    fontFiles.map(async (f) => ({
      name: f.name,
      data: await fs.readFile(path.join(fontsDir, f.file)),
      weight: f.weight,
      style: f.style,
    }))
  );

  return fontsCache;
}

// Returns true if the hostname resolves to a private/reserved IP range.
// Prevents SSRF to internal services, cloud metadata endpoints, etc.
function isPrivateHost(hostname) {
  const blocked = [
    'localhost', '127.0.0.1', '0.0.0.0', '::1',
    'metadata.google.internal', '169.254.169.254',
  ];
  if (blocked.includes(hostname)) return true;
  // Block link-local and loopback ranges
  if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|127\.)/.test(hostname)) return true;
  return false;
}

async function resolveImageSrc(src) {
  if (!src) return null;

  // Already a data URI
  if (src.startsWith('data:')) return src;

  // Local path (e.g. /uploads/...)
  if (src.startsWith('/')) {
    const localPath = path.resolve(UPLOADS_BASE, '..', src.replace(/^\//, ''));

    // Path traversal guard: resolved path must stay within uploads/
    if (!localPath.startsWith(UPLOADS_BASE + path.sep) && localPath !== UPLOADS_BASE) {
      return null;
    }

    try {
      const buf = await fs.readFile(localPath);
      const ext = path.extname(localPath).toLowerCase();
      const mimeMap = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
      const mime = mimeMap[ext] || 'image/png';
      return 'data:' + mime + ';base64,' + buf.toString('base64');
    } catch {
      return null;
    }
  }

  // HTTP(S) URL — fetch and convert to data URI
  if (src.startsWith('http://') || src.startsWith('https://')) {
    try {
      const url = new URL(src);

      // SSRF guard: block private/internal hosts
      if (isPrivateHost(url.hostname)) {
        return null;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(src, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) return null;

      // Reject responses larger than 5 MB to prevent memory abuse
      const contentLength = res.headers.get('content-length');
      if (contentLength && parseInt(contentLength, 10) > 5 * 1024 * 1024) {
        return null;
      }

      const contentType = res.headers.get('content-type') || 'image/jpeg';
      const buf = Buffer.from(await res.arrayBuffer());

      // Double-check size after download (content-length can be absent/wrong)
      if (buf.length > 5 * 1024 * 1024) return null;

      return 'data:' + contentType.split(';')[0] + ';base64,' + buf.toString('base64');
    } catch {
      return null;
    }
  }

  return null;
}

async function renderToPng(templateName, fields) {
  const template = templates[templateName];
  if (!template) {
    throw new Error('Onbekend template: ' + templateName);
  }

  const { fn, width, height } = template;

  // Resolve photo sources to base64 data URIs
  const resolvedFields = { ...fields, width, height };
  if (resolvedFields.photoSrc) {
    resolvedFields.photoSrc = await resolveImageSrc(resolvedFields.photoSrc);
  }
  if (resolvedFields.logoSrc) {
    resolvedFields.logoSrc = await resolveImageSrc(resolvedFields.logoSrc);
  }

  const element = fn(resolvedFields);

  const fonts = await loadFonts();

  // Dynamic import for ESM-only satori
  const satori = (await import('satori')).default;
  const { Resvg } = await import('@resvg/resvg-js');

  const svg = await satori(element, { width, height, fonts });
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
  });
  const pngData = resvg.render();
  return pngData.asPng();
}

module.exports = { renderToPng, resolveImageSrc };
