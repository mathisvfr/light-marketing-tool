'use strict';

// Shared test harness for the HTTP/route suites. Each test file runs in its own
// process under `node --test`, so mocking modules via the require cache here is
// isolated per file. Mirrors the setup pattern established in smoke.test.js.

const path = require('node:path');
const bcrypt = require('bcryptjs');
const { createFakeSupabase } = require('./fakeSupabase');

const PASSWORD = 'GeheimWachtwoord123';

const USERS = {
  owner: {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Test Owner',
    email: 'owner@example.com',
    role: 'owner',
  },
  recruiter: {
    id: '00000000-0000-0000-0000-000000000002',
    name: 'Test Recruiter',
    email: 'recruiter@example.com',
    role: 'recruiter',
  },
  viewer: {
    id: '00000000-0000-0000-0000-000000000003',
    name: 'Test Viewer',
    email: 'viewer@example.com',
    role: 'viewer',
  },
};

function mockModule(relativePath, exportsValue) {
  const resolved = require.resolve(relativePath);
  require.cache[resolved] = {
    id: resolved,
    filename: resolved,
    loaded: true,
    exports: exportsValue,
  };
}

// Default Claude mock — never hits a real AI provider.
function defaultClaudeMock() {
  return {
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
        social_nl: 'Test social NL',
      };
    },
    async translateVacature(lang) {
      return {
        omschrijving: `Vertaling omschrijving ${lang}`,
        functie_eisen: `Vertaling eisen ${lang}`,
        wat_wij_bieden: `Vertaling bieden ${lang}`,
        social: `Vertaling social ${lang}`,
      };
    },
    async criticus() {
      return { passed: true, notes: 'Goedgekeurd door mock-criticus.' };
    },
    SUPPORTED_TRANSLATION_LANGS: ['pl', 'bg', 'sk', 'lv', 'en', 'hu', 'ro', 'uk'],
  };
}

// Default render mock — never writes to disk or runs Satori.
function defaultRenderMock() {
  return {
    async renderSocialImage() {
      return '/uploads/social/mock.png';
    },
    async saveUploadedImageDataUrl() {
      return '/uploads/social/upload-mock.png';
    },
    async renderSvgToLibrary() {
      return {
        filePath: '/uploads/library/mock.png',
        filename: 'mock.png',
        mimeType: 'image/png',
        fileSize: 10,
      };
    },
    async saveDataUrlToLibrary() {
      return {
        filePath: '/uploads/library/upload-mock.png',
        filename: 'upload-mock.png',
        mimeType: 'image/png',
        fileSize: 10,
      };
    },
  };
}

function createStore(extra = {}) {
  return {
    users: Object.values(USERS).map((user) => ({
      ...user,
      password_hash: bcrypt.hashSync(PASSWORD, 8),
      created_at: new Date().toISOString(),
    })),
    drafts: [],
    publications: [],
    media_library: [],
    channel_credentials: [],
    brand_settings: [],
    ...extra,
  };
}

// Configure env + module mocks, then load the Express app. Returns the app plus
// the in-memory store so tests can seed rows and assert side effects.
function setup(options = {}) {
  process.env.NODE_ENV = 'test';
  process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
  process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'test-service-key';
  process.env.JWT_SECRET = 'test-secret';

  const store = createStore(options.store);

  mockModule('../src/db/client', { supabase: createFakeSupabase(store) });
  mockModule('../src/services/claude', options.claude || defaultClaudeMock());
  mockModule('../src/services/render', options.render || defaultRenderMock());

  if (options.publishGateway) {
    mockModule('../src/services/publishGateway', options.publishGateway);
  }
  if (options.integrations) {
    mockModule('../src/services/integrations', options.integrations);
  }

  const app = require(path.resolve(__dirname, '..', 'src', 'index.js'));
  // Re-assert after load: index.js loads a root .env with override:true.
  process.env.JWT_SECRET = 'test-secret';

  return { app, store, USERS, PASSWORD };
}

function startServer(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const { port } = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

function stopServer(server) {
  return new Promise((resolve) => server.close(resolve));
}

// Cookie-aware fetch client. login() captures the auth cookie for later calls.
function makeClient(baseUrl) {
  let cookie = null;

  async function request(pathname, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }
    if (cookie) {
      headers.Cookie = cookie;
    }
    return fetch(`${baseUrl}${pathname}`, {
      method: options.method || 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  }

  async function login(email, password = PASSWORD) {
    const response = await request('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      cookie = setCookie.split(';')[0];
    }
    return response;
  }

  return {
    request,
    login,
    setCookie(value) {
      cookie = value;
    },
    clearCookie() {
      cookie = null;
    },
  };
}

// Poll an async predicate until it returns a truthy value (for background tasks
// like the criticus/render updates that run after the generate response).
async function waitFor(predicate, { tries = 20, delay = 25 } = {}) {
  for (let attempt = 0; attempt < tries; attempt += 1) {
    const result = await predicate();
    if (result) {
      return result;
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  return null;
}

module.exports = {
  setup,
  startServer,
  stopServer,
  makeClient,
  waitFor,
  mockModule,
  defaultClaudeMock,
  defaultRenderMock,
  USERS,
  PASSWORD,
};
