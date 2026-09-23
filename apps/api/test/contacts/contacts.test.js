import { describe, expect, it } from 'vitest';
import {
  normalizeIndonesianPhone,
  maskPhoneNumber,
  safeSpreadsheetCell
} from '@bps/shared';

describe('Phone Normalization & Safe Export', () => {
  it('normalizes valid Indonesian phone numbers to E.164', () => {
    expect(normalizeIndonesianPhone('0812 3456 7890')).toBe('+6281234567890');
    expect(normalizeIndonesianPhone('0812-3456-7890')).toBe('+6281234567890');
    expect(normalizeIndonesianPhone('+62 812 3456 7890')).toBe('+6281234567890');
    expect(normalizeIndonesianPhone('6281234567890')).toBe('+6281234567890');
    expect(normalizeIndonesianPhone('085241001234')).toBe('+6285241001234');
  });

  it('rejects invalid or impossible phone numbers', () => {
    expect(() => normalizeIndonesianPhone('123')).toThrow('Nomor WhatsApp tidak valid');
    expect(() => normalizeIndonesianPhone('0211234567')).toThrow('Nomor WhatsApp tidak valid');
    expect(() => normalizeIndonesianPhone('080000000000000000')).toThrow('Nomor WhatsApp tidak valid');
    expect(() => normalizeIndonesianPhone('')).toThrow('Nomor WhatsApp tidak valid');
  });

  it('masks phone numbers according to sensitive read permission', () => {
    expect(maskPhoneNumber('+6281234567890', false)).toBe('+62••••••7890');
    expect(maskPhoneNumber('+6281234567890', true)).toBe('+6281234567890');
  });

  it('escapes spreadsheet formulas on export to neutralize injection', () => {
    expect(safeSpreadsheetCell('=HYPERLINK("bad")')).toBe("'=HYPERLINK(\"bad\")");
    expect(safeSpreadsheetCell('+12345')).toBe("'+12345");
    expect(safeSpreadsheetCell('-SUM(A1:A10)')).toBe("'-SUM(A1:A10)");
    expect(safeSpreadsheetCell('@cmd')).toBe("'@cmd");
    expect(safeSpreadsheetCell('Normal Name')).toBe('Normal Name');
  });
});
