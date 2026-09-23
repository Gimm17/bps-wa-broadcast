import { parse } from 'csv-parse/sync';
import { normalizeIndonesianPhone } from '@bps/shared';

export async function parseCsvContacts(content) {
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  const rows = [];
  let accepted = 0;
  let warning = 0;
  let rejected = 0;

  for (let i = 0; i < records.length; i++) {
    const raw = records[i];
    const rowNumber = i + 1;
    const errors = [];

    // Helper to find key case-insensitively
    const findField = (...names) => {
      for (const name of names) {
        const key = Object.keys(raw).find((k) => k.trim().toLowerCase() === name.toLowerCase());
        if (key && raw[key] !== undefined) return raw[key].trim();
      }
      return '';
    };

    const name = findField('nama', 'name', 'nama lengkap');
    const rawPhone = findField('nomor whatsapp', 'nomor wa', 'whatsapp', 'phone', 'nomor', 'no hp', 'telepon');
    const rawType = findField('tipe', 'type', 'kategori');
    const nip = findField('nip', 'nip baru', 'id pegawai');
    const unitKerja = findField('unit kerja', 'unit_kerja', 'satuan kerja', 'bagian');
    const jabatan = findField('jabatan', 'posisi');
    const instansi = findField('instansi', 'lembaga', 'perusahaan');
    const profesi = findField('profesi', 'pekerjaan');

    if (!name) {
      errors.push('Nama wajib diisi');
    }

    let phoneE164 = null;
    if (!rawPhone) {
      errors.push('Nomor WhatsApp wajib diisi');
    } else {
      try {
        phoneE164 = normalizeIndonesianPhone(rawPhone);
      } catch (err) {
        errors.push(err.message);
      }
    }

    let type = 'public';
    const lowerType = rawType.toLowerCase();
    if (lowerType === 'pegawai' || lowerType === 'employee' || lowerType === 'asn' || nip) {
      type = 'employee';
    }

    const validationStatus = errors.length > 0 ? 'rejected' : 'valid';
    if (validationStatus === 'valid') {
      accepted++;
    } else {
      rejected++;
    }

    rows.push({
      rowNumber,
      rawData: raw,
      parsedData: {
        name,
        phoneE164,
        type,
        nip: nip || null,
        unitKerja: unitKerja || null,
        jabatan: jabatan || null,
        instansi: instansi || null,
        profesi: profesi || null
      },
      validationStatus,
      errors
    });
  }

  return {
    rows,
    summary: {
      total: records.length,
      accepted,
      warning,
      rejected
    }
  };
}
