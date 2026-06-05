/**
 * Session Personalization — Real-time user preference tracking
 *
 * Tracks per-session signals: viewed categories, clicked brands, price range.
 * Used by the ranking engine to boost products matching the user's session behavior.
 *
 * Stored in-memory per browser session (survives page navigations, cleared on tab close).
 * In a production deployment this would be backed by Redis with a session TTL.
 *
 * Boost weights:
 *   - Category match: +20 (user browsed this category already)
 *   - Brand match: +25 (user clicked this brand before)
 *   - Price similarity: +15 (product is within user's observed price range)
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SessionContext {
  viewedCategories: Map<string, number>; // category → view count
  clickedBrands: Map<string, number>; // brand → click count
  priceHistory: number[]; // prices of viewed/clicked products
  recentlyViewed: string[]; // product IDs (most recent first)
  sessionStart: number; // ms timestamp
}

export interface SessionBoost {
  categoryBoost: number; // 0–20
  brandBoost: number; // 0–25
  priceBoost: number; // 0–15
  total: number; // sum, max 60
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_PRICE_HISTORY = 100;
const MAX_RECENTLY_VIEWED = 50;
const SESSION_KEY = '__dc_session_context';

// ── Session Store (in-memory, one per process/tab) ────────────────────────────

let _session: SessionContext = createFreshSession();

function createFreshSession(): SessionContext {
  return {
    viewedCategories: new Map(),
    clickedBrands: new Map(),
    priceHistory: [],
    recentlyViewed: [],
    sessionStart: Date.now(),
  };
}

// ── Persistence helpers (sessionStorage for browser) ─────────────────────────

function saveToStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    const serializable = {
      viewedCategories: Array.from(_session.viewedCategories.entries()),
      clickedBrands: Array.from(_session.clickedBrands.entries()),
      priceHistory: _session.priceHistory,
      recentlyViewed: _session.recentlyViewed,
      sessionStart: _session.sessionStart,
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(serializable));
  } catch {
    /* quota exceeded or SSR */
  }
}

function loadFromStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    _session = {
      viewedCategories: new Map(data.viewedCategories || []),
      clickedBrands: new Map(data.clickedBrands || []),
      priceHistory: data.priceHistory || [],
      recentlyViewed: data.recentlyViewed || [],
      sessionStart: data.sessionStart || Date.now(),
    };
  } catch {
    _session = createFreshSession();
  }
}

// Auto-load on module init (browser only)
if (typeof window !== 'undefined') {
  loadFromStorage();
}

// ── Public API: Recording ─────────────────────────────────────────────────────

/**
 * Record that the user viewed a product (e.g., opened product page or saw it in results).
 */
export function recordProductView(
  productId: string,
  category: string,
  brand: string,
  price: number
): void {
  // Category
  const catKey = category.toLowerCase();
  _session.viewedCategories.set(catKey, (_session.viewedCategories.get(catKey) || 0) + 1);

  // Brand
  const brandKey = brand.toLowerCase();
  _session.clickedBrands.set(brandKey, (_session.clickedBrands.get(brandKey) || 0) + 1);

  // Price
  _session.priceHistory.push(price);
  if (_session.priceHistory.length > MAX_PRICE_HISTORY) {
    _session.priceHistory = _session.priceHistory.slice(-MAX_PRICE_HISTORY);
  }

  // Recently viewed
  _session.recentlyViewed = _session.recentlyViewed.filter((id) => id !== productId);
  _session.recentlyViewed.unshift(productId);
  if (_session.recentlyViewed.length > MAX_RECENTLY_VIEWED) {
    _session.recentlyViewed = _session.recentlyViewed.slice(0, MAX_RECENTLY_VIEWED);
  }

  saveToStorage();
}

/**
 * Record a category browse (e.g., user filtered by category on products page).
 */
export function recordCategoryBrowse(category: string): void {
  const catKey = category.toLowerCase();
  _session.viewedCategories.set(catKey, (_session.viewedCategories.get(catKey) || 0) + 3);
  saveToStorage();
}

// ── Public API: Boost Computation ─────────────────────────────────────────────

/**
 * Compute the session-based boost for a product.
 */
export function getSessionBoost(category: string, brand: string, price: number): SessionBoost {
  // Category boost (0–20)
  const catCount = _session.viewedCategories.get(category.toLowerCase()) || 0;
  const categoryBoost = Math.min(20, catCount * 4); // 5 views = max 20

  // Brand boost (0–25)
  const brandCount = _session.clickedBrands.get(brand.toLowerCase()) || 0;
  const brandBoost = Math.min(25, brandCount * 5); // 5 clicks = max 25

  // Price similarity boost (0–15)
  let priceBoost = 0;
  if (_session.priceHistory.length >= 3) {
    const sorted = [..._session.priceHistory].sort((a, b) => a - b);
    const p25 = sorted[Math.floor(sorted.length * 0.25)];
    const p75 = sorted[Math.floor(sorted.length * 0.75)];
    if (price >= p25 && price <= p75) {
      priceBoost = 15; // within IQR = strong match
    } else if (price >= p25 * 0.5 && price <= p75 * 1.5) {
      priceBoost = 8; // near range
    }
  }

  return {
    categoryBoost,
    brandBoost,
    priceBoost,
    total: categoryBoost + brandBoost + priceBoost,
  };
}

// ── Public API: Getters ───────────────────────────────────────────────────────

/**
 * Get the top categories the user has browsed this session.
 */
export function getTopSessionCategories(limit = 5): string[] {
  return Array.from(_session.viewedCategories.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([cat]) => cat);
}

/**
 * Get the top brands the user has clicked this session.
 */
export function getTopSessionBrands(limit = 5): string[] {
  return Array.from(_session.clickedBrands.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([brand]) => brand);
}

/**
 * Get recently viewed product IDs.
 */
export function getRecentlyViewedIds(limit = 20): string[] {
  return _session.recentlyViewed.slice(0, limit);
}

/**
 * Get the user's observed price range (IQR).
 */
export function getSessionPriceRange(): { min: number; max: number } | null {
  if (_session.priceHistory.length < 3) return null;
  const sorted = [..._session.priceHistory].sort((a, b) => a - b);
  return {
    min: sorted[Math.floor(sorted.length * 0.25)],
    max: sorted[Math.floor(sorted.length * 0.75)],
  };
}

/**
 * Get the full session context (for the UserContext in ranking engine).
 */
export function getSessionUserContext(): {
  preferredBrands: string[];
  preferredCategories: string[];
  priceRange: { min: number; max: number } | undefined;
  recentClickBrands: string[];
} {
  const priceRange = getSessionPriceRange();
  return {
    preferredBrands: getTopSessionBrands(5),
    preferredCategories: getTopSessionCategories(5),
    priceRange: priceRange ?? undefined,
    recentClickBrands: getTopSessionBrands(3),
  };
}

/**
 * Reset the session (for testing or logout).
 */
export function clearSessionContext(): void {
  _session = createFreshSession();
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
  }
}
