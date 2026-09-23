import { z } from 'zod';

export const metaCredentialsSchema = z.object({
  wabaId: z.string().trim().min(5, 'WABA ID wajib diisi'),
  phoneNumberId: z.string().trim().min(5, 'Phone Number ID wajib diisi'),
  accessToken: z.string().trim().min(20, 'Access Token Meta wajib diisi'),
  appSecret: z.string().trim().min(10, 'App Secret wajib diisi untuk verifikasi webhook HMAC'),
  webhookVerifyToken: z.string().trim().min(8, 'Webhook Verify Token wajib diisi minimal 8 karakter')
});

export const metaTemplateComponentSchema = z.object({
  type: z.enum(['HEADER', 'BODY', 'FOOTER', 'BUTTONS']),
  format: z.enum(['TEXT', 'IMAGE', 'DOCUMENT', 'VIDEO', 'LOCATION']).optional(),
  text: z.string().optional(),
  example: z.any().optional(),
  buttons: z.array(z.any()).optional()
});

export const metaTemplateSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  language: z.string().default('id'),
  category: z.enum(['UTILITY', 'MARKETING', 'AUTHENTICATION']),
  status: z.enum(['APPROVED', 'PENDING', 'REJECTED', 'PAUSED', 'ARCHIVED']),
  components: z.array(metaTemplateComponentSchema).default([])
});
