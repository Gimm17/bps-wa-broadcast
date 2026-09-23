import crypto from 'node:crypto';
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { authRouter } from './features/auth/routes.js';
import { contactsRouter } from './features/contacts/routes.js';
import { subscriptionsRouter } from './features/subscriptions/routes.js';
import { metaRouter } from './features/meta/routes.js';
import { campaignsRouter } from './features/campaigns/routes.js';
import { createCalendarRouter } from './features/calendar/routes.js';
import { createAutomationsRouter } from './features/automations/routes.js';
import { createDashboardRouter } from './features/dashboard/routes.js';
import { createMessagesRouter } from './features/messages/routes.js';
import { createHealthRouter } from './features/health/routes.js';
import { createReportsRouter } from './features/reports/routes.js';
import { createAuditRouter } from './features/audit/routes.js';
import { pool as defaultPool } from './db/pool.js';
import { authenticate } from './middleware/authenticate.js';
import { authorize } from './middleware/authorize.js';
import { validateCsrf } from './middleware/csrf.js';
import { PERMISSIONS } from '@bps/shared';

export function createApp({ config, db, logger }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cookieParser());
  app.use(express.json());

  app.use((req, res, next) => {
    const id = req.get('x-correlation-id') || crypto.randomUUID();
    req.correlationId = id;
    res.set('x-correlation-id', id);
    next();
  });

  app.get('/api/health/live', (req, res) => res.json({ status: 'ok' }));

  const activeDb = db || defaultPool;

  // Feature routes
  app.use('/api/auth', authRouter);
  app.use('/api', contactsRouter);
  app.use('/api', subscriptionsRouter);
  app.use('/api', metaRouter);
  app.use('/api', campaignsRouter);
  app.use('/api/calendar', createCalendarRouter({ db: activeDb }));
  app.use('/api', createAutomationsRouter({ db: activeDb }));
  app.use('/api', createDashboardRouter({ db: activeDb }));
  app.use('/api', createMessagesRouter({ db: activeDb }));
  app.use('/api', createHealthRouter({ db: activeDb }));
  app.use('/api', createReportsRouter({ db: activeDb }));
  app.use('/api', createAuditRouter({ db: activeDb }));

  // Common error envelope
  app.use((err, req, res, next) => {
    const status = err.status || 500;
    const code = err.code || 'INTERNAL_ERROR';
    const message = err.message || 'Terjadi kesalahan pada server';
    if (logger && typeof logger.error === 'function') {
      logger.error({ err, correlationId: req.correlationId }, 'Unhandled request error');
    }
    res.status(status).json({
      error: {
        code,
        message,
        correlationId: req.correlationId
      }
    });
  });

  return app;
}
