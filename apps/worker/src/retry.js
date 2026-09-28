/**
 * Classifies an error from Meta WhatsApp Cloud API into transient (retryable)
 * or permanent (non-retryable) categories.
 */
export function classifyMetaError(err = {}) {
  const code = err.code;
  const status = err.status || (err.response && err.response.status);
  const metaErr = err.error || (err.response && err.response.data && err.response.data.error) || {};
  const metaCode = metaErr.code;
  const message = String(metaErr.message || err.message || '').toLowerCase();

  // 1. Network level transient errors
  if (code === 'ETIMEDOUT' || code === 'ESOCKETTIMEDOUT' || message.includes('timeout')) {
    return { isTransient: true, category: 'network_timeout', isAuthError: false };
  }
  if (code === 'ECONNRESET' || code === 'ECONNREFUSED' || code === 'EAI_AGAIN') {
    return { isTransient: true, category: 'network_reset', isAuthError: false };
  }

  // 2. HTTP 429 - Rate limit (Meta throughput exceeded) -> transient
  if (status === 429 || metaCode === 130429 || message.includes('rate limit')) {
    return { isTransient: true, category: 'rate_limit', isAuthError: false };
  }

  // 3. HTTP 5xx - Meta server internal error -> transient
  if (status >= 500 && status <= 504) {
    return { isTransient: true, category: 'server_error', isAuthError: false };
  }

  // 4. HTTP 401 / 403 - Auth failure -> permanent, circuit-opening
  if (
    status === 401 ||
    status === 403 ||
    metaCode === 190 ||
    message.includes('token') ||
    message.includes('auth') ||
    message.includes('kunci api') ||
    message.includes('pengirim tidak valid') ||
    message.includes('api_key')
  ) {
    return { isTransient: false, category: 'auth_failure', isAuthError: true };
  }

  // 5. HTTP 400 - Recipient errors
  if (
    metaCode === 131026 ||
    metaCode === 131047 ||
    message.includes('undeliverable') ||
    message.includes('recipient') ||
    message.includes('nomor tidak terdaftar') ||
    message.includes('invalid number')
  ) {
    return { isTransient: false, category: 'invalid_recipient', isAuthError: false };
  }

  // 6. HTTP 400 - Template errors
  if (metaCode === 132000 || metaCode === 132001 || message.includes('template')) {
    return { isTransient: false, category: 'template_error', isAuthError: false };
  }

  // Default client error
  if (status >= 400 && status < 500) {
    return { isTransient: false, category: 'client_error', isAuthError: false };
  }

  // Default unknown
  return { isTransient: true, category: 'unknown_transient', isAuthError: false };
}

/**
 * Calculates exponential backoff with full jitter:
 * delay = min(baseMs * 2^attempt, maxDelayMs) +/- jitter
 */
export function calculateBackoff(attempt, {
  baseMs = 1000,
  maxDelayMs = 60000,
  jitter = 0.2
} = {}) {
  const raw = baseMs * Math.pow(2, attempt);
  const capped = Math.min(raw, maxDelayMs);
  const jitterOffset = capped * jitter * (Math.random() * 2 - 1);
  return Math.min(maxDelayMs, Math.round(Math.max(0, capped + jitterOffset)));
}
