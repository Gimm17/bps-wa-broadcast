import { Router } from 'express';
import {
  PERMISSIONS,
  createCampaignSchema,
  updateCampaignSchema
} from '@bps/shared';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validateCsrf } from '../../middleware/csrf.js';
import {
  createDraft,
  updateCampaign,
  scheduleCampaign,
  previewCampaign,
  expandRecipients,
  queueTestSend,
  cancelCampaign
} from './service.js';
import { campaignRepository } from './repository.js';
import { pool } from '../../db/pool.js';

export const campaignsRouter = Router();

/**
 * List campaigns
 */
campaignsRouter.get(
  '/campaigns',
  authenticate,
  authorize(PERMISSIONS.CAMPAIGN_READ),
  async (req, res, next) => {
    try {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));

      const result = await campaignRepository.list(pool, {
        page,
        limit,
        status: req.query.status || '',
        type: req.query.type || '',
        search: req.query.search || ''
      });

      res.json({
        data: result.rows,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit)
        }
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * Get campaign by ID
 */
campaignsRouter.get(
  '/campaigns/:id',
  authenticate,
  authorize(PERMISSIONS.CAMPAIGN_READ),
  async (req, res, next) => {
    try {
      const campaign = await campaignRepository.findById(pool, req.params.id);
      if (!campaign) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Kampanye tidak ditemukan',
            correlationId: req.correlationId
          }
        });
      }
      res.json({ campaign });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * Create campaign draft
 */
campaignsRouter.post(
  '/campaigns',
  authenticate,
  validateCsrf,
  authorize(PERMISSIONS.CAMPAIGN_WRITE),
  async (req, res, next) => {
    try {
      const parsed = createCampaignSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Data kampanye tidak valid',
            details: parsed.error.issues,
            correlationId: req.correlationId
          }
        });
      }

      const campaign = await createDraft({
        ...parsed.data,
        createdBy: req.user?.id || null
      });

      res.status(201).json({
        status: 'ok',
        message: 'Draf kampanye berhasil dibuat',
        campaign
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * Update draft campaign
 */
campaignsRouter.patch(
  '/campaigns/:id',
  authenticate,
  validateCsrf,
  authorize(PERMISSIONS.CAMPAIGN_WRITE),
  async (req, res, next) => {
    try {
      const parsed = updateCampaignSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Data perubahan tidak valid',
            details: parsed.error.issues,
            correlationId: req.correlationId
          }
        });
      }

      const updated = await updateCampaign(req.params.id, parsed.data);
      res.json({
        status: 'ok',
        message: 'Kampanye berhasil diperbarui',
        campaign: updated
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * Preview campaign
 */
campaignsRouter.get(
  '/campaigns/:id/preview',
  authenticate,
  authorize(PERMISSIONS.CAMPAIGN_READ),
  async (req, res, next) => {
    try {
      const preview = await previewCampaign(req.params.id);
      res.json({ preview });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * Expand campaign audience recipients
 */
campaignsRouter.post(
  '/campaigns/:id/expand',
  authenticate,
  validateCsrf,
  authorize(PERMISSIONS.CAMPAIGN_WRITE),
  async (req, res, next) => {
    try {
      const result = await expandRecipients(req.params.id);
      res.json({
        status: 'ok',
        message: `Audiens berhasil diekspansi: ${result.totalRecipients} penerima ditemukan`,
        ...result
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * Schedule or immediately trigger campaign
 */
campaignsRouter.post(
  '/campaigns/:id/schedule',
  authenticate,
  validateCsrf,
  authorize(PERMISSIONS.CAMPAIGN_SEND),
  async (req, res, next) => {
    try {
      const scheduledAt = req.body.scheduledAt || null;
      const scheduled = await scheduleCampaign(req.params.id, scheduledAt);
      res.json({
        status: 'ok',
        message: scheduledAt ? 'Kampanye berhasil dijadwalkan' : 'Kampanye siap dieksekusi',
        campaign: scheduled
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * Queue test send to designated contact
 */
campaignsRouter.post(
  '/campaigns/:id/test-send',
  authenticate,
  validateCsrf,
  authorize(PERMISSIONS.CAMPAIGN_SEND),
  async (req, res, next) => {
    try {
      const contactId = req.body.contactId;
      if (!contactId) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Kontak tujuan pengujian wajib dipilih',
            correlationId: req.correlationId
          }
        });
      }

      const msg = await queueTestSend(req.params.id, contactId);
      res.json({
        status: 'ok',
        message: 'Pesan pengujian berhasil dimasukkan ke antrean kirim',
        messageId: msg.id
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * Cancel campaign
 */
campaignsRouter.post(
  '/campaigns/:id/cancel',
  authenticate,
  validateCsrf,
  authorize(PERMISSIONS.CAMPAIGN_CANCEL),
  async (req, res, next) => {
    try {
      const cancelled = await cancelCampaign(req.params.id);
      res.json({
        status: 'ok',
        message: 'Kampanye berhasil dibatalkan dan sisa pesan antrean telah dinonaktifkan',
        campaign: cancelled
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * Get campaign recipients list
 */
campaignsRouter.get(
  '/campaigns/:id/recipients',
  authenticate,
  authorize(PERMISSIONS.CAMPAIGN_READ),
  async (req, res, next) => {
    try {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));

      const result = await campaignRepository.getRecipients(pool, req.params.id, {
        page,
        limit,
        status: req.query.status || ''
      });

      res.json({
        data: result.rows,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit)
        }
      });
    } catch (err) {
      next(err);
    }
  }
);
