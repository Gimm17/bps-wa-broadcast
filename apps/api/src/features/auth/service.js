import crypto from 'node:crypto';
import { verifyPassword, hashPassword } from './hasher.js';
import * as authRepo from './repository.js';
import { recordAudit } from '../audit/service.js';
import { config } from '../../config.js';

export { hashPassword, verifyPassword };

export function generateCsrfToken(tokenHash, secret = config.SESSION_SECRET) {
  return crypto.createHmac('sha256', secret).update(tokenHash).digest('hex');
}

export function verifyCsrfToken(tokenHash, providedCsrf, secret = config.SESSION_SECRET) {
  if (!providedCsrf || typeof providedCsrf !== 'string') return false;
  const expected = generateCsrfToken(tokenHash, secret);
  if (providedCsrf.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(providedCsrf), Buffer.from(expected));
}

export async function login({ identifier, password, ipAddress = null, userAgent = null }) {
  if (!identifier || !password) {
    throw { status: 400, code: 'VALIDATION_ERROR', message: 'Identifier dan kata sandi wajib diisi' };
  }

  const user = await authRepo.findUserByIdentifier(identifier);
  if (!user || !user.is_active) {
    await recordAudit({
      action: 'user.login_failed',
      resourceType: 'user',
      resourceId: identifier,
      details: { reason: 'User not found or inactive' },
      ipAddress,
      userAgent
    });
    throw { status: 401, code: 'INVALID_CREDENTIALS', message: 'Email/username atau kata sandi tidak valid' };
  }

  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    await recordAudit({
      userId: user.id,
      action: 'user.login_locked',
      resourceType: 'user',
      resourceId: user.id,
      details: { lockedUntil: user.locked_until },
      ipAddress,
      userAgent
    });
    throw { status: 403, code: 'ACCOUNT_LOCKED', message: 'Akun Anda terkunci sementara karena percobaan login gagal berturut-turut. Silakan coba lagi nanti.' };
  }

  const isValidPassword = await verifyPassword(user.password_hash, password);
  if (!isValidPassword) {
    await authRepo.recordLoginFailure(user.id);
    await recordAudit({
      userId: user.id,
      action: 'user.login_failed',
      resourceType: 'user',
      resourceId: user.id,
      details: { reason: 'Invalid password' },
      ipAddress,
      userAgent
    });
    throw { status: 401, code: 'INVALID_CREDENTIALS', message: 'Email/username atau kata sandi tidak valid' };
  }

  // Login successful
  await authRepo.recordLoginSuccess(user.id);

  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await authRepo.createSession({
    userId: user.id,
    tokenHash,
    ipAddress,
    userAgent,
    expiresAt
  });

  const csrfToken = generateCsrfToken(tokenHash);

  await recordAudit({
    userId: user.id,
    action: 'user.login_success',
    resourceType: 'user',
    resourceId: user.id,
    details: { roles: user.roles },
    ipAddress,
    userAgent
  });

  const safeUser = {
    id: user.id,
    username: user.username,
    email: user.email,
    name: user.name,
    roles: user.roles,
    permissions: user.permissions
  };

  return {
    user: safeUser,
    sessionToken: token,
    csrfToken,
    expiresAt
  };
}

export async function logout({ sessionToken, ipAddress = null, userAgent = null }) {
  if (!sessionToken) return;

  const tokenHash = crypto.createHash('sha256').update(sessionToken).digest('hex');
  const deleted = await authRepo.deleteSessionByTokenHash(tokenHash);

  if (deleted) {
    await recordAudit({
      userId: deleted.user_id,
      action: 'user.logout',
      resourceType: 'session',
      resourceId: deleted.id,
      ipAddress,
      userAgent
    });
  }
}

export async function validateSession(sessionToken) {
  if (!sessionToken) return null;

  const tokenHash = crypto.createHash('sha256').update(sessionToken).digest('hex');
  const session = await authRepo.findSessionByTokenHash(tokenHash);

  if (!session) return null;

  // Background touch session
  authRepo.touchSession(session.sessionId).catch(() => {});

  const csrfToken = generateCsrfToken(tokenHash);

  return {
    user: session.user,
    session: {
      id: session.sessionId,
      tokenHash,
      expiresAt: session.expiresAt
    },
    csrfToken
  };
}
