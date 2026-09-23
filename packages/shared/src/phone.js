/**
 * Normalizes an Indonesian phone number to E.164 format (+628...).
 * Accepts 08..., 628..., +628... with spaces or hyphens.
 * Throws an Error with message 'Nomor WhatsApp tidak valid' if invalid.
 *
 * @param {string} value
 * @returns {string} E.164 phone number
 */
export function normalizeIndonesianPhone(value) {
  if (!value || typeof value !== 'string') {
    throw new Error('Nomor WhatsApp tidak valid');
  }

  let cleaned = value.trim().replace(/[\s\-\(\)\.]+/g, '');

  if (cleaned.startsWith('08')) {
    cleaned = '+62' + cleaned.slice(1);
  } else if (cleaned.startsWith('628')) {
    cleaned = '+' + cleaned;
  } else if (!cleaned.startsWith('+628')) {
    throw new Error('Nomor WhatsApp tidak valid');
  }

  // Indonesian mobile numbers: +628 followed by 8 to 12 digits
  // Total length 12 to 16 characters
  const indonesianMobileRegex = /^\+628[1-9][0-9]{7,11}$/;
  if (!indonesianMobileRegex.test(cleaned)) {
    throw new Error('Nomor WhatsApp tidak valid');
  }

  return cleaned;
}

/**
 * Masks an Indonesian phone number (+62••••••7890) unless authorized.
 *
 * @param {string} phone
 * @param {boolean} [canViewSensitive=false]
 * @returns {string}
 */
export function maskPhoneNumber(phone, canViewSensitive = false) {
  if (!phone || typeof phone !== 'string') return '';
  if (canViewSensitive) return phone;
  const last4 = phone.slice(-4);
  return `+62••••••${last4}`;
}

/**
 * Escapes formula injection characters (=, +, -, @) for CSV/Excel export.
 *
 * @param {any} value
 * @returns {string}
 */
export function safeSpreadsheetCell(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/^[=+\-@]/.test(str)) {
    return `'${str}`;
  }
  return str;
}
