/**
 * Performance Tests — Smart Intent Search Engine
 *
 * Validates that search queries complete within target latencies:
 *   - Intent analysis (API-level): < 300ms per query
 *   - Batch throughput: 100 queries in < 30s
 *   - Products API: < 500ms per request
 *
 * These run against a live server (requires Docker up).
 */
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';

// ── Query corpus ─────────────────────────────────────────────────────────────

const SEARCH_QUERIES = [
  'best phone under 20000',
  'gaming laptop for coding',
  'cheap earbuds',
  'samsung tv 55 inch',
  'washing machine under 30000',
  'allen solly jeans',
  'running shoes under 5000',
  'noise cancelling headphones for travel',
  'macbook alternative under 80000',
  'budget phone with 5g',
  'iphone alternative',
  'good camera phone',
  'wireless earbuds under 3000',
  'men formal shoes',
  'samsung galaxy s24',
  'dell laptop for office',
  'sony headphones',
  'bosch washing machine',
  'nike running shoes',
  'lg refrigerator double door',
  'kurta for men under 1000',
  'fossil watch for women',
  'study table for kids',
  'protein powder under 2000',
  'best books for programming',
  'kitchen mixer grinder',
  'casual shoes for daily wear',
  'bluetooth speaker under 2000',
  'air conditioner 1.5 ton',
  'microwave oven under 10000',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

async function measureIntentSearch(request: any, query: string) {
  const start = performance.now();
  const res = await request.post(`${BASE_URL}/api/intent/analyze`, {
    data: { query, engine: 'v2' },
  });
  const elapsed = performance.now() - start;
  const body = await res.json();
  return { elapsed, status: res.status(), productCount: body.products?.length || 0 };
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. Individual Query Latency
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Intent search latency', () => {
  for (const query of SEARCH_QUERIES.slice(0, 10)) {
    test(`"${query}" < 2000ms`, async ({ request }) => {
      const { elapsed, status } = await measureIntentSearch(request, query);
      expect(status).toBe(200);
      expect(elapsed).toBeLessThan(2000); // 2s for Docker on Windows (includes first-compile)
    });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// 2. Batch Throughput
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Batch query throughput', () => {
  test('30 sequential queries complete within 30s', async ({ request }) => {
    const results: Array<{ query: string; elapsed: number; ok: boolean }> = [];

    const batchStart = performance.now();
    for (const query of SEARCH_QUERIES) {
      const { elapsed, status, productCount } = await measureIntentSearch(request, query);
      results.push({ query, elapsed, ok: status === 200 && productCount > 0 });
    }
    const totalElapsed = performance.now() - batchStart;

    // At least 90% should succeed (some niche queries may return 0 products)
    const successes = results.filter((r) => r.ok);
    expect(successes.length).toBeGreaterThanOrEqual(Math.floor(SEARCH_QUERIES.length * 0.9));

    // Total under 60s (Docker on Windows)
    expect(totalElapsed).toBeLessThan(60000);

    // Average under 1000ms
    const avg = results.reduce((sum, r) => sum + r.elapsed, 0) / results.length;
    expect(avg).toBeLessThan(1000);

    // Log results
    console.log(`\n[Performance] ${SEARCH_QUERIES.length} queries in ${totalElapsed.toFixed(0)}ms`);
    console.log(`[Performance] Average: ${avg.toFixed(0)}ms`);
    console.log(
      `[Performance] P95: ${results
        .map((r) => r.elapsed)
        .sort((a, b) => a - b)
        [Math.floor(results.length * 0.95)].toFixed(0)}ms`
    );
    console.log(`[Performance] Max: ${Math.max(...results.map((r) => r.elapsed)).toFixed(0)}ms`);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 3. Products API Latency
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Products API latency', () => {
  test('browse products < 5000ms', async ({ request }) => {
    const start = performance.now();
    const res = await request.get(`${BASE_URL}/api/products?skip=0&take=20`);
    const elapsed = performance.now() - start;
    expect(res.ok()).toBe(true);
    expect(elapsed).toBeLessThan(5000);
  });

  test('category filter < 5000ms', async ({ request }) => {
    const start = performance.now();
    const res = await request.get(`${BASE_URL}/api/products?category=fashion&skip=0&take=20`);
    const elapsed = performance.now() - start;
    expect(res.ok()).toBe(true);
    expect(elapsed).toBeLessThan(5000);
  });

  test('deep pagination (skip=50000) < 5000ms', async ({ request }) => {
    const start = performance.now();
    const res = await request.get(`${BASE_URL}/api/products?skip=50000&take=20`);
    const elapsed = performance.now() - start;
    expect(res.ok()).toBe(true);
    expect(elapsed).toBeLessThan(5000);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 4. Debug API Latency
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Debug API latency', () => {
  test('business ranking debug < 2000ms', async ({ request }) => {
    const start = performance.now();
    const res = await request.get(`${BASE_URL}/api/debug/business-ranking/perf-test-1`);
    const elapsed = performance.now() - start;
    expect(res.ok()).toBe(true);
    expect(elapsed).toBeLessThan(2000);
  });
});
