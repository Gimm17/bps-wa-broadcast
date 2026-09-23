import { z } from 'zod';

export const campaignTypeSchema = z.enum(['manual', 'scheduled', 'automation']);
export const campaignStatusSchema = z.enum([
  'draft',
  'scheduled',
  'processing',
  'completed',
  'paused',
  'cancelled',
  'failed'
]);

export const targetSegmentSchema = z.object({
  contactType: z.enum(['employee', 'public', 'all']).default('all'),
  topicId: z.string().uuid().optional(),
  unitKerja: z.string().optional(),
  tagIds: z.array(z.string().uuid()).optional()
}).default({});

export const templateParamMappingSchema = z.record(
  z.string(), // parameter index like '1', '2'
  z.object({
    source: z.enum(['contact.name', 'contact.phone', 'employee.nip', 'employee.unit_kerja', 'literal']),
    value: z.string().optional()
  })
);

export const createCampaignSchema = z.object({
  title: z.string().trim().min(3, 'Judul kampanye wajib diisi minimal 3 karakter').max(150),
  type: campaignTypeSchema.default('manual'),
  templateId: z.string().uuid('Template WhatsApp wajib dipilih'),
  targetSegment: targetSegmentSchema,
  templateParams: templateParamMappingSchema.default({}),
  scheduledAt: z.string().datetime().optional()
});

export const updateCampaignSchema = z.object({
  title: z.string().trim().min(3).max(150).optional(),
  type: campaignTypeSchema.optional(),
  templateId: z.string().uuid().optional(),
  targetSegment: targetSegmentSchema.optional(),
  templateParams: templateParamMappingSchema.optional(),
  scheduledAt: z.string().datetime().nullable().optional()
});
