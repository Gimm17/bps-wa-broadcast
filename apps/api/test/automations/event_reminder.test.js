import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { pool } from '../../src/db/pool.js';
import { runEventReminderRule } from '../../src/features/automations/service.js';

describe('Ad-Hoc Event & Custom Reminder Automation', () => {
  let testContactId;
  let rule;

  beforeAll(async () => {
    // 1. Insert a test contact
    const c = await pool.query(`
      INSERT INTO contacts (type, name, phone_e164, status)
      VALUES ('employee', 'Budi Santoso (Pegawai Uji)', '+6281299990001', 'active')
      ON CONFLICT (phone_e164) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `);
    testContactId = c.rows[0].id;

    // 2. Create custom event reminder rule (di luar template)
    const ruleRes = await pool.query(`
      INSERT INTO automation_rules (code, name, type, template_id, is_active, config)
      VALUES ('auto_test_event_hari_h', 'Rapat Koordinasi Evaluasi Hari H', 'event_reminder', null, true, $1)
      RETURNING *
    `, [
      JSON.stringify({
        messageMode: 'custom_text',
        scheduleType: 'event_day',
        eventDate: '2026-09-24',
        eventTime: '09:30',
        eventLocation: 'Ruang Rapat BPS Sulteng',
        reminderOffset: 'day_of',
        targetAudience: { type: 'all_employees' },
        customMessage: {
          header: 'PENGUMUMAN RAPAT MENDADAK HARI H',
          body: 'Yth. {nama}, mohon hadir rapat hari ini {tanggal} pukul {jam} di {lokasi}.',
          footer: 'BPS Provinsi Sulawesi Tengah'
        }
      })
    ]);
    rule = ruleRes.rows[0];
  });

  afterAll(async () => {
    if (rule?.id) {
      await pool.query('DELETE FROM automation_rules WHERE id = $1', [rule.id]);
    }
    if (testContactId) {
      await pool.query('DELETE FROM messages WHERE contact_id = $1', [testContactId]);
      await pool.query('DELETE FROM contacts WHERE id = $1', [testContactId]);
    }
  });

  it('evaluates and enqueues custom ad-hoc event reminder without template', async () => {
    const result = await runEventReminderRule({
      db: pool,
      rule,
      now: new Date('2026-09-24T08:00:00Z')
    });

    expect(result.status).toBe('triggered_success');
    expect(result.messageMode).toBe('custom_text');
    expect(result.queued).toBeGreaterThanOrEqual(1);

    // Verify message in queue has rendered customText
    const msgRes = await pool.query(`
      SELECT payload, status FROM messages
      WHERE contact_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `, [testContactId]);

    expect(msgRes.rows.length).toBe(1);
    const payload = typeof msgRes.rows[0].payload === 'string'
      ? JSON.parse(msgRes.rows[0].payload)
      : msgRes.rows[0].payload;

    expect(payload.customText).toContain('Budi Santoso');
    expect(payload.customText).toContain('2026-09-24');
    expect(payload.customText).toContain('09:30');
    expect(payload.customText).toContain('Ruang Rapat BPS Sulteng');
    expect(payload.customText).toContain('PENGUMUMAN RAPAT MENDADAK HARI H');
  });
});
