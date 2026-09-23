import { describe, expect, it } from 'vitest';
import { parseInboundCommand } from '../../src/features/subscriptions/commands.js';

describe('Inbound Command Normalization', () => {
  it.each(['BERHENTI', 'berhenti semua', '  Daftar  ', 'BANTUAN', 'help'])('normalizes command %s', async (text) => {
    const cmd = await parseInboundCommand(text);
    expect(cmd.kind).toBeTruthy();
    expect(['subscribe', 'unsubscribe', 'unsubscribe_all', 'help']).toContain(cmd.kind);
  });

  it('recognizes BERHENTI SEMUA variants', async () => {
    expect((await parseInboundCommand('berhenti semua')).kind).toBe('unsubscribe_all');
    expect((await parseInboundCommand('BERHENTI   SEMUA')).kind).toBe('unsubscribe_all');
    expect((await parseInboundCommand('STOP ALL')).kind).toBe('unsubscribe_all');
  });

  it('classifies unhandled free text as unknown', async () => {
    const res = await parseInboundCommand('Selamat pagi saya mau tanya data kemiskinan');
    expect(res.kind).toBe('unknown');
  });
});
