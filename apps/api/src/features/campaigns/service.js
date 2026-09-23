import crypto from 'node:crypto';
import { pool } from '../../db/pool.js';
import { withTransaction } from '../../db/transaction.js';
import { campaignRepository } from './repository.js';
import { renderTemplateText, buildMetaComponents } from './renderer.js';
import { subscriptionRepository } from '../subscriptions/repository.js';

/**
 * Creates a new campaign draft.
 */
export async function createDraft(input) {
  const tmpl = await pool.query(
    'SELECT id, name, status FROM meta_templates WHERE id = $1',
    [input.templateId]
  );
  if (tmpl.rows.length === 0) {
    throw new Error('Template WhatsApp yang dipilih tidak ditemukan');
  }

  return campaignRepository.create(pool, input);
}

/**
 * Updates a draft campaign. Enforces immutability once scheduled.
 */
export async function updateCampaign(id, updates) {
  const campaign = await campaignRepository.findById(pool, id);
  if (!campaign) {
    const err = new Error('Kampanye tidak ditemukan');
    err.status = 404;
    throw err;
  }

  if (campaign.status !== 'draft') {
    const err = new Error('Kampanye tidak dapat diubah setelah dijadwalkan atau diproses');
    err.code = 'CAMPAIGN_IMMUTABLE';
    err.status = 400;
    throw err;
  }

  return campaignRepository.update(pool, id, updates);
}

/**
 * Schedules a campaign for delivery at a specified timestamp.
 */
export async function scheduleCampaign(id, scheduledAt = null) {
  const campaign = await campaignRepository.findById(pool, id);
  if (!campaign) {
    const err = new Error('Kampanye tidak ditemukan');
    err.status = 404;
    throw err;
  }

  if (campaign.status !== 'draft') {
    const err = new Error('Hanya kampanye berstatus draf yang dapat dijadwalkan');
    err.code = 'CAMPAIGN_IMMUTABLE';
    err.status = 400;
    throw err;
  }

  return campaignRepository.update(pool, id, {
    status: 'scheduled',
    scheduled_at: scheduledAt ? new Date(scheduledAt) : new Date()
  });
}

/**
 * Generates preview of message text and sample recipients.
 */
export async function previewCampaign(id) {
  const campaign = await campaignRepository.findById(pool, id);
  if (!campaign) {
    const err = new Error('Kampanye tidak ditemukan');
    err.status = 404;
    throw err;
  }

  const components = typeof campaign.template_components === 'string'
    ? JSON.parse(campaign.template_components)
    : campaign.template_components || [];

  const params = typeof campaign.template_params === 'string'
    ? JSON.parse(campaign.template_params)
    : campaign.template_params || {};

  // Fetch sample recipients
  const sampleRes = await pool.query(`
    SELECT c.id, c.name, c.phone_e164, c.type, ep.nip, ep.unit_kerja
    FROM contacts c
    LEFT JOIN employee_profiles ep ON c.id = ep.contact_id
    WHERE c.status = 'active'
    LIMIT 3
  `);

  const sampleRecipients = sampleRes.rows;
  const sampleContact = sampleRecipients[0] || null;

  const renderedText = renderTemplateText(components, params, sampleContact);

  return {
    campaignId: campaign.id,
    title: campaign.title,
    templateName: campaign.template_name,
    renderedText,
    sampleRecipients: sampleRecipients.map(c => ({
      name: c.name,
      phone: c.phone_e164,
      sampleRender: renderTemplateText(components, params, c)
    }))
  };
}

/**
 * Resolves audience filters into campaign_recipients snapshot.
 */
export async function expandRecipients(campaignId) {
  const campaign = await campaignRepository.findById(pool, campaignId);
  if (!campaign) {
    const err = new Error('Kampanye tidak ditemukan');
    err.status = 404;
    throw err;
  }

  const segment = typeof campaign.target_segment === 'string'
    ? JSON.parse(campaign.target_segment)
    : campaign.target_segment || {};

  const conditions = ["c.status = 'active'"];
  const values = [];

  if (segment.contactType && segment.contactType !== 'all') {
    values.push(segment.contactType);
    conditions.push(`c.type = $${values.length}`);
  }

  if (segment.topicId) {
    values.push(segment.topicId);
    conditions.push(`EXISTS (
      SELECT 1 FROM subscriptions s
      WHERE s.contact_id = c.id AND s.topic_id = $${values.length} AND s.status = 'active'
    )`);
  }

  const query = `
    SELECT c.id, c.phone_e164, c.status
    FROM contacts c
    WHERE ${conditions.join(' AND ')}
  `;

  const contactsRes = await pool.query(query, values);
  const matched = contactsRes.rows;

  const recipientRows = matched.map(c => ({
    contactId: c.id,
    status: 'eligible',
    exclusionReason: null
  }));

  await campaignRepository.insertRecipientsBatch(pool, campaignId, recipientRows);

  await campaignRepository.update(pool, campaignId, {
    total_recipients: recipientRows.length
  });

  return {
    totalRecipients: recipientRows.length
  };
}

/**
 * Rechecks suppression immediately before enqueuing each recipient for send safety.
 */
export async function queueCampaignMessages(campaignId) {
  const campaign = await campaignRepository.findById(pool, campaignId);
  if (!campaign) {
    const err = new Error('Kampanye tidak ditemukan');
    err.status = 404;
    throw err;
  }

  const segment = typeof campaign.target_segment === 'string'
    ? JSON.parse(campaign.target_segment)
    : campaign.target_segment || {};

  const topicId = segment.topicId || null;

  return withTransaction(async (client) => {
    const recipientsRes = await client.query(`
      SELECT cr.id as recipient_id, cr.contact_id, c.phone_e164, c.status as contact_status, c.type as contact_type
      FROM campaign_recipients cr
      JOIN contacts c ON cr.contact_id = c.id
      WHERE cr.campaign_id = $1
    `, [campaignId]);

    let queuedCount = 0;
    let suppressedCount = 0;

    // Fast batch pre-fetch of suppression and subscription state
    const suppRes = await client.query('SELECT phone_e164 FROM suppression_entries');
    const suppressedSet = new Set(suppRes.rows.map(r => r.phone_e164));

    let activeSubSet = null;
    if (topicId) {
      const subRes = await client.query(
        "SELECT contact_id FROM subscriptions WHERE topic_id = $1 AND status = 'active'",
        [topicId]
      );
      activeSubSet = new Set(subRes.rows.map(r => r.contact_id));
    }

    const queuedItems = [];
    const suppressedItems = [];

    for (const r of recipientsRes.rows) {
      let isSuppressed = false;
      let suppressionReason = null;

      if (suppressedSet.has(r.phone_e164)) {
        isSuppressed = true;
        suppressionReason = 'Nomor terdaftar dalam daftar supresi opt-out';
      } else if (r.contact_status === 'unsubscribed') {
        isSuppressed = true;
        suppressionReason = 'Kontak telah membatalkan langganan';
      } else if (activeSubSet && !activeSubSet.has(r.contact_id)) {
        isSuppressed = true;
        suppressionReason = 'Kontak tidak aktif berlangganan topik ini';
      }

      const idempotencyKey = `camp:${campaignId}:${r.contact_id}`;

      if (isSuppressed) {
        suppressedItems.push({
          recipientId: r.recipient_id,
          contactId: r.contact_id,
          idempotencyKey,
          reason: suppressionReason
        });
      } else {
        queuedItems.push({
          recipientId: r.recipient_id,
          contactId: r.contact_id,
          idempotencyKey
        });
      }
    }

    const CHUNK_SIZE = 500;

    // 1. Batch insert queued messages
    for (let i = 0; i < queuedItems.length; i += CHUNK_SIZE) {
      const chunk = queuedItems.slice(i, i + CHUNK_SIZE);
      const values = [];
      const placeholders = [];
      for (let j = 0; j < chunk.length; j++) {
        const item = chunk[j];
        const base = j * 6;
        placeholders.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`);
        values.push(campaignId, item.contactId, campaign.template_id, item.idempotencyKey, JSON.stringify({ topicId }), 'queued');
      }
      await client.query(`
        INSERT INTO messages (campaign_id, contact_id, template_id, idempotency_key, payload, status)
        VALUES ${placeholders.join(', ')}
        ON CONFLICT (idempotency_key) DO NOTHING
      `, values);
    }

    // 2. Batch insert suppressed messages
    for (let i = 0; i < suppressedItems.length; i += CHUNK_SIZE) {
      const chunk = suppressedItems.slice(i, i + CHUNK_SIZE);
      const values = [];
      const placeholders = [];
      for (let j = 0; j < chunk.length; j++) {
        const item = chunk[j];
        const base = j * 7;
        placeholders.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, 'suppressed', 'OPTED_OUT', $${base + 6})`);
        values.push(campaignId, item.contactId, campaign.template_id, item.idempotencyKey, JSON.stringify({ topicId }), item.reason);
      }
      await client.query(`
        INSERT INTO messages (
          campaign_id, contact_id, template_id, idempotency_key, payload, status,
          last_error_code, last_error_message
        )
        VALUES ${placeholders.join(', ')}
        ON CONFLICT (idempotency_key) DO UPDATE SET status = 'suppressed'
      `, values);

      // Update recipient exclusion reasons
      for (const item of chunk) {
        await client.query(`
          UPDATE campaign_recipients
          SET status = 'suppressed', exclusion_reason = $1
          WHERE id = $2
        `, [item.reason, item.recipientId]);
      }
    }

    return {
      queuedCount: queuedItems.length,
      suppressedCount: suppressedItems.length,
      total: queuedItems.length + suppressedItems.length
    };
  });
}

/**
 * Enqueues a single test send message to a designated internal recipient.
 */
export async function queueTestSend(campaignId, contactId) {
  const campaign = await campaignRepository.findById(pool, campaignId);
  if (!campaign) {
    throw new Error('Kampanye tidak ditemukan');
  }

  const contact = await pool.query('SELECT * FROM contacts WHERE id = $1', [contactId]);
  if (contact.rows.length === 0) {
    throw new Error('Kontak pengujian tidak ditemukan');
  }

  const idempotencyKey = `test:${campaignId}:${contactId}:${Date.now()}`;

  const res = await pool.query(`
    INSERT INTO messages (
      campaign_id, contact_id, template_id, idempotency_key, payload, status
    )
    VALUES ($1, $2, $3, $4, $5, 'queued')
    RETURNING *
  `, [
    campaignId,
    contactId,
    campaign.template_id,
    idempotencyKey,
    JSON.stringify({ isTest: true, testRecipient: contact.rows[0].name })
  ]);

  return res.rows[0];
}

/**
 * Cancels a campaign and marks remaining queued messages as cancelled.
 */
export async function cancelCampaign(campaignId) {
  return withTransaction(async (client) => {
    const updated = await campaignRepository.update(client, campaignId, {
      status: 'cancelled'
    });

    await campaignRepository.cancelQueuedMessages(client, campaignId);
    return updated;
  });
}
