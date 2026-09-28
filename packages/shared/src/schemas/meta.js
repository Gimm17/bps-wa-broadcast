import { z } from 'zod';

export const mpwaCredentialsSchema = z.object({
  provider: z.literal('mpwa').optional().default('mpwa'),
  apiKey: z.string().trim().min(5, 'API Key MPWA wajib diisi'),
  sender: z.string().trim().min(8, 'Nomor Pengirim (Sender) MPWA wajib diisi'),
  baseUrl: z.string().url('URL Base MPWA tidak valid').optional().default('https://www.wa-admin.novamedia.my.id'),
  webhookVerifyToken: z.string().trim().optional(),
  appSecret: z.string().trim().optional()
});

export const metaCredentialsSchema = z.union([
  z.object({
    provider: z.literal('mpwa').optional().default('mpwa'),
    apiKey: z.string().trim().min(5, 'API Key MPWA wajib diisi'),
    sender: z.string().trim().min(8, 'Nomor Pengirim (Sender) MPWA wajib diisi'),
    baseUrl: z.string().url('URL Base MPWA tidak valid').optional().default('https://www.wa-admin.novamedia.my.id'),
    webhookVerifyToken: z.string().trim().optional(),
    appSecret: z.string().trim().optional()
  }),
  z.object({
    provider: z.literal('meta_cloud').optional(),
    wabaId: z.string().trim().min(5, 'WABA ID wajib diisi'),
    phoneNumberId: z.string().trim().min(5, 'Phone Number ID wajib diisi'),
    accessToken: z.string().trim().min(20, 'Access Token Meta wajib diisi'),
    appSecret: z.string().trim().optional(),
    webhookVerifyToken: z.string().trim().optional()
  })
]);

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
