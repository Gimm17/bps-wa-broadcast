import express from 'express';
import { z } from 'zod';
import {
  listHolidays,
  addHolidayException,
  removeHolidayException,
  isWorkday,
  toWitaDate,
  getWitaNow
} from './service.js';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { auditLog } from '../../middleware/audit.js';

const holidaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
  description: z.string().min(2, 'Deskripsi wajib diisi'),
  isNational: z.boolean().default(false),
  isWorkday: z.boolean().default(false)
});

// Standard Indonesian 2026 National Holidays & Cuti Bersama based on SKB 3 Menteri
const SKB_2026_HOLIDAYS = [
  { date: '2026-01-01', description: 'Tahun Baru 2026 Masehi', isNational: true, isWorkday: false },
  { date: '2026-01-16', description: 'Isra Mikraj Nabi Muhammad SAW', isNational: true, isWorkday: false },
  { date: '2026-02-17', description: 'Tahun Baru Imlek 2577 Kongzili', isNational: true, isWorkday: false },
  { date: '2026-03-20', description: 'Hari Suci Nyepi Tahun Baru Saka 1948', isNational: true, isWorkday: false },
  { date: '2026-03-21', description: 'Hari Raya Idul Fitri 1447 Hijriah', isNational: true, isWorkday: false },
  { date: '2026-03-22', description: 'Hari Raya Idul Fitri 1447 Hijriah', isNational: true, isWorkday: false },
  { date: '2026-03-23', description: 'Cuti Bersama Idul Fitri 1447 H', isNational: true, isWorkday: false },
  { date: '2026-03-24', description: 'Cuti Bersama Idul Fitri 1447 H', isNational: true, isWorkday: false },
  { date: '2026-04-03', description: 'Wafat Yesus Kristus', isNational: true, isWorkday: false },
  { date: '2026-05-01', description: 'Hari Buruh Internasional', isNational: true, isWorkday: false },
  { date: '2026-05-14', description: 'Kenaikan Yesus Kristus', isNational: true, isWorkday: false },
  { date: '2026-05-27', description: 'Hari Raya Waisak 2570 BE', isNational: true, isWorkday: false },
  { date: '2026-05-28', description: 'Hari Raya Idul Adha 1447 Hijriah', isNational: true, isWorkday: false },
  { date: '2026-06-01', description: 'Hari Lahir Pancasila', isNational: true, isWorkday: false },
  { date: '2026-06-17', description: 'Tahun Baru Islam 1448 Hijriah', isNational: true, isWorkday: false },
  { date: '2026-08-17', description: 'Hari Kemerdekaan Republik Indonesia', isNational: true, isWorkday: false },
  { date: '2026-08-25', description: 'Maulid Nabi Muhammad SAW', isNational: true, isWorkday: false },
  { date: '2026-10-28', description: 'Hari Sumpah Pemuda / Libur SKB', isNational: true, isWorkday: false },
  { date: '2026-10-29', description: 'Cuti Bersama SKB 3 Menteri', isNational: true, isWorkday: false },
  { date: '2026-12-25', description: 'Hari Raya Natal', isNational: true, isWorkday: false }
];

export function createCalendarRouter({ db }) {
  const router = express.Router();

  // All calendar management requires login
  router.use(requireAuth);

  // List holidays and exceptions
  router.get('/holidays', async (req, res, next) => {
    try {
      const year = req.query.year ? parseInt(req.query.year, 10) : undefined;
      const month = req.query.month ? parseInt(req.query.month, 10) : undefined;

      let holidays = await listHolidays(db, { year, month });

      // If empty for 2026, auto-seed default SKB
      if (holidays.length === 0 && (!year || year === 2026)) {
        for (const h of SKB_2026_HOLIDAYS) {
          await addHolidayException(db, h);
        }
        holidays = await listHolidays(db, { year, month });
      }

      res.json({
        data: holidays,
        timezone: 'Asia/Makassar',
        currentWitaDate: toWitaDate(new Date())
      });
    } catch (err) {
      next(err);
    }
  });

  // Check workday status for a date
  router.get('/workday-check', async (req, res, next) => {
    try {
      const date = req.query.date || toWitaDate(new Date());
      const workday = await isWorkday(date, db);
      res.json({
        date,
        isWorkday: workday,
        timezone: 'Asia/Makassar'
      });
    } catch (err) {
      next(err);
    }
  });

  // Add holiday / exception
  router.post('/holidays', requirePermission('campaigns:create'), async (req, res, next) => {
    try {
      const parsed = holidaySchema.parse(req.body);
      const created = await addHolidayException(db, parsed);

      await auditLog(db, {
        userId: req.user.id,
        action: 'calendar:exception_create',
        resourceType: 'holiday_dates',
        resourceId: parsed.date,
        details: parsed,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      res.status(201).json({
        data: created,
        message: 'Jadwal / pengecualian kalender berhasil disimpan'
      });
    } catch (err) {
      next(err);
    }
  });

  // Delete holiday / exception
  router.delete('/holidays/:date', requirePermission('campaigns:create'), async (req, res, next) => {
    try {
      const { date } = req.params;
      const removed = await removeHolidayException(db, date);

      await auditLog(db, {
        userId: req.user.id,
        action: 'calendar:exception_delete',
        resourceType: 'holiday_dates',
        resourceId: date,
        details: { date },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      res.json({
        success: removed,
        message: 'Pengecualian kalender berhasil dihapus'
      });
    } catch (err) {
      next(err);
    }
  });

  // Sync SKB holidays
  router.post('/sync-skb', requirePermission('campaigns:create'), async (req, res, next) => {
    try {
      for (const h of SKB_2026_HOLIDAYS) {
        await addHolidayException(db, h);
      }

      await auditLog(db, {
        userId: req.user.id,
        action: 'calendar:sync_skb',
        resourceType: 'holiday_dates',
        resourceId: 'SKB_2026',
        details: { count: SKB_2026_HOLIDAYS.length },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      const updated = await listHolidays(db, { year: 2026 });
      res.json({
        data: updated,
        message: 'Sinkronisasi kalender SKB 3 Menteri 2026 berhasil diterapkan'
      });
    } catch (err) {
      next(err);
    }
  });

  // Get active schedules
  router.get('/schedules', async (req, res, next) => {
    try {
      const { rows } = await db.query(`
        SELECT s.*, 
               c.title as campaign_title,
               c.type as campaign_type,
               c.status as campaign_status,
               ar.name as automation_rule_name,
               ar.type as automation_rule_type
        FROM schedules s
        LEFT JOIN campaigns c ON s.campaign_id = c.id
        LEFT JOIN automation_rules ar ON s.automation_rule_id = ar.id
        ORDER BY s.created_at DESC
      `);
      res.json({ data: rows, timezone: 'Asia/Makassar' });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
