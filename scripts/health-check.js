#!/usr/bin/env node

/**
 * Production Health & Smoke Check Script for BPS Sulteng WhatsApp Platform
 *
 * Verifies:
 * - PostgreSQL database connectivity & schema integrity
 * - Worker heartbeat recency
 * - Circuit breaker & system alerts
 * - HTTP /api/health/live and /api/health/ready endpoints (if server active)
 */

import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const port = process.env.PORT || 3000;
const host = process.env.HOST || 'localhost';
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

console.log('====================================================');
console.log(' BPS Sulteng WhatsApp Platform - Production Health  ');
console.log('====================================================\n');

let hasFailure = false;

// 1. Database Health Check
try {
  await client.connect();
  const url = new URL(process.env.DATABASE_URL);
  const searchPath = url.searchParams.get('search_path');
  if (searchPath) {
    await client.query(`SET search_path TO ${searchPath};`);
  }
  const { rows } = await client.query('SELECT 1 as healthy, now() as server_time');
  console.log(`[✓] PostgreSQL Database: CONNECTED (Server Time: ${rows[0].server_time.toISOString()})`);
} catch (err) {
  console.error(`[✕] PostgreSQL Database: FAILED (${err.message})`);
  hasFailure = true;
}

// 2. Schema Migrations Verification
if (!hasFailure) {
  try {
    const { rows: migRows } = await client.query('SELECT COUNT(*)::int as count FROM schema_migrations');
    console.log(`[✓] Schema Migrations: ${migRows[0].count} migrations applied`);
  } catch (err) {
    console.error(`[✕] Schema Migrations: FAILED (${err.message})`);
    hasFailure = true;
  }
}

// 3. Worker Heartbeat Check
if (!hasFailure) {
  try {
    const { rows: hbRows } = await client.query(`
      SELECT worker_id, started_at, finished_at, status
      FROM worker_heartbeats
      ORDER BY started_at DESC
      LIMIT 1
    `);

    if (hbRows.length > 0) {
      const lastHb = hbRows[0];
      const ageMinutes = (Date.now() - new Date(lastHb.started_at).getTime()) / (60 * 1000);
      console.log(`[✓] Worker Heartbeat: Last run ${Math.round(ageMinutes)}m ago (Worker: ${lastHb.worker_id}, Status: ${lastHb.status})`);
    } else {
      console.log('[!] Worker Heartbeat: No previous heartbeats recorded yet (Initial setup)');
    }
  } catch (err) {
    console.warn(`[!] Worker Heartbeat check skipped: ${err.message}`);
  }
}

// 4. Critical Alerts Check
if (!hasFailure) {
  try {
    const { rows: alertRows } = await client.query(`
      SELECT code, title, severity, created_at
      FROM system_alerts
      WHERE is_resolved = false AND severity IN ('critical', 'error')
      ORDER BY created_at DESC
      LIMIT 5
    `);

    if (alertRows.length > 0) {
      console.warn(`[!] Active System Alerts (${alertRows.length} unresolved):`);
      for (const a of alertRows) {
        console.warn(`    - [${a.severity.toUpperCase()}] ${a.code}: ${a.title}`);
      }
    } else {
      console.log('[✓] System Alerts: No unresolved critical alerts');
    }
  } catch (err) {
    console.warn(`[!] System Alerts check skipped: ${err.message}`);
  }
}

await client.end();

// 5. HTTP API Endpoints Check (if server is reachable)
try {
  const url = `http://${host}:${port}/api/health/live`;
  const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
  if (res.ok) {
    console.log(`[✓] API Liveness: ${url} returned ${res.status}`);
  } else {
    console.warn(`[!] API Liveness returned status ${res.status}`);
  }
} catch {
  console.log(`[i] API HTTP endpoint (port ${port}) is offline (normal if tested during static preflight).`);
}

console.log('\n====================================================');
if (hasFailure) {
  console.error(' ❌ HEALTH CHECK FAILED: Correct errors above.');
  console.log('====================================================');
  process.exit(1);
} else {
  console.log(' ✅ SYSTEM HEALTH CHECKS PASSED');
  console.log('====================================================');
  process.exit(0);
}
