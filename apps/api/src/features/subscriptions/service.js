import crypto from 'node:crypto';
import { pool } from '../../db/pool.js';
import { withTransaction } from '../../db/transaction.js';
import { subscriptionRepository } from './repository.js';
import { parseInboundCommand } from './commands.js';
import { normalizeIndonesianPhone } from '@bps/shared';

const TOKEN_SECRET = process.env.SESSION_SECRET || 'bps-sulteng-subscription-secret-2026';

/**
 * Records an immutable consent event and updates subscription/suppression status in a transaction.
 */
export async function recordConsent({
  contactId,
  topicId = null,
  action, // 'subscribe' | 'unsubscribe' | 'unsubscribe_all' | 'opt_out' | 're_subscribe'
  source = 'web', // 'web' | 'whatsapp' | 'admin' | 'import'
  evidence = null,
  ipAddress = null
}) {
  return withTransaction(async (client) => {
    const contact = await subscriptionRepository.findContactById(client, contactId);
    if (!contact) {
      throw new Error(`Kontak dengan ID ${contactId} tidak ditemukan`);
    }

    let eventType;

    if (action === 'unsubscribe_all' || action === 'opt_out') {
      eventType = 'opt_out';

      // 1. Update all subscriptions for this contact to unsubscribed
      await subscriptionRepository.updateAllSubscriptionsForContact(client, contactId, 'unsubscribed');

      // 2. Mark contact status as unsubscribed
      await client.query(`
        UPDATE contacts
        SET status = 'unsubscribed', updated_at = now()
        WHERE id = $1
      `, [contactId]);

      // 3. Immediately insert phone into suppression entries table
      await subscriptionRepository.insertSuppressionEntry(client, {
        phoneE164: contact.phone_e164,
        reason: evidence ? `Permintaan opt-out: ${evidence}` : 'Berhenti berlangganan semua (opt-out)'
      });
    } else if (action === 'unsubscribe') {
      eventType = 'unsubscribe';

      if (topicId) {
        // Unsubscribe from a specific topic
        await subscriptionRepository.upsertSubscription(client, {
          contactId,
          topicId,
          status: 'unsubscribed',
          channel: source
        });
      } else {
        // Unsubscribe from all topics
        await subscriptionRepository.updateAllSubscriptionsForContact(client, contactId, 'unsubscribed');
      }
    } else if (action === 'subscribe' || action === 're_subscribe') {
      eventType = action === 're_subscribe' ? 're_subscribe' : 'subscribe';

      // Remove from suppression if previously suppressed
      await subscriptionRepository.deleteSuppressionEntry(client, contact.phone_e164);

      // Restore contact to active if it was unsubscribed
      if (contact.status === 'unsubscribed') {
        await client.query(`
          UPDATE contacts
          SET status = 'active', updated_at = now()
          WHERE id = $1
        `, [contactId]);
      }

      if (topicId) {
        await subscriptionRepository.upsertSubscription(client, {
          contactId,
          topicId,
          status: 'active',
          channel: source
        });
      }
    } else {
      throw new Error(`Aksi consent tidak dikenali: ${action}`);
    }

    // Insert append-only consent event record
    const event = await subscriptionRepository.insertConsentEvent(client, {
      contactId,
      eventType,
      channel: source,
      proof: evidence,
      ipAddress
    });

    return event;
  });
}

/**
 * Checks whether a message can be delivered or must be suppressed due to opt-out or unsubscription.
 */
export async function canSendMessage(messageId) {
  const message = await subscriptionRepository.getMessageWithDetails(pool, messageId);
  if (!message) {
    return { allowed: false, reason: 'not_found' };
  }

  // 1. Check if phone is in suppression entries
  const isSuppressed = await subscriptionRepository.isPhoneSuppressed(pool, message.phone_e164);
  if (isSuppressed) {
    await subscriptionRepository.updateMessageStatus(
      pool,
      messageId,
      'suppressed',
      'OPTED_OUT',
      'Nomor tujuan terdaftar dalam daftar supresi'
    );
    return { allowed: false, reason: 'opted_out' };
  }

  // 2. Check if contact status is unsubscribed
  if (message.contact_status === 'unsubscribed') {
    await subscriptionRepository.updateMessageStatus(
      pool,
      messageId,
      'suppressed',
      'OPTED_OUT',
      'Kontak telah membatalkan langganan'
    );
    return { allowed: false, reason: 'opted_out' };
  }

  // 3. Check topic-level subscription if message is linked to a topic
  const payload = typeof message.payload === 'string'
    ? JSON.parse(message.payload)
    : message.payload || {};

  const topicId = payload.topicId || payload.topic_id;
  if (topicId) {
    const subRes = await pool.query(`
      SELECT status FROM subscriptions
      WHERE contact_id = $1 AND topic_id = $2
    `, [message.contact_id, topicId]);

    const sub = subRes.rows[0];

    // If subscription exists and is unsubscribed, suppress
    if (sub && sub.status === 'unsubscribed') {
      await subscriptionRepository.updateMessageStatus(
        pool,
        messageId,
        'suppressed',
        'OPTED_OUT',
        'Kontak telah berhenti berlangganan topik ini'
      );
      return { allowed: false, reason: 'opted_out' };
    }

    // For public contacts, active subscription is required
    if (message.contact_type === 'public' && (!sub || sub.status !== 'active')) {
      await subscriptionRepository.updateMessageStatus(
        pool,
        messageId,
        'suppressed',
        'OPTED_OUT',
        'Kontak publik tidak memiliki langganan aktif untuk topik ini'
      );
      return { allowed: false, reason: 'opted_out' };
    }
  }

  return { allowed: true };
}

/**
 * Enqueues a public/test message for sending.
 */
export async function queuePublicMessage({
  contactId,
  topicId = null,
  templateId,
  campaignId = null,
  idempotencyKey,
  payload = {}
}) {
  const fullPayload = {
    ...payload,
    ...(topicId ? { topicId } : {})
  };

  return subscriptionRepository.insertMessage(pool, {
    contactId,
    templateId,
    campaignId,
    idempotencyKey,
    payload: fullPayload,
    status: 'queued'
  });
}

/**
 * Creates an expiring, tamper-proof HMAC-signed token for public subscription management.
 */
export function createManageToken(contactId, expiresInHours = 48) {
  const expiresAt = Date.now() + expiresInHours * 60 * 60 * 1000;
  const data = `${contactId}:${expiresAt}:sub_manage`;
  const dataB64 = Buffer.from(data, 'utf8').toString('base64url');

  const signature = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(dataB64)
    .digest('base64url');

  return `${dataB64}.${signature}`;
}

/**
 * Verifies an HMAC-signed subscription management token.
 */
export function verifyManageToken(token) {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Token tidak boleh kosong' };
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return { valid: false, error: 'Format token tidak valid' };
  }

  const [dataB64, signature] = parts;
  const expectedSig = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(dataB64)
    .digest('base64url');

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSig);

  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return { valid: false, error: 'Tanda tangan token tidak valid' };
  }

  try {
    const decoded = Buffer.from(dataB64, 'base64url').toString('utf8');
    const [contactId, expiresAtStr, purpose] = decoded.split(':');

    if (purpose !== 'sub_manage') {
      return { valid: false, error: 'Tujuan token tidak sesuai' };
    }

    const expiresAt = Number(expiresAtStr);
    if (Date.now() > expiresAt) {
      return { valid: false, error: 'Token telah kedaluwarsa' };
    }

    return { valid: true, contactId };
  } catch {
    return { valid: false, error: 'Gagal memproses payload token' };
  }
}

/**
 * Handles public subscription form submission.
 */
export async function handlePublicSubscription({
  name,
  phone,
  instansi = '',
  profesi = '',
  topicCodes = [],
  ipAddress = null
}) {
  const phoneE164 = normalizeIndonesianPhone(phone);

  return withTransaction(async (client) => {
    // 1. Find or create public contact with public profile
    const contact = await subscriptionRepository.createContactWithProfile(client, {
      name,
      phoneE164,
      instansi,
      profesi
    });

    // 2. Record consent event
    await subscriptionRepository.insertConsentEvent(client, {
      contactId: contact.id,
      eventType: 'subscribe',
      channel: 'web',
      proof: 'Centang persetujuan portal publik',
      ipAddress
    });

    // 3. Remove from suppression if previously suppressed
    await subscriptionRepository.deleteSuppressionEntry(client, phoneE164);

    // 4. Activate requested topics
    for (const code of topicCodes) {
      const topic = await subscriptionRepository.findTopicByCode(client, code);
      if (topic && topic.is_active) {
        await subscriptionRepository.upsertSubscription(client, {
          contactId: contact.id,
          topicId: topic.id,
          status: 'active',
          channel: 'web'
        });
      }
    }

    // Generate management token for immediate access
    const manageToken = createManageToken(contact.id);

    return {
      success: true,
      message: 'Pendaftaran langganan berhasil diproses',
      manageToken
    };
  });
}

/**
 * Handles inbound WhatsApp messages and commands.
 */
export async function handleInboundCommand({ from, text, receivedAt = new Date() }) {
  const phoneE164 = normalizeIndonesianPhone(from);
  const cmd = await parseInboundCommand(text);

  let contact = await subscriptionRepository.findContactByPhone(pool, phoneE164);

  if (cmd.kind === 'unsubscribe_all') {
    if (contact) {
      await recordConsent({
        contactId: contact.id,
        action: 'unsubscribe_all',
        source: 'whatsapp',
        evidence: `Pesan masuk: ${text}`
      });
    } else {
      await subscriptionRepository.insertSuppressionEntry(pool, {
        phoneE164,
        reason: `Inbound WhatsApp STOP ALL: ${text}`
      });
    }
    return {
      reply: 'Nomor Anda telah dihentikan dari seluruh pengiriman informasi WhatsApp BPS Provinsi Sulawesi Tengah. Ketik DAFTAR untuk mengaktifkan kembali.'
    };
  }

  if (cmd.kind === 'unsubscribe') {
    if (contact) {
      let topicId = null;
      if (cmd.topicCode) {
        const topic = await subscriptionRepository.findTopicByCode(pool, cmd.topicCode);
        if (topic) topicId = topic.id;
      }
      await recordConsent({
        contactId: contact.id,
        topicId,
        action: 'unsubscribe',
        source: 'whatsapp',
        evidence: `Pesan masuk: ${text}`
      });
    }
    return {
      reply: 'Anda telah berhasil berhenti berlangganan. Terima kasih atas kerja sama Anda bersama BPS Provinsi Sulawesi Tengah.'
    };
  }

  if (cmd.kind === 'subscribe') {
    if (!contact) {
      contact = await subscriptionRepository.createContactWithProfile(pool, {
        name: 'Subscriber WhatsApp',
        phoneE164,
        instansi: '',
        profesi: ''
      });
    }

    let topicId = null;
    if (cmd.topicCode) {
      const topic = await subscriptionRepository.findTopicByCode(pool, cmd.topicCode);
      if (topic) topicId = topic.id;
    }

    await recordConsent({
      contactId: contact.id,
      topicId,
      action: 'subscribe',
      source: 'whatsapp',
      evidence: `Pesan masuk: ${text}`
    });

    return {
      reply: 'Terima kasih! Langganan informasi resmi BPS Provinsi Sulawesi Tengah telah aktif di nomor Anda.'
    };
  }

  if (cmd.kind === 'help') {
    return {
      reply: 'Layanan Resmi WhatsApp BPS Provinsi Sulawesi Tengah.\n\nPerintah tersedia:\n- DAFTAR: Berlangganan informasi rilis statistik\n- BERHENTI: Berhenti berlangganan topik\n- BERHENTI SEMUA: Berhenti dari seluruh layanan\n- BANTUAN: Menampilkan informasi ini\n\nKunjungi portal data resmi kami di https://sulteng.bps.go.id.'
    };
  }

  // Unknown free text: Concise redirect to official helpdesk channel
  return {
    reply: 'Terima kasih telah menghubungi BPS Provinsi Sulawesi Tengah. Saluran WhatsApp ini digunakan untuk diseminasi data otomatis. Untuk konsultasi data, silakan hubungi Pelayanan Statistik Terpadu (PST) di https://sulteng.bps.go.id atau silastik.bps.go.id.'
  };
}
