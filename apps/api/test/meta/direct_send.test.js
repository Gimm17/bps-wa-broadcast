import { describe, expect, it, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { hashPassword } from '../../src/features/auth/hasher.js';
import { createApp } from '../../src/app.js';
import { pool } from '../../src/db/pool.js';
import { config } from '../../src/config.js';
import { ROLES } from '@bps/shared';
import { normalizePhoneNumber } from '../../src/features/meta/routes.js';
import { MpwaClient } from '../../src/features/meta/client.js';

describe('Direct Send & Check Number API Endpoints', () => {
  let app;
  let adminCookie;
  let adminCsrf;
  let templateId;
  const originalFetch = globalThis.fetch;

  beforeAll(async () => {
    app = createApp({ config, db: pool, logger: false });

    // Setup admin user with campaign.send permission (via ADMIN_DISEMINASI role)
    const passwordHash = await hashPassword('DirectSendPass-12345');
    const adminRes = await pool.query(`
      INSERT INTO users (username, email, password_hash, name, is_active)
      VALUES ('admin_direct_send', 'admin_direct_send@bps.go.id', $1, 'Admin Direct Send', true)
      ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
      RETURNING id
    `, [passwordHash]);

    const adminRole = await pool.query('SELECT id FROM roles WHERE code = $1', [ROLES.ADMIN_DISEMINASI]);
    if (adminRole.rows[0]) {
      await pool.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [
        adminRes.rows[0].id,
        adminRole.rows[0].id
      ]);
    }

    // Login admin
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin_direct_send@bps.go.id', password: 'DirectSendPass-12345' });
    adminCookie = loginRes.headers['set-cookie'];
    adminCsrf = loginRes.body.csrfToken;

    // Create a mock template for template direct send test
    const tmplRes = await pool.query(`
      INSERT INTO meta_templates (name, language, category, status, components)
      VALUES ('test_direct_tmpl', 'id', 'UTILITY', 'APPROVED', $1::jsonb)
      ON CONFLICT (name, language) DO UPDATE SET components = EXCLUDED.components
      RETURNING id
    `, [JSON.stringify([
      { type: 'HEADER', format: 'TEXT', text: 'BPS Sulteng' },
      { type: 'BODY', text: 'Halo {{1}}, data {{2}} telah dirilis.' },
      { type: 'FOOTER', text: 'BPS Provinsi Sulawesi Tengah' }
    ])]);
    templateId = tmplRes.rows[0].id;
    await pool.query("DELETE FROM messages WHERE meta_message_id IN ('wamid_direct_test_99', 'wamid_tmpl_test_88')");
  });

  afterAll(async () => {
    globalThis.fetch = originalFetch;
    await pool.query("DELETE FROM messages WHERE idempotency_key LIKE 'direct:%' OR meta_message_id IN ('wamid_direct_test_99', 'wamid_tmpl_test_88')");
    if (templateId) {
      await pool.query('DELETE FROM meta_templates WHERE id = $1', [templateId]);
    }
    await pool.query("DELETE FROM users WHERE email = 'admin_direct_send@bps.go.id'");
    await pool.query("DELETE FROM contacts WHERE phone_e164 IN ('6281234567890', '6287712345678')");
  });

  describe('normalizePhoneNumber helper', () => {
    it('normalizes local 08 prefix to 628', () => {
      expect(normalizePhoneNumber('081234567890')).toBe('6281234567890');
      expect(normalizePhoneNumber('0877-1234-5678')).toBe('6287712345678');
    });

    it('normalizes +62 prefix to 62', () => {
      expect(normalizePhoneNumber('+6281234567890')).toBe('6281234567890');
    });

    it('retains 62 prefix and strips whitespace/special chars', () => {
      expect(normalizePhoneNumber('62812 3456 7890')).toBe('6281234567890');
    });

    it('returns null for invalid numbers', () => {
      expect(normalizePhoneNumber('12345')).toBeNull();
      expect(normalizePhoneNumber('abcd')).toBeNull();
      expect(normalizePhoneNumber('')).toBeNull();
      expect(normalizePhoneNumber(null)).toBeNull();
    });
  });

  describe('POST /api/send/check-number', () => {
    it('rejects invalid phone number', async () => {
      const res = await request(app)
        .post('/api/send/check-number')
        .set('Cookie', adminCookie)
        .set('X-CSRF-Token', adminCsrf)
        .send({ phone: '123' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_PHONE');
    });

    it('checks WhatsApp number existence with mocked MPWA gateway', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          status: true,
          msg: { exists: true, jid: '6281234567890@s.whatsapp.net' }
        })
      });

      const res = await request(app)
        .post('/api/send/check-number')
        .set('Cookie', adminCookie)
        .set('X-CSRF-Token', adminCsrf)
        .send({ phone: '081234567890' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.phone).toBe('6281234567890');
      expect(res.body.exists).toBe(true);
      expect(res.body.jid).toBe('6281234567890@s.whatsapp.net');
    });
  });

  describe('POST /api/send/direct', () => {
    it('sends direct free-text message successfully and logs to database', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          status: true,
          data: { id: 'wamid_direct_test_99' },
          msg: 'Message sent successfully!'
        })
      });

      const res = await request(app)
        .post('/api/send/direct')
        .set('Cookie', adminCookie)
        .set('X-CSRF-Token', adminCsrf)
        .send({
          to: '081234567890',
          message: 'Halo ini uji kirim manual BPS Sulteng',
          footer: 'Bagian IPDS BPS Sulteng',
          recipientName: 'Budi Test Send'
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.recipient).toBe('6281234567890');
      expect(res.body.messageId).toBe('wamid_direct_test_99');
      expect(res.body.renderedText).toBe('Halo ini uji kirim manual BPS Sulteng');
      expect(res.body.footer).toBe('Bagian IPDS BPS Sulteng');

      // Verify contact was upserted in DB
      const contactCheck = await pool.query('SELECT * FROM contacts WHERE phone_e164 = $1', ['6281234567890']);
      expect(contactCheck.rows.length).toBe(1);

      // Verify message was logged with status 'sent'
      const msgCheck = await pool.query('SELECT * FROM messages WHERE meta_message_id = $1', ['wamid_direct_test_99']);
      expect(msgCheck.rows.length).toBe(1);
      expect(msgCheck.rows[0].status).toBe('sent');
    });

    it('sends direct template message with parameter substitution', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          status: true,
          data: { id: 'wamid_tmpl_test_88' },
          msg: 'Message sent successfully!'
        })
      });

      const res = await request(app)
        .post('/api/send/direct')
        .set('Cookie', adminCookie)
        .set('X-CSRF-Token', adminCsrf)
        .send({
          to: '+6287712345678',
          templateId,
          templateParams: {
            '1': 'Pak Kadis',
            '2': 'Inflasi September 2026'
          }
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.recipient).toBe('6287712345678');
      expect(res.body.renderedText).toBe('Halo Pak Kadis, data Inflasi September 2026 telah dirilis.');
      expect(res.body.footer).toBe('BPS Provinsi Sulawesi Tengah');
    });

    it('rejects request with empty message when no template is specified', async () => {
      const res = await request(app)
        .post('/api/send/direct')
        .set('Cookie', adminCookie)
        .set('X-CSRF-Token', adminCsrf)
        .send({
          to: '081234567890',
          message: '   '
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('EMPTY_MESSAGE');
    });

    it('rejects request with invalid phone number', async () => {
      const res = await request(app)
        .post('/api/send/direct')
        .set('Cookie', adminCookie)
        .set('X-CSRF-Token', adminCsrf)
        .send({
          to: '12345',
          message: 'Test'
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_PHONE');
    });
  });
});
