import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

export const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().default('postgresql://catur_app:CaturDbLocal_2026!@localhost:5432/catur_dev?search_path=bps_whatsapp,public'),
  SESSION_SECRET: z.string().min(16).default('dev_session_secret_bps_sulteng_2026_at_least_32_chars!'),
  APP_ENCRYPTION_KEY: z.string().min(32).default('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'),
  PUBLIC_APP_URL: z.string().url().default('http://localhost:5173'),
  META_APP_ID: z.string().optional().default(''),
  META_APP_SECRET: z.string().optional().default(''),
  META_PHONE_NUMBER_ID: z.string().optional().default(''),
  META_WABA_ID: z.string().optional().default(''),
  META_ACCESS_TOKEN: z.string().optional().default(''),
  META_WEBHOOK_VERIFY_TOKEN: z.string().optional().default(''),
});

export function loadConfig(env = process.env) {
  const result = configSchema.safeParse(env);
  if (!result.success) {
    console.error('Invalid configuration:', result.error.format());
    throw new Error(`Configuration validation failed: ${result.error.message}`);
  }
  return result.data;
}

export const config = loadConfig();
