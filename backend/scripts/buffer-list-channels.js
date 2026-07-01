#!/usr/bin/env node
// Temporary script to list Buffer channels and get their IDs
// Run: node scripts/buffer-list-channels.js

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

(async () => {
  const key = process.env.BUFFER_API_KEY;
  const url = process.env.BUFFER_API_URL || 'https://api.buffer.com';

  if (!key) {
    console.error('BUFFER_API_KEY not set');
    process.exit(1);
  }

  // 1. Get organization ID
  const accountQuery = 'query{account{id name organizations{id name}}}';
  const accountRes = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: accountQuery }),
  });
  const accountData = await accountRes.json();
  const orgId = accountData?.data?.account?.organizations?.[0]?.id;

  if (!orgId) {
    console.error('Could not find organization ID');
    console.log(JSON.stringify(accountData, null, 2));
    process.exit(1);
  }

  console.log('Organization ID:', orgId);

  // 2. List channels
  const channelsQuery = `query { channels(input: { organizationId: "${orgId}" }) { id name service } }`;
  const channelsRes = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: channelsQuery }),
  });
  const channelsData = await channelsRes.json();

  if (channelsData.errors) {
    console.error('Errors:', JSON.stringify(channelsData.errors, null, 2));
    process.exit(1);
  }

  const channels = channelsData?.data?.channels || [];
  console.log(`\nFound ${channels.length} channel(s):\n`);

  channels.forEach(ch => {
    console.log(`  ${ch.service}`);
    console.log(`    Name: ${ch.name}`);
    console.log(`    ID:   ${ch.id}`);
    console.log();
  });

  console.log('--- Add to .env ---');
  channels.forEach(ch => {
    const svc = (ch.service || '').toLowerCase();
    if (svc === 'linkedin') console.log(`BUFFER_LINKEDIN_CHANNEL_ID=${ch.id}`);
    if (svc === 'facebook') console.log(`BUFFER_FACEBOOK_CHANNEL_ID=${ch.id}`);
    if (svc === 'instagram') console.log(`BUFFER_INSTAGRAM_CHANNEL_ID=${ch.id}`);
  });
})().catch(e => {
  console.error(e.message);
  process.exit(1);
});
