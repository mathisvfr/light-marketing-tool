'use strict';

const { test, before } = require('node:test');
const assert = require('node:assert/strict');

const { mockModule } = require('../test-helpers/harness');
const { createFakeSupabase } = require('../test-helpers/fakeSupabase');

// Shared in-memory store; mutated per test before calling the feed service.
const store = { drafts: [] };
mockModule('../src/db/client', { supabase: createFakeSupabase(store) });

// Require AFTER the db/client mock is installed.
const feed = require('../src/services/feed');

function resetDrafts(rows) {
  store.drafts.length = 0;
  store.drafts.push(...rows);
}

function vacature(overrides) {
  return {
    id: overrides.id,
    type: 'vacature',
    status: overrides.status || 'actief',
    created_at: '2026-08-01T10:00:00.000Z',
    updated_at: '2026-08-01T10:00:00.000Z',
    form_data: overrides.form_data || {},
    titel: overrides.titel || 'Orderpicker',
    plaats: overrides.plaats || null,
    omschrijving_nl: overrides.omschrijving_nl || 'Werken in de logistiek.',
    omschrijving_pl: overrides.omschrijving_pl || null,
    functie_eisen: null,
    wat_wij_bieden: null,
    salaris: null,
    uren: null,
    contract: null,
    sollicitatie_url: null,
  };
}

before(() => {
  resetDrafts([]);
});

test('21. zero active vacatures yields valid, empty jobs XML', async () => {
  resetDrafts([]);
  const xml = await feed.generateJobsFeedXml();
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<jobs>/);
  assert.match(xml, /<\/jobs>/);
  assert.doesNotMatch(xml, /<job>/);
});

test('22. HTML in the description is wrapped in CDATA and never breaks the XML', async () => {
  resetDrafts([
    vacature({
      id: 'a1',
      plaats: 'Rotterdam',
      omschrijving_nl: '<p>Werken bij Light & co <b>nu</b></p> einde ]]> tekst',
    }),
  ]);

  const xml = await feed.generateJobsFeedXml();

  // Description content lives inside a CDATA section, so the raw HTML is carried
  // safely rather than as parsed XML elements.
  assert.match(xml, /<Omschrijving><!\[CDATA\[<p>Werken bij Light & co <b>nu<\/b><\/p>/);
  // A literal ]]> in the source is split so it cannot terminate CDATA early.
  assert.match(xml, /\]\]\]\]><!\[CDATA\[>/);
});

test('23. an invalid plaats falls back to a single place name (Rotterdam)', async () => {
  resetDrafts([
    vacature({ id: 'b1', form_data: { locatie: 'omgeving Rotterdam' } }),
    vacature({ id: 'b2', plaats: 'Rotterdam, Schiedam' }),
  ]);

  const xml = await feed.generateJobsFeedXml();
  const matches = xml.match(/<Plaats><!\[CDATA\[(.*?)\]\]><\/Plaats>/g) || [];
  assert.equal(matches.length, 2);
  for (const match of matches) {
    assert.match(match, /Rotterdam\]\]>/);
    assert.doesNotMatch(match, /omgeving|,/);
  }
});

test('24. only status=actief vacatures appear in the feed', async () => {
  resetDrafts([
    vacature({ id: 'c1', titel: 'Actieve baan', status: 'actief', plaats: 'Rotterdam' }),
    vacature({ id: 'c2', titel: 'Gesloten baan', status: 'expired', plaats: 'Rotterdam' }),
    vacature({ id: 'c3', titel: 'Concept baan', status: 'draft', plaats: 'Rotterdam' }),
  ]);

  const xml = await feed.generateJobsFeedXml();
  const jobCount = (xml.match(/<job>/g) || []).length;
  assert.equal(jobCount, 1);
  assert.match(xml, /Actieve baan/);
  assert.doesNotMatch(xml, /Gesloten baan|Concept baan/);
});
