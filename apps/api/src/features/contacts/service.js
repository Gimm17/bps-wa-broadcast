import {
  contactSchema,
  contactFilterSchema,
  maskPhoneNumber,
  safeSpreadsheetCell,
  PERMISSIONS
} from '@bps/shared';
import * as contactRepo from './repository.js';
import { recordAudit } from '../audit/service.js';

export async function getContacts({ query, user }) {
  const parsedFilter = contactFilterSchema.parse(query || {});
  const canViewSensitive = user?.permissions?.includes(PERMISSIONS.CONTACT_SENSITIVE_READ) || false;

  const result = await contactRepo.listContacts(parsedFilter);

  const sanitized = result.contacts.map((c) => ({
    ...c,
    phone_e164: maskPhoneNumber(c.phone_e164, canViewSensitive)
  }));

  return {
    ...result,
    contacts: sanitized
  };
}

export async function getContactById(id, user) {
  const contact = await contactRepo.findContactById(id);
  if (!contact) return null;

  const canViewSensitive = user?.permissions?.includes(PERMISSIONS.CONTACT_SENSITIVE_READ) || false;
  return {
    ...contact,
    phone_e164: maskPhoneNumber(contact.phone_e164, canViewSensitive)
  };
}

export async function saveContact(data, user) {
  const validated = contactSchema.parse(data);

  const contact = await contactRepo.upsertContact({
    type: validated.type,
    name: validated.name,
    phoneE164: validated.phone,
    status: validated.status,
    nip: validated.nip,
    unitKerja: validated.unitKerja,
    jabatan: validated.jabatan,
    instansi: validated.instansi,
    profesi: validated.profesi
  });

  await recordAudit({
    userId: user.id,
    action: 'contact.upsert',
    resourceType: 'contact',
    resourceId: contact.id,
    details: { type: contact.type, status: contact.status }
  });

  return contact;
}

export async function exportContactsCsv({ query, user }) {
  if (!user?.permissions?.includes(PERMISSIONS.CONTACT_EXPORT)) {
    throw { status: 403, code: 'FORBIDDEN', message: 'Anda tidak memiliki izin untuk mengekspor data kontak' };
  }

  const parsedFilter = contactFilterSchema.parse({ ...(query || {}), limit: 10000, page: 1 });
  const canViewSensitive = user?.permissions?.includes(PERMISSIONS.CONTACT_SENSITIVE_READ) || false;

  const result = await contactRepo.listContacts(parsedFilter);

  const header = ['ID', 'Nama', 'Nomor WhatsApp', 'Tipe', 'NIP', 'Unit Kerja / Instansi', 'Status'];
  const rows = [header.join(',')];

  for (const c of result.contacts) {
    const phone = canViewSensitive ? c.phone_e164 : maskPhoneNumber(c.phone_e164, false);
    const org = c.type === 'employee' ? c.unit_kerja : c.instansi;

    const row = [
      safeSpreadsheetCell(c.id),
      safeSpreadsheetCell(c.name),
      safeSpreadsheetCell(phone),
      safeSpreadsheetCell(c.type === 'employee' ? 'Pegawai' : 'Masyarakat'),
      safeSpreadsheetCell(c.nip || ''),
      safeSpreadsheetCell(org || ''),
      safeSpreadsheetCell(c.status)
    ];

    rows.push(row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','));
  }

  // Audit export
  await recordAudit({
    userId: user.id,
    action: 'contact.export',
    resourceType: 'contacts',
    details: { count: result.contacts.length, sensitiveRevealed: canViewSensitive, filter: parsedFilter }
  });

  return rows.join('\r\n');
}
