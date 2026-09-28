import { pool } from '../../db/pool.js';
import { withTransaction } from '../../db/transaction.js';
import { MpwaClient } from './client.js';
import { config } from '../../config.js';

/**
 * Synchronizes templates into PostgreSQL from raw Meta template array.
 */
export async function syncTemplatesFromData(templateList = []) {
  if (!Array.isArray(templateList)) {
    throw new Error('Daftar template Meta harus berupa array');
  }

  return withTransaction(async (client) => {
    let upsertedCount = 0;
    const activeNames = [];

    for (const t of templateList) {
      const name = t.name;
      const language = t.language || 'id';
      const category = t.category || 'UTILITY';
      const status = t.status || 'APPROVED';
      const metaId = t.id || null;
      const components = t.components || [];

      activeNames.push(name);

      await client.query(`
        INSERT INTO meta_templates (
          meta_template_id, name, language, category, status, components, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, now())
        ON CONFLICT (name, language)
        DO UPDATE SET
          meta_template_id = COALESCE(EXCLUDED.meta_template_id, meta_templates.meta_template_id),
          category = EXCLUDED.category,
          status = EXCLUDED.status,
          components = EXCLUDED.components,
          updated_at = now()
      `, [metaId, name, language, category, status, JSON.stringify(components)]);

      upsertedCount++;
    }

    // Mark existing templates not present in incoming list as ARCHIVED
    if (activeNames.length > 0) {
      await client.query(`
        UPDATE meta_templates
        SET status = 'ARCHIVED', updated_at = now()
        WHERE name != ALL($1) AND status != 'ARCHIVED'
      `, [activeNames]);
    }

    return {
      upsertedCount,
      totalCount: templateList.length
    };
  });
}

/**
 * Full sync triggered from integration service using Meta client.
 */
export async function syncTemplatesWithMetaClient(metaClient) {
  const templates = await metaClient.fetchTemplates();
  return syncTemplatesFromData(templates);
}

/**
 * Fetches templates with optional search and category filters.
 */
export async function listTemplates({ search = '', category = '', status = '' } = {}) {
  const conditions = [];
  const values = [];

  if (category) {
    values.push(category);
    conditions.push(`category = $${values.length}`);
  }

  if (status) {
    values.push(status);
    conditions.push(`status = $${values.length}`);
  }

  if (search) {
    values.push(`%${search}%`);
    conditions.push(`(name ILIKE $${values.length} OR components::text ILIKE $${values.length})`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const res = await pool.query(`
    SELECT id, meta_template_id, name, language, category, status, components, created_at, updated_at
    FROM meta_templates
    ${whereClause}
    ORDER BY updated_at DESC
  `, values);

  // If table is empty or has no approved templates on fresh install, auto-seed defaults
  if (res.rows.length === 0 && !search && !category) {
    try {
      const countRes = await pool.query("SELECT COUNT(*) FROM meta_templates WHERE status = 'APPROVED'");
      if (parseInt(countRes.rows[0]?.count || '0', 10) === 0) {
        const client = new MpwaClient({
          apiKey: config.MPWA_API_KEY || 'm87iDrDIqNxZaodjybbhE6HSnzxd9A',
          sender: config.MPWA_SENDER || '6287786686392',
          baseUrl: config.MPWA_BASE_URL || 'https://www.wa-admin.novamedia.my.id'
        });
        await syncTemplatesWithMetaClient(client);

        const reQuery = await pool.query(`
          SELECT id, meta_template_id, name, language, category, status, components, created_at, updated_at
          FROM meta_templates
          ${whereClause}
          ORDER BY updated_at DESC
        `, values);
        return reQuery.rows;
      }
    } catch {
      // Return initial rows if auto-sync fails
    }
  }

  return res.rows;
}

/**
 * Gets single template by ID.
 */
export async function getTemplateById(id) {
  const res = await pool.query(`
    SELECT * FROM meta_templates WHERE id = $1
  `, [id]);
  return res.rows[0] || null;
}
