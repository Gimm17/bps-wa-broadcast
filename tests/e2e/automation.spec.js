import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { pool } from '../../apps/api/src/db/pool.js';
import { processTriggerEvent, runAttendanceRule } from '../../apps/api/src/features/automations/service.js';
import { createAttendanceAdapter } from '../../apps/api/src/adapters/attendance.js';

describe('E2E Acceptance: External Source Adapters, Deduplication & Automations', () => {
  const transactionNumber = 'PST-E2E-2026-999';
  let testContactId, testTemplateId, testRuleId;

  beforeAll(async () => {
    // 1. Create PIC contact
    const contactRes = await pool.query(`
      INSERT INTO contacts (type, name, phone_e164, status)
      VALUES ('employee', 'PIC E2E Dedup', '+6281244445555', 'active')
      ON CONFLICT (phone_e164) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `);
    testContactId = contactRes.rows[0].id;

    await pool.query(`
      INSERT INTO employee_profiles (contact_id, nip, unit_kerja, jabatan)
      VALUES ($1, '198701012012011003', 'Statistik Sosial', 'Statistisi')
      ON CONFLICT (contact_id) DO UPDATE SET nip = EXCLUDED.nip
    `, [testContactId]);

    // 2. Create template
    const tplRes = await pool.query(`
      INSERT INTO meta_templates (name, language, category, status, components)
      VALUES ('tpl_e2e_automation', 'id', 'UTILITY', 'APPROVED', '[]'::jsonb)
      ON CONFLICT (name, language) DO UPDATE SET status = 'APPROVED'
      RETURNING id
    `);
    testTemplateId = tplRes.rows[0].id;

    // 3. Create automation rule
    const ruleRes = await pool.query(`
      INSERT INTO automation_rules (code, name, type, template_id, is_active, config)
      VALUES ('e2e_presensi_rule', 'E2E Reminder Presensi', 'attendance_presensi', $1, true, $2)
      ON CONFLICT (code) DO UPDATE SET is_active = true
      RETURNING id
    `, [testTemplateId, JSON.stringify({ maxAgeMinutes: 30, reminderType: 'in' })]);
    testRuleId = ruleRes.rows[0].id;
  });

  afterAll(async () => {
    if (testRuleId) {
      await pool.query('DELETE FROM automation_rules WHERE id = $1', [testRuleId]);
    }
    if (testContactId) {
      await pool.query('DELETE FROM employee_profiles WHERE contact_id = $1', [testContactId]);
      await pool.query('DELETE FROM messages WHERE contact_id = $1', [testContactId]);
      await pool.query('DELETE FROM contacts WHERE id = $1', [testContactId]);
    }
    if (testTemplateId) {
      await pool.query('DELETE FROM meta_templates WHERE id = $1', [testTemplateId]);
    }
    await pool.query("DELETE FROM trigger_events WHERE external_id = $1", [transactionNumber]);
    await pool.query("DELETE FROM system_alerts WHERE code = 'ATTENDANCE_DATA_STALE'");
  });

  it('1. Ingests source event and deduplicates repeated external events', async () => {
    const event = {
      source: 'silastik_pst',
      eventType: 'new_transaction',
      externalId: transactionNumber,
      payload: {
        transactionNumber,
        serviceType: 'Konsultasi Statistik',
        picNip: '198701012012011003',
        applicantName: 'Bappeda Sulteng'
      }
    };

    // First ingestion -> processed
    const firstRes = await processTriggerEvent(pool, event, { templateId: testTemplateId });
    expect(firstRes.status).toBe('processed');
    expect(firstRes.enqueued).toBe(true);

    // Repeated ingestion with same transactionNumber -> ignored
    const secondRes = await processTriggerEvent(pool, event, { templateId: testTemplateId });
    expect(secondRes.status).toBe('duplicate_ignored');
    expect(secondRes.enqueued).toBe(false);

    // Verify only 1 trigger_event row in DB
    const countRes = await pool.query(
      "SELECT COUNT(*)::int as count FROM trigger_events WHERE source = 'silastik_pst' AND external_id = $1",
      [transactionNumber]
    );
    expect(countRes.rows[0].count).toBe(1);
  });

  it('2. Enforces SIMPEG attendance safety gate on stale data', async () => {
    const testNow = new Date('2026-09-23T07:15:00+08:00'); // Workday Wednesday
    const staleAdapter = {
      fetchStatus: async () => ({
        observedAt: new Date(testNow.getTime() - 7200 * 1000).toISOString(), // 2 hours older than testNow
        records: [
          { nip: '198701012012011003', status: 'NOT_CHECKED_IN' }
        ]
      })
    };

    const ruleRes = await pool.query('SELECT * FROM automation_rules WHERE id = $1', [testRuleId]);
    const rule = ruleRes.rows[0];

    const attendanceResult = await runAttendanceRule({
      db: pool,
      rule,
      now: testNow,
      adapter: staleAdapter
    });

    // Assert: zero reminders enqueued due to safety gate
    expect(attendanceResult.queued).toBe(0);
    expect(attendanceResult.alertCode).toBe('ATTENDANCE_DATA_STALE');

    // Assert: operational alert logged in system_alerts
    const alertRes = await pool.query(
      "SELECT * FROM system_alerts WHERE code = 'ATTENDANCE_DATA_STALE' ORDER BY id DESC LIMIT 1"
    );
    expect(alertRes.rows.length).toBe(1);
    expect(alertRes.rows[0].severity).toBe('warning');
  });
});
