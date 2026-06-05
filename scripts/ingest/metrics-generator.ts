/**
 * PHASE 6: Business Metrics Generation
 * Produces realistic metrics for ProductBusinessMetrics and ProductLearning tables.
 */

import type { NormalizedProduct, BusinessMetrics } from './types';

// Price-tier based margin ranges (realistic for Indian e-commerce)
function computeMargin(price: number, category: string): number {
  let base: number;
  if (category === 'Books')
    base = 35; // High margin on books
  else if (category === 'Groceries')
    base = 15; // Low margin FMCG
  else if (category === 'Electronics')
    base = 12; // Low margin hardware
  else if (category === 'Fashion')
    base = 45; // High margin fashion
  else if (category === 'Sports')
    base = 30; // Mid margin sports
  else base = 25; // Home & Kitchen

  // Reduce margin for premium-priced items (heavy competition)
  if (price > 100000) base = Math.max(5, base - 15);
  else if (price > 50000) base = Math.max(8, base - 8);

  // Add ±5% variance
  return Math.min(60, Math.max(10, Math.round(base + (Math.random() * 10 - 5))));
}

function seededRandom(seed: number): number {
  // Deterministic pseudo-random for reproducible metrics
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

export function generateBusinessMetrics(
  product: NormalizedProduct,
  productId: number
): BusinessMetrics {
  const r1 = seededRandom(productId);
  const r2 = seededRandom(productId * 3);
  const r3 = seededRandom(productId * 7);
  const r4 = seededRandom(productId * 11);
  const r5 = seededRandom(productId * 13);

  const marginPercentage = computeMargin(product.price, product.category);

  // Inventory: premium items have less stock
  const inventoryBase = product.price > 50000 ? 15 : product.price > 10000 ? 80 : 250;
  const inventoryCount = Math.max(1, Math.round(inventoryBase * (0.5 + r1)));

  // Sales velocity: 0.1 to 50 units/day (higher rated = higher velocity)
  const velocityBase = product.rating > 4 ? 8 : product.rating > 3 ? 3 : 1;
  const salesVelocity = parseFloat((velocityBase * (0.5 + r2 * 5)).toFixed(2));

  // Conversion rate: 1–10%
  const conversionRate = parseFloat((1 + r3 * 9).toFixed(4));

  // Return rate: 0.5–15% (electronics higher due to defects)
  const returnBase = product.category === 'Electronics' ? 5 : 2;
  const returnRate = parseFloat((returnBase * (0.5 + r5 * 2)).toFixed(4));

  return { productId, marginPercentage, inventoryCount, salesVelocity, conversionRate, returnRate };
}

export function generateLearningMetrics(
  product: NormalizedProduct,
  productId: number
): {
  productId: number;
  impressions: number;
  clicks: number;
  cartAdds: number;
  purchases: number;
  ctr: number;
  conversionRate: number;
  reinforcementScore: number;
  trendingScore: number;
} {
  const r1 = seededRandom(productId + 100);
  const r2 = seededRandom(productId + 200);
  const r3 = seededRandom(productId + 300);

  const impressions = Math.round(100 + r1 * 50000);
  const ctr = 0.01 + r2 * 0.15;
  const clicks = Math.round(impressions * ctr);
  const cartAddRate = 0.1 + r3 * 0.3;
  const cartAdds = Math.round(clicks * cartAddRate);
  const purchaseRate = 0.2 + seededRandom(productId + 400) * 0.4;
  const purchases = Math.round(cartAdds * purchaseRate);

  const ctrRounded = parseFloat(ctr.toFixed(4));
  const convRate = cartAdds > 0 ? parseFloat((purchases / clicks).toFixed(4)) : 0;
  const reinforcementScore = parseFloat((convRate * 10 + ctrRounded * 5).toFixed(4));
  const trendingScore = parseFloat((r1 * 100).toFixed(4));

  return {
    productId,
    impressions,
    clicks,
    cartAdds,
    purchases,
    ctr: ctrRounded,
    conversionRate: convRate,
    reinforcementScore,
    trendingScore,
  };
}
