import { pool } from './pool.js';

/**
 * Enqueue a message for sending.
 * Supports calling as enqueueMessage(input) or enqueueMessage(db, input).
 */
export async function enqueueMessage(clientOrInput, maybeInput) {
  const db = (maybeInput && typeof clientOrInput.query === 'function') ? clientOrInput : pool;
  const input = maybeInput || clientOrInput;

  const {
    campaignId = null,
    contactId,
    templateId,
    idempotencyKey,
    payload = {},
    availableAt = new Date(),
    status = 'queued'
  } = input;

  const { rows } = await db.query(`
    INSERT INTO messages (
      campaign_id,
      contact_id,
      template_id,
      idempotency_key,
      payload,
      available_at,
      status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `, [
    campaignId,
    contactId,
    templateId,
    idempotencyKey,
    JSON.stringify(payload),
    availableAt,
    status
  ]);

  return rows[0];
}

/**
 * Concurrently claim a batch of queued messages using PostgreSQL FOR UPDATE SKIP LOCKED.
 * Supports calling as claimMessageBatch(options) or claimMessageBatch(db, options).
 */
export async function claimMessageBatch(clientOrOptions, maybeOptions) {
  const db = (maybeOptions && typeof clientOrOptions.query === 'function') ? clientOrOptions : pool;
  const options = maybeOptions || clientOrOptions;
  const { workerId, limit = 10, leaseSeconds = 60 } = options;

  const { rows } = await db.query(`
    WITH candidates AS (
      SELECT id FROM messages
      WHERE status = 'queued' AND available_at <= now()
      ORDER BY created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT $1
    )
    UPDATE messages m
    SET status = 'sending',
        lease_owner = $2,
        lease_expires_at = now() + make_interval(secs => $3),
        updated_at = now()
    FROM candidates c
    WHERE m.id = c.id
    RETURNING m.*
  `, [limit, workerId, leaseSeconds]);

  return rows;
}
