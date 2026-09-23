#!/usr/bin/env node

import dotenv from 'dotenv';
import pg from 'pg';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runMigrations } from './migrate.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

console.log('====================================================');
console.log(' BPS Sulteng WhatsApp Platform - Deploy & Preflight ');
console.log('====================================================\n');

// 1. Runtime Version Check
const nodeMajor = Number(process.versions.node.split('.')[0]);
console.log(`[1/5] Checking Node.js runtime: v${process.versions.node}`);
if (nodeMajor < 22) {
  console.error(`❌ ERROR: Node.js version >= 22 is required. Current: ${process.versions.node}`);
  process.exit(1);
}
console.log('  ✓ Node.js runtime version satisfied (>= 22)\n');

// 2. Environment Variables Check
console.log('[2/5] Validating required environment contract...');
const required = ['DATABASE_URL', 'SESSION_SECRET', 'APP_ENCRYPTION_KEY', 'PUBLIC_APP_URL'];
const missing = required.filter(key => !process.env[key] || process.env[key].trim() === '');

if (missing.length > 0) {
  console.error(`❌ ERROR: Missing required environment variables:\n  - ${missing.join('\n  - ')}`);
  console.error('Please configure them in your panel environment or .env file.');
  process.exit(1);
}
console.log('  ✓ Required environment variables present');

if (!process.env.META_APP_SECRET) {
  console.warn('  ⚠️ WARNING: META_APP_SECRET is not set. Webhooks will not enforce HMAC signature validation.');
}
console.log();

// 3. PostgreSQL Database Connection Check
console.log('[3/5] Verifying PostgreSQL database connection...');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  await client.connect();
  const { rows } = await client.query('SELECT version(), current_database() as db_name, current_schema() as schema_name');
  console.log(`  ✓ Connected to DB: ${rows[0].db_name} (Schema: ${rows[0].schema_name})`);
  console.log(`  ✓ PostgreSQL Server: ${rows[0].version.split(',')[0]}`);
  await client.end();
} catch (err) {
  console.error(`❌ ERROR: Failed connecting to database: ${err.message}`);
  process.exit(1);
}
console.log();

// 4. Database Migrations
console.log('[4/5] Executing database schema migrations...');
try {
  await runMigrations({ withSeeds: false });
  console.log('  ✓ Schema migrations applied and up to date\n');
} catch (err) {
  console.error(`❌ ERROR: Migration failed: ${err.message}`);
  process.exit(1);
}

// 5. Build Svelte Web SPA
console.log('[5/5] Building Svelte 5 web production bundle...');
try {
  execSync('npm run build --workspace @bps/web', {
    cwd: rootDir,
    stdio: 'inherit'
  });
  console.log('  ✓ Web distribution build compiled successfully into apps/web/dist\n');
} catch (err) {
  console.error(`❌ ERROR: Frontend build failed: ${err.message}`);
  process.exit(1);
}

console.log('====================================================');
console.log(' ✅ PREFLIGHT & BUILD COMPLETED SUCCESSFULLY       ');
console.log(' Ready for hosting-panel process startup.           ');
console.log('====================================================');
process.exit(0);
