import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import argon2 from 'argon2';
import { createApp } from '../../apps/api/src/app.js';
import { pool } from '../../apps/api/src/db/pool.js';
import { config } from '../../apps/api/src/config.js';
import { ROLES } from '@bps/shared';

describe('E2E Acceptance: Authentication & Session Lifecycle', () => {
  let app;
  const testUser = {
    username: 'e2e_auth_user',
    email: 'e2e_auth@bps.go.id',
    password: 'E2E-SecurePassword-2026',
    name: 'E2E Auth User'
  };

  beforeAll(async () => {
    app = createApp({ config, db: pool, logger: false });

    const passwordHash = await argon2.hash(testUser.password);
    const userRes = await pool.query(`
      INSERT INTO users (username, email, password_hash, name, is_active)
      VALUES ($1, $2, $3, $4, true)
      ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
      RETURNING id
    `, [testUser.username, testUser.email, passwordHash, testUser.name]);

    const userId = userRes.rows[0].id;
    const roleRes = await pool.query('SELECT id FROM roles WHERE code = $1', [ROLES.OPERATOR]);
    if (roleRes.rows[0]) {
      await pool.query(
        'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [userId, roleRes.rows[0].id]
      );
    }
  });

  afterAll(async () => {
    await pool.query('DELETE FROM users WHERE email = $1', [testUser.email]);
  });

  it('rejects login with incorrect password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: testUser.email, password: 'WrongPassword123' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('successfully logs in, receives opaque session cookie and CSRF token', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: testUser.email, password: testUser.password });

    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe(testUser.email);
    expect(res.body.user.password_hash).toBeUndefined(); // Password hash never leaked
    expect(res.body.csrfToken).toBeDefined();

    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies.some(c => c.includes('bps_session='))).toBe(true);

    const sessionCookie = cookies;

    // 2. Query /api/auth/me with session cookie
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Cookie', sessionCookie);

    expect(meRes.status).toBe(200);
    expect(meRes.body.user.email).toBe(testUser.email);
    expect(meRes.body.user.roles).toContain(ROLES.OPERATOR);

    // 3. Logout revoking session
    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', sessionCookie)
      .set('x-csrf-token', res.body.csrfToken);

    expect(logoutRes.status).toBe(200);

    // 4. Verify session is no longer active
    const revokedRes = await request(app)
      .get('/api/auth/me')
      .set('Cookie', sessionCookie);

    expect(revokedRes.status).toBe(401);
  });
});
