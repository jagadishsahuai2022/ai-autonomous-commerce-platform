/**
 * Signal Processor — Compute CTR, conversion, bounce, query success rate
 *
 * Aggregates raw event counts into performance metrics used
 * by the auto-tuning engine and monitoring system.
 */

export interface RawSignals {
  impressions: number;
  clicks: number;
  cartAdds: number;
  purchases: number;
  bounces: number;
  revenue: number;
  successfulSearches: number;
  totalSearches: number;
}

export interface ProcessedSignals {
  ctr: number; // clicks / impressions
  conversionRate: number; // purchases / clicks
  cartAbandonRate: number; // (cartAdds - purchases) / cartAdds
  bounceRate: number; // bounces / impressions
  avgOrderValue: number; // revenue / purchases
  querySuccessRate: number; // successfulSearches / totalSearches
  revenuePerImpression: number;
}

export function processSignals(raw: RawSignals): ProcessedSignals {
  const ctr = raw.impressions > 0 ? raw.clicks / raw.impressions : 0;
  const conversionRate = raw.clicks > 0 ? raw.purchases / raw.clicks : 0;
  const cartAbandonRate = raw.cartAdds > 0 ? (raw.cartAdds - raw.purchases) / raw.cartAdds : 0;
  const bounceRate = raw.impressions > 0 ? raw.bounces / raw.impressions : 0;
  const avgOrderValue = raw.purchases > 0 ? raw.revenue / raw.purchases : 0;
  const querySuccessRate = raw.totalSearches > 0 ? raw.successfulSearches / raw.totalSearches : 1;
  const revenuePerImpression = raw.impressions > 0 ? raw.revenue / raw.impressions : 0;

  return {
    ctr: Math.round(ctr * 10000) / 10000,
    conversionRate: Math.round(conversionRate * 10000) / 10000,
    cartAbandonRate: Math.round(cartAbandonRate * 10000) / 10000,
    bounceRate: Math.round(bounceRate * 10000) / 10000,
    avgOrderValue: Math.round(avgOrderValue * 100) / 100,
    querySuccessRate: Math.round(querySuccessRate * 10000) / 10000,
    revenuePerImpression: Math.round(revenuePerImpression * 100000) / 100000,
  };
}

// ── Rolling window accumulator ────────────────────────────────────────────────

interface WindowedSignals {
  signals: RawSignals;
  windowStart: number;
  windowMs: number;
}

const WINDOW_MS = 60 * 60 * 1000; // 1 hour default
let _window: WindowedSignals = newWindow();

function newWindow(): WindowedSignals {
  return {
    signals: {
      impressions: 0,
      clicks: 0,
      cartAdds: 0,
      purchases: 0,
      bounces: 0,
      revenue: 0,
      successfulSearches: 0,
      totalSearches: 0,
    },
    windowStart: Date.now(),
    windowMs: WINDOW_MS,
  };
}

export function recordEvent(
  type: 'impression' | 'click' | 'cart_add' | 'purchase' | 'bounce' | 'search',
  meta?: { revenue?: number; success?: boolean }
): void {
  // Roll window if expired
  if (Date.now() - _window.windowStart > _window.windowMs) {
    _window = newWindow();
  }
  const s = _window.signals;
  switch (type) {
    case 'impression':
      s.impressions++;
      break;
    case 'click':
      s.clicks++;
      break;
    case 'cart_add':
      s.cartAdds++;
      break;
    case 'purchase':
      s.purchases++;
      if (meta?.revenue) s.revenue += meta.revenue;
      break;
    case 'bounce':
      s.bounces++;
      break;
    case 'search':
      s.totalSearches++;
      if (meta?.success !== false) s.successfulSearches++;
      break;
  }
}

export function getWindowedMetrics(): ProcessedSignals & { windowAgeMs: number } {
  const processed = processSignals(_window.signals);
  return { ...processed, windowAgeMs: Date.now() - _window.windowStart };
}

export function resetWindow(): void {
  _window = newWindow();
}
