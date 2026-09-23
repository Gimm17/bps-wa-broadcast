import express from 'express';
import { listMessageLogs, getMessageDetail } from './repository.js';
import { authenticate } from '../../middleware/authenticate.js';

export function createMessagesRouter({ db }) {
  const router = express.Router();
  router.use(authenticate);

  router.get('/messages', async (req, res, next) => {
    try {
      const userRole = req.user?.role || 'viewer';
      const limit = req.query.limit ? Math.min(100, parseInt(req.query.limit, 10)) : 25;
      const cursor = req.query.cursor || null;
      const status = req.query.status || null;
      const campaignId = req.query.campaignId || null;
      const search = req.query.search || null;

      const result = await listMessageLogs(db, {
        userRole,
        limit,
        cursor,
        status,
        campaignId,
        search
      });

      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  router.get('/messages/:id', async (req, res, next) => {
    try {
      const userRole = req.user?.role || 'viewer';
      const detail = await getMessageDetail(db, req.params.id, { userRole });
      if (!detail) {
        return res.status(404).json({ error: { message: 'Pesan tidak ditemukan' } });
      }
      res.json({ data: detail });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
