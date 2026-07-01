'use strict';

const path = require('node:path');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');

const { createFakeSupabase } = require('../test-helpers/fakeSupabase');

// --- Deterministic environment (must be set before requiring the app) ---
process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'test-service-key';
process.env.JWT_SECRET = 'test-smoke-secret';

const OWNER = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Test Owner',
  email: 'owner@example.com',
  role: 'owner',
  password: 'GeheimWachtwoord123',
};

// In-memory store shared with the fake Supabase client.
const store = {
  users: [
    {
      id: OWNER.id,
      name: OWNER.name,
      email: OWNER.email,
      role: OWNER.role,
      password_hash: bcrypt.hashSync(OWNER.password, 8),
      created_at: new Date().toISOString(),
    },
  ],
  drafts: [],
  publications: [],
};

// --- Mock external modules via the require cache BEFORE loading the app ---
function mockModule(relativePath, exportsValue) {
  const resolved = require.resolve(relativePath);
  require.cache[resolved] = {
    id: resolved,
    filename: resolved,
    loaded: true,
    exports: exportsValue,
  };
}

// Supabase (Postgres) — replace with the in-memory fake.
mockModule('../src/db/client', { supabase: createFakeSupabase(store) });

// Anthropic/Gemini/GreenPT generation — never hit a real AI provider in tests.
mockModule('../src/services/claude', {
  async generate(type) {
    if (type === 'marketing-post') {
      return {
        linkedin_post: 'Test LinkedIn-post',
        facebook_post: 'Test Facebook-post',
        instagram_caption: 'Test Instagram-caption',
      };
    }
    return {
      omschrijving_nl: 'Gegenereerde vacaturetekst NL',
      functie_eisen: 'Test functie-eisen',
      wat_wij_bieden: 'Test wat wij bieden',
      omschrijving_pl: null,
      social_nl: 'Test social NL',
      social_pl: null,
    };
  },
  async criticus() {
    return { passed: true, notes: 'Goedgekeurd door mock-criticus.' };
  },
});

// Now safe to load the configured Express app (it does not listen because
// require.main !== module in the test process).
const app = require(path.resolve(__dirname, '..', 'src', 'index.js'));
// Re-assert JWT secret in case a root .env overrode it at load time.
process.env.JWT_SECRET = 'test-smoke-secret';

let baseUrl;
let server;
let authCookie;

function apiRequest(pathname, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (authCookie) {
    headers.Cookie = authCookie;
  }
  return fetch(`${baseUrl}${pathname}`, {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
}

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const { port } = server.address();
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test('GET /api/health returns ok', async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body, { status: 'ok' });
});

test('login with seeded owner succeeds and sets an auth cookie', async () => {
  const response = await apiRequest('/api/auth/login', {
    method: 'POST',
    body: { email: OWNER.email, password: OWNER.password },
  });
  assert.equal(response.status, 200);

  const setCookie = response.headers.get('set-cookie');
  assert.ok(setCookie, 'login should set an auth cookie');
  authCookie = setCookie.split(';')[0];

  const body = await response.json();
  assert.equal(body.user.email, OWNER.email);
  assert.equal(body.user.role, 'owner');
});

test('login with wrong password is rejected in Dutch', async () => {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: OWNER.email, password: 'fout' }),
  });
  assert.equal(response.status, 401);
  const body = await response.json();
  assert.equal(body.error, 'Ongeldige inloggegevens.');
});

test('GET /api/auth/me returns the authenticated owner', async () => {
  const response = await apiRequest('/api/auth/me');
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.user.email, OWNER.email);
});

test('vacature draft: create, generate, submit, approve to actief', async () => {
  // Create
  const createResponse = await apiRequest('/api/drafts', {
    method: 'POST',
    body: {
      type: 'vacature',
      formData: { functietitel: 'Orderpicker', plaats: 'Rotterdam', taal: 'NL' },
    },
  });
  assert.equal(createResponse.status, 201);
  const { draft } = await createResponse.json();
  assert.ok(draft.id, 'created draft should have an id');
  assert.equal(draft.status, 'draft');

  // Generate (Claude mocked)
  const generateResponse = await apiRequest(`/api/drafts/${draft.id}/generate`, {
    method: 'POST',
  });
  assert.equal(generateResponse.status, 200);
  const generated = await generateResponse.json();
  assert.equal(generated.draft.omschrijving_nl, 'Gegenereerde vacaturetekst NL');
  assert.equal(generated.draft.criticus_passed, true);

  // Submit for approval
  const submitResponse = await apiRequest(`/api/drafts/${draft.id}/submit`, {
    method: 'POST',
  });
  assert.equal(submitResponse.status, 200);
  const submitted = await submitResponse.json();
  assert.equal(submitted.draft.status, 'pending_approval');

  // Approve -> vacature becomes 'actief' (moves toward published/live feed)
  const approveResponse = await apiRequest(`/api/drafts/${draft.id}/approve`, {
    method: 'POST',
  });
  assert.equal(approveResponse.status, 200);
  const approved = await approveResponse.json();
  assert.equal(approved.draft.status, 'actief');
});

test('unauthenticated request is rejected in Dutch', async () => {
  const response = await fetch(`${baseUrl}/api/auth/me`);
  assert.equal(response.status, 401);
  const body = await response.json();
  assert.equal(body.error, 'Niet ingelogd.');
});
