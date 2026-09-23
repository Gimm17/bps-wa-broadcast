import { describe, expect, it, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../../src/db/pool.js';
import { syncTemplatesFromData } from '../../src/features/meta/templates.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const templateFixturePath = path.resolve(__dirname, '../../../../tests/contract/meta/template-list.json');
const templateFixture = JSON.parse(fs.readFileSync(templateFixturePath, 'utf8'));

describe('Meta Template Synchronization', () => {
  afterAll(async () => {
    await pool.query("DELETE FROM meta_templates WHERE name IN ('brs_rilis_bulanan', 'pengingat_presensi_pegawai')");
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
});
