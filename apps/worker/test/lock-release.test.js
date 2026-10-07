import { describe, expect, it, vi } from 'vitest';
import { runOnce } from '../src/run-once.js';

describe('Worker skipped runs', () => {
  it('returns every connection when another worker owns the lock', async () => {
    const clients = [];
    const db = {
      connect: vi.fn(async () => {
        const client = {
          query: vi.fn(async () => ({ rows: [{ acquired: false }] })),
          release: vi.fn()
        };
        clients.push(client);
        return client;
      }),
      query: vi.fn()
    };
    const logger = { info: vi.fn() };

    // More skipped ticks than the production pool capacity must not exhaust it.
    for (let tick = 0; tick < 12; tick++) {
      const result = await runOnce({ db, logger, metaClient: null });
      expect(result.status).toBe('locked_by_other_instance');
    }

    expect(clients).toHaveLength(12);
    for (const client of clients) expect(client.release).toHaveBeenCalledTimes(1);
    expect(db.query).not.toHaveBeenCalled();
  });
});
