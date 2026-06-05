/**
 * Smart Intent Engine v2 — Logging & Feature Flag
 *
 * - Intent parsing logger with structured output
 * - Feature flag check (env var + graceful fallback)
 */

import type { IntentLog, ParsedIntent } from './types';

// ── Feature Flag ─────────────────────────────────────────────────────────────

/**
 * Check if Smart Intent Engine v2 is enabled.
 * Reads SMART_INTENT_V2 env var. Defaults to true (opt-out model).
 * Can be overridden per-request with `?engine=v1` or `?engine=v2`.
 */
export function isSmartIntentV2Enabled(requestOverride?: string | null): boolean {
  // Per-request override
  if (requestOverride === 'v1') return false;
  if (requestOverride === 'v2') return true;

  // Env var (defaults to 'true')
  const envFlag = process.env.SMART_INTENT_V2;
  if (envFlag === 'false' || envFlag === '0') return false;
  return true; // enabled by default
}

// ── Logger ───────────────────────────────────────────────────────────────────

// In-memory ring buffer for recent intent logs (keep last 100)
const LOG_BUFFER: IntentLog[] = [];
const MAX_LOG_SIZE = 100;

export function logIntent(entry: IntentLog): void {
  LOG_BUFFER.push(entry);
  if (LOG_BUFFER.length > MAX_LOG_SIZE) {
    LOG_BUFFER.shift();
  }

  // Also log to console in development
  if (process.env.NODE_ENV !== 'production') {
    console.log(
      `[SmartIntent v2] query="${entry.query}" ` +
        `category=${entry.intent.category || 'none'} ` +
        `confidence=${entry.intent.confidence} ` +
        `products=${entry.products_found} ` +
        `time=${entry.processing_time_ms}ms` +
        (entry.error ? ` error=${entry.error}` : '')
    );
  }
}

export function getRecentLogs(count = 20): IntentLog[] {
  return LOG_BUFFER.slice(-count);
}

/**
 * Build a log entry from processing result.
 */
export function buildLogEntry(
  query: string,
  intent: ParsedIntent,
  productsFound: number,
  processingTimeMs: number,
  error?: string
): IntentLog {
  return {
    timestamp: new Date().toISOString(),
    query,
    intent,
    questions_generated: 0, // filled by caller
    products_found: productsFound,
    engine_version: 'v2',
    processing_time_ms: processingTimeMs,
    error,
  };
}
