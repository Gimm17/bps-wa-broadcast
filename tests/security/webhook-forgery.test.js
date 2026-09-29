import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import crypto from 'node:crypto';
import { hashPassword } from '../../apps/api/src/features/auth/hasher.js';
import { createApp } from '../../apps/api/src/app.js';
import { pool } from '../../apps/api/src/db/pool.js';
import { config } from '../../apps/api/src/config.js';
import { safeSpreadsheetCell, ROLES } from '@bps/shared';

describe('Security: Webhook Forgery, CSRF, and Injection Protections', () => {
  let app;
  let sessionCookie;
  let validCsrf;
  const testSecret = 'sec_super_secret_webhook_key_2026';
  const originalEnvSecret = process.env.META_APP_SECRET;

  beforeAll(async () => {
    process.env.META_APP_SECRET = testSecret;
    app = createApp({ config, db: pool, logger: false });

    // Seed security test user
    const passwordHash = await hashPassword('Security-Pass-12345');
    const userRes = await pool.query(`
      INSERT INTO users (username, email, password_hash, name, is_active)
      VALUES ('security_admin', 'sec_admin@bps.go.id', $1, 'Sec Admin', true)
      ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
      RETURNING id
    `, [passwordHash]);
    const userId = userRes.rows[0].id;

    const roleRes = await pool.query('SELECT id FROM roles WHERE code = $1', [ROLES.SUPER_ADMIN]);
    if (roleRes.rows[0]) {
      await pool.query(
        'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [userId, roleRes.rows[0].id]
      );
    }

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'sec_admin@bps.go.id', password: 'Security-Pass-12345' });
    sessionCookie = loginRes.headers['set-cookie'];
    validCsrf = loginRes.body.csrfToken;
  });

  afterAll(async () => {
    if (originalEnvSecret !== undefined) {
      process.env.META_APP_SECRET = originalEnvSecret;
    } else {
      delete process.env.META_APP_SECRET;
    }
    await pool.query("DELETE FROM users WHERE email = 'sec_admin@bps.go.id'");
  });

  describe('Meta Webhook Signature & Forgery Protection', () => {
    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: { display_phone_number: '628111', phone_number_id: 'PN_123' },
                statuses: [
                  {
                    id: 'wamid.HBgLMjAyNjA5MjM=',
                    status: 'delivered',
                    timestamp: '1790130000',
                    recipient_id: '628123456789'
                  }
                ]
              },
              field: 'messages'
            }
          ]
        }
      ]
    };

    it('rejects webhook with 401 when signature header is missing and secret is configured', async () => {
      const res = await request(app)
        .post('/api/meta/webhook')
        .send(payload);

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/signature/i);
    });

    it('rejects webhook with 401 when signature is forged or computed with wrong secret', async () => {
      const bodyStr = JSON.stringify(payload);
      const forgedSig = crypto
        .createHmac('sha256', 'wrong_attacker_secret_999')
        .update(bodyStr)
        .digest('hex');

      const res = await request(app)
        .post('/api/meta/webhook')
        .set('x-hub-signature-256', `sha256=${forgedSig}`)
        .send(payload);

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/tidak valid/i);
    });

    it('rejects webhook with 401 when signature format is malformed', async () => {
      const res = await request(app)
        .post('/api/meta/webhook')
        .set('x-hub-signature-256', 'malformed_signature_without_sha256_prefix')
        .send(payload);

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/tidak valid/i);
    });

    it('accepts webhook with 200 when signature is genuinely valid', async () => {
      const bodyStr = JSON.stringify(payload);
      const validSig = crypto
        .createHmac('sha256', testSecret)
        .update(bodyStr)
        .digest('hex');

      const res = await request(app)
        .post('/api/meta/webhook')
        .set('x-hub-signature-256', `sha256=${validSig}`)
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });

  describe('CSRF Protection on Mutating Routes', () => {
    it('blocks mutating POST request when CSRF token is missing', async () => {
      const res = await request(app)
        .post('/api/campaigns')
        .set('Cookie', sessionCookie)
        .send({ title: 'Malicious CSRF Campaign' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('CSRF_INVALID');
    });

    it('blocks mutating PATCH request with invalid CSRF token', async () => {
      const res = await request(app)
        .patch('/api/integrations/meta')
        .set('Cookie', sessionCookie)
        .set('x-csrf-token', 'invalid_forged_csrf_12345')
        .send({});

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('CSRF_INVALID');
    });
  });

  describe('Spreadsheet Formula Injection Sanitization', () => {
    it('sanitizes cells starting with unsafe formula characters (=, +, -, @, tab, newline)', () => {
      expect(safeSpreadsheetCell('=cmd|\' /C calc\'!A0')).toBe('\'=cmd|\' /C calc\'!A0');
      expect(safeSpreadsheetCell('+123456789')).toBe('\'+123456789');
      expect(safeSpreadsheetCell('-100+200')).toBe('\'-100+200');
      expect(safeSpreadsheetCell('@SUM(1,2)')).toBe('\'@SUM(1,2)');
      expect(safeSpreadsheetCell('\tTAB_INJECT')).toBe('\'\tTAB_INJECT');
      expect(safeSpreadsheetCell('\rCR_INJECT')).toBe('\'\rCR_INJECT');
    });

    it('leaves safe alphanumeric content unescaped', () => {
      expect(safeSpreadsheetCell('Normal Text')).toBe('Normal Text');
      expect(safeSpreadsheetCell('BPS Sulawesi Tengah')).toBe('BPS Sulawesi Tengah');
      expect(safeSpreadsheetCell('12345')).toBe('12345');
      expect(safeSpreadsheetCell('')).toBe('');
      expect(safeSpreadsheetCell(null)).toBe('');
    });
  });
});
