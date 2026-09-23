import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { pool } from '../../src/db/pool.js';
import {
  toWitaDate,
  formatWitaTime,
  isWorkday,
  addHolidayException,
  removeHolidayException
} from '../../src/features/calendar/service.js';

describe('WITA Calendar & Workday Evaluation', () => {
  beforeAll(async () => {
    // Clean up test dates if any
    await pool.query(`
      DELETE FROM holiday_dates 
      WHERE date IN ('2026-10-05', '2026-10-06', '2026-10-10', '2026-10-11')
    `);
  });

  afterAll(async () => {
    await pool.query(`
      DELETE FROM holiday_dates 
      WHERE date IN ('2026-10-05', '2026-10-06', '2026-10-10', '2026-10-11')
    `);
  });

  it('treats 16:30 UTC as the next WITA calendar day', () => {
    // 16:30 UTC on Sep 30 is 00:30 WITA on Oct 1
    expect(toWitaDate('2026-09-30T16:30:00Z')).toBe('2026-10-01');
    expect(formatWitaTime('2026-09-30T16:30:00Z')).toBe('00:30');
  });

  it('identifies regular weekdays as workdays and weekends as non-workdays', async () => {
    // 2026-10-05 is Monday, 2026-10-10 is Saturday, 2026-10-11 is Sunday
    expect(await isWorkday('2026-10-05', pool)).toBe(true);
    expect(await isWorkday('2026-10-10', pool)).toBe(false);
    expect(await isWorkday('2026-10-11', pool)).toBe(false);
  });

  it('skips a national holiday even when Monday is normally active', async () => {
    await addHolidayException(pool, {
      date: '2026-10-05',
      description: 'Hari Libur Nasional Uji Coba',
      isNational: true,
      isWorkday: false
    });

    expect(await isWorkday('2026-10-05', pool)).toBe(false);
  });

  it('skips a local Sulteng exception even when Tuesday is normally active', async () => {
    await addHolidayException(pool, {
      date: '2026-10-06',
      description: 'Pengecualian Daerah HUT Sulteng',
      isNational: false,
      isWorkday: false
    });

    expect(await isWorkday('2026-10-06', pool)).toBe(false);
  });

  it('forces a weekend to be a workday when explicitly configured as a replacement workday', async () => {
    await addHolidayException(pool, {
      date: '2026-10-10',
      description: 'Hari Kerja Pengganti Cuti Bersama',
      isNational: false,
      isWorkday: true
    });

    expect(await isWorkday('2026-10-10', pool)).toBe(true);
  });

  it('allows removing an exception restoring normal weekly rules', async () => {
    await removeHolidayException(pool, '2026-10-05');
    expect(await isWorkday('2026-10-05', pool)).toBe(true);
  });
});
