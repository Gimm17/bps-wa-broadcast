import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { pool } from '../../src/db/pool.js';
import { runAttendanceRule } from '../../src/features/automations/service.js';
import { createAttendanceAdapter } from '../../src/adapters/attendance.js';

describe('Attendance Automation & Freshness Safety Gate', () => {
  let testContact1Id, testContact2Id;
  let testTemplateId;
  let rule;

  beforeAll(async () => {
    // 1. Insert 2 test employees
    const c1 = await pool.query(`
      INSERT INTO contacts (type, name, phone_e164, status)
      VALUES ('employee', 'Employee Not Checked In', '+6281211112222', 'active')
      ON CONFLICT (phone_e164) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `);
    testContact1Id = c1.rows[0].id;
    await pool.query(`
      INSERT INTO employee_profiles (contact_id, nip, unit_kerja, jabatan)
      VALUES ($1, '198501012010011001', 'Diseminasi', 'Pranata Komputer')
      ON CONFLICT (contact_id) DO UPDATE SET nip = EXCLUDED.nip
    `, [testContact1Id]);

    const c2 = await pool.query(`
      INSERT INTO contacts (type, name, phone_e164, status)
      VALUES ('employee', 'Employee Already Present', '+6281233334444', 'active')
      ON CONFLICT (phone_e164) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `);
    testContact2Id = c2.rows[0].id;
    await pool.query(`
      INSERT INTO employee_profiles (contact_id, nip, unit_kerja, jabatan)
      VALUES ($1, '199002022014022002', 'Diseminasi', 'Statistisi')
      ON CONFLICT (contact_id) DO UPDATE SET nip = EXCLUDED.nip
    `, [testContact2Id]);

    // 2. Insert test template
    const tpl = await pool.query(`
      INSERT INTO meta_templates (name, language, category, status, components)
      VALUES ('tpl_presensi_test', 'id', 'UTILITY', 'APPROVED', '[]'::jsonb)
      ON CONFLICT (name, language) DO UPDATE SET status = 'APPROVED'
      RETURNING id
    `);
    testTemplateId = tpl.rows[0].id;

    // 3. Insert automation rule
    const ruleRes = await pool.query(`
      INSERT INTO automation_rules (code, name, type, template_id, is_active, config)
      VALUES ('auto_presensi_pagi', 'Reminder Presensi Masuk 07:15', 'attendance_presensi', $1, true, $2)
      ON CONFLICT (code) DO UPDATE SET is_active = true
      RETURNING *
    `, [testTemplateId, JSON.stringify({ maxAgeMinutes: 30, reminderType: 'in' })]);
    rule = ruleRes.rows[0];
  });

  afterAll(async () => {
    if (rule?.id) {
      await pool.query('DELETE FROM automation_rules WHERE id = $1', [rule.id]);
    }
    if (testContact1Id) {
      await pool.query('DELETE FROM employee_profiles WHERE contact_id IN ($1, $2)', [testContact1Id, testContact2Id]);
      await pool.query('DELETE FROM messages WHERE contact_id IN ($1, $2)', [testContact1Id, testContact2Id]);
      await pool.query('DELETE FROM contacts WHERE id IN ($1, $2)', [testContact1Id, testContact2Id]);
    }
    if (testTemplateId) {
      await pool.query('DELETE FROM meta_templates WHERE id = $1', [testTemplateId]);
    }
  });

  it('enqueues only employees not checked in when attendance data is fresh on a workday', async () => {
    const now = new Date('2026-10-05T07:15:00+08:00'); // Monday workday

    const mockAdapter = {
      fetchStatus: async () => ({
        observedAt: new Date('2026-10-05T07:14:00+08:00').toISOString(), // 1 min old -> fresh!
        records: [
          { nip: '198501012010011001', status: 'NOT_CHECKED_IN' },
          { nip: '199002022014022002', status: 'PRESENT' }
        ]
      })
    };

    const result = await runAttendanceRule({
      db: pool,
      rule,
      now,
      adapter: mockAdapter
    });

    expect(result.queued).toBe(1);
    expect(result.skippedPresent).toBe(1);
    expect(result.alertCode).toBeNull();
  });

  it('enqueues zero reminders when attendance data is stale and raises ATTENDANCE_DATA_STALE alert', async () => {
    const now = new Date('2026-10-05T07:15:00+08:00');

    const mockAdapter = {
      fetchStatus: async () => ({
        // 45 minutes old, exceeds 30 minute freshness limit!
        observedAt: new Date('2026-10-05T06:30:00+08:00').toISOString(),
        records: [
          { nip: '198501012010011001', status: 'NOT_CHECKED_IN' }
        ]
      })
    };

    const result = await runAttendanceRule({
      db: pool,
      rule,
      now,
      adapter: mockAdapter
    });

    expect(result.queued).toBe(0);
    expect(result.alertCode).toBe('ATTENDANCE_DATA_STALE');
  });

  it('enqueues zero reminders on holidays due to workday bypass', async () => {
    // 2026-10-10 is Saturday (weekend)
    const weekendDate = new Date('2026-10-10T07:15:00+08:00');

    const mockAdapter = {
      fetchStatus: async () => ({
        observedAt: weekendDate.toISOString(),
        records: [
          { nip: '198501012010011001', status: 'NOT_CHECKED_IN' }
        ]
      })
    };

    const result = await runAttendanceRule({
      db: pool,
      rule,
      now: weekendDate,
      adapter: mockAdapter
    });

    expect(result.queued).toBe(0);
    expect(result.skippedHoliday).toBe(true);
  });
});
