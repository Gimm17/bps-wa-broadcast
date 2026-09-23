export async function up(client) {
  await client.query(`
    ALTER TABLE holiday_dates 
    ADD COLUMN IF NOT EXISTS is_workday boolean NOT NULL DEFAULT false;

    CREATE TABLE IF NOT EXISTS worker_heartbeats (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      worker_id text NOT NULL,
      started_at timestamptz NOT NULL,
      finished_at timestamptz,
      status text NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'timeout')),
      stats jsonb NOT NULL DEFAULT '{}'::jsonb,
      error text,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS worker_heartbeats_started_idx ON worker_heartbeats(started_at DESC);
  `);
}

export async function down(client) {
  await client.query(`
    DROP TABLE IF EXISTS worker_heartbeats CASCADE;
    ALTER TABLE holiday_dates DROP COLUMN IF EXISTS is_workday;
  `);
}
