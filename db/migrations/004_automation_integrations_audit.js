export async function up(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS automation_rules (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      code text UNIQUE NOT NULL,
      name text NOT NULL,
      type text NOT NULL CHECK (type IN ('attendance_presensi', 'publication_reminder', 'silastik_transaction', 'custom', 'event_reminder')),
      template_id uuid REFERENCES meta_templates(id),
      is_active boolean NOT NULL DEFAULT true,
      config jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS trigger_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      source text NOT NULL,
      event_type text NOT NULL,
      external_id text,
      payload jsonb NOT NULL,
      status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'ignored', 'failed')),
      idempotency_key text UNIQUE,
      created_at timestamptz NOT NULL DEFAULT now(),
      processed_at timestamptz
    );
    CREATE INDEX IF NOT EXISTS trigger_events_status_idx ON trigger_events(status);

    CREATE TABLE IF NOT EXISTS schedules (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      campaign_id uuid REFERENCES campaigns(id) ON DELETE CASCADE,
      automation_rule_id uuid REFERENCES automation_rules(id) ON DELETE CASCADE,
      cron_expression text,
      target_time time,
      days_of_week integer[],
      is_active boolean NOT NULL DEFAULT true,
      last_run_at timestamptz,
      next_run_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS holiday_dates (
      date date PRIMARY KEY,
      description text NOT NULL,
      is_national boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS integrations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      type text UNIQUE NOT NULL CHECK (type IN ('meta_waba', 'attendance_api', 'silastik_api', 'publication_api')),
      name text NOT NULL,
      status text NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'error')),
      encrypted_credentials jsonb,
      last_sync_at timestamptz,
      last_error text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS integration_runs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      integration_id uuid NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
      status text NOT NULL CHECK (status IN ('success', 'warning', 'failed')),
      summary jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS import_jobs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      type text NOT NULL CHECK (type IN ('contacts_pegawai', 'contacts_masyarakat', 'holidays', 'publications')),
      filename text NOT NULL,
      file_checksum text NOT NULL,
      total_rows integer NOT NULL DEFAULT 0,
      accepted_rows integer NOT NULL DEFAULT 0,
      warning_rows integer NOT NULL DEFAULT 0,
      rejected_rows integer NOT NULL DEFAULT 0,
      status text NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'previewed', 'applied', 'failed')),
      created_by uuid REFERENCES users(id),
      created_at timestamptz NOT NULL DEFAULT now(),
      applied_at timestamptz
    );

    CREATE TABLE IF NOT EXISTS import_rows (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      job_id uuid NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
      row_number integer NOT NULL,
      raw_data jsonb NOT NULL,
      parsed_data jsonb,
      validation_status text NOT NULL CHECK (validation_status IN ('valid', 'warning', 'rejected')),
      errors jsonb,
      is_applied boolean NOT NULL DEFAULT false
    );
    CREATE INDEX IF NOT EXISTS import_rows_job_idx ON import_rows(job_id);

    CREATE TABLE IF NOT EXISTS webhook_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      source text NOT NULL,
      event_id text UNIQUE,
      event_type text NOT NULL,
      payload jsonb NOT NULL,
      status text NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'processed', 'ignored', 'failed')),
      received_at timestamptz NOT NULL DEFAULT now(),
      processed_at timestamptz
    );
    CREATE INDEX IF NOT EXISTS webhook_events_event_id_idx ON webhook_events(event_id);

    CREATE TABLE IF NOT EXISTS audit_logs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES users(id) ON DELETE SET NULL,
      action text NOT NULL,
      resource_type text NOT NULL,
      resource_id text,
      details jsonb,
      ip_address text,
      user_agent text,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs(created_at DESC);

    CREATE TABLE IF NOT EXISTS system_alerts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      severity text NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'critical')),
      code text NOT NULL,
      title text NOT NULL,
      message text NOT NULL,
      is_resolved boolean NOT NULL DEFAULT false,
      resolved_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key text PRIMARY KEY,
      value jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
}

export async function down(client) {
  await client.query(`
    DROP TABLE IF EXISTS app_settings CASCADE;
    DROP TABLE IF EXISTS system_alerts CASCADE;
    DROP TABLE IF EXISTS audit_logs CASCADE;
    DROP TABLE IF EXISTS webhook_events CASCADE;
    DROP TABLE IF EXISTS import_rows CASCADE;
    DROP TABLE IF EXISTS import_jobs CASCADE;
    DROP TABLE IF EXISTS integration_runs CASCADE;
    DROP TABLE IF EXISTS integrations CASCADE;
    DROP TABLE IF EXISTS holiday_dates CASCADE;
    DROP TABLE IF EXISTS schedules CASCADE;
    DROP TABLE IF EXISTS trigger_events CASCADE;
    DROP TABLE IF EXISTS automation_rules CASCADE;
  `);
}
