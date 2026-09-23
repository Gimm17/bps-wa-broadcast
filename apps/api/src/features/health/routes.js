import express from 'express';
import { checkSystemReadiness, listSystemAlerts } from './service.js';
import { authenticate } from '../../middleware/authenticate.js';

export function createHealthRouter({ db }) {
  const router = express.Router();

  // Public readiness probe for hosting panels
  router.get('/health/ready', async (req, res) => {
    const health = await checkSystemReadiness(db);
    const status = health.status === 'ready' ? 200 : 503;
    res.status(status).json(health);
  });

  // Authenticated alerts list
  router.get('/health/alerts', authenticate, async (req, res, next) => {
    try {
      const alerts = await listSystemAlerts(db);
      res.json({ data: alerts });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
