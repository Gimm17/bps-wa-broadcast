import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Publications and BRS Release Adapter for BPS Sulawesi Tengah.
 */
export function createPublicationsAdapter({ endpoint = null, apiKey = null } = {}) {
  return {
    async fetchReleases({ since = null } = {}) {
      if (endpoint) {
        const res = await fetch(`${endpoint}/releases?since=${encodeURIComponent(since || '')}`, {
          headers: { Authorization: `Bearer ${apiKey}` }
        });
        if (!res.ok) throw new Error(`Publications API error ${res.status}`);
        return await res.json();
      }

      const defaultFixture = path.resolve(process.cwd(), 'tests/contract/publications/release.json');
      const content = await fs.readFile(defaultFixture, 'utf-8');
      const data = JSON.parse(content);
      return [data];
    }
  };
}
