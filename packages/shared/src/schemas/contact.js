import { z } from 'zod';
import { normalizeIndonesianPhone } from '../phone.js';

export const contactSchema = z.object({
  type: z.enum(['employee', 'public']),
  name: z.string().min(2, 'Nama minimal 2 karakter').max(150),
  phone: z.string().transform((val, ctx) => {
    try {
      return normalizeIndonesianPhone(val);
    } catch (err) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: err.message
      });
      return z.NEVER;
    }
  }),
  status: z.enum(['active', 'inactive', 'unsubscribed', 'invalid_number']).default('active'),
  nip: z.string().optional().nullable(),
  unitKerja: z.string().optional().nullable(),
  jabatan: z.string().optional().nullable(),
  instansi: z.string().optional().nullable(),
  profesi: z.string().optional().nullable(),
  tagIds: z.array(z.string().uuid()).default([]),
  topicIds: z.array(z.string().uuid()).default([])
});

export const contactFilterSchema = z.object({
  type: z.enum(['employee', 'public']).optional(),
  status: z.enum(['active', 'inactive', 'unsubscribed', 'invalid_number']).optional(),
  unitKerja: z.string().optional(),
  tagIds: z.union([z.string(), z.array(z.string())]).optional(),
  topicIds: z.union([z.string(), z.array(z.string())]).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(10000).default(50)
});
