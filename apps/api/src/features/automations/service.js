import { isWorkday, toWitaDate } from '../calendar/service.js';
import { enqueueMessage } from '../../db/queue.js';

/**
 * Evaluates and executes an Attendance Reminder rule with strict freshness and workday checks.
 */
export async function runAttendanceRule({ db, rule, now = new Date(), adapter }) {
  // 1. Workday evaluation
  const workday = await isWorkday(now, db);
  if (!workday) {
    return { queued: 0, skippedHoliday: true, alertCode: null };
  }

  // 2. Fetch attendance data from adapter
  let statusData;
  try {
    statusData = await adapter.fetchStatus();
  } catch (err) {
    await _recordAlert(db, 'ATTENDANCE_DATA_STALE', `Gagal mengambil data SIMPEG: ${err.message}`);
    return { queued: 0, skippedPresent: 0, alertCode: 'ATTENDANCE_DATA_STALE', error: err.message };
  }

  // 3. Check data freshness
  const maxAgeMinutes = rule.config?.maxAgeMinutes || 30;
  const observedTime = new Date(statusData.observedAt || 0).getTime();
  const currentTime = new Date(now).getTime();
  const ageMinutes = (currentTime - observedTime) / (60 * 1000);

  if (isNaN(ageMinutes) || ageMinutes > maxAgeMinutes || ageMinutes < -5) {
    await _recordAlert(
      db,
      'ATTENDANCE_DATA_STALE',
      `Data presensi SIMPEG usang (${Math.round(ageMinutes)} menit yang lalu). Ambang batas maksimal ${maxAgeMinutes} menit.`
    );
    return { queued: 0, skippedPresent: 0, alertCode: 'ATTENDANCE_DATA_STALE' };
  }

  // 4. Process employee records
  const records = statusData.records || [];
  let queued = 0;
  let skippedPresent = 0;
  const dateStr = toWitaDate(now);
  const reminderType = rule.config?.reminderType || 'in';

  for (const rec of records) {
    if (rec.status === 'PRESENT') {
      skippedPresent++;
      continue;
    }

    // Find contact by NIP
    const { rows: contactRows } = await db.query(`
      SELECT c.id, c.name, c.phone_e164 
      FROM contacts c
      JOIN employee_profiles ep ON c.id = ep.contact_id
      WHERE ep.nip = $1 AND c.status = 'active'
    `, [rec.nip]);

    if (contactRows.length === 0) {
      continue;
    }

    const contact = contactRows[0];
    const idempotencyKey = `attendance:${dateStr}:${rec.nip}:${reminderType}`;

    try {
      await enqueueMessage(db, {
        contactId: contact.id,
        templateId: rule.template_id,
        idempotencyKey,
        payload: {
          nip: rec.nip,
          name: contact.name,
          date: dateStr,
          reminderType
        },
        availableAt: now
      });
      queued++;
    } catch (err) {
      if (err.code === '23505') {
        // Duplicate message for this employee & date already enqueued
        continue;
      }
      throw err;
    }
  }

  // Update rule last_run_at
  await db.query('UPDATE automation_rules SET updated_at = now() WHERE id = $1', [rule.id]);

  return { queued, skippedPresent, alertCode: null };
}

/**
 * Ingests external source trigger events with database deduplication.
 */
export async function processTriggerEvent(db, event, { templateId = null } = {}) {
  const { source, eventType, externalId, payload } = event;
  const idempotencyKey = event.idempotencyKey || `${source}:${externalId}:${eventType}`;

  // 1. Attempt to insert into trigger_events with unique idempotency_key
  let triggerEventId;
  try {
    const { rows } = await db.query(`
      INSERT INTO trigger_events (source, event_type, external_id, payload, idempotency_key, status)
      VALUES ($1, $2, $3, $4, $5, 'pending')
      RETURNING id
    `, [source, eventType, externalId, JSON.stringify(payload), idempotencyKey]);
    triggerEventId = rows[0].id;
  } catch (err) {
    if (err.code === '23505') {
      return { status: 'duplicate_ignored', enqueued: false };
    }
    throw err;
  }

  // 2. Resolve recipient contact if applicable
  let enqueued = false;
  let targetContactId = null;

  if (payload.picNip) {
    const { rows } = await db.query(`
      SELECT c.id FROM contacts c
      JOIN employee_profiles ep ON c.id = ep.contact_id
      WHERE ep.nip = $1
    `, [payload.picNip]);
    targetContactId = rows[0]?.id;
  } else if (payload.applicantPhone) {
    const { rows } = await db.query('SELECT id FROM contacts WHERE phone_e164 = $1', [payload.applicantPhone]);
    targetContactId = rows[0]?.id;
  }

  // 3. Enqueue notification message if template is configured
  if (targetContactId && templateId) {
    const msgKey = `${source}:${externalId}:${targetContactId}`;
    try {
      await enqueueMessage(db, {
        contactId: targetContactId,
        templateId,
        idempotencyKey: msgKey,
        payload,
        availableAt: new Date()
      });
      enqueued = true;
    } catch (err) {
      if (err.code !== '23505') throw err;
    }
  }

  // 4. Mark event as processed
  await db.query(`
    UPDATE trigger_events 
    SET status = 'processed', processed_at = now() 
    WHERE id = $1
  `, [triggerEventId]);

  return { status: 'processed', enqueued };
}

async function _recordAlert(db, code, message) {
  try {
    await db.query(`
      INSERT INTO system_alerts (severity, code, title, message)
      VALUES ('warning', $1, 'Peringatan Otomasi SIMPEG', $2)
    `, [code, message]);
  } catch (e) {
    // Non-blocking alert failure
  }
}
