'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const { setup, startServer, stopServer, makeClient, USERS } = require('../test-helpers/harness');

const AUTH_COOKIE_NAME = 'light_auth_token';

let server;
let client;
const cookies = {};

before(async () => {
  const configured = setup();

  const started = await startServer(configured.app);
  server = started.server;
  client = makeClient(started.baseUrl);

  for (const role of ['owner', 'recruiter', 'viewer']) {
    const response = await client.login(USERS[role].email);
    const setCookie = response.headers.get('set-cookie');
    cookies[role] = setCookie ? setCookie.split(';')[0] : null;
  }
});

after(async () => {
  await stopServer(server);
});

test('17. an expired JWT is rejected in Dutch (401)', async () => {
  const expired = jwt.sign({ role: 'owner' }, 'test-secret', { subject: USERS.owner.id, expiresIn: -10 });
  client.setCookie(`${AUTH_COOKIE_NAME}=${expired}`);
  const response = await client.request('/api/auth/me');
  assert.equal(response.status, 401);
  const body = await response.json();
  assert.equal(body.error, 'Sessie is ongeldig of verlopen.');
});

test('17b. a garbage token is rejected in Dutch (401)', async () => {
  client.setCookie(`${AUTH_COOKIE_NAME}=not-a-real-token`);
  const response = await client.request('/api/auth/me');
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, 'Sessie is ongeldig of verlopen.');
});

test('18. a protected route without a cookie is rejected in Dutch (401)', async () => {
  client.clearCookie();
  const response = await client.request('/api/drafts');
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, 'Niet ingelogd.');
});

test('19. requireRole(owner) blocks recruiter and viewer (403)', async () => {
  const draftId = '00000000-0000-0000-0000-0000000000aa';

  client.setCookie(cookies.recruiter);
  const recruiterResponse = await client.request(`/api/publish/${draftId}`, { method: 'POST' });
  assert.equal(recruiterResponse.status, 403);

  client.setCookie(cookies.viewer);
  const viewerResponse = await client.request(`/api/publish/${draftId}`, { method: 'POST' });
  assert.equal(viewerResponse.status, 403);

  // The same route is reachable for an owner (fails later on a missing draft, not on role).
  client.setCookie(cookies.owner);
  const ownerResponse = await client.request(`/api/publish/${draftId}`, { method: 'POST' });
  assert.notEqual(ownerResponse.status, 403);
});
