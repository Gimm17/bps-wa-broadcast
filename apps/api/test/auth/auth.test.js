import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { hashPassword } from '../../src/features/auth/hasher.js';
import { createApp } from '../../src/app.js';
import { pool } from '../../src/db/pool.js';
import { config } from '../../src/config.js';
import { ROLES } from '@bps/shared';

describe('Authentication & Sessions', () => {
  let app;
  const testUser = {
    username: 'admin_test',
    email: 'admin@bps.go.id',
    password: 'Valid-Passphrase-42',
    name: 'Admin Test'
  };

  beforeAll(async () => {
    app = createApp({ config, db: pool, logger: false });

    // Seed test user with super_admin role
    const passwordHash = await hashPassword(testUser.password);
    const userRes = await pool.query(`
      INSERT INTO users (username, email, password_hash, name, is_active)
      VALUES ($1, $2, $3, $4, true)
      ON CONFLICT (email) DO UPDATE
      SET password_hash = EXCLUDED.password_hash, is_active = true, failed_login_attempts = 0, locked_until = null
      RETURNING id
    `, [testUser.username, testUser.email, passwordHash, testUser.name]);

    const userId = userRes.rows[0].id;
    const roleRes = await pool.query('SELECT id FROM roles WHERE code = $1', [ROLES.SUPER_ADMIN]);
    if (roleRes.rows[0]) {
      await pool.query(`
        INSERT INTO user_roles (user_id, role_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
      `, [userId, roleRes.rows[0].id]);
    }
  });

  afterAll(async () => {
    await pool.query('DELETE FROM users WHERE email = $1', [testUser.email]);
  });

  it('sets an opaque secure session and never returns a password hash', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: testUser.email, password: testUser.password });

    expect(response.status).toBe(200);
    expect(response.headers['set-cookie']).toBeDefined();
    expect(response.headers['set-cookie'][0]).toContain('bps_session=');
    expect(response.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(response.body.user).toBeDefined();
    expect(response.body.user.passwordHash).toBeUndefined();
    expect(response.body.user.password_hash).toBeUndefined();
    expect(response.body.csrfToken).toBeDefined();
  });

  it('rejects invalid password', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: testUser.email, password: 'Wrong-Password-123' });

    expect(response.status).toBe(401);
    expect(response.body.error).toBeDefined();
    expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('allows logging out and revokes the session', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: testUser.email, password: testUser.password });

    const cookie = loginRes.headers['set-cookie'];
    const csrfToken = loginRes.body.csrfToken;

    // Verify session works with /api/auth/me
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Cookie', cookie);
    expect(meRes.status).toBe(200);
    expect(meRes.body.user.email).toBe(testUser.email);

    // Logout
    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', cookie)
      .set('x-csrf-token', csrfToken);
    expect(logoutRes.status).toBe(200);

    // After logout, session is revoked
    const meAfterLogout = await request(app)
      .get('/api/auth/me')
      .set('Cookie', cookie);
    expect(meAfterLogout.status).toBe(401);
  });
});
