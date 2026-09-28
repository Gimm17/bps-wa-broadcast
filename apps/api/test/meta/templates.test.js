import { describe, expect, it, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../../src/db/pool.js';
import { syncTemplatesFromData } from '../../src/features/meta/templates.js';
import { seed as seedTemplates } from '../../../../db/seeds/004_default_templates_and_integrations.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const templateFixturePath = path.resolve(__dirname, '../../../../tests/contract/meta/template-list.json');
const templateFixture = JSON.parse(fs.readFileSync(templateFixturePath, 'utf8'));

describe('Meta Template Synchronization', () => {
  afterAll(async () => {
    await seedTemplates(pool);
  });

  it('synchronizes and upserts templates from Meta WABA payload', async () => {
    const result = await syncTemplatesFromData(templateFixture.data);

    expect(result.upsertedCount).toBe(2);

    const res = await pool.query(`
      SELECT name, language, category, status, components
      FROM meta_templates
      WHERE name = 'brs_rilis_bulanan'
    `);

    expect(res.rows.length).toBe(1);
    const tmpl = res.rows[0];
    expect(tmpl.status).toBe('APPROVED');
    expect(tmpl.category).toBe('UTILITY');
    expect(tmpl.language).toBe('id');
    expect(Array.isArray(tmpl.components)).toBe(true);
    expect(tmpl.components.length).toBe(3);
  });

  it('allows manual creation and updating of templates', async () => {
    const customName = `manual_tmpl_${Date.now()}`;
    const insertRes = await pool.query(`
      INSERT INTO meta_templates (name, language, category, status, components, updated_at)
      VALUES ($1, 'id', 'UTILITY', 'APPROVED', $2, now())
      RETURNING *
    `, [
      customName,
      JSON.stringify([
        { type: 'HEADER', format: 'TEXT', text: 'Pemberitahuan Khusus' },
        { type: 'BODY', text: 'Halo {{1}}, data {{2}} telah terbit.' },
        { type: 'FOOTER', text: 'BPS Sulteng' }
      ])
    ]);

    expect(insertRes.rows.length).toBe(1);
    const created = insertRes.rows[0];
    expect(created.name).toBe(customName);
    expect(created.status).toBe('APPROVED');

    // Update template
    const updateRes = await pool.query(`
      UPDATE meta_templates
      SET category = 'MARKETING',
          components = $1,
          updated_at = now()
      WHERE id = $2
      RETURNING *
    `, [
      JSON.stringify([
        { type: 'BODY', text: 'Halo {{1}}, publikasi {{2}} terbaru dapat diakses di portal kami.' }
      ]),
      created.id
    ]);

    expect(updateRes.rows[0].category).toBe('MARKETING');
    const updatedComponents = typeof updateRes.rows[0].components === 'string'
      ? JSON.parse(updateRes.rows[0].components)
      : updateRes.rows[0].components;
    expect(updatedComponents.length).toBe(1);

    // Delete unreferenced template
    await pool.query('DELETE FROM meta_templates WHERE id = $1', [created.id]);
    const checkDeleted = await pool.query('SELECT * FROM meta_templates WHERE id = $1', [created.id]);
    expect(checkDeleted.rows.length).toBe(0);
  });

  it('archives template if referenced by messages or campaigns', async () => {
    const customName = `archived_tmpl_${Date.now()}`;
    const insertRes = await pool.query(`
      INSERT INTO meta_templates (name, language, category, status, components, updated_at)
      VALUES ($1, 'id', 'UTILITY', 'APPROVED', $2, now())
      RETURNING *
    `, [
      customName,
      JSON.stringify([{ type: 'BODY', text: 'Uji arsip {{1}}' }])
    ]);
    const createdId = insertRes.rows[0].id;

    // Simulate reference in campaigns or archive update
    await pool.query("UPDATE meta_templates SET status = 'ARCHIVED', updated_at = now() WHERE id = $1", [createdId]);
    const checkRes = await pool.query('SELECT status FROM meta_templates WHERE id = $1', [createdId]);
    expect(checkRes.rows[0].status).toBe('ARCHIVED');

    // Cleanup
    await pool.query('DELETE FROM meta_templates WHERE id = $1', [createdId]);
  });
});
