import express from 'express';
import { getDashboardSummary, getDashboardTrends, getHealthSummary } from './repository.js';
import { authenticate } from '../../middleware/authenticate.js';

export function createDashboardRouter({ db }) {
  const router = express.Router();
  router.use(authenticate);

  router.get('/dashboard/summary', async (req, res, next) => {
    try {
      const { from, to } = req.query;
      const summary = await getDashboardSummary(db, { from, to });
      res.json({ data: summary });
    } catch (err) {
      next(err);
    }
  });

  router.get('/dashboard/trends', async (req, res, next) => {
    try {
      const days = req.query.days ? parseInt(req.query.days, 10) : 14;
      const trends = await getDashboardTrends(db, { days });
      res.json({ data: trends });
    } catch (err) {
      next(err);
    }
  });

  router.get('/dashboard/health', async (req, res, next) => {
    try {
      const health = await getHealthSummary(db);
      res.json({ data: health });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
