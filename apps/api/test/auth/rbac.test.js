import crypto from 'node:crypto';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import argon2 from 'argon2';
import { createApp } from '../../src/app.js';
import { pool } from '../../src/db/pool.js';
import { config } from '../../src/config.js';
import { ROLES } from '@bps/shared';

describe('Role-Based Access Control (RBAC)', () => {
  let app;
  let operatorCookie;
  let operatorCsrf;
  let adminCookie;
  let adminCsrf;

  beforeAll(async () => {
    app = createApp({ config, db: pool, logger: false });

    const passwordHash = await argon2.hash('TestPass-12345');

    // Create operator user
    const opRes = await pool.query(`
      INSERT INTO users (username, email, password_hash, name, is_active)
      VALUES ('operator_user', 'operator@bps.go.id', $1, 'Operator User', true)
      ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
      RETURNING id
    `, [passwordHash]);
    const opId = opRes.rows[0].id;
    const opRole = await pool.query('SELECT id FROM roles WHERE code = $1', [ROLES.OPERATOR]);
    if (opRole.rows[0]) {
      await pool.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [opId, opRole.rows[0].id]);
    }

    // Create super_admin user
    const adminRes = await pool.query(`
      INSERT INTO users (username, email, password_hash, name, is_active)
      VALUES ('super_admin_user', 'superadmin@bps.go.id', $1, 'Super Admin User', true)
      ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
      RETURNING id
    `, [passwordHash]);
    const adminId = adminRes.rows[0].id;
    const adminRole = await pool.query('SELECT id FROM roles WHERE code = $1', [ROLES.SUPER_ADMIN]);
    if (adminRole.rows[0]) {
      await pool.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [adminId, adminRole.rows[0].id]);
    }

    // Login operator
    const opLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'operator@bps.go.id', password: 'TestPass-12345' });
    operatorCookie = opLogin.headers['set-cookie'];
    operatorCsrf = opLogin.body.csrfToken;

    // Login super admin
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'superadmin@bps.go.id', password: 'TestPass-12345' });
    adminCookie = adminLogin.headers['set-cookie'];
    adminCsrf = adminLogin.body.csrfToken;
  });

  afterAll(async () => {
    await pool.query("DELETE FROM users WHERE email IN ('operator@bps.go.id', 'superadmin@bps.go.id')");
  });

  it('denies integration management to an operator', async () => {
    const response = await request(app)
      .patch('/api/integrations/meta')
      .set('Cookie', operatorCookie)
      .set('x-csrf-token', operatorCsrf)
      .send({});

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('allows integration management to super_admin', async () => {
    const response = await request(app)
      .patch('/api/integrations/meta')
      .set('Cookie', adminCookie)
      .set('x-csrf-token', adminCsrf)
      .send({});

    expect(response.status).not.toBe(403);
  });
});
