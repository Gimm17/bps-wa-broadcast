import { config } from './config.js';
import { createApp } from './app.js';
import pino from 'pino';

const logger = pino({ name: 'bps-api' });
const app = createApp({ config, db: null, logger });

if (process.env.NODE_ENV !== 'test') {
  app.listen(config.PORT, () => {
    logger.info({ port: config.PORT, env: config.NODE_ENV }, `BPS WhatsApp Operations API running on port ${config.PORT}`);
  });
}

export default app;
