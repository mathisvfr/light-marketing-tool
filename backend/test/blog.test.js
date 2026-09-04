'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

let claudeMode = 'ok';
const claudeMock = {
  async generate(type) {
    if (claudeMode === 'throw') {
      throw new Error('AI-provider gaf geen geldige JSON terug.');
    }
    if (type === 'blog') {
      return {
        blog_titel: 'Test blogartikel over uitzendwerk',
        blog_html: '<h2>Kop</h2><p>Inhoud van het artikel.</p>',
        teaser: 'Korte samenvatting voor de overzichtspagina.',
        lead: 'Openingszin van het artikel.',
        meta_description: 'SEO beschrijving.',
        leestijd: '3 min',
      };
    }
    if (type === 'marketing-post') {
      return { linkedin_post: 'LI', facebook_post: 'FB', instagram_caption: 'IG' };
    }
    return {
      omschrijving_nl: 'NL tekst', functie_eisen: 'eisen',
      wat_wij_bieden: 'bieden', social_nl: 'social',
    };
  },
  async translateVacature(lang) {
    return { omschrijving: `vertaling ${lang}`, functie_eisen: `eisen ${lang}`, wat_wij_bieden: `bieden ${lang}`, social: `social ${lang}` };
  },
  async criticus() {
    return { passed: true, notes: 'ok' };
  },
  SUPPORTED_TRANSLATION_LANGS: ['pl', 'bg', 'sk', 'lv', 'en', 'hu', 'ro', 'uk'],
};

const { setup, startServer, stopServer, makeClient, USERS } = require('../test-helpers/harness');

const BLOG_DRAFT_ID = 'd0000000-0000-0000-0000-000000000020';

function seedDraft(store, overrides) {
  store.drafts.push({
    id: overrides.id,
    type: overrides.type || 'blog',
    status: overrides.status || 'draft',
    form_data: overrides.form_data || {},
    image_path: overrides.image_path || null,
    blog_titel: overrides.blog_titel || null,
    blog_html: overrides.blog_html || null,
    omschrijving_nl: null,
    sollicitatie_url: null,
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

  seedDraft(store, {
    id: BLOG_DRAFT_ID,
    type: 'blog',
    status: 'draft',
    created_by: USERS.owner.id,
    form_data: { onderwerp: 'Test blog', categorie: 'Uitzendwerk' },
  });

  const started = await startServer(configured.app);
  server = started.server;
  client = makeClient(started.baseUrl);

  await client.login(USERS.owner.email);
});

after(async () => {
  await stopServer(server);
});

// --- Type validation ---

test('1. normalizeDraftType accepts blog', async () => {
  const res = await client.request('/api/drafts', {
    method: 'POST',
    body: { type: 'blog', formData: { onderwerp: 'Nieuw blog', categorie: 'Bedrijfsnieuws' } },
  });
  assert.equal(res.status, 201, 'should create blog draft');
  const body = await res.json();
  assert.equal(body.draft.type, 'blog');
});

test('2. normalizeDraftType rejects unknown type', async () => {
  const res = await client.request('/api/drafts', {
    method: 'POST',
    body: { type: 'invalid-type', formData: { onderwerp: 'test' } },
  });
  assert.equal(res.status, 500, 'should reject unknown type');
});

// --- Blog generation ---

test('3. generate blog content', async () => {
  const res = await client.request(`/api/drafts/${BLOG_DRAFT_ID}/generate`, {
    method: 'POST',
    body: { formData: { onderwerp: 'Test blog', categorie: 'Uitzendwerk' } },
  });
  assert.equal(res.status, 200, 'should generate blog');
  const body = await res.json();
  assert.equal(body.draft.blog_titel, 'Test blogartikel over uitzendwerk');
  assert.ok(body.draft.blog_html.includes('<h2>'), 'blog_html should contain HTML headings');
  assert.ok(body.draft.form_data.teaser, 'form_data should contain teaser');
  assert.ok(body.draft.form_data.lead, 'form_data should contain lead');
  assert.ok(body.draft.form_data.slug, 'form_data should contain slug');
});

// --- Blog slug stability ---

test('4. blog slug is stable across regenerations', async () => {
  const getRes1 = await client.request(`/api/drafts/${BLOG_DRAFT_ID}`);
  const draft1 = (await getRes1.json()).draft;
  const slug1 = draft1.form_data.slug;
  assert.ok(slug1, 'slug should exist after generation');

  // Regenerate
  await client.request(`/api/drafts/${BLOG_DRAFT_ID}/generate`, {
    method: 'POST',
    body: { formData: { onderwerp: 'Ander onderwerp', categorie: 'Bedrijfsnieuws' } },
  });

  const getRes2 = await client.request(`/api/drafts/${BLOG_DRAFT_ID}`);
  const draft2 = (await getRes2.json()).draft;
  assert.equal(draft2.form_data.slug, slug1, 'slug should not change on regeneration');
});

// --- Website adapter ---

test('5. website adapter returns success for blog', async () => {
  const website = require('../src/services/channels/website');
  const result = await website.publish({ id: 'test-id', type: 'blog', status: 'approved' });
  assert.equal(result.status, 'success');
  assert.equal(result.externalId, 'test-id');
});

test('6. website adapter rejects non-blog types', async () => {
  const website = require('../src/services/channels/website');
  const result = await website.publish({ id: 'test-id', type: 'vacature', status: 'approved' });
  assert.equal(result.status, 'failed');
});

// --- Blog in content queue ---

test('8. blog drafts appear in content queue', async () => {
  const res = await client.request('/api/drafts');
  const body = await res.json();
  const blogDrafts = body.drafts.filter((d) => d.type === 'blog');
  assert.ok(blogDrafts.length > 0, 'should have at least one blog draft in queue');
});
