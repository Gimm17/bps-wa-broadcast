import { pool } from '../../db/pool.js';
import { encryptSecret, decryptSecret, maskSecret } from './crypto.js';

export class IntegrationRepository {
  constructor(dbPool = pool) {
    this.pool = dbPool;
  }

  async getIntegration(type, client = this.pool) {
    const res = await client.query(`
      SELECT * FROM integrations WHERE type = $1
    `, [type]);
    return res.rows[0] || null;
  }

  async getDecryptedCredentials(type, client = this.pool) {
    const integration = await this.getIntegration(type, client);
    if (!integration || !integration.encrypted_credentials) return null;

    const creds = typeof integration.encrypted_credentials === 'string'
      ? JSON.parse(integration.encrypted_credentials)
      : integration.encrypted_credentials;

    const decrypted = {};
    for (const [key, val] of Object.entries(creds)) {
      if (typeof val === 'string' && val.includes(':')) {
        try {
          decrypted[key] = decryptSecret(val);
        } catch {
          decrypted[key] = val;
        }
      } else {
        decrypted[key] = val;
      }
    }

    return decrypted;
  }

  async saveIntegration({ type, name, credentials = {}, status = 'connected', client = this.pool }) {
    const encryptedCreds = {};
    for (const [key, val] of Object.entries(credentials)) {
      if (typeof val === 'string' && val.length > 0) {
        encryptedCreds[key] = encryptSecret(val);
      } else {
        encryptedCreds[key] = val;
      }
    }

    const res = await client.query(`
      INSERT INTO integrations (type, name, status, encrypted_credentials, updated_at)
      VALUES ($1, $2, $3, $4, now())
      ON CONFLICT (type)
      DO UPDATE SET
        name = EXCLUDED.name,
        status = EXCLUDED.status,
        encrypted_credentials = EXCLUDED.encrypted_credentials,
        last_error = NULL,
        updated_at = now()
      RETURNING *
    `, [type, name, status, JSON.stringify(encryptedCreds)]);

    return res.rows[0];
  }

  async updateStatus({ type, status, lastError = null, client = this.pool }) {
    const res = await client.query(`
      UPDATE integrations
      SET status = $2,
          last_error = $3,
          last_sync_at = CASE WHEN $2 = 'connected' THEN now() ELSE last_sync_at END,
          updated_at = now()
      WHERE type = $1
      RETURNING *
    `, [type, status, lastError]);
    return res.rows[0] || null;
  }

  async recordRun({ integrationId, status, summary = {}, client = this.pool }) {
    const res = await client.query(`
      INSERT INTO integration_runs (integration_id, status, summary)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [integrationId, status, JSON.stringify(summary)]);
    return res.rows[0];
  }

  async listAllForUi(client = this.pool) {
    const res = await client.query(`
      SELECT i.*, 
             ir.status as last_run_status, ir.summary as last_run_summary, ir.created_at as last_run_at
      FROM integrations i
      LEFT JOIN LATERAL (
        SELECT status, summary, created_at
        FROM integration_runs
        WHERE integration_id = i.id
        ORDER BY created_at DESC
        LIMIT 1
      ) ir ON true
      ORDER BY i.name ASC
    `);

    return res.rows.map(row => {
      const creds = typeof row.encrypted_credentials === 'string'
        ? JSON.parse(row.encrypted_credentials)
        : (row.encrypted_credentials || {});

      // Decrypt credentials
      const decrypted = {};
      for (const [key, val] of Object.entries(creds)) {
        if (typeof val === 'string' && val.includes(':')) {
          try {
            decrypted[key] = decryptSecret(val);
          } catch {
            decrypted[key] = val;
          }
        } else {
          decrypted[key] = val;
        }
      }

      // Fields that are public/operational and must NOT be masked:
      // sender: phone number (e.g. 6287786686392)
      // baseUrl: gateway endpoint URL
      // wabaId, phoneNumberId: public identifiers
      // provider: 'mpwa' | 'meta_cloud'
      const unmaskedFields = new Set(['sender', 'baseUrl', 'wabaId', 'phoneNumberId', 'provider', 'webhookVerifyToken']);

      const uiCreds = {};
      for (const [k, v] of Object.entries(decrypted)) {
        if (unmaskedFields.has(k)) {
          uiCreds[k] = v;
        } else {
          // Keep API keys and secrets as decrypted so the edit form can pre-fill
          // (the frontend uses type="password" to hide them securely)
          uiCreds[k] = v;
        }
      }

      return {
        id: row.id,
        type: row.type,
        name: row.name,
        status: row.status,
        last_sync_at: row.last_sync_at,
        last_error: row.last_error,
        credentials: uiCreds,
        last_run: row.last_run_status ? {
          status: row.last_run_status,
          summary: row.last_run_summary,
          at: row.last_run_at
        } : null
      };
    });
  }
}

export const integrationRepository = new IntegrationRepository();
