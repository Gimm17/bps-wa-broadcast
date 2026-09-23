import pino from 'pino';

const logger = pino({ name: 'bps-worker' });

export async function run() {
  logger.info({ event: 'worker_start' }, 'One-shot worker started');
  // Worker logic will be implemented in subsequent tasks
  logger.info({ event: 'worker_finish' }, 'One-shot worker finished');
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  run().catch((err) => {
    logger.error({ err }, 'Worker fatal error');
    process.exit(1);
  });
}
