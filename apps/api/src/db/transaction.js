import { pool } from './pool.js';

/**
 * Execute a callback within a database transaction.
 * If client is passed, reuse that client without opening/closing another transaction block.
 *
 * @template T
 * @param {(client: import('pg').PoolClient) => Promise<T>} callback
 * @param {import('pg').PoolClient} [client]
 * @returns {Promise<T>}
 */
export async function withTransaction(callback, client = null) {
  const isExternalClient = !!client;
  const db = client || await pool.connect();

  try {
    if (!isExternalClient) {
      await db.query('BEGIN');
    }
    const result = await callback(db);
    if (!isExternalClient) {
      await db.query('COMMIT');
    }
    return result;
  } catch (error) {
    if (!isExternalClient) {
      await db.query('ROLLBACK');
    }
    throw error;
  } finally {
    if (!isExternalClient) {
      db.release();
    }
  }
}
