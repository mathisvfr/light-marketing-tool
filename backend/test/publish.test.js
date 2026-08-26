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
  // Ensure env-based credentials from a root .env do not mask the disconnected case.
  delete process.env.BUFFER_API_KEY;
  delete process.env.WORDPRESS_API_URL;
  delete process.env.WORDPRESS_USERNAME;
  delete process.env.WORDPRESS_APP_PASSWORD;

  const configured = setup({ integrations: integrationsMock, publishGateway: publishGatewayMock });
  store = configured.store;

  store.drafts.push({
    id: APPROVED_DRAFT_ID,
    type: 'marketing-post',
    status: 'approved',
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
