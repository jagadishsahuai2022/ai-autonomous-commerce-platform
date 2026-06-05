/**
 * DelegateCart App Logger
 *
 * Two-tier logging:
 *  1. `logger`    — lightweight synchronous logger (API errors, fallbacks) — unchanged
 *  2. `appLogger` — async batched audit logger (user actions, cart events, navigation)
 *                   • Batches entries, flushes every 4 s or when queue hits 25
 *                   • Keeps rolling 150-entry window in localStorage (dc_audit_log)
 *                   • Uses sendBeacon on page unload for reliable delivery
 *                   • SSR-safe (no-ops on the server)
 */

export type AuditEvent =
  | 'page_view'
  | 'search'
  | 'filter_apply'
  | 'sort_change'
  | 'cart_add'
  | 'cart_remove'
  | 'cart_qty_change'
  | 'cart_view'
  | 'checkout_start'
  | 'checkout_complete'
  | 'checkout_abort'
  | 'login'
  | 'logout'
  | 'register'
  | 'product_view'
  | 'wishlist_add'
  | 'wishlist_remove'
  | 'error_boundary'
  | 'api_error'
  | 'nav_click'
  | 'mobile_menu_open'
  | 'island_expand'
  | 'island_search';

export interface AuditEntry {
  ts: string;
  lvl: 'info' | 'warn' | 'error';
  evt?: AuditEvent;
  msg: string;
  data?: Record<string, unknown>;
  uid?: string;
  sid: string;
  url?: string;
}

const _isClient = typeof window !== 'undefined';

function _getSessionId(): string {
  if (!_isClient) return 'server';
  try {
    const key = 'dc_sid';
    let id = sessionStorage.getItem(key);
    if (!id) {
      id = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem(key, id);
    }
    return id;
  } catch {
    return 'unknown';
  }
}

const _SESSION_ID = _getSessionId();

class _AppLogger {
  private q: AuditEntry[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private ready = false;

  init(): void {
    if (!_isClient || this.ready) return;
    this.ready = true;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this._syncFlush();
    });
    window.addEventListener('beforeunload', () => this._syncFlush());
  }

  private _uid(): string | undefined {
    try {
      return localStorage.getItem('userEmail') ?? undefined;
    } catch {
      return undefined;
    }
  }

  private _push(
    lvl: AuditEntry['lvl'],
    msg: string,
    data?: Record<string, unknown>,
    evt?: AuditEvent
  ): void {
    if (!_isClient) {
      (lvl === 'error' ? console.error : lvl === 'warn' ? console.warn : console.log)(
        `[DC:${lvl}]${evt ? `[${evt}]` : ''}`,
        msg,
        data ?? ''
      );
      return;
    }
    if (process.env.NODE_ENV === 'development') {
      const c = lvl === 'error' ? '#ef4444' : lvl === 'warn' ? '#f59e0b' : '#8b5cf6';
      (lvl === 'error' ? console.error : lvl === 'warn' ? console.warn : console.log)(
        `%c[DC ${lvl.toUpperCase()}]${evt ? ` [${evt}]` : ''}`,
        `color:${c};font-weight:bold`,
        msg,
        data ?? ''
      );
    }
    this.q.push({
      ts: new Date().toISOString(),
      lvl,
      evt,
      msg,
      data,
      uid: this._uid(),
      sid: _SESSION_ID,
      url: window.location.pathname,
    });
    if (this.q.length >= 25) void this._flush();
    else if (!this.timer) this.timer = setTimeout(() => void this._flush(), 4000);
  }

  private async _flush(): Promise<void> {
    this.timer = null;
    if (!this.q.length) return;
    const batch = this.q.splice(0);
    try {
      const saved: AuditEntry[] = JSON.parse(localStorage.getItem('dc_audit_log') ?? '[]');
      localStorage.setItem('dc_audit_log', JSON.stringify([...saved, ...batch].slice(-150)));
    } catch {}
    try {
      await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: batch }),
      });
    } catch {}
  }

  private _syncFlush(): void {
    if (!_isClient || !this.q.length) return;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const batch = this.q.splice(0);
    try {
      const saved: AuditEntry[] = JSON.parse(localStorage.getItem('dc_audit_log') ?? '[]');
      localStorage.setItem('dc_audit_log', JSON.stringify([...saved, ...batch].slice(-150)));
    } catch {}
    if (navigator.sendBeacon)
      navigator.sendBeacon(
        '/api/logs',
        new Blob([JSON.stringify({ entries: batch })], { type: 'application/json' })
      );
  }

  debug(msg: string, data?: Record<string, unknown>): void {
    if (process.env.NODE_ENV !== 'development') return;
    this._push('info', msg, data);
  }
  info(msg: string, data?: Record<string, unknown>): void {
    this._push('info', msg, data);
  }
  warn(msg: string, data?: Record<string, unknown>): void {
    this._push('warn', msg, data);
  }
  error(msg: string, data?: Record<string, unknown>): void {
    this._push('error', msg, data);
  }
  audit(evt: AuditEvent, msg: string, data?: Record<string, unknown>): void {
    this._push('info', msg, data, evt);
  }
  getLocalLog(): AuditEntry[] {
    try {
      return JSON.parse(localStorage.getItem('dc_audit_log') ?? '[]');
    } catch {
      return [];
    }
  }
}

declare global {
  interface Window {
    __dc_logger__?: _AppLogger;
  }
}
/** Async batched audit logger — use for user actions, navigation, cart events */
export const appLogger: _AppLogger = _isClient
  ? (window.__dc_logger__ ??= new _AppLogger())
  : new _AppLogger();

// ── Legacy synchronous logger (kept for backward compatibility) ───────────────
type LogLevel = 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  source: string;
  message: string;
  context?: Record<string, unknown>;
}

const LOG_PREFIX = '[DelegateCart]';

function formatEntry(entry: LogEntry): string {
  return `${LOG_PREFIX} [${entry.level.toUpperCase()}] [${entry.source}] ${entry.message}`;
}

function log(level: LogLevel, source: string, message: string, context?: Record<string, unknown>) {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    source,
    message,
    context,
  };

  const formatted = formatEntry(entry);

  switch (level) {
    case 'error':
      console.error(formatted, context ?? '');
      break;
    case 'warn':
      console.warn(formatted, context ?? '');
      break;
    default:
      if (process.env.NODE_ENV === 'development') {
        console.log(formatted, context ?? '');
      }
  }

  // Store last N errors in memory for diagnostics
  if (level === 'error' && typeof window !== 'undefined') {
    try {
      const errors = JSON.parse(sessionStorage.getItem('_errorLog') || '[]');
      errors.push({ ts: entry.timestamp, src: source, msg: message });
      if (errors.length > 50) errors.shift();
      sessionStorage.setItem('_errorLog', JSON.stringify(errors));
    } catch {
      /* storage full */
    }
  }
}

export const logger = {
  info: (source: string, message: string, context?: Record<string, unknown>) =>
    log('info', source, message, context),
  warn: (source: string, message: string, context?: Record<string, unknown>) =>
    log('warn', source, message, context),
  error: (source: string, message: string, context?: Record<string, unknown>) =>
    log('error', source, message, context),

  /** Log an API fallback trigger */
  fallback: (source: string, originalError: string, fallbackUsed: string) =>
    log('warn', source, `Fallback triggered: ${fallbackUsed}`, { originalError }),

  /** Log a failed API call */
  apiError: (endpoint: string, status: number | string, message: string) =>
    log('error', 'API', `${endpoint} failed`, { status, message }),
};
