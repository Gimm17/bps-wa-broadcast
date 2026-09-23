import crypto from 'node:crypto';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { pool } from '../../api/src/db/pool.js';
import { enqueueMessage } from '../../api/src/db/queue.js';
import { runOnce, recoverExpiredLeases } from '../src/run-once.js';

describe('Worker Concurrency, Advisory Locking & Lease Recovery', () => {
  let testContactId;
  let testTemplateId;

  beforeAll(async () => {
    const contactRes = await pool.query(`
      INSERT INTO contacts (type, name, phone_e164, status)
      VALUES ('employee', 'Concurrency Test', $1, 'active')
      ON CONFLICT (phone_e164) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `, [`+62812${Math.floor(10000000 + Math.random() * 90000000)}`]);
    testContactId = contactRes.rows[0].id;

    const templateRes = await pool.query(`
      INSERT INTO meta_templates (name, language, category, status, components)
      VALUES ($1, 'id', 'UTILITY', 'APPROVED', '[]'::jsonb)
      ON CONFLICT (name, language) DO UPDATE SET status = 'APPROVED'
      RETURNING id
    `, [`concurrency_tpl_${Date.now()}`]);
    testTemplateId = templateRes.rows[0].id;
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

  it('recovers expired leases back to queued status', async () => {
    const msg = await enqueueMessage(pool, {
      contactId: testContactId,
      templateId: testTemplateId,
      idempotencyKey: `expired-lease:${crypto.randomUUID()}`,
      status: 'sending'
    });

    // Manually set lease to past
    await pool.query(`
      UPDATE messages 
      SET lease_owner = 'dead-worker', 
          lease_expires_at = now() - interval '10 seconds'
      WHERE id = $1
    `, [msg.id]);

    const recoveredCount = await recoverExpiredLeases(pool);
    expect(recoveredCount).toBeGreaterThanOrEqual(1);

    const { rows } = await pool.query('SELECT status, lease_owner FROM messages WHERE id = $1', [msg.id]);
    expect(rows[0].status).toBe('queued');
    expect(rows[0].lease_owner).toBeNull();
  });

  it('prevents overlapping runs from executing simultaneously using advisory lock', async () => {
    let sendsCount = 0;
    const mockSend = async () => {
      sendsCount++;
      await new Promise((resolve) => setTimeout(resolve, 50));
      return { success: true, messageId: `mock_${Date.now()}` };
    };

    const runOptions = {
      db: pool,
      lockId: 987654321,
      batchSize: 5,
      maxRuntimeMs: 2000,
      safetyMarginMs: 200,
      customSender: mockSend
    };

    const results = await Promise.all([
      runOnce(runOptions),
      runOnce(runOptions)
    ]);

    // One should have acquired lock and completed (or skipped if no messages),
    // and the other should report locked / skipped
    const lockedCount = results.filter((r) => r.status === 'locked_by_other_instance').length;
    expect(lockedCount).toBe(1);
  });
});
