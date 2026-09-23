import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import argon2 from 'argon2';
import { createApp } from '../../apps/api/src/app.js';
import { pool } from '../../apps/api/src/db/pool.js';
import { config } from '../../apps/api/src/config.js';
import { ROLES } from '@bps/shared';
import { expandRecipients, queueCampaignMessages } from '../../apps/api/src/features/campaigns/service.js';
import { applyMetaStatus, getMessageStatusByMetaId } from '../../apps/api/src/features/meta/webhook.js';

describe('E2E Acceptance: Broadcast Campaign Lifecycle & Webhooks', () => {
  let app;
  let operatorCookie;
  let operatorCsrf;
  let testCampaignId;
  let templateId;
  let eligibleContactId;
  let optOutContactId;

  beforeAll(async () => {
    app = createApp({ config, db: pool, logger: false });

    // 1. Setup operator
    const passwordHash = await argon2.hash('Campaign-E2E-Pass-2026');
    const userRes = await pool.query(`
      INSERT INTO users (username, email, password_hash, name, is_active)
      VALUES ('camp_operator', 'camp_operator@bps.go.id', $1, 'Campaign Operator', true)
      ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
      RETURNING id
    `, [passwordHash]);
    const userId = userRes.rows[0].id;

    const roleRes = await pool.query('SELECT id FROM roles WHERE code = $1', [ROLES.OPERATOR]);
    if (roleRes.rows[0]) {
      await pool.query(
        'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [userId, roleRes.rows[0].id]
      );
    }

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'camp_operator@bps.go.id', password: 'Campaign-E2E-Pass-2026' });

    operatorCookie = loginRes.headers['set-cookie'];
    operatorCsrf = loginRes.body.csrfToken;

    // 2. Setup Meta template fixture
    const tmplRes = await pool.query(`
      INSERT INTO meta_templates (meta_template_id, name, category, language, status, components)
      VALUES ('tpl_e2e_001', 'e2e_broadcast_notice', 'UTILITY', 'id', 'APPROVED',
        '[{"type":"BODY","text":"Halo {{1}}, rilis data {{2}} telah terbit."}]'::jsonb)
      ON CONFLICT (name, language) DO UPDATE SET status = 'APPROVED'
      RETURNING id
    `);
    templateId = tmplRes.rows[0].id;

    // 3. Setup test contacts
    const c1 = await pool.query(`
      INSERT INTO contacts (name, phone_e164, type, status)
      VALUES ('Budi Sulteng', '+6281234560001', 'public', 'active')
      ON CONFLICT (phone_e164) DO UPDATE SET status = 'active'
      RETURNING id
    `);
    eligibleContactId = c1.rows[0].id;

    const c2 = await pool.query(`
      INSERT INTO contacts (name, phone_e164, type, status)
      VALUES ('Siti Tolitoli', '+6281234560002', 'public', 'active')
      ON CONFLICT (phone_e164) DO UPDATE SET status = 'active'
      RETURNING id
    `);
    optOutContactId = c2.rows[0].id;
  });

  afterAll(async () => {
    if (testCampaignId) {
      await pool.query('DELETE FROM campaign_recipients WHERE campaign_id = $1', [testCampaignId]);
      await pool.query('DELETE FROM messages WHERE campaign_id = $1', [testCampaignId]);
      await pool.query('DELETE FROM campaigns WHERE id = $1', [testCampaignId]);
    }
    await pool.query("DELETE FROM contacts WHERE phone_e164 IN ('+6281234560001', '+6281234560002')");
    await pool.query("DELETE FROM users WHERE email = 'camp_operator@bps.go.id'");
    await pool.query("DELETE FROM suppression_entries WHERE phone_e164 = '+6281234560002'");
  });

  it('1. Operator creates campaign draft via API', async () => {
    const res = await request(app)
      .post('/api/campaigns')
      .set('Cookie', operatorCookie)
      .set('x-csrf-token', operatorCsrf)
      .send({
        title: 'E2E Berita Resmi Statistik Inflasi',
        type: 'manual',
        templateId,
        targetSegment: { contactType: 'public' },
        templateParams: {
          '1': { source: 'contact.name' },
          '2': { source: 'literal', value: 'Inflasi Sulteng' }
        }
      });

    expect(res.status).toBe(201);
    expect(res.body.campaign).toBeDefined();
    expect(res.body.campaign.status).toBe('draft');
    testCampaignId = res.body.campaign.id;
  });

  it('2. Expands recipients into audience snapshot table', async () => {
    const expansion = await expandRecipients(testCampaignId);
    expect(expansion.totalRecipients).toBeGreaterThanOrEqual(2);
  });

  it('3. Respects pre-send suppression: contact opts out before queueing/sending', async () => {
    // Contact 2 opts out
    await pool.query(`
      INSERT INTO suppression_entries (phone_e164, reason)
      VALUES ('+6281234560002', 'User requested STOP')
      ON CONFLICT (phone_e164) DO NOTHING
    `);

    // Queue messages for the campaign
    const queueResult = await queueCampaignMessages(testCampaignId);
    expect(queueResult.queuedCount).toBeGreaterThanOrEqual(1);

    // Verify contact 2 was marked suppressed in campaign_recipients
    const suppressedRes = await pool.query(
      'SELECT status, exclusion_reason FROM campaign_recipients WHERE campaign_id = $1 AND contact_id = $2',
      [testCampaignId, optOutContactId]
    );

    expect(suppressedRes.rows.length).toBe(1);
    expect(suppressedRes.rows[0].status).toBe('suppressed');
  });

  it('4. Simulates Meta status progression monotonically (sent -> delivered -> read)', async () => {
    const testMetaId = 'wamid.HBgLMjAyNjA5MjNfZTJl';

    // Insert a test message simulating queued send
    const insertRes = await pool.query(`
      INSERT INTO messages (
        campaign_id, contact_id, template_id, idempotency_key, payload, status, meta_message_id
      )
      VALUES ($1, $2, $3, $4, $5, 'sent', $6)
      ON CONFLICT (idempotency_key) DO UPDATE SET status = 'sent', meta_message_id = $6
      RETURNING id
    `, [
      testCampaignId,
      eligibleContactId,
      templateId,
      `e2e:msg:${testCampaignId}:${eligibleContactId}`,
      JSON.stringify({ to: '+6281234560001' }),
      testMetaId
    ]);

    const msgId = insertRes.rows[0].id;

    // Apply 'delivered' status
    await applyMetaStatus({
      metaMessageId: testMetaId,
      status: 'delivered',
      timestamp: new Date()
    });

    let status = await getMessageStatusByMetaId(testMetaId);
    expect(status).toBe('delivered');

    // Apply 'read' status
    await applyMetaStatus({
      metaMessageId: testMetaId,
      status: 'read',
      timestamp: new Date()
    });

    status = await getMessageStatusByMetaId(testMetaId);
    expect(status).toBe('read');

    // Attempt monotonic regression with delayed 'sent' status -> must stay 'read'
    await applyMetaStatus({
      metaMessageId: testMetaId,
      status: 'sent',
      timestamp: new Date(Date.now() - 5000)
    });

    status = await getMessageStatusByMetaId(testMetaId);
    expect(status).toBe('read'); // Prevented regression!

    // Verify chronological audit entries in message_status_events
    const historyRes = await pool.query(
      'SELECT status FROM message_status_events WHERE message_id = $1 ORDER BY created_at ASC',
      [msgId]
    );
    expect(historyRes.rows.map(r => r.status)).toEqual(['delivered', 'read', 'sent']);
  });
});
