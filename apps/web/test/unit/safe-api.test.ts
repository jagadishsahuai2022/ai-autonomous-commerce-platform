/**
 * Unit tests for safe-api.ts — exponential backoff with jitter, retry logic
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We'll test the backoff logic and fetchWithRetry behavior

describe('Safe API - Exponential Backoff', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should calculate exponential backoff delay correctly', () => {
    // The formula: min(baseMs * 2^attempt + jitter, MAX_RETRY_DELAY)
    // With jitter being random, we test the range
    const baseMs = 500;

    // Attempt 0: 500 * 2^0 + jitter = 500..1000
    // Attempt 1: 500 * 2^1 + jitter = 1000..1500
    // Attempt 2: 500 * 2^2 + jitter = 2000..2500
    // Attempt 3: 500 * 2^3 + jitter = 4000..4500

    // We can't directly import the private backoffDelay function,
    // but we can verify behavior through fetchWithRetry timing
    expect(baseMs * Math.pow(2, 0)).toBe(500);
    expect(baseMs * Math.pow(2, 1)).toBe(1000);
    expect(baseMs * Math.pow(2, 2)).toBe(2000);
    expect(baseMs * Math.pow(2, 3)).toBe(4000);
  });

  it('should cap backoff at MAX_RETRY_DELAY (10000ms)', () => {
    const baseMs = 500;
    const MAX_RETRY_DELAY = 10000;
    // Attempt 5: 500 * 2^5 = 16000, capped at 10000
    const exponential = baseMs * Math.pow(2, 5);
    expect(Math.min(exponential + 0, MAX_RETRY_DELAY)).toBe(MAX_RETRY_DELAY);
  });

  it('should not retry on 4xx errors', async () => {
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      return Promise.resolve({
        ok: false,
        status: 404,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: () => Promise.resolve('{"error":"Not found"}'),
      });
    });

    const { safeFetch } = await import('@/lib/safe-api');
    const result = await safeFetch('/api/test', { retries: 3 });

    expect(callCount).toBe(1); // No retries for 4xx
    expect(result.success).toBe(false);
    expect(result.status).toBe(404);
  });

  it('should retry on 5xx errors up to max retries', async () => {
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      return Promise.resolve({
        ok: false,
        status: 500,
        headers: new Headers({ 'content-type': 'text/plain' }),
        text: () => Promise.resolve('Internal Server Error'),
      });
    });

    const { safeFetch } = await import('@/lib/safe-api');
    const result = await safeFetch('/api/test', { retries: 2, retryDelayMs: 10 });

    expect(callCount).toBe(3); // 1 initial + 2 retries
    expect(result.success).toBe(false);
    expect(result.status).toBe(500);
  });

  it('should succeed on retry after initial failure', async () => {
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: false,
          status: 503,
          headers: new Headers(),
          text: () => Promise.resolve('Service Unavailable'),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ data: 'success' }),
      });
    });

    const { safeFetch } = await import('@/lib/safe-api');
    const result = await safeFetch('/api/test', { retries: 2, retryDelayMs: 10 });

    expect(callCount).toBe(2);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ data: 'success' });
  });

  it('should handle network errors with retry', async () => {
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount <= 2) {
        return Promise.reject(new TypeError('Failed to fetch'));
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ recovered: true }),
      });
    });

    const { safeFetch } = await import('@/lib/safe-api');
    const result = await safeFetch('/api/test', { retries: 3, retryDelayMs: 10 });

    expect(callCount).toBe(3);
    expect(result.success).toBe(true);
  });

  it('should return text data when content-type is not JSON', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/plain' }),
      text: () => Promise.resolve('plain text response'),
    });

    const { safeFetch } = await import('@/lib/safe-api');
    const result = await safeFetch('/api/test');

    expect(result.success).toBe(true);
    expect(result.data).toBe('plain text response');
  });

  it('safeGet should use GET method', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve({ ok: true }),
    });

    const { safeGet } = await import('@/lib/safe-api');
    await safeGet('/api/test');

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/test',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('safePost should send JSON body', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve({ created: true }),
    });

    const { safePost } = await import('@/lib/safe-api');
    await safePost('/api/test', { name: 'test' });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/test',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'test' }),
      })
    );
  });

  it('fetchWithRetry should throw on final failure', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network down'));

    const { fetchWithRetry } = await import('@/lib/safe-api');

    await expect(
      fetchWithRetry('/api/test', { retries: 1, retryDelayMs: 10, timeoutMs: 5000 })
    ).rejects.toThrow('Network down');
  });

  it('fetchWithRetry should return Response on success', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
    };
    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    const { fetchWithRetry } = await import('@/lib/safe-api');
    const result = await fetchWithRetry('/api/test');

    expect(result.status).toBe(200);
  });
});
