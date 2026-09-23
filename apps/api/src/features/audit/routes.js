import express from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { PERMISSIONS } from '@bps/shared';

export function createAuditRouter({ db }) {
  const router = express.Router();
  router.use(authenticate);

  router.get('/audit-logs', authorize(PERMISSIONS.AUDIT_READ), async (req, res, next) => {
    try {
      const limit = req.query.limit ? Math.min(100, parseInt(req.query.limit, 10)) : 50;
      const { rows } = await db.query(`
        SELECT al.*, u.email as user_email
        FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.id
        ORDER BY al.created_at DESC
        LIMIT $1
      `, [limit]);

      res.json({ data: rows });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
