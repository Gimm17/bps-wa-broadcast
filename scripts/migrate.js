import fs from 'node:fs';
import path from 'node:path';
import dns from 'node:dns';
import { fileURLToPath, pathToFileURL } from 'node:url';
import pg from 'pg';
import dotenv from 'dotenv';

try {
  dns.setDefaultResultOrder('ipv4first');
} catch (_) {}

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const migrationsDir = path.join(rootDir, 'db', 'migrations');
const seedsDir = path.join(rootDir, 'db', 'seeds');

const { Client } = pg;

export async function runMigrations({ connectionString = process.env.DATABASE_URL, withSeeds = true } = {}) {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    // If connectionString includes search_path with a custom schema, ensure that schema exists
    const url = new URL(connectionString);
    const searchPath = url.searchParams.get('search_path');
    if (searchPath) {
      const schemas = searchPath.split(',').map((s) => s.trim());
      for (const s of schemas) {
        if (s && s !== 'public') {
          await client.query(`CREATE SCHEMA IF NOT EXISTS "${s}";`);
        }
      }
      await client.query(`SET search_path TO ${searchPath};`);
    }

    // Ensure gen_random_uuid is available (supports PostgreSQL <= 12 and environments without superuser pgcrypto)
    await client.query(`
      DO $$
      BEGIN
        BEGIN
          CREATE EXTENSION IF NOT EXISTS pgcrypto;
        EXCEPTION WHEN OTHERS THEN
          NULL;
        END;

        IF NOT EXISTS (
          SELECT 1 FROM pg_proc WHERE proname = 'gen_random_uuid'
        ) THEN
          EXECUTE '
            CREATE OR REPLACE FUNCTION gen_random_uuid() RETURNS uuid AS $gen$
            DECLARE
              m text := md5(random()::text || clock_timestamp()::text);
            BEGIN
              RETURN (
                substr(m, 1, 8) || ''-'' ||
                substr(m, 9, 4) || ''-4'' ||
                substr(m, 14, 3) || ''-'' ||
                ''a'' || substr(m, 18, 3) || ''-'' ||
                substr(m, 21, 12)
              )::uuid;
            END;
            $gen$ LANGUAGE plpgsql VOLATILE;
          ';
        END IF;
      END $$;
    `);

    // Create migration tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name text PRIMARY KEY,
        executed_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    // Get applied migrations
    const { rows: appliedRows } = await client.query('SELECT name FROM schema_migrations');
    const applied = new Set(appliedRows.map((r) => r.name));

    // Get migration files
    const files = fs.readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.js'))
      .sort();

    for (const file of files) {
      if (applied.has(file)) continue;

      console.log(`Applying migration: ${file}...`);
      const filePath = path.join(migrationsDir, file);
      const migration = await import(pathToFileURL(filePath).href);

      await client.query('BEGIN');
      try {
        await migration.up(client);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`Applied migration: ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`Migration ${file} failed:`, err);
        throw err;
      }
    }

    if (withSeeds && fs.existsSync(seedsDir)) {
      const seedFiles = fs.readdirSync(seedsDir).filter((f) => f.endsWith('.js')).sort();
      for (const file of seedFiles) {
        console.log(`Running seed: ${file}...`);
        const filePath = path.join(seedsDir, file);
        const seedModule = await import(pathToFileURL(filePath).href);
        await client.query('BEGIN');
        try {
          await seedModule.seed(client);
          await client.query('COMMIT');
          console.log(`Seed completed: ${file}`);
        } catch (err) {
          await client.query('ROLLBACK');
          console.error(`Seed ${file} failed:`, err);
          throw err;
        }
      }
    }

    console.log('All migrations and seeds applied successfully.');
  } finally {
    await client.end();
  }
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
