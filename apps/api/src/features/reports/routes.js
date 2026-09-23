import express from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { listMessageLogs } from '../messages/repository.js';
import { safeSpreadsheetCell, PERMISSIONS } from '@bps/shared';

export function createReportsRouter({ db }) {
  const router = express.Router();
  router.use(authenticate);

  router.get('/reports/messages/csv', authorize(PERMISSIONS.REPORT_EXPORT), async (req, res, next) => {
    try {
      const userRole = req.user?.role || 'viewer';
      const result = await listMessageLogs(db, {
        userRole,
        limit: 1000
      });

      const header = ['ID Pesan', 'Nama Kontak', 'Nomor WhatsApp', 'Tipe Kontak', 'Template', 'Status', 'ID Pesan Meta', 'Waktu Dibuat'];
      const rows = [header.join(',')];

      for (const m of result.items) {
        const row = [
          safeSpreadsheetCell(m.id),
          safeSpreadsheetCell(`"${(m.contact_name || '').replace(/"/g, '""')}"`),
          safeSpreadsheetCell(m.phone_e164),
          safeSpreadsheetCell(m.contact_type),
          safeSpreadsheetCell(m.template_name),
          safeSpreadsheetCell(m.status),
          safeSpreadsheetCell(m.meta_message_id || ''),
          safeSpreadsheetCell(m.created_at)
        ];
        rows.push(row.join(','));
      }

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="laporan-pesan-bps-sulteng.csv"');
      res.send(rows.join('\r\n'));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
