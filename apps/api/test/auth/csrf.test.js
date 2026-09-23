import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import argon2 from 'argon2';
import { createApp } from '../../src/app.js';
import { pool } from '../../src/db/pool.js';
import { config } from '../../src/config.js';
import { ROLES } from '@bps/shared';

describe('CSRF Protection', () => {
  let app;
  let sessionCookie;
  let validCsrf;

  beforeAll(async () => {
    app = createApp({ config, db: pool, logger: false });

    const passwordHash = await argon2.hash('Csrf-Pass-12345');
    const userRes = await pool.query(`
      INSERT INTO users (username, email, password_hash, name, is_active)
      VALUES ('csrf_user', 'csrf@bps.go.id', $1, 'CSRF User', true)
      ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
      RETURNING id
    `, [passwordHash]);
    const userId = userRes.rows[0].id;

    const roleRes = await pool.query('SELECT id FROM roles WHERE code = $1', [ROLES.SUPER_ADMIN]);
    if (roleRes.rows[0]) {
      await pool.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, roleRes.rows[0].id]);
    }

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'csrf@bps.go.id', password: 'Csrf-Pass-12345' });
    sessionCookie = loginRes.headers['set-cookie'];
    validCsrf = loginRes.body.csrfToken;
  });

  afterAll(async () => {
    await pool.query("DELETE FROM users WHERE email = 'csrf@bps.go.id'");
  });

  it('rejects mutating request when CSRF token is missing', async () => {
    const response = await request(app)
      .patch('/api/integrations/meta')
      .set('Cookie', sessionCookie)
      .send({});

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('CSRF_INVALID');
  });

  it('rejects mutating request when CSRF token is forged or mismatched', async () => {
    const response = await request(app)
      .patch('/api/integrations/meta')
      .set('Cookie', sessionCookie)
      .set('x-csrf-token', 'forged-token-value-1234567890abcdef')
      .send({});

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('CSRF_INVALID');
  });

  it('accepts mutating request when CSRF token is valid', async () => {
    const response = await request(app)
      .patch('/api/integrations/meta')
      .set('Cookie', sessionCookie)
      .set('x-csrf-token', validCsrf)
      .send({});

    expect(response.status).toBe(200);
  });
});
