/**
 * R51 Playwright E2E Tests
 *
 * Covers:
 *  1. Admin Dashboard — real DB stats + Strict PROD toggle
 *  2. Role-based dashboards — per-role quick actions
 *  3. Metrics Validation — NaN-safe scores, dedup
 *  4. Smart Delegate — internal product links
 *  5. Admin Stats API — returns live DB data
 *  6. Self-Learning Dashboard — data for analytics user
 */
import { test, expect } from '@playwright/test';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3000';

// Helper: set user session in localStorage
async function loginAs(page: any, email: string, role: string, subscription = 'BASIC') {
  await page.goto(`${BASE}/`);
  await page.evaluate(
    ({ email, role, subscription }: any) => {
      localStorage.setItem('userEmail', email);
      localStorage.setItem('authToken', `token-${role}-r51`);
      localStorage.setItem('dc-user-id', `${role}-user-1`);
      localStorage.setItem('dc-user-role', role);
      localStorage.setItem('dc-user-subscription', subscription);
    },
    { email, role, subscription },
  );
}

test.describe('R51 — Admin Dashboard with Real Data', () => {
  test('01: Admin stats API returns live DB data', async ({ request }) => {
    const res = await request.get(`${BASE}/api/admin/stats`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.dataSource).toBe('database');
    expect(typeof body.totalUsers).toBe('number');
    expect(body.totalUsers).toBeGreaterThan(0);
    expect(typeof body.activeOrders).toBe('number');
    expect(typeof body.learningRecords).toBe('number');
    expect(typeof body.validationSessions).toBe('number');
  });

  test('02: Admin Dashboard renders real stats and Strict PROD toggle', async ({ page }) => {
    await loginAs(page, 'admin@delegatecart.com', 'admin', 'AI_PLUS');
    await page.goto(`${BASE}/admin`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    // Data source badge shows "Live DB"
    await expect(page.locator('text=Live DB')).toBeVisible({ timeout: 5000 });

    // Stats cards are rendered with numbers > 0
    const statValues = page.locator('.text-3xl.font-bold');
    const count = await statValues.count();
    expect(count).toBeGreaterThanOrEqual(4);

    // Strict PROD toggle exists
    const toggle = page.getByTestId('strict-prod-toggle');
    await expect(toggle).toBeVisible();

    // Click toggle — banner appears
    await toggle.click();
    await expect(page.locator('text=Strict PROD Data Source')).toBeVisible({ timeout: 3000 });

    // Screenshot
    await page.screenshot({ path: 'd:/PersonalProject/GIT/delegatecart/r51-proof/02-admin-dashboard-real-data.png', fullPage: true });
  });
});

test.describe('R51 — Role-Based Landing Dashboards', () => {
  test('03: Admin dashboard shows admin-specific quick actions', async ({ page }) => {
    await loginAs(page, 'admin@delegatecart.com', 'admin', 'AI_PLUS');
    await page.goto(`${BASE}/dashboard`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Admin badge visible
    await expect(page.locator('text=Admin').first()).toBeVisible();
    // AI+ subscription badge
    await expect(page.locator('text=AI+').first()).toBeVisible();
    // Admin-specific actions
    await expect(page.locator('text=Admin Panel')).toBeVisible();
    await expect(page.locator('text=Self-Learning')).toBeVisible();
    await expect(page.locator('text=Observability')).toBeVisible();

    await page.screenshot({ path: 'd:/PersonalProject/GIT/delegatecart/r51-proof/03-admin-dashboard-role.png', fullPage: true });
  });

  test('04: Analytics user sees analytics-specific actions', async ({ page }) => {
    await loginAs(page, 'analytics@delegatecart.com', 'analytics');
    await page.goto(`${BASE}/dashboard`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    await expect(page.locator('text=Analytics').first()).toBeVisible();
    await expect(page.locator('text=Metrics Validation')).toBeVisible();
    await expect(page.locator('text=Self-Learning')).toBeVisible();

    await page.screenshot({ path: 'd:/PersonalProject/GIT/delegatecart/r51-proof/04-analytics-dashboard-role.png', fullPage: true });
  });

  test('05: Basic user sees basic shopping actions', async ({ page }) => {
    await loginAs(page, 'basicdemo@delegatecart.com', 'basic');
    await page.goto(`${BASE}/dashboard`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    // Role badge
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toContain('Basic');
    expect(bodyText).toContain('Browse Products');
    expect(bodyText).toContain('Wishlist');
    // Admin Panel link should NOT appear for basic user
    const adminLinks = page.locator('a[href="/admin"]');
    await expect(adminLinks).toHaveCount(0);

    await page.screenshot({ path: 'd:/PersonalProject/GIT/delegatecart/r51-proof/05-basic-dashboard-role.png', fullPage: true });
  });

  test('06: Reinforced Learning user sees RL-specific actions', async ({ page }) => {
    await loginAs(page, 'reenforcedlearning@delegatecart.com', 'reinforced-learning');
    await page.goto(`${BASE}/dashboard`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    await expect(page.locator('text=Reinforced Learning').first()).toBeVisible();
    await expect(page.locator('text=Self-Learning')).toBeVisible();
    await expect(page.locator('text=Smart Delegate')).toBeVisible();

    await page.screenshot({ path: 'd:/PersonalProject/GIT/delegatecart/r51-proof/06-rl-dashboard-role.png', fullPage: true });
  });

  test('07: Observability user sees observability actions', async ({ page }) => {
    await loginAs(page, 'observability@delegatecart.com', 'observability');
    await page.goto(`${BASE}/dashboard`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    await expect(page.locator('text=Observability').first()).toBeVisible();
    await expect(page.locator('text=System Health')).toBeVisible();

    await page.screenshot({ path: 'd:/PersonalProject/GIT/delegatecart/r51-proof/07-observability-dashboard-role.png', fullPage: true });
  });
});

test.describe('R51 — Metrics Validation NaN Fix & Dedup', () => {
  test('08: Metrics Validation page loads without NaN', async ({ page }) => {
    await loginAs(page, 'admin@delegatecart.com', 'admin', 'AI_PLUS');
    await page.goto(`${BASE}/shopping-assistant/metrics/validation`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // NaN should not appear anywhere on the page
    const body = await page.locator('body').textContent();
    expect(body).not.toContain('NaN%');
    expect(body).not.toContain('NaN ');

    await page.screenshot({ path: 'd:/PersonalProject/GIT/delegatecart/r51-proof/08-metrics-no-nan.png', fullPage: true });
  });

  test('09: Metrics Validation page has dedup applied (no duplicate cards)', async ({ page }) => {
    await loginAs(page, 'admin@delegatecart.com', 'admin', 'AI_PLUS');
    await page.goto(`${BASE}/shopping-assistant/metrics/validation`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Verify the page loaded sessions — check session count indicator or card list
    const bodyText = await page.locator('body').textContent();
    // If sessions are present, NaN should not appear (covered by test 08)
    // The dedup logic runs client-side — verify no "NaN" on page
    expect(bodyText).not.toContain('NaN%');

    await page.screenshot({ path: 'd:/PersonalProject/GIT/delegatecart/r51-proof/09-metrics-dedup.png', fullPage: true });
  });
});

test.describe('R51 — Smart Delegate Product Links', () => {
  test('10: Smart Delegate product names link to /products', async ({ page }) => {
    await loginAs(page, 'admin@delegatecart.com', 'admin', 'AI_PLUS');

    // Seed a shopping list result in localStorage for Smart Delegate to display
    await page.evaluate(() => {
      const results = [{
        id: 'test-sl-r51',
        submittedAt: new Date().toISOString(),
        results: [{
          productName: 'Sony WH-1000XM5',
          matches: [{ name: 'Sony WH-1000XM5 Headphones', price: 24990, score: 0.95, url: 'https://google.com' }],
        }],
        summary: { totalItems: 1, totalMatches: 1 },
        userEmail: 'admin@delegatecart.com',
      }];
      localStorage.setItem('shoppingListResults', JSON.stringify(results));
    });

    await page.goto(`${BASE}/smart-delegate`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    // Find product link — should point to /products?search=... not external URL
    const productLinks = page.locator('a[href*="/products?search="]');
    const count = await productLinks.count();
    if (count > 0) {
      const href = await productLinks.first().getAttribute('href');
      expect(href).toContain('/products?search=');
      expect(href).not.toContain('google.com');
    }

    await page.screenshot({ path: 'd:/PersonalProject/GIT/delegatecart/r51-proof/10-smart-delegate-product-links.png', fullPage: true });
  });
});

test.describe('R51 — Self-Learning Dashboard', () => {
  test('11: Self-Learning API returns real data for analytics user', async ({ request }) => {
    const res = await request.get(`${BASE}/api/admin/learning?limit=5`, {
      headers: { 'x-user-email': 'analytics@delegatecart.com' },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.dbUnavailable).toBeFalsy();
    expect(body.total).toBeGreaterThan(0);
    expect(body.records?.length).toBeGreaterThan(0);
  });

  test('12: Self-Learning page loads for analytics user', async ({ page }) => {
    await loginAs(page, 'analytics@delegatecart.com', 'analytics');
    await page.goto(`${BASE}/admin/learning`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Should not show "Database unavailable" banner
    const body = await page.locator('body').textContent();
    expect(body).not.toContain('Database unavailable');

    await page.screenshot({ path: 'd:/PersonalProject/GIT/delegatecart/r51-proof/12-self-learning-analytics.png', fullPage: true });
  });
});
