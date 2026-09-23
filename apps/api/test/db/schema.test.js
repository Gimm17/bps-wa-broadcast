import { describe, expect, it } from 'vitest';
import { pool } from '../../src/db/pool.js';
import { ROLES, PERMISSIONS } from '@bps/shared';

describe('Database Schema & Seed Verification', () => {
  it('has all required tables in schema', async () => {
    const requiredTables = [
      'roles',
      'permissions',
      'role_permissions',
      'users',
      'user_roles',
      'sessions',
      'password_reset_tokens',
      'contacts',
      'employee_profiles',
      'public_profiles',
      'tags',
      'contact_tags',
      'topics',
      'subscriptions',
      'consent_events',
      'suppression_entries',
      'meta_templates',
      'campaigns',
      'messages',
      'message_status_events',
      'automation_rules',
      'trigger_events',
      'schedules',
      'holiday_dates',
      'integrations',
      'integration_runs',
      'import_jobs',
      'import_rows',
      'webhook_events',
      'audit_logs',
      'system_alerts',
      'app_settings'
    ];

    const { rows } = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = current_schema()
    `);
    const tableNames = rows.map((r) => r.table_name);

    for (const table of requiredTables) {
      expect(tableNames).toContain(table);
    }
  });

  it('has seeded roles and permissions', async () => {
    const { rows: roles } = await pool.query('SELECT code FROM roles');
    const roleCodes = roles.map((r) => r.code);

    expect(roleCodes).toContain(ROLES.SUPER_ADMIN);
    expect(roleCodes).toContain(ROLES.ADMIN_DISEMINASI);
    expect(roleCodes).toContain(ROLES.OPERATOR);
    expect(roleCodes).toContain(ROLES.VIEWER);

    const { rows: perms } = await pool.query('SELECT code FROM permissions');
    const permCodes = perms.map((p) => p.code);
    expect(permCodes).toContain(PERMISSIONS.CAMPAIGN_READ);
    expect(permCodes).toContain(PERMISSIONS.CAMPAIGN_SEND);
  });
});
