import { pool } from '../../db/pool.js';

export async function listAutomationRules(db = pool) {
  const { rows } = await db.query(`
    SELECT ar.*,
           mt.name as template_name,
           mt.language as template_language,
           (SELECT count(*) FROM trigger_events te WHERE te.source = ar.code) as total_events
    FROM automation_rules ar
    LEFT JOIN meta_templates mt ON ar.template_id = mt.id
    ORDER BY ar.created_at ASC
  `);
  return rows;
}

export async function getAutomationRuleById(db = pool, id) {
  const { rows } = await db.query(`
    SELECT ar.*,
           mt.name as template_name,
           mt.language as template_language
    FROM automation_rules ar
    LEFT JOIN meta_templates mt ON ar.template_id = mt.id
    WHERE ar.id = $1
  `, [id]);
  return rows[0] || null;
}

export async function createAutomationRule(db = pool, data) {
  const { code, name, type, templateId, isActive = true, config = {} } = data;
  const { rows } = await db.query(`
    INSERT INTO automation_rules (code, name, type, template_id, is_active, config)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `, [code, name, type, templateId, isActive, JSON.stringify(config)]);
  return rows[0];
}

export async function updateAutomationRule(db = pool, id, data) {
  const { name, type, templateId, isActive, config } = data;
  const { rows } = await db.query(`
    UPDATE automation_rules
    SET name = COALESCE($2, name),
        type = COALESCE($3, type),
        template_id = COALESCE($4, template_id),
        is_active = COALESCE($5, is_active),
        config = COALESCE($6, config),
        updated_at = now()
    WHERE id = $1
    RETURNING *
  `, [id, name, type, templateId, isActive, config ? JSON.stringify(config) : null]);
  return rows[0] || null;
}
