/**
 * Smart Intent Engine — Feedback Loop Tracker (Phase 8)
 *
 * Tracks user interactions (clicks, add-to-cart, purchases, ignores) to build
 * a UserBehavior signal that can boost ranked products in repeat searches.
 *
 * All data is in-memory (per-process). A production implementation would
 * persist to a UserBehavior table in the database.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type FeedbackEventType =
  | 'click' // user clicked on a product card
  | 'add_to_cart' // user added to cart
  | 'purchase' // user completed purchase
  | 'ignored' // product was shown but not interacted with
  | 'dismiss'; // user explicitly dismissed the product

export interface UserBehaviorEvent {
  productId: string;
  category: string;
  brand: string;
  price: number;
  eventType: FeedbackEventType;
  timestamp: number;
  query: string;
}

export interface ProductSignal {
  productId: string;
  score: number; // computed boost score (-10 to +15)
  clickCount: number;
  cartCount: number;
  purchaseCount: number;
  ignoredCount: number;
  lastSeen: number;
}

// ── Event weights ─────────────────────────────────────────────────────────────

const EVENT_WEIGHTS: Record<FeedbackEventType, number> = {
  purchase: 15, // strongest positive signal
  add_to_cart: 8, // strong positive
  click: 3, // mild positive
  ignored: -1, // slight negative (was shown but skipped)
  dismiss: -3, // negative (user actively rejected)
};

// ── In-memory store ───────────────────────────────────────────────────────────

const _behaviorLog: UserBehaviorEvent[] = [];
const _productSignals = new Map<string, ProductSignal>();
const MAX_LOG_ENTRIES = 10000; // cap to prevent memory leak

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Record a user interaction event for a product.
 */
export function recordFeedbackEvent(
  productId: string,
  category: string,
  brand: string,
  price: number,
  eventType: FeedbackEventType,
  query: string
): void {
  const event: UserBehaviorEvent = {
    productId,
    category,
    brand,
    price,
    eventType,
    timestamp: Date.now(),
    query: query.toLowerCase().trim(),
  };

  // Append to log with cap
  _behaviorLog.push(event);
  if (_behaviorLog.length > MAX_LOG_ENTRIES) {
    _behaviorLog.shift(); // remove oldest
  }

  // Update aggregate signal
  updateProductSignal(productId, eventType);
}

function updateProductSignal(productId: string, eventType: FeedbackEventType): void {
  const existing = _productSignals.get(productId) ?? {
    productId,
    score: 0,
    clickCount: 0,
    cartCount: 0,
    purchaseCount: 0,
    ignoredCount: 0,
    lastSeen: Date.now(),
  };

  const updated: ProductSignal = { ...existing, lastSeen: Date.now() };

  switch (eventType) {
    case 'click':
      updated.clickCount++;
      break;
    case 'add_to_cart':
      updated.cartCount++;
      break;
    case 'purchase':
      updated.purchaseCount++;
      break;
    case 'ignored':
      updated.ignoredCount++;
      break;
    case 'dismiss':
      updated.ignoredCount++;
      break;
  }

  // Recompute score with decay — recent events matter more
  const rawScore = EVENT_WEIGHTS[eventType] + existing.score;
  // Apply decay: score drifts toward 0 over time (24h half-life)
  const ageMs = Date.now() - existing.lastSeen;
  const halfLifeMs = 24 * 60 * 60 * 1000;
  const decayFactor = Math.pow(0.5, ageMs / halfLifeMs);
  updated.score = Math.max(
    -10,
    Math.min(15, Math.round(existing.score * decayFactor + rawScore * 0.3))
  );

  _productSignals.set(productId, updated);
}

/**
 * Get the feedback boost score for a product (used in ranking).
 * Returns a score in range -10 to +15.
 */
export function getFeedbackBoost(productId: string): number {
  return _productSignals.get(productId)?.score ?? 0;
}

/**
 * Get signals for a list of product IDs (batch lookup for ranking).
 */
export function getBatchFeedbackBoosts(productIds: string[]): Map<string, number> {
  const result = new Map<string, number>();
  for (const id of productIds) {
    const signal = _productSignals.get(id);
    if (signal) result.set(id, signal.score);
  }
  return result;
}

/**
 * Record that products were shown but not interacted with (bulk ignored signal).
 * Call after returning search results — pass IDs of products that were NOT clicked.
 */
export function recordIgnoredProducts(
  shownProductIds: string[],
  clickedProductId: string | null,
  category: string,
  query: string
): void {
  for (const id of shownProductIds) {
    if (id !== clickedProductId) {
      recordFeedbackEvent(id, category, '', 0, 'ignored', query);
    }
  }
}

/**
 * Get recent behavior events (for debugging or monitoring dashboard).
 */
export function getRecentFeedbackEvents(limit = 50): UserBehaviorEvent[] {
  return _behaviorLog.slice(-limit);
}

/**
 * Get top signals (products with highest feedback scores).
 */
export function getTopProductSignals(limit = 20): ProductSignal[] {
  return Array.from(_productSignals.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Clear all feedback state (useful for testing).
 */
export function clearFeedbackState(): void {
  _behaviorLog.length = 0;
  _productSignals.clear();
}
