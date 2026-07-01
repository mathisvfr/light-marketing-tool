const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const uploadsRoot = path.resolve(__dirname, '..', '..', 'uploads', 'social');
const libraryRoot = path.resolve(__dirname, '..', '..', 'uploads', 'library');

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function splitLines(text, maxLength) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxLength) {
      if (current) {
        lines.push(current);
      }
      current = word;
    } else {
      current = next;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines.slice(0, 6);
}

async function ensureUploadDir() {
  await fs.mkdir(uploadsRoot, { recursive: true });
}

async function ensureLibraryDir() {
  await fs.mkdir(libraryRoot, { recursive: true });
}

async function writeSvgFile(baseName, svg) {
  await ensureUploadDir();
  const fileName = `${baseName}-${crypto.randomUUID()}.svg`;
  const absolutePath = path.join(uploadsRoot, fileName);
  await fs.writeFile(absolutePath, svg, 'utf8');
  return `/uploads/social/${fileName}`;
}

function createMarketingSvg(fields) {
  const onderwerp = escapeXml(fields?.onderwerp || 'Light Personeelsdiensten');
  const subtitle = escapeXml(fields?.subtitle || 'Betrouwbare personeelsoplossingen');
  const captionLines = splitLines(fields?.caption || '', 46);

  const linesSvg = captionLines
    .map((line, index) => {
      const y = 260 + index * 42;
      return `<text x="64" y="${y}" fill="#f8fafc" font-size="34" font-family="Arial, sans-serif">${escapeXml(line)}</text>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0b1b32"/>
      <stop offset="100%" stop-color="#be1e2d"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="1200" fill="url(#bg)"/>
  <rect x="64" y="74" width="300" height="12" rx="6" fill="#f8fafc" fill-opacity="0.5"/>
  <text x="64" y="160" fill="#f8fafc" font-size="62" font-weight="700" font-family="Arial, sans-serif">${onderwerp}</text>
  <text x="64" y="210" fill="#e2e8f0" font-size="30" font-family="Arial, sans-serif">${subtitle}</text>
  ${linesSvg}
  <text x="64" y="1120" fill="#f8fafc" font-size="26" font-family="Arial, sans-serif">Light Personeelsdiensten</text>
</svg>`;
}

async function renderSocialImage(template, fields) {
  const safeTemplate = String(template || 'marketing').toLowerCase();
  if (safeTemplate !== 'marketing') {
    throw new Error('Onbekend image-template.');
  }

  const svg = createMarketingSvg(fields || {});
  return writeSvgFile('marketing', svg);
}

async function saveUploadedImageDataUrl(dataUrl) {
  const raw = String(dataUrl || '');
  const match = raw.match(/^data:(image\/(png|jpeg|jpg|webp));base64,(.+)$/i);

  if (!match) {
    throw new Error('Ongeldig afbeeldingformaat. Gebruik PNG, JPG of WEBP.');
  }

  const mime = match[1].toLowerCase();
  const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
  const buffer = Buffer.from(match[3], 'base64');

  if (buffer.length === 0) {
    throw new Error('Afbeelding is leeg.');
  }

  if (buffer.length > 5 * 1024 * 1024) {
    throw new Error('Afbeelding is te groot. Maximum is 5MB.');
  }

  await ensureUploadDir();
  const fileName = `upload-${crypto.randomUUID()}.${ext}`;
  const absolutePath = path.join(uploadsRoot, fileName);
  await fs.writeFile(absolutePath, buffer);

  return `/uploads/social/${fileName}`;
}

module.exports = {
  renderSocialImage,
  saveUploadedImageDataUrl,
  renderSvgToLibrary,
  saveDataUrlToLibrary,
};

async function renderSvgToLibrary(fields) {
  const svg = createMarketingSvg(fields || {});
  await ensureLibraryDir();
  const filename = `generated-${crypto.randomUUID()}.svg`;
  const absolutePath = path.join(libraryRoot, filename);
  const buffer = Buffer.from(svg, 'utf8');
  await fs.writeFile(absolutePath, buffer);
  return {
    filePath: `/uploads/library/${filename}`,
    filename,
    mimeType: 'image/svg+xml',
    fileSize: buffer.length,
  };
}

async function saveDataUrlToLibrary(dataUrl) {
  const raw = String(dataUrl || '');
  const match = raw.match(/^data:(image\/(png|jpeg|jpg|webp));base64,(.+)$/i);

  if (!match) {
    throw new Error('Ongeldig afbeeldingformaat. Gebruik PNG, JPG of WEBP.');
  }

  const mimeType = match[1].toLowerCase();
  const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
  const buffer = Buffer.from(match[3], 'base64');

  if (buffer.length === 0) {
    throw new Error('Afbeelding is leeg.');
  }

  if (buffer.length > 10 * 1024 * 1024) {
    throw new Error('Afbeelding is te groot. Maximum is 10MB.');
  }

  await ensureLibraryDir();
  const filename = `upload-${crypto.randomUUID()}.${ext}`;
  const absolutePath = path.join(libraryRoot, filename);
  await fs.writeFile(absolutePath, buffer);

  return {
    filePath: `/uploads/library/${filename}`,
    filename,
    mimeType,
    fileSize: buffer.length,
  };
}
