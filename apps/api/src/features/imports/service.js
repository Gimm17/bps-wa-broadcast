import crypto from 'node:crypto';
import { pool } from '../../db/pool.js';
import { withTransaction } from '../../db/transaction.js';
import { parseCsvContacts } from './parsers/csv.js';
import { parseXlsxContacts } from './parsers/xlsx.js';
import * as contactRepo from '../contacts/repository.js';
import { recordAudit } from '../audit/service.js';

export async function createImportJob({ filename, buffer, user }) {
  const checksum = crypto.createHash('sha256').update(buffer).digest('hex');

  let parseResult;
  const isXlsx = filename.endsWith('.xlsx') || filename.endsWith('.xls');

  if (isXlsx) {
    parseResult = await parseXlsxContacts(buffer);
  } else {
    parseResult = await parseCsvContacts(buffer.toString('utf-8'));
  }

  const { rows, summary } = parseResult;

  return await withTransaction(async (db) => {
    const jobRes = await db.query(`
      INSERT INTO import_jobs (
        type, filename, file_checksum, total_rows, accepted_rows, warning_rows, rejected_rows, status, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'previewed', $8)
      RETURNING *
    `, [
      'contacts_pegawai',
      filename,
      checksum,
      summary.total,
      summary.accepted,
      summary.warning,
      summary.rejected,
      user.id
    ]);

    const job = jobRes.rows[0];

    for (const r of rows) {
      await db.query(`
        INSERT INTO import_rows (
          job_id, row_number, raw_data, parsed_data, validation_status, errors
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        job.id,
        r.rowNumber,
        JSON.stringify(r.rawData),
        JSON.stringify(r.parsedData),
        r.validationStatus,
        JSON.stringify(r.errors)
      ]);
    }

    await recordAudit({
      userId: user.id,
      action: 'import.staged',
      resourceType: 'import_job',
      resourceId: job.id,
      details: { filename, checksum, summary },
      client: db
    });

    return {
      job,
      summary,
      rows: rows.slice(0, 50) // Return preview of first 50 rows
    };
  });
}

export async function getImportJob(jobId) {
  const { rows: jobRows } = await pool.query('SELECT * FROM import_jobs WHERE id = $1', [jobId]);
  if (!jobRows[0]) return null;

  const { rows: rowRows } = await pool.query(
    'SELECT * FROM import_rows WHERE job_id = $1 ORDER BY row_number ASC',
    [jobId]
  );

  return {
    job: jobRows[0],
    rows: rowRows
  };
}

export async function applyImportJob(jobId, user) {
  return await withTransaction(async (db) => {
    const { rows: jobRows } = await db.query(
      'SELECT * FROM import_jobs WHERE id = $1 FOR UPDATE',
      [jobId]
    );

    const job = jobRows[0];
    if (!job) throw { status: 404, code: 'NOT_FOUND', message: 'Job impor tidak ditemukan' };
    if (job.status === 'applied') {
      throw { status: 400, code: 'ALREADY_APPLIED', message: 'Job impor ini sudah pernah diterapkan' };
    }

    const { rows: validRows } = await db.query(
      "SELECT * FROM import_rows WHERE job_id = $1 AND validation_status = 'valid' ORDER BY row_number ASC",
      [jobId]
    );

    let appliedCount = 0;
    for (const r of validRows) {
      const p = r.parsed_data;
      await contactRepo.upsertContact({
        type: p.type || 'public',
        name: p.name,
        phoneE164: p.phoneE164,
        nip: p.nip,
        unitKerja: p.unitKerja,
        jabatan: p.jabatan,
        instansi: p.instansi,
        profesi: p.profesi
      }, db);
      appliedCount++;
    }

    await db.query(
      "UPDATE import_rows SET is_applied = true WHERE job_id = $1 AND validation_status = 'valid'",
      [jobId]
    );

    await db.query(
      "UPDATE import_jobs SET status = 'applied', applied_at = now() WHERE id = $1",
      [jobId]
    );

    await recordAudit({
      userId: user.id,
      action: 'import.applied',
      resourceType: 'import_job',
      resourceId: jobId,
      details: { appliedCount },
      client: db
    });

    return {
      status: 'ok',
      appliedCount,
      totalValid: validRows.length
    };
  });
}
