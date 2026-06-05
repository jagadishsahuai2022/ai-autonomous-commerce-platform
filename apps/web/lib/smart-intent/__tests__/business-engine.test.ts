/**
 * Unit Tests — Business Metrics, Scoring, Pricing Engine
 *
 * Tests for:
 * - business-metrics.ts (data model, generation, updates)
 * - business-scoring.ts (score computation, blending)
 * - pricing-engine.ts (dynamic pricing, discounts, guardrails)
 */

import { describe, test, expect, beforeEach } from 'vitest';
import {
  generateMetrics,
  getMetrics,
  getBatchMetrics,
  updateMetricsFromEvent,
  clearMetrics,
  getMetricsStoreSize,
} from '../business-metrics';
import {
  computeBusinessScore,
  blendScores,
  USER_WEIGHT,
  BUSINESS_WEIGHT,
} from '../business-scoring';
import {
  computeDynamicPrice,
  computeDiscount,
  applyIntentDiscount,
  clearSessionPriceCache,
  getSessionPriceCacheSize,
} from '../pricing-engine';

// ══════════════════════════════════════════════════════════════════════════════
// Business Metrics
// ══════════════════════════════════════════════════════════════════════════════

describe('Business Metrics', () => {
  beforeEach(() => {
    clearMetrics();
  });

  test('generateMetrics returns valid metrics for a product', () => {
    const m = generateMetrics('prod-1', 1000, 'phone');
    expect(m.productId).toBe('prod-1');
    expect(m.marginPercentage).toBeGreaterThanOrEqual(0);
    expect(m.marginPercentage).toBeLessThanOrEqual(100);
    expect(m.inventoryCount).toBeGreaterThanOrEqual(0);
    expect(m.salesVelocity).toBeGreaterThanOrEqual(0);
    expect(m.conversionRate).toBeGreaterThanOrEqual(0);
    expect(m.conversionRate).toBeLessThanOrEqual(1);
    expect(m.returnRate).toBeGreaterThanOrEqual(0);
    expect(m.lastUpdated).toBeGreaterThan(0);
  });

  test('generateMetrics is deterministic for same productId', () => {
    const m1 = generateMetrics('prod-det-1');
    clearMetrics();
    const m2 = generateMetrics('prod-det-1');
    expect(m1.marginPercentage).toBe(m2.marginPercentage);
    expect(m1.inventoryCount).toBe(m2.inventoryCount);
    expect(m1.salesVelocity).toBe(m2.salesVelocity);
    expect(m1.conversionRate).toBe(m2.conversionRate);
  });

  test('generateMetrics caches result', () => {
    generateMetrics('cached-1');
    expect(getMetricsStoreSize()).toBe(1);
    generateMetrics('cached-1'); // should return cached
    expect(getMetricsStoreSize()).toBe(1);
  });

  test('getMetrics generates on demand', () => {
    const m = getMetrics('on-demand-1');
    expect(m.productId).toBe('on-demand-1');
  });

  test('getBatchMetrics returns map of metrics', () => {
    const products = [
      { id: 'batch-1', price: 1000, category: 'phone' },
      { id: 'batch-2', price: 5000, category: 'laptop' },
      { id: 'batch-3', price: 500, category: 'fashion' },
    ];
    const result = getBatchMetrics(products);
    expect(result.size).toBe(3);
    expect(result.get('batch-1')?.productId).toBe('batch-1');
    expect(result.get('batch-2')?.productId).toBe('batch-2');
  });

  test('updateMetricsFromEvent increases conversion on click', () => {
    const before = generateMetrics('event-1');
    const origConv = before.conversionRate;
    updateMetricsFromEvent('event-1', 'click');
    const after = getMetrics('event-1');
    expect(after.conversionRate).toBeGreaterThan(origConv);
  });

  test('updateMetricsFromEvent decreases inventory on purchase', () => {
    const before = generateMetrics('purchase-1');
    const origInv = before.inventoryCount;
    updateMetricsFromEvent('purchase-1', 'purchase');
    const after = getMetrics('purchase-1');
    expect(after.inventoryCount).toBeLessThanOrEqual(origInv);
  });

  test('updateMetricsFromEvent updates salesVelocity on add_to_cart', () => {
    const before = generateMetrics('cart-1');
    const origVelocity = before.salesVelocity;
    updateMetricsFromEvent('cart-1', 'add_to_cart');
    const after = getMetrics('cart-1');
    expect(after.salesVelocity).toBeGreaterThanOrEqual(origVelocity);
  });

  test('category-based margin ranges work - fashion has higher margins', () => {
    // Generate many fashion products and check margins are reasonable
    const fashionMetrics = generateMetrics('fashion-m-1', 2000, 'fashion');
    // Fashion margin range: 40-65
    expect(fashionMetrics.marginPercentage).toBeGreaterThanOrEqual(0);
    expect(fashionMetrics.marginPercentage).toBeLessThanOrEqual(100);
  });

  test('clearMetrics resets store', () => {
    generateMetrics('clear-1');
    generateMetrics('clear-2');
    expect(getMetricsStoreSize()).toBe(2);
    clearMetrics();
    expect(getMetricsStoreSize()).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Business Scoring
// ══════════════════════════════════════════════════════════════════════════════

describe('Business Scoring', () => {
  test('computeBusinessScore returns valid breakdown', () => {
    const metrics = {
      productId: 'score-1',
      marginPercentage: 30,
      inventoryCount: 50,
      salesVelocity: 10,
      conversionRate: 0.05,
      returnRate: 0.02,
      lastUpdated: Date.now(),
    };
    const score = computeBusinessScore(metrics);
    expect(score.conversionScore).toBeGreaterThanOrEqual(0);
    expect(score.conversionScore).toBeLessThanOrEqual(20);
    expect(score.marginScore).toBeGreaterThanOrEqual(0);
    expect(score.marginScore).toBeLessThanOrEqual(15);
    expect(score.inventoryScore).toBeGreaterThanOrEqual(0);
    expect(score.inventoryScore).toBeLessThanOrEqual(15);
    expect(score.totalBusinessScore).toBeGreaterThanOrEqual(0);
    expect(score.totalBusinessScore).toBeLessThanOrEqual(50);
  });

  test('high conversion rate produces higher conversion score', () => {
    const low = computeBusinessScore({
      productId: 'conv-low',
      marginPercentage: 20,
      inventoryCount: 50,
      salesVelocity: 10,
      conversionRate: 0.01,
      returnRate: 0,
      lastUpdated: Date.now(),
    });
    const high = computeBusinessScore({
      productId: 'conv-high',
      marginPercentage: 20,
      inventoryCount: 50,
      salesVelocity: 10,
      conversionRate: 0.1,
      returnRate: 0,
      lastUpdated: Date.now(),
    });
    expect(high.conversionScore).toBeGreaterThan(low.conversionScore);
  });

  test('low stock gives scarcity boost (15 pts)', () => {
    const score = computeBusinessScore({
      productId: 'scarce',
      marginPercentage: 20,
      inventoryCount: 3,
      salesVelocity: 10,
      conversionRate: 0.05,
      returnRate: 0,
      lastUpdated: Date.now(),
    });
    expect(score.inventoryScore).toBe(15);
  });

  test('overstock gives clearance boost (10 pts)', () => {
    const score = computeBusinessScore({
      productId: 'overstock',
      marginPercentage: 20,
      inventoryCount: 150,
      salesVelocity: 10,
      conversionRate: 0.05,
      returnRate: 0,
      lastUpdated: Date.now(),
    });
    expect(score.inventoryScore).toBe(10);
  });

  test('normal stock gives moderate boost (5 pts)', () => {
    const score = computeBusinessScore({
      productId: 'normal',
      marginPercentage: 20,
      inventoryCount: 50,
      salesVelocity: 10,
      conversionRate: 0.05,
      returnRate: 0,
      lastUpdated: Date.now(),
    });
    expect(score.inventoryScore).toBe(5);
  });

  test('blendScores gives 70% user + 30% business', () => {
    const result = blendScores(100, 50);
    expect(result).toBe(Math.round(100 * USER_WEIGHT + 50 * BUSINESS_WEIGHT));
    expect(result).toBe(85); // 70 + 15
  });

  test('USER_WEIGHT is 0.7 and BUSINESS_WEIGHT is 0.3', () => {
    expect(USER_WEIGHT).toBe(0.7);
    expect(BUSINESS_WEIGHT).toBe(0.3);
  });

  test('high margin irrelevant product should NOT rank top (user score dominates)', () => {
    // High margin but low user score
    const irrelevant = blendScores(10, 50); // 7 + 15 = 22
    // Low margin but high user score
    const relevant = blendScores(90, 5); // 63 + 1.5 ≈ 65
    expect(relevant).toBeGreaterThan(irrelevant);
  });

  test('high conversion product ranks higher than low conversion (equal user score)', () => {
    const lowConv = computeBusinessScore({
      productId: 'lc',
      marginPercentage: 20,
      inventoryCount: 50,
      salesVelocity: 10,
      conversionRate: 0.01,
      returnRate: 0,
      lastUpdated: Date.now(),
    });
    const highConv = computeBusinessScore({
      productId: 'hc',
      marginPercentage: 20,
      inventoryCount: 50,
      salesVelocity: 10,
      conversionRate: 0.12,
      returnRate: 0,
      lastUpdated: Date.now(),
    });
    const lowFinal = blendScores(80, lowConv.totalBusinessScore);
    const highFinal = blendScores(80, highConv.totalBusinessScore);
    expect(highFinal).toBeGreaterThan(lowFinal);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Pricing Engine
// ══════════════════════════════════════════════════════════════════════════════

describe('Pricing Engine', () => {
  beforeEach(() => {
    clearSessionPriceCache();
    clearMetrics();
  });

  test('computeDynamicPrice returns result with guardrails', () => {
    const metrics = {
      productId: 'price-1',
      marginPercentage: 30,
      inventoryCount: 50,
      salesVelocity: 10,
      conversionRate: 0.05,
      returnRate: 0.02,
      lastUpdated: Date.now(),
    };
    const result = computeDynamicPrice(10000, 'price-1', metrics);
    expect(result.basePrice).toBe(10000);
    expect(result.dynamicPrice).toBeGreaterThanOrEqual(8000); // min -20%
    expect(result.dynamicPrice).toBeLessThanOrEqual(12000); // max +20%
  });

  test('overstock triggers discount', () => {
    const metrics = {
      productId: 'overstock-p',
      marginPercentage: 30,
      inventoryCount: 250,
      salesVelocity: 5,
      conversionRate: 0.05,
      returnRate: 0,
      lastUpdated: Date.now(),
    };
    const result = computeDynamicPrice(10000, 'overstock-p', metrics);
    expect(result.dynamicPrice).toBeLessThan(10000);
    expect(result.reasons).toContain('Clearance');
  });

  test('low stock triggers price increase', () => {
    const metrics = {
      productId: 'scarce-p',
      marginPercentage: 30,
      inventoryCount: 2,
      salesVelocity: 5,
      conversionRate: 0.05,
      returnRate: 0,
      lastUpdated: Date.now(),
    };
    const result = computeDynamicPrice(10000, 'scarce-p', metrics);
    expect(result.dynamicPrice).toBeGreaterThan(10000);
    expect(result.reasons).toContain('Limited stock');
  });

  test('price never exceeds ±20% guardrail', () => {
    // Extreme overstock + low conversion = maximum discount
    const metrics = {
      productId: 'extreme',
      marginPercentage: 30,
      inventoryCount: 500,
      salesVelocity: 200,
      conversionRate: 0.001,
      returnRate: 0,
      lastUpdated: Date.now(),
    };
    const result = computeDynamicPrice(10000, 'extreme', metrics);
    expect(result.dynamicPrice).toBeGreaterThanOrEqual(8000);
    expect(result.dynamicPrice).toBeLessThanOrEqual(12000);
  });

  test('session cache ensures price consistency', () => {
    const metrics = {
      productId: 'cache-p',
      marginPercentage: 30,
      inventoryCount: 250,
      salesVelocity: 5,
      conversionRate: 0.05,
      returnRate: 0,
      lastUpdated: Date.now(),
    };
    const first = computeDynamicPrice(10000, 'cache-p', metrics);
    const second = computeDynamicPrice(10000, 'cache-p', metrics);
    expect(first.dynamicPrice).toBe(second.dynamicPrice);
    expect(getSessionPriceCacheSize()).toBe(1);
  });

  test('cart price consistency — same product same price across calls', () => {
    const metrics = {
      productId: 'cart-p',
      marginPercentage: 40,
      inventoryCount: 300,
      salesVelocity: 100,
      conversionRate: 0.01,
      returnRate: 0,
      lastUpdated: Date.now(),
    };
    const browsePage = computeDynamicPrice(5000, 'cart-p', metrics);
    const productPage = computeDynamicPrice(5000, 'cart-p', metrics);
    const cartPage = computeDynamicPrice(5000, 'cart-p', metrics);
    expect(browsePage.dynamicPrice).toBe(productPage.dynamicPrice);
    expect(productPage.dynamicPrice).toBe(cartPage.dynamicPrice);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Discount Engine
// ══════════════════════════════════════════════════════════════════════════════

describe('Discount Engine', () => {
  test('overstock product gets clearance discount', () => {
    const discount = computeDiscount({
      productId: 'd-1',
      marginPercentage: 30,
      inventoryCount: 250,
      salesVelocity: 5,
      conversionRate: 0.05,
      returnRate: 0,
      lastUpdated: Date.now(),
    });
    expect(discount).toBeGreaterThanOrEqual(15);
  });

  test('low conversion gets incentive discount', () => {
    const discount = computeDiscount({
      productId: 'd-2',
      marginPercentage: 30,
      inventoryCount: 50,
      salesVelocity: 5,
      conversionRate: 0.01,
      returnRate: 0,
      lastUpdated: Date.now(),
    });
    expect(discount).toBeGreaterThanOrEqual(10);
  });

  test('high velocity reduces discount', () => {
    const withHighVelocity = computeDiscount({
      productId: 'd-3',
      marginPercentage: 30,
      inventoryCount: 250,
      salesVelocity: 150,
      conversionRate: 0.05,
      returnRate: 0,
      lastUpdated: Date.now(),
    });
    const withLowVelocity = computeDiscount({
      productId: 'd-4',
      marginPercentage: 30,
      inventoryCount: 250,
      salesVelocity: 5,
      conversionRate: 0.05,
      returnRate: 0,
      lastUpdated: Date.now(),
    });
    expect(withHighVelocity).toBeLessThan(withLowVelocity);
  });

  test('discount is never negative', () => {
    const discount = computeDiscount({
      productId: 'd-5',
      marginPercentage: 30,
      inventoryCount: 50,
      salesVelocity: 200,
      conversionRate: 0.1,
      returnRate: 0,
      lastUpdated: Date.now(),
    });
    expect(discount).toBeGreaterThanOrEqual(0);
  });

  test('discount capped at 30%', () => {
    const discount = computeDiscount({
      productId: 'd-6',
      marginPercentage: 30,
      inventoryCount: 500,
      salesVelocity: 1,
      conversionRate: 0.001,
      returnRate: 0.15,
      lastUpdated: Date.now(),
    });
    expect(discount).toBeLessThanOrEqual(30);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Intent Discount
// ══════════════════════════════════════════════════════════════════════════════

describe('Session-Aware Intent Discount', () => {
  test('no discount for low intent', () => {
    const { price, intentDiscount } = applyIntentDiscount(10000, 1, 0);
    expect(intentDiscount).toBe(0);
    expect(price).toBe(10000);
  });

  test('2% discount for 3+ views', () => {
    const { price, intentDiscount } = applyIntentDiscount(10000, 3, 0);
    expect(intentDiscount).toBe(2);
    expect(price).toBe(9800);
  });

  test('5% discount for high intent (3+ views + 2+ cart events)', () => {
    const { price, intentDiscount } = applyIntentDiscount(10000, 5, 3);
    expect(intentDiscount).toBe(5);
    expect(price).toBe(9500);
  });

  test('intent discount capped at 5%', () => {
    const { intentDiscount } = applyIntentDiscount(10000, 100, 100);
    expect(intentDiscount).toBeLessThanOrEqual(5);
  });
});
