import { DateTime } from 'luxon';
import { isWorkday, toWitaDate, WITA_ZONE } from '../../api/src/features/calendar/service.js';
import { runEventReminderRule, runAttendanceRule } from '../../api/src/features/automations/service.js';
import { createAttendanceAdapter } from '../../api/src/adapters/attendance.js';

export async function evaluateDueSchedules({ db, now = new Date(), logger }) {
  const dueCampaigns = [];
  const dueRules = [];

  // 1. Check scheduled campaigns ready for processing
  const { rows: campaigns } = await db.query(`
    UPDATE campaigns
    SET status = 'processing',
        started_at = COALESCE(started_at, now()),
        updated_at = now()
    WHERE status = 'scheduled'
      AND scheduled_at <= $1
    RETURNING id, title, scheduled_at
  `, [now]);

  for (const camp of campaigns) {
    if (logger) {
      logger.info({ campaignId: camp.id, title: camp.title }, 'Scheduled campaign activated');
    }
    dueCampaigns.push(camp);
  }

  // 2. Check completed campaigns (all messages either sent, delivered, read, failed, cancelled, or suppressed)
  await db.query(`
    UPDATE campaigns c
    SET status = 'completed',
        completed_at = now(),
        updated_at = now()
    WHERE status = 'processing'
      AND NOT EXISTS (
        SELECT 1 FROM messages m
        WHERE m.campaign_id = c.id
          AND m.status IN ('queued', 'sending')
      )
  `);

  // 3. Evaluate due active automation rules
  try {
    const { rows: activeRules } = await db.query(`
      SELECT * FROM automation_rules WHERE is_active = true
    `);

    const witaNow = DateTime.fromJSDate(now).setZone(WITA_ZONE);
    const todayWita = witaNow.toISODate(); // 'YYYY-MM-DD'
    const currentTimeWita = witaNow.toFormat('HH:mm'); // 'HH:mm'
    const weekdayLuxon = witaNow.weekday; // 1 (Mon) to 7 (Sun)
    const idDayNames = ['', 'senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu'];
    const enDayNames = ['', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const currentDayId = idDayNames[weekdayLuxon];
    const currentDayEn = enDayNames[weekdayLuxon];

    for (const rule of activeRules) {
      try {
        const config = rule.config || {};
        const lastRunDate = rule.last_run_at ? toWitaDate(rule.last_run_at) : null;

        // Do not trigger again if already executed today in WITA
        if (lastRunDate === todayWita) {
          continue;
        }

        let isDue = false;

        if (rule.type === 'event_reminder' || rule.type === 'custom') {
          const scheduleType = config.scheduleType || 'recurring';
          const targetTime = config.eventTime || '09:00';

          if (scheduleType === 'once') {
            const targetDate = config.eventDate;
            if (targetDate === todayWita && currentTimeWita >= targetTime) {
              isDue = true;
            }
          } else if (scheduleType === 'recurring') {
            const recurringDays = Array.isArray(config.recurringDays) ? config.recurringDays : [];
            const dayMatches = recurringDays.length === 0 || recurringDays.some(d => {
              const low = String(d).trim().toLowerCase();
              return low === currentDayId || low === currentDayEn;
            });

            if (dayMatches && currentTimeWita >= targetTime) {
              isDue = true;
            }
          }

          if (isDue) {
            if (logger) logger.info({ ruleId: rule.id, name: rule.name }, 'Triggering scheduled event reminder rule');
            await runEventReminderRule({ db, rule, now });
            await db.query('UPDATE automation_rules SET last_run_at = now(), updated_at = now() WHERE id = $1', [rule.id]);
            dueRules.push(rule);
          }
        } else if (rule.type === 'attendance_presensi') {
          const targetTime = config.targetTime || '08:00';
          if (currentTimeWita >= targetTime) {
            const workday = await isWorkday(now, db);
            if (workday) {
              if (logger) logger.info({ ruleId: rule.id, name: rule.name }, 'Triggering scheduled attendance rule');
              const adapter = createAttendanceAdapter();
              await runAttendanceRule({ db, rule, now, adapter });
              await db.query('UPDATE automation_rules SET last_run_at = now(), updated_at = now() WHERE id = $1', [rule.id]);
              dueRules.push(rule);
            }
          }
        }
      } catch (ruleErr) {
        if (logger) logger.error({ ruleId: rule.id, err: ruleErr.message }, 'Failed evaluating automation rule schedule');
      }
    }
  } catch (err) {
    if (logger) logger.error({ err }, 'Failed checking active automation rules in evaluateDueSchedules');
  }

  return { activatedCampaigns: dueCampaigns, activatedRules: dueRules };
}

