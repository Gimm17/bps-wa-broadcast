import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../apps/api/src/app.js';
import { pool } from '../../apps/api/src/db/pool.js';
import { config } from '../../apps/api/src/config.js';

describe('E2E Acceptance: Public Subscription Portal & Consent Lifecycle', () => {
  let app;
  const testPhone = '+628999888777';
  const testName = 'Pelanggan Publik Sulteng';
  let receivedManageToken;
  let createdContactId;

  beforeAll(async () => {
    app = createApp({ config, db: pool, logger: false });

    // Ensure test topics exist
    await pool.query(`
      INSERT INTO topics (code, title, is_active)
      VALUES ('brs_inflasi', 'Berita Resmi Statistik Inflasi', true),
             ('data_pertanian', 'Data Pertanian & Perkebunan', true)
      ON CONFLICT (code) DO NOTHING
    `);
  });

  afterAll(async () => {
    if (createdContactId) {
      await pool.query('DELETE FROM consent_events WHERE contact_id = $1', [createdContactId]);
      await pool.query('DELETE FROM subscriptions WHERE contact_id = $1', [createdContactId]);
      await pool.query('DELETE FROM contacts WHERE id = $1', [createdContactId]);
    }
    await pool.query('DELETE FROM suppression_entries WHERE phone_e164 = $1', [testPhone]);
  });

  it('1. Public user subscribes with explicit consent via public portal', async () => {
    const res = await request(app)
      .post('/api/subscriptions/public')
      .send({
        name: testName,
        phone: testPhone,
        consent: true,
        topicCodes: ['brs_inflasi', 'data_pertanian']
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('ok');
    expect(res.body.manageToken).toBeDefined();
    receivedManageToken = res.body.manageToken;

    // Verify contact creation
    const contactRes = await pool.query('SELECT * FROM contacts WHERE phone_e164 = $1', [testPhone]);
    expect(contactRes.rows.length).toBe(1);
    expect(contactRes.rows[0].status).toBe('active');
    createdContactId = contactRes.rows[0].id;

    // Verify UU PDP consent ledger audit record
    const consentRes = await pool.query(
      'SELECT * FROM consent_events WHERE contact_id = $1 AND event_type = \'subscribe\'',
      [createdContactId]
    );
    expect(consentRes.rows.length).toBeGreaterThanOrEqual(1);
    expect(consentRes.rows[0].channel).toBe('web');
  });

  it('2. User accesses preferences using secure signed manage token', async () => {
    const res = await request(app)
      .get(`/api/subscriptions/manage?token=${receivedManageToken}`);

    expect(res.status).toBe(200);
    expect(res.body.contact).toBeDefined();
    expect(res.body.topics).toBeDefined();
    expect(res.body.topics.length).toBeGreaterThanOrEqual(2);
  });

  it('3. User executes one-click opt-out (unsubscribe all)', async () => {
    const res = await request(app)
      .post('/api/subscriptions/unsubscribe')
      .send({ token: receivedManageToken });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');

    // Verify contact is marked unsubscribed
    const contactRes = await pool.query('SELECT status FROM contacts WHERE id = $1', [createdContactId]);
    expect(contactRes.rows[0].status).toBe('unsubscribed');

    // Verify immediate entry in suppression ledger
    const suppRes = await pool.query('SELECT * FROM suppression_entries WHERE phone_e164 = $1', [testPhone]);
    expect(suppRes.rows.length).toBeGreaterThanOrEqual(1);
  });
});
