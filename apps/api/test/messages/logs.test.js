import crypto from 'node:crypto';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { pool } from '../../src/db/pool.js';
import { listMessageLogs, getMessageDetail } from '../../src/features/messages/repository.js';
import { enqueueMessage } from '../../src/db/queue.js';

describe('Message Logs & Privacy Masking', () => {
  let testContactId, testTemplateId, testMessageId;
  const rawPhone = '+6281234567890';

  beforeAll(async () => {
    const contactRes = await pool.query(`
      INSERT INTO contacts (type, name, phone_e164, status)
      VALUES ('public', 'Privacy Log Recipient', $1, 'active')
      ON CONFLICT (phone_e164) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `, [rawPhone]);
    testContactId = contactRes.rows[0].id;

    const tplRes = await pool.query(`
      INSERT INTO meta_templates (name, language, category, status, components)
      VALUES ($1, 'id', 'UTILITY', 'APPROVED', '[]'::jsonb)
      ON CONFLICT (name, language) DO UPDATE SET status = 'APPROVED'
      RETURNING id
    `, [`log_tpl_${Date.now()}`]);
    testTemplateId = tplRes.rows[0].id;

    const msg = await enqueueMessage(pool, {
      contactId: testContactId,
      templateId: testTemplateId,
      idempotencyKey: `log-test:${crypto.randomUUID()}`,
      status: 'delivered'
    });
    testMessageId = msg.id;

    // Add status events
    await pool.query(`
      INSERT INTO message_status_events (message_id, status, timestamp, raw_payload)
      VALUES ($1, 'sent', now() - interval '2 minutes', '{"event":"sent"}'::jsonb),
             ($1, 'delivered', now() - interval '1 minute', '{"event":"delivered"}'::jsonb)
    `, [testMessageId]);
  });

  afterAll(async () => {
    if (testContactId) {
      await pool.query('DELETE FROM messages WHERE contact_id = $1', [testContactId]);
      await pool.query('DELETE FROM contacts WHERE id = $1', [testContactId]);
    }
    if (testTemplateId) {
      await pool.query('DELETE FROM meta_templates WHERE id = $1', [testTemplateId]);
    }
  });

  it('masks recipient phone numbers for viewer role', async () => {
    const result = await listMessageLogs(pool, {
      userRole: 'viewer',
      limit: 10
    });

    const target = result.items.find((m) => m.id === testMessageId);
    expect(target).toBeDefined();
    expect(target.phone_e164).toMatch(/^\+62•+7890$/);
  });

  it('returns unmasked phone numbers for admin roles', async () => {
    const result = await listMessageLogs(pool, {
      userRole: 'admin_diseminasi',
      limit: 10
    });

    const target = result.items.find((m) => m.id === testMessageId);
    expect(target).toBeDefined();
    expect(target.phone_e164).toBe(rawPhone);
  });

  it('returns chronological status events in message detail', async () => {
    const detail = await getMessageDetail(pool, testMessageId, { userRole: 'viewer' });
    expect(detail).toBeDefined();
    expect(detail.id).toBe(testMessageId);
    expect(detail.statusEvents).toBeDefined();
    expect(detail.statusEvents.length).toBeGreaterThanOrEqual(2);
    // Chronological order: first event should be earlier than second
    const t1 = new Date(detail.statusEvents[0].timestamp).getTime();
    const t2 = new Date(detail.statusEvents[1].timestamp).getTime();
    expect(t1).toBeLessThanOrEqual(t2);
  });
});
