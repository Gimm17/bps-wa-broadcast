import { pool } from '../../db/pool.js';

export class SubscriptionRepository {
  constructor(dbPool = pool) {
    this.pool = dbPool;
  }

  async findTopics(client = this.pool) {
    const res = await client.query(`
      SELECT id, code, title, description, is_active
      FROM topics
      WHERE is_active = true
      ORDER BY code ASC
    `);
    return res.rows;
  }

  async findAllTopics(client = this.pool) {
    const res = await client.query(`
      SELECT t.id, t.code, t.title, t.description, t.is_active, t.created_at,
             COUNT(s.id) FILTER (WHERE s.status = 'active')::int AS active_subscribers_count
      FROM topics t
      LEFT JOIN subscriptions s ON s.topic_id = t.id
      GROUP BY t.id
      ORDER BY t.created_at ASC
    `);
    return res.rows;
  }

  async findTopicByCode(client = this.pool, code) {
    const res = await client.query(`
      SELECT id, code, title, description, is_active
      FROM topics
      WHERE LOWER(code) = LOWER($1)
    `, [code]);
    return res.rows[0] || null;
  }

  async findTopicById(client = this.pool, id) {
    const res = await client.query(`
      SELECT id, code, title, description, is_active
      FROM topics
      WHERE id = $1
    `, [id]);
    return res.rows[0] || null;
  }

  async findContactById(client = this.pool, id) {
    const res = await client.query(`
      SELECT id, type, name, phone_e164, status
      FROM contacts
      WHERE id = $1
    `, [id]);
    return res.rows[0] || null;
  }

  async findContactByPhone(client = this.pool, phoneE164) {
    const res = await client.query(`
      SELECT id, type, name, phone_e164, status
      FROM contacts
      WHERE phone_e164 = $1
    `, [phoneE164]);
    return res.rows[0] || null;
  }

  async createContactWithProfile(client = this.pool, { name, phoneE164, instansi, profesi }) {
    const contactRes = await client.query(`
      INSERT INTO contacts (type, name, phone_e164, status)
      VALUES ('public', $1, $2, 'active')
      ON CONFLICT (phone_e164)
      DO UPDATE SET name = EXCLUDED.name, status = 'active', updated_at = now()
      RETURNING *
    `, [name, phoneE164]);
    const contact = contactRes.rows[0];

    await client.query(`
      INSERT INTO public_profiles (contact_id, instansi, profesi)
      VALUES ($1, $2, $3)
      ON CONFLICT (contact_id)
      DO UPDATE SET instansi = EXCLUDED.instansi, profesi = EXCLUDED.profesi, updated_at = now()
    `, [contact.id, instansi || null, profesi || null]);

    return contact;
  }

  async upsertSubscription(client = this.pool, { contactId, topicId, status = 'active', channel = 'web' }) {
    const res = await client.query(`
      INSERT INTO subscriptions (contact_id, topic_id, status, channel, updated_at)
      VALUES ($1, $2, $3, $4, now())
      ON CONFLICT (contact_id, topic_id)
      DO UPDATE SET status = EXCLUDED.status, channel = EXCLUDED.channel, updated_at = now()
      RETURNING *
    `, [contactId, topicId, status, channel]);
    return res.rows[0];
  }

  async updateAllSubscriptionsForContact(client = this.pool, contactId, status) {
    const res = await client.query(`
      UPDATE subscriptions
      SET status = $2, updated_at = now()
      WHERE contact_id = $1
      RETURNING *
    `, [contactId, status]);
    return res.rows;
  }

  async getSubscriptionsByContactId(client = this.pool, contactId) {
    const res = await client.query(`
      SELECT s.id, s.contact_id, s.topic_id, s.status, s.channel, s.updated_at,
             t.code as topic_code, t.title as topic_title, t.description as topic_description
      FROM subscriptions s
      JOIN topics t ON s.topic_id = t.id
      WHERE s.contact_id = $1
      ORDER BY t.title ASC
    `, [contactId]);
    return res.rows;
  }

  async insertConsentEvent(client = this.pool, { contactId, eventType, channel = 'web', proof = null, ipAddress = null }) {
    const res = await client.query(`
      INSERT INTO consent_events (contact_id, event_type, channel, proof, ip_address)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [contactId, eventType, channel, proof, ipAddress]);
    return res.rows[0];
  }

  async insertSuppressionEntry(client = this.pool, { phoneE164, reason }) {
    const res = await client.query(`
      INSERT INTO suppression_entries (phone_e164, reason)
      VALUES ($1, $2)
      ON CONFLICT (phone_e164)
      DO UPDATE SET reason = EXCLUDED.reason, created_at = now()
      RETURNING *
    `, [phoneE164, reason]);
    return res.rows[0];
  }

  async deleteSuppressionEntry(client = this.pool, phoneE164) {
    await client.query(`
      DELETE FROM suppression_entries WHERE phone_e164 = $1
    `, [phoneE164]);
  }

  async isPhoneSuppressed(client = this.pool, phoneE164) {
    const res = await client.query(`
      SELECT EXISTS(SELECT 1 FROM suppression_entries WHERE phone_e164 = $1) as is_suppressed
    `, [phoneE164]);
    return Boolean(res.rows[0]?.is_suppressed);
  }

  async getMessageWithDetails(client = this.pool, messageId) {
    const res = await client.query(`
      SELECT m.id, m.campaign_id, m.contact_id, m.template_id, m.idempotency_key,
             m.payload, m.status, m.available_at, m.attempt_count,
             c.phone_e164, c.status as contact_status, c.type as contact_type
      FROM messages m
      JOIN contacts c ON m.contact_id = c.id
      WHERE m.id = $1
    `, [messageId]);
    return res.rows[0] || null;
  }

  async updateMessageStatus(client = this.pool, messageId, status, errorCode = null, errorMessage = null) {
    const res = await client.query(`
      UPDATE messages
      SET status = $2,
          last_error_code = COALESCE($3, last_error_code),
          last_error_message = COALESCE($4, last_error_message),
          updated_at = now()
      WHERE id = $1
      RETURNING *
    `, [messageId, status, errorCode, errorMessage]);
    return res.rows[0];
  }

  async insertMessage(client = this.pool, { contactId, templateId, campaignId = null, idempotencyKey, payload = {}, status = 'queued' }) {
    const res = await client.query(`
      INSERT INTO messages (
        campaign_id, contact_id, template_id, idempotency_key, payload, status
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [campaignId, contactId, templateId, idempotencyKey, JSON.stringify(payload), status]);
    return res.rows[0];
  }

  async listSubscriptions(client = this.pool, { limit = 20, offset = 0, status, topicId, search }) {
    const conditions = [];
    const values = [];

    if (status) {
      values.push(status);
      conditions.push(`s.status = $${values.length}`);
    }

    if (topicId) {
      values.push(topicId);
      conditions.push(`s.topic_id = $${values.length}`);
    }

    if (search) {
      values.push(`%${search}%`);
      conditions.push(`(c.name ILIKE $${values.length} OR c.phone_e164 ILIKE $${values.length})`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await client.query(`
      SELECT COUNT(*)::int as total
      FROM subscriptions s
      JOIN contacts c ON s.contact_id = c.id
      ${whereClause}
    `, values);

    values.push(limit);
    const limitParam = `$${values.length}`;
    values.push(offset);
    const offsetParam = `$${values.length}`;

    const rowsRes = await client.query(`
      SELECT s.id, s.contact_id, s.topic_id, s.status, s.channel, s.created_at, s.updated_at,
             c.name as contact_name, c.phone_e164, c.type as contact_type,
             t.code as topic_code, t.title as topic_title
      FROM subscriptions s
      JOIN contacts c ON s.contact_id = c.id
      JOIN topics t ON s.topic_id = t.id
      ${whereClause}
      ORDER BY s.updated_at DESC
      LIMIT ${limitParam} OFFSET ${offsetParam}
    `, values);

    return {
      total: countRes.rows[0]?.total || 0,
      rows: rowsRes.rows
    };
  }

  async listRecentConsentEvents(client = this.pool, { limit = 20 }) {
    const res = await client.query(`
      SELECT ce.id, ce.contact_id, ce.event_type, ce.channel, ce.proof, ce.ip_address, ce.created_at,
             c.name as contact_name, c.phone_e164
      FROM consent_events ce
      JOIN contacts c ON ce.contact_id = c.id
      ORDER BY ce.created_at DESC
      LIMIT $1
    `, [limit]);
    return res.rows;
  }
}

export const subscriptionRepository = new SubscriptionRepository();
