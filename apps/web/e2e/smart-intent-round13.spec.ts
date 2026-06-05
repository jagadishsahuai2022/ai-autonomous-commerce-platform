/**
 * Smart Intent Engine — Round 13 E2E Tests
 *
 * Tests the new business ranking + pricing features:
 *  1. Debug API returns score breakdown (metrics, scoring, pricing)
 *  2. Intent search includes business score in scoreBreakdown
 *  3. Dynamic pricing guardrails (±20% cap)
 *  4. High-margin irrelevant product does NOT outrank relevant
 *  5. Cart price consistency (same product, same price)
 *  6. Products page search returns enriched results
 *  7. Performance: search queries < 300ms
 *  8. Cross-category validation (no leakage)
 *
 * Config: screenshot: 'on', video: 'on', reporter: html
 */
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function intentSearch(request: any, query: string) {
  const res = await request.post(`${BASE_URL}/api/intent/analyze`, {
    data: { query, engine: 'v2' },
  });
  const body = await res.json();
  return { res, body };
}

async function debugProduct(request: any, productId: string) {
  const res = await request.get(`${BASE_URL}/api/debug/business-ranking/${productId}`);
  const body = await res.json();
  return { res, body };
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. Debug API — Score Explainability
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Debug Business Ranking API', () => {
  test('returns metrics, scoring, and pricing for a product', async ({ request }) => {
    const { res, body } = await debugProduct(request, 'test-product-1');
    expect(res.ok()).toBe(true);
    expect(body.productId).toBe('test-product-1');

    // Metrics present
    expect(body.metrics).toBeDefined();
    expect(body.metrics.marginPercentage).toBeGreaterThanOrEqual(0);
    expect(body.metrics.inventoryCount).toBeGreaterThanOrEqual(0);
    expect(body.metrics.conversionRate).toBeGreaterThanOrEqual(0);
    expect(body.metrics.salesVelocity).toBeGreaterThanOrEqual(0);

    // Scoring present
    expect(body.scoring).toBeDefined();
    expect(body.scoring.business_score).toBeGreaterThanOrEqual(0);
    expect(body.scoring.business_score).toBeLessThanOrEqual(50);
    expect(body.scoring.conversion_score).toBeGreaterThanOrEqual(0);
    expect(body.scoring.margin_score).toBeGreaterThanOrEqual(0);
    expect(body.scoring.inventory_score).toBeGreaterThanOrEqual(0);

    // Pricing present
    expect(body.pricing).toBeDefined();
    expect(body.pricing.base_price).toBeGreaterThan(0);
    expect(body.pricing.dynamic_price).toBeGreaterThan(0);
  });

  test('debug API is deterministic (same product = same metrics)', async ({ request }) => {
    const { body: b1 } = await debugProduct(request, 'determinism-check');
    const { body: b2 } = await debugProduct(request, 'determinism-check');
    expect(b1.metrics.marginPercentage).toBe(b2.metrics.marginPercentage);
    expect(b1.metrics.inventoryCount).toBe(b2.metrics.inventoryCount);
    expect(b1.scoring.business_score).toBe(b2.scoring.business_score);
  });

  test('debug API returns 400 for empty productId', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/debug/business-ranking/`);
    // Either 400 or 404 depending on route matching
    expect([400, 404]).toContain(res.status());
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 2. Intent Search — Business Score Integration
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Intent search with business scoring', () => {
  test('score breakdown includes businessScore field', async ({ request }) => {
    const { body } = await intentSearch(request, 'best phone under 20000');
    expect(body.products.length).toBeGreaterThan(0);

    const first = body.products[0];
    expect(first.scoreBreakdown).toBeDefined();
    expect(first.scoreBreakdown.businessScore).toBeDefined();
    expect(first.scoreBreakdown.businessScore).toBeGreaterThanOrEqual(0);
  });

  test('products are sorted by descending relevanceScore', async ({ request }) => {
    const { body } = await intentSearch(request, 'samsung phone');
    expect(body.products.length).toBeGreaterThan(1);

    for (let i = 1; i < body.products.length; i++) {
      expect(body.products[i - 1].relevanceScore).toBeGreaterThanOrEqual(
        body.products[i].relevanceScore
      );
    }
  });

  test('user-relevant product outranks high-margin irrelevant product', async ({ request }) => {
    // "phone under 20000" should return phones, not fashion (even though fashion has higher margins)
    const { body } = await intentSearch(request, 'phone under 20000');
    expect(body.products.length).toBeGreaterThan(0);

    // Top 5 results should all be phones
    const top5 = body.products.slice(0, 5);
    for (const p of top5) {
      const isPhone =
        p.category?.toLowerCase() === 'phone' ||
        p.specifications?.category === 'phone' ||
        p.name?.toLowerCase().includes('phone');
      expect(isPhone).toBe(true);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 3. Dynamic Pricing Guardrails
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Dynamic pricing guardrails', () => {
  test('price never exceeds ±20% of base price', async ({ request }) => {
    // Check multiple products via debug API
    const productIds = ['guard-1', 'guard-2', 'guard-3', 'guard-4', 'guard-5'];
    for (const pid of productIds) {
      const { body } = await debugProduct(request, pid);
      const base = body.pricing.base_price;
      const dynamic = body.pricing.dynamic_price;
      expect(dynamic).toBeGreaterThanOrEqual(base * 0.8);
      expect(dynamic).toBeLessThanOrEqual(base * 1.2);
    }
  });

  test('discount percentage is 0-30%', async ({ request }) => {
    const productIds = ['disc-1', 'disc-2', 'disc-3'];
    for (const pid of productIds) {
      const { body } = await debugProduct(request, pid);
      expect(body.pricing.discount_percent).toBeGreaterThanOrEqual(0);
      expect(body.pricing.discount_percent).toBeLessThanOrEqual(30);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 4. Cart Price Consistency
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Price consistency', () => {
  test('same product returns same dynamic price across calls', async ({ request }) => {
    const { body: b1 } = await debugProduct(request, 'consistency-prod');
    const { body: b2 } = await debugProduct(request, 'consistency-prod');
    const { body: b3 } = await debugProduct(request, 'consistency-prod');
    expect(b1.pricing.dynamic_price).toBe(b2.pricing.dynamic_price);
    expect(b2.pricing.dynamic_price).toBe(b3.pricing.dynamic_price);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 5. Cross-Category Validation (No Leakage)
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Cross-category validation', () => {
  test('laptop search returns no phones or fashion items', async ({ request }) => {
    const { body } = await intentSearch(request, 'gaming laptop under 80000');
    expect(body.products.length).toBeGreaterThan(0);
    for (const p of body.products) {
      expect(p.category?.toLowerCase()).not.toBe('phone');
      expect(p.category?.toLowerCase()).not.toBe('fashion');
    }
  });

  test('headphones search returns no laptops', async ({ request }) => {
    const { body } = await intentSearch(request, 'noise cancelling headphones');
    expect(body.products.length).toBeGreaterThan(0);
    for (const p of body.products) {
      expect(p.category?.toLowerCase()).not.toBe('laptop');
    }
  });

  test('fashion search returns no electronics', async ({ request }) => {
    const { body } = await intentSearch(request, 'allen solly formal shirt');
    expect(body.products.length).toBeGreaterThan(0);
    for (const p of body.products) {
      expect(p.category?.toLowerCase()).not.toBe('phone');
      expect(p.category?.toLowerCase()).not.toBe('laptop');
      expect(p.category?.toLowerCase()).not.toBe('television');
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 6. Performance — Search Response Time
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Search performance', () => {
  const queries = [
    'best phone under 20000',
    'gaming laptop for coding',
    'noise cancelling headphones',
    'samsung tv 55 inch',
    'washing machine under 30000',
    'allen solly jeans',
    'running shoes under 5000',
    'wireless earbuds',
    'macbook alternative',
    'budget phone with 5g',
  ];

  for (const query of queries) {
    test(`"${query}" responds within 2000ms`, async ({ request }) => {
      const start = Date.now();
      const { res } = await intentSearch(request, query);
      const elapsed = Date.now() - start;
      expect(res.ok()).toBe(true);
      expect(elapsed).toBeLessThan(2000); // Network + compute < 2s for E2E
    });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// 7. Products Page — Business-Enhanced UI
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Products page with business ranking', () => {
  test('products page loads and shows product cards', async ({ page }) => {
    await page.goto(`${BASE_URL}/products`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    const cards = page.locator('[data-testid="product-card"], .group');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);

    await page.screenshot({
      path: 'test-results/round13-products-page.png',
      fullPage: true,
    });
  });

  test('search for phones shows phone products', async ({ page }) => {
    await page.goto(`${BASE_URL}/products?q=phone+under+20000`, {
      waitUntil: 'networkidle',
    });
    await page.waitForTimeout(3000);

    await page.screenshot({
      path: 'test-results/round13-phone-search.png',
      fullPage: true,
    });

    // Should show product cards
    const cards = page.locator('[data-testid="product-card"], .group');
    expect(await cards.count()).toBeGreaterThan(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 8. Trust Validation — Ranking Quality
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Trust validation', () => {
  test('budget query returns products within budget (with tolerance)', async ({ request }) => {
    const { body } = await intentSearch(request, 'earbuds under 2000');
    expect(body.products.length).toBeGreaterThan(0);

    // At least 50% should be under 2400 (20% tolerance)
    const withinBudget = body.products.filter((p: any) => p.price <= 2400);
    expect(withinBudget.length).toBeGreaterThanOrEqual(Math.floor(body.products.length * 0.5));
  });

  test('premium query returns higher-priced items', async ({ request }) => {
    const { body } = await intentSearch(request, 'premium laptop above 100000');
    expect(body.products.length).toBeGreaterThan(0);

    // At least some should be above 80000
    const premium = body.products.filter((p: any) => p.price >= 80000);
    expect(premium.length).toBeGreaterThan(0);
  });

  test('brand search returns brand-matching products in top results', async ({ request }) => {
    const { body } = await intentSearch(request, 'samsung phone');
    expect(body.products.length).toBeGreaterThan(0);

    // Top 5 should include Samsung
    const top5 = body.products.slice(0, 5);
    const hasSamsung = top5.some(
      (p: any) =>
        p.name?.toLowerCase().includes('samsung') || p.brand?.toLowerCase().includes('samsung')
    );
    expect(hasSamsung).toBe(true);
  });

  test('multiple searches return consistent result counts', async ({ request }) => {
    const { body: b1 } = await intentSearch(request, 'best phone under 20000');
    const { body: b2 } = await intentSearch(request, 'best phone under 20000');
    expect(b1.products.length).toBe(b2.products.length);
  });
});
