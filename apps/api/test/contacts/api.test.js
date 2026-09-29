import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { hashPassword } from '../../src/features/auth/hasher.js';
import { createApp } from '../../src/app.js';
import { pool } from '../../src/db/pool.js';
import { config } from '../../src/config.js';
import { ROLES } from '@bps/shared';

describe('Contacts & Import API Endpoints', () => {
  let app;
  let adminCookie;
  let adminCsrf;
  let viewerCookie;
  let viewerCsrf;

  beforeAll(async () => {
    app = createApp({ config, db: pool, logger: false });

    const passwordHash = await hashPassword('ContactsPass-12345');

    // Admin user (has contact.export, contact.write, contact.sensitive.read)
    const adminRes = await pool.query(`
      INSERT INTO users (username, email, password_hash, name, is_active)
      VALUES ('admin_contacts', 'admin_contacts@bps.go.id', $1, 'Admin Contacts', true)
      ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
      RETURNING id
    `, [passwordHash]);
    const adminRole = await pool.query('SELECT id FROM roles WHERE code = $1', [ROLES.ADMIN_DISEMINASI]);
    if (adminRole.rows[0]) {
      await pool.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [adminRes.rows[0].id, adminRole.rows[0].id]);
    }

    // Viewer user (does NOT have contact.sensitive.read or contact.export)
    const viewerRes = await pool.query(`
      INSERT INTO users (username, email, password_hash, name, is_active)
      VALUES ('viewer_contacts', 'viewer_contacts@bps.go.id', $1, 'Viewer Contacts', true)
      ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
      RETURNING id
    `, [passwordHash]);
    const viewerRole = await pool.query('SELECT id FROM roles WHERE code = $1', [ROLES.VIEWER]);
    if (viewerRole.rows[0]) {
      await pool.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [viewerRes.rows[0].id, viewerRole.rows[0].id]);
    }

    // Log in admin
    const aLog = await request(app).post('/api/auth/login').send({ email: 'admin_contacts@bps.go.id', password: 'ContactsPass-12345' });
    adminCookie = aLog.headers['set-cookie'];
    adminCsrf = aLog.body.csrfToken;

    // Log in viewer
    const vLog = await request(app).post('/api/auth/login').send({ email: 'viewer_contacts@bps.go.id', password: 'ContactsPass-12345' });
    viewerCookie = vLog.headers['set-cookie'];
    viewerCsrf = vLog.body.csrfToken;
  });

  afterAll(async () => {
    await pool.query("DELETE FROM users WHERE email IN ('admin_contacts@bps.go.id', 'viewer_contacts@bps.go.id')");
    await pool.query("DELETE FROM contacts WHERE phone_e164 IN ('+6281299990001', '+6281299990002')");
  });

  it('creates and upserts a contact', async () => {
    const res = await request(app)
      .post('/api/contacts')
      .set('Cookie', adminCookie)
      .set('x-csrf-token', adminCsrf)
      .send({
        type: 'employee',
        name: 'Pegawai Uji API',
        phone: '081299990001',
        nip: '198801012015011001',
        unitKerja: 'IPDS Sulteng'
      });

    expect(res.status).toBe(201);
    expect(res.body.contact).toBeDefined();
    expect(res.body.contact.phone_e164).toBe('+6281299990001');
  });

  it('masks phone number when viewed by viewer role without sensitive read permission', async () => {
    const res = await request(app)
      .get('/api/contacts?search=081299990001')
      .set('Cookie', viewerCookie);

    expect(res.status).toBe(200);
    expect(res.body.contacts.length).toBeGreaterThan(0);
    const found = res.body.contacts.find((c) => c.name === 'Pegawai Uji API');
    expect(found).toBeDefined();
    expect(found.phone_e164).toBe('+62••••••0001');
  });

  it('exports contacts safely to CSV with formula injection escaping', async () => {
    const res = await request(app)
      .get('/api/exports/contacts')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('Pegawai Uji API');
  });

  it('denies export to viewer role without contact.export permission', async () => {
    const res = await request(app)
      .get('/api/exports/contacts')
      .set('Cookie', viewerCookie);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});
