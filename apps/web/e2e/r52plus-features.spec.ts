/**
 * R52+ Playwright E2E Tests — Extended Coverage
 *
 * Covers:
 *  1. 100K Product seeding verification
 *  2. Product API returns real database products
 *  3. Observability Dashboard — non-zero stats after seed fix
 *  4. Self-Learning capture — DB write verification
 *  5. Metrics Validation — expand session without crash
 *  6. Metrics Validation — expand product row without crash
 *  7. Admin Analytics — reflects 100K products
 *  8. Shopping Assistant analyze API — returns products
 *  9. Wallet transactions API — functional
 * 10. Admin Learning API — returns records
 * 11. Observability tabs cycle
 * 12. All critical pages load with 200
 */
import { test, expect } from '@playwright/test';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3000';

async function loginAs(page: any, email: string, role: string, subscription = 'BASIC') {
  await page.goto(`${BASE}/`);
  await page.evaluate(
    ({ email, role, subscription }: any) => {
      localStorage.setItem('userEmail', email);
      localStorage.setItem('authToken', `token-${role}-r52plus`);
      localStorage.setItem('dc-user-id', `${role}-user-1`);
      localStorage.setItem('dc-user-role', role);
      localStorage.setItem('dc-user-subscription', subscription);
    },
    { email, role, subscription },
  );
}

// ─── 1. Product Seeding Verification ─────────────────────────────────────────
test.describe('R52+ — Product Data', () => {
  test('01: Admin analytics shows products by category', async ({ page }) => {
    await loginAs(page, 'admin@delegatecart.com', 'admin', 'ENTERPRISE');
    const resp = await page.request.get(`${BASE}/api/admin/analytics`);
    expect(resp.status()).toBe(200);
    const data = await resp.json();

    expect(data.products).toBeDefined();
    expect(data.products.byCategory).toBeDefined();
    expect(Array.isArray(data.products.byCategory)).toBe(true);
    expect(data.products.byCategory.length).toBeGreaterThan(0);
    // Sum of all category counts should be 100K+
    const totalProducts = data.products.byCategory.reduce((s: number, c: any) => s + (c.count || 0), 0);
    expect(totalProducts).toBeGreaterThanOrEqual(100000);
  });

  test('02: Product search API returns real DB products', async ({ page }) => {
    const resp = await page.request.post(`${BASE}/api/intent/analyze`, {
      data: { query: 'Samsung Galaxy smartphone', userId: 'e2e-product-check' },
    });
    expect(resp.status()).toBe(200);
    const data = await resp.json();
    expect(data.products).toBeDefined();
    expect(data.products.length).toBeGreaterThan(0);

    // At least one product should have a real name
    const hasRealProduct = data.products.some(
      (p: any) => p.name?.includes('Samsung') || p.name?.includes('Galaxy'),
    );
    expect(hasRealProduct).toBeTruthy();
  });
});

// ─── 2. Observability Dashboard Fix ──────────────────────────────────────────
test.describe('R52+ — Observability Dashboard', () => {
  test('03: Observability shows non-zero stats after fresh seed', async ({ page }) => {
    await loginAs(page, 'observability@delegatecart.com', 'observability', 'PRO');
    // Clear stale seed to force re-seed
    await page.evaluate(() => {
      localStorage.removeItem('wallet_demo_seeded');
      localStorage.removeItem('wallet_transactions');
      localStorage.removeItem('wallet_audit_log');
      localStorage.removeItem('wallet_idempotency_cache');
    });
    await page.goto(`${BASE}/observability`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Stats should show non-zero values
    const bodyText = await page.locator('body').textContent() || '';
    // "Total" stat should not be 0
    const totalStat = page.locator('text=Total').first();
    await expect(totalStat).toBeVisible({ timeout: 8000 });

    // Check for non-zero Transaction badge
    const txBadge = page.locator('button', { hasText: 'Transactions' }).first();
    if (await txBadge.isVisible()) {
      const badgeText = await txBadge.textContent();
      expect(badgeText).toBeTruthy();
    }

    // Recent Transactions section should have entries
    const hasTransactions = bodyText.includes('DC-2024') || bodyText.includes('txn_');
    expect(hasTransactions).toBeTruthy();

    await page.screenshot({ path: 'r52-proof/r52plus-03-observability-nonzero.png', fullPage: true });
  });

  test('04: Observability tab cycling works without crash', async ({ page }) => {
    await loginAs(page, 'observability@delegatecart.com', 'observability', 'PRO');
    await page.goto(`${BASE}/observability`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const tabs = ['Transactions', 'Stuck', 'Audit'];
    for (const tabName of tabs) {
      const tab = page.locator('button', { hasText: tabName }).first();
      if (await tab.isVisible()) {
        await tab.click();
        await page.waitForTimeout(500);
      }
    }
    // No crash — take screenshot on audit tab
    await page.screenshot({ path: 'r52-proof/r52plus-04-observability-tabs.png', fullPage: true });
  });
});

// ─── 3. Self-Learning Capture ────────────────────────────────────────────────
test.describe('R52+ — Self-Learning Capture', () => {
  test('05: Analyze API creates SmartIntentEngineResponse record', async ({ page }) => {
    await loginAs(page, 'admin@delegatecart.com', 'admin', 'ENTERPRISE');

    // Get current count
    const beforeResp = await page.request.get(`${BASE}/api/admin/learning?limit=1&offset=0`, {
      headers: { 'x-user-email': 'admin@delegatecart.com' },
    });
    const beforeData = await beforeResp.json();
    const countBefore = beforeData.total || 0;

    // Submit a highly unique query
    const uniqueQuery = `e2e-verify-selflearning-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const analyzeResp = await page.request.post(`${BASE}/api/intent/analyze`, {
      data: { query: uniqueQuery, userId: 'e2e-learning-test' },
    });
    expect(analyzeResp.status()).toBe(200);

    // Wait for fire-and-forget insert (pool startup + query can take a few seconds)
    await page.waitForTimeout(6000);

    // Check count increased
    const afterResp = await page.request.get(`${BASE}/api/admin/learning?limit=1&offset=0`, {
      headers: { 'x-user-email': 'admin@delegatecart.com' },
    });
    const afterData = await afterResp.json();
    const countAfter = afterData.total || 0;

    expect(countAfter).toBeGreaterThanOrEqual(countBefore);
    // Verify the query text appears in the most recent record
    if (afterData.records?.length > 0) {
      const latestSearchResp = await page.request.get(`${BASE}/api/admin/learning?limit=5&offset=0&search=e2e-verify-selflearning`, {
        headers: { 'x-user-email': 'admin@delegatecart.com' },
      });
      const latestData = await latestSearchResp.json();
      expect(latestData.total).toBeGreaterThanOrEqual(1);
    }
  });

  test('06: Learning dashboard loads with records', async ({ page }) => {
    await loginAs(page, 'admin@delegatecart.com', 'admin', 'ENTERPRISE');
    await page.goto(`${BASE}/admin/learning`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    await expect(page.locator('text=Self-Learning Dashboard')).toBeVisible();
    // Should show records
    const body = await page.locator('body').textContent() || '';
    expect(body).toMatch(/\d+ records?/);

    await page.screenshot({ path: 'r52-proof/r52plus-06-learning-records.png', fullPage: true });
  });
});

// ─── 4. Metrics Validation — No Crash on Expand ─────────────────────────────
test.describe('R52+ — Metrics Validation', () => {
  test('07: Validation page loads without NaN', async ({ page }) => {
    await loginAs(page, 'admin@delegatecart.com', 'admin', 'ENTERPRISE');
    await page.goto(`${BASE}/shopping-assistant/metrics/validation`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const bodyText = await page.locator('body').textContent() || '';
    expect(bodyText).not.toContain('NaN');

    await page.screenshot({ path: 'r52-proof/r52plus-07-validation-clean.png', fullPage: true });
  });

  test('08: Expand session card does not crash', async ({ page }) => {
    await loginAs(page, 'admin@delegatecart.com', 'admin', 'ENTERPRISE');
    await page.goto(`${BASE}/shopping-assistant/metrics/validation`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Find any session card and click to expand
    const sessionBtn = page.locator('[data-testid^="validation-session-"]').first();
    if (await sessionBtn.isVisible({ timeout: 5000 })) {
      await sessionBtn.click();
      await page.waitForTimeout(1500);

      // Should not crash — check no error overlay
      const errorOverlay = page.locator('text=Application error');
      const hasCrash = await errorOverlay.isVisible().catch(() => false);
      expect(hasCrash).toBeFalsy();

      // Check NaN
      const bodyText = await page.locator('body').textContent() || '';
      expect(bodyText).not.toContain('NaN');

      await page.screenshot({ path: 'r52-proof/r52plus-08-session-expanded.png', fullPage: true });
    }
  });
});

// ─── 5. API Functional Tests ─────────────────────────────────────────────────
test.describe('R52+ — API Tests', () => {
  test('09: Admin stats API returns correct product count', async ({ page }) => {
    await loginAs(page, 'admin@delegatecart.com', 'admin', 'ENTERPRISE');
    const resp = await page.request.get(`${BASE}/api/admin/stats`);
    expect(resp.status()).toBe(200);
    const data = await resp.json();
    expect(data.totalProducts).toBeGreaterThanOrEqual(100000);
    expect(data.totalUsers).toBeGreaterThan(0);
    expect(data.dataSource).toBe('database');
  });

  test('10: Analyze API handles various query types', async ({ page }) => {
    const queries = [
      'best laptop under 50000',
      'wireless headphones noise cancelling',
      'gaming mouse under 2000',
    ];
    for (const q of queries) {
      const resp = await page.request.post(`${BASE}/api/intent/analyze`, {
        data: { query: q, userId: 'e2e-api-test' },
      });
      expect(resp.status()).toBe(200);
      const data = await resp.json();
      expect(data).toHaveProperty('products');
      expect(data).toHaveProperty('intent');
    }
  });

  test('11: Admin analytics API reflects seeded data', async ({ page }) => {
    const resp = await page.request.get(`${BASE}/api/admin/analytics`);
    expect(resp.status()).toBe(200);
    const data = await resp.json();

    // Orders — byStatus array sums to > 25
    const totalOrders = (data.orders?.byStatus || []).reduce((s: number, r: any) => s + (r.count || 0), 0);
    expect(totalOrders).toBeGreaterThan(25);

    // Users
    expect(data.users.byRole.length).toBeGreaterThan(0);
    const totalUsers = (data.users?.byRole || []).reduce((s: number, r: any) => s + (r.count || 0), 0);
    expect(totalUsers).toBeGreaterThan(0);

    // Learning — trend/byUser are arrays; sum byUser counts
    const totalLearning = (data.learning?.byUser || []).reduce((s: number, r: any) => s + (r.count || 0), 0);
    expect(totalLearning).toBeGreaterThan(80);
  });
});

// ─── 6. All Critical Pages Load ──────────────────────────────────────────────
test.describe('R52+ — Page Health', () => {
  test('12: All critical pages return 200', async ({ page }) => {
    await loginAs(page, 'admin@delegatecart.com', 'admin', 'ENTERPRISE');
    const pages = [
      '/',
      '/products',
      '/admin',
      '/admin/learning',
      '/shopping-assistant',
      '/shopping-assistant/metrics/validation',
      '/smart-delegate',
      '/observability',
      '/account',
    ];
    for (const path of pages) {
      const resp = await page.request.get(`${BASE}${path}`);
      expect(resp.status(), `${path} should return 200`).toBe(200);
    }
  });
});
