'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

const { mockModule } = require('../test-helpers/harness');
const { createFakeSupabase } = require('../test-helpers/fakeSupabase');

// --- Module mocks (installed before requiring the services under test) ---
mockModule('../src/db/client', { supabase: createFakeSupabase({ brand_settings: [] }) });
mockModule('../src/services/prompts', {
  async loadPrompt() {
    return 'PROMPT';
  },
  async loadBrandKnowledge() {
    return 'BRAND';
  },
});
mockModule('../src/services/integrations', {
  async getCredential() {
    return null; // buffer falls back to env-based credentials
  },
});

const claude = require('../src/services/claude');
const buffer = require('../src/services/channels/buffer');
const render = require('../src/services/render');

const realFetch = global.fetch;

function queueFetch(responses) {
  let index = 0;
  const calls = { count: 0 };
  global.fetch = async () => {
    calls.count += 1;
    const spec = responses[Math.min(index, responses.length - 1)];
    index += 1;
    return {
      ok: spec.ok !== false,
      status: spec.status || 200,
      async json() {
        return spec.json;
      },
      async text() {
        return spec.text || '';
      },
    };
  };
  return calls;
}

after(() => {
  global.fetch = realFetch;
});

// ---------------------------------------------------------------------------
// 25. claude.generate — Anthropic provider + one retry on invalid JSON
// ---------------------------------------------------------------------------
test('25. generate retries once when the first response is not valid JSON', async () => {
  process.env.AI_PROVIDER = 'anthropic';
  process.env.ANTHROPIC_API_KEY = 'test-key';
  delete process.env.GREENPT_API_KEY;
  delete process.env.GOOGLE_AI_STUDIO_API_KEY;

  const calls = queueFetch([
    { json: { content: [{ type: 'text', text: 'dit is geen json' }] } },
    { json: { content: [{ type: 'text', text: '{"omschrijving_nl":"ok"}' }] } },
  ]);

  const result = await claude.generate('vacature', { functietitel: 'X' });
  assert.deepEqual(result, { omschrijving_nl: 'ok' });
  assert.equal(calls.count, 2, 'should have retried once');
});

test('25b. generate throws a Dutch error when JSON stays invalid', async () => {
  process.env.AI_PROVIDER = 'anthropic';
  process.env.ANTHROPIC_API_KEY = 'test-key';

  queueFetch([
    { json: { content: [{ type: 'text', text: 'nog steeds geen json' }] } },
    { json: { content: [{ type: 'text', text: 'ook niet' }] } },
  ]);

  await assert.rejects(() => claude.generate('vacature', {}), /geen geldige JSON/);
});

// ---------------------------------------------------------------------------
// 26. buffer.publish — maps success to external_id, MutationError to a message
// ---------------------------------------------------------------------------
test('26. buffer.publish maps a successful post to its external id', async () => {
  process.env.BUFFER_API_KEY = 'buffer-key';
  process.env.BUFFER_LINKEDIN_CHANNEL_ID = 'li-channel';

  queueFetch([
    { json: { data: { createPost: { __typename: 'PostActionSuccess', post: { id: 'buf-9' } } } } },
  ]);

  const result = await buffer.publish({ linkedin_post: 'Hallo' }, 'linkedin');
  assert.equal(result.status, 'success');
  assert.equal(result.externalId, 'buf-9');
});

test('26b. buffer.publish surfaces a MutationError message as a failure', async () => {
  process.env.BUFFER_API_KEY = 'buffer-key';
  process.env.BUFFER_LINKEDIN_CHANNEL_ID = 'li-channel';

  queueFetch([
    { json: { data: { createPost: { __typename: 'MutationError', message: 'Kanaal niet gekoppeld' } } } },
  ]);

  const result = await buffer.publish({ linkedin_post: 'Hallo' }, 'linkedin');
  assert.equal(result.status, 'failed');
  assert.equal(result.error, 'Kanaal niet gekoppeld');
});

// ---------------------------------------------------------------------------
// 27. render.saveUploadedImageDataUrl — validation + happy path
// ---------------------------------------------------------------------------
test('27. saveUploadedImageDataUrl rejects a non-image data URL', async () => {
  await assert.rejects(() => render.saveUploadedImageDataUrl('data:text/plain;base64,AAAA'), /Ongeldig afbeeldingformaat/);
});

test('27b. saveUploadedImageDataUrl rejects an empty image', async () => {
  await assert.rejects(() => render.saveUploadedImageDataUrl('data:image/png;base64,='), /leeg/);
});

test('27c. saveUploadedImageDataUrl rejects an image over 5MB', async () => {
  const big = Buffer.alloc(5 * 1024 * 1024 + 16).toString('base64');
  await assert.rejects(() => render.saveUploadedImageDataUrl(`data:image/png;base64,${big}`), /te groot/);
});

test('27d. saveUploadedImageDataUrl stores a valid PNG under /uploads/social', async () => {
  const onePixelPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );
  const dataUrl = `data:image/png;base64,${onePixelPng.toString('base64')}`;

  const result = await render.saveUploadedImageDataUrl(dataUrl);
  assert.match(result, /^\/uploads\/social\/upload-.*\.png$/);

  // Clean up the file this test wrote.
  const absolute = path.resolve(__dirname, '..', 'uploads', 'social', path.basename(result));
  await fs.unlink(absolute).catch(() => {});
});
