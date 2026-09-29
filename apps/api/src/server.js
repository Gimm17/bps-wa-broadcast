import dns from 'node:dns';
import { config } from './config.js';
import { createApp } from './app.js';
import pino from 'pino';

try {
  dns.setDefaultResultOrder('ipv4first');
} catch (_) {}

const logger = pino({ name: 'bps-api' });
const app = createApp({ config, db: null, logger });

let workerTimer = null;
let isWorkerRunning = false;

function startBackgroundWorker({ intervalMs = 15000 } = {}) {
  logger.info({ intervalMs }, 'Starting in-process background worker scheduler');

  async function tick() {
    if (isWorkerRunning) return;
    isWorkerRunning = true;
    try {
      const { runOnce } = await import('../../worker/src/run-once.js');
      await runOnce({ logger });
    } catch (err) {
      logger.warn({ err: err.message }, 'In-process background worker tick encountered error');
    } finally {
      isWorkerRunning = false;
    }
  }

  // Run initial tick after 3 seconds, then repeat every interval
  setTimeout(tick, 3000);
  workerTimer = setInterval(tick, intervalMs);
}

if (process.env.NODE_ENV !== 'test') {
  const server = app.listen(config.PORT, () => {
    logger.info({ port: config.PORT, env: config.NODE_ENV }, `BPS WhatsApp Operations API running on port ${config.PORT}`);
    startBackgroundWorker({ intervalMs: 15000 });
  });

  const shutdown = () => {
    if (workerTimer) clearInterval(workerTimer);
    server.close(() => {
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

export default app;

