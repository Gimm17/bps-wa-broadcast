#!/usr/bin/env node

/**
 * 1-Minute Panel Cron Entrypoint for BPS Sulteng WhatsApp Platform
 *
 * Runs a single time-bounded execution batch (max 45 seconds).
 * Employs PostgreSQL advisory locks to safely prevent overlapping executions.
 */

import dotenv from 'dotenv';
import { runOnce } from '../apps/worker/src/run-once.js';

dotenv.config();

const MAX_RUNTIME_MS = 45000; // 45 seconds max runtime, leaving 15s before next cron trigger
const BATCH_SIZE = 100;

try {
  const result = await runOnce({
    maxRuntimeMs: MAX_RUNTIME_MS,
    batchSize: BATCH_SIZE,
    safetyMarginMs: 5000
  });

  const output = {
    event: result.status === 'locked_by_other_instance' ? 'worker_skipped' : 'worker_complete',
    timestamp: new Date().toISOString(),
    ...result
  };

  // Structured single-line JSON log for hosting panel log monitoring
  console.log(JSON.stringify(output));
  process.exit(0);
} catch (err) {
  console.error(JSON.stringify({
    event: 'worker_error',
    timestamp: new Date().toISOString(),
    error: err.message,
    stack: err.stack
  }));
  process.exit(1);
}
