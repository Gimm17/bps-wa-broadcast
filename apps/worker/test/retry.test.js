import { describe, expect, it } from 'vitest';
import {
  classifyMetaError,
  calculateBackoff
} from '../src/retry.js';
import { CircuitBreaker } from '../src/circuit-breaker.js';

describe('Worker Retry & Error Classification', () => {
  it('classifies network timeouts and HTTP 429 as transient/retryable', () => {
    expect(classifyMetaError({ code: 'ETIMEDOUT' })).toMatchObject({
      isTransient: true,
      category: 'network_timeout'
    });

    expect(classifyMetaError({ code: 'ECONNRESET' })).toMatchObject({
      isTransient: true,
      category: 'network_reset'
    });

    expect(classifyMetaError({ status: 429, error: { message: 'Rate limit hit' } })).toMatchObject({
      isTransient: true,
      category: 'rate_limit'
    });

    expect(classifyMetaError({ status: 503, error: { message: 'Service Unavailable' } })).toMatchObject({
      isTransient: true,
      category: 'server_error'
    });
  });

  it('classifies invalid numbers, rejected templates, and auth failures as permanent', () => {
    expect(classifyMetaError({ status: 400, error: { code: 131026, message: 'Message undeliverable' } })).toMatchObject({
      isTransient: false,
      category: 'invalid_recipient'
    });

    expect(classifyMetaError({ status: 400, error: { code: 132000, message: 'Template does not exist' } })).toMatchObject({
      isTransient: false,
      category: 'template_error'
    });

    expect(classifyMetaError({ status: 401, error: { message: 'Invalid OAuth access token' } })).toMatchObject({
      isTransient: false,
      isAuthError: true,
      category: 'auth_failure'
    });
  });

  it('calculates exponential backoff with jitter bounded by maxDelay', () => {
    const options = { baseMs: 1000, maxDelayMs: 30000, jitter: 0.2 };

    const delay0 = calculateBackoff(0, options);
    // Base 1000 * 2^0 = 1000, with +/- 20% jitter -> 800 to 1200
    expect(delay0).toBeGreaterThanOrEqual(800);
    expect(delay0).toBeLessThanOrEqual(1200);

    const delay3 = calculateBackoff(3, options);
    // Base 1000 * 2^3 = 8000 -> 6400 to 9600
    expect(delay3).toBeGreaterThanOrEqual(6400);
    expect(delay3).toBeLessThanOrEqual(9600);

    const delay10 = calculateBackoff(10, options);
    // Base 1000 * 2^10 = 1,024,000 capped at maxDelay 30000 -> around 30000
    expect(delay10).toBeLessThanOrEqual(30000);
  });
});

describe('Circuit Breaker', () => {
  it('transitions from CLOSED to OPEN after consecutive threshold failures', () => {
    const breaker = new CircuitBreaker({ failureThreshold: 3, cooldownMs: 100 });

    expect(breaker.getState()).toBe('closed');
    expect(breaker.canExecute()).toBe(true);

    breaker.recordFailure(new Error('500 server error'));
    expect(breaker.getState()).toBe('closed');

    breaker.recordFailure(new Error('500 server error'));
    expect(breaker.getState()).toBe('closed');

    breaker.recordFailure(new Error('500 server error'));
    expect(breaker.getState()).toBe('open');
    expect(breaker.canExecute()).toBe(false);
  });

  it('immediately opens on auth/credential failure', () => {
    const breaker = new CircuitBreaker({ failureThreshold: 5, cooldownMs: 100 });
    breaker.recordFailure({ isAuthError: true, message: 'Invalid token' });
    expect(breaker.getState()).toBe('open');
  });

  it('transitions to HALF_OPEN after cooldown and resets to CLOSED on probe success', async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 2, cooldownMs: 50 });

    breaker.recordFailure(new Error('fail 1'));
    breaker.recordFailure(new Error('fail 2'));
    expect(breaker.getState()).toBe('open');

    // Wait for cooldown
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(breaker.getState()).toBe('half_open');
    expect(breaker.canExecute()).toBe(true);

    // Record success
    breaker.recordSuccess();
    expect(breaker.getState()).toBe('closed');
    expect(breaker.getFailureCount()).toBe(0);
  });
});
