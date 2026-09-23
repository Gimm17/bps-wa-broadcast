import { pool } from '../../db/pool.js';
import { maskPhoneNumber } from '@bps/shared';

export async function listMessageLogs(db = pool, {
  userRole = 'viewer',
  limit = 25,
  cursor = null,
  status = null,
  campaignId = null,
  search = null
} = {}) {
  const canViewSensitive = userRole !== 'viewer';
  let query = `
    SELECT 
      m.id,
      m.campaign_id,
      m.contact_id,
      m.template_id,
      m.idempotency_key,
      m.status,
      m.attempt_count,
      m.meta_message_id,
      m.last_error_code,
      m.last_error_message,
      m.created_at,
      m.updated_at,
      c.name as contact_name,
      c.phone_e164 as raw_phone,
      c.type as contact_type,
      mt.name as template_name,
      mt.language as template_language,
      cmp.title as campaign_title
    FROM messages m
    JOIN contacts c ON m.contact_id = c.id
    LEFT JOIN meta_templates mt ON m.template_id = mt.id
    LEFT JOIN campaigns cmp ON m.campaign_id = cmp.id
    WHERE 1=1
  `;
  const params = [];

  if (cursor) {
    params.push(cursor);
    query += ` AND m.created_at < $${params.length}`;
  }

  if (status) {
    params.push(status);
    query += ` AND m.status = $${params.length}`;
  }

  if (campaignId) {
    params.push(campaignId);
    query += ` AND m.campaign_id = $${params.length}`;
  }

  if (search) {
    params.push(`%${search}%`);
    query += ` AND (c.name ILIKE $${params.length} OR c.phone_e164 ILIKE $${params.length} OR m.meta_message_id ILIKE $${params.length})`;
  }

  params.push(limit + 1);
  query += ` ORDER BY m.created_at DESC LIMIT $${params.length}`;

  const { rows } = await db.query(query, params);

  const hasNextPage = rows.length > limit;
  const items = hasNextPage ? rows.slice(0, limit) : rows;
  const nextCursor = hasNextPage ? items[items.length - 1].created_at : null;

  const mapped = items.map((row) => ({
    ...row,
    phone_e164: maskPhoneNumber(row.raw_phone, canViewSensitive),
    raw_phone: undefined
  }));

  return { items: mapped, nextCursor };
}

export async function getMessageDetail(db = pool, messageId, { userRole = 'viewer' } = {}) {
  const canViewSensitive = userRole !== 'viewer';

  const { rows } = await db.query(`
    SELECT 
      m.*,
      c.name as contact_name,
      c.phone_e164 as raw_phone,
      c.type as contact_type,
      mt.name as template_name,
      mt.language as template_language,
      cmp.title as campaign_title
    FROM messages m
    JOIN contacts c ON m.contact_id = c.id
    LEFT JOIN meta_templates mt ON m.template_id = mt.id
    LEFT JOIN campaigns cmp ON m.campaign_id = cmp.id
    WHERE m.id = $1
  `, [messageId]);

  if (rows.length === 0) return null;

  const msg = rows[0];

  // Fetch ordered status events
  const { rows: events } = await db.query(`
    SELECT id, status, timestamp, raw_payload, created_at
    FROM message_status_events
    WHERE message_id = $1
    ORDER BY timestamp ASC, created_at ASC
  `, [messageId]);

  return {
    ...msg,
    phone_e164: maskPhoneNumber(msg.raw_phone, canViewSensitive),
    raw_phone: undefined,
    statusEvents: events
  };
}
