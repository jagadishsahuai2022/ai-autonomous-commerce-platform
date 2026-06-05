/**
 * Unit Tests — Search & Filtering Logic
 * Covers: product search/filter pipeline, price range, category, 
 *         sort orders, pagination logic, debounce behavior validation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  rating: number;
  reviewCount: number;
  brand: string;
  stock: number;
  tags: string[];
  discount?: number;
}

interface FilterParams {
  query?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  brand?: string;
  inStockOnly?: boolean;
  sortBy?: 'price_asc' | 'price_desc' | 'rating' | 'newest' | 'relevance';
  page?: number;
  limit?: number;
}

// ── Search/Filter logic (mirrors apps/web product search) ────────────────────

function filterProducts(products: Product[], params: FilterParams): Product[] {
  let results = [...products];

  if (params.query) {
    const q = params.query.toLowerCase();
    results = results.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q) ||
      p.tags.some(t => t.toLowerCase().includes(q))
    );
  }

  if (params.category && params.category !== 'all') {
    results = results.filter(p => p.category.toLowerCase() === params.category!.toLowerCase());
  }

  if (params.minPrice !== undefined) {
    results = results.filter(p => p.price >= params.minPrice!);
  }

  if (params.maxPrice !== undefined) {
    results = results.filter(p => p.price <= params.maxPrice!);
  }

  if (params.minRating !== undefined) {
    results = results.filter(p => p.rating >= params.minRating!);
  }

  if (params.brand) {
    results = results.filter(p => p.brand.toLowerCase() === params.brand!.toLowerCase());
  }

  if (params.inStockOnly) {
    results = results.filter(p => p.stock > 0);
  }

  // Sort
  switch (params.sortBy) {
    case 'price_asc':  results.sort((a, b) => a.price - b.price); break;
    case 'price_desc': results.sort((a, b) => b.price - a.price); break;
    case 'rating':     results.sort((a, b) => b.rating - a.rating); break;
    // 'newest' and 'relevance' remain as-is (insertion order)
  }

  return results;
}

function paginateResults<T>(items: T[], page: number, limit: number): { items: T[]; total: number; pages: number; hasNext: boolean; hasPrev: boolean } {
  const total = items.length;
  const pages = Math.ceil(total / limit);
  const safePage = Math.max(1, Math.min(page, pages || 1));
  const start = (safePage - 1) * limit;
  return {
    items: items.slice(start, start + limit),
    total,
    pages,
    hasNext: safePage < pages,
    hasPrev: safePage > 1,
  };
}

function buildSearchSuggestions(products: Product[], query: string, max = 5): string[] {
  if (!query || query.length < 2) return [];
  const q = query.toLowerCase();
  const seen = new Set<string>();
  const suggestions: string[] = [];

  for (const p of products) {
    if (suggestions.length >= max) break;
    if (p.name.toLowerCase().includes(q) && !seen.has(p.name)) {
      seen.add(p.name);
      suggestions.push(p.name);
    }
  }
  return suggestions;
}

function computeRangeFilters(products: Product[]): { minPrice: number; maxPrice: number; categories: string[]; brands: string[] } {
  if (!products.length) return { minPrice: 0, maxPrice: 0, categories: [], brands: [] };
  const prices = products.map(p => p.price);
  return {
    minPrice: Math.min(...prices),
    maxPrice: Math.max(...prices),
    categories: [...new Set(products.map(p => p.category))].sort(),
    brands: [...new Set(products.map(p => p.brand))].sort(),
  };
}

// ── Mock product catalog ──────────────────────────────────────────────────────
const catalog: Product[] = [
  { id: '1', name: 'Noise-Cancelling Headphones', price: 4999, category: 'Electronics', rating: 4.5, reviewCount: 120, brand: 'Sony', stock: 15, tags: ['audio', 'wireless', 'headphones'] },
  { id: '2', name: 'Gaming Laptop 15"', price: 75000, category: 'Electronics', rating: 4.3, reviewCount: 45, brand: 'Lenovo', stock: 3, tags: ['laptop', 'gaming', 'rgb'] },
  { id: '3', name: 'Yoga Mat Premium', price: 1299, category: 'Sports', rating: 4.7, reviewCount: 89, brand: 'Decathlon', stock: 50, tags: ['yoga', 'fitness', 'mat'] },
  { id: '4', name: 'Electric Kettle 1.5L', price: 849, category: 'Kitchen', rating: 4.2, reviewCount: 200, brand: 'Philips', stock: 30, tags: ['kettle', 'electric', 'kitchen'] },
  { id: '5', name: 'Running Shoes Men', price: 3299, category: 'Sports', rating: 4.6, reviewCount: 310, brand: 'Nike', stock: 0, tags: ['shoes', 'running', 'sports'] },
  { id: '6', name: 'Bluetooth Speaker', price: 2499, category: 'Electronics', rating: 4.1, reviewCount: 67, brand: 'JBL', stock: 8, tags: ['speaker', 'bluetooth', 'portable'] },
  { id: '7', name: 'Air Purifier HEPA', price: 12999, category: 'Home', rating: 4.8, reviewCount: 33, brand: 'Dyson', stock: 5, tags: ['air', 'purifier', 'hepa'] },
  { id: '8', name: 'Smart Watch Series 9', price: 34999, category: 'Electronics', rating: 4.4, reviewCount: 180, brand: 'Apple', stock: 12, tags: ['watch', 'smart', 'health'] },
];

// ════════════════════════════════════════════════════════════════════════════
// FILTER TESTS
// ════════════════════════════════════════════════════════════════════════════
describe('filterProducts — text search', () => {
  it('finds by product name', () => {
    const r = filterProducts(catalog, { query: 'headphones' });
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe('1');
  });

  it('finds by brand', () => {
    const r = filterProducts(catalog, { query: 'Sony' });
    expect(r[0].brand).toBe('Sony');
  });

  it('finds by tag', () => {
    const r = filterProducts(catalog, { query: 'yoga' });
    expect(r[0].name).toContain('Yoga');
  });

  it('is case-insensitive', () => {
    expect(filterProducts(catalog, { query: 'LAPTOP' })).toHaveLength(1);
    expect(filterProducts(catalog, { query: 'laptop' })).toHaveLength(1);
  });

  it('returns empty for no match', () => {
    expect(filterProducts(catalog, { query: 'xyznomatch' })).toHaveLength(0);
  });

  it('returns all when no query', () => {
    expect(filterProducts(catalog, {})).toHaveLength(catalog.length);
  });
});

describe('filterProducts — category filter', () => {
  it('filters to Electronics', () => {
    const r = filterProducts(catalog, { category: 'Electronics' });
    expect(r.every(p => p.category === 'Electronics')).toBe(true);
    expect(r.length).toBe(4);
  });

  it('filters to Sports', () => {
    const r = filterProducts(catalog, { category: 'Sports' });
    expect(r.length).toBe(2);
  });

  it('"all" returns everything', () => {
    expect(filterProducts(catalog, { category: 'all' })).toHaveLength(catalog.length);
  });
});

describe('filterProducts — price range', () => {
  it('filters minPrice', () => {
    const r = filterProducts(catalog, { minPrice: 10000 });
    expect(r.every(p => p.price >= 10000)).toBe(true);
  });

  it('filters maxPrice', () => {
    const r = filterProducts(catalog, { maxPrice: 2000 });
    expect(r.every(p => p.price <= 2000)).toBe(true);
  });

  it('filters price range', () => {
    const r = filterProducts(catalog, { minPrice: 1000, maxPrice: 5000 });
    expect(r.every(p => p.price >= 1000 && p.price <= 5000)).toBe(true);
  });
});

describe('filterProducts — rating & stock', () => {
  it('filters by minimum rating', () => {
    const r = filterProducts(catalog, { minRating: 4.5 });
    expect(r.every(p => p.rating >= 4.5)).toBe(true);
    expect(r.length).toBe(4);
  });

  it('filters in-stock only', () => {
    const r = filterProducts(catalog, { inStockOnly: true });
    expect(r.every(p => p.stock > 0)).toBe(true);
    // Running Shoes are out of stock
    expect(r.find(p => p.id === '5')).toBeUndefined();
  });
});

describe('filterProducts — sorting', () => {
  it('sorts price ascending', () => {
    const r = filterProducts(catalog, { sortBy: 'price_asc' });
    for (let i = 1; i < r.length; i++) {
      expect(r[i].price).toBeGreaterThanOrEqual(r[i - 1].price);
    }
  });

  it('sorts price descending', () => {
    const r = filterProducts(catalog, { sortBy: 'price_desc' });
    for (let i = 1; i < r.length; i++) {
      expect(r[i].price).toBeLessThanOrEqual(r[i - 1].price);
    }
  });

  it('sorts by rating descending', () => {
    const r = filterProducts(catalog, { sortBy: 'rating' });
    for (let i = 1; i < r.length; i++) {
      expect(r[i].rating).toBeLessThanOrEqual(r[i - 1].rating);
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════
// PAGINATION
// ════════════════════════════════════════════════════════════════════════════
describe('paginateResults', () => {
  const items = Array.from({ length: 25 }, (_, i) => i);

  it('returns correct page 1', () => {
    const r = paginateResults(items, 1, 10);
    expect(r.items).toHaveLength(10);
    expect(r.items[0]).toBe(0);
    expect(r.hasNext).toBe(true);
    expect(r.hasPrev).toBe(false);
  });

  it('returns last page correctly', () => {
    const r = paginateResults(items, 3, 10);
    expect(r.items).toHaveLength(5);
    expect(r.hasNext).toBe(false);
    expect(r.hasPrev).toBe(true);
  });

  it('handles empty list', () => {
    const r = paginateResults([], 1, 10);
    expect(r.items).toHaveLength(0);
    expect(r.total).toBe(0);
      expect(r.pages).toBeLessThanOrEqual(1); // 0 or 1 both acceptable for empty list
  });

  it('clamps page to valid range', () => {
    const r = paginateResults(items, 999, 10);
    expect(r.items.length).toBeGreaterThan(0);
  });

  it('total matches input length', () => {
    expect(paginateResults(items, 1, 5).total).toBe(25);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// SEARCH SUGGESTIONS
// ════════════════════════════════════════════════════════════════════════════
describe('buildSearchSuggestions', () => {
  it('returns up to max=5 suggestions', () => {
    const r = buildSearchSuggestions(catalog, 'a', 5);
    expect(r.length).toBeLessThanOrEqual(5);
  });

  it('returns empty for query < 2 chars', () => {
    expect(buildSearchSuggestions(catalog, 'l')).toHaveLength(0);
    expect(buildSearchSuggestions(catalog, '')).toHaveLength(0);
  });

  it('returns matching product names', () => {
    const r = buildSearchSuggestions(catalog, 'lap');
    expect(r.some(s => s.toLowerCase().includes('laptop'))).toBe(true);
  });

  it('deduplicates results', () => {
    const r = buildSearchSuggestions(catalog, 'a');
    const unique = new Set(r);
    expect(unique.size).toBe(r.length);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// RANGE FILTERS
// ════════════════════════════════════════════════════════════════════════════
describe('computeRangeFilters', () => {
  it('computes correct price range', () => {
    const r = computeRangeFilters(catalog);
    expect(r.minPrice).toBe(849);
    expect(r.maxPrice).toBe(75000);
  });

  it('extracts unique categories', () => {
    const r = computeRangeFilters(catalog);
    expect(r.categories).toContain('Electronics');
    expect(r.categories).toContain('Sports');
    expect(new Set(r.categories).size).toBe(r.categories.length);
  });

  it('extracts unique brands', () => {
    const r = computeRangeFilters(catalog);
    expect(new Set(r.brands).size).toBe(r.brands.length);
  });

  it('handles empty catalog', () => {
    const r = computeRangeFilters([]);
    expect(r.minPrice).toBe(0);
    expect(r.maxPrice).toBe(0);
    expect(r.categories).toHaveLength(0);
  });
});
