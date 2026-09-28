/**
 * MPWA Client — Adapter untuk provider WhatsApp Gateway MPWA
 * (wa-admin.novamedia.my.id oleh Nova Media — Mitra Resmi Meta WABA)
 *
 * API Reference: https://www.wa-admin.novamedia.my.id/en/api-docs
 *
 * Endpoint:
 *   POST /send-message  → kirim pesan teks/template ke nomor tujuan
 *   POST /check-number  → cek apakah nomor terdaftar di WhatsApp
 *
 * Request body: { api_key, sender, number, message }
 * Response: { status: true|false, msg: "..." }
 */
export class MpwaClient {
  constructor({
    apiKey,
    sender,
    baseUrl = 'https://www.wa-admin.novamedia.my.id',
    timeoutMs = 15000
  }) {
    if (!apiKey) throw new Error('MPWA_API_KEY wajib diisi');
    if (!sender) throw new Error('MPWA_SENDER wajib diisi — nomor pengirim terdaftar di panel MPWA');

    this.apiKey = apiKey;
    this.sender = sender.replace(/^\+/, ''); // strip leading +
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.timeoutMs = timeoutMs;
  }

  /**
   * Kirim pesan teks ke satu nomor penerima.
   * Untuk kampanye broadcast, pesan sudah dirender oleh renderer.js sebelum dipanggil ke sini.
   *
   * @param {object} opts
   * @param {string} opts.to     - nomor penerima (format E.164, e.g. +628...)
   * @param {string} opts.text   - teks pesan yang sudah dirender
   * @param {string} [opts.footer] - teks footer di bawah pesan (default: BPS Provinsi Sulawesi Tengah)
   * @returns {{ mpwaMessageId: string, metaMessageId: string, messageId: string, status: true, raw: object }}
   */
  async sendText({ to, text, footer }) {
    const number = to.replace(/^\+/, '');

    const payload = {
      api_key: this.apiKey,
      sender: this.sender,
      number,
      message: text,
      full: 1
    };

    if (footer && footer.trim()) {
      payload.footer = footer.trim();
    }

    const res = await this._fetchWithTimeout(`${this.baseUrl}/send-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await this._handleResponse(res);
    const messageId =
      data.data?.id ||
      data.key?.id ||
      (typeof data.msg === 'object' && data.msg?.id ? data.msg.id : null) ||
      `mpwa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    return {
      mpwaMessageId: messageId,
      metaMessageId: messageId,
      messageId,
      status: true,
      raw: data
    };
  }

  /**
   * Cek apakah nomor terdaftar di WhatsApp.
   * Berguna untuk validasi kontak sebelum broadcast dan ping status perangkat sender.
   *
   * @param {string} number - nomor E.164
   * @returns {{ exists: boolean, jid: string|null, raw: object }}
   */
  async checkNumber(number) {
    const clean = number.replace(/^\+/, '');

    const res = await this._fetchWithTimeout(`${this.baseUrl}/check-number`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: this.apiKey,
        sender: this.sender,
        number: clean
      })
    });

    const data = await this._handleResponse(res);
    const info = typeof data.msg === 'object' ? data.msg : {};

    return {
      exists: Boolean(info.exists),
      jid: info.jid || null,
      raw: data
    };
  }

  /**
   * Mengembalikan daftar template pesan operasional standar BPS Sulteng.
   * Gateway MPWA merender template teks secara dinamis di server lokal.
   */
  async fetchTemplates() {
    return [
      {
        name: 'brs_rilis_bulanan',
        language: 'id',
        category: 'UTILITY',
        status: 'APPROVED',
        components: [
          {
            type: 'HEADER',
            format: 'TEXT',
            text: 'Berita Resmi Statistik BPS Sulteng'
          },
          {
            type: 'BODY',
            text: 'Halo {{1}}, rilis data {{2}} telah terbit. Indikator utama mencatat {{3}}. Kunjungi {{4}} untuk informasi selengkapnya.'
          },
          {
            type: 'FOOTER',
            text: 'BPS Provinsi Sulawesi Tengah • Ketik BERHENTI untuk berhenti berlangganan'
          }
        ]
      },
      {
        name: 'pengingat_presensi_pegawai',
        language: 'id',
        category: 'UTILITY',
        status: 'APPROVED',
        components: [
          {
            type: 'BODY',
            text: 'Yth. {{1}}, Anda tercatat belum melakukan presensi masuk hari ini {{2}} WITA. Segera lakukan presensi pada portal internal SIMPEG Sulteng.'
          },
          {
            type: 'FOOTER',
            text: 'Bagian Umum BPS Provinsi Sulawesi Tengah'
          }
        ]
      },
      {
        name: 'silastik_layanan_update',
        language: 'id',
        category: 'UTILITY',
        status: 'APPROVED',
        components: [
          {
            type: 'BODY',
            text: 'Yth. Pemohon Data {{1}}, status permohonan layanan PST Silastik Anda #{{2}} telah diperbarui menjadi: {{3}}. Silakan cek portal PST BPS Sulteng.'
          }
        ]
      }
    ];
  }

  /**
   * Backward-compatible alias agar sender.js bisa panggil mpwaClient.sendTemplate()
   * untuk kampanye yang payload-nya berisi teks yang sudah dirender.
   */
  async sendTemplate({ to, renderedText, templateName, components, footer }) {
    // renderedText didahulukan; fallback ke nama template jika belum ada renderer
    const text = renderedText || `[${templateName}]`;
    const footerText = footer || (Array.isArray(components) ? components.find(c => c.type === 'FOOTER')?.text : null);
    return this.sendText({ to, text, footer: footerText });
  }

  async _fetchWithTimeout(url, options) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error(`MPWA API timeout (${this.timeoutMs}ms) — periksa koneksi ke wa-admin.novamedia.my.id`);
      }
      throw new Error(`Gagal menghubungi MPWA API: ${err.message}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  async _handleResponse(res) {
    let body;
    try {
      body = await res.json();
    } catch {
      throw new Error(`MPWA API mengembalikan status ${res.status} tanpa format JSON`);
    }

    if (!res.ok) {
      const msg = body?.message || body?.msg || `MPWA API Error ${res.status}`;
      const err = new Error(this._sanitize(String(msg)));
      err.status = res.status;
      err.code = 'MPWA_API_ERROR';
      throw err;
    }

    if (body.status === false) {
      const msg = body.msg || 'MPWA API mengembalikan status false';
      const err = new Error(this._sanitize(String(msg)));
      err.status = 422;
      err.code = 'MPWA_SEND_FAILED';
      throw err;
    }

    return body;
  }

  _sanitize(text) {
    if (!text || typeof text !== 'string') return text;
    return text.replaceAll(this.apiKey, '****APIKEY_REDACTED****');
  }
}

/**
 * MetaClient — Adaptive client yang otomatis mendukung kredensial MPWA Gateway
 * maupun Meta Cloud API langsung (untuk backward compatibility).
 */
export class MetaClient {
  constructor(opts = {}) {
    // Jika kredensial MPWA diberikan
    if (opts.apiKey || opts.sender || (!opts.accessToken && opts.baseUrl)) {
      return new MpwaClient(opts);
    }

    // Direct Meta Graph API mode
    this.wabaId = opts.wabaId;
    this.phoneNumberId = opts.phoneNumberId;
    this.accessToken = opts.accessToken;
    this.apiVersion = opts.apiVersion || 'v21.0';
    this.timeoutMs = opts.timeoutMs || 10000;
    this.baseUrl = `https://graph.facebook.com/${this.apiVersion}`;
  }

  async fetchTemplates() {
    if (!this.wabaId) throw new Error('WABA ID belum dikonfigurasi');
    const url = `${this.baseUrl}/${this.wabaId}/message_templates?limit=100`;
    const res = await this._fetchWithTimeout(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    const data = await this._handleResponse(res);
    return data.data || [];
  }

  async sendTemplate({ to, templateName, languageCode = 'id', components = [], renderedText = null }) {
    if (!this.phoneNumberId) throw new Error('Phone Number ID belum dikonfigurasi');
    const url = `${this.baseUrl}/${this.phoneNumberId}/messages`;
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to.replace('+', ''),
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        components
      }
    };
    const res = await this._fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const data = await this._handleResponse(res);
    const metaMessageId = data.messages?.[0]?.id || null;
    return {
      metaMessageId,
      mpwaMessageId: metaMessageId,
      messageId: metaMessageId,
      status: true,
      raw: data
    };
  }

  async checkNumber(number) {
    return { exists: true, jid: `${number.replace(/^\+/, '')}@s.whatsapp.net` };
  }

  async _fetchWithTimeout(url, options) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  }

  async _handleResponse(res) {
    let body;
    try { body = await res.json(); } catch {
      throw new Error(`Meta API mengembalikan status ${res.status} tanpa format JSON`);
    }
    if (!res.ok) {
      const err = body.error || {};
      const message = err.message || `Meta API Error (${res.status})`;
      const cleanMessage = this._sanitize(message);
      const customErr = new Error(cleanMessage);
      customErr.status = res.status;
      customErr.code = err.code || 'META_API_ERROR';
      throw customErr;
    }
    return body;
  }

  _sanitize(text) {
    if (!text || typeof text !== 'string') return text;
    if (this.accessToken) return text.replaceAll(this.accessToken, '****TOKEN_REDACTED****');
    return text;
  }
}
