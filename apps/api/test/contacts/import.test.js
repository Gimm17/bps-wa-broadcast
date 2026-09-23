import { describe, expect, it } from 'vitest';
import { parseCsvContacts } from '../../src/features/imports/parsers/csv.js';

describe('Staged Contact Import Parsing', () => {
  it('parses CSV rows, validates phone numbers, and flags invalid records', async () => {
    const csvContent = `Nama,Nomor WhatsApp,Tipe,NIP,Unit Kerja
Budi Santoso,081234567890,Pegawai,198501012010011001,Statistik Distribusi
Siti Rahma,085241001234,Masyarakat,,Dinas Perdagangan
Orang Salah,12345,Pegawai,19900101,Umum
Tanpa Nomor,,Pegawai,,
`;

    const result = await parseCsvContacts(csvContent);

    expect(result.rows).toHaveLength(4);
    expect(result.summary.total).toBe(4);
    expect(result.summary.accepted).toBe(2);
    expect(result.summary.rejected).toBe(2);

    // Row 1: Valid employee
    expect(result.rows[0].validationStatus).toBe('valid');
    expect(result.rows[0].parsedData.phoneE164).toBe('+6281234567890');
    expect(result.rows[0].parsedData.type).toBe('employee');

    // Row 2: Valid public
    expect(result.rows[1].validationStatus).toBe('valid');
    expect(result.rows[1].parsedData.phoneE164).toBe('+6285241001234');
    expect(result.rows[1].parsedData.type).toBe('public');

    // Row 3: Invalid phone
    expect(result.rows[2].validationStatus).toBe('rejected');
    expect(result.rows[2].errors).toContain('Nomor WhatsApp tidak valid');

    // Row 4: Missing phone
    expect(result.rows[3].validationStatus).toBe('rejected');
  });
});
