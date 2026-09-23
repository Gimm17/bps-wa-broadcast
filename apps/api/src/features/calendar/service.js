import { DateTime } from 'luxon';
import { pool } from '../../db/pool.js';

export const WITA_ZONE = 'Asia/Makassar';

/**
 * Convert any date or ISO string to a WITA date string (YYYY-MM-DD).
 * Times at or after 16:00 UTC wrap into the next calendar day in WITA.
 */
export function toWitaDate(isoOrDate) {
  if (!isoOrDate) return null;
  const dt = typeof isoOrDate === 'string'
    ? DateTime.fromISO(isoOrDate, { zone: 'utc' }).setZone(WITA_ZONE)
    : DateTime.fromJSDate(isoOrDate).setZone(WITA_ZONE);
  return dt.toISODate();
}

/**
 * Format time in WITA (e.g. HH:mm).
 */
export function formatWitaTime(isoOrDate, format = 'HH:mm') {
  if (!isoOrDate) return '';
  const dt = typeof isoOrDate === 'string'
    ? DateTime.fromISO(isoOrDate, { zone: 'utc' }).setZone(WITA_ZONE)
    : DateTime.fromJSDate(isoOrDate).setZone(WITA_ZONE);
  return dt.toFormat(format);
}

/**
 * Get current Luxon DateTime in WITA.
 */
export function getWitaNow() {
  return DateTime.now().setZone(WITA_ZONE);
}

/**
 * Evaluates whether a given date is a workday according to WITA calendar rules:
 * Precedence:
 * 1. Forced workday exception (is_workday = true) -> true
 * 2. Local closure exception or national holiday/cuti bersama (is_workday = false) -> false
 * 3. Weekly rule: Monday-Friday -> true, Saturday-Sunday -> false
 */
export async function isWorkday(dateInput, db = pool) {
  let dateStr;
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    dateStr = dateInput;
  } else {
    dateStr = toWitaDate(dateInput);
  }

  // Check database holiday_dates
  const { rows } = await db.query(`
    SELECT date, description, is_national, is_workday 
    FROM holiday_dates 
    WHERE date = $1
  `, [dateStr]);

  if (rows.length > 0) {
    const entry = rows[0];
    // If explicitly marked as a workday (e.g. replacement Saturday), return true
    if (entry.is_workday) {
      return true;
    }
    // Otherwise it's a holiday / cuti bersama / local closure
    return false;
  }

  // Weekly rule fallback using Luxon
  const dt = DateTime.fromISO(dateStr, { zone: WITA_ZONE });
  // weekday: 1 is Monday, 5 is Friday, 6 is Saturday, 7 is Sunday
  return dt.weekday >= 1 && dt.weekday <= 5;
}

/**
 * List holidays and exceptions for a given year or range.
 */
export async function listHolidays(db = pool, { year, month } = {}) {
  let query = 'SELECT date::text, description, is_national, is_workday, created_at FROM holiday_dates';
  const params = [];

  if (year && month) {
    const startStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDt = DateTime.fromISO(startStr, { zone: WITA_ZONE }).endOf('month');
    params.push(startStr, endDt.toISODate());
    query += ' WHERE date >= $1 AND date <= $2 ORDER BY date ASC';
  } else if (year) {
    params.push(`${year}-01-01`, `${year}-12-31`);
    query += ' WHERE date >= $1 AND date <= $2 ORDER BY date ASC';
  } else {
    query += ' ORDER BY date ASC';
  }

  const { rows } = await db.query(query, params);
  return rows;
}

/**
 * Add or update a holiday / exception entry.
 */
export async function addHolidayException(db = pool, { date, description, isNational = false, isWorkday = false }) {
  const { rows } = await db.query(`
    INSERT INTO holiday_dates (date, description, is_national, is_workday)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (date) DO UPDATE SET
      description = EXCLUDED.description,
      is_national = EXCLUDED.is_national,
      is_workday = EXCLUDED.is_workday
    RETURNING date::text, description, is_national, is_workday
  `, [date, description, isNational, isWorkday]);

  return rows[0];
}

/**
 * Remove a holiday / exception entry.
 */
export async function removeHolidayException(db = pool, date) {
  const { rowCount } = await db.query(`
    DELETE FROM holiday_dates WHERE date = $1
  `, [date]);
  return rowCount > 0;
}
