'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

// Configurable seams: connection state (integrations) and gateway result.
let connected = true;
let gatewayResult = { successCount: 1, failedCount: 0, rows: [{ channel: 'linkedin', status: 'success', externalId: 'buf1' }] };

const integrationsMock = {
  async getCredential() {
    return connected ? { access_token: 'token', metadata: {} } : null;
  },
};

const publishGatewayMock = {
  async publish() {
    return gatewayResult;
  },
  async expire() {
    return { attempted: 0 };
  },
};

const { setup, startServer, stopServer, makeClient, USERS } = require('../test-helpers/harness');

const APPROVED_DRAFT_ID = 'e0000000-0000-0000-0000-000000000001';

let server;
let store;
let client;
const cookies = {};

before(async () => {
  const configured = setup({ integrations: integrationsMock, publishGateway: publishGatewayMock });
  store = configured.store;

  // Ensure env-based credentials from the root .env do not mask the
  // disconnected case. Must run AFTER setup(): setup() loads the app, which
  // calls dotenv.config({ override: true }) at module load and repopulates
  // process.env from disk. Same pattern as harness.js:144 for JWT_SECRET.
  delete process.env.BUFFER_API_KEY;

  store.drafts.push({
    id: APPROVED_DRAFT_ID,
    type: 'marketing-post',
    status: 'approved',
    version: 1,
    form_data: { onderwerp: 'Test', kanalen: ['linkedin'] },
    linkedin_post: 'Hallo LinkedIn',
    image_path: '/uploads/social/x.png',
    created_by: USERS.owner.id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  const started = await startServer(configured.app);
  server = started.server;
  client = makeClient(started.baseUrl);

  const response = await client.login(USERS.owner.email);
  const setCookie = response.headers.get('set-cookie');
  cookies.owner = setCookie ? setCookie.split(';')[0] : null;
});

after(async () => {
  await stopServer(server);
});

test('13. publishing with no connected channels returns a Dutch 400', async () => {
  connected = false;
  client.setCookie(cookies.owner);
  const response = await client.request(`/api/publish/${APPROVED_DRAFT_ID}`, { method: 'POST' });
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.match(body.error, /Geen gekoppelde kanalen/);
  connected = true;
});

test('15. a successful publish marks the draft as published', async () => {
  connected = true;
  gatewayResult = { successCount: 1, failedCount: 0, rows: [{ channel: 'linkedin', status: 'success', externalId: 'buf1' }] };
  client.setCookie(cookies.owner);

  const response = await client.request(`/api/publish/${APPROVED_DRAFT_ID}`, { method: 'POST' });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true });

  const stored = store.drafts.find((d) => d.id === APPROVED_DRAFT_ID);
  assert.equal(stored.status, 'published');
});

test('15b. when every channel fails the draft is not published (400)', async () => {
  connected = true;
  gatewayResult = { successCount: 0, failedCount: 1, rows: [{ channel: 'linkedin', status: 'failed', error: 'Buffer weigerde' }] };
  client.setCookie(cookies.owner);

  // Reset status so this test is order-independent.
  const stored = store.drafts.find((d) => d.id === APPROVED_DRAFT_ID);
  stored.status = 'approved';

  const response = await client.request(`/api/publish/${APPROVED_DRAFT_ID}`, { method: 'POST' });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /Buffer weigerde/);
  assert.equal(stored.status, 'approved');
});

test('15c. scheduled publish keeps draft as approved (not published)', async () => {
  connected = true;
  gatewayResult = { successCount: 0, scheduledCount: 1, failedCount: 0, rows: [{ channel: 'linkedin', status: 'scheduled', scheduledFor: '2099-01-01T10:00:00Z' }] };
  client.setCookie(cookies.owner);

  const stored = store.drafts.find((d) => d.id === APPROVED_DRAFT_ID);
  stored.status = 'approved';

  const response = await client.request(`/api/publish/${APPROVED_DRAFT_ID}`, {
    method: 'POST',
    body: { schedulePerChannel: { linkedin: '2099-01-01T10:00' } },
  });
  assert.equal(response.status, 200);
  // Draft stays approved when all channels are scheduled (not yet live)
  assert.equal(stored.status, 'approved');
});

test('15d. partial channel failure: some succeed, some fail', async () => {
  connected = true;
  gatewayResult = {
    successCount: 1,
    failedCount: 1,
    rows: [
      { channel: 'linkedin', status: 'success', externalId: 'buf2' },
      { channel: 'facebook', status: 'failed', error: 'Kanaal niet gekoppeld' },
    ],
  };
  client.setCookie(cookies.owner);

  const stored = store.drafts.find((d) => d.id === APPROVED_DRAFT_ID);
  stored.status = 'approved';
  stored.form_data = { onderwerp: 'Test', kanalen: ['linkedin', 'facebook'] };

  const response = await client.request(`/api/publish/${APPROVED_DRAFT_ID}`, { method: 'POST' });
  // Partial success: at least one channel went live
  assert.equal(response.status, 200);
  assert.equal(stored.status, 'published');
});

test('15e. recruiter cannot publish (403)', async () => {
  const recruiterLogin = await client.login(USERS.recruiter.email);
  const recruiterCookie = recruiterLogin.headers.get('set-cookie')?.split(';')[0];
  client.setCookie(recruiterCookie);

  const response = await client.request(`/api/publish/${APPROVED_DRAFT_ID}`, { method: 'POST' });
  assert.equal(response.status, 403);
});

test('15f. retry-failed creates new publication rows for failed channels', async () => {
  connected = true;
  client.setCookie(cookies.owner);

  // Seed a failed publication row
  store.publications = store.publications || [];
  store.publications.push({
    id: 'pub-fail-1',
    draft_id: APPROVED_DRAFT_ID,
    channel: 'linkedin',
    via: 'buffer',
    status: 'failed',
    error_message: 'Rate limited',
    published_at: null,
    created_at: new Date().toISOString(),
  });

  // Reset gateway to succeed on retry
  gatewayResult = { successCount: 1, failedCount: 0, rows: [{ channel: 'linkedin', status: 'success', externalId: 'buf-retry' }] };

  const stored = store.drafts.find((d) => d.id === APPROVED_DRAFT_ID);
  stored.status = 'published';

  const response = await client.request(`/api/publish/${APPROVED_DRAFT_ID}/retry-failed`, { method: 'POST' });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.success, true);
  assert.equal(body.successCount, 1);
});
