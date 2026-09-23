import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * SIMPEG Presensi Adapter for BPS Provinsi Sulawesi Tengah.
 * In production, queries internal BPS presensi endpoint.
 * In local/mock mode, loads contract fixture or configured fixture.
 */
export function createAttendanceAdapter({ endpoint = null, apiKey = null, fixturePath = null } = {}) {
  return {
    async fetchStatus() {
      if (endpoint) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        try {
          const res = await fetch(endpoint, {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            },
            signal: controller.signal
          });
          if (!res.ok) {
            throw new Error(`SIMPEG API error status ${res.status}`);
          }
          return await res.json();
        } finally {
          clearTimeout(timeout);
        }
      }

      // Default: load contract fixture
      const defaultFixture = path.resolve(process.cwd(), 'tests/contract/attendance/not-checked-in.json');
      const content = await fs.readFile(fixturePath || defaultFixture, 'utf-8');
      const data = JSON.parse(content);
      // For testing, make observedAt dynamically fresh unless overridden
      return {
        ...data,
        observedAt: new Date().toISOString()
      };
    }
  };
}
