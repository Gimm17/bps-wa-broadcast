export async function up(client) {
  await client.query(`
    ALTER TABLE automation_rules
    ADD COLUMN IF NOT EXISTS last_run_at timestamptz;
  `);
}

export async function down(client) {
  await client.query(`
    ALTER TABLE automation_rules
    DROP COLUMN IF EXISTS last_run_at;
  `);
}
