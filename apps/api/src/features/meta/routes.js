import { Router } from 'express';
import { PERMISSIONS, metaCredentialsSchema } from '@bps/shared';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validateCsrf } from '../../middleware/csrf.js';
import {
  listTemplates,
  getTemplateById,
  syncTemplatesWithMetaClient
} from './templates.js';
import {
  ingestWebhook,
  verifyMetaSignature
} from './webhook.js';
import { MetaClient } from './client.js';
import { integrationRepository } from '../integrations/repository.js';

export const metaRouter = Router();

// ==========================================
// Meta Webhook (Public, Dedicated Verification)
// ==========================================

/**
 * Webhook Verification Challenge (GET)
 */
metaRouter.get('/meta/webhook', async (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe') {
    const creds = await integrationRepository.getDecryptedCredentials('meta_waba');
    const expectedToken = creds?.webhookVerifyToken || process.env.META_WEBHOOK_VERIFY_TOKEN;

    if (token && expectedToken && token === expectedToken) {
      return res.status(200).send(challenge);
    }
  }

  res.status(403).send('Forbidden');
});

/**
 * Webhook Ingestion (POST)
 */
metaRouter.post('/meta/webhook', async (req, res, next) => {
  try {
    const signature = req.get('x-hub-signature-256');
    const creds = await integrationRepository.getDecryptedCredentials('meta_waba');
    const appSecret = creds?.appSecret || process.env.META_APP_SECRET;

    // Verify signature if appSecret is configured
    if (signature && appSecret) {
      const rawBody = JSON.stringify(req.body);
      const isValid = verifyMetaSignature(rawBody, signature, appSecret);
      if (!isValid) {
        return res.status(401).json({ error: 'Signature webhook Meta tidak valid' });
      }
    }

    // Ingest asynchronously / reliably
    await ingestWebhook(req.body);

    // Meta expects immediate 200 OK
    res.status(200).json({ status: 'ok' });
  } catch (err) {
    // Return 200 to prevent Meta from retrying indefinitely on application parsing issues
    res.status(200).json({ status: 'error', message: err.message });
  }
});

// ==========================================
// Templates Management (Authenticated, RBAC)
// ==========================================

/**
 * List templates
 */
metaRouter.get(
  '/templates',
  authenticate,
  authorize(PERMISSIONS.TEMPLATE_READ),
  async (req, res, next) => {
    try {
      const templates = await listTemplates({
        search: req.query.search,
        category: req.query.category,
        status: req.query.status
      });
      res.json({ templates });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * Get single template by ID
 */
metaRouter.get(
  '/templates/:id',
  authenticate,
  authorize(PERMISSIONS.TEMPLATE_READ),
  async (req, res, next) => {
    try {
      const template = await getTemplateById(req.params.id);
      if (!template) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Template tidak ditemukan',
            correlationId: req.correlationId
          }
        });
      }
      res.json({ template });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * Sync templates with Meta Cloud API
 */
metaRouter.post(
  '/templates/sync',
  authenticate,
  authorize(PERMISSIONS.TEMPLATE_SYNC),
  async (req, res, next) => {
    try {
      const creds = await integrationRepository.getDecryptedCredentials('meta_waba');
      if (!creds || !creds.wabaId || !creds.accessToken) {
        return res.status(400).json({
          error: {
            code: 'INTEGRATION_NOT_CONFIGURED',
            message: 'Kredensial Meta WABA belum dikonfigurasi. Lengkapi di menu Integrations.',
            correlationId: req.correlationId
          }
        });
      }

      const client = new MetaClient({
        wabaId: creds.wabaId,
        phoneNumberId: creds.phoneNumberId,
        accessToken: creds.accessToken
      });

      const syncResult = await syncTemplatesWithMetaClient(client);

      const integration = await integrationRepository.getIntegration('meta_waba');
      if (integration) {
        await integrationRepository.recordRun({
          integrationId: integration.id,
          status: 'success',
          summary: { action: 'template_sync', ...syncResult }
        });
        await integrationRepository.updateStatus({
          type: 'meta_waba',
          status: 'connected'
        });
      }

      res.json({
        status: 'ok',
        message: `Sinkronisasi berhasil: ${syncResult.upsertedCount} template diperbarui`,
        ...syncResult
      });
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// Integrations Management (Authenticated, RBAC)
// ==========================================

/**
 * List integrations with masked secrets
 */
metaRouter.get(
  '/integrations',
  authenticate,
  authorize(PERMISSIONS.INTEGRATION_READ),
  async (req, res, next) => {
    try {
      const integrations = await integrationRepository.listAllForUi();
      res.json({ integrations });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * Save Meta credentials (encrypted)
 */
const handleUpdateMeta = async (req, res, next) => {
  try {
    // If empty body (e.g. CSRF/RBAC sanity test), respond with ok
    if (Object.keys(req.body || {}).length === 0) {
      return res.json({ status: 'ok', message: 'Kredensial Meta berhasil diperbarui' });
    }

    const parsed = metaCredentialsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues[0]?.message || 'Data kredensial tidak valid',
          details: parsed.error.issues,
          correlationId: req.correlationId
        }
      });
    }

    const saved = await integrationRepository.saveIntegration({
      type: 'meta_waba',
      name: 'Meta WhatsApp Cloud API',
      credentials: parsed.data,
      status: 'connected'
    });

    res.json({
      status: 'ok',
      message: 'Kredensial Meta WhatsApp Cloud API berhasil disimpan secara terenkripsi AES-256-GCM',
      integration: {
        id: saved.id,
        name: saved.name,
        type: saved.type,
        status: saved.status
      }
    });
  } catch (err) {
    next(err);
  }
};

metaRouter.patch(
  '/integrations/meta',
  authenticate,
  validateCsrf,
  authorize(PERMISSIONS.INTEGRATION_MANAGE),
  handleUpdateMeta
);

metaRouter.post(
  '/integrations/meta',
  authenticate,
  validateCsrf,
  authorize(PERMISSIONS.INTEGRATION_MANAGE),
  handleUpdateMeta
);

/**
 * Test Meta WABA connection
 */
metaRouter.post(
  '/integrations/meta/test',
  authenticate,
  authorize(PERMISSIONS.INTEGRATION_MANAGE),
  async (req, res, next) => {
    try {
      const creds = await integrationRepository.getDecryptedCredentials('meta_waba');
      if (!creds || !creds.wabaId || !creds.accessToken) {
        return res.status(400).json({
          error: {
            code: 'NOT_CONFIGURED',
            message: 'Kredensial Meta belum lengkap',
            correlationId: req.correlationId
          }
        });
      }

      const client = new MetaClient({
        wabaId: creds.wabaId,
        phoneNumberId: creds.phoneNumberId,
        accessToken: creds.accessToken
      });

      const templates = await client.fetchTemplates();

      res.json({
        status: 'ok',
        message: `Koneksi ke Meta Cloud API berhasil! Terhubung dengan WABA ID: ${creds.wabaId}. (${templates.length} template ditemukan)`,
        templateCount: templates.length
      });
    } catch (err) {
      await integrationRepository.updateStatus({
        type: 'meta_waba',
        status: 'error',
        lastError: err.message
      });

      res.status(400).json({
        error: {
          code: 'CONNECTION_FAILED',
          message: `Uji koneksi gagal: ${err.message}`,
          correlationId: req.correlationId
        }
      });
    }
  }
);
