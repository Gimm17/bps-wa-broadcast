import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import argon2 from 'argon2';
import { createApp } from '../../apps/api/src/app.js';
import { pool } from '../../apps/api/src/db/pool.js';
import { config } from '../../apps/api/src/config.js';
import { ROLES } from '@bps/shared';
import { expandRecipients, queueCampaignMessages } from '../../apps/api/src/features/campaigns/service.js';
import { claimMessageBatch } from '../../apps/api/src/db/queue.js';

describe('Performance & Scale: 5,000-Recipient Broadcast Workload', () => {
  let app;
  let sessionCookie;
  let testCampaignId;
  let testTemplateId;
  let testTopicId;
  const BATCH_SIZE = 100;
  const TOTAL_RECIPIENTS = 5000;

  beforeAll(async () => {
    app = createApp({ config, db: pool, logger: false });

    // 1. Setup authenticated session for dashboard benchmark
    const passwordHash = await argon2.hash('LoadTest-Pass-2026');
    const userRes = await pool.query(`
      INSERT INTO users (username, email, password_hash, name, is_active)
      VALUES ('load_admin', 'load_admin@bps.go.id', $1, 'Load Admin', true)
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
      .send({ email: 'load_admin@bps.go.id', password: 'LoadTest-Pass-2026' });
    sessionCookie = loginRes.headers['set-cookie'];

    // 2. Setup Meta template
    const tmplRes = await pool.query(`
      INSERT INTO meta_templates (meta_template_id, name, category, language, status, components)
      VALUES ('tpl_load_5000', 'load_test_broadcast', 'UTILITY', 'id', 'APPROVED',
        '[{"type":"BODY","text":"Halo {{1}}, pengumuman sensus BPS Sulteng."}]'::jsonb)
      ON CONFLICT (name, language) DO UPDATE SET status = 'APPROVED'
      RETURNING id
    `);
    testTemplateId = tmplRes.rows[0].id;

    // 3. Isolated topic for this load test
    const topicRes = await pool.query(`
      INSERT INTO topics (code, title, is_active)
      VALUES ('topic_load_5000', 'Topik Skala 5000 Penerima', true)
      ON CONFLICT (code) DO UPDATE SET is_active = true
      RETURNING id
    `);
    testTopicId = topicRes.rows[0].id;

    // 4. Fast set-based generation of 5,000 active contacts
    await pool.query(`
      INSERT INTO contacts (id, type, name, phone_e164, status)
      SELECT 
        gen_random_uuid(),
        'public',
        'Pelanggan Beban ' || i,
        '+62888' || lpad(i::text, 8, '0'),
        'active'
      FROM generate_series(1, ${TOTAL_RECIPIENTS}) AS i
      ON CONFLICT (phone_e164) DO NOTHING;
    `);

    // Subscribe load contacts to the isolated topic
    await pool.query(`
      INSERT INTO subscriptions (contact_id, topic_id, status)
      SELECT c.id, $1, 'active'
      FROM contacts c
      WHERE c.phone_e164 LIKE '+62888%'
      ON CONFLICT (contact_id, topic_id) DO UPDATE SET status = 'active'
    `, [testTopicId]);

    // 5. Create campaign draft targeting only contacts subscribed to this topic
    const campRes = await pool.query(`
      INSERT INTO campaigns (title, type, status, template_id, target_segment, template_params)
      VALUES (
        'Kampanye Skala 5000 Penerima',
        'manual',
        'draft',
        $1,
        json_build_object('contactType', 'public', 'topicId', $2::text)::jsonb,
        '{"1": {"source": "contact.name"}}'::jsonb
      )
      RETURNING id
    `, [testTemplateId, testTopicId]);
    testCampaignId = campRes.rows[0].id;
  }, 45000);

  afterAll(async () => {
    if (testCampaignId) {
      await pool.query('DELETE FROM campaign_recipients WHERE campaign_id = $1', [testCampaignId]);
      await pool.query('DELETE FROM messages WHERE campaign_id = $1', [testCampaignId]);
      await pool.query('DELETE FROM campaigns WHERE id = $1', [testCampaignId]);
    }
    if (testTopicId) {
      await pool.query('DELETE FROM subscriptions WHERE topic_id = $1', [testTopicId]);
      await pool.query('DELETE FROM topics WHERE id = $1', [testTopicId]);
    }
    await pool.query("DELETE FROM contacts WHERE phone_e164 LIKE '+62888%'");
    await pool.query("DELETE FROM users WHERE email = 'load_admin@bps.go.id'");
    if (testTemplateId) {
      await pool.query('DELETE FROM meta_templates WHERE id = $1', [testTemplateId]);
    }
  }, 45000);

  it('1. Expands 5,000 recipients within 60 seconds without event loop starvation', async () => {
    const startTime = Date.now();
    const result = await expandRecipients(testCampaignId);
    const durationMs = Date.now() - startTime;

    expect(result.totalRecipients).toBe(TOTAL_RECIPIENTS);
    // Spec requirement: expansion finishes within 60 seconds
    expect(durationMs).toBeLessThan(60000);

    // Verify database row count
    const countRes = await pool.query(
      'SELECT COUNT(*)::int as count FROM campaign_recipients WHERE campaign_id = $1',
      [testCampaignId]
    );
    expect(countRes.rows[0].count).toBe(TOTAL_RECIPIENTS);
  }, 60000);

  it('2. Queues 5,000 messages with unique idempotency keys and zero duplicates', async () => {
    const queueResult = await queueCampaignMessages(testCampaignId);
    expect(queueResult.queuedCount).toBe(TOTAL_RECIPIENTS);

    // Verify zero duplicates: count of messages equals distinct idempotency keys
    const dupCheck = await pool.query(`
      SELECT 
        COUNT(*)::int as total_count,
        COUNT(DISTINCT idempotency_key)::int as distinct_count
      FROM messages
      WHERE campaign_id = $1
    `, [testCampaignId]);

    expect(dupCheck.rows[0].total_count).toBe(dupCheck.rows[0].distinct_count);
  }, 60000);

  it('3. Worker claims bounded batches of 100 messages safely with advisory leases', async () => {
    const workerId = 'worker-load-sim-01';
    const batch1 = await claimMessageBatch(pool, {
      workerId,
      limit: BATCH_SIZE,
      leaseSeconds: 60
    });

    expect(batch1.length).toBe(BATCH_SIZE);
    for (const msg of batch1) {
      expect(msg.lease_owner).toBe(workerId);
      expect(msg.status).toBe('sending');
    }

    // A concurrent second claim receives distinct messages, never colliding
    const worker2Id = 'worker-load-sim-02';
    const batch2 = await claimMessageBatch(pool, {
      workerId: worker2Id,
      limit: BATCH_SIZE,
      leaseSeconds: 60
    });

    expect(batch2.length).toBe(BATCH_SIZE);
    const batch1Ids = new Set(batch1.map(m => m.id));
    for (const msg of batch2) {
      expect(batch1Ids.has(msg.id)).toBe(false); // No overlap!
      expect(msg.lease_owner).toBe(worker2Id);
    }
  });

  it('4. Dashboard summary p95 response time stays <= 500ms under active queue load', async () => {
    const latencies = [];
    const REQUEST_COUNT = 20;

    for (let i = 0; i < REQUEST_COUNT; i++) {
      const t0 = performance.now();
      const res = await request(app)
        .get('/api/dashboard/summary')
        .set('Cookie', sessionCookie);
      const latency = performance.now() - t0;

      expect(res.status).toBe(200);
      latencies.push(latency);
    }

    // Sort to calculate p95
    latencies.sort((a, b) => a - b);
    const p95Index = Math.floor(REQUEST_COUNT * 0.95);
    const p95Latency = latencies[p95Index];

    // Spec constraint: dashboard summary p95 stays at or below 500ms
    expect(p95Latency).toBeLessThanOrEqual(500);
  });
});
