const path = require('path');
require('dotenv').config({
  path: path.resolve(__dirname, '..', '..', '..', '.env'),
  override: true,
});

const bcrypt = require('bcryptjs');
const { supabase } = require('./client');

async function seedOwner() {
  const email = process.env.SEED_OWNER_EMAIL;
  const password = process.env.SEED_OWNER_PASSWORD;

  if (!email || !password) {
    throw new Error('SEED_OWNER_EMAIL of SEED_OWNER_PASSWORD ontbreekt in .env');
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const payload = {
    name: 'Owner',
    email,
    password_hash: passwordHash,
    role: 'owner',
  };

  const { error } = await supabase
    .from('users')
    .upsert(payload, { onConflict: 'email' });

  if (error) {
    throw error;
  }

  console.log(`Owner gebruiker is gezaaid voor ${email}`);
}

seedOwner().catch((error) => {
  console.error('Seeden mislukt:', error.message);
  process.exit(1);
});
