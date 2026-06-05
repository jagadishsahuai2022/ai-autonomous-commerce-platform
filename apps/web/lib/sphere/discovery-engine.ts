/**
 * Discovery Engine — Intelligence layer for the 3D Category Sphere.
 *
 * Computes ranked discovery items from categories + session signals.
 * Each item is a "discovery opportunity" shown as an icon on the sphere.
 *
 * Scoring formula:
 *   score = (CTR × 0.30)
 *         + (conversionRate × 0.25)
 *         + (discountScore × 0.15)
 *         + (inventoryScore × 0.10)
 *         + (marginScore × 0.10)
 *         + (personalizationScore × 0.10)
 *
 * Item types:
 *   - category        "Electronics", "Fashion", etc.
 *   - trending        "Trending Mobiles 🔥"
 *   - deal            "Under ₹999 Deals ⚡"
 *   - personalized    "Based on your interest 🎯"
 *   - limited_stock   "Limited stock 🚨"
 *   - new_arrival     "New arrivals 🆕"
 */

import {
  getTopSessionCategories,
  getSessionPriceRange,
} from '@/lib/smart-intent/session-personalization';

// ── Types ─────────────────────────────────────────────────────────────────────

export type DiscoveryItemType =
  | 'category'
  | 'trending'
  | 'deal'
  | 'personalized'
  | 'limited_stock'
  | 'new_arrival';

export interface DiscoveryItem {
  id: string;
  type: DiscoveryItemType;
  title: string;
  shortContext?: string;
  icon: string; // category name key for icon lookup
  queryParams: Record<string, string>;
  score: number;
}

export interface CategoryInput {
  name: string;
  count: number;
}

export interface DiscoveryScoreFactors {
  ctr: number; // 0-1
  conversionRate: number; // 0-1
  discountScore: number; // 0-1
  inventoryScore: number; // 0-1
  marginScore: number; // 0-1
  personalizationScore: number; // 0-1
}

// ── Score weights ─────────────────────────────────────────────────────────────

const WEIGHTS = {
  ctr: 0.3,
  conversionRate: 0.25,
  discountScore: 0.15,
  inventoryScore: 0.1,
  marginScore: 0.1,
  personalizationScore: 0.1,
} as const;

// ── Simulated category metrics (in production, from analytics API) ────────────

const CATEGORY_METRICS: Record<
  string,
  { ctr: number; conversion: number; avgDiscount: number; stockLevel: number; margin: number }
> = {
  Electronics: { ctr: 0.12, conversion: 0.08, avgDiscount: 0.15, stockLevel: 0.85, margin: 0.12 },
  Fashion: { ctr: 0.15, conversion: 0.1, avgDiscount: 0.3, stockLevel: 0.7, margin: 0.4 },
  Groceries: { ctr: 0.2, conversion: 0.18, avgDiscount: 0.1, stockLevel: 0.95, margin: 0.15 },
  'Home & Kitchen': {
    ctr: 0.09,
    conversion: 0.06,
    avgDiscount: 0.2,
    stockLevel: 0.6,
    margin: 0.25,
  },
  Sports: { ctr: 0.08, conversion: 0.05, avgDiscount: 0.25, stockLevel: 0.75, margin: 0.3 },
  Books: { ctr: 0.07, conversion: 0.12, avgDiscount: 0.05, stockLevel: 0.9, margin: 0.5 },
  Clothing: { ctr: 0.14, conversion: 0.09, avgDiscount: 0.35, stockLevel: 0.65, margin: 0.45 },
  Shoes: { ctr: 0.11, conversion: 0.07, avgDiscount: 0.2, stockLevel: 0.55, margin: 0.35 },
  Toys: { ctr: 0.13, conversion: 0.11, avgDiscount: 0.4, stockLevel: 0.5, margin: 0.3 },
  Beauty: { ctr: 0.16, conversion: 0.13, avgDiscount: 0.15, stockLevel: 0.8, margin: 0.55 },
  Automotive: { ctr: 0.06, conversion: 0.04, avgDiscount: 0.1, stockLevel: 0.7, margin: 0.2 },
  Garden: { ctr: 0.05, conversion: 0.03, avgDiscount: 0.15, stockLevel: 0.85, margin: 0.35 },
  Health: { ctr: 0.17, conversion: 0.14, avgDiscount: 0.1, stockLevel: 0.9, margin: 0.45 },
  Music: { ctr: 0.04, conversion: 0.02, avgDiscount: 0.05, stockLevel: 0.95, margin: 0.6 },
  Movies: { ctr: 0.06, conversion: 0.03, avgDiscount: 0.2, stockLevel: 0.98, margin: 0.5 },
  Games: { ctr: 0.19, conversion: 0.15, avgDiscount: 0.35, stockLevel: 0.4, margin: 0.3 },
  Office: { ctr: 0.05, conversion: 0.06, avgDiscount: 0.1, stockLevel: 0.9, margin: 0.25 },
  Baby: { ctr: 0.1, conversion: 0.08, avgDiscount: 0.15, stockLevel: 0.75, margin: 0.35 },
  Pets: { ctr: 0.08, conversion: 0.06, avgDiscount: 0.1, stockLevel: 0.8, margin: 0.3 },
  Travel: { ctr: 0.07, conversion: 0.04, avgDiscount: 0.25, stockLevel: 0.65, margin: 0.2 },
};

const DEFAULT_METRICS = {
  ctr: 0.05,
  conversion: 0.03,
  avgDiscount: 0.1,
  stockLevel: 0.7,
  margin: 0.2,
};

// ── Score computation ─────────────────────────────────────────────────────────

export function computeDiscoveryScore(factors: DiscoveryScoreFactors): number {
  return (
    factors.ctr * WEIGHTS.ctr +
    factors.conversionRate * WEIGHTS.conversionRate +
    factors.discountScore * WEIGHTS.discountScore +
    factors.inventoryScore * WEIGHTS.inventoryScore +
    factors.marginScore * WEIGHTS.marginScore +
    factors.personalizationScore * WEIGHTS.personalizationScore
  );
}

function getPersonalizationBoost(categoryName: string): number {
  if (typeof window === 'undefined') return 0;
  try {
    const topCats = getTopSessionCategories(5);
    const idx = topCats.indexOf(categoryName.toLowerCase());
    if (idx === -1) return 0;
    // Top category = 1.0, second = 0.7, third = 0.4, etc.
    return Math.max(0, 1 - idx * 0.3);
  } catch {
    return 0;
  }
}

// ── Dynamic discovery items ──────────────────────────────────────────────────

function generateDealItems(categories: CategoryInput[]): DiscoveryItem[] {
  const priceRange = typeof window !== 'undefined' ? getSessionPriceRange() : null;
  const items: DiscoveryItem[] = [];

  // Under ₹999 deals
  items.push({
    id: 'deal-under-999',
    type: 'deal',
    title: 'Under ₹999 Deals',
    shortContext: 'Budget-friendly picks',
    icon: 'Electronics',
    queryParams: { maxPrice: '999', sort: 'price-low' },
    score: 0.75,
  });

  // Under ₹499 deals
  items.push({
    id: 'deal-under-499',
    type: 'deal',
    title: 'Under ₹499',
    shortContext: 'Super savers',
    icon: 'Groceries',
    queryParams: { maxPrice: '499', sort: 'price-low' },
    score: 0.7,
  });

  // Price range deal if user has browsing history
  if (priceRange) {
    items.push({
      id: 'deal-price-match',
      type: 'personalized',
      title: 'In Your Budget',
      shortContext: `₹${Math.round(priceRange.min)}–₹${Math.round(priceRange.max)}`,
      icon: 'Fashion',
      queryParams: {
        minPrice: String(Math.round(priceRange.min)),
        maxPrice: String(Math.round(priceRange.max)),
      },
      score: 0.85,
    });
  }

  return items;
}

function generateTrendingItems(categories: CategoryInput[]): DiscoveryItem[] {
  // Sort by count (proxy for popularity) and pick top categories
  const sorted = [...categories].sort((a, b) => b.count - a.count);
  return sorted.slice(0, 3).map((cat, i) => ({
    id: `trending-${cat.name.toLowerCase().replace(/\s+/g, '-')}`,
    type: 'trending' as DiscoveryItemType,
    title: `Trending ${cat.name}`,
    shortContext: `${cat.count.toLocaleString()}+ products`,
    icon: cat.name,
    queryParams: { category: cat.name, sort: 'relevance' },
    score: 0.8 - i * 0.05,
  }));
}

function generatePersonalizedItems(): DiscoveryItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const topCats = getTopSessionCategories(3);
    return topCats.map((cat, i) => ({
      id: `personalized-${cat}`,
      type: 'personalized' as DiscoveryItemType,
      title: `For You: ${cat.charAt(0).toUpperCase() + cat.slice(1)}`,
      shortContext: 'Based on your browsing',
      icon: cat.charAt(0).toUpperCase() + cat.slice(1),
      queryParams: { category: cat.charAt(0).toUpperCase() + cat.slice(1), sort: 'relevance' },
      score: 0.9 - i * 0.1,
    }));
  } catch {
    return [];
  }
}

function generateLimitedStockItems(categories: CategoryInput[]): DiscoveryItem[] {
  // Pick categories with relatively lower stock (lower count)
  const sorted = [...categories].sort((a, b) => a.count - b.count);
  return sorted.slice(0, 2).map((cat, i) => ({
    id: `limited-${cat.name.toLowerCase().replace(/\s+/g, '-')}`,
    type: 'limited_stock' as DiscoveryItemType,
    title: `Limited: ${cat.name}`,
    shortContext: 'Selling fast',
    icon: cat.name,
    queryParams: { category: cat.name, sort: 'relevance' },
    score: 0.65 - i * 0.05,
  }));
}

function generateNewArrivalItems(categories: CategoryInput[]): DiscoveryItem[] {
  // Rotate which categories show "new arrivals" based on day of week
  const dayOffset = new Date().getDay();
  const picked = categories.slice(
    dayOffset % categories.length,
    (dayOffset % categories.length) + 2
  );
  return picked.map((cat, i) => ({
    id: `new-${cat.name.toLowerCase().replace(/\s+/g, '-')}`,
    type: 'new_arrival' as DiscoveryItemType,
    title: `New: ${cat.name}`,
    shortContext: 'Just arrived',
    icon: cat.name,
    queryParams: { category: cat.name, sort: 'newest' },
    score: 0.6 - i * 0.05,
  }));
}

// ── Main Engine ──────────────────────────────────────────────────────────────

/**
 * Generate ranked discovery items for the sphere.
 * Combines category items + dynamic discovery items, scored and sorted.
 */
export function generateDiscoveryItems(categories: CategoryInput[]): DiscoveryItem[] {
  if (categories.length === 0) return [];

  const items: DiscoveryItem[] = [];

  // 1. Category items (base)
  for (const cat of categories) {
    const m = CATEGORY_METRICS[cat.name] ?? DEFAULT_METRICS;
    const personalization = getPersonalizationBoost(cat.name);

    const score = computeDiscoveryScore({
      ctr: m.ctr,
      conversionRate: m.conversion,
      discountScore: m.avgDiscount,
      inventoryScore: m.stockLevel,
      marginScore: m.margin,
      personalizationScore: personalization,
    });

    items.push({
      id: `cat-${cat.name.toLowerCase().replace(/\s+/g, '-')}`,
      type: 'category',
      title: cat.name,
      shortContext: `${cat.count.toLocaleString()} products`,
      icon: cat.name,
      queryParams: { category: cat.name },
      score,
    });
  }

  // 2. Dynamic discovery items
  items.push(...generateTrendingItems(categories));
  items.push(...generateDealItems(categories));
  items.push(...generatePersonalizedItems());
  items.push(...generateLimitedStockItems(categories));
  items.push(...generateNewArrivalItems(categories));

  // Sort by score descending
  items.sort((a, b) => b.score - a.score);

  return items;
}

/**
 * Get the type-specific icon key mapping for discovery item types.
 * Used when a discovery item's icon doesn't match a known category.
 */
export function getDiscoveryTypeIcon(type: DiscoveryItemType): string {
  switch (type) {
    case 'trending':
      return 'Electronics';
    case 'deal':
      return 'Groceries';
    case 'personalized':
      return 'Fashion';
    case 'limited_stock':
      return 'Toys';
    case 'new_arrival':
      return 'Books';
    case 'category':
    default:
      return 'Electronics';
  }
}

/**
 * Get a discovery type label with emoji for tooltip display.
 */
export function getDiscoveryTypeLabel(type: DiscoveryItemType): string {
  switch (type) {
    case 'trending':
      return '🔥 Trending';
    case 'deal':
      return '⚡ Deal';
    case 'personalized':
      return '🎯 For You';
    case 'limited_stock':
      return '🚨 Limited';
    case 'new_arrival':
      return '🆕 New';
    case 'category':
    default:
      return '📦 Category';
  }
}
