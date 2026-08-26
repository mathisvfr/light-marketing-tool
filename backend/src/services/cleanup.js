'use strict';

// Disk cleanup for accumulated images. Satori renders and user uploads pile up in
// /uploads/social and /uploads/library over months of weekly content production
// with no TTL or reference counting. This removes what is safe to remove:
//   - /uploads/social: rendered/override images older than the retention window
//     that are NOT referenced by any draft.image_path.
//   - /uploads/library: files with NO media_library row (true orphans). Curated
//     library images are never TTL-expired.
// It never deletes a file that is still referenced by an active draft or library
// row, and social files are only removed once past the retention window.

const fs = require('node:fs/promises');
const path = require('node:path');
const { supabase } = require('../db/client');

const socialRoot = path.resolve(__dirname, '..', '..', 'uploads', 'social');
const libraryRoot = path.resolve(__dirname, '..', '..', 'uploads', 'library');

const DEFAULT_RETENTION_DAYS = 90;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function basenamesFromPaths(paths) {
  const set = new Set();
  for (const value of paths) {
    if (value && typeof value === 'string') {
      set.add(path.basename(value));
    }
  }
  return set;
}

async function listFiles(dir) {
  try {
    return await fs.readdir(dir);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return [];
    }
    throw err;
  }
}

// Remove rendered/override social images older than the retention window that are
// not referenced by any draft. Returns the number of files deleted.
async function cleanupSocialUploads({ retentionDays = DEFAULT_RETENTION_DAYS, now = Date.now(), dir = socialRoot } = {}) {
  const { data, error } = await supabase.from('drafts').select('image_path');
  if (error) {
    throw error;
  }

  const referenced = basenamesFromPaths((data || []).map((row) => row.image_path));
  const cutoff = now - retentionDays * 24 * 60 * 60 * 1000;

  const files = await listFiles(dir);
  let deleted = 0;

  for (const filename of files) {
    if (referenced.has(filename)) {
      continue;
    }

    const absolute = path.join(dir, filename);
    const stats = await fs.stat(absolute).catch(() => null);
    if (!stats || !stats.isFile()) {
      continue;
    }

    if (stats.mtimeMs < cutoff) {
      await fs.unlink(absolute).catch(() => {});
      deleted += 1;
    }
  }

  return deleted;
}

// Remove library files that have no media_library row (orphaned by a failed insert
// or a manual disk change). Returns the number of files deleted.
async function cleanupOrphanLibrary({ dir = libraryRoot } = {}) {
  const { data, error } = await supabase.from('media_library').select('path');
  if (error) {
    throw error;
  }

  const known = basenamesFromPaths((data || []).map((row) => row.path));
  const files = await listFiles(dir);
  let deleted = 0;

  for (const filename of files) {
    if (known.has(filename)) {
      continue;
    }

    const absolute = path.join(dir, filename);
    const stats = await fs.stat(absolute).catch(() => null);
    if (!stats || !stats.isFile()) {
      continue;
    }

    await fs.unlink(absolute).catch(() => {});
    deleted += 1;
  }

  return deleted;
}

async function runCleanup(options = {}) {
  const social = await cleanupSocialUploads(options);
  const library = await cleanupOrphanLibrary();

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[cleanup] ${social} social afbeeldingen en ${library} verweesde bibliotheekbestanden verwijderd.`);
  }

  return { social, library };
}

// Start a weekly background cleanup. No-op under tests. The timer is unref'd so it
// never keeps the process alive on its own.
function startCleanupSchedule(options = {}) {
  if (process.env.NODE_ENV === 'test') {
    return null;
  }

  const timer = setInterval(() => {
    runCleanup(options).catch((err) => {
      console.error('[cleanup] mislukt:', err?.message || err);
    });
  }, WEEK_MS);

  if (typeof timer.unref === 'function') {
    timer.unref();
  }

  return timer;
}

module.exports = {
  cleanupSocialUploads,
  cleanupOrphanLibrary,
  runCleanup,
  startCleanupSchedule,
};
