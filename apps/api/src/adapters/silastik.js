import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Silastik PST (Pelayanan Statistik Terpadu) Adapter.
 */
export function createSilastikAdapter({ endpoint = null, apiKey = null } = {}) {
  return {
    async fetchTransactions({ since = null } = {}) {
      if (endpoint) {
        const res = await fetch(`${endpoint}/transactions?since=${encodeURIComponent(since || '')}`, {
          headers: { Authorization: `Bearer ${apiKey}` }
        });
        if (!res.ok) throw new Error(`Silastik API error ${res.status}`);
        return await res.json();
      }

      const defaultFixture = path.resolve(process.cwd(), 'tests/contract/silastik/new-transaction.json');
      const content = await fs.readFile(defaultFixture, 'utf-8');
      const data = JSON.parse(content);
      return [data];
    }
  };
}
