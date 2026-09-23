import { pool } from '../../db/pool.js';

export async function findUserByIdentifier(identifier, client = null) {
  const db = client || pool;
  const { rows } = await db.query(`
    SELECT
      u.id,
      u.username,
      u.email,
      u.password_hash,
      u.name,
      u.is_active,
      u.failed_login_attempts,
      u.locked_until,
      u.last_login_at,
      u.created_at,
      COALESCE(array_agg(DISTINCT r.code) FILTER (WHERE r.code IS NOT NULL), '{}') AS roles,
      COALESCE(array_agg(DISTINCT p.code) FILTER (WHERE p.code IS NOT NULL), '{}') AS permissions
    FROM users u
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN roles r ON r.id = ur.role_id
    LEFT JOIN role_permissions rp ON rp.role_id = r.id
    LEFT JOIN permissions p ON p.id = rp.permission_id
    WHERE LOWER(u.email) = LOWER($1) OR LOWER(u.username) = LOWER($1)
    GROUP BY u.id
  `, [identifier]);

  return rows[0] || null;
}

export async function findUserById(userId, client = null) {
  const db = client || pool;
  const { rows } = await db.query(`
    SELECT
      u.id,
      u.username,
      u.email,
      u.name,
      u.is_active,
      u.last_login_at,
      u.created_at,
      COALESCE(array_agg(DISTINCT r.code) FILTER (WHERE r.code IS NOT NULL), '{}') AS roles,
      COALESCE(array_agg(DISTINCT p.code) FILTER (WHERE p.code IS NOT NULL), '{}') AS permissions
    FROM users u
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN roles r ON r.id = ur.role_id
    LEFT JOIN role_permissions rp ON rp.role_id = r.id
    LEFT JOIN permissions p ON p.id = rp.permission_id
    WHERE u.id = $1 AND u.is_active = true
    GROUP BY u.id
  `, [userId]);

  return rows[0] || null;
}

export async function recordLoginSuccess(userId, client = null) {
  const db = client || pool;
  await db.query(`
    UPDATE users
    SET failed_login_attempts = 0,
        locked_until = null,
        last_login_at = now(),
        updated_at = now()
    WHERE id = $1
  `, [userId]);
}

export async function recordLoginFailure(userId, client = null) {
  const db = client || pool;
  await db.query(`
    UPDATE users
    SET failed_login_attempts = failed_login_attempts + 1,
        locked_until = CASE
          WHEN failed_login_attempts + 1 >= 5 THEN now() + interval '15 minutes'
          ELSE locked_until
        END,
        updated_at = now()
    WHERE id = $1
  `, [userId]);
}

export async function createSession({ userId, tokenHash, ipAddress, userAgent, expiresAt }, client = null) {
  const db = client || pool;
  const { rows } = await db.query(`
    INSERT INTO sessions (user_id, token_hash, ip_address, user_agent, expires_at)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, token_hash, user_id, expires_at, created_at
  `, [userId, tokenHash, ipAddress, userAgent, expiresAt]);

  return rows[0];
}

export async function findSessionByTokenHash(tokenHash, client = null) {
  const db = client || pool;
  const { rows } = await db.query(`
    SELECT
      s.id AS session_id,
      s.token_hash,
      s.expires_at,
      s.created_at AS session_created_at,
      s.last_active_at,
      u.id AS user_id,
      u.username,
      u.email,
      u.name,
      u.is_active,
      COALESCE(array_agg(DISTINCT r.code) FILTER (WHERE r.code IS NOT NULL), '{}') AS roles,
      COALESCE(array_agg(DISTINCT p.code) FILTER (WHERE p.code IS NOT NULL), '{}') AS permissions
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN roles r ON r.id = ur.role_id
    LEFT JOIN role_permissions rp ON rp.role_id = r.id
    LEFT JOIN permissions p ON p.id = rp.permission_id
    WHERE s.token_hash = $1 AND s.expires_at > now() AND u.is_active = true
    GROUP BY s.id, u.id
  `, [tokenHash]);

  if (!rows[0]) return null;

  const r = rows[0];
  return {
    sessionId: r.session_id,
    tokenHash: r.token_hash,
    expiresAt: r.expires_at,
    lastActiveAt: r.last_active_at,
    user: {
      id: r.user_id,
      username: r.username,
      email: r.email,
      name: r.name,
      isActive: r.is_active,
      roles: r.roles,
      permissions: r.permissions
    }
  };
}

export async function touchSession(sessionId, client = null) {
  const db = client || pool;
  await db.query(`
    UPDATE sessions
    SET last_active_at = now()
    WHERE id = $1
  `, [sessionId]);
}

export async function deleteSessionByTokenHash(tokenHash, client = null) {
  const db = client || pool;
  const { rows } = await db.query(`
    DELETE FROM sessions
    WHERE token_hash = $1
    RETURNING id, user_id
  `, [tokenHash]);

  return rows[0] || null;
}
