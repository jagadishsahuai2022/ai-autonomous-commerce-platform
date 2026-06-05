/**
 * Vitest unit tests for the Discovery Engine.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  computeDiscoveryScore,
  generateDiscoveryItems,
  getDiscoveryTypeIcon,
  getDiscoveryTypeLabel,
} from '@/lib/sphere/discovery-engine';
import type { DiscoveryScoreFactors, CategoryInput } from '@/lib/sphere/discovery-engine';

// Mock session-personalization to avoid sessionStorage issues in test
vi.mock('@/lib/smart-intent/session-personalization', () => ({
  getTopSessionCategories: () => ['electronics', 'fashion'],
  getSessionPriceRange: () => ({ min: 500, max: 5000 }),
}));

const CATEGORIES: CategoryInput[] = [
  { name: 'Electronics', count: 40000 },
  { name: 'Fashion', count: 30000 },
  { name: 'Groceries', count: 15000 },
  { name: 'Home & Kitchen', count: 10000 },
  { name: 'Sports', count: 3000 },
  { name: 'Books', count: 2000 },
];

describe('computeDiscoveryScore', () => {
  it('returns 0 for all-zero factors', () => {
    const factors: DiscoveryScoreFactors = {
      ctr: 0,
      conversionRate: 0,
      discountScore: 0,
      inventoryScore: 0,
      marginScore: 0,
      personalizationScore: 0,
    };
    expect(computeDiscoveryScore(factors)).toBe(0);
  });

  it('returns 1 for all-one factors', () => {
    const factors: DiscoveryScoreFactors = {
      ctr: 1,
      conversionRate: 1,
      discountScore: 1,
      inventoryScore: 1,
      marginScore: 1,
      personalizationScore: 1,
    };
    expect(computeDiscoveryScore(factors)).toBeCloseTo(1, 5);
  });

  it('weights CTR highest (0.30)', () => {
    const ctrOnly: DiscoveryScoreFactors = {
      ctr: 1,
      conversionRate: 0,
      discountScore: 0,
      inventoryScore: 0,
      marginScore: 0,
      personalizationScore: 0,
    };
    expect(computeDiscoveryScore(ctrOnly)).toBeCloseTo(0.3, 5);
  });

  it('weights conversion second (0.25)', () => {
    const convOnly: DiscoveryScoreFactors = {
      ctr: 0,
      conversionRate: 1,
      discountScore: 0,
      inventoryScore: 0,
      marginScore: 0,
      personalizationScore: 0,
    };
    expect(computeDiscoveryScore(convOnly)).toBeCloseTo(0.25, 5);
  });

  it('computes weighted sum correctly', () => {
    const factors: DiscoveryScoreFactors = {
      ctr: 0.5,
      conversionRate: 0.4,
      discountScore: 0.3,
      inventoryScore: 0.8,
      marginScore: 0.6,
      personalizationScore: 0.7,
    };
    const expected = 0.5 * 0.3 + 0.4 * 0.25 + 0.3 * 0.15 + 0.8 * 0.1 + 0.6 * 0.1 + 0.7 * 0.1;
    expect(computeDiscoveryScore(factors)).toBeCloseTo(expected, 5);
  });
});

describe('generateDiscoveryItems', () => {
  it('returns empty array for empty categories', () => {
    expect(generateDiscoveryItems([])).toEqual([]);
  });

  it('generates items for all categories', () => {
    const items = generateDiscoveryItems(CATEGORIES);
    expect(items.length).toBeGreaterThan(CATEGORIES.length);
  });

  it('includes category-type items', () => {
    const items = generateDiscoveryItems(CATEGORIES);
    const catItems = items.filter((i) => i.type === 'category');
    expect(catItems.length).toBe(CATEGORIES.length);
  });

  it('includes trending items', () => {
    const items = generateDiscoveryItems(CATEGORIES);
    const trending = items.filter((i) => i.type === 'trending');
    expect(trending.length).toBeGreaterThanOrEqual(1);
  });

  it('includes deal items', () => {
    const items = generateDiscoveryItems(CATEGORIES);
    const deals = items.filter((i) => i.type === 'deal');
    expect(deals.length).toBeGreaterThanOrEqual(1);
  });

  it('items are sorted by score descending', () => {
    const items = generateDiscoveryItems(CATEGORIES);
    for (let i = 1; i < items.length; i++) {
      expect(items[i - 1].score).toBeGreaterThanOrEqual(items[i].score);
    }
  });

  it('each item has required fields', () => {
    const items = generateDiscoveryItems(CATEGORIES);
    for (const item of items) {
      expect(item.id).toBeTruthy();
      expect(item.type).toBeTruthy();
      expect(item.title).toBeTruthy();
      expect(item.icon).toBeTruthy();
      expect(typeof item.score).toBe('number');
      expect(item.queryParams).toBeDefined();
    }
  });

  it('category items have correct queryParams', () => {
    const items = generateDiscoveryItems(CATEGORIES);
    const electronicsItem = items.find((i) => i.type === 'category' && i.title === 'Electronics');
    expect(electronicsItem?.queryParams.category).toBe('Electronics');
  });

  it('deal items have price-related queryParams', () => {
    const items = generateDiscoveryItems(CATEGORIES);
    const under999 = items.find((i) => i.id === 'deal-under-999');
    expect(under999?.queryParams.maxPrice).toBe('999');
  });

  it('scores are between 0 and 1', () => {
    const items = generateDiscoveryItems(CATEGORIES);
    for (const item of items) {
      expect(item.score).toBeGreaterThanOrEqual(0);
      expect(item.score).toBeLessThanOrEqual(1);
    }
  });
});

describe('getDiscoveryTypeIcon', () => {
  it('returns valid icon for trending', () => {
    expect(getDiscoveryTypeIcon('trending')).toBeTruthy();
  });

  it('returns valid icon for deal', () => {
    expect(getDiscoveryTypeIcon('deal')).toBeTruthy();
  });

  it('returns default for category', () => {
    expect(getDiscoveryTypeIcon('category')).toBeTruthy();
  });
});

describe('getDiscoveryTypeLabel', () => {
  it('returns trending label with emoji', () => {
    expect(getDiscoveryTypeLabel('trending')).toContain('Trending');
  });

  it('returns deal label with emoji', () => {
    expect(getDiscoveryTypeLabel('deal')).toContain('Deal');
  });

  it('returns personalized label', () => {
    expect(getDiscoveryTypeLabel('personalized')).toContain('For You');
  });

  it('returns limited stock label', () => {
    expect(getDiscoveryTypeLabel('limited_stock')).toContain('Limited');
  });

  it('returns new arrival label', () => {
    expect(getDiscoveryTypeLabel('new_arrival')).toContain('New');
  });

  it('returns category label as default', () => {
    expect(getDiscoveryTypeLabel('category')).toContain('Category');
  });
});
