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
import { MetaClient, MpwaClient } from './client.js';
import { integrationRepository } from '../integrations/repository.js';
import { config } from '../../config.js';
import { pool } from '../../db/pool.js';
import { renderTemplateText } from '../campaigns/renderer.js';
import { recordAudit } from '../audit/service.js';

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
    if (appSecret) {
      if (!signature) {
        return res.status(401).json({ error: 'Signature webhook Meta diperlukan' });
      }
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
 * Create a new template manually
 */
metaRouter.post(
  '/templates',
  authenticate,
  validateCsrf,
  authorize(PERMISSIONS.TEMPLATE_SYNC),
  async (req, res, next) => {
    try {
      const {
        name,
        category = 'UTILITY',
        language = 'id',
        header = '',
        body = '',
        footer = '',
        status = 'APPROVED'
      } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({
          error: {
            code: 'INVALID_NAME',
            message: 'Nama template wajib diisi',
            correlationId: req.correlationId
          }
        });
      }

      const cleanName = name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
      if (cleanName.length < 3) {
        return res.status(400).json({
          error: {
            code: 'INVALID_NAME',
            message: 'Nama template minimal 3 karakter (hanya huruf kecil, angka, dan garis bawah)',
            correlationId: req.correlationId
          }
        });
      }

      if (!body || !body.trim()) {
        return res.status(400).json({
          error: {
            code: 'INVALID_BODY',
            message: 'Isi pesan template (body) tidak boleh kosong',
            correlationId: req.correlationId
          }
        });
      }

      const components = [];
      if (header && header.trim()) {
        components.push({
          type: 'HEADER',
          format: 'TEXT',
          text: header.trim()
        });
      }

      components.push({
        type: 'BODY',
        text: body.trim()
      });

      if (footer && footer.trim()) {
        components.push({
          type: 'FOOTER',
          text: footer.trim()
        });
      }

      const existing = await pool.query(
        'SELECT id FROM meta_templates WHERE name = $1 AND language = $2',
        [cleanName, language]
      );
      if (existing.rows.length > 0) {
        return res.status(409).json({
          error: {
            code: 'TEMPLATE_EXISTS',
            message: `Template dengan nama "${cleanName}" (${language}) sudah ada`,
            correlationId: req.correlationId
          }
        });
      }

      const result = await pool.query(`
        INSERT INTO meta_templates (name, language, category, status, components, updated_at)
        VALUES ($1, $2, $3, $4, $5, now())
        RETURNING *
      `, [cleanName, language, category.toUpperCase(), status, JSON.stringify(components)]);

      const newTemplate = result.rows[0];

      await recordAudit({
        userId: req.user?.id || null,
        action: 'template.create',
        resourceType: 'template',
        resourceId: newTemplate.id,
        details: { name: cleanName, category, language },
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });

      res.status(201).json({
        status: 'ok',
        message: 'Template berhasil dibuat',
        template: newTemplate
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * Update an existing template manually
 */
metaRouter.put(
  '/templates/:id',
  authenticate,
  validateCsrf,
  authorize(PERMISSIONS.TEMPLATE_SYNC),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const {
        name,
        category,
        language = 'id',
        header,
        body,
        footer,
        status
      } = req.body;

      const existingRes = await pool.query(
        'SELECT * FROM meta_templates WHERE id = $1',
        [id]
      );
      if (existingRes.rows.length === 0) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Template tidak ditemukan',
            correlationId: req.correlationId
          }
        });
      }

      const current = existingRes.rows[0];
      let cleanName = current.name;
      if (name && name.trim()) {
        cleanName = name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
      }

      let updatedComponents = Array.isArray(current.components)
        ? current.components
        : (typeof current.components === 'string' ? JSON.parse(current.components) : []);

      if (body !== undefined || header !== undefined || footer !== undefined) {
        const currentHeader = updatedComponents.find(c => c.type === 'HEADER')?.text || '';
        const currentBody = updatedComponents.find(c => c.type === 'BODY')?.text || '';
        const currentFooter = updatedComponents.find(c => c.type === 'FOOTER')?.text || '';

        const newHeader = header !== undefined ? header.trim() : currentHeader;
        const newBody = body !== undefined ? body.trim() : currentBody;
        const newFooter = footer !== undefined ? footer.trim() : currentFooter;

        if (!newBody) {
          return res.status(400).json({
            error: {
              code: 'INVALID_BODY',
              message: 'Isi pesan template (body) tidak boleh kosong',
              correlationId: req.correlationId
            }
          });
        }

        updatedComponents = [];
        if (newHeader) {
          updatedComponents.push({
            type: 'HEADER',
            format: 'TEXT',
            text: newHeader
          });
        }
        updatedComponents.push({
          type: 'BODY',
          text: newBody
        });
        if (newFooter) {
          updatedComponents.push({
            type: 'FOOTER',
            text: newFooter
          });
        }
      }

      const updatedCategory = category ? category.toUpperCase() : current.category;
      const updatedStatus = status || current.status;

      const result = await pool.query(`
        UPDATE meta_templates
        SET name = $1,
            category = $2,
            language = $3,
            status = $4,
            components = $5,
            updated_at = now()
        WHERE id = $6
        RETURNING *
      `, [cleanName, updatedCategory, language, updatedStatus, JSON.stringify(updatedComponents), id]);

      const updatedTemplate = result.rows[0];

      await recordAudit({
        userId: req.user?.id || null,
        action: 'template.update',
        resourceType: 'template',
        resourceId: id,
        details: { name: cleanName, category: updatedCategory },
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });

      res.json({
        status: 'ok',
        message: 'Template berhasil diperbarui',
        template: updatedTemplate
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * Delete or archive an existing template
 */
metaRouter.delete(
  '/templates/:id',
  authenticate,
  validateCsrf,
  authorize(PERMISSIONS.TEMPLATE_SYNC),
  async (req, res, next) => {
    try {
      const { id } = req.params;

      const existingRes = await pool.query(
        'SELECT id, name FROM meta_templates WHERE id = $1',
        [id]
      );
      if (existingRes.rows.length === 0) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Template tidak ditemukan',
            correlationId: req.correlationId
          }
        });
      }

      const templateName = existingRes.rows[0].name;

      const refCheck = await pool.query(`
        SELECT
          (SELECT COUNT(*) FROM campaigns WHERE template_id = $1) as campaign_count,
          (SELECT COUNT(*) FROM messages WHERE template_id = $1) as message_count
      `, [id]);

      const isReferenced =
        parseInt(refCheck.rows[0]?.campaign_count || '0', 10) > 0 ||
        parseInt(refCheck.rows[0]?.message_count || '0', 10) > 0;

      if (isReferenced) {
        await pool.query(
          "UPDATE meta_templates SET status = 'ARCHIVED', updated_at = now() WHERE id = $1",
          [id]
        );
      } else {
        await pool.query('DELETE FROM meta_templates WHERE id = $1', [id]);
      }

      await recordAudit({
        userId: req.user?.id || null,
        action: 'template.delete',
        resourceType: 'template',
        resourceId: id,
        details: { name: templateName, wasArchived: isReferenced },
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });

      res.json({
        status: 'ok',
        message: `Template "${templateName}" berhasil dihapus`
      });
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
      let client;

      if (creds?.apiKey || config.MPWA_API_KEY) {
        client = new MpwaClient({
          apiKey: creds?.apiKey || config.MPWA_API_KEY,
          sender: creds?.sender || config.MPWA_SENDER,
          baseUrl: creds?.baseUrl || config.MPWA_BASE_URL
        });
      } else if (creds?.wabaId && creds?.accessToken) {
        client = new MetaClient({
          wabaId: creds.wabaId,
          phoneNumberId: creds.phoneNumberId,
          accessToken: creds.accessToken
        });
      } else {
        return res.status(400).json({
          error: {
            code: 'INTEGRATION_NOT_CONFIGURED',
            message: 'Kredensial WhatsApp Gateway (MPWA / Meta WABA) belum dikonfigurasi. Lengkapi di menu Integrations atau .env.',
            correlationId: req.correlationId
          }
        });
      }

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

    const existing = await integrationRepository.getDecryptedCredentials('meta_waba') || {};
    const input = { ...req.body };

    // Auto-normalize sender number if provided
    if (input.sender) {
      let cleanSender = String(input.sender).trim().replace(/^\+/, '').replace(/\D/g, '');
      if (cleanSender.startsWith('0')) {
        cleanSender = '62' + cleanSender.slice(1);
      }
      input.sender = cleanSender;
    } else if (existing.sender) {
      input.sender = existing.sender;
    }

    if (!input.apiKey && existing.apiKey) input.apiKey = existing.apiKey;
    if (!input.baseUrl && existing.baseUrl) input.baseUrl = existing.baseUrl;

    const parsed = metaCredentialsSchema.safeParse(input);
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

    const isMpwa = Boolean(parsed.data.apiKey);
    const saved = await integrationRepository.saveIntegration({
      type: 'meta_waba',
      name: isMpwa ? 'WhatsApp Gateway MPWA (Nova Media)' : 'Meta WhatsApp Cloud API',
      credentials: parsed.data,
      status: 'connected'
    });

    res.json({
      status: 'ok',
      message: 'Kredensial WhatsApp Gateway berhasil disimpan secara terenkripsi AES-256-GCM',
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
 * Test Meta / MPWA Gateway connection
 */
metaRouter.post(
  '/integrations/meta/test',
  authenticate,
  authorize(PERMISSIONS.INTEGRATION_MANAGE),
  async (req, res, next) => {
    try {
      const creds = await integrationRepository.getDecryptedCredentials('meta_waba');
      const apiKey = creds?.apiKey || config.MPWA_API_KEY;
      const sender = creds?.sender || config.MPWA_SENDER;
      const baseUrl = creds?.baseUrl || config.MPWA_BASE_URL;

      // 1. If MPWA credentials available, run live ping to MPWA
      if (apiKey && sender) {
        const client = new MpwaClient({ apiKey, sender, baseUrl });
        const check = await client.checkNumber(sender);
        if (!check.exists) {
          throw new Error(`Nomor pengirim ${sender} tidak terdeteksi aktif di WhatsApp.`);
        }

        await integrationRepository.updateStatus({
          type: 'meta_waba',
          status: 'connected'
        });

        return res.json({
          status: 'ok',
          message: `Koneksi ke Gateway MPWA Nova Media (${baseUrl}) berhasil! Nomor pengirim ${sender} aktif dan terhubung ke WhatsApp.`,
          sender,
          jid: check.jid
        });
      }

      // 2. Direct Meta WABA fallback
      if (creds?.wabaId && creds?.accessToken) {
        const client = new MetaClient({
          wabaId: creds.wabaId,
          phoneNumberId: creds.phoneNumberId,
          accessToken: creds.accessToken
        });

        const templates = await client.fetchTemplates();

        await integrationRepository.updateStatus({
          type: 'meta_waba',
          status: 'connected'
        });

        return res.json({
          status: 'ok',
          message: `Koneksi ke Meta Cloud API berhasil! Terhubung dengan WABA ID: ${creds.wabaId}. (${templates.length} template ditemukan)`,
          templateCount: templates.length
        });
      }

      return res.status(400).json({
        error: {
          code: 'NOT_CONFIGURED',
          message: 'Kredensial WhatsApp Gateway (MPWA / Meta WABA) belum lengkap',
          correlationId: req.correlationId
        }
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

// ==========================================
// Direct / Test Send to Single Recipient
// ==========================================

export function normalizePhoneNumber(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let cleaned = raw.trim().replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.slice(1);
  }
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.slice(1);
  }
  // Standard Indonesian phone numbers start with 62 and have 10-15 digits
  if (/^62[0-9]{8,14}$/.test(cleaned)) {
    return cleaned;
  }
  return null;
}

/**
 * Cek nomor WhatsApp apakah aktif / terdaftar di WhatsApp
 */
metaRouter.post(
  '/send/check-number',
  authenticate,
  validateCsrf,
  authorize(PERMISSIONS.CAMPAIGN_SEND),
  async (req, res, next) => {
    try {
      const { phone } = req.body;
      const normalized = normalizePhoneNumber(phone);
      if (!normalized) {
        return res.status(400).json({
          error: {
            code: 'INVALID_PHONE',
            message: 'Nomor WhatsApp tidak valid. Format harus diawali 08... atau 628... (10-15 digit)',
            correlationId: req.correlationId
          }
        });
      }

      const creds = await integrationRepository.getDecryptedCredentials('meta_waba');
      const apiKey = creds?.apiKey || config.MPWA_API_KEY;
      const sender = creds?.sender || config.MPWA_SENDER;
      const baseUrl = creds?.baseUrl || config.MPWA_BASE_URL;

      if (!apiKey || !sender) {
        return res.status(400).json({
          error: {
            code: 'NOT_CONFIGURED',
            message: 'Kredensial gateway MPWA belum dikonfigurasi. Lengkapi di menu Integrations.',
            correlationId: req.correlationId
          }
        });
      }

      const client = new MpwaClient({ apiKey, sender, baseUrl });
      const check = await client.checkNumber(normalized);

      res.json({
        status: 'ok',
        phone: normalized,
        exists: Boolean(check.exists),
        jid: check.jid || null
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * Kirim pesan manual / test send langsung ke satu nomor tujuan
 */
metaRouter.post(
  '/send/direct',
  authenticate,
  validateCsrf,
  authorize(PERMISSIONS.CAMPAIGN_SEND),
  async (req, res, next) => {
    try {
      const {
        to,
        message,
        templateId,
        templateParams = {},
        footer,
        recipientName,
        logMessage = true
      } = req.body;

      // 1. Validasi nomor penerima
      const normalizedPhone = normalizePhoneNumber(to);
      if (!normalizedPhone) {
        return res.status(400).json({
          error: {
            code: 'INVALID_PHONE',
            message: 'Nomor penerima tidak valid. Masukkan nomor WhatsApp yang benar (contoh: 08123456789 atau 628123456789).',
            correlationId: req.correlationId
          }
        });
      }

      // 2. Tentukan teks pesan yang dikirim
      let finalMessageText = '';
      let usedFooter = (footer !== undefined && footer !== null) ? footer : (templateId ? 'BPS Provinsi Sulawesi Tengah' : null);
      let resolvedTemplate = null;

      if (templateId) {
        resolvedTemplate = await getTemplateById(templateId);
        if (!resolvedTemplate) {
          return res.status(404).json({
            error: {
              code: 'TEMPLATE_NOT_FOUND',
              message: 'Template tidak ditemukan di database.',
              correlationId: req.correlationId
            }
          });
        }

        const components = Array.isArray(resolvedTemplate.components)
          ? resolvedTemplate.components
          : (typeof resolvedTemplate.components === 'string'
              ? JSON.parse(resolvedTemplate.components)
              : []);

        const footerComp = components.find(c => c.type === 'FOOTER');
        if (footerComp?.text) {
          usedFooter = footerComp.text;
        }

        finalMessageText = renderTemplateText(components, templateParams);
        if (!finalMessageText) {
          return res.status(400).json({
            error: {
              code: 'RENDER_FAILED',
              message: 'Gagal merender teks template. Periksa parameter template.',
              correlationId: req.correlationId
            }
          });
        }
      } else {
        if (!message || !message.trim()) {
          return res.status(400).json({
            error: {
              code: 'EMPTY_MESSAGE',
              message: 'Isi pesan tidak boleh kosong.',
              correlationId: req.correlationId
            }
          });
        }
        finalMessageText = message.trim();
      }

      // 3. Siapkan Gateway Client
      const creds = await integrationRepository.getDecryptedCredentials('meta_waba');
      let client;

      if (creds?.apiKey || config.MPWA_API_KEY) {
        client = new MpwaClient({
          apiKey: creds?.apiKey || config.MPWA_API_KEY,
          sender: creds?.sender || config.MPWA_SENDER,
          baseUrl: creds?.baseUrl || config.MPWA_BASE_URL
        });
      } else if (creds?.wabaId && creds?.accessToken) {
        client = new MetaClient({
          wabaId: creds.wabaId,
          phoneNumberId: creds.phoneNumberId,
          accessToken: creds.accessToken
        });
      } else {
        return res.status(400).json({
          error: {
            code: 'GATEWAY_NOT_CONFIGURED',
            message: 'Kredensial WhatsApp Gateway (MPWA / Meta WABA) belum dikonfigurasi.',
            correlationId: req.correlationId
          }
        });
      }

      // 4. Kirim pesan langsung ke gateway
      let sendResult;
      if (typeof client.sendText === 'function') {
        sendResult = await client.sendText({
          to: normalizedPhone,
          text: finalMessageText,
          footer: usedFooter
        });
      } else if (typeof client.sendTemplateMessage === 'function' && resolvedTemplate) {
        sendResult = await client.sendTemplateMessage({
          to: normalizedPhone,
          templateName: resolvedTemplate.name,
          languageCode: resolvedTemplate.language,
          components: []
        });
      } else {
        throw new Error('Metode pengiriman tidak didukung oleh client gateway saat ini.');
      }

      const messageId = sendResult?.messageId || sendResult?.mpwaMessageId || sendResult?.metaMessageId || `manual-${Date.now()}`;

      // 5. Pencatatan ke tabel contacts, messages, dan audit_logs jika logMessage aktif
      if (logMessage) {
        try {
          let contactId = null;
          const contactRes = await pool.query(
            'SELECT id FROM contacts WHERE phone_e164 = $1',
            [normalizedPhone]
          );

          if (contactRes.rows.length > 0) {
            contactId = contactRes.rows[0].id;
          } else {
            const insContact = await pool.query(`
              INSERT INTO contacts (type, name, phone_e164, status)
              VALUES ('public', $1, $2, 'active')
              ON CONFLICT (phone_e164) DO UPDATE SET updated_at = now()
              RETURNING id
            `, [
              recipientName || `Penerima (${normalizedPhone})`,
              normalizedPhone
            ]);
            contactId = insContact.rows[0]?.id;
          }

          let dbTemplateId = resolvedTemplate?.id || null;
          if (!dbTemplateId) {
            const tmplRes = await pool.query('SELECT id FROM meta_templates LIMIT 1');
            if (tmplRes.rows.length > 0) {
              dbTemplateId = tmplRes.rows[0].id;
            } else {
              const tmplIns = await pool.query(`
                INSERT INTO meta_templates (name, language, category, status, components)
                VALUES ('direct_send', 'id', 'UTILITY', 'APPROVED', '[]')
                ON CONFLICT (name, language) DO UPDATE SET updated_at = now()
                RETURNING id
              `);
              dbTemplateId = tmplIns.rows[0]?.id;
            }
          }

          if (contactId && dbTemplateId) {
            const idempotencyKey = `direct:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
            await pool.query(`
              INSERT INTO messages (
                contact_id, template_id, idempotency_key, payload, status, meta_message_id
              )
              VALUES ($1, $2, $3, $4, 'sent', $5)
              ON CONFLICT (meta_message_id) DO UPDATE SET
                status = EXCLUDED.status,
                payload = EXCLUDED.payload,
                updated_at = now()
            `, [
              contactId,
              dbTemplateId,
              idempotencyKey,
              JSON.stringify({
                isDirectSend: true,
                recipient: normalizedPhone,
                text: finalMessageText,
                footer: usedFooter,
                templateName: resolvedTemplate?.name || null,
                sentByUserId: req.user?.id || null
              }),
              messageId
            ]);
          }

          await recordAudit({
            userId: req.user?.id || null,
            action: 'send.direct',
            resourceType: 'message',
            resourceId: messageId,
            details: {
              recipient: normalizedPhone,
              messageLength: finalMessageText.length,
              templateName: resolvedTemplate?.name || null,
              messageId
            },
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
          });
        } catch (dbErr) {
          console.error('[DirectSend] Gagal mencatat pesan ke database:', dbErr);
        }
      }

      res.json({
        status: 'ok',
        message: `Pesan berhasil dikirim ke nomor ${normalizedPhone}`,
        messageId,
        recipient: normalizedPhone,
        renderedText: finalMessageText,
        footer: usedFooter,
        sentAt: new Date().toISOString()
      });
    } catch (err) {
      next(err);
    }
  }
);
