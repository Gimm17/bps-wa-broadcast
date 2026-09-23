import { pool } from '../../db/pool.js';

export async function checkSystemReadiness(db = pool) {
  const checks = {
    database: false,
    cronWorker: false,
    alerts: 0
  };

  // 1. Database check
  try {
    const { rows } = await db.query('SELECT 1 as ok');
    checks.database = rows[0]?.ok === 1;
  } catch {
    checks.database = false;
  }

  // 2. Cron worker check
  try {
    const { rows } = await db.query(`
      SELECT extract(epoch from (now() - started_at))::int as sec
      FROM worker_heartbeats
      ORDER BY started_at DESC
      LIMIT 1
    `);
    // Healthy if a worker run was started within the last 5 minutes (300s)
    checks.cronWorker = rows.length > 0 && (rows[0].sec <= 300);
  } catch {
    checks.cronWorker = false;
  }

  // 3. Active alerts
  try {
    const { rows } = await db.query(`
      SELECT count(*)::int as cnt FROM system_alerts WHERE is_resolved = false
    `);
    checks.alerts = rows[0]?.cnt || 0;
  } catch {
    checks.alerts = 0;
  }

  const isReady = checks.database; // DB is strictly mandatory for readiness

  return {
    status: isReady ? 'ready' : 'unhealthy',
    timestamp: new Date().toISOString(),
    checks
  };
}

export async function listSystemAlerts(db = pool) {
  const { rows } = await db.query(`
    SELECT * FROM system_alerts
    ORDER BY is_resolved ASC, created_at DESC
    LIMIT 50
  `);
  return rows;
}
