import crypto from 'node:crypto';

function getKeyBuffer(key) {
  const secret = key || process.env.APP_ENCRYPTION_KEY || 'bps-sulteng-default-encryption-key-2026';
  if (Buffer.isBuffer(secret) && secret.length === 32) {
    return secret;
  }
  // Derive 32-byte key via SHA-256
  return crypto.createHash('sha256').update(String(secret)).digest();
}

/**
 * Encrypts sensitive text using AES-256-GCM.
 * Output format: iv:authTag:ciphertext (hex encoded)
 */
export function encryptSecret(plaintext, key = null) {
  if (plaintext === null || plaintext === undefined) return null;
  const keyBuf = getKeyBuffer(key);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuf, iv);

  let encrypted = cipher.update(String(plaintext), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${tag}:${encrypted}`;
}

/**
 * Decrypts AES-256-GCM encrypted string.
 */
export function decryptSecret(encryptedPayload, key = null) {
  if (!encryptedPayload || typeof encryptedPayload !== 'string') return null;

  const parts = encryptedPayload.split(':');
  if (parts.length !== 3) {
    throw new Error('Format ciphertext tidak valid untuk dekripsi AES-256-GCM');
  }

  const [ivHex, tagHex, dataHex] = parts;
  const keyBuf = getKeyBuffer(key);
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuf, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(dataHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Masks sensitive credentials showing only prefix and suffix.
 */
export function maskSecret(str, visibleChars = 4) {
  if (!str || typeof str !== 'string') return '****';
  if (str.length <= visibleChars * 2) return '****';
  const prefix = str.slice(0, visibleChars);
  const suffix = str.slice(-visibleChars);
  return `${prefix}********${suffix}`;
}
