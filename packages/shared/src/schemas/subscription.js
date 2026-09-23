import { z } from 'zod';
import { normalizeIndonesianPhone } from '../phone.js';

export const SUBSCRIPTION_STATUSES = ['active', 'paused', 'unsubscribed'];
export const CONSENT_EVENT_TYPES = ['subscribe', 'unsubscribe', 'opt_out', 're_subscribe'];
export const CONSENT_CHANNELS = ['web', 'whatsapp', 'admin', 'import'];

export const publicSubscriptionSchema = z.object({
  name: z.string().trim().min(2, 'Nama lengkap wajib diisi minimal 2 karakter').max(100, 'Nama maksimal 100 karakter'),
  phone: z.string().trim().refine((val) => {
    try {
      normalizeIndonesianPhone(val);
      return true;
    } catch {
      return false;
    }
  }, {
    message: 'Nomor WhatsApp tidak valid (contoh: 08123456789 atau +628123456789)'
  }),
  instansi: z.string().trim().max(150, 'Nama instansi maksimal 150 karakter').optional().default(''),
  profesi: z.string().trim().max(100, 'Profesi maksimal 100 karakter').optional().default(''),
  topicCodes: z.array(z.string().trim()).min(1, 'Pilih minimal satu topik informasi yang ingin dilanggani'),
  consent: z.literal(true, {
    errorMap: () => ({ message: 'Anda wajib mencentang persetujuan penerimaan pesan WhatsApp' })
  })
});

export const manageSubscriptionSchema = z.object({
  token: z.string().trim().min(10, 'Token manajemen langganan tidak valid'),
  topicCodes: z.array(z.string().trim()).default([])
});

export const unsubscribeRequestSchema = z.object({
  token: z.string().trim().min(10, 'Token tidak valid'),
  topicCode: z.string().trim().optional()
});
