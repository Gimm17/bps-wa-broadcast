/**
 * Batch File Import Event Adapter.
 */
export function createImportAdapter() {
  return {
    normalizeBatch(rows, source = 'import_batch') {
      return rows.map((row, idx) => ({
        source,
        eventType: row.eventType || 'imported_record',
        externalId: row.externalId || `import-${idx}-${Date.now()}`,
        payload: row,
        observedAt: new Date().toISOString()
      }));
    }
  };
}
