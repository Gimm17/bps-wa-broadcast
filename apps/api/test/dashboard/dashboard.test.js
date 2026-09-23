import crypto from 'node:crypto';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { pool } from '../../src/db/pool.js';
import { getDashboardSummary, getDashboardTrends, getHealthSummary } from '../../src/features/dashboard/repository.js';
import { enqueueMessage } from '../../src/db/queue.js';

describe('Operational Dashboard Aggregates & Invariants', () => {
  let testContactId, testTemplateId;

  beforeAll(async () => {
    const contactRes = await pool.query(`
      INSERT INTO contacts (type, name, phone_e164, status)
      VALUES ('employee', 'Dashboard Test', $1, 'active')
      ON CONFLICT (phone_e164) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `, [`+62812${Math.floor(10000000 + Math.random() * 90000000)}`]);
    testContactId = contactRes.rows[0].id;

    const tplRes = await pool.query(`
      INSERT INTO meta_templates (name, language, category, status, components)
      VALUES ($1, 'id', 'UTILITY', 'APPROVED', '[]'::jsonb)
      ON CONFLICT (name, language) DO UPDATE SET status = 'APPROVED'
      RETURNING id
    `, [`dash_tpl_${Date.now()}`]);
    testTemplateId = tplRes.rows[0].id;

    // Insert sample messages with various statuses
    const statuses = ['queued', 'sent', 'delivered', 'read', 'failed'];
    for (const st of statuses) {
      await enqueueMessage(pool, {
        contactId: testContactId,
        templateId: testTemplateId,
        idempotencyKey: `dash:${crypto.randomUUID()}`,
        status: st
      });
    }
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

  it('counts each message once at its latest aggregate status (invariant)', async () => {
    const summary = await getDashboardSummary(pool);
    expect(summary).toBeDefined();

    const sumOfStatuses =
      summary.queued +
      summary.sending +
      summary.sent +
      summary.delivered +
      summary.read +
      summary.failed +
      summary.cancelled +
      summary.suppressed;

    expect(summary.total).toBe(sumOfStatuses);
    expect(summary.total).toBeGreaterThanOrEqual(5);
  });

  it('computes 14-day trend series', async () => {
    const trends = await getDashboardTrends(pool, { days: 14 });
    expect(Array.isArray(trends)).toBe(true);
    expect(trends.length).toBeLessThanOrEqual(14);
  });

  it('evaluates health indicators for cron heartbeat, alerts, and integrations', async () => {
    const health = await getHealthSummary(pool);
    expect(health).toHaveProperty('cronStatus');
    expect(health).toHaveProperty('wabaStatus');
    expect(health).toHaveProperty('activeAlertsCount');
  });
});
