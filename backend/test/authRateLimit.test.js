'use strict';

// Isolated in its own file: this test intentionally exhausts the login rate
// limiter, so it must not share a process with other auth tests.

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const { setup, startServer, stopServer, makeClient, USERS } = require('../test-helpers/harness');

let server;
let client;

before(async () => {
  const configured = setup();
  const started = await startServer(configured.app);
  server = started.server;
  client = makeClient(started.baseUrl);
});

after(async () => {
  await stopServer(server);
});

test('20. login rate limit returns a Dutch 429 after repeated attempts', async () => {
  let limited = null;

  for (let attempt = 0; attempt < 15; attempt += 1) {
    const response = await client.request('/api/auth/login', {
      method: 'POST',
      body: { email: USERS.owner.email, password: 'fout-wachtwoord' },
    });
    if (response.status === 429) {
      limited = response;
      break;
    }
  }

  assert.ok(limited, 'expected a 429 within 15 attempts');
  const body = await limited.json();
  assert.equal(body.error, 'Te veel inlogpogingen. Probeer het later opnieuw.');
});
