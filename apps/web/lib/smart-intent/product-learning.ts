/**
 * Product Learning — Reinforcement-style ranking boosts
 *
 * Tracks product-level signals: impressions, clicks, add-to-cart, purchases.
 * Computes a CTR-based boost that feeds into the ranking engine.
 *
 * All data is in-memory per-process. A production deployment would persist
 * to a ProductLearning table with periodic snapshots.
 *
 * Boost formula: (ctr × 10) + (cartAdds × 2) + (purchases × 5)
 * Daily decay: 10% — all counters are multiplied by 0.9 every 24h.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ProductLearningRecord {
  productId: string;
  impressions: number;
  clicks: number;
  cartAdds: number;
  purchases: number;
  ctr: number; // clicks / impressions (0–1)
  boost: number; // computed ranking boost
  lastUpdated: number; // ms timestamp
  lastDecayed: number; // ms timestamp of last decay application
}

export type LearningEventType = 'impression' | 'click' | 'add_to_cart' | 'purchase';

// ── Constants ─────────────────────────────────────────────────────────────────

const DECAY_RATE = 0.9; // 10% daily decay
const DECAY_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_BOOST = 50; // cap to prevent runaway boosts
const MAX_RECORDS = 50000;

// ── In-memory store ───────────────────────────────────────────────────────────

const _learningStore = new Map<string, ProductLearningRecord>();
let _lastGlobalDecay = Date.now();

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeBoost(rec: ProductLearningRecord): number {
  const ctr = rec.impressions > 0 ? rec.clicks / rec.impressions : 0;
  const raw = ctr * 10 + rec.cartAdds * 2 + rec.purchases * 5;
  return Math.min(MAX_BOOST, Math.round(raw * 100) / 100);
}

function applyDecay(rec: ProductLearningRecord): ProductLearningRecord {
  const now = Date.now();
  const elapsed = now - rec.lastDecayed;
  if (elapsed < DECAY_INTERVAL_MS) return rec;

  const periods = Math.floor(elapsed / DECAY_INTERVAL_MS);
  const factor = Math.pow(DECAY_RATE, periods);

  const updated: ProductLearningRecord = {
    ...rec,
    impressions: Math.round(rec.impressions * factor),
    clicks: Math.round(rec.clicks * factor),
    cartAdds: Math.round(rec.cartAdds * factor),
    purchases: Math.round(rec.purchases * factor),
    lastDecayed: now,
    ctr: 0,
    boost: 0,
  };
  updated.ctr = updated.impressions > 0 ? updated.clicks / updated.impressions : 0;
  updated.boost = computeBoost(updated);
  return updated;
}

function getOrCreate(productId: string): ProductLearningRecord {
  let rec = _learningStore.get(productId);
  if (!rec) {
    rec = {
      productId,
      impressions: 0,
      clicks: 0,
      cartAdds: 0,
      purchases: 0,
      ctr: 0,
      boost: 0,
      lastUpdated: Date.now(),
      lastDecayed: Date.now(),
    };
    // Evict oldest if at capacity
    if (_learningStore.size >= MAX_RECORDS) {
      const oldest = Array.from(_learningStore.entries()).sort(
        (a, b) => a[1].lastUpdated - b[1].lastUpdated
      )[0];
      if (oldest) _learningStore.delete(oldest[0]);
    }
    _learningStore.set(productId, rec);
  }
  return applyDecay(rec);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Record a learning event for a product.
 */
export function recordLearningEvent(productId: string, eventType: LearningEventType): void {
  const rec = getOrCreate(productId);
  const now = Date.now();

  switch (eventType) {
    case 'impression':
      rec.impressions++;
      break;
    case 'click':
      rec.clicks++;
      break;
    case 'add_to_cart':
      rec.cartAdds++;
      break;
    case 'purchase':
      rec.purchases++;
      break;
  }

  rec.lastUpdated = now;
  rec.ctr = rec.impressions > 0 ? rec.clicks / rec.impressions : 0;
  rec.boost = computeBoost(rec);
  _learningStore.set(productId, rec);
}

/**
 * Record impressions for a batch of product IDs (call when search results are shown).
 */
export function recordImpressions(productIds: string[]): void {
  for (const id of productIds) {
    recordLearningEvent(id, 'impression');
  }
}

/**
 * Get the learning boost for a single product.
 */
export function getLearningBoost(productId: string): number {
  const rec = _learningStore.get(productId);
  if (!rec) return 0;
  return applyDecay(rec).boost;
}

/**
 * Get learning boosts for a batch of products (used in ranking).
 */
export function getBatchLearningBoosts(productIds: string[]): Map<string, number> {
  const result = new Map<string, number>();
  for (const id of productIds) {
    const rec = _learningStore.get(id);
    if (rec) {
      result.set(id, applyDecay(rec).boost);
    }
  }
  return result;
}

/**
 * Get top products by learning boost (for trending sections).
 */
export function getTrendingProducts(limit = 20): ProductLearningRecord[] {
  applyGlobalDecay();
  return Array.from(_learningStore.values())
    .map(applyDecay)
    .sort((a, b) => b.boost - a.boost)
    .slice(0, limit);
}

/**
 * Get the full learning record for a product (for debugging).
 */
export function getLearningRecord(productId: string): ProductLearningRecord | null {
  const rec = _learningStore.get(productId);
  return rec ? applyDecay(rec) : null;
}

/**
 * Apply global decay across all records (called periodically).
 */
function applyGlobalDecay(): void {
  const now = Date.now();
  if (now - _lastGlobalDecay < DECAY_INTERVAL_MS) return;

  for (const [id, rec] of _learningStore) {
    _learningStore.set(id, applyDecay(rec));
  }
  _lastGlobalDecay = now;
}

/**
 * Get aggregate stats for monitoring.
 */
export function getLearningStats(): {
  totalProducts: number;
  totalImpressions: number;
  totalClicks: number;
  averageCTR: number;
} {
  let totalImpressions = 0;
  let totalClicks = 0;
  for (const rec of _learningStore.values()) {
    totalImpressions += rec.impressions;
    totalClicks += rec.clicks;
  }
  return {
    totalProducts: _learningStore.size,
    totalImpressions,
    totalClicks,
    averageCTR: totalImpressions > 0 ? totalClicks / totalImpressions : 0,
  };
}

/**
 * Clear all learning data (for testing).
 */
export function clearLearningState(): void {
  _learningStore.clear();
  _lastGlobalDecay = Date.now();
}
