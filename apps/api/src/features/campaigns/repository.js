import { pool } from '../../db/pool.js';

export class CampaignRepository {
  constructor(dbPool = pool) {
    this.pool = dbPool;
  }

  async create(client = this.pool, {
    title,
    type = 'manual',
    templateId,
    targetSegment = {},
    templateParams = {},
    scheduledAt = null,
    createdBy = null
  }) {
    const res = await client.query(`
      INSERT INTO campaigns (
        title, type, status, template_id, target_segment, template_params, scheduled_at, created_by
      )
      VALUES ($1, $2, 'draft', $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      title,
      type,
      templateId,
      JSON.stringify(targetSegment),
      JSON.stringify(templateParams),
      scheduledAt,
      createdBy
    ]);
    return res.rows[0];
  }

  async findById(client = this.pool, id) {
    const res = await client.query(`
      SELECT c.*,
             t.name as template_name, t.category as template_category,
             t.language as template_language, t.components as template_components,
             u.name as creator_name
      FROM campaigns c
      LEFT JOIN meta_templates t ON c.template_id = t.id
      LEFT JOIN users u ON c.created_by = u.id
      WHERE c.id = $1
    `, [id]);
    return res.rows[0] || null;
  }

  async update(client = this.pool, id, fields = {}) {
    const allowed = ['title', 'type', 'template_id', 'target_segment', 'template_params', 'scheduled_at', 'status', 'total_recipients', 'started_at', 'completed_at'];
    const sets = [];
    const values = [];

    for (const [k, v] of Object.entries(fields)) {
      if (allowed.includes(k)) {
        values.push(typeof v === 'object' && v !== null && !(v instanceof Date) ? JSON.stringify(v) : v);
        sets.push(`${k} = $${values.length}`);
      }
    }

    if (sets.length === 0) return this.findById(client, id);

    sets.push('updated_at = now()');
    values.push(id);
    const idParam = `$${values.length}`;

    const res = await client.query(`
      UPDATE campaigns
      SET ${sets.join(', ')}
      WHERE id = ${idParam}
      RETURNING *
    `, values);

    return res.rows[0];
  }

  async list(client = this.pool, { page = 1, limit = 20, status = '', type = '', search = '' } = {}) {
    const conditions = [];
    const values = [];

    if (status) {
      values.push(status);
      conditions.push(`c.status = $${values.length}`);
    }

    if (type) {
      values.push(type);
      conditions.push(`c.type = $${values.length}`);
    }

    if (search) {
      values.push(`%${search}%`);
      conditions.push(`(c.title ILIKE $${values.length} OR t.name ILIKE $${values.length})`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await client.query(`
      SELECT COUNT(*)::int as total
      FROM campaigns c
      LEFT JOIN meta_templates t ON c.template_id = t.id
      ${whereClause}
    `, values);

    const offset = (page - 1) * limit;
    values.push(limit);
    const limitParam = `$${values.length}`;
    values.push(offset);
    const offsetParam = `$${values.length}`;

    const rowsRes = await client.query(`
      SELECT c.*,
             t.name as template_name, t.category as template_category,
             u.name as creator_name
      FROM campaigns c
      LEFT JOIN meta_templates t ON c.template_id = t.id
      LEFT JOIN users u ON c.created_by = u.id
      ${whereClause}
      ORDER BY c.created_at DESC
      LIMIT ${limitParam} OFFSET ${offsetParam}
    `, values);

    return {
      total: countRes.rows[0]?.total || 0,
      rows: rowsRes.rows
    };
  }

  async insertRecipientsBatch(client = this.pool, campaignId, recipientRows = []) {
    if (recipientRows.length === 0) return 0;

    for (const r of recipientRows) {
      await client.query(`
        INSERT INTO campaign_recipients (campaign_id, contact_id, status, exclusion_reason)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (campaign_id, contact_id) DO NOTHING
      `, [campaignId, r.contactId, r.status || 'eligible', r.exclusionReason || null]);
    }

    return recipientRows.length;
  }

  async getRecipients(client = this.pool, campaignId, { page = 1, limit = 50, status = '' } = {}) {
    const conditions = ['cr.campaign_id = $1'];
    const values = [campaignId];

    if (status) {
      values.push(status);
      conditions.push(`cr.status = $${values.length}`);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countRes = await client.query(`
      SELECT COUNT(*)::int as total
      FROM campaign_recipients cr
      ${whereClause}
    `, values);

    const offset = (page - 1) * limit;
    values.push(limit);
    const limitParam = `$${values.length}`;
    values.push(offset);
    const offsetParam = `$${values.length}`;

    const rowsRes = await client.query(`
      SELECT cr.*, c.name as contact_name, c.phone_e164, c.type as contact_type
      FROM campaign_recipients cr
      JOIN contacts c ON cr.contact_id = c.id
      ${whereClause}
      ORDER BY cr.created_at ASC
      LIMIT ${limitParam} OFFSET ${offsetParam}
    `, values);

    return {
      total: countRes.rows[0]?.total || 0,
      rows: rowsRes.rows
    };
  }

  async cancelQueuedMessages(client = this.pool, campaignId) {
    const res = await client.query(`
      UPDATE messages
      SET status = 'cancelled', updated_at = now()
      WHERE campaign_id = $1 AND status = 'queued'
      RETURNING id
    `, [campaignId]);
    return res.rows.length;
  }
}

export const campaignRepository = new CampaignRepository();
