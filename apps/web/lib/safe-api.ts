/**
 * Safe API Client — wraps fetch calls to internal Next.js API routes.
 * Never throws. Always returns { success, data, error }.
 * Includes timeout, retry, and structured error info.
 */

export interface SafeApiResult<T> {
  success: boolean;
  data: T | null;
  error?: string;
  status?: number;
}

interface SafeFetchOptions extends RequestInit {
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
}

const DEFAULT_TIMEOUT = 8000;
const DEFAULT_RETRIES = 2;
const DEFAULT_RETRY_DELAY = 500;
const MAX_RETRY_DELAY = 10000;

/**
 * Exponential backoff with jitter.
 * delay = min(baseDelay * 2^attempt + random jitter, maxDelay)
 */
function backoffDelay(baseMs: number, attempt: number): number {
  const exponential = baseMs * Math.pow(2, attempt);
  const jitter = Math.random() * baseMs; // 0..baseMs random jitter
  return Math.min(exponential + jitter, MAX_RETRY_DELAY);
}

/**
 * Fetch wrapper that never throws. Returns SafeApiResult.
 */
export async function safeFetch<T = unknown>(
  url: string,
  options: SafeFetchOptions = {}
): Promise<SafeApiResult<T>> {
  const {
    timeoutMs = DEFAULT_TIMEOUT,
    retries = DEFAULT_RETRIES,
    retryDelayMs = DEFAULT_RETRY_DELAY,
    ...fetchOptions
  } = options;

  let lastError = '';
  let lastStatus = 0;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });

      clearTimeout(timer);
      lastStatus = response.status;

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        let errorMsg: string;
        try {
          const parsed = JSON.parse(errorBody);
          errorMsg = parsed.error || parsed.message || `HTTP ${response.status}`;
        } catch {
          errorMsg = errorBody || `HTTP ${response.status}`;
        }

        // Don't retry 4xx client errors
        if (response.status >= 400 && response.status < 500) {
          return { success: false, data: null, error: errorMsg, status: response.status };
        }

        lastError = errorMsg;
        if (attempt < retries) {
          await sleep(backoffDelay(retryDelayMs, attempt));
          continue;
        }
        return { success: false, data: null, error: errorMsg, status: response.status };
      }

      const contentType = response.headers.get('content-type') || '';
      let data: T;
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = (await response.text()) as unknown as T;
      }

      return { success: true, data, status: response.status };
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        lastError = 'Request timed out';
      } else if (err instanceof TypeError && err.message.includes('fetch')) {
        lastError = 'Network error';
      } else {
        lastError = err instanceof Error ? err.message : 'Unknown error';
      }

      if (attempt < retries) {
        await sleep(backoffDelay(retryDelayMs, attempt));
        continue;
      }
    }
  }

  return { success: false, data: null, error: lastError, status: lastStatus || 0 };
}

/**
 * Safe GET request.
 */
export function safeGet<T = unknown>(
  url: string,
  options: SafeFetchOptions = {}
): Promise<SafeApiResult<T>> {
  return safeFetch<T>(url, { ...options, method: 'GET' });
}

/**
 * Safe POST request with JSON body.
 */
export function safePost<T = unknown>(
  url: string,
  body: unknown,
  options: SafeFetchOptions = {}
): Promise<SafeApiResult<T>> {
  return safeFetch<T>(url, {
    ...options,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    body: JSON.stringify(body),
  });
}

/**
 * Safe PUT request with JSON body.
 */
export function safePut<T = unknown>(
  url: string,
  body: unknown,
  options: SafeFetchOptions = {}
): Promise<SafeApiResult<T>> {
  return safeFetch<T>(url, {
    ...options,
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    body: JSON.stringify(body),
  });
}

/**
 * Safe DELETE request.
 */
export function safeDelete<T = unknown>(
  url: string,
  options: SafeFetchOptions = {}
): Promise<SafeApiResult<T>> {
  return safeFetch<T>(url, { ...options, method: 'DELETE' });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Drop-in replacement for raw fetch() with retry + exponential backoff + jitter.
 * Throws on final failure (unlike safeFetch which returns SafeApiResult).
 * Use this where code expects a standard Response object.
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit & { retries?: number; retryDelayMs?: number; timeoutMs?: number } = {}
): Promise<Response> {
  const {
    retries = DEFAULT_RETRIES,
    retryDelayMs = DEFAULT_RETRY_DELAY,
    timeoutMs = DEFAULT_TIMEOUT,
    ...fetchOptions
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, { ...fetchOptions, signal: controller.signal });
      clearTimeout(timer);

      // Don't retry 4xx
      if (response.status >= 400 && response.status < 500) return response;

      // Retry 5xx
      if (!response.ok && attempt < retries) {
        await sleep(backoffDelay(retryDelayMs, attempt));
        continue;
      }

      return response;
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < retries) {
        await sleep(backoffDelay(retryDelayMs, attempt));
        continue;
      }
    }
  }

  throw lastError ?? new Error('Fetch failed');
}
