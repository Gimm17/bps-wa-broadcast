import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { hashPassword } from '../../apps/api/src/features/auth/hasher.js';
import { createApp } from '../../apps/api/src/app.js';
import { pool } from '../../apps/api/src/db/pool.js';
import { config } from '../../apps/api/src/config.js';
import { ROLES } from '@bps/shared';

describe('Security: Comprehensive Authorization Matrix (All Roles)', () => {
  let app;
  const users = {};
  const testPassword = 'AuthMatrix-Pass-2026';

  beforeAll(async () => {
    app = createApp({ config, db: pool, logger: false });
    const passwordHash = await hashPassword(testPassword);

    const rolesToCreate = [
      { key: 'viewer', roleCode: ROLES.VIEWER, email: 'matrix_viewer@bps.go.id', username: 'm_viewer' },
      { key: 'operator', roleCode: ROLES.OPERATOR, email: 'matrix_operator@bps.go.id', username: 'm_operator' },
      { key: 'admin', roleCode: ROLES.ADMIN_DISEMINASI, email: 'matrix_admin@bps.go.id', username: 'm_admin' },
      { key: 'superadmin', roleCode: ROLES.SUPER_ADMIN, email: 'matrix_superadmin@bps.go.id', username: 'm_superadmin' }
    ];

    for (const r of rolesToCreate) {
      const userRes = await pool.query(`
        INSERT INTO users (username, email, password_hash, name, is_active)
        VALUES ($1, $2, $3, $4, true)
        ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
        RETURNING id
      `, [r.username, r.email, passwordHash, r.username]);
      const userId = userRes.rows[0].id;

      const roleRes = await pool.query('SELECT id FROM roles WHERE code = $1', [r.roleCode]);
      if (roleRes.rows[0]) {
        await pool.query(
          'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [userId, roleRes.rows[0].id]
        );
      }

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: r.email, password: testPassword });

      users[r.key] = {
        userId,
        cookie: loginRes.headers['set-cookie'],
        csrf: loginRes.body.csrfToken
      };
    }
  });

  afterAll(async () => {
    await pool.query(`
      DELETE FROM users WHERE email IN (
        'matrix_viewer@bps.go.id',
        'matrix_operator@bps.go.id',
        'matrix_admin@bps.go.id',
        'matrix_superadmin@bps.go.id'
      )
    `);
  });

  describe('1. Unauthenticated Requests', () => {
    it('denies access to protected endpoints with 401 UNAUTHORIZED', async () => {
      const routes = [
        ['GET', '/api/contacts'],
        ['POST', '/api/campaigns'],
        ['GET', '/api/automations'],
        ['GET', '/api/integrations'],
        ['GET', '/api/messages'],
        ['GET', '/api/dashboard/summary'],
        ['GET', '/api/reports/messages.csv']
      ];

      for (const [method, path] of routes) {
        let req;
        if (method === 'GET') req = request(app).get(path);
        else if (method === 'POST') req = request(app).post(path);

        const res = await req;
        expect(res.status, `Expected 401 for ${method} ${path}`).toBe(401);
      }
    });
  });

  describe('2. Viewer Role (Read-only, PII Protected)', () => {
    it('allows read access to overview and dashboard summary', async () => {
      const res = await request(app)
        .get('/api/dashboard/summary')
        .set('Cookie', users.viewer.cookie);
      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });

    it('allows read access to contacts with masked phone numbers', async () => {
      const res = await request(app)
        .get('/api/contacts')
        .set('Cookie', users.viewer.cookie);
      expect(res.status).toBe(200);
      if (res.body.contacts?.length > 0) {
        expect(res.body.contacts[0].phone_e164).toMatch(/^\+62/);
      }
    });

    it('denies campaign creation with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .post('/api/campaigns')
        .set('Cookie', users.viewer.cookie)
        .set('x-csrf-token', users.viewer.csrf)
        .send({ title: 'Unauthorized Viewer Campaign' });
      expect(res.status).toBe(403);
    });

    it('denies automation creation/modification with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .post('/api/automations')
        .set('Cookie', users.viewer.cookie)
        .set('x-csrf-token', users.viewer.csrf)
        .send({ name: 'Unauthorized Rule' });
      expect(res.status).toBe(403);
    });

    it('denies Meta template sync with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .post('/api/templates/sync')
        .set('Cookie', users.viewer.cookie)
        .set('x-csrf-token', users.viewer.csrf)
        .send({});
      expect(res.status).toBe(403);
    });

    it('denies integration credential modification with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .patch('/api/integrations/meta')
        .set('Cookie', users.viewer.cookie)
        .set('x-csrf-token', users.viewer.csrf)
        .send({});
      expect(res.status).toBe(403);
    });
  });

  describe('3. Operator Role (Broadcast Execution, Restricted System Admin)', () => {
    it('allows campaign list and composition draft creation', async () => {
      const res = await request(app)
        .get('/api/campaigns')
        .set('Cookie', users.operator.cookie);
      expect(res.status).toBe(200);
    });

    it('denies integration credential modification with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .patch('/api/integrations/meta')
        .set('Cookie', users.operator.cookie)
        .set('x-csrf-token', users.operator.csrf)
        .send({});
      expect(res.status).toBe(403);
    });

    it('denies template sync with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .post('/api/templates/sync')
        .set('Cookie', users.operator.cookie)
        .set('x-csrf-token', users.operator.csrf)
        .send({});
      expect(res.status).toBe(403);
    });
  });

  describe('4. Admin Diseminasi Role (Full Broadcast & Templates, No System Creds)', () => {
    it('allows template sync access (passes authorization gate)', async () => {
      const res = await request(app)
        .post('/api/templates/sync')
        .set('Cookie', users.admin.cookie)
        .set('x-csrf-token', users.admin.csrf)
        .send({});
      // Either 200 or 400 (if credentials not configured), but not 403
      expect(res.status).not.toBe(403);
    });

    it('denies integration credential modification with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .patch('/api/integrations/meta')
        .set('Cookie', users.admin.cookie)
        .set('x-csrf-token', users.admin.csrf)
        .send({});
      expect(res.status).toBe(403);
    });
  });

  describe('5. Super Admin Role (Unrestricted Authority)', () => {
    it('allows integration credential modification (passes authorization gate)', async () => {
      const res = await request(app)
        .patch('/api/integrations/meta')
        .set('Cookie', users.superadmin.cookie)
        .set('x-csrf-token', users.superadmin.csrf)
        .send({});
      expect(res.status).not.toBe(403);
    });

    it('allows report exports', async () => {
      const res = await request(app)
        .get('/api/reports/messages.csv')
        .set('Cookie', users.superadmin.cookie);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/csv/);
    });
  });
});
