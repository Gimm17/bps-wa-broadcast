export async function up(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS meta_templates (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      meta_template_id text UNIQUE,
      name text NOT NULL,
      language text NOT NULL,
      category text NOT NULL,
      status text NOT NULL CHECK (status IN ('APPROVED', 'PENDING', 'REJECTED', 'PAUSED', 'ARCHIVED')),
      components jsonb NOT NULL DEFAULT '[]'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (name, language)
    );

    CREATE TABLE IF NOT EXISTS campaigns (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      title text NOT NULL,
      type text NOT NULL CHECK (type IN ('manual', 'scheduled', 'automation')),
      status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'processing', 'completed', 'paused', 'cancelled', 'failed')),
      template_id uuid REFERENCES meta_templates(id),
      target_segment jsonb DEFAULT '{}'::jsonb,
      template_params jsonb DEFAULT '{}'::jsonb,
      scheduled_at timestamptz,
      started_at timestamptz,
      completed_at timestamptz,
      total_recipients integer NOT NULL DEFAULT 0,
      sent_count integer NOT NULL DEFAULT 0,
      delivered_count integer NOT NULL DEFAULT 0,
      read_count integer NOT NULL DEFAULT 0,
      failed_count integer NOT NULL DEFAULT 0,
      created_by uuid REFERENCES users(id),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS messages (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      campaign_id uuid REFERENCES campaigns(id) ON DELETE SET NULL,
      contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
      template_id uuid NOT NULL REFERENCES meta_templates(id),
      idempotency_key text NOT NULL UNIQUE,
      payload jsonb NOT NULL,
      status text NOT NULL CHECK (status IN
        ('queued','sending','sent','delivered','read','failed','cancelled','suppressed')),
      available_at timestamptz NOT NULL DEFAULT now(),
      attempt_count integer NOT NULL DEFAULT 0,
      lease_owner text,
      lease_expires_at timestamptz,
      meta_message_id text UNIQUE,
      last_error_code text,
      last_error_message text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS messages_claim_idx
      ON messages (status, available_at, created_at)
      WHERE status = 'queued';

    CREATE INDEX IF NOT EXISTS messages_campaign_idx ON messages (campaign_id);
    CREATE INDEX IF NOT EXISTS messages_contact_idx ON messages (contact_id);
    CREATE INDEX IF NOT EXISTS messages_meta_id_idx ON messages (meta_message_id);

    CREATE TABLE IF NOT EXISTS message_status_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      status text NOT NULL,
      timestamp timestamptz NOT NULL,
      raw_payload jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS message_status_events_msg_idx ON message_status_events(message_id);
  `);
}

export async function down(client) {
  await client.query(`
    DROP TABLE IF EXISTS message_status_events CASCADE;
    DROP TABLE IF EXISTS messages CASCADE;
    DROP TABLE IF EXISTS campaigns CASCADE;
    DROP TABLE IF EXISTS meta_templates CASCADE;
  `);
}
