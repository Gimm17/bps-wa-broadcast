import ExcelJS from 'exceljs';
import { normalizeIndonesianPhone } from '@bps/shared';

export async function parseXlsxContacts(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('Spreadsheet tidak memiliki worksheet');
  }

  const headers = [];
  const rows = [];
  let accepted = 0;
  let warning = 0;
  let rejected = 0;

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      row.eachCell((cell, colNumber) => {
        headers[colNumber] = String(cell.value || '').trim();
      });
      return;
    }

    const raw = {};
    row.eachCell((cell, colNumber) => {
      const header = headers[colNumber];
      if (header) {
        raw[header] = cell.text !== undefined ? cell.text : String(cell.value || '');
      }
    });

    const findField = (...names) => {
      for (const name of names) {
        const key = Object.keys(raw).find((k) => k.trim().toLowerCase() === name.toLowerCase());
        if (key && raw[key] !== undefined) return String(raw[key]).trim();
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

    const errors = [];
    if (!name) errors.push('Nama wajib diisi');

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
  });

  return {
    rows,
    summary: {
      total: rows.length,
      accepted,
      warning,
      rejected
    }
  };
}
