import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import crypto from 'node:crypto';
import { pool } from '../../src/db/pool.js';
import {
  recordConsent,
  canSendMessage,
  queuePublicMessage
} from '../../src/features/subscriptions/service.js';

describe('Unsubscribe Race & Suppression Safety', () => {
  let contactId;
  let topicId;
  let templateId;

  beforeAll(async () => {
    // Create test contact
    const cRes = await pool.query(`
      INSERT INTO contacts (type, name, phone_e164, status)
      VALUES ('public', 'Subscriber Uji', $1, 'active')
      RETURNING id
    `, [`+62852${Math.floor(10000000 + Math.random() * 90000000)}`]);
    contactId = cRes.rows[0].id;

    // Create test topic
    const tRes = await pool.query(`
      INSERT INTO topics (code, title, description)
      VALUES ($1, 'BRS Inflasi Bulanan', 'Rilis berkala inflasi')
      RETURNING id
    `, [`inflasi_${Date.now()}`]);
    topicId = tRes.rows[0].id;

    // Create test template
    const tmplRes = await pool.query(`
      INSERT INTO meta_templates (name, language, category, status, components)
      VALUES ($1, 'id', 'UTILITY', 'APPROVED', '[]'::jsonb)
      RETURNING id
    `, [`tmpl_sub_${Date.now()}`]);
    templateId = tmplRes.rows[0].id;

    // Initial subscription
    await pool.query(`
      INSERT INTO subscriptions (contact_id, topic_id, status)
      VALUES ($1, $2, 'active')
    `, [contactId, topicId]);
  });

  afterAll(async () => {
    if (contactId) {
      await pool.query('DELETE FROM messages WHERE contact_id = $1', [contactId]);
      await pool.query('DELETE FROM consent_events WHERE contact_id = $1', [contactId]);
      await pool.query('DELETE FROM subscriptions WHERE contact_id = $1', [contactId]);
      await pool.query('DELETE FROM contacts WHERE id = $1', [contactId]);
    }
    if (topicId) await pool.query('DELETE FROM topics WHERE id = $1', [topicId]);
    if (templateId) await pool.query('DELETE FROM meta_templates WHERE id = $1', [templateId]);
  });

  it('suppresses a queued public message after opt-out', async () => {
    const message = await queuePublicMessage({
      contactId,
      topicId,
      templateId,
      idempotencyKey: `sub-test:${crypto.randomUUID()}`
    });

    expect(message.id).toBeDefined();

    // Verify allowed before unsubscribe
    const beforeOptOut = await canSendMessage(message.id);
    expect(beforeOptOut.allowed).toBe(true);

    // Unsubscribe action
    await recordConsent({
      contactId,
      topicId,
      action: 'unsubscribe',
      source: 'whatsapp',
      evidence: 'Ketik BERHENTI'
    });

    // Check after unsubscribe: must be disallowed with reason opted_out
    const afterOptOut = await canSendMessage(message.id);
    expect(afterOptOut).toEqual({ allowed: false, reason: 'opted_out' });
  });
});
