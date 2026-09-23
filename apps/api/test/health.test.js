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
