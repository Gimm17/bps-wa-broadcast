#!/usr/bin/env node

/**
 * Cross-Platform PostgreSQL Backup Script for BPS Sulteng WhatsApp Platform
 *
 * Runs pg_dump in compressed custom format (-Fc) and prunes archives older than retention window.
 */

import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const backupDir = process.env.BACKUP_DIR || path.join(rootDir, 'backups');
const retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS || '30', 10);

console.log('====================================================');
console.log(' BPS Sulteng WhatsApp Platform - Database Backup   ');
console.log('====================================================\n');

if (!process.env.DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL environment variable is required.');
  process.exit(1);
}

if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
const backupFile = path.join(backupDir, `bps_whatsapp_backup_${timestamp}.dump`);

function findPgDump() {
  if (process.env.PG_DUMP_PATH && fs.existsSync(process.env.PG_DUMP_PATH)) {
    return process.env.PG_DUMP_PATH;
  }

  const candidates = [
    'pg_dump',
    'C:\\Program Files\\PostgreSQL\\17\\bin\\pg_dump.exe',
    'C:\\Program Files\\PostgreSQL\\16\\bin\\pg_dump.exe',
    '/usr/bin/pg_dump',
    '/usr/local/bin/pg_dump'
  ];

  for (const bin of candidates) {
    if (path.isAbsolute(bin)) {
      if (fs.existsSync(bin)) return bin;
    } else {
      try {
        execSync(`${bin} --version`, { stdio: 'ignore' });
        return bin;
      } catch {
        // try next
      }
    }
  }

  return 'pg_dump';
}

const pgDumpBin = findPgDump();
console.log(`[1/3] Destination Archive: ${backupFile}`);
console.log(`      Using binary: ${pgDumpBin}`);

try {
  console.log('[2/3] Executing pg_dump with custom compression (-Fc)...');
  const dbUrl = new URL(process.env.DATABASE_URL);
  dbUrl.searchParams.delete('search_path');
  const cleanDbUrl = dbUrl.toString();

  const cmd = `"${pgDumpBin}" --dbname="${cleanDbUrl}" --format=custom --compress=9 --file="${backupFile}"`;
  execSync(cmd, { stdio: 'inherit' });

  const stats = fs.statSync(backupFile);
  const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`  ✓ Backup created successfully (${sizeMb} MB)`);
} catch (err) {
  console.error(`❌ ERROR: pg_dump execution failed: ${err.message}`);
  process.exit(1);
}

// Prune old backups
console.log(`[3/3] Applying retention policy (deleting archives older than ${retentionDays} days)...`);
try {
  const files = fs.readdirSync(backupDir);
  const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  let prunedCount = 0;

  for (const file of files) {
    if (file.startsWith('bps_whatsapp_backup_') && file.endsWith('.dump')) {
      const filePath = path.join(backupDir, file);
      const stat = fs.statSync(filePath);
      if (stat.mtimeMs < cutoffTime) {
        fs.unlinkSync(filePath);
        prunedCount++;
      }
    }
  }

  console.log(`  ✓ Retention cleanup complete (${prunedCount} old files pruned)`);
} catch (err) {
  console.warn(`  ⚠️ Warning during retention cleanup: ${err.message}`);
}

console.log('\n====================================================');
console.log(' ✅ BACKUP COMPLETED SUCCESSFULLY');
console.log('====================================================');
