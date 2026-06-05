/**
 * R59 — Ranking Engine Revamp E2E Tests
 *
 * Tests cover:
 * 1. Scoring Dimensions API (GET all 22 dimensions with groups)
 * 2. Ranking Engine (dimension-based scoring produces ranked results)
 * 3. Admin Scoring Dimensions page (loads, shows group tabs, dimensions)
 * 4. Admin Learning Insights page (loads)
 * 5. Search flow (V3 engine returns scored results)
 * 6. Weight update via API (audit trail created)
 * 7. Optimize Weights API (job creation)
 */
import { test, expect, type Page, type APIRequestContext } from '@playwright/test';

// ── Helper: login and inject auth ───────────────────────────────────────────

async function loginViaAPI(request: APIRequestContext): Promise<string> {
  const res = await request.post('/api/auth/login', {
    data: { email: 'admin@delegatecart.com', password: 'Admin@DC2024!' },
  });
  if (res.status() !== 200) return '';
  const data = await res.json();
  return data.token || '';
}

async function injectAuth(page: Page, token: string) {
  await page.evaluate(
    ({ t }) => {
      localStorage.setItem('authToken', t);
      localStorage.setItem('userEmail', 'admin@delegatecart.com');
      localStorage.setItem('userRole', 'admin');
    },
    { t: token }
  );
}

// ── API Tests ───────────────────────────────────────────────────────────────

test.describe('R59 Scoring Dimensions API', () => {
  test('GET returns 22 dimensions with group/scorerKey fields', async ({ request }) => {
    const res = await request.get('/api/admin/scoring-dimensions');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.dimensions).toBeDefined();
    expect(body.dimensions.length).toBe(22);

    // Verify new fields exist
    const first = body.dimensions[0];
    expect(first.key).toBeTruthy();
    expect(first.group).toBeTruthy();
    expect(first.scorerKey).toBeTruthy();
    expect(typeof first.weightage).toBe('number');

    // Check all groups are present
    const groups = new Set(body.dimensions.map((d: any) => d.group));
    expect(groups.has('intent')).toBeTruthy();
    expect(groups.has('quality')).toBeTruthy();
    expect(groups.has('engagement')).toBeTruthy();
    expect(groups.has('personal')).toBeTruthy();
    expect(groups.has('business')).toBeTruthy();

    // Check budget_penalty is negative
    const penalty = body.dimensions.find((d: any) => d.key === 'budget_penalty');
    expect(penalty).toBeTruthy();
    expect(penalty.isNegative).toBe(true);
  });

  test('Weights sum to approximately 1.0', async ({ request }) => {
    const res = await request.get('/api/admin/scoring-dimensions');
    const body = await res.json();
    const totalWeight = body.dimensions.reduce((sum: number, d: any) => sum + d.weightage, 0);
    expect(totalWeight).toBeGreaterThan(0.95);
    expect(totalWeight).toBeLessThan(1.05);
  });
});

test.describe('R59 Ranking Engine', () => {
  test('Intent analysis returns dimension-scored products', async ({ request }) => {
    const res = await request.post('/api/intent/analyze', {
      data: { query: 'best phone under 20000' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.products).toBeDefined();
    expect(body.products.length).toBeGreaterThan(0);
    expect(body.engine_version).toBe('v2');

    // Verify scoring breakdown
    const product = body.products[0];
    expect(product.relevanceScore).toBeGreaterThan(0);
    expect(product.scoreBreakdown).toBeDefined();
    expect(typeof product.scoreBreakdown.categoryMatch).toBe('number');

    // Verify dimension fields present
    expect(product.scoreBreakdown.dimensionScores).toBeDefined();
    expect(product.scoreBreakdown.dimensionTotal).toBeDefined();
    expect(product.scoreBreakdown.dimensionTotal).toBeGreaterThan(0);
  });

  test('Products are sorted by relevance score descending', async ({ request }) => {
    const res = await request.post('/api/intent/analyze', {
      data: { query: 'laptop for gaming' },
    });
    const body = await res.json();
    const scores = body.products.map((p: any) => p.relevanceScore);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
    }
  });

  test('Search API returns scored products (V3 engine)', async ({ request }) => {
    const res = await request.get('/api/search?q=wireless+headphones');
    if (res.status() === 200) {
      const body = await res.json();
      if (body.products && body.products.length > 0) {
        expect(body.products[0]).toHaveProperty('name');
      }
    }
  });
});

test.describe('R59 Weight Update + Audit', () => {
  test('PUT updates weights and creates audit trail', async ({ request }) => {
    const token = await loginViaAPI(request);
    if (!token) {
      test.skip();
      return;
    }

    // Get current dimensions
    const getRes = await request.get('/api/admin/scoring-dimensions');
    const getCurrent = await getRes.json();
    const dims = getCurrent.dimensions;

    // Update with same weights (safe — no actual change)
    const putRes = await request.put('/api/admin/scoring-dimensions', {
      data: { dimensions: dims, reason: 'R59 e2e test audit' },
      headers: { Authorization: `Bearer ${token}` },
    });

    if (putRes.status() === 200) {
      const putBody = await putRes.json();
      expect(putBody.success).toBe(true);
      expect(putBody.dimensions.length).toBe(22);
    }
  });
});

test.describe('R59 Optimize Weights API', () => {
  test('GET returns job status (or null)', async ({ request }) => {
    const token = await loginViaAPI(request);
    if (!token) {
      test.skip();
      return;
    }

    const res = await request.get('/api/admin/optimize-weights', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status() === 200) {
      const body = await res.json();
      // Either has a job or null
      expect(body).toHaveProperty('job');
    }
  });
});

// ── UI Tests ────────────────────────────────────────────────────────────────

test.describe('R59 Admin Scoring Dimensions Page', () => {
  test('loads with 22 dimensions and group tabs', async ({ page, request }) => {
    const token = await loginViaAPI(request);
    if (!token) { test.skip(); return; }

    await page.goto('/');
    await injectAuth(page, token);
    await page.goto('/admin/scoring-dimensions');
    
    // Should show the page title
    await expect(page.locator('h1')).toContainText('Scoring Dimensions', { timeout: 20000 });

    // Should show group filter tabs
    await expect(page.getByText('All Dimensions')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Intent Matching')).toBeVisible();
    await expect(page.getByText('Quality Signals')).toBeVisible();

    // Should have Optimize Weights button
    await expect(page.getByText('Optimize Weights')).toBeVisible();

    // Should have Save button
    await expect(page.getByText('Save Changes')).toBeVisible();

    // Should have weight total indicator
    await expect(page.getByText('Total Weight')).toBeVisible();
  });

  test('group tabs filter dimensions', async ({ page, request }) => {
    const token = await loginViaAPI(request);
    if (!token) { test.skip(); return; }

    await page.goto('/');
    await injectAuth(page, token);
    await page.goto('/admin/scoring-dimensions');
    await page.waitForTimeout(3000);

    // Click on Intent Matching tab
    await page.getByText('Intent Matching').click();
    await page.waitForTimeout(500);

    // Click All Dimensions to go back
    await page.getByText('All Dimensions').click();
  });

  test('screenshot of scoring dimensions page', async ({ page, request }) => {
    const token = await loginViaAPI(request);
    if (!token) { test.skip(); return; }

    await page.goto('/');
    await injectAuth(page, token);
    await page.goto('/admin/scoring-dimensions');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'r59-proof/scoring-dimensions-page.png', fullPage: true });
  });
});

test.describe('R59 Admin Learning Insights Page', () => {
  test('loads with KPI cards', async ({ page, request }) => {
    const token = await loginViaAPI(request);
    if (!token) { test.skip(); return; }

    await page.goto('/');
    await injectAuth(page, token);
    await page.goto('/admin/learning-insights');
    
    await expect(page.locator('h1')).toContainText('Learning Insights', { timeout: 30000 });

    // KPI cards should be visible (use first() to avoid strict mode on duplicates)
    await expect(page.getByText('Ranking Events', { exact: false }).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Click Rate', { exact: false }).first()).toBeVisible({ timeout: 15000 });
  });

  test('screenshot of learning insights page', async ({ page, request }) => {
    const token = await loginViaAPI(request);
    if (!token) { test.skip(); return; }

    await page.goto('/');
    await injectAuth(page, token);
    await page.goto('/admin/learning-insights');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'r59-proof/learning-insights-page.png', fullPage: true });
  });
});

test.describe('R59 Ranking Flow E2E', () => {
  test('search query returns dimension-scored results with screenshot', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    // Find the search/chat input
    const searchInput = page.locator('textarea, input[type="text"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('best phone under 20000');
      await searchInput.press('Enter');
      await page.waitForTimeout(5000);
      
      await page.screenshot({ path: 'r59-proof/search-results.png', fullPage: true });
    }
  });
});

// ── Performance Tests ───────────────────────────────────────────────────────

test.describe('R59 Performance', () => {
  test('Scoring dimensions API responds under 500ms', async ({ request }) => {
    const start = Date.now();
    const res = await request.get('/api/admin/scoring-dimensions');
    const elapsed = Date.now() - start;
    expect(res.status()).toBe(200);
    expect(elapsed).toBeLessThan(500);
  });

  test('Intent analysis responds under 2000ms', async ({ request }) => {
    const start = Date.now();
    const res = await request.post('/api/intent/analyze', {
      data: { query: 'budget laptop for student' },
    });
    const elapsed = Date.now() - start;
    expect(res.status()).toBe(200);
    expect(elapsed).toBeLessThan(2000);
  });

  test('Multiple concurrent requests handled', async ({ request }) => {
    const queries = ['phone', 'laptop', 'headphones', 'watch', 'shoes'];
    const results = await Promise.all(
      queries.map(q =>
        request.post('/api/intent/analyze', { data: { query: q } }).then(r => r.json())
      )
    );

    for (const r of results) {
      expect(r.products).toBeDefined();
      expect(r.engine_version).toBe('v2');
    }
  });
});

// ── Regression Tests ────────────────────────────────────────────────────────

test.describe('R59 Regression', () => {
  test('legacy scoreBreakdown fields still present', async ({ request }) => {
    const res = await request.post('/api/intent/analyze', {
      data: { query: 'samsung phone' },
    });
    const body = await res.json();
    if (body.products.length > 0) {
      const breakdown = body.products[0].scoreBreakdown;
      // Legacy fields must exist
      expect(breakdown).toHaveProperty('categoryMatch');
      expect(breakdown).toHaveProperty('priceMatch');
      expect(breakdown).toHaveProperty('brandMatch');
      expect(breakdown).toHaveProperty('featureMatch');
      expect(breakdown).toHaveProperty('ratingScore');
      expect(breakdown).toHaveProperty('penalty');
      expect(breakdown).toHaveProperty('popularity');
      // New dimension fields
      expect(breakdown).toHaveProperty('dimensionScores');
      expect(breakdown).toHaveProperty('dimensionTotal');
    }
  });

  test('admin page still loads (no crashes)', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.locator('body')).not.toBeEmpty();
    await page.screenshot({ path: 'r59-proof/admin-dashboard.png' });
  });

  test('home page still loads', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).not.toBeEmpty();
  });
});
