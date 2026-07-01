const crypto = require('node:crypto');

const ENC_PREFIX = 'enc:v1:';
const ALGORITHM = 'aes-256-gcm';

function getKey() {
  const secret = process.env.CREDENTIALS_ENCRYPTION_KEY;

  if (!secret || !String(secret).trim()) {
    return null;
  }

  // Derive a stable 32-byte key from whatever the operator configured
  // (hex string, passphrase, etc.) so any non-empty value works.
  return crypto.createHash('sha256').update(String(secret), 'utf8').digest();
}

function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith(ENC_PREFIX);
}

function encryptValue(plaintext) {
  const key = getKey();

  if (!key) {
    throw new Error('CREDENTIALS_ENCRYPTION_KEY ontbreekt; kan gegevens niet versleutelen.');
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(String(plaintext), 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    ENC_PREFIX + iv.toString('base64'),
    authTag.toString('base64'),
    ciphertext.toString('base64'),
  ].join(':');
}

function decryptValue(value) {
  if (!isEncrypted(value)) {
    // Backward compatibility: values stored before encryption was enabled
    // are returned unchanged.
    return value;
  }

  const key = getKey();

  if (!key) {
    throw new Error('CREDENTIALS_ENCRYPTION_KEY ontbreekt; kan gegevens niet ontsleutelen.');
  }

  const withoutPrefix = value.slice(ENC_PREFIX.length);
  const [ivB64, tagB64, ctB64] = withoutPrefix.split(':');

  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(tagB64, 'base64');
  const ciphertext = Buffer.from(ctB64, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return plaintext.toString('utf8');
}

function isEncryptionConfigured() {
  return Boolean(getKey());
}

module.exports = {
  encryptValue,
  decryptValue,
  isEncrypted,
  isEncryptionConfigured,
};
