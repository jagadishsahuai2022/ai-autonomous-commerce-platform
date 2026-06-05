/**
 * Unit tests for Zustand product-page-store
 * Tests filter/scroll persistence and hydration
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock sessionStorage
const store: Record<string, string> = {};
const mockSessionStorage = {
  getItem: vi.fn((key: string) => store[key] || null),
  setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
  removeItem: vi.fn((key: string) => { delete store[key]; }),
  clear: vi.fn(() => { Object.keys(store).forEach(k => delete store[k]); }),
  length: 0,
  key: vi.fn(() => null),
};

Object.defineProperty(global, 'sessionStorage', { value: mockSessionStorage, writable: true });
Object.defineProperty(global, 'window', {
  value: { sessionStorage: mockSessionStorage },
  writable: true,
});

describe('Product Page Store', () => {
  beforeEach(() => {
    mockSessionStorage.clear();
    vi.resetModules();
  });

  it('should import without errors', async () => {
    const mod = await import('../../lib/stores/product-page-store');
    expect(mod.useProductPageStore).toBeDefined();
  });

  it('should have correct initial state', async () => {
    const { useProductPageStore } = await import('../../lib/stores/product-page-store');
    const state = useProductPageStore.getState();
    expect(state.searchQuery).toBe('');
    expect(state.sortBy).toBe('relevance');
    expect(state.filterState).toBeNull();
    expect(state.scrollY).toBe(0);
    expect(state.sphereCategory).toBe('');
    expect(state.hasHydrated).toBe(false);
  });

  it('should set search query', async () => {
    const { useProductPageStore } = await import('../../lib/stores/product-page-store');
    useProductPageStore.getState().setSearchQuery('Sony headphones');
    expect(useProductPageStore.getState().searchQuery).toBe('Sony headphones');
  });

  it('should set sort by option', async () => {
    const { useProductPageStore } = await import('../../lib/stores/product-page-store');
    useProductPageStore.getState().setSortBy('price-low');
    expect(useProductPageStore.getState().sortBy).toBe('price-low');
  });

  it('should set filter state', async () => {
    const { useProductPageStore } = await import('../../lib/stores/product-page-store');
    const filters = { priceMin: 1000, priceMax: 5000, rating: 4 };
    useProductPageStore.getState().setFilterState(filters);
    expect(useProductPageStore.getState().filterState).toEqual(filters);
  });

  it('should set scroll position', async () => {
    const { useProductPageStore } = await import('../../lib/stores/product-page-store');
    useProductPageStore.getState().setScrollY(500);
    expect(useProductPageStore.getState().scrollY).toBe(500);
  });

  it('should set sphere category', async () => {
    const { useProductPageStore } = await import('../../lib/stores/product-page-store');
    useProductPageStore.getState().setSphereCategory('electronics');
    expect(useProductPageStore.getState().sphereCategory).toBe('electronics');
  });

  it('should reset all state', async () => {
    const { useProductPageStore } = await import('../../lib/stores/product-page-store');
    useProductPageStore.getState().setSearchQuery('test');
    useProductPageStore.getState().setSortBy('price-high');
    useProductPageStore.getState().setScrollY(999);
    useProductPageStore.getState().resetAll();

    const state = useProductPageStore.getState();
    expect(state.searchQuery).toBe('');
    expect(state.sortBy).toBe('relevance');
    expect(state.scrollY).toBe(0);
    expect(state.filterState).toBeNull();
  });

  it('should persist to sessionStorage on state change', async () => {
    const { useProductPageStore } = await import('../../lib/stores/product-page-store');
    useProductPageStore.getState().setSearchQuery('laptop');
    
    expect(mockSessionStorage.setItem).toHaveBeenCalled();
    const storedData = store['dc-product-page-store'];
    expect(storedData).toBeDefined();
    const parsed = JSON.parse(storedData);
    expect(parsed.searchQuery).toBe('laptop');
  });

  it('should hydrate from sessionStorage', async () => {
    // Pre-populate sessionStorage
    store['dc-product-page-store'] = JSON.stringify({
      searchQuery: 'saved query',
      sortBy: 'price-low',
      filterState: { rating: 3 },
      scrollY: 250,
      sphereCategory: 'fashion',
    });

    const { useProductPageStore } = await import('../../lib/stores/product-page-store');
    useProductPageStore.getState().hydrate();

    const state = useProductPageStore.getState();
    expect(state.searchQuery).toBe('saved query');
    expect(state.sortBy).toBe('price-low');
    expect(state.scrollY).toBe(250);
    expect(state.sphereCategory).toBe('fashion');
    expect(state.hasHydrated).toBe(true);
  });

  it('should hydrate idempotently (double-hydrate safe)', async () => {
    store['dc-product-page-store'] = JSON.stringify({
      searchQuery: 'query1',
      sortBy: 'price-low',
      filterState: { categories: ['Sports'] },
      scrollY: 100,
      sphereCategory: 'Sports',
    });

    const { useProductPageStore } = await import('../../lib/stores/product-page-store');
    useProductPageStore.getState().hydrate();
    useProductPageStore.getState().hydrate(); // second call
    expect(useProductPageStore.getState().searchQuery).toBe('query1');
    expect(useProductPageStore.getState().hasHydrated).toBe(true);
  });

  it('should restore filter state with categories for hydration gate', async () => {
    store['dc-product-page-store'] = JSON.stringify({
      searchQuery: '',
      sortBy: 'price-low',
      filterState: { categories: ['Sports'], priceMin: 0, priceMax: 500000 },
      scrollY: 0,
      sphereCategory: 'Sports',
    });

    const { useProductPageStore } = await import('../../lib/stores/product-page-store');
    useProductPageStore.getState().hydrate();

    const state = useProductPageStore.getState();
    expect(state.filterState).toBeDefined();
    expect((state.filterState as any).categories).toEqual(['Sports']);
    expect(state.sphereCategory).toBe('Sports');
  });

  it('should handle empty sessionStorage gracefully during hydrate', async () => {
    const { useProductPageStore } = await import('../../lib/stores/product-page-store');
    useProductPageStore.getState().hydrate();
    expect(useProductPageStore.getState().hasHydrated).toBe(true);
    expect(useProductPageStore.getState().filterState).toBeNull();
  });

  it('should handle malformed sessionStorage data', async () => {
    store['dc-product-page-store'] = 'invalid json{{{';
    const { useProductPageStore } = await import('../../lib/stores/product-page-store');
    // Should not throw
    useProductPageStore.getState().hydrate();
    expect(useProductPageStore.getState().sortBy).toBe('relevance');
  });
});
