/**
 * In-memory Circuit Breaker with optional DB alert synchronization.
 * States:
 * - 'closed': Normal traffic permitted.
 * - 'open': High failure rate or auth error detected; fast-fails all attempts.
 * - 'half_open': Cooldown elapsed; permits a probe execution to test recovery.
 */
export class CircuitBreaker {
  constructor({
    failureThreshold = 5,
    cooldownMs = 60000,
    db = null,
    logger = null
  } = {}) {
    this.failureThreshold = failureThreshold;
    this.cooldownMs = cooldownMs;
    this.db = db;
    this.logger = logger;

    this.state = 'closed';
    this.failureCount = 0;
    this.lastFailureTime = null;
  }

  getState() {
    if (this.state === 'open' && this.lastFailureTime) {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed >= this.cooldownMs) {
        this.state = 'half_open';
      }
    }
    return this.state;
  }

  canExecute() {
    const currentState = this.getState();
    return currentState === 'closed' || currentState === 'half_open';
  }

  recordSuccess() {
    this.failureCount = 0;
    this.state = 'closed';
    this.lastFailureTime = null;
  }

  recordFailure(error) {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    // Immediate open on authorization / token failures
    if (error && (error.isAuthError || error.status === 401 || error.status === 403)) {
      this.state = 'open';
      this._raiseAlert('CRITICAL_AUTH_FAILURE', error.message || 'WhatsApp WABA Auth failed');
      return;
    }

    if (this.failureCount >= this.failureThreshold) {
      this.state = 'open';
      this._raiseAlert('CIRCUIT_BREAKER_OPEN', `Circuit opened after ${this.failureCount} consecutive failures`);
    }
  }

  getFailureCount() {
    return this.failureCount;
  }

  async _raiseAlert(code, message) {
    if (this.logger) {
      this.logger.warn({ code, message }, 'Circuit breaker opened');
    }
    if (this.db) {
      try {
        await this.db.query(`
          INSERT INTO system_alerts (severity, code, title, message)
          VALUES ('error', $1, 'Circuit Breaker Aktif', $2)
        `, [code, message]);
      } catch (err) {
        if (this.logger) {
          this.logger.error({ err }, 'Failed to persist circuit breaker alert');
        }
      }
    }
  }
}
