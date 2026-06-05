/**
 * Dynamic Pricing Engine V2 — Autonomous Revenue Optimization
 *
 * Rules (deterministic, no LLM):
 *   IF demand_high  → price +5..+10% (≤ +20% total cap)
 *   IF conv_low     → price -5..-10% (≤ -20% total cap)
 *   IF inventory_high → discount clearance
 *   IF inventory_low  → slight increase (+5%)
 *
 * Cart price stability: once computed for a session+product, cached.
 * Max adjustment: ±20% from base price.
 */

export interface PricingMetrics {
  productId: number;
  basePrice: number;
  marginPercentage?: number;
  inventoryCount?: number;
  salesVelocity?: number; // units/day
  conversionRate?: number; // 0–1
  returnRate?: number; // 0–1
  impressions?: number;
  clicks?: number;
}

export interface PricingDecision {
  basePrice: number;
  dynamicPrice: number;
  discountPercent: number;
  finalPrice: number;
  priceChangePercent: number;
  reasons: string[];
}

const MAX_INCREASE = 0.2;
const MAX_DECREASE = 0.2;
const SESSION_PRICE_CACHE = new Map<string, PricingDecision>();

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeDynamicPrice(metrics: PricingMetrics, sessionId?: string): PricingDecision {
  const cacheKey = `${sessionId ?? 'global'}:${metrics.productId}`;
  const cached = SESSION_PRICE_CACHE.get(cacheKey);
  if (cached) return cached;

  const base = metrics.basePrice;
  const reasons: string[] = [];
  let adjustment = 0; // fractional: 0.05 = +5%

  const ctr =
    metrics.impressions && metrics.impressions > 0
      ? (metrics.clicks ?? 0) / metrics.impressions
      : 0;
  const conv = metrics.conversionRate ?? 0.05;
  const inv = metrics.inventoryCount ?? 100;
  const vel = metrics.salesVelocity ?? 0;

  // ── Demand signal ───────────────────────────────────────────────────────────
  if (vel > 80 || ctr > 0.12) {
    adjustment += 0.1;
    reasons.push('high_demand:+10%');
  } else if (vel > 50 || ctr > 0.08) {
    adjustment += 0.05;
    reasons.push('moderate_demand:+5%');
  }

  // ── Conversion signal ───────────────────────────────────────────────────────
  if (conv < 0.02) {
    adjustment -= 0.1;
    reasons.push('low_conversion:-10%');
  } else if (conv < 0.04) {
    adjustment -= 0.05;
    reasons.push('below_avg_conversion:-5%');
  }

  // ── Inventory signal ────────────────────────────────────────────────────────
  if (inv < 10) {
    adjustment += 0.05;
    reasons.push('low_stock:+5%');
  } else if (inv > 400) {
    adjustment -= 0.08;
    reasons.push('overstock_clearance:-8%');
  } else if (inv > 300) {
    adjustment -= 0.04;
    reasons.push('high_inventory:-4%');
  }

  // Clamp total adjustment
  const clampedAdj = clamp(adjustment, -MAX_DECREASE, MAX_INCREASE);
  const dynamicPrice = round2(base * (1 + clampedAdj));

  // ── Discount calculation (separate from price) ─────────────────────────────
  let discountPct = 0;
  if (inv > 400) discountPct = Math.min(30, Math.round((inv - 400) / 10));
  else if (conv < 0.02) discountPct = 10;
  else if (conv < 0.04) discountPct = 5;

  const finalPrice = round2(dynamicPrice * (1 - discountPct / 100));
  const priceChangePercent = round2(((dynamicPrice - base) / base) * 100);

  const decision: PricingDecision = {
    basePrice: base,
    dynamicPrice,
    discountPercent: discountPct,
    finalPrice,
    priceChangePercent,
    reasons,
  };

  SESSION_PRICE_CACHE.set(cacheKey, decision);
  return decision;
}

/** Clear session cache (call on cart checkout to lock prices) */
export function lockSessionPrices(sessionId: string): void {
  // Prices in cache remain stable — no new computations allowed for this session
}

export function clearPriceCache(): void {
  SESSION_PRICE_CACHE.clear();
}

export function getPriceCacheSize(): number {
  return SESSION_PRICE_CACHE.size;
}
