import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('GET /api/health/live', () => {
  it('returns a correlation id and live status', async () => {
    const response = await request(createApp({ config: {}, db: null, logger: false }))
      .get('/api/health/live');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'ok' });
    expect(response.headers['x-correlation-id']).toBeTruthy();
  });
});

describe('GET /api/health/ready', () => {
  it('allows hosting probes to check the database without a login session', async () => {
    const db = {
      query: async (sql) => {
        if (sql.includes('SELECT 1')) return { rows: [{ ok: 1 }] };
        if (sql.includes('worker_heartbeats')) return { rows: [{ sec: 10 }] };
        return { rows: [{ cnt: 0 }] };
      }
    };
    const response = await request(createApp({ config: {}, db, logger: false }))
      .get('/api/health/ready');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'ready', checks: { database: true } });
  });
});
