import crypto from 'node:crypto';
import express from 'express';
import helmet from 'helmet';

export function createApp({ config, db, logger }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use((req, res, next) => {
    const id = req.get('x-correlation-id') || crypto.randomUUID();
    req.correlationId = id;
    res.set('x-correlation-id', id);
    next();
  });

  app.get('/api/health/live', (req, res) => res.json({ status: 'ok' }));

  return app;
}
