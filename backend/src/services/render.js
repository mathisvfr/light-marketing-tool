const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { renderToPng } = require('./render/engine');

const uploadsRoot = path.resolve(__dirname, '..', 'uploads', 'social');
const libraryRoot = path.resolve(__dirname, '..', 'uploads', 'library');

async function ensureUploadDir() {
  await fs.mkdir(uploadsRoot, { recursive: true });
}

async function ensureLibraryDir() {
  await fs.mkdir(libraryRoot, { recursive: true });
}

async function renderSocialImage(template, fields) {
  const pngBuffer = await renderToPng(template, fields || {});

  await ensureUploadDir();
  const fileName = `${template}-${crypto.randomUUID()}.png`;
  const absolutePath = path.join(uploadsRoot, fileName);
  await fs.writeFile(absolutePath, pngBuffer);

  return `/uploads/social/${fileName}`;
}

async function renderSvgToLibrary(fields) {
  const pngBuffer = await renderToPng('statement', fields || {});

  await ensureLibraryDir();
  const filename = `generated-${crypto.randomUUID()}.png`;
  const absolutePath = path.join(libraryRoot, filename);
  await fs.writeFile(absolutePath, pngBuffer);

  return {
    filePath: `/uploads/library/${filename}`,
    filename,
    mimeType: 'image/png',
    fileSize: pngBuffer.length,
  };
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

module.exports = {
  renderSocialImage,
  saveUploadedImageDataUrl,
  renderSvgToLibrary,
  saveDataUrlToLibrary,
};
