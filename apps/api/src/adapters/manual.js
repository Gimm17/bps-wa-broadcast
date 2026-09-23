/**
 * Manual & Test Trigger Adapter.
 */
export function createManualAdapter() {
  return {
    async normalizeEvent(eventData) {
      return {
        source: eventData.source || 'manual_trigger',
        eventType: eventData.eventType || 'test',
        externalId: eventData.externalId || `manual-${Date.now()}`,
        payload: eventData.payload || {},
        observedAt: new Date().toISOString()
      };
    }
  };
}
