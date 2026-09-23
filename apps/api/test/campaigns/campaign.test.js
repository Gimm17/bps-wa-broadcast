import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { pool } from '../../src/db/pool.js';
import {
  createDraft,
  updateCampaign,
  scheduleCampaign,
  cancelCampaign,
  previewCampaign
} from '../../src/features/campaigns/service.js';

describe('Campaign Lifecycle & Safety', () => {
  let templateId;
  let campaignId;
  let testContactId;

  beforeAll(async () => {
    const tRes = await pool.query(`
      INSERT INTO meta_templates (name, language, category, status, components)
      VALUES ($1, 'id', 'UTILITY', 'APPROVED', $2)
      RETURNING id
    `, [
      `tmpl_camp_${Date.now()}`,
      JSON.stringify([
        {
          type: 'BODY',
          text: 'Halo {{1}}, berikut rilis statistik {{2}} terbaru dari BPS Sulteng.'
        }
      ])
    ]);
    templateId = tRes.rows[0].id;

    const cRes = await pool.query(`
      INSERT INTO contacts (type, name, phone_e164, status)
      VALUES ('public', 'Uji Kontak Kampanye', $1, 'active')
      RETURNING id
    `, [`+62813${Math.floor(10000000 + Math.random() * 90000000)}`]);
    testContactId = cRes.rows[0].id;
  });

  afterAll(async () => {
    if (campaignId) {
      await pool.query('DELETE FROM campaign_recipients WHERE campaign_id = $1', [campaignId]);
      await pool.query('DELETE FROM messages WHERE campaign_id = $1', [campaignId]);
      await pool.query('DELETE FROM campaigns WHERE id = $1', [campaignId]);
    }
    if (templateId) await pool.query('DELETE FROM meta_templates WHERE id = $1', [templateId]);
    if (testContactId) await pool.query('DELETE FROM contacts WHERE id = $1', [testContactId]);
  });

  it('freezes content and audience definition when scheduled', async () => {
    const draft = await createDraft({
      title: 'Diseminasi Inflasi Bulanan',
      type: 'scheduled',
      templateId,
      targetSegment: { contactType: 'public' },
      templateParams: {
        '1': { source: 'contact.name' },
        '2': { source: 'literal', value: 'Inflasi September 2026' }
      }
    });
    campaignId = draft.id;

    expect(draft.status).toBe('draft');

    // Schedule the campaign
    const scheduled = await scheduleCampaign(campaignId, '2026-10-01T01:00:00Z');
    expect(scheduled.status).toBe('scheduled');

    // Attempting to mutate scheduled campaign must be rejected
    await expect(updateCampaign(campaignId, { title: 'Judul Baru Berubah' }))
      .rejects.toMatchObject({ code: 'CAMPAIGN_IMMUTABLE' });
  });

  it('generates preview with mapped variables and representative sample', async () => {
    const preview = await previewCampaign(campaignId);

    expect(preview.renderedText).toBeDefined();
    expect(preview.renderedText).toContain('Inflasi September 2026');
    expect(Array.isArray(preview.sampleRecipients)).toBe(true);
  });

  it('atomically cancels remaining queued messages when campaign is cancelled', async () => {
    // Insert a dummy queued message for this campaign
    await pool.query(`
      INSERT INTO messages (
        campaign_id, contact_id, template_id, idempotency_key, payload, status
      )
      VALUES ($1, $2, $3, $4, '{}'::jsonb, 'queued')
    `, [campaignId, testContactId, templateId, `cancel_test:${Date.now()}`]);

    const cancelled = await cancelCampaign(campaignId);
    expect(cancelled.status).toBe('cancelled');

    // Verify messages transitioned to cancelled
    const msgRes = await pool.query(`
      SELECT status FROM messages WHERE campaign_id = $1
    `, [campaignId]);

    expect(msgRes.rows.every(r => r.status === 'cancelled')).toBe(true);
  });
});
