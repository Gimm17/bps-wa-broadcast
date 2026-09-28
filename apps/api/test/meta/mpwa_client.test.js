import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { MpwaClient, MetaClient } from '../../src/features/meta/client.js';

describe('MpwaClient & MetaClient Adapter', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('instantiates MpwaClient with required apiKey and sender', () => {
    const client = new MpwaClient({
      apiKey: 'test_api_key_123',
      sender: '+6287786686392',
      baseUrl: 'https://www.wa-admin.novamedia.my.id/'
    });

    expect(client.apiKey).toBe('test_api_key_123');
    expect(client.sender).toBe('6287786686392'); // stripped leading +
    expect(client.baseUrl).toBe('https://www.wa-admin.novamedia.my.id');
  });

  it('throws error when apiKey or sender is missing', () => {
    expect(() => new MpwaClient({ apiKey: '', sender: '628123' })).toThrow('MPWA_API_KEY wajib diisi');
    expect(() => new MpwaClient({ apiKey: 'key123', sender: '' })).toThrow('MPWA_SENDER wajib diisi');
  });

  it('sends text message via send-message endpoint with full payload', async () => {
    const client = new MpwaClient({
      apiKey: 'mock_key',
      sender: '6287786686392'
    });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: true,
        data: { id: 'wamid_mpwa_12345' },
        msg: 'Message sent successfully!'
      })
    });

    const res = await client.sendText({
      to: '+6281234567890',
      text: 'Halo Statistik BPS Sulteng',
      footer: 'BPS Provinsi Sulawesi Tengah'
    });

    expect(res.status).toBe(true);
    expect(res.mpwaMessageId).toBe('wamid_mpwa_12345');
    expect(res.metaMessageId).toBe('wamid_mpwa_12345');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://www.wa-admin.novamedia.my.id/send-message',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: 'mock_key',
          sender: '6287786686392',
          number: '6281234567890',
          message: 'Halo Statistik BPS Sulteng',
          full: 1,
          footer: 'BPS Provinsi Sulawesi Tengah'
        })
      })
    );
  });

  it('checks number existence via check-number endpoint', async () => {
    const client = new MpwaClient({
      apiKey: 'mock_key',
      sender: '6287786686392'
    });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: true,
        msg: {
          jid: '6287786686392@s.whatsapp.net',
          exists: true
        }
      })
    });

    const res = await client.checkNumber('+6287786686392');
    expect(res.exists).toBe(true);
    expect(res.jid).toBe('6287786686392@s.whatsapp.net');
  });

  it('throws MPWA_SEND_FAILED when gateway returns status: false', async () => {
    const client = new MpwaClient({
      apiKey: 'invalid_key',
      sender: '6287786686392'
    });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: false,
        msg: 'Kunci api atau pengirim tidak valid'
      })
    });

    await expect(client.sendText({ to: '628123', text: 'test' })).rejects.toThrow(
      'Kunci api atau pengirim tidak valid'
    );
  });

  it('redacts apiKey in error messages', () => {
    const client = new MpwaClient({
      apiKey: 'super_secret_api_key_xyz',
      sender: '6287786686392'
    });

    const sanitized = client._sanitize('Error connecting with super_secret_api_key_xyz to gateway');
    expect(sanitized).not.toContain('super_secret_api_key_xyz');
    expect(sanitized).toContain('****APIKEY_REDACTED****');
  });

  it('MetaClient automatically delegates to MpwaClient when MPWA options are provided', () => {
    const client = new MetaClient({
      apiKey: 'mpwa_key',
      sender: '6287786686392'
    });

    expect(client).toBeInstanceOf(MpwaClient);
  });
});
