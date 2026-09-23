export async function up(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS campaign_recipients (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
      status text NOT NULL DEFAULT 'eligible' CHECK (status IN ('eligible', 'suppressed', 'opted_out', 'invalid_number', 'excluded')),
      exclusion_reason text,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (campaign_id, contact_id)
    );
    CREATE INDEX IF NOT EXISTS campaign_recipients_campaign_idx ON campaign_recipients(campaign_id);
    CREATE INDEX IF NOT EXISTS campaign_recipients_contact_idx ON campaign_recipients(contact_id);
  `);
}

export async function down(client) {
  await client.query(`
    DROP TABLE IF EXISTS campaign_recipients CASCADE;
  `);
}
