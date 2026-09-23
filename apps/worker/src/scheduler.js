import { DateTime } from 'luxon';

const WITA_ZONE = 'Asia/Makassar';

export async function evaluateDueSchedules({ db, now = new Date(), logger }) {
  const dueCampaigns = [];

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

  return { activatedCampaigns: dueCampaigns };
}
