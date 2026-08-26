'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const { mockModule } = require('../test-helpers/harness');
const { createFakeSupabase } = require('../test-helpers/fakeSupabase');

const store = {
  drafts: [{ id: 'd1', image_path: '/uploads/social/keep-referenced.png' }],
  media_library: [{ id: 'm1', path: '/uploads/library/keep-known.png' }],
};
mockModule('../src/db/client', { supabase: createFakeSupabase(store) });

const cleanup = require('../src/services/cleanup');

const DAY_MS = 24 * 60 * 60 * 1000;
let socialDir;
let libraryDir;

async function writeFileWithAge(dir, name, ageDays) {
  const absolute = path.join(dir, name);
  await fs.writeFile(absolute, 'x');
  const when = new Date(Date.now() - ageDays * DAY_MS);
  await fs.utimes(absolute, when, when);
  return absolute;
}

before(async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cleanup-test-'));
  socialDir = path.join(root, 'social');
  libraryDir = path.join(root, 'library');
  await fs.mkdir(socialDir, { recursive: true });
  await fs.mkdir(libraryDir, { recursive: true });
});

after(async () => {
  await fs.rm(path.dirname(socialDir), { recursive: true, force: true });
});

test('social cleanup deletes old unreferenced images but keeps referenced and recent ones', async () => {
  await writeFileWithAge(socialDir, 'old-orphan.png', 120); // old + unreferenced -> delete
  await writeFileWithAge(socialDir, 'keep-referenced.png', 120); // old but referenced -> keep
  await writeFileWithAge(socialDir, 'recent-orphan.png', 5); // unreferenced but recent -> keep

  const deleted = await cleanup.cleanupSocialUploads({ retentionDays: 90, dir: socialDir });
  assert.equal(deleted, 1);

  const remaining = (await fs.readdir(socialDir)).sort();
  assert.deepEqual(remaining, ['keep-referenced.png', 'recent-orphan.png']);
});

test('library cleanup deletes orphan files but keeps known ones', async () => {
  await writeFileWithAge(libraryDir, 'keep-known.png', 200); // has a media_library row -> keep
  await writeFileWithAge(libraryDir, 'orphan.png', 1); // no row -> delete

  const deleted = await cleanup.cleanupOrphanLibrary({ dir: libraryDir });
  assert.equal(deleted, 1);

  const remaining = await fs.readdir(libraryDir);
  assert.deepEqual(remaining, ['keep-known.png']);
});
