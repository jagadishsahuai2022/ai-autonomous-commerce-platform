/**
 * db-product-bridge — multi-strategy fetchDBProducts tests.
 *
 * Covers the regression fix for queries like "laptop under 50000" that used to
 * return zero products because the intent→DB category map pointed at
 * non-existent categories and the search ignored Product.genericName.
 *
 * Strategy:
 *   • Stub global.fetch so we never hit the real NestJS API.
 *   • Inspect the URL the bridge constructs to verify category & search params.
 *   • Verify multi-strategy fallback (targeted → drop category → noun-only).
 *
 * Run: cd apps/web && pnpm vitest --run lib/smart-intent/__tests__/db-product-bridge.test.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchDBProducts, type FetchDBProductsOpts } from '../db-product-bridge';

// Mock taxonomy so tests never touch the DB and work with deterministic data.
vi.mock('../db-intent-taxonomy', () => ({
  loadIntentTaxonomy: vi.fn().mockResolvedValue({
    subcategoryCandidates: {
      laptop: ['Laptops', 'Notebooks', 'Ultrabooks'],
      phone: ['Smartphones', 'Mobile Phones', 'Feature Phones'],
      appliances: ['Home Appliances', 'Kitchen Appliances'],
    },
    parentBroadeningKeyword: {
      laptop: 'laptop',
      phone: 'phone',
      appliances: 'appliances',
    },
    genericNouns: {
      laptop: ['Laptop', 'Notebook', 'Ultrabook'],
      phone: ['Smartphone', 'Mobile Phone'],
      appliances: ['Washing Machine', 'Refrigerator', 'Air Conditioner', 'Microwave'],
    },
  }),
}));

type StubFn = (url: string, init?: RequestInit) => Promise<Response>;

function jsonRes(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function emptyRes(): Response {
  return jsonRes([]);
}

function makeProduct(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 1,
    name: 'HP Pavilion 15',
    brand: 'HP',
    price: 45000,
    originalPrice: 55000,
    category: 'Laptops',
    subCategory: 'Mid-range',
    rating: 4.2,
    reviewCount: 120,
    inStock: true,
    specifications: { ram: '16GB', storage: '512GB SSD' },
    genericName: 'Laptop',
    ...overrides,
  };
}

let calls: Array<{ url: string }> = [];

function installFetchStub(handler: StubFn): void {
  calls = [];
  vi.stubGlobal(
    'fetch',
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input.toString();
      calls.push({ url });
      return handler(url, init);
    }
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  calls = [];
});

describe('fetchDBProducts — multi-strategy regression suite', () => {
  beforeEach(() => {
    // Force a known API base so URL assertions are stable.
    process.env.NESTJS_API_URL = 'http://test-api:3001';
    delete process.env.BACKEND_URL;
    delete process.env.NEXT_PUBLIC_API_URL;
  });

  it('returns empty when intent category is null', async () => {
    installFetchStub(async () => emptyRes());
    const result = await fetchDBProducts(null, null, null, 10);
    expect(result).toEqual([]);
    expect(calls.length).toBe(0);
  });

  it('Strategy 1: targeted query for "laptop" hits /products with category=Laptops', async () => {
    installFetchStub(async () => jsonRes([makeProduct()]));
    const opts: FetchDBProductsOpts = {
      useCase: 'Programming',
      features: ['Backlit Keyboard'],
      searchTerms: ['laptop'],
    };
    const result = await fetchDBProducts('laptop', { min: 0, max: 50000 }, null, 10, opts);
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('1');
    expect(result[0].brand).toBe('HP');

    const firstCall = calls[0];
    expect(firstCall).toBeDefined();
    expect(firstCall.url).toContain('/products?');
    expect(firstCall.url).toContain('category=Laptops');
    expect(firstCall.url).toContain('maxPrice=50000');
    // Search string must include the canonical noun "Laptop"
    expect(firstCall.url.toLowerCase()).toContain('search=');
    expect(decodeURIComponent(firstCall.url).toLowerCase()).toContain('laptop');
  });

  it('Strategy 2b: targeted + parent-keyword both return 0, falls back to no-category search', async () => {
    // laptop has 3 subcategory aliases (Strategy 1) + 1 parent-keyword call
    // (Strategy 2a, category=laptop) before Strategy 2b drops the category.
    let callIdx = 0;
    installFetchStub(async () => {
      callIdx += 1;
      // Strategies 1 (×3) + 2a (×1) all empty.
      if (callIdx <= 4) return emptyRes();
      return jsonRes([makeProduct({ id: 7, name: 'Lenovo IdeaPad' })]);
    });

    const result = await fetchDBProducts('laptop', { min: 0, max: 80000 }, null, 10, {
      searchTerms: ['laptop'],
    });

    expect(result.length).toBe(1);
    expect(result[0].id).toBe('7');
    // Strategy 2a (call 4, index 3) still passes a category= keyword.
    expect(calls[3].url).toContain('category=');
    // Strategy 2b (call 5, index 4) must NOT have category=.
    expect(calls[4].url).not.toContain('category=');
  });

  it('Strategy 3: noun-only search after broader fallback also yields 0', async () => {
    let callIdx = 0;
    installFetchStub(async () => {
      callIdx += 1;
      // 'appliances' has 2 subcategory candidates in Strategy 1 + 1 parent-keyword
      // call in Strategy 2a + 1 category-drop in Strategy 2b = 4 empty calls
      // before Strategy 3 noun-only searches start.
      if (callIdx <= 4) return emptyRes();
      return jsonRes([makeProduct({ id: 99, name: 'LG Washing Machine 8kg' })]);
    });

    const result = await fetchDBProducts('appliances', { min: 0, max: 60000 }, null, 10, {
      searchTerms: ['washing machine'],
    });

    expect(result.length).toBe(1);
    expect(result[0].id).toBe('99');
    // Strategy 3 should issue a search-only query (no category=) using one of
    // the canonical generic nouns from INTENT_TO_GENERIC_NOUN['appliances'].
    const lastCall = calls[calls.length - 1];
    expect(lastCall.url).not.toContain('category=');
    const decoded = decodeURIComponent(lastCall.url).toLowerCase().replace(/\+/g, ' ');
    expect(
      decoded.includes('washing machine') ||
        decoded.includes('refrigerator') ||
        decoded.includes('air conditioner') ||
        decoded.includes('microwave')
    ).toBe(true);
  });

  it('forwards brand filter as a structured query param when provided', async () => {
    installFetchStub(async () => jsonRes([makeProduct({ brand: 'Samsung' })]));
    await fetchDBProducts('phone', { min: 0, max: 30000 }, 'Samsung', 5, {
      searchTerms: ['phone'],
    });
    expect(calls[0].url).toContain('brand=Samsung');
  });

  it('safely handles non-JSON / network errors and returns []', async () => {
    installFetchStub(async () => {
      throw new Error('network down');
    });
    const result = await fetchDBProducts('laptop', null, null, 5, {
      allowBroadening: false,
      searchTerms: ['laptop'],
    });
    expect(result).toEqual([]);
  });

  it('search= param must NOT contain prefixed noun_signals like "category:appliances"', async () => {
    // This is the critical regression test for the bug where noun_signals
    // (e.g. "category:appliances", "brand:Samsung") were passed as searchTerms
    // and appended to the search string, causing NestJS to always return zero results.
    installFetchStub(async () => jsonRes([makeProduct({ id: 42, name: 'Samsung Galaxy S24' })]));

    // Simulate what analyze/route.ts used to do: pass noun_signals as searchTerms
    const badOpts: FetchDBProductsOpts = {
      searchTerms: ['category:appliances', 'brand:Samsung'], // should be ignored / stripped
    };
    const result = await fetchDBProducts('appliances', null, null, 5, badOpts);

    // Verify no URL contains the prefixed token
    for (const { url } of calls) {
      const decoded = decodeURIComponent(url);
      expect(decoded).not.toContain('category:appliances');
      expect(decoded).not.toContain('brand:Samsung');
    }
    // First call should use the canonical primaryNoun ("Washing Machine") instead
    const firstUrl = decodeURIComponent(calls[0]?.url ?? '');
    expect(firstUrl.toLowerCase()).toContain('search=');
    // Should use canonical noun from taxonomy, NOT the prefixed noun_signals
    expect(firstUrl.toLowerCase()).toContain('washing+machine');
  });

  it('Strategy 1 search string uses only canonical primaryNoun (not useCase/features)', async () => {
    installFetchStub(async () => jsonRes([makeProduct()]));

    // Even if useCase and features are provided they must NOT appear in Strategy 1 search
    const result = await fetchDBProducts('laptop', { min: 0, max: 80000 }, null, 5, {
      useCase: 'home',
      features: ['battery', 'lightweight'],
    });

    expect(result.length).toBe(1);
    const firstUrl = decodeURIComponent(calls[0]?.url ?? '')
      .toLowerCase()
      .replace(/\+/g, ' ');
    // Must contain "laptop" (the canonical noun) but must NOT contain "home" or feature names
    expect(firstUrl).toContain('search=');
    expect(firstUrl).not.toContain('home');
    expect(firstUrl).not.toContain('battery');
    expect(firstUrl).not.toContain('lightweight');
  });
});
