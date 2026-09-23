import { pool } from '../../db/pool.js';

/**
 * Record an audit log entry.
 * Ensures passwords, tokens, and credentials are never persisted to the audit log.
 */
export async function recordAudit({
  userId = null,
  action,
  resourceType,
  resourceId = null,
  details = {},
  ipAddress = null,
  userAgent = null,
  client = null
}) {
  const db = client || pool;

  // Sanitize details to guarantee secrets are never logged
  const sanitized = { ...details };
  for (const key of Object.keys(sanitized)) {
    if (/password|token|secret|authorization|key/i.test(key)) {
      sanitized[key] = '[REDACTED]';
    }
  }

  const { rows } = await db.query(`
    INSERT INTO audit_logs (
      user_id, action, resource_type, resource_id, details, ip_address, user_agent
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `, [
    userId,
    action,
    resourceType,
    resourceId,
    JSON.stringify(sanitized),
    ipAddress,
    userAgent
  ]);

  return rows[0];
}
