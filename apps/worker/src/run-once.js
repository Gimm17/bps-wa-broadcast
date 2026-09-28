import crypto from 'node:crypto';
import pino from 'pino';
import { pool as defaultPool } from '../../api/src/db/pool.js';
import { claimMessageBatch } from '../../api/src/db/queue.js';
import { evaluateDueSchedules } from './scheduler.js';
import { sendSingleMessage } from './sender.js';
import { CircuitBreaker } from './circuit-breaker.js';
import { MpwaClient } from '../../api/src/features/meta/client.js';
import { config } from '../../api/src/config.js';

const defaultLogger = pino({ name: 'bps-worker' });
const DEFAULT_LOCK_ID = 987654321;

/**
 * Create default MPWA client from environment config if credentials are available.
 */
function createDefaultMpwaClient() {
  if (!config.MPWA_API_KEY || !config.MPWA_SENDER) return null;
  return new MpwaClient({
    apiKey: config.MPWA_API_KEY,
    sender: config.MPWA_SENDER,
    baseUrl: config.MPWA_BASE_URL
  });
}

/**
 * Recovers messages that were left in 'sending' status past their lease expiry.
 */
export async function recoverExpiredLeases(db) {
  const { rowCount } = await db.query(`
    UPDATE messages
    SET status = 'queued',
        lease_owner = null,
        lease_expires_at = null,
        updated_at = now()
    WHERE status = 'sending'
      AND lease_expires_at <= now()
  `);
  return rowCount;
}

/**
 * Main bounded one-shot worker routine intended to be called by 1-minute cron.
 */
export async function runOnce({
  db = defaultPool,
  lockId = DEFAULT_LOCK_ID,
  batchSize = 25,
  leaseSeconds = 60,
  maxRuntimeMs = 55000,
  safetyMarginMs = 5000,
  metaClient = createDefaultMpwaClient(),
  customSender = null,
  logger = defaultLogger
} = {}) {
  const workerId = `worker-${crypto.randomUUID().slice(0, 8)}`;
  const startTime = Date.now();

  // 1. Acquire dedicated connection from pool for session-level advisory lock
  const lockClient = await db.connect();
  let lockAcquired = false;

  try {
    const { rows: lockRows } = await lockClient.query('SELECT pg_try_advisory_lock($1) as acquired', [lockId]);
    lockAcquired = Boolean(lockRows[0] && lockRows[0].acquired);

    if (!lockAcquired) {
      logger.info({ workerId, lockId }, 'Worker instance already executing, skipping this run');
      return { status: 'locked_by_other_instance' };
    }
  } catch (err) {
    lockClient.release();
    throw err;
  }

  // Record initial heartbeat
  let heartbeatId = null;
  try {
    const { rows: hbRows } = await db.query(`
      INSERT INTO worker_heartbeats (worker_id, started_at, status, stats)
      VALUES ($1, now(), 'running', '{}'::jsonb)
      RETURNING id
    `, [workerId]);
    heartbeatId = hbRows[0]?.id;
  } catch (err) {
    logger.warn({ err }, 'Failed to record worker heartbeat start');
  }

  const stats = {
    recoveredLeases: 0,
    batchesProcessed: 0,
    messagesClaimed: 0,
    sent: 0,
    retried: 0,
    failed: 0,
    suppressed: 0,
    cancelled: 0
  };

  const circuitBreaker = new CircuitBreaker({ db, logger });

  let activeSender = metaClient;
  if (!activeSender && !customSender) {
    try {
      const { integrationRepository } = await import('../../api/src/features/integrations/repository.js');
      const creds = await integrationRepository.getDecryptedCredentials('meta_waba', db);
      if (creds && (creds.apiKey || creds.accessToken)) {
        activeSender = new MpwaClient({
          apiKey: creds.apiKey || creds.accessToken,
          sender: creds.sender || creds.phoneNumberId,
          baseUrl: creds.baseUrl || config.MPWA_BASE_URL
        });
      }
    } catch (err) {
      logger.warn({ err }, 'Tidak dapat memuat kredensial MPWA dari tabel database integrations');
    }
  }

  try {
    // 2. Recover abandoned/expired leases
    stats.recoveredLeases = await recoverExpiredLeases(db);
    if (stats.recoveredLeases > 0) {
      logger.info({ recovered: stats.recoveredLeases }, 'Recovered expired message leases');
    }

    // 3. Evaluate due campaign schedules
    await evaluateDueSchedules({ db, logger });

    // 4. Bounded batch execution loop
    while ((Date.now() - startTime) < (maxRuntimeMs - safetyMarginMs)) {
      if (!circuitBreaker.canExecute()) {
        logger.warn('Circuit breaker open; terminating worker batch processing early');
        break;
      }

      const batch = await claimMessageBatch(db, {
        workerId,
        limit: batchSize,
        leaseSeconds
      });

      if (!batch || batch.length === 0) {
        break; // Queue is empty, exit loop
      }

      stats.batchesProcessed++;
      stats.messagesClaimed += batch.length;

      for (const message of batch) {
        // Enforce time boundary per message
        if ((Date.now() - startTime) >= (maxRuntimeMs - safetyMarginMs)) {
          logger.info('Time budget reached; releasing remaining messages in current batch');
          break;
        }

        const res = await sendSingleMessage({
          db,
          message,
          metaClient: activeSender,
          customSender,
          circuitBreaker,
          logger
        });

        if (res.status === 'sent') stats.sent++;
        else if (res.status === 'retried') stats.retried++;
        else if (res.status === 'failed') stats.failed++;
        else if (res.status === 'suppressed') stats.suppressed++;
        else if (res.status === 'cancelled') stats.cancelled++;
      }
    }

    const durationMs = Date.now() - startTime;

    // Update heartbeat to completed
    if (heartbeatId) {
      await db.query(`
        UPDATE worker_heartbeats
        SET status = 'completed',
            finished_at = now(),
            stats = $2
        WHERE id = $1
      `, [heartbeatId, JSON.stringify({ durationMs, ...stats })]);
    }

    return {
      status: 'completed',
      workerId,
      durationMs,
      stats
    };
  } catch (err) {
    logger.error({ err, workerId }, 'Worker run-once failed with error');
    if (heartbeatId) {
      await db.query(`
        UPDATE worker_heartbeats
        SET status = 'failed',
            finished_at = now(),
            error = $2,
            stats = $3
        WHERE id = $1
      `, [heartbeatId, err.message, JSON.stringify(stats)]);
    }
    throw err;
  } finally {
    // 5. Always release advisory lock and return client connection to pool
    if (lockClient) {
      try {
        if (lockAcquired) {
          await lockClient.query('SELECT pg_advisory_unlock($1)', [lockId]);
        }
      } catch (e) {
        logger.warn({ err: e }, 'Failed to unlock advisory lock cleanly');
      } finally {
        lockClient.release();
      }
    }
  }
}
