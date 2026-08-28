'use strict';

// End-to-end flow verification (the automated half of the "End-to-end flow
// verification" TODO). Drives both content chains through the real routes and
// asserts every status transition, plus feed visibility for vacatures and
// per-channel publication for marketing posts.

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const publishGatewayMock = {
  async publish() {
    return { successCount: 1, failedCount: 0, rows: [{ channel: 'linkedin', status: 'success', externalId: 'buf-1' }] };
  },
  async expire() {
    return { attempted: 1 };
  },
};
const integrationsMock = {
  async getCredential() {
    return { access_token: 'token', metadata: {} };
  },
};

const { setup, startServer, stopServer, makeClient, waitFor, USERS } = require('../test-helpers/harness');

let server;
let store;
let client;

before(async () => {
  const configured = setup({ integrations: integrationsMock, publishGateway: publishGatewayMock });
  store = configured.store;
  const started = await startServer(configured.app);
  server = started.server;
  client = makeClient(started.baseUrl);
  await client.login(USERS.owner.email);
});

after(async () => {
  await stopServer(server);
});

async function generateAndSettle(draftId) {
  await client.request(`/api/drafts/${draftId}/generate`, { method: 'POST' });
  return waitFor(async () => {
    const response = await client.request(`/api/drafts/${draftId}`);
    const body = await response.json();
    return typeof body.draft.criticus_passed === 'boolean' ? body.draft : null;
  });
}

test('vacature flow: create -> generate -> submit -> approve -> feed -> close -> gone', async () => {
  // Create
  const createResponse = await client.request('/api/drafts', {
    method: 'POST',
    body: {
      type: 'vacature',
      formData: {
        functietitel: 'Heftruckchauffeur',
        locatie: 'Rotterdam',
        taal: 'NL',
        sollicitatie_url: 'https://light-personeelsdiensten.nl/solliciteren/heftruck',
      },
    },
  });
  assert.equal(createResponse.status, 201);
  const draftId = (await createResponse.json()).draft.id;

  // Generate + background criticus
  const generated = await generateAndSettle(draftId);
  assert.ok(generated, 'criticus should resolve');
  assert.equal(generated.omschrijving_nl, 'Gegenereerde vacaturetekst NL');

  // Edit a field
  await client.request(`/api/drafts/${draftId}`, {
    method: 'PUT',
    body: { omschrijving_nl: 'Aangepaste tekst', status: 'draft' },
  });

  // Submit -> pending_approval
  const submit = await client.request(`/api/drafts/${draftId}/submit`, { method: 'POST' });
  assert.equal((await submit.json()).draft.status, 'pending_approval');

  // Approve -> actief
  const approve = await client.request(`/api/drafts/${draftId}/approve`, { method: 'POST' });
  assert.equal((await approve.json()).draft.status, 'actief');

  // Appears in the XML feed
  const feedActief = await (await client.request('/feeds/jobs.xml')).text();
  assert.match(feedActief, /Heftruckchauffeur/);

  // Close the vacature -> expired, drops out of the feed
  const expire = await client.request(`/api/publish/${draftId}/expire`, { method: 'POST' });
  assert.equal(expire.status, 200);
  const stored = store.drafts.find((d) => d.id === draftId);
  assert.equal(stored.status, 'expired');

  const feedGone = await (await client.request('/feeds/jobs.xml')).text();
  assert.doesNotMatch(feedGone, /Heftruckchauffeur/);
});

test('marketing flow: create -> generate -> submit -> approve -> publish -> published', async () => {
  const createResponse = await client.request('/api/drafts', {
    method: 'POST',
    body: { type: 'marketing-post', formData: { onderwerp: 'SNA-certificering', kanalen: ['linkedin'] } },
  });
  assert.equal(createResponse.status, 201);
  const draftId = (await createResponse.json()).draft.id;

  const generated = await generateAndSettle(draftId);
  assert.ok(generated, 'criticus should resolve');
  assert.equal(generated.linkedin_post, 'Test LinkedIn-post');

  await client.request(`/api/drafts/${draftId}`, {
    method: 'PUT',
    body: { linkedin_post: 'Definitieve LinkedIn-tekst', status: 'draft' },
  });

  const submit = await client.request(`/api/drafts/${draftId}/submit`, { method: 'POST' });
  assert.equal((await submit.json()).draft.status, 'pending_approval');

  const approve = await client.request(`/api/drafts/${draftId}/approve`, { method: 'POST' });
  assert.equal((await approve.json()).draft.status, 'approved');

  const publish = await client.request(`/api/publish/${draftId}`, { method: 'POST' });
  assert.equal(publish.status, 200);
  assert.deepEqual(await publish.json(), { success: true });

  const stored = store.drafts.find((d) => d.id === draftId);
  assert.equal(stored.status, 'published');
});
