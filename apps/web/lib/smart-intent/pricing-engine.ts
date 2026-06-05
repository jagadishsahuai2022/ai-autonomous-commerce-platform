/**
 * Smart Intent Engine — Dynamic Pricing Engine
 *
 * Computes dynamic prices based on business metrics and demand signals.
 *
 * Safety guardrails:
 *   - Price NEVER changes > ±20% from base
 *   - Session-level caching (same user sees same price)
 *   - Cart/checkout price consistency guaranteed
 */

import type { ProductBusinessMetrics } from './business-metrics';

// ── Types ────────────────────────────────────────────────────────────────────

export interface DynamicPriceResult {
  basePrice: number;
  dynamicPrice: number;
  discountPercent: number;
  priceChangePercent: number;
  reasons: string[];
}

// ── Session price cache ──────────────────────────────────────────────────────
// Ensures price consistency within a session across pages/cart/checkout.
const _sessionPriceCache = new Map<string, DynamicPriceResult>();
const MAX_CACHE = 50000;

// ── Core dynamic pricing ─────────────────────────────────────────────────────

/**
 * Compute a dynamic price for a product based on business metrics.
 *
 * @param basePrice - The original/listed price
 * @param productId - Product identifier (for session caching)
 * @param metrics - Business metrics for the product
 * @returns dynamic price result with guardrails applied
 */
export function computeDynamicPrice(
  basePrice: number,
  productId: string,
  metrics: ProductBusinessMetrics
): DynamicPriceResult {
  // Session cache check — same product always returns same price in session
  const cached = _sessionPriceCache.get(productId);
  if (cached && cached.basePrice === basePrice) return cached;

  let price = basePrice;
  const reasons: string[] = [];

  // ── Demand-based pricing ──────────────────────────────────────────────
  if (metrics.salesVelocity > 50) {
    price *= 1.05; // +5% for high-demand items
    reasons.push('High demand');
  }

  // ── Low conversion → discount ─────────────────────────────────────────
  if (metrics.conversionRate < 0.02) {
    price *= 0.9; // -10% to boost conversions
    reasons.push('Conversion boost');
  }

  // ── Overstock → discount ──────────────────────────────────────────────
  if (metrics.inventoryCount > 200) {
    price *= 0.85; // -15% clearance
    reasons.push('Clearance');
  }

  // ── Low stock → slight increase ───────────────────────────────────────
  if (metrics.inventoryCount < 5) {
    price *= 1.1; // +10% scarcity premium
    reasons.push('Limited stock');
  }

  // ── SAFETY GUARDRAIL: Cap at ±20% ─────────────────────────────────────
  const minPrice = basePrice * 0.8;
  const maxPrice = basePrice * 1.2;
  price = Math.max(minPrice, Math.min(maxPrice, price));

  const dynamicPrice = Math.round(price);
  const priceChangePercent = Math.round(((dynamicPrice - basePrice) / basePrice) * 100 * 10) / 10;
  const discountPercent =
    dynamicPrice < basePrice ? Math.round(((basePrice - dynamicPrice) / basePrice) * 100) : 0;

  const result: DynamicPriceResult = {
    basePrice,
    dynamicPrice,
    discountPercent,
    priceChangePercent,
    reasons,
  };

  // Cache for session consistency
  if (_sessionPriceCache.size >= MAX_CACHE) {
    const firstKey = _sessionPriceCache.keys().next().value;
    if (firstKey) _sessionPriceCache.delete(firstKey);
  }
  _sessionPriceCache.set(productId, result);

  return result;
}

// ── Smart discount engine ────────────────────────────────────────────────────

/**
 * Compute a smart discount percentage based on business metrics.
 * Discount is additive to any existing promotions.
 *
 * @param metrics - Business metrics for the product
 * @returns discount percentage (0-30, never negative)
 */
export function computeDiscount(metrics: ProductBusinessMetrics): number {
  let discount = 0;

  // Overstock → clearance discount
  if (metrics.inventoryCount > 200) {
    discount += 15;
  }

  // Low conversion → incentivize purchase
  if (metrics.conversionRate < 0.02) {
    discount += 10;
  }

  // High sales velocity → reduce discount (product sells itself)
  if (metrics.salesVelocity > 100) {
    discount -= 5;
  }

  // High return rate → slight discount to compensate
  if (metrics.returnRate > 0.08) {
    discount += 3;
  }

  // Cap: never exceed 30%, never go negative
  return Math.max(0, Math.min(30, discount));
}

// ── Session-aware intent pricing ─────────────────────────────────────────────

/**
 * Apply a small discount (2-5%) if user shows high intent signals.
 * Signals: multiple views, add/remove cart behavior.
 *
 * @param basePrice - The current price
 * @param viewCount - Number of times user viewed this product (session)
 * @param cartEvents - Number of add/remove cart events (session)
 * @returns adjusted price with optional intent discount
 */
export function applyIntentDiscount(
  basePrice: number,
  viewCount: number,
  cartEvents: number
): { price: number; intentDiscount: number } {
  let intentDiscount = 0;

  // 3+ views = interested
  if (viewCount >= 3) {
    intentDiscount += 2;
  }

  // Cart add/remove = very high intent
  if (cartEvents >= 2) {
    intentDiscount += 3;
  }

  // Cap at 5%
  intentDiscount = Math.min(5, intentDiscount);

  const price = intentDiscount > 0 ? Math.round(basePrice * (1 - intentDiscount / 100)) : basePrice;

  return { price, intentDiscount };
}

// ── Cache management ─────────────────────────────────────────────────────────

export function getSessionPriceCache(): Map<string, DynamicPriceResult> {
  return new Map(_sessionPriceCache);
}

export function clearSessionPriceCache(): void {
  _sessionPriceCache.clear();
}

export function getSessionPriceCacheSize(): number {
  return _sessionPriceCache.size;
}
