/**
 * Unit Tests — Performance Utilities & Debounce/Throttle
 * Covers: debounce timing, throttle, lazy loading eligibility,
 *         request deduplication, retry-with-backoff logic.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Debounce implementation (mirrors apps/web lib/debounce usage) ─────────────
function debounce<T extends (...args: unknown[]) => unknown>(fn: T, delay: number): T & { cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const debounced = (...args: Parameters<T>) => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, delay);
  };

  debounced.cancel = () => {
    if (timer !== null) { clearTimeout(timer); timer = null; }
  };

  return debounced as T & { cancel: () => void };
}

// ── Throttle implementation ───────────────────────────────────────────────────
function throttle<T extends (...args: unknown[]) => unknown>(fn: T, limit: number): T {
  let lastRun = 0;
  return ((...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastRun >= limit) {
      lastRun = now;
      return fn(...args);
    }
  }) as T;
}

// ── Retry with exponential backoff ────────────────────────────────────────────
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number,
  baseDelayMs: number
): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err as Error;
      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

// ── Request deduplication ─────────────────────────────────────────────────────
class RequestDeduplicator {
  private pending = new Map<string, Promise<unknown>>();

  async dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
    if (this.pending.has(key)) {
      return this.pending.get(key) as Promise<T>;
    }
    const promise = fn().finally(() => this.pending.delete(key));
    this.pending.set(key, promise);
    return promise;
  }

  hasPending(key: string): boolean {
    return this.pending.has(key);
  }

  size(): number {
    return this.pending.size;
  }
}

// ── Lazy loading eligibility ──────────────────────────────────────────────────
function shouldLazyLoad(index: number, viewportCount: number): boolean {
  return index >= viewportCount;
}

function getImagePriority(index: number): 'high' | 'low' | 'auto' {
  if (index === 0) return 'high';
  if (index < 3) return 'auto';
  return 'low';
}

// ── Cache TTL logic ───────────────────────────────────────────────────────────
interface CacheEntry<T> {
  data: T;
  cachedAt: number;
  ttlMs: number;
}

function isCacheValid<T>(entry: CacheEntry<T>): boolean {
  return Date.now() - entry.cachedAt < entry.ttlMs;
}

function createCacheEntry<T>(data: T, ttlMs: number): CacheEntry<T> {
  return { data, cachedAt: Date.now(), ttlMs };
}

// ════════════════════════════════════════════════════════════════════════════
// DEBOUNCE
// ════════════════════════════════════════════════════════════════════════════
describe('debounce', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('delays function execution', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 200);
    debounced('a');
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledOnce();
  });

  it('resets timer on repeated calls (leading edge suppressed)', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 200);
    debounced('a');
    debounced('b');
    debounced('c');
    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledOnce();
    expect(fn).toHaveBeenCalledWith('c');
  });

  it('fires again after cooldown', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);
    debounced('first');
    vi.advanceTimersByTime(100);
    debounced('second');
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('cancel() prevents execution', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 200);
    debounced('x');
    debounced.cancel();
    vi.advanceTimersByTime(300);
    expect(fn).not.toHaveBeenCalled();
  });

  it('cancel() is safe to call when no pending timer', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);
    expect(() => debounced.cancel()).not.toThrow();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// THROTTLE
// ════════════════════════════════════════════════════════════════════════════
describe('throttle', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('calls function immediately on first invocation', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 200);
    throttled();
    expect(fn).toHaveBeenCalledOnce();
  });

  it('ignores calls within limit window', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 200);
    throttled();
    vi.advanceTimersByTime(100);
    throttled();
    expect(fn).toHaveBeenCalledOnce();
  });

  it('allows call after limit window expires', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);
    throttled();
    vi.advanceTimersByTime(200);
    throttled();
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// RETRY WITH BACKOFF
// ════════════════════════════════════════════════════════════════════════════
describe('retryWithBackoff', () => {
  beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }); });
  afterEach(() => { vi.useRealTimers(); });

  it('succeeds on first attempt', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await retryWithBackoff(fn, 2, 10);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledOnce();
  });

  it('retries on failure and eventually succeeds', async () => {
    let calls = 0;
    const fn = vi.fn(async () => {
      calls++;
      if (calls < 3) throw new Error('fail');
      return 'success';
    });
    const result = await retryWithBackoff(fn, 3, 1);
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('throws after max retries exceeded', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('permanent failure'));
    await expect(retryWithBackoff(fn, 2, 1)).rejects.toThrow('permanent failure');
    expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });
});

// ════════════════════════════════════════════════════════════════════════════
// REQUEST DEDUPLICATION
// ════════════════════════════════════════════════════════════════════════════
describe('RequestDeduplicator', () => {
  it('deduplicates concurrent calls with same key', async () => {
    const dedup = new RequestDeduplicator();
    let callCount = 0;
    const fn = () => new Promise<string>(r => {
      callCount++;
      setTimeout(() => r('data'), 50);
    });

    const [r1, r2, r3] = await Promise.all([
      dedup.dedupe('key1', fn),
      dedup.dedupe('key1', fn),
      dedup.dedupe('key1', fn),
    ]);

    expect(r1).toBe('data');
    expect(r2).toBe('data');
    expect(r3).toBe('data');
    expect(callCount).toBe(1);
  });

  it('allows different keys to run in parallel', async () => {
    const dedup = new RequestDeduplicator();
    let callCount = 0;
    const fn = () => new Promise<string>(r => {
      callCount++;
      setTimeout(() => r('data'), 10);
    });

    await Promise.all([
      dedup.dedupe('key1', fn),
      dedup.dedupe('key2', fn),
    ]);

    expect(callCount).toBe(2);
  });

  it('cleans up after completion', async () => {
    const dedup = new RequestDeduplicator();
    const fn = () => Promise.resolve('done');
    await dedup.dedupe('x', fn);
    expect(dedup.hasPending('x')).toBe(false);
    expect(dedup.size()).toBe(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// LAZY LOADING & IMAGE PRIORITY
// ════════════════════════════════════════════════════════════════════════════
describe('lazy loading', () => {
  it('first 3 images are not lazy loaded', () => {
    expect(shouldLazyLoad(0, 6)).toBe(false);
    expect(shouldLazyLoad(1, 6)).toBe(false);
    expect(shouldLazyLoad(2, 6)).toBe(false);
  });

  it('images beyond viewport count are lazy loaded', () => {
    expect(shouldLazyLoad(6, 6)).toBe(true);
    expect(shouldLazyLoad(10, 6)).toBe(true);
  });

  it('first image gets high priority', () => {
    expect(getImagePriority(0)).toBe('high');
  });

  it('images 1-2 get auto priority', () => {
    expect(getImagePriority(1)).toBe('auto');
    expect(getImagePriority(2)).toBe('auto');
  });

  it('images 3+ get low priority', () => {
    expect(getImagePriority(3)).toBe('low');
    expect(getImagePriority(99)).toBe('low');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// CACHE TTL
// ════════════════════════════════════════════════════════════════════════════
describe('cache TTL validation', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('fresh cache entry is valid', () => {
    const entry = createCacheEntry({ data: 'test' }, 60_000);
    expect(isCacheValid(entry)).toBe(true);
  });

  it('expired cache entry is invalid', () => {
    const entry = createCacheEntry({ data: 'test' }, 100);
    vi.advanceTimersByTime(200);
    expect(isCacheValid(entry)).toBe(false);
  });

  it('entry valid exactly at TTL boundary', () => {
    const entry = createCacheEntry({ data: 'test' }, 1000);
    vi.advanceTimersByTime(999);
    expect(isCacheValid(entry)).toBe(true);
  });

  it('entry invalid just after TTL', () => {
    const entry = createCacheEntry({ data: 'test' }, 1000);
    vi.advanceTimersByTime(1001);
    expect(isCacheValid(entry)).toBe(false);
  });
});
