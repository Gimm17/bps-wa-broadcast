import { Router } from 'express';
import {
  publicSubscriptionSchema,
  manageSubscriptionSchema,
  unsubscribeRequestSchema,
  PERMISSIONS,
  maskPhoneNumber
} from '@bps/shared';
import {
  handlePublicSubscription,
  verifyManageToken,
  recordConsent
} from './service.js';
import { subscriptionRepository } from './repository.js';
import { pool } from '../../db/pool.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';

export const subscriptionsRouter = Router();

// ==========================================
// Public Endpoints (No Auth Required)
// ==========================================

/**
 * Public: Get active topics for subscription
 */
subscriptionsRouter.get('/subscriptions/topics', async (req, res, next) => {
  try {
    const topics = await subscriptionRepository.findTopics(pool);
    res.json({ topics });
  } catch (err) {
    next(err);
  }
});

/**
 * Public: Submit new subscription
 */
subscriptionsRouter.post('/subscriptions/public', async (req, res, next) => {
  try {
    const parsed = publicSubscriptionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues[0]?.message || 'Data pendaftaran tidak valid',
          details: parsed.error.issues,
          correlationId: req.correlationId
        }
      });
    }

    const result = await handlePublicSubscription({
      ...parsed.data,
      ipAddress: req.ip
    });

    res.status(201).json({
      status: 'ok',
      message: result.message,
      manageToken: result.manageToken
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Public: Get current preferences using manage token
 */
subscriptionsRouter.get('/subscriptions/manage', async (req, res, next) => {
  try {
    const token = req.query.token;
    const tokenVerify = verifyManageToken(token);
    if (!tokenVerify.valid) {
      return res.status(400).json({
        error: {
          code: 'INVALID_TOKEN',
          message: tokenVerify.error,
          correlationId: req.correlationId
        }
      });
    }

    const contact = await subscriptionRepository.findContactById(pool, tokenVerify.contactId);
    if (!contact) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Data kontak tidak ditemukan',
          correlationId: req.correlationId
        }
      });
    }

    const allTopics = await subscriptionRepository.findTopics(pool);
    const existingSubs = await subscriptionRepository.getSubscriptionsByContactId(pool, contact.id);

    const subMap = new Map();
    for (const sub of existingSubs) {
      subMap.set(sub.topic_id, sub.status);
    }

    const topicsWithStatus = allTopics.map(t => ({
      ...t,
      isSubscribed: subMap.get(t.id) === 'active'
    }));

    res.json({
      contact: {
        name: contact.name,
        phoneMasked: maskPhoneNumber(contact.phone_e164),
        status: contact.status
      },
      topics: topicsWithStatus
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Public: Update subscription topics using manage token
 */
subscriptionsRouter.post('/subscriptions/manage', async (req, res, next) => {
  try {
    const parsed = manageSubscriptionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues[0]?.message || 'Data tidak valid',
          correlationId: req.correlationId
        }
      });
    }

    const tokenVerify = verifyManageToken(parsed.data.token);
    if (!tokenVerify.valid) {
      return res.status(400).json({
        error: {
          code: 'INVALID_TOKEN',
          message: tokenVerify.error,
          correlationId: req.correlationId
        }
      });
    }

    const contactId = tokenVerify.contactId;
    const allTopics = await subscriptionRepository.findTopics(pool);
    const requestedCodes = new Set(parsed.data.topicCodes);

    for (const topic of allTopics) {
      const wantSubscribed = requestedCodes.has(topic.code);
      await recordConsent({
        contactId,
        topicId: topic.id,
        action: wantSubscribed ? 'subscribe' : 'unsubscribe',
        source: 'web',
        evidence: `Perubahan preferensi portal: ${wantSubscribed ? 'Aktifkan' : 'Nonaktifkan'} ${topic.code}`,
        ipAddress: req.ip
      });
    }

    res.json({
      status: 'ok',
      message: 'Preferensi langganan Anda berhasil diperbarui'
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Public: One-click unsubscribe from manage token or direct link
 */
subscriptionsRouter.post('/subscriptions/unsubscribe', async (req, res, next) => {
  try {
    const parsed = unsubscribeRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues[0]?.message || 'Data tidak valid',
          correlationId: req.correlationId
        }
      });
    }

    const tokenVerify = verifyManageToken(parsed.data.token);
    if (!tokenVerify.valid) {
      return res.status(400).json({
        error: {
          code: 'INVALID_TOKEN',
          message: tokenVerify.error,
          correlationId: req.correlationId
        }
      });
    }

    let topicId = null;
    if (parsed.data.topicCode) {
      const topic = await subscriptionRepository.findTopicByCode(pool, parsed.data.topicCode);
      if (topic) topicId = topic.id;
    }

    await recordConsent({
      contactId: tokenVerify.contactId,
      topicId,
      action: topicId ? 'unsubscribe' : 'unsubscribe_all',
      source: 'web',
      evidence: topicId ? `Unsubscribe portal topik ${parsed.data.topicCode}` : 'Unsubscribe portal semua topik',
      ipAddress: req.ip
    });

    res.json({
      status: 'ok',
      message: topicId
        ? 'Anda telah berhenti berlangganan dari topik ini'
        : 'Anda telah berhasil berhenti dari seluruh pembaruan BPS Provinsi Sulawesi Tengah'
    });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// Admin Endpoints (Authenticated & RBAC)
// ==========================================

/**
 * Admin: List subscriptions with pagination and filter
 */
subscriptionsRouter.get(
  '/subscriptions',
  authenticate,
  authorize(PERMISSIONS.CONTACT_READ),
  async (req, res, next) => {
    try {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
      const offset = (page - 1) * limit;

      const result = await subscriptionRepository.listSubscriptions(pool, {
        limit,
        offset,
        status: req.query.status || null,
        topicId: req.query.topicId || null,
        search: req.query.search || null
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
 * Admin: List all topics with subscriber count
 */
subscriptionsRouter.get(
  '/subscriptions/admin/topics',
  authenticate,
  authorize(PERMISSIONS.CONTACT_READ),
  async (req, res, next) => {
    try {
      const topics = await subscriptionRepository.findAllTopics(pool);
      res.json({ topics });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * Admin: List recent consent events
 */
subscriptionsRouter.get(
  '/subscriptions/events',
  authenticate,
  authorize(PERMISSIONS.AUDIT_READ),
  async (req, res, next) => {
    try {
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
      const events = await subscriptionRepository.listRecentConsentEvents(pool, { limit });
      res.json({ events });
    } catch (err) {
      next(err);
    }
  }
);
