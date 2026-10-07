import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '../src/lib/api/client.js';

afterEach(() => vi.unstubAllGlobals());

describe('API error messages', () => {
  it('identifies an HTML gateway failure as a server problem', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 502 })));
    await expect(apiFetch('/auth/login', { method: 'POST' })).rejects.toMatchObject({
      error: { code: 'SERVER_UNAVAILABLE', message: expect.stringContaining('Server sedang bermasalah') }
    });
  });

  it('preserves the credential rejection from the API', async () => {
    const error = { error: { code: 'INVALID_CREDENTIALS', message: 'Email/username atau kata sandi tidak valid' } };
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 401, json: async () => error })));
    await expect(apiFetch('/auth/login', { method: 'POST' })).rejects.toEqual(error);
  });
});
