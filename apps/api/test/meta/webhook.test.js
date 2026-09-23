import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../../src/db/pool.js';
import {
  applyMetaStatus,
  ingestWebhook,
  getMessageStatusByMetaId,
  countWebhookEvents
} from '../../src/features/meta/webhook.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const statusFixturePath = path.resolve(__dirname, '../../../../tests/contract/meta/status-delivered.json');
const statusFixture = JSON.parse(fs.readFileSync(statusFixturePath, 'utf8'));

describe('Meta Webhook Ingestion & Monotonic Status', () => {
  let contactId;
  let templateId;
  let messageId;
  const metaMessageId = 'wamid.test.monotonic.1';

  beforeAll(async () => {
    const cRes = await pool.query(`
      INSERT INTO contacts (type, name, phone_e164, status)
      VALUES ('public', 'Penerima Webhook', $1, 'active')
      RETURNING id
    `, [`+62812${Math.floor(10000000 + Math.random() * 90000000)}`]);
    contactId = cRes.rows[0].id;

    const tRes = await pool.query(`
      INSERT INTO meta_templates (name, language, category, status, components)
      VALUES ($1, 'id', 'UTILITY', 'APPROVED', '[]'::jsonb)
      RETURNING id
    `, [`tmpl_meta_${Date.now()}`]);
    templateId = tRes.rows[0].id;

    const mRes = await pool.query(`
      INSERT INTO messages (
        contact_id, template_id, idempotency_key, payload, status, meta_message_id
      )
      VALUES ($1, $2, $3, '{}'::jsonb, 'sent', $4)
      RETURNING id
    `, [contactId, templateId, `idemp:${Date.now()}`, metaMessageId]);
    messageId = mRes.rows[0].id;
  });

  afterAll(async () => {
    if (messageId) {
      await pool.query('DELETE FROM message_status_events WHERE message_id = $1', [messageId]);
      await pool.query('DELETE FROM messages WHERE id = $1', [messageId]);
    }
    if (contactId) await pool.query('DELETE FROM contacts WHERE id = $1', [contactId]);
    if (templateId) await pool.query('DELETE FROM meta_templates WHERE id = $1', [templateId]);
    await pool.query("DELETE FROM webhook_events WHERE source = 'meta'");
  });

  it('does not regress delivered to sent when events arrive out of order', async () => {
    // 1. Event 'delivered' arrives at timestamp 20
    await applyMetaStatus({
      metaMessageId,
      status: 'delivered',
      timestamp: new Date(1759287620000),
      rawPayload: { event: 'delivered' }
    });
    expect(await getMessageStatusByMetaId(metaMessageId)).toBe('delivered');

    // 2. Delayed 'sent' event arrives with timestamp 10
    await applyMetaStatus({
      metaMessageId,
      status: 'sent',
      timestamp: new Date(1759287610000),
      rawPayload: { event: 'sent' }
    });

    // Monotonic guard: status must NOT regress to 'sent'
    expect(await getMessageStatusByMetaId(metaMessageId)).toBe('delivered');

    // Verify both status events were recorded in audit trail
    const eventsRes = await pool.query(`
      SELECT status FROM message_status_events
      WHERE message_id = $1
      ORDER BY timestamp ASC
    `, [messageId]);
    expect(eventsRes.rows.map(r => r.status)).toEqual(['sent', 'delivered']);
  });

  it('stores a duplicate webhook once', async () => {
    await ingestWebhook(statusFixture);
    await ingestWebhook(statusFixture);

    const count = await countWebhookEvents(statusFixture);
    expect(count).toBe(1);
  });
});
