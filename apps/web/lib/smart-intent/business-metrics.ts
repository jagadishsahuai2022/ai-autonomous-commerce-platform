/**
 * Smart Intent Engine — Business Metrics Data Model
 *
 * Provides ProductBusinessMetrics for multi-objective ranking.
 * In-memory store with deterministic seeding from product data.
 * DB is single source of truth; this module provides business signals.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface ProductBusinessMetrics {
  productId: string;
  marginPercentage: number; // e.g. 20–60%
  inventoryCount: number;
  salesVelocity: number; // units/day
  conversionRate: number; // clicks → purchase (0.0–1.0)
  returnRate: number; // 0.0–1.0
  lastUpdated: number; // timestamp ms
}

// ── In-memory store ──────────────────────────────────────────────────────────

const _metricsStore = new Map<string, ProductBusinessMetrics>();
const MAX_RECORDS = 200000;

// ── Deterministic seed from product attributes ──────────────────────────────

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

/**
 * Generate realistic business metrics from product data.
 * Deterministic based on productId — same ID always returns same metrics.
 */
export function generateMetrics(
  productId: string,
  price?: number,
  category?: string
): ProductBusinessMetrics {
  const cached = _metricsStore.get(productId);
  if (cached) return cached;

  const seed = hashCode(productId);
  const rng = seededRandom(seed);

  // Category-based margin ranges
  const categoryMargins: Record<string, [number, number]> = {
    phone: [8, 18],
    laptop: [10, 22],
    headphones: [25, 55],
    television: [12, 25],
    appliances: [15, 35],
    fashion: [40, 65],
    footwear: [35, 60],
    watches: [30, 55],
    furniture: [25, 50],
    accessories: [35, 60],
    groceries: [5, 20],
    sports: [20, 45],
    books: [15, 40],
  };

  const cat = (category || 'general').toLowerCase();
  const [minMargin, maxMargin] = categoryMargins[cat] || [15, 40];

  const marginPercentage = Math.round(minMargin + rng() * (maxMargin - minMargin));
  const inventoryCount = Math.floor(rng() * 500);
  const salesVelocity = Math.round(rng() * 200 * 10) / 10;
  const conversionRate = Math.round(rng() * 0.15 * 1000) / 1000; // 0.000–0.150
  const returnRate = Math.round(rng() * 0.12 * 1000) / 1000; // 0.000–0.120

  const metrics: ProductBusinessMetrics = {
    productId,
    marginPercentage,
    inventoryCount,
    salesVelocity,
    conversionRate,
    returnRate,
    lastUpdated: Date.now(),
  };

  if (_metricsStore.size >= MAX_RECORDS) {
    // Evict oldest
    const firstKey = _metricsStore.keys().next().value;
    if (firstKey) _metricsStore.delete(firstKey);
  }
  _metricsStore.set(productId, metrics);
  return metrics;
}

// ── Update metrics from events ──────────────────────────────────────────────

export function updateMetricsFromEvent(
  productId: string,
  event: 'click' | 'add_to_cart' | 'purchase' | 'impression',
  price?: number,
  category?: string
): void {
  const m = generateMetrics(productId, price, category);

  switch (event) {
    case 'impression':
      // No-op — impressions tracked elsewhere
      break;
    case 'click':
      // Update conversion numerator estimate
      m.conversionRate = Math.min(0.5, m.conversionRate + 0.001);
      break;
    case 'add_to_cart':
      m.conversionRate = Math.min(0.5, m.conversionRate + 0.005);
      m.salesVelocity = Math.min(500, m.salesVelocity + 0.1);
      break;
    case 'purchase':
      m.conversionRate = Math.min(0.5, m.conversionRate + 0.01);
      m.salesVelocity = Math.min(500, m.salesVelocity + 1);
      m.inventoryCount = Math.max(0, m.inventoryCount - 1);
      break;
  }

  m.lastUpdated = Date.now();
}

// ── Batch metrics retrieval ─────────────────────────────────────────────────

export function getMetrics(productId: string): ProductBusinessMetrics {
  return generateMetrics(productId);
}

export function getBatchMetrics(
  products: Array<{ id: string; price?: number; category?: string }>
): Map<string, ProductBusinessMetrics> {
  const result = new Map<string, ProductBusinessMetrics>();
  for (const p of products) {
    result.set(p.id, generateMetrics(p.id, p.price, p.category));
  }
  return result;
}

// ── Store management ────────────────────────────────────────────────────────

export function getMetricsStoreSize(): number {
  return _metricsStore.size;
}

export function clearMetrics(): void {
  _metricsStore.clear();
}
