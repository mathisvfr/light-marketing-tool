'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

// Configurable Claude mock so a single test can force a generation failure while
// the rest use the happy path. The route destructures generate() at load time,
// but the function reads this mutable flag on each call.
let claudeMode = 'ok';
const claudeMock = {
  async generate(type) {
    if (claudeMode === 'throw') {
      throw new Error('AI-provider gaf geen geldige JSON terug.');
    }
    if (type === 'marketing-post') {
      return { linkedin_post: 'LI', facebook_post: 'FB', instagram_caption: 'IG' };
    }
    return {
      omschrijving_nl: 'NL tekst',
      functie_eisen: 'eisen',
      wat_wij_bieden: 'bieden',
      omschrijving_pl: null,
      social_nl: 'social',
      social_pl: null,
    };
  },
  async criticus() {
    return { passed: true, notes: 'ok' };
  },
};

const { setup, startServer, stopServer, makeClient, waitFor, USERS } = require('../test-helpers/harness');

const OWNER_DRAFT_ID = 'd0000000-0000-0000-0000-000000000010';
const RECRUITER_DRAFT_ID = 'd0000000-0000-0000-0000-000000000011';
const VACATURE_DRAFT_ID = 'd0000000-0000-0000-0000-000000000012';
const MARKETING_WITH_IMAGE_ID = 'd0000000-0000-0000-0000-000000000013';

function seedDraft(store, overrides) {
  store.drafts.push({
    id: overrides.id,
    type: overrides.type || 'vacature',
    status: overrides.status || 'draft',
    form_data: overrides.form_data || {},
    image_path: overrides.image_path || null,
    criticus_passed: null,
    criticus_notes: null,
    created_by: overrides.created_by,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

let server;
let store;
let client;
const cookies = {};

before(async () => {
  const configured = setup({ claude: claudeMock });
  store = configured.store;

  seedDraft(store, { id: OWNER_DRAFT_ID, type: 'marketing-post', status: 'pending_approval', created_by: USERS.owner.id, form_data: { onderwerp: 'Test', kanalen: ['linkedin'] } });
  seedDraft(store, { id: RECRUITER_DRAFT_ID, type: 'vacature', status: 'draft', created_by: USERS.recruiter.id });
  seedDraft(store, { id: VACATURE_DRAFT_ID, type: 'vacature', status: 'pending_approval', created_by: USERS.owner.id });
  seedDraft(store, { id: MARKETING_WITH_IMAGE_ID, type: 'marketing-post', status: 'draft', created_by: USERS.owner.id, image_path: '/uploads/social/mine.png', form_data: { onderwerp: 'Eigen foto', kanalen: ['instagram'] } });

  const started = await startServer(configured.app);
  server = started.server;
  client = makeClient(started.baseUrl);

  // Log in once per role (login is rate-limited to 10/15min), then switch by cookie.
  for (const role of ['owner', 'recruiter', 'viewer']) {
    const response = await client.login(USERS[role].email);
    const setCookie = response.headers.get('set-cookie');
    cookies[role] = setCookie ? setCookie.split(';')[0] : null;
  }
});

after(async () => {
  await stopServer(server);
});

test('1. viewer may not create a draft (403)', async () => {
  client.setCookie(cookies.viewer);
  const response = await client.request('/api/drafts', {
    method: 'POST',
    body: { type: 'vacature', formData: { functietitel: 'X' } },
  });
  assert.equal(response.status, 403);
});

test("2. recruiter may not edit another user's draft (403)", async () => {
  client.setCookie(cookies.recruiter);
  const response = await client.request(`/api/drafts/${OWNER_DRAFT_ID}`, {
    method: 'PUT',
    body: { status: 'draft' },
  });
  assert.equal(response.status, 403);
});

test("3. recruiter may not read another user's draft (403)", async () => {
  client.setCookie(cookies.recruiter);
  const response = await client.request(`/api/drafts/${OWNER_DRAFT_ID}`);
  assert.equal(response.status, 403);
  const body = await response.json();
  assert.equal(body.error, 'Je hebt geen toegang tot dit concept.');
});

test('4. non-owner may not approve (403)', async () => {
  client.setCookie(cookies.recruiter);
  const response = await client.request(`/api/drafts/${VACATURE_DRAFT_ID}/approve`, { method: 'POST' });
  assert.equal(response.status, 403);
});

test('5. non-owner may not reject (403)', async () => {
  client.setCookie(cookies.recruiter);
  const response = await client.request(`/api/drafts/${VACATURE_DRAFT_ID}/reject`, {
    method: 'POST',
    body: { comment: 'nope' },
  });
  assert.equal(response.status, 403);
});

test('6. generate on a missing draft returns 404', async () => {
  client.setCookie(cookies.owner);
  const response = await client.request('/api/drafts/00000000-0000-0000-0000-0000000000ff/generate', { method: 'POST' });
  assert.equal(response.status, 404);
  const body = await response.json();
  assert.equal(body.error, 'Concept niet gevonden.');
});

test('7. generation failure surfaces a Dutch error', async () => {
  client.setCookie(cookies.owner);
  const created = await client.request('/api/drafts', {
    method: 'POST',
    body: { type: 'vacature', formData: { functietitel: 'Faalt' } },
  });
  const { draft } = await created.json();

  claudeMode = 'throw';
  try {
    const response = await client.request(`/api/drafts/${draft.id}/generate`, { method: 'POST' });
    assert.equal(response.status, 500);
    const body = await response.json();
    assert.match(body.error, /JSON/);
  } finally {
    claudeMode = 'ok';
  }
});

test('8. approve: vacature -> actief, marketing-post -> approved', async () => {
  client.setCookie(cookies.owner);

  const vacatureResponse = await client.request(`/api/drafts/${VACATURE_DRAFT_ID}/approve`, { method: 'POST' });
  assert.equal(vacatureResponse.status, 200);
  assert.equal((await vacatureResponse.json()).draft.status, 'actief');

  const marketingResponse = await client.request(`/api/drafts/${OWNER_DRAFT_ID}/approve`, { method: 'POST' });
  assert.equal(marketingResponse.status, 200);
  assert.equal((await marketingResponse.json()).draft.status, 'approved');
});

test('9. reject stores the review comment on the draft', async () => {
  client.setCookie(cookies.owner);
  const response = await client.request(`/api/drafts/${MARKETING_WITH_IMAGE_ID}/reject`, {
    method: 'POST',
    body: { comment: 'Toon klopt niet' },
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).draft.status, 'rejected');

  const stored = store.drafts.find((d) => d.id === MARKETING_WITH_IMAGE_ID);
  assert.equal(stored.form_data.review_comment, 'Toon klopt niet');
});

test('10. recruiter deletes own draft (204) but not others (403)', async () => {
  client.setCookie(cookies.recruiter);

  const ownResponse = await client.request(`/api/drafts/${RECRUITER_DRAFT_ID}`, { method: 'DELETE' });
  assert.equal(ownResponse.status, 204);

  const otherResponse = await client.request(`/api/drafts/${VACATURE_DRAFT_ID}`, { method: 'DELETE' });
  assert.equal(otherResponse.status, 403);
});

test('11. image-override is owner-only and marketing-post-only', async () => {
  client.setCookie(cookies.recruiter);
  const recruiterResponse = await client.request(`/api/drafts/${VACATURE_DRAFT_ID}/image-override`, {
    method: 'POST',
    body: { dataUrl: 'data:image/png;base64,AAAA' },
  });
  assert.equal(recruiterResponse.status, 403);

  client.setCookie(cookies.owner);
  const vacatureResponse = await client.request(`/api/drafts/${VACATURE_DRAFT_ID}/image-override`, {
    method: 'POST',
    body: { dataUrl: 'data:image/png;base64,AAAA' },
  });
  assert.equal(vacatureResponse.status, 400);
  assert.equal((await vacatureResponse.json()).error, 'Alleen marketingposts hebben een social afbeelding.');
});

test('12. generate preserves a user-supplied image (skips Satori render)', async () => {
  client.setCookie(cookies.owner);
  const response = await client.request(`/api/drafts/${MARKETING_WITH_IMAGE_ID}/generate`, { method: 'POST' });
  assert.equal(response.status, 200);

  // Wait for the background criticus/render task to settle, then confirm the
  // pre-uploaded image path was NOT overwritten by the render mock.
  const settled = await waitFor(async () => {
    const detail = await client.request(`/api/drafts/${MARKETING_WITH_IMAGE_ID}`);
    const body = await detail.json();
    return typeof body.draft.criticus_passed === 'boolean' ? body.draft : null;
  });

  assert.ok(settled, 'criticus should resolve');
  assert.equal(settled.image_path, '/uploads/social/mine.png');
});
