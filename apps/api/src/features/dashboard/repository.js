import { pool } from '../../db/pool.js';

export async function getDashboardSummary(db = pool, { from, to } = {}) {
  let query = `
    SELECT 
      count(*)::int as total,
      count(*) FILTER (WHERE status = 'queued')::int as queued,
      count(*) FILTER (WHERE status = 'sending')::int as sending,
      count(*) FILTER (WHERE status = 'sent')::int as sent,
      count(*) FILTER (WHERE status = 'delivered')::int as delivered,
      count(*) FILTER (WHERE status = 'read')::int as read,
      count(*) FILTER (WHERE status = 'failed')::int as failed,
      count(*) FILTER (WHERE status = 'cancelled')::int as cancelled,
      count(*) FILTER (WHERE status = 'suppressed')::int as suppressed
    FROM messages
  `;
  const params = [];

  if (from && to) {
    query += ' WHERE created_at >= $1 AND created_at <= $2';
    params.push(from, to);
  } else if (from) {
    query += ' WHERE created_at >= $1';
    params.push(from);
  }

  const { rows } = await db.query(query, params);
  const row = rows[0] || {};

  return {
    total: row.total || 0,
    queued: row.queued || 0,
    sending: row.sending || 0,
    sent: row.sent || 0,
    delivered: row.delivered || 0,
    read: row.read || 0,
    failed: row.failed || 0,
    cancelled: row.cancelled || 0,
    suppressed: row.suppressed || 0
  };
}

export async function getDashboardTrends(db = pool, { days = 14 } = {}) {
  const { rows } = await db.query(`
    SELECT 
      to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as date,
      count(*)::int as total,
      count(*) FILTER (WHERE status IN ('sent', 'delivered', 'read'))::int as sent,
      count(*) FILTER (WHERE status IN ('delivered', 'read'))::int as delivered,
      count(*) FILTER (WHERE status = 'read')::int as read,
      count(*) FILTER (WHERE status = 'failed')::int as failed
    FROM messages
    WHERE created_at >= now() - make_interval(days => $1)
    GROUP BY date_trunc('day', created_at)
    ORDER BY date_trunc('day', created_at) ASC
  `, [days]);

  return rows;
}

export async function getHealthSummary(db = pool) {
  // 1. Worker heartbeat
  const { rows: hbRows } = await db.query(`
    SELECT id, started_at, finished_at, status, stats, error,
           extract(epoch from (now() - started_at))::int as seconds_ago
    FROM worker_heartbeats
    ORDER BY started_at DESC
    LIMIT 1
  `);

  const lastHb = hbRows[0];
  let cronStatus = 'standby';
  if (lastHb) {
    if (lastHb.seconds_ago <= 180) { // within 3 minutes
      cronStatus = lastHb.status === 'failed' ? 'error' : 'active';
    } else {
      cronStatus = 'delayed';
    }
  }

  // 2. Meta integration
  const { rows: metaRows } = await db.query(`
    SELECT status, last_sync_at, last_error
    FROM integrations
    WHERE type = 'meta_waba'
  `);
  const wabaStatus = metaRows[0]?.status === 'connected' ? 'connected' : 'standby';

  // 3. Active alerts count
  const { rows: alertRows } = await db.query(`
    SELECT count(*)::int as count 
    FROM system_alerts 
    WHERE is_resolved = false
  `);

  // 4. Oldest queued message age in seconds
  const { rows: queueRows } = await db.query(`
    SELECT extract(epoch from (now() - min(available_at)))::int as oldest_age_seconds
    FROM messages
    WHERE status = 'queued'
  `);

  return {
    cronStatus,
    wabaStatus,
    lastHeartbeat: lastHb || null,
    activeAlertsCount: alertRows[0]?.count || 0,
    oldestQueueAgeSeconds: queueRows[0]?.oldest_age_seconds || 0,
    evaluatedAt: new Date().toISOString()
  };
}
