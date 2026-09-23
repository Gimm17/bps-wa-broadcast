import express from 'express';
import { z } from 'zod';
import {
  listAutomationRules,
  getAutomationRuleById,
  createAutomationRule,
  updateAutomationRule
} from './repository.js';
import { runAttendanceRule, processTriggerEvent } from './service.js';
import { createAttendanceAdapter } from '../../adapters/attendance.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { recordAudit } from '../audit/service.js';
import { PERMISSIONS } from '@bps/shared';

const ruleSchema = z.object({
  code: z.string().min(3).regex(/^[a-z0-9_]+$/, 'Kode harus huruf kecil, angka, atau underscore'),
  name: z.string().min(3, 'Nama wajib diisi'),
  type: z.enum(['attendance_presensi', 'publication_reminder', 'silastik_transaction', 'custom']),
  templateId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().default(true),
  config: z.record(z.any()).default({})
});

export function createAutomationsRouter({ db }) {
  const router = express.Router();
  router.use(authenticate);

  // List all rules
  router.get('/automations', async (req, res, next) => {
    try {
      const rules = await listAutomationRules(db);
      res.json({ data: rules });
    } catch (err) {
      next(err);
    }
  });

  // Get specific rule
  router.get('/automations/:id', async (req, res, next) => {
    try {
      const rule = await getAutomationRuleById(db, req.params.id);
      if (!rule) {
        return res.status(404).json({ error: { message: 'Rule otomasi tidak ditemukan' } });
      }
      res.json({ data: rule });
    } catch (err) {
      next(err);
    }
  });

  // Create rule
  router.post('/automations', authorize(PERMISSIONS.AUTOMATION_WRITE), async (req, res, next) => {
    try {
      const parsed = ruleSchema.parse(req.body);
      const rule = await createAutomationRule(db, parsed);

      await recordAudit({
        client: db,
        userId: req.user.id,
        action: 'automation:create',
        resourceType: 'automation_rules',
        resourceId: rule.id,
        details: parsed,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      res.status(201).json({ data: rule, message: 'Aturan otomasi berhasil dibuat' });
    } catch (err) {
      next(err);
    }
  });

  // Update rule
  router.put('/automations/:id', authorize(PERMISSIONS.AUTOMATION_WRITE), async (req, res, next) => {
    try {
      const parsed = ruleSchema.partial().parse(req.body);
      const updated = await updateAutomationRule(db, req.params.id, parsed);

      if (!updated) {
        return res.status(404).json({ error: { message: 'Rule otomasi tidak ditemukan' } });
      }

      await recordAudit({
        client: db,
        userId: req.user.id,
        action: 'automation:update',
        resourceType: 'automation_rules',
        resourceId: updated.id,
        details: parsed,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      res.json({ data: updated, message: 'Aturan otomasi berhasil diperbarui' });
    } catch (err) {
      next(err);
    }
  });

  // Manual test trigger of a rule
  router.post('/automations/:id/trigger', authorize(PERMISSIONS.AUTOMATION_WRITE), async (req, res, next) => {
    try {
      const rule = await getAutomationRuleById(db, req.params.id);
      if (!rule) {
        return res.status(404).json({ error: { message: 'Rule otomasi tidak ditemukan' } });
      }

      let result;
      if (rule.type === 'attendance_presensi') {
        const adapter = createAttendanceAdapter();
        result = await runAttendanceRule({
          db,
          rule,
          now: new Date(),
          adapter
        });
      } else if (rule.type === 'silastik_transaction') {
        result = await processTriggerEvent(db, {
          source: 'silastik_pst',
          eventType: 'new_transaction',
          externalId: `PST-TEST-${Date.now()}`,
          payload: {
            applicantName: 'Uji Coba Silastik',
            applicantAgency: 'Bappeda Sulteng',
            serviceType: 'Konsultasi Data'
          }
        }, { templateId: rule.template_id });
      } else {
        result = { status: 'triggered_mock', ruleType: rule.type };
      }

      await recordAudit({
        client: db,
        userId: req.user.id,
        action: 'automation:trigger_test',
        resourceType: 'automation_rules',
        resourceId: rule.id,
        details: result,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      res.json({ data: result, message: 'Trigger simulasi otomasi berhasil dieksekusi' });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
