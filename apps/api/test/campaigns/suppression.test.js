import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { pool } from '../../src/db/pool.js';
import {
  createDraft,
  expandRecipients,
  queueCampaignMessages
} from '../../src/features/campaigns/service.js';
import { recordConsent } from '../../src/features/subscriptions/service.js';

describe('Campaign Pre-Send Suppression Safety', () => {
  let templateId;
  let campaignId;
  let contactId;
  let topicId;

  beforeAll(async () => {
    // 1. Template
    const tRes = await pool.query(`
      INSERT INTO meta_templates (name, language, category, status, components)
      VALUES ($1, 'id', 'UTILITY', 'APPROVED', '[]'::jsonb)
      RETURNING id
    `, [`tmpl_supp_${Date.now()}`]);
    templateId = tRes.rows[0].id;

    // 2. Topic
    const topRes = await pool.query(`
      INSERT INTO topics (code, title)
      VALUES ($1, 'Topik Pengujian Supresi')
      RETURNING id
    `, [`topik_supp_${Date.now()}`]);
    topicId = topRes.rows[0].id;

    // 3. Contact & subscription
    const cRes = await pool.query(`
      INSERT INTO contacts (type, name, phone_e164, status)
      VALUES ('public', 'Kontak Bakal Optout', $1, 'active')
      RETURNING id
    `, [`+62814${Math.floor(10000000 + Math.random() * 90000000)}`]);
    contactId = cRes.rows[0].id;

    await pool.query(`
      INSERT INTO subscriptions (contact_id, topic_id, status)
      VALUES ($1, $2, 'active')
    `, [contactId, topicId]);

    // 4. Draft campaign targeting this topic
    const camp = await createDraft({
      title: 'Kampanye Cek Supresi',
      type: 'manual',
      templateId,
      targetSegment: { topicId, contactType: 'public' },
      templateParams: {}
    });
    campaignId = camp.id;
  });

  afterAll(async () => {
    if (campaignId) {
      await pool.query('DELETE FROM campaign_recipients WHERE campaign_id = $1', [campaignId]);
      await pool.query('DELETE FROM messages WHERE campaign_id = $1', [campaignId]);
      await pool.query('DELETE FROM campaigns WHERE id = $1', [campaignId]);
    }
    if (contactId) {
      await pool.query('DELETE FROM consent_events WHERE contact_id = $1', [contactId]);
      await pool.query('DELETE FROM subscriptions WHERE contact_id = $1', [contactId]);
      await pool.query('DELETE FROM contacts WHERE id = $1', [contactId]);
    }
    if (topicId) await pool.query('DELETE FROM topics WHERE id = $1', [topicId]);
    if (templateId) await pool.query('DELETE FROM meta_templates WHERE id = $1', [templateId]);
  });

  it('rechecks suppression immediately before enqueue and send', async () => {
    // 1. Expand audience: recipient is added
    const expanded = await expandRecipients(campaignId);
    expect(expanded.totalRecipients).toBeGreaterThanOrEqual(1);

    // 2. Unsubscribe race occurs right after expansion but before enqueue!
    await recordConsent({
      contactId,
      topicId,
      action: 'unsubscribe',
      source: 'whatsapp',
      evidence: 'Ketik BERHENTI sebelum siaran meluncur'
    });

    // 3. Queue campaign messages: must recheck suppression and NOT enqueue messages for opted-out contact
    const result = await queueCampaignMessages(campaignId);

    expect(result.suppressedCount).toBeGreaterThanOrEqual(1);
    expect(result.queuedCount).toBe(0);

    // Ensure no 'queued' message exists for this unsubscribed contact
    const msgRes = await pool.query(`
      SELECT status FROM messages WHERE campaign_id = $1 AND contact_id = $2
    `, [campaignId, contactId]);

    expect(msgRes.rows.every(r => r.status === 'suppressed')).toBe(true);
  });
});
