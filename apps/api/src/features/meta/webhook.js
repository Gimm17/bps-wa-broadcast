import crypto from 'node:crypto';
import { pool } from '../../db/pool.js';
import { handleInboundCommand } from '../subscriptions/service.js';

const STATUS_RANKS = {
  queued: 10,
  sending: 20,
  sent: 30,
  delivered: 40,
  read: 50,
  failed: 60,
  cancelled: 70,
  suppressed: 80
};

/**
 * Verifies HMAC-SHA256 signature from Meta webhook request.
 */
export function verifyMetaSignature(rawBody, signatureHeader, appSecret) {
  if (!signatureHeader || !appSecret) return false;

  const parts = signatureHeader.split('=');
  if (parts.length !== 2 || parts[0] !== 'sha256') {
    return false;
  }

  const providedHash = parts[1];
  const expectedHash = crypto
    .createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex');

  const providedBuf = Buffer.from(providedHash, 'hex');
  const expectedBuf = Buffer.from(expectedHash, 'hex');

  if (providedBuf.length !== expectedBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(providedBuf, expectedBuf);
}

/**
 * Computes deterministic ID for deduplication of webhook payload.
 */
export function computeWebhookEventId(payload) {
  // If payload contains specific message or status ID, use that
  try {
    const entry = payload?.entry?.[0]?.changes?.[0]?.value;
    if (entry?.statuses?.[0]?.id) {
      return `meta:status:${entry.statuses[0].id}:${entry.statuses[0].status}:${entry.statuses[0].timestamp}`;
    }
    if (entry?.messages?.[0]?.id) {
      return `meta:msg:${entry.messages[0].id}:${entry.messages[0].timestamp}`;
    }
  } catch {
    // fallback to hash
  }

  const hash = crypto
    .createHash('sha256')
    .update(typeof payload === 'string' ? payload : JSON.stringify(payload))
    .digest('hex');
  return `meta:hash:${hash}`;
}

/**
 * Ingests raw Meta webhook, deduplicates, records audit event, and dispatches.
 */
export async function ingestWebhook(payload) {
  const eventId = computeWebhookEventId(payload);

  // 1. Deduplicate by unique event_id
  const insertRes = await pool.query(`
    INSERT INTO webhook_events (source, event_id, event_type, payload, status)
    VALUES ('meta', $1, 'messages_or_statuses', $2, 'received')
    ON CONFLICT (event_id) DO NOTHING
    RETURNING id
  `, [eventId, JSON.stringify(payload)]);

  if (insertRes.rows.length === 0) {
    // Duplicate webhook received, skip re-processing
    return { duplicate: true, eventId };
  }

  const webhookDbId = insertRes.rows[0].id;

  try {
    const changes = payload?.entry?.[0]?.changes || [];

    for (const change of changes) {
      const val = change?.value;
      if (!val) continue;

      // Handle delivery status updates
      if (Array.isArray(val.statuses)) {
        for (const st of val.statuses) {
          const timestamp = st.timestamp
            ? new Date(Number(st.timestamp) * 1000)
            : new Date();

          await applyMetaStatus({
            metaMessageId: st.id,
            status: st.status,
            timestamp,
            rawPayload: st
          });
        }
      }

      // Handle inbound user messages (commands)
      if (Array.isArray(val.messages)) {
        for (const msg of val.messages) {
          if (msg.type === 'text' && msg.text?.body) {
            const receivedAt = msg.timestamp
              ? new Date(Number(msg.timestamp) * 1000)
              : new Date();

            await handleInboundCommand({
              from: msg.from,
              text: msg.text.body,
              receivedAt
            });
          }
        }
      }
    }

    // Mark processed
    await pool.query(`
      UPDATE webhook_events
      SET status = 'processed', processed_at = now()
      WHERE id = $1
    `, [webhookDbId]);

    return { duplicate: false, eventId };
  } catch (err) {
    await pool.query(`
      UPDATE webhook_events
      SET status = 'failed'
      WHERE id = $1
    `, [webhookDbId]);
    throw err;
  }
}

/**
 * Monotonically advances message status while recording every status event.
 */
export async function applyMetaStatus({ metaMessageId, status, timestamp, rawPayload = {} }) {
  const msgRes = await pool.query(`
    SELECT id, status FROM messages WHERE meta_message_id = $1
  `, [metaMessageId]);

  const message = msgRes.rows[0];
  if (!message) {
    // Message may not be in DB yet or unknown
    return null;
  }

  // 1. Always record in append-only status event history
  await pool.query(`
    INSERT INTO message_status_events (message_id, status, timestamp, raw_payload)
    VALUES ($1, $2, $3, $4)
  `, [message.id, status, timestamp, JSON.stringify(rawPayload)]);

  // 2. Monotonic status check: prevent regression (e.g. delivered -> sent)
  const currentRank = STATUS_RANKS[message.status] || 0;
  const incomingRank = STATUS_RANKS[status] || 0;

  if (incomingRank > currentRank) {
    await pool.query(`
      UPDATE messages
      SET status = $2, updated_at = now()
      WHERE id = $1
    `, [message.id, status]);
  }

  return message.id;
}

/**
 * Helper for testing message status by Meta ID.
 */
export async function getMessageStatusByMetaId(metaMessageId) {
  const res = await pool.query(`
    SELECT status FROM messages WHERE meta_message_id = $1
  `, [metaMessageId]);
  return res.rows[0]?.status || null;
}

/**
 * Helper for testing webhook deduplication count.
 */
export async function countWebhookEvents(payload) {
  const eventId = computeWebhookEventId(payload);
  const res = await pool.query(`
    SELECT COUNT(*)::int as count FROM webhook_events WHERE event_id = $1
  `, [eventId]);
  return res.rows[0]?.count || 0;
}
