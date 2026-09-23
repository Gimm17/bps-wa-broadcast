export class MetaClient {
  constructor({
    wabaId,
    phoneNumberId,
    accessToken,
    apiVersion = 'v21.0',
    timeoutMs = 10000
  }) {
    this.wabaId = wabaId;
    this.phoneNumberId = phoneNumberId;
    this.accessToken = accessToken;
    this.apiVersion = apiVersion;
    this.timeoutMs = timeoutMs;
    this.baseUrl = `https://graph.facebook.com/${this.apiVersion}`;
  }

  async fetchTemplates() {
    if (!this.wabaId) {
      throw new Error('WABA ID belum dikonfigurasi');
    }

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

  async sendTemplate({ to, templateName, languageCode = 'id', components = [] }) {
    if (!this.phoneNumberId) {
      throw new Error('Phone Number ID belum dikonfigurasi');
    }

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
      raw: data
    };
  }

  async _fetchWithTimeout(url, options) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      return await fetch(url, {
        ...options,
        signal: controller.signal
      });
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error(`Permintaan ke Meta Graph API batas waktu terlampaui (${this.timeoutMs}ms)`);
      }
      throw new Error(`Gagal menghubungi Meta Graph API: ${err.message}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  async _handleResponse(res) {
    let body;
    try {
      body = await res.json();
    } catch {
      throw new Error(`Meta API mengembalikan status ${res.status} tanpa format JSON`);
    }

    if (!res.ok) {
      const err = body.error || {};
      const message = err.message || `Meta API Error (${res.status})`;
      const cleanMessage = this._sanitize(message);
      const customErr = new Error(cleanMessage);
      customErr.status = res.status;
      customErr.code = err.code || 'META_API_ERROR';
      customErr.subcode = err.error_subcode;
      throw customErr;
    }

    return body;
  }

  _sanitize(text) {
    if (!text || typeof text !== 'string') return text;
    if (this.accessToken) {
      return text.replaceAll(this.accessToken, '****TOKEN_REDACTED****');
    }
    return text;
  }
}
