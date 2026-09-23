import pino from 'pino';
import { runOnce } from './run-once.js';

const logger = pino({ name: 'bps-worker' });

export async function run() {
  logger.info({ event: 'worker_start' }, 'One-shot worker started');
  const result = await runOnce({ logger });
  logger.info({ event: 'worker_finish', result }, 'One-shot worker finished');
  return result;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  run().catch((err) => {
    logger.error({ err }, 'Worker fatal error');
    process.exit(1);
  });
}
