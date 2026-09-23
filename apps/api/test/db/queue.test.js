import crypto from 'node:crypto';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { pool } from '../../src/db/pool.js';
import { enqueueMessage, claimMessageBatch } from '../../src/db/queue.js';

describe('Message Queue Primitives', () => {
  let testContactId;
  let testTemplateId;

  beforeAll(async () => {
    // Insert a test contact
    const contactRes = await pool.query(`
      INSERT INTO contacts (type, name, phone_e164, status)
      VALUES ('employee', 'Test Recipient', $1, 'active')
      ON CONFLICT (phone_e164) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `, [`+62812${Math.floor(10000000 + Math.random() * 90000000)}`]);
    testContactId = contactRes.rows[0].id;

    // Insert a test template
    const templateRes = await pool.query(`
      INSERT INTO meta_templates (name, language, category, status, components)
      VALUES ($1, 'id', 'UTILITY', 'APPROVED', '[]'::jsonb)
      ON CONFLICT (name, language) DO UPDATE SET status = 'APPROVED'
      RETURNING id
    `, [`test_template_${Date.now()}`]);
    testTemplateId = templateRes.rows[0].id;
  });

  afterAll(async () => {
    // Cleanup created test records
    if (testContactId) {
      await pool.query('DELETE FROM messages WHERE contact_id = $1', [testContactId]);
      await pool.query('DELETE FROM contacts WHERE id = $1', [testContactId]);
    }
    if (testTemplateId) {
      await pool.query('DELETE FROM meta_templates WHERE id = $1', [testTemplateId]);
    }
  });

  function messageFixture(overrides = {}) {
    return {
      contactId: testContactId,
      templateId: testTemplateId,
      idempotencyKey: `test:${crypto.randomUUID()}`,
      payload: { name: 'BPS Sulteng' },
      availableAt: new Date(Date.now() - 1000), // Ready now
      ...overrides
    };
  }

  it('prevents duplicate idempotency keys', async () => {
    const key = `attendance:2026-09-23:employee-42:in:${crypto.randomUUID()}`;
    const input = messageFixture({ idempotencyKey: key });

    const msg = await enqueueMessage(input);
    expect(msg.id).toBeTruthy();
    expect(msg.idempotency_key).toBe(key);

    await expect(enqueueMessage(input)).rejects.toMatchObject({ code: '23505' });
  });

  it('allows only one worker to claim a queued message', async () => {
    const input = messageFixture();
    await enqueueMessage(input);

    const [a, b] = await Promise.all([
      claimMessageBatch({ workerId: 'worker-a', limit: 20, leaseSeconds: 60 }),
      claimMessageBatch({ workerId: 'worker-b', limit: 20, leaseSeconds: 60 })
    ]);

    // Only one worker should have claimed this specific message
    const claimedIds = [...a, ...b].map((m) => m.idempotency_key);
    const matches = claimedIds.filter((k) => k === input.idempotencyKey);
    expect(matches).toHaveLength(1);
  });
});
