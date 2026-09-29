import crypto from 'node:crypto';

/**
 * Hash plaintext password using Node.js built-in scrypt (RFC 7914).
 * Zero external native dependencies, runs on any OS without compiling.
 * Format: $scrypt$<salt_hex>$<derived_key_hex>
 */
export function hashPassword(password) {
  return new Promise((resolve, reject) => {
    if (!password || typeof password !== 'string') {
      return reject(new Error('Password must be a non-empty string'));
    }
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`$scrypt$${salt}$${derivedKey.toString('hex')}`);
    });
  });
}

/**
 * Verify a password against a stored hash ($scrypt$ or legacy $argon2$).
 */
export async function verifyPassword(hash, password) {
  if (!hash || typeof hash !== 'string' || !password || typeof password !== 'string') {
    return false;
  }

  // Standard scrypt format
  if (hash.startsWith('$scrypt$')) {
    return new Promise((resolve) => {
      const parts = hash.split('$');
      const salt = parts[2];
      const expectedKeyHex = parts[3];
      if (!salt || !expectedKeyHex) return resolve(false);

      crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (err, derivedKey) => {
        if (err) return resolve(false);
        const expectedBuffer = Buffer.from(expectedKeyHex, 'hex');
        if (expectedBuffer.length !== derivedKey.length) return resolve(false);
        resolve(crypto.timingSafeEqual(expectedBuffer, derivedKey));
      });
    });
  }

  // Graceful fallback for legacy argon2 hashes if argon2 package is available
  if (hash.startsWith('$argon2')) {
    try {
      const argon2 = await import('argon2').then(m => m.default || m);
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  return false;
}
