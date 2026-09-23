/**
 * Parses and normalizes inbound WhatsApp message text commands.
 *
 * Supported commands:
 * - DAFTAR / SUBSCRIBE [TOPIC_CODE] -> subscribe
 * - BERHENTI / STOP [TOPIC_CODE] -> unsubscribe
 * - BERHENTI SEMUA / STOP ALL -> unsubscribe_all
 * - BANTUAN / HELP / INFO -> help
 * - Free text -> unknown (diverts to official helpdesk channel)
 */
export async function parseInboundCommand(text) {
  if (!text || typeof text !== 'string') {
    return { kind: 'unknown', raw: '' };
  }

  const clean = text.trim().replace(/\s+/g, ' ');
  const upper = clean.toUpperCase();

  // 1. Check unsubscribe_all variants
  if (
    upper === 'BERHENTI SEMUA' ||
    upper === 'STOP ALL' ||
    upper === 'UNSUBSCRIBE ALL' ||
    upper === 'OPT OUT ALL' ||
    upper === 'OPTOUT ALL'
  ) {
    return { kind: 'unsubscribe_all', raw: text };
  }

  // 2. Check unsubscribe variants (with optional topic)
  if (upper === 'BERHENTI' || upper === 'STOP' || upper === 'UNSUBSCRIBE') {
    return { kind: 'unsubscribe', topicCode: null, raw: text };
  }

  if (
    upper.startsWith('BERHENTI ') ||
    upper.startsWith('STOP ') ||
    upper.startsWith('UNSUBSCRIBE ')
  ) {
    const parts = upper.split(' ');
    const remainder = parts.slice(1).join(' ').trim();
    if (remainder === 'SEMUA' || remainder === 'ALL') {
      return { kind: 'unsubscribe_all', raw: text };
    }
    return { kind: 'unsubscribe', topicCode: remainder.toLowerCase(), raw: text };
  }

  // 3. Check subscribe variants (with optional topic)
  if (upper === 'DAFTAR' || upper === 'SUBSCRIBE' || upper === 'GABUNG') {
    return { kind: 'subscribe', topicCode: null, raw: text };
  }

  if (
    upper.startsWith('DAFTAR ') ||
    upper.startsWith('SUBSCRIBE ') ||
    upper.startsWith('GABUNG ')
  ) {
    const parts = upper.split(' ');
    const remainder = parts.slice(1).join(' ').trim();
    return { kind: 'subscribe', topicCode: remainder.toLowerCase(), raw: text };
  }

  // 4. Check help variants
  if (
    upper === 'BANTUAN' ||
    upper === 'HELP' ||
    upper === 'INFO' ||
    upper === 'MENU' ||
    upper === 'PETUNJUK'
  ) {
    return { kind: 'help', raw: text };
  }

  // 5. Default: unknown free text
  return { kind: 'unknown', raw: text };
}
