import crypto from 'node:crypto';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { pool } from '../../src/db/pool.js';
import { processTriggerEvent } from '../../src/features/automations/service.js';

describe('Event Ingestion & Deduplication Safety', () => {
  let testContactId, testTemplateId;

  beforeAll(async () => {
    const contactRes = await pool.query(`
      INSERT INTO contacts (type, name, phone_e164, status)
      VALUES ('employee', 'PIC Dedup Test', '+6281299998888', 'active')
      ON CONFLICT (phone_e164) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `);
    testContactId = contactRes.rows[0].id;

    await pool.query(`
      INSERT INTO employee_profiles (contact_id, nip, unit_kerja, jabatan)
      VALUES ($1, '198801012011011005', 'IPDS', 'Statistisi')
      ON CONFLICT (contact_id) DO UPDATE SET nip = EXCLUDED.nip
    `, [testContactId]);

    const tplRes = await pool.query(`
      INSERT INTO meta_templates (name, language, category, status, components)
      VALUES ('tpl_dedup_test', 'id', 'UTILITY', 'APPROVED', '[]'::jsonb)
      ON CONFLICT (name, language) DO UPDATE SET status = 'APPROVED'
      RETURNING id
    `);
    testTemplateId = tplRes.rows[0].id;
  });

  afterAll(async () => {
    if (testContactId) {
      await pool.query('DELETE FROM employee_profiles WHERE contact_id = $1', [testContactId]);
      await pool.query('DELETE FROM messages WHERE contact_id = $1', [testContactId]);
      await pool.query('DELETE FROM contacts WHERE id = $1', [testContactId]);
    }
    if (testTemplateId) {
      await pool.query('DELETE FROM meta_templates WHERE id = $1', [testTemplateId]);
    }
    await pool.query("DELETE FROM trigger_events WHERE source IN ('silastik_pst', 'publikasi_diseminasi')");
  });

  it('deduplicates repeated Silastik transaction events with the same transaction number', async () => {
    const event = {
      source: 'silastik_pst',
      eventType: 'new_transaction',
      externalId: 'PST-2026-TEST-001',
      payload: {
        transactionNumber: 'PST-2026-TEST-001',
        serviceType: 'Konsultasi Statistik',
        picNip: '198801012011011005',
        applicantName: 'Dinas Kesehatan Sulteng'
      }
    };

    // First ingestion -> processed and enqueued
    const firstRes = await processTriggerEvent(pool, event, { templateId: testTemplateId });
    expect(firstRes.status).toBe('processed');
    expect(firstRes.enqueued).toBe(true);

    // Second ingestion with identical source and externalId -> deduplicated
    const secondRes = await processTriggerEvent(pool, event, { templateId: testTemplateId });
    expect(secondRes.status).toBe('duplicate_ignored');
    expect(secondRes.enqueued).toBe(false);

    // Confirm in DB only 1 message was created for this transaction
    const { rows: msgs } = await pool.query(`
      SELECT id FROM messages 
      WHERE idempotency_key LIKE 'silastik%:PST-2026-TEST-001:%'
    `);
    expect(msgs).toHaveLength(1);
  });

  it('deduplicates repeated publication release events with the same milestone', async () => {
    const event = {
      source: 'publikasi_diseminasi',
      eventType: 'milestone_reminder',
      externalId: 'PUB-7200-2026-TEST:H-14',
      payload: {
        publicationId: 'PUB-7200-2026-TEST',
        title: 'Sulawesi Tengah Dalam Angka 2026',
        milestone: 'H-14',
        picNip: '198801012011011005'
      }
    };

    const first = await processTriggerEvent(pool, event, { templateId: testTemplateId });
    expect(first.status).toBe('processed');

    const second = await processTriggerEvent(pool, event, { templateId: testTemplateId });
    expect(second.status).toBe('duplicate_ignored');
  });
});
