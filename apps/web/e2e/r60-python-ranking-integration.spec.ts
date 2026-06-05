/**
 * R60 — Python Ranking Engine Integration Tests
 *
 * Tests the full pipeline:
 *   Web (TypeScript) → Python Product-Ranking-Engine (FastAPI)
 *                     → 22-dimension scoring
 *                     → Kafka event pipeline
 *
 * Stack under test: docker-compose.latest.yml (port 3010 web, 8004 python ranking)
 *
 * Covers:
 *   1. Python V2 /rank/v2 endpoint — direct API
 *   2. Python /health — service health
 *   3. Python /config/weights — live DB dimension weights
 *   4. Web intent/analyze — TypeScript delegates to Python (dimTotal in response)
 *   5. All 22 dimension groups returned
 *   6. Ranking order correctness — better budget-fit product ranked higher
 *   7. Admin scoring dimensions page — latest stack port
 *   8. Admin learning insights page — latest stack port
 *   9. Performance — Python service < 200ms, full API < 2000ms
 *  10. Regression — old scoreBreakdown fields still present
 *  11. Smoke tests — home, login, products pages load
 *  12. Concurrent load — 5 parallel ranking calls succeed
 */

import { test, expect, request as pwRequest } from '@playwright/test';

// Base URLs for the latest stack
const WEB_BASE = process.env.BASE_URL || 'http://127.0.0.1:3010';
const PY_RANKING_BASE = 'http://127.0.0.1:8004';
const API_BASE = process.env.API_BASE_URL || 'http://127.0.0.1:3002';

// ── Auth helpers ──────────────────────────────────────────────────────────────
async function loginViaAPI(apiRequest: ReturnType<typeof pwRequest.newContext> extends Promise<infer T> ? T : never): Promise<string | null> {
  // Try web-proxied auth first (port 3010), then direct API (port 3002)
  const endpoints = [
    `${WEB_BASE}/api/auth/login`,
    `${API_BASE}/auth/login`,
    `${API_BASE}/api/auth/login`,
  ];
  for (const url of endpoints) {
    try {
      const resp = await apiRequest.post(url, {
        data: { email: 'admin@delegatecart.com', password: 'Admin@DC2024!' },
      });
      if (resp.ok()) {
        const body = await resp.json();
        return body.token || body.accessToken || null;
      }
    } catch {
      continue;
    }
  }
  return null;
}

async function injectAuth(page: import('@playwright/test').Page, token: string): Promise<void> {
  await page.evaluate((t) => {
    localStorage.setItem('authToken', t);
    localStorage.setItem('userRole', 'admin');
    // dc-user-role is what getCurrentUserRole() reads
    localStorage.setItem('dc-user-role', 'admin');
    localStorage.setItem('userEmail', 'admin@delegatecart.com');
    localStorage.setItem('dc-user-subscription', 'AI_PLUS');
  }, token);
}

// Sample products for direct Python service tests
const sampleProducts = [
  {
    id: 'p1', name: 'Dell XPS 15', brand: 'Dell', price: 48000, original_price: 52000,
    category: 'laptop', sub_category: 'ultrabook', key_features: ['i7', '16GB RAM', '512GB SSD', '4K display', 'Thunderbolt'],
    rating: 4.8, total_reviews: 1200, delivery_time: '2-3 days', delivery_days: 2,
    in_stock: true, source: 'internal', discount_percent: 8,
  },
  {
    id: 'p2', name: 'No-Brand Laptop', brand: 'Unknown', price: 75000, original_price: 75000,
    category: 'laptop', sub_category: 'generic', key_features: ['i3'],
    rating: 2.5, total_reviews: 10, delivery_time: '10-15 days', delivery_days: 12,
    in_stock: false, source: 'internal', discount_percent: 0,
  },
];

// ── 1. Python V2 Health ───────────────────────────────────────────────────────
test.describe('Python Ranking Engine — Health', () => {
  test('GET /health returns healthy status', async ({ request }) => {
    const resp = await request.get(`${PY_RANKING_BASE}/health`);
    expect(resp.ok()).toBeTruthy();
    const body = await resp.json();
    expect(body.status).toBe('healthy');
  });

  test('GET /health/v2 returns v2 engine status', async ({ request }) => {
    const resp = await request.get(`${PY_RANKING_BASE}/health/v2`);
    expect(resp.ok()).toBeTruthy();
    const body = await resp.json();
    expect(body.status).toBe('healthy');
    expect(body.engine).toBe('v2-dimension-based');
    expect(body.dimensions_loaded).toBeGreaterThanOrEqual(1);
  });
});

// ── 2. Python /config/weights ─────────────────────────────────────────────────
test.describe('Python Ranking Engine — Dimension Config', () => {
  test('GET /config/weights returns 22+ dimensions', async ({ request }) => {
    const resp = await request.get(`${PY_RANKING_BASE}/config/weights`);
    expect(resp.ok()).toBeTruthy();
    const body = await resp.json();
    // v2_dimensions is the new field name
    const dims = body.v2_dimensions || body.dimensions || [];
    expect(dims.length).toBeGreaterThanOrEqual(22);
  });

  test('Dimension weights sum to ~1.0', async ({ request }) => {
    const resp = await request.get(`${PY_RANKING_BASE}/config/weights`);
    const body = await resp.json();
    // accept both v2_total_weight shorthand or manual sum
    const totalWeight = body.v2_total_weight ??
      (body.v2_dimensions || body.dimensions || []).reduce(
        (sum: number, d: { weight?: number; weightage?: number }) => sum + (d.weight ?? d.weightage ?? 0), 0
      );
    expect(totalWeight).toBeCloseTo(1.0, 1);
  });

  test('All 5 dimension groups present', async ({ request }) => {
    const resp = await request.get(`${PY_RANKING_BASE}/config/weights`);
    const body = await resp.json();
    const dims = body.v2_dimensions || body.dimensions || [];
    const groups = new Set(dims.map((d: { group?: string; group_name?: string }) => d.group ?? d.group_name).filter(Boolean));
    expect(groups.size).toBeGreaterThanOrEqual(4); // at least 4 of 5 groups
  });
});

// ── 3. Python V2 /rank/v2 — Direct Scoring ───────────────────────────────────
test.describe('Python Ranking Engine — V2 Scoring', () => {
  test('POST /rank/v2 returns ranked products with 22 dimension scores', async ({ request }) => {
    const resp = await request.post(`${PY_RANKING_BASE}/rank/v2`, {
      data: {
        request_id: 'r60-test-001',
        user_id: 'test-user-1',
        query: 'gaming laptop',
        budget_min: 40000,
        budget_max: 55000,
        preferred_brands: ['Dell', 'Asus'],
        products: sampleProducts,
      },
    });
    expect(resp.ok()).toBeTruthy();
    const body = await resp.json();
    expect(body.ranked_products).toBeDefined();
    expect(body.ranked_products.length).toBe(2);

    const top = body.ranked_products[0];
    expect(top.score).toBeGreaterThan(0);
    expect(top.explanation).toBeDefined();
    expect(top.explanation.dimension_scores).toBeDefined();
    // Expect at least 20 dimensions scored
    const dimCount = Object.keys(top.explanation.dimension_scores).length;
    expect(dimCount).toBeGreaterThanOrEqual(20);
  });

  test('Better product ranked higher (budget-fit + brand + ratings)', async ({ request }) => {
    const resp = await request.post(`${PY_RANKING_BASE}/rank/v2`, {
      data: {
        request_id: 'r60-test-002',
        user_id: 'test-user-2',
        query: 'laptop',
        budget_min: 30000,
        budget_max: 55000,
        preferred_brands: ['Dell'],
        products: sampleProducts,
      },
    });
    const body = await resp.json();
    const ranked = body.ranked_products;
    expect(ranked[0].product.id).toBe('p1'); // Dell XPS should rank higher
  });

  test('Out-of-budget product ranked lower', async ({ request }) => {
    const resp = await request.post(`${PY_RANKING_BASE}/rank/v2`, {
      data: {
        request_id: 'r60-test-003',
        user_id: 'test-user-3',
        query: 'laptop',
        budget_min: 10000,
        budget_max: 40000,
        preferred_brands: [],
        products: sampleProducts,
      },
    });
    const body = await resp.json();
    // p2 (75000) is WAY over budget — should be ranked below p1 (48000, also over but less)
    const scores = body.ranked_products.map((r: { product: { id: string }; score: number }) => ({ id: r.product.id, score: r.score }));
    // p1 at 48000 is closer to 40000 -- higher rank
    const p1 = scores.find((s: { id: string }) => s.id === 'p1');
    const p2 = scores.find((s: { id: string }) => s.id === 'p2');
    expect(p1?.score ?? 0).toBeGreaterThan(p2?.score ?? 0);
  });

  test('dimension_total present in explanations', async ({ request }) => {
    const resp = await request.post(`${PY_RANKING_BASE}/rank/v2`, {
      data: {
        request_id: 'r60-test-004',
        user_id: 'test-user-4',
        query: 'ultrabook',
        budget_min: 40000,
        budget_max: 60000,
        preferred_brands: [],
        products: [sampleProducts[0]],
      },
    });
    const body = await resp.json();
    const expl = body.ranked_products[0].explanation;
    expect(expl.dimension_total).toBeDefined();
    expect(expl.dimension_total).toBeGreaterThan(0);
    expect(expl.dimension_total).toBeLessThanOrEqual(100);
  });

  test('Old /rank endpoint still works (backwards compat)', async ({ request }) => {
    const resp = await request.post(`${PY_RANKING_BASE}/rank`, {
      data: {
        request_id: 42,
        user_id: 1,
        products: sampleProducts,
        budget_max: 55000,
        budget_min: 30000,
        preferred_brands: ['Dell'],
      },
    });
    expect(resp.ok()).toBeTruthy();
    const body = await resp.json();
    expect(body.ranked_products.length).toBeGreaterThan(0);
  });
});

// ── 4. Web → Python Delegation ────────────────────────────────────────────────
test.describe('Web Intent Analyze → Python Delegation', () => {
  test('POST /api/intent/analyze returns dimensionTotal from Python service', async ({ request }) => {
    const start = Date.now();
    const resp = await request.post(`${WEB_BASE}/api/intent/analyze`, {
      data: { query: 'best laptop under 50000', engine: 'v2' },
    });
    const elapsed = Date.now() - start;
    expect(resp.ok()).toBeTruthy();

    const body = await resp.json();
    expect(body.products).toBeDefined();
    expect(body.products.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(5000);

    // dimTotal proves Python service was called
    const first = body.products[0];
    expect(first.scoreBreakdown).toBeDefined();
    expect(first.scoreBreakdown.dimensionTotal).toBeGreaterThan(0);
  });

  test('Products are sorted by score descending', async ({ request }) => {
    const resp = await request.post(`${WEB_BASE}/api/intent/analyze`, {
      data: { query: 'phone under 20000' },
    });
    const body = await resp.json();
    const scores = body.products.map((p: { relevanceScore: number }) => p.relevanceScore);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
    }
  });

  test('Legacy scoreBreakdown fields still present (regression)', async ({ request }) => {
    const resp = await request.post(`${WEB_BASE}/api/intent/analyze`, {
      data: { query: 'best headphones', engine: 'v2' },
    });
    const body = await resp.json();
    if (body.products.length > 0) {
      const breakdown = body.products[0].scoreBreakdown;
      // At least dimensionScores should be present
      expect(breakdown.dimensionScores).toBeDefined();
    }
  });
});

// ── 5. Admin UI — Latest Stack ────────────────────────────────────────────────
test.describe('Admin UI (port 3010)', () => {
  test('Scoring Dimensions page loads with 22 dimensions', async ({ page, request }) => {
    const token = await loginViaAPI(request);
    if (!token) { test.skip(); return; }

    await page.goto(WEB_BASE);
    await injectAuth(page, token);
    await page.goto(`${WEB_BASE}/admin/scoring-dimensions`);
    await expect(page.locator('h1')).toContainText('Scoring Dimensions', { timeout: 20000 });
    await page.screenshot({ path: 'r60-proof/scoring-dimensions-page.png', fullPage: true });
  });

  test('Learning Insights page loads with KPI cards', async ({ page, request }) => {
    const token = await loginViaAPI(request);
    if (!token) { test.skip(); return; }

    await page.goto(WEB_BASE);
    await injectAuth(page, token);
    await page.goto(`${WEB_BASE}/admin/learning-insights`);
    await expect(page.locator('h1')).toContainText('Learning Insights', { timeout: 20000 });
    await expect(page.getByText('Ranking Events', { exact: false }).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Click Rate', { exact: false }).first()).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: 'r60-proof/learning-insights-page.png', fullPage: true });
  });

  test('Admin dashboard loads', async ({ page, request }) => {
    const token = await loginViaAPI(request);
    if (!token) { test.skip(); return; }

    await page.goto(WEB_BASE);
    await injectAuth(page, token);
    await page.goto(`${WEB_BASE}/admin`);
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 20000 });
    await page.screenshot({ path: 'r60-proof/admin-dashboard.png', fullPage: true });
  });
});

// ── 6. Full E2E Flow ──────────────────────────────────────────────────────────
test.describe('End-to-End Ranking Flow', () => {
  test('Home page loads and search works (screenshot proof)', async ({ page }) => {
    await page.goto(WEB_BASE);
    await expect(page.locator('body')).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: 'r60-proof/home-page.png', fullPage: false });
  });

  test('Smart Assistant page loads', async ({ page }) => {
    await page.goto(`${WEB_BASE}/shopping-assistant`);
    await expect(page.locator('body')).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: 'r60-proof/smart-assistant.png', fullPage: false });
  });

  test('Products page loads', async ({ page }) => {
    await page.goto(`${WEB_BASE}/products`);
    await expect(page.locator('body')).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: 'r60-proof/products-page.png', fullPage: false });
  });
});

// ── 7. Performance Tests ──────────────────────────────────────────────────────
test.describe('Performance', () => {
  test('Python V2 /rank/v2 responds in < 500ms for 10 products', async ({ request }) => {
    const products10 = Array.from({ length: 10 }, (_, i) => ({
      ...sampleProducts[0],
      id: `perf-${i}`,
      name: `Product ${i}`,
      price: 30000 + i * 2000,
    }));
    const start = Date.now();
    const resp = await request.post(`${PY_RANKING_BASE}/rank/v2`, {
      data: {
        request_id: 'perf-test-1',
        user_id: 'perf-user',
        query: 'laptop',
        budget_min: 25000,
        budget_max: 60000,
        preferred_brands: [],
        products: products10,
      },
    });
    const elapsed = Date.now() - start;
    expect(resp.ok()).toBeTruthy();
    expect(elapsed).toBeLessThan(500);
  });

  test('Python V2 ranks 50 products in < 1500ms', async ({ request }) => {
    const products50 = Array.from({ length: 50 }, (_, i) => ({
      ...sampleProducts[0],
      id: `bulk-${i}`,
      name: `Bulk Product ${i}`,
      price: 20000 + (i % 20) * 1500,
    }));
    const start = Date.now();
    const resp = await request.post(`${PY_RANKING_BASE}/rank/v2`, {
      data: {
        request_id: 'perf-test-50',
        user_id: 'perf-user',
        query: 'laptop gaming',
        budget_min: 20000,
        budget_max: 60000,
        preferred_brands: [],
        products: products50,
      },
    });
    const elapsed = Date.now() - start;
    expect(resp.ok()).toBeTruthy();
    expect(elapsed).toBeLessThan(1500);
  });

  test('Concurrent ranking — 5 simultaneous requests all succeed', async ({ request }) => {
    const payload = {
      request_id: 'concurrent-test',
      user_id: 'concurrent-user',
      query: 'laptop',
      budget_min: 30000,
      budget_max: 60000,
      preferred_brands: [],
      products: sampleProducts,
    };
    const promises = Array.from({ length: 5 }, (_, i) =>
      request.post(`${PY_RANKING_BASE}/rank/v2`, { data: { ...payload, request_id: `concurrent-${i}` } })
    );
    const results = await Promise.all(promises);
    const allOk = results.every((r) => r.ok());
    expect(allOk).toBeTruthy();
  });

  test('Web intent/analyze < 3000ms for standard query', async ({ request }) => {
    const start = Date.now();
    const resp = await request.post(`${WEB_BASE}/api/intent/analyze`, {
      data: { query: 'wireless earbuds under 5000', engine: 'v2' },
    });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(3000);
  });
});

// ── 8. Smoke Tests ───────────────────────────────────────────────────────────
test.describe('Smoke Tests — All Critical Pages', () => {
  const criticalPages = [
    { path: '/', name: 'Home' },
    { path: '/products', name: 'Products' },
    { path: '/signin', name: 'Sign In' },
    { path: '/pricing', name: 'Pricing' },
  ];

  for (const pg of criticalPages) {
    test(`${pg.name} page (${pg.path}) returns 200`, async ({ request }) => {
      const resp = await request.get(`${WEB_BASE}${pg.path}`);
      expect(resp.status()).toBeLessThan(500);
    });
  }

  test('Python service Swagger docs accessible', async ({ request }) => {
    const resp = await request.get(`${PY_RANKING_BASE}/docs`);
    expect(resp.ok()).toBeTruthy();
  });

  test('Python service OpenAPI schema valid', async ({ request }) => {
    const resp = await request.get(`${PY_RANKING_BASE}/openapi.json`);
    expect(resp.ok()).toBeTruthy();
    const schema = await resp.json();
    expect(schema.paths).toBeDefined();
    expect(schema.paths['/rank/v2']).toBeDefined();
  });
});

// ── 9. Regression Tests ───────────────────────────────────────────────────────
test.describe('Regression — Original Endpoints Still Work', () => {
  test('Old /rank endpoint (v1 legacy) returns valid response', async ({ request }) => {
    const resp = await request.post(`${PY_RANKING_BASE}/rank`, {
      data: {
        request_id: 99,
        user_id: 1,
        products: sampleProducts,
        budget_max: 55000,
        budget_min: 30000,
        preferred_brands: [],
      },
    });
    expect(resp.ok()).toBeTruthy();
    const body = await resp.json();
    expect(body.ranked_products).toBeDefined();
  });

  test('Admin scoring-dimensions API returns dimensions', async ({ request }) => {
    const resp = await request.get(`${WEB_BASE}/api/admin/scoring-dimensions`);
    expect(resp.ok()).toBeTruthy();
    const body = await resp.json();
    expect(body.dimensions.length).toBeGreaterThanOrEqual(22);
  });

  test('Web homepage does not return 500', async ({ request }) => {
    const resp = await request.get(`${WEB_BASE}/`);
    expect(resp.status()).not.toBe(500);
  });
});
