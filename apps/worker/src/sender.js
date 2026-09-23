import { classifyMetaError, calculateBackoff } from './retry.js';

export async function sendSingleMessage({
  db,
  message,
  metaClient,
  customSender,
  circuitBreaker,
  logger
}) {
  const { id: messageId, campaign_id: campaignId, contact_id: contactId, template_id: templateId } = message;

  // 1. Re-check campaign cancellation
  if (campaignId) {
    const { rows: campRows } = await db.query('SELECT status FROM campaigns WHERE id = $1', [campaignId]);
    if (campRows.length > 0 && campRows[0].status === 'cancelled') {
      await db.query(`
        UPDATE messages 
        SET status = 'cancelled', updated_at = now() 
        WHERE id = $1
      `, [messageId]);

      await db.query(`
        INSERT INTO message_status_events (message_id, status, timestamp, raw_payload)
        VALUES ($1, 'cancelled', now(), $2)
      `, [messageId, JSON.stringify({ reason: 'campaign_cancelled' })]);

      return { status: 'cancelled' };
    }
  }

  // 2. Fetch contact and verify pre-send suppression
  const { rows: contactRows } = await db.query('SELECT phone_e164, status FROM contacts WHERE id = $1', [contactId]);
  if (contactRows.length === 0 || contactRows[0].status === 'inactive') {
    await db.query(`
      UPDATE messages 
      SET status = 'suppressed', last_error_code = 'inactive_contact', updated_at = now() 
      WHERE id = $1
    `, [messageId]);

    await db.query(`
      INSERT INTO message_status_events (message_id, status, timestamp, raw_payload)
      VALUES ($1, 'suppressed', now(), $2)
    `, [messageId, JSON.stringify({ reason: 'inactive_contact' })]);

    return { status: 'suppressed' };
  }

  const phone = contactRows[0].phone_e164;
  const { rows: supRows } = await db.query('SELECT id FROM suppression_entries WHERE phone_e164 = $1', [phone]);
  if (supRows.length > 0) {
    await db.query(`
      UPDATE messages 
      SET status = 'suppressed', last_error_code = 'unsubscribed', updated_at = now() 
      WHERE id = $1
    `, [messageId]);

    await db.query(`
      INSERT INTO message_status_events (message_id, status, timestamp, raw_payload)
      VALUES ($1, 'suppressed', now(), $2)
    `, [messageId, JSON.stringify({ reason: 'suppressed_opt_out' })]);

    return { status: 'suppressed' };
  }

  // 3. Fetch template details
  const { rows: tplRows } = await db.query('SELECT name, language FROM meta_templates WHERE id = $1', [templateId]);
  const templateName = tplRows[0]?.name || 'unknown';
  const language = tplRows[0]?.language || 'id';

  // Parse message payload for components
  const payload = typeof message.payload === 'string' ? JSON.parse(message.payload) : (message.payload || {});
  const components = payload.components || [];

  // 4. Send message
  try {
    let result;
    if (customSender) {
      result = await customSender({
        to: phone,
        templateName,
        languageCode: language,
        components,
        message
      });
    } else if (metaClient) {
      result = await metaClient.sendTemplate({
        to: phone,
        templateName,
        languageCode: language,
        components
      });
    } else {
      throw new Error('No Meta client or custom sender configured');
    }

    const metaMessageId = result.metaMessageId || result.messageId || null;

    // Success update
    await db.query(`
      UPDATE messages 
      SET status = 'sent',
          meta_message_id = $2,
          updated_at = now()
      WHERE id = $1
    `, [messageId, metaMessageId]);

    await db.query(`
      INSERT INTO message_status_events (message_id, status, timestamp, raw_payload)
      VALUES ($1, 'sent', now(), $2)
    `, [messageId, JSON.stringify(result.raw || result)]);

    if (campaignId) {
      await db.query('UPDATE campaigns SET sent_count = sent_count + 1 WHERE id = $1', [campaignId]);
    }

    if (circuitBreaker) {
      circuitBreaker.recordSuccess();
    }

    return { status: 'sent', metaMessageId };
  } catch (err) {
    const classified = classifyMetaError(err);
    if (circuitBreaker) {
      circuitBreaker.recordFailure(err);
    }

    const attemptCount = (message.attempt_count || 0) + 1;
    const maxAttempts = 3;

    if (classified.isTransient && attemptCount < maxAttempts) {
      const delayMs = calculateBackoff(attemptCount);
      await db.query(`
        UPDATE messages
        SET status = 'queued',
            attempt_count = $2,
            available_at = now() + make_interval(secs => $3),
            lease_owner = null,
            lease_expires_at = null,
            last_error_code = $4,
            last_error_message = $5,
            updated_at = now()
        WHERE id = $1
      `, [messageId, attemptCount, delayMs / 1000, classified.category, err.message]);

      await db.query(`
        INSERT INTO message_status_events (message_id, status, timestamp, raw_payload)
        VALUES ($1, 'queued', now(), $2)
      `, [messageId, JSON.stringify({ retryAttempt: attemptCount, error: err.message, delayMs })]);

      return { status: 'retried', error: err.message };
    } else {
      await db.query(`
        UPDATE messages
        SET status = 'failed',
            attempt_count = $2,
            last_error_code = $3,
            last_error_message = $4,
            updated_at = now()
        WHERE id = $1
      `, [messageId, attemptCount, classified.category, err.message]);

      await db.query(`
        INSERT INTO message_status_events (message_id, status, timestamp, raw_payload)
        VALUES ($1, 'failed', now(), $2)
      `, [messageId, JSON.stringify({ error: err.message, category: classified.category })]);

      if (campaignId) {
        await db.query('UPDATE campaigns SET failed_count = failed_count + 1 WHERE id = $1', [campaignId]);
      }

      return { status: 'failed', error: err.message };
    }
  }
}
