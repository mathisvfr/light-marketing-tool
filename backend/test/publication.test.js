'use strict';

const { test, before } = require('node:test');
const assert = require('node:assert/strict');

const { mockModule } = require('../test-helpers/harness');
const { createFakeSupabase } = require('../test-helpers/fakeSupabase');

const store = { publications: [] };
mockModule('../src/db/client', { supabase: createFakeSupabase(store) });

// Buffer publishes: linkedin succeeds, facebook fails — a partial failure.
mockModule('../src/services/channels/buffer', {
  async publish(_draft, channel) {
    if (channel === 'linkedin') {
      return { status: 'success', externalId: 'li-123', error: null };
    }
    return { status: 'failed', externalId: null, error: 'Buffer weigerde facebook' };
  },
});
mockModule('../src/services/channels/wordpress', {
  async publish() {
    return { status: 'failed', externalId: null, error: 'niet gebruikt' };
  },
});

const publication = require('../src/services/publication');

const draft = {
  id: 'f0000000-0000-0000-0000-000000000001',
  type: 'marketing-post',
  linkedin_post: 'LI',
  social_nl: 'FB',
  image_path: null,
  form_data: {},
};

before(() => {
  store.publications.length = 0;
});

test('14. a partial channel failure records one success and one failure', async () => {
  const result = await publication.publishDraft(draft, ['linkedin', 'facebook']);

  assert.equal(result.successCount, 1);
  assert.equal(result.failedCount, 1);

  const linkedin = result.rows.find((r) => r.channel === 'linkedin');
  const facebook = result.rows.find((r) => r.channel === 'facebook');
  assert.equal(linkedin.status, 'success');
  assert.equal(linkedin.externalId, 'li-123');
  assert.equal(facebook.status, 'failed');
  assert.match(facebook.error, /facebook/);

  // Per-channel publications rows were persisted.
  const rows = store.publications.filter((p) => p.draft_id === draft.id);
  assert.equal(rows.length, 2);
  assert.equal(rows.find((p) => p.channel === 'linkedin').external_id, 'li-123');
  assert.equal(rows.find((p) => p.channel === 'facebook').status, 'failed');
});

test('16. re-publishing (retry) writes a fresh set of publication rows', async () => {
  await publication.publishDraft(draft, ['linkedin', 'facebook']);
  const rows = store.publications.filter((p) => p.draft_id === draft.id);
  // Two from test 14 + two from this retry.
  assert.equal(rows.length, 4);
});
