export async function up(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS contacts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      type text NOT NULL CHECK (type IN ('employee', 'public')),
      name text NOT NULL,
      phone_e164 text UNIQUE NOT NULL,
      status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'unsubscribed', 'invalid_number')),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS contacts_phone_idx ON contacts(phone_e164);
    CREATE INDEX IF NOT EXISTS contacts_type_idx ON contacts(type);
    CREATE INDEX IF NOT EXISTS contacts_status_idx ON contacts(status);

    CREATE TABLE IF NOT EXISTS employee_profiles (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      contact_id uuid UNIQUE NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
      nip text UNIQUE,
      unit_kerja text,
      jabatan text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS public_profiles (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      contact_id uuid UNIQUE NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
      instansi text,
      profesi text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS tags (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text UNIQUE NOT NULL,
      color text DEFAULT '#66706F',
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS contact_tags (
      contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
      tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (contact_id, tag_id)
    );

    CREATE TABLE IF NOT EXISTS topics (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      code text UNIQUE NOT NULL,
      title text NOT NULL,
      description text,
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
      topic_id uuid NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
      status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'unsubscribed')),
      channel text NOT NULL DEFAULT 'web',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (contact_id, topic_id)
    );

    CREATE TABLE IF NOT EXISTS consent_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
      event_type text NOT NULL CHECK (event_type IN ('subscribe', 'unsubscribe', 'opt_out', 're_subscribe')),
      channel text NOT NULL,
      proof text,
      ip_address text,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS suppression_entries (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      phone_e164 text UNIQUE NOT NULL,
      reason text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS suppression_phone_idx ON suppression_entries(phone_e164);
  `);
}

export async function down(client) {
  await client.query(`
    DROP TABLE IF EXISTS suppression_entries CASCADE;
    DROP TABLE IF EXISTS consent_events CASCADE;
    DROP TABLE IF EXISTS subscriptions CASCADE;
    DROP TABLE IF EXISTS topics CASCADE;
    DROP TABLE IF EXISTS contact_tags CASCADE;
    DROP TABLE IF EXISTS tags CASCADE;
    DROP TABLE IF EXISTS public_profiles CASCADE;
    DROP TABLE IF EXISTS employee_profiles CASCADE;
    DROP TABLE IF EXISTS contacts CASCADE;
  `);
}
