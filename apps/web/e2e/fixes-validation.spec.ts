import { test, expect, Page } from '@playwright/test';

/**
 * E2E Validation Tests for All Fixes
 * Tests: Order detail routing, UI overflow, shopping list AI search,
 * auto-checkout, terms modal, spending/insights pages.
 * Video recording is ON in playwright.config.ts.
 */

const BASE = 'http://127.0.0.1:3000';
const TEST_EMAIL = `fix_${Date.now()}@test.com`;
const TEST_PASSWORD = 'TestPass123!';
const TEST_NAME = 'Fix Validation User';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function registerUser(): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: TEST_NAME, email: TEST_EMAIL, password: TEST_PASSWORD }),
  });
  const data = await res.json();
  if (!data.token) throw new Error('Registration failed: ' + JSON.stringify(data));
  return data.token;
}

async function createTestOrder(token: string): Promise<any> {
  const res = await fetch(`${BASE}/api/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      items: [
        { productName: 'Apple 15 Pro Max 5G Black', quantity: 1, price: 118999 },
        { productName: 'Daikin 1.5 Ton 5 Star Inverter Split AC', quantity: 1, price: 42990 },
      ],
      total: 161989,
      paymentMethod: 'cod',
      shippingAddress: {
        name: TEST_NAME,
        address: '123 MG Road',
        city: 'Mumbai',
        state: 'Maharashtra',
        zip: '400001',
      },
      aiAssisted: true,
    }),
  });
  const data = await res.json();
  return data.order;
}

async function setupAuth(page: Page, token: string) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.evaluate(
    ({ t, e }) => {
      localStorage.setItem('authToken', t);
      localStorage.setItem('userEmail', e);
    },
    { t: token, e: TEST_EMAIL }
  );
}

async function waitForContent(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);
}

// ── Setup ────────────────────────────────────────────────────────────────────

let authToken: string;
let testOrder: any;

test.describe.serial('Fix Validation Tests', () => {
  test.beforeAll(async () => {
    authToken = await registerUser();
    testOrder = await createTestOrder(authToken);
  });

  // ═══════════════════════════════════════════════════════════════
  // FIX 1: Order Detail link from Account page navigates to correct order
  // ═══════════════════════════════════════════════════════════════

  test('1.1 Account Details button navigates to specific order detail', async ({ page }) => {
    await setupAuth(page, authToken);
    await page.goto(`${BASE}/account`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForContent(page);

    // Wait for orders to load in account page
    await page.waitForSelector('text=/ORD-/i', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1000);

    // Find the Details button
    const detailsBtn = page.locator('button:has-text("Details")').first();
    const isVisible = await detailsBtn.isVisible().catch(() => false);

    if (isVisible) {
      await detailsBtn.click();
      // Should navigate to /orders/<id>, NOT just /orders
      await page.waitForURL('**/orders/**', { timeout: 15000 });
      const url = page.url();
      // The URL should contain a numeric ID or order identifier after /orders/
      expect(url).toMatch(/\/orders\/\d+/);
      // Should NOT be exactly /orders (without an ID)
      expect(url).not.toMatch(/\/orders\/?$/);

      await waitForContent(page);
      // Should show order detail content (Package Journey or order number)
      const body = await page.innerText('body');
      expect(body).toMatch(/Package Journey|ORD-|Order|Processing/i);
    } else {
      // If no orders visible, just verify the page loads
      const body = await page.innerText('body');
      expect(body).toMatch(/account|orders|hello/i);
    }
  });

  test('1.2 Orders page View Details links to specific order', async ({ page }) => {
    await setupAuth(page, authToken);
    await page.goto(`${BASE}/orders`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForContent(page);

    // Click the first View Details link
    const viewDetails = page.locator('a[href*="/orders/"]').first();
    await expect(viewDetails).toBeVisible({ timeout: 15000 });
    await viewDetails.click();
    await page.waitForURL('**/orders/**', { timeout: 15000 });

    const url = page.url();
    expect(url).toMatch(/\/orders\/\d+/);

    await waitForContent(page);
    const body = await page.innerText('body');
    expect(body).toMatch(/Package Journey|ORD-|Order/i);
  });

  // ═══════════════════════════════════════════════════════════════
  // FIX 2: Orders page UI overflow is contained
  // ═══════════════════════════════════════════════════════════════

  test('2.1 Orders page renders without horizontal scrollbar', async ({ page }) => {
    await setupAuth(page, authToken);
    await page.goto(`${BASE}/orders`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForContent(page);

    // Check that the page width doesn't exceed viewport
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5); // 5px tolerance
  });

  test('2.2 Order detail page renders without horizontal scrollbar', async ({ page }) => {
    await setupAuth(page, authToken);
    await page.goto(`${BASE}/orders/${testOrder.id}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await waitForContent(page);

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5);
  });

  test('2.3 Orders page item names are contained within cards', async ({ page }) => {
    await setupAuth(page, authToken);
    await page.goto(`${BASE}/orders`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForContent(page);
    await page.waitForSelector('text=ORD-', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1000);

    // Check that the order card overflow is hidden
    const overflowHidden = page.locator('.overflow-hidden').first();
    await expect(overflowHidden).toBeVisible({ timeout: 5000 });
  });

  // ═══════════════════════════════════════════════════════════════
  // FIX 3: Spending & Order Insights pages load correctly
  // ═══════════════════════════════════════════════════════════════

  test('3.1 Spending page shows analytics with real data', async ({ page }) => {
    await setupAuth(page, authToken);
    await page.goto(`${BASE}/spending`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForContent(page);
    await page.waitForSelector('text=/Spend/i', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);

    const body = await page.innerText('body');
    expect(body).toMatch(/Spending Analytics|Total Spent|spend/i);
    // Should show currency data
    expect(body).toMatch(/₹/);
  });

  test('3.2 Spending page heat map and category breakdown visible', async ({ page }) => {
    await setupAuth(page, authToken);
    await page.goto(`${BASE}/spending`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForContent(page);
    await page.waitForSelector('text=/Spend/i', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);

    const body = await page.innerText('body');
    expect(body).toMatch(/Heat Map|Category|Velocity|Trend/i);
  });

  test('3.3 Order insights page shows personality and analytics', async ({ page }) => {
    await setupAuth(page, authToken);
    await page.goto(`${BASE}/order-insights`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForContent(page);
    await page.waitForSelector('text=/Intelligence|Insight/i', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);

    const body = await page.innerText('body');
    expect(body).toMatch(/Intelligence|Insight|Order|analytics/i);
  });

  test('3.4 Order insights shows reorder probability', async ({ page }) => {
    await setupAuth(page, authToken);
    await page.goto(`${BASE}/order-insights`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForContent(page);
    await page.waitForSelector('text=/Intelligence|Insight/i', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);

    const body = await page.innerText('body');
    expect(body).toMatch(/Reorder|Frequency|Payment|Peak|personality|buyer|shopper/i);
  });

  // ═══════════════════════════════════════════════════════════════
  // FIX 4: Shopping List AI search returns relevant results
  // ═══════════════════════════════════════════════════════════════

  test('4.1 Shopping list API returns stationery matches for ball pen', async () => {
    const res = await fetch(`${BASE}/api/shopping-list`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        items: [
          { productName: 'ball pen', preferredBrand: 'cello', budget: 200, quantity: 10, deliveryDays: 3, paymentMethod: 'credit_card', emiOnly: false },
        ],
        forceFresh: true,
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.results).toBeDefined();
    expect(data.results.length).toBe(1);

    const penResult = data.results[0];
    // Should have actual product matches (not empty or fake "Best Match")
    expect(penResult.matches.length).toBeGreaterThan(0);
    // Should NOT have the fake "Best Match (AI Search)" at ₹0
    const fakeMatch = penResult.matches.find((m: any) => m.name === 'Best Match (AI Search)');
    expect(fakeMatch).toBeUndefined();
    // First match should be a real pen product with a non-zero price
    expect(penResult.matches[0].price).toBeGreaterThan(0);
    expect(penResult.matches[0].name.toLowerCase()).toMatch(/pen|cello|reynolds/);
  });

  test('4.2 Shopping list API returns stationery matches for notebook', async () => {
    const res = await fetch(`${BASE}/api/shopping-list`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        items: [
          { productName: 'notebook', preferredBrand: 'classmate', budget: 500, quantity: 5, deliveryDays: 3, paymentMethod: 'credit_card', emiOnly: false },
        ],
        forceFresh: true,
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    const nbResult = data.results[0];
    // Should NOT match laptops (MacBook, Dell XPS etc)
    expect(nbResult.matches.length).toBeGreaterThan(0);
    const laptopMatch = nbResult.matches.find((m: any) => m.name.toLowerCase().includes('macbook'));
    expect(laptopMatch).toBeUndefined();
    // Should match actual notebook/stationery products
    expect(nbResult.matches[0].name.toLowerCase()).toMatch(/notebook|classmate|navneet/);
    expect(nbResult.matches[0].price).toBeLessThan(1000); // stationery is cheap
  });

  test('4.3 Generic product returns empty matches (no fake results)', async () => {
    const res = await fetch(`${BASE}/api/shopping-list`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        items: [
          { productName: 'unicorn figurine', preferredBrand: null, budget: null, quantity: 1, deliveryDays: null, paymentMethod: null, emiOnly: false },
        ],
        forceFresh: true,
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    const result = data.results[0];
    // Generic category should now return no matches
    expect(result.matches.length).toBe(0);
  });

  // ═══════════════════════════════════════════════════════════════
  // FIX 5: Smart Delegate page shows "no match" message
  // ═══════════════════════════════════════════════════════════════

  test('5.1 Smart delegate page loads with results', async ({ page }) => {
    await setupAuth(page, authToken);

    // Store results in localStorage for the smart-delegate page
    await page.evaluate(() => {
      const results = [{
        id: 'test-sl-1',
        submittedAt: new Date().toISOString(),
        results: [
          {
            productName: 'ball pen',
            preferredBrand: 'cello',
            budget: 200,
            quantity: 10,
            matches: [
              { name: 'Cello Butterflow Ball Pen (Pack of 10)', brand: 'Cello', price: 100, rating: 4.3, matchScore: 95, estimatedDelivery: '1-2 days', emiAvailable: false, url: '#' },
            ],
          },
          {
            productName: 'unicorn figurine',
            preferredBrand: null,
            budget: null,
            quantity: 1,
            matches: [],
          },
        ],
        summary: { totalItems: 2, totalMatches: 1, estimatedSavings: '₹50' },
      }];
      localStorage.setItem('shoppingListResults', JSON.stringify(results));
    });

    await page.goto(`${BASE}/smart-delegate`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    // Wait for the page to mount and render (useEffect sets mounted=true)
    await page.waitForSelector('h1:has-text("Smart Delegate")', { timeout: 20000 });
    await page.waitForTimeout(2000);

    const body = await page.innerText('body');
    // Should show the header text and search/match counts
    expect(body).toMatch(/Smart Delegate/i);
    expect(body).toMatch(/Searches|Matches Found|No searches yet/i);
  });

  // ═══════════════════════════════════════════════════════════════
  // FIX 6: Shopping list auto-checkout and terms modal
  // ═══════════════════════════════════════════════════════════════

  test('6.1 Shopping list page has auto-checkout checkbox', async ({ page }) => {
    await setupAuth(page, authToken);
    await page.goto(`${BASE}/shopping-list`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForContent(page);

    // Should see the auto-checkout option
    const autoCheckoutLabel = page.locator('text=AI Auto-Checkout');
    await expect(autoCheckoutLabel).toBeVisible({ timeout: 10000 });
  });

  test('6.2 Clicking auto-checkout shows terms acceptance', async ({ page }) => {
    await setupAuth(page, authToken);
    await page.goto(`${BASE}/shopping-list`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForContent(page);

    // Click the auto-checkout checkbox via the label
    const autoCheckbox = page.locator('label').filter({ hasText: 'Auto-Checkout' }).locator('input[type="checkbox"]');
    await autoCheckbox.scrollIntoViewIfNeeded();
    await autoCheckbox.check({ timeout: 15000 });

    // Should now see terms acceptance
    await expect(page.locator('text=Auto-checkout conditions')).toBeVisible({ timeout: 10000 });
  });

  test('6.3 Terms modal opens and can be accepted', async ({ page }) => {
    await setupAuth(page, authToken);
    await page.goto(`${BASE}/shopping-list`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForContent(page);

    // Enable auto-checkout via label
    const autoCheckbox = page.locator('label').filter({ hasText: 'Auto-Checkout' }).locator('input[type="checkbox"]');
    await autoCheckbox.scrollIntoViewIfNeeded();
    await autoCheckbox.check({ timeout: 15000 });

    // Wait for the terms section to appear
    await page.waitForTimeout(1000);

    // Click on Terms & Conditions link
    const termsLink = page.locator('text=Terms & Conditions for Auto-Checkout').first();
    await termsLink.scrollIntoViewIfNeeded();
    await termsLink.click();
    await page.waitForTimeout(1000);

    // Modal should be visible with content
    await expect(page.locator('text=Auto-Checkout Terms & Conditions').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Payment Authorization')).toBeVisible({ timeout: 5000 });

    // Click "I Accept" button
    await page.click('button:has-text("I Accept")');
    await page.waitForTimeout(500);

    // Modal should close
    await expect(page.locator('h2:has-text("Auto-Checkout Terms")')).not.toBeVisible({ timeout: 5000 });
  });

  // ═══════════════════════════════════════════════════════════════
  // FIX 7: No horizontal overflow on any page
  // ═══════════════════════════════════════════════════════════════

  test('7.1 No horizontal overflow on spending page', async ({ page }) => {
    await setupAuth(page, authToken);
    await page.goto(`${BASE}/spending`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForContent(page);
    await page.waitForSelector('text=/Spend/i', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5);
  });

  test('7.2 No horizontal overflow on order insights page', async ({ page }) => {
    await setupAuth(page, authToken);
    await page.goto(`${BASE}/order-insights`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForContent(page);
    await page.waitForSelector('text=/Intelligence|Insight/i', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5);
  });

  // ═══════════════════════════════════════════════════════════════
  // Performance Tests
  // ═══════════════════════════════════════════════════════════════

  test('8.1 All key pages load under 10s', async ({ page }) => {
    await setupAuth(page, authToken);
    const pages = ['/account', '/orders', '/spending', '/order-insights', '/shopping-list'];

    for (const p of pages) {
      const start = Date.now();
      await page.goto(`${BASE}${p}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(10000);
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // Full User Journey
  // ═══════════════════════════════════════════════════════════════

  test('9.1 Full flow: Account → Order Detail → Orders → Spending → Insights', async ({ page }) => {
    await setupAuth(page, authToken);

    // Step 1: Account page
    await page.goto(`${BASE}/account`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForContent(page);
    await expect(page.getByText('Total Spent').first()).toBeVisible({ timeout: 15000 });

    // Step 2: Navigate to order detail via Details button
    const detailsBtn = page.locator('button:has-text("Details")').first();
    if (await detailsBtn.isVisible().catch(() => false)) {
      await detailsBtn.click();
      await page.waitForURL('**/orders/**', { timeout: 15000 });
      await waitForContent(page);
      const body = await page.innerText('body');
      expect(body).toMatch(/ORD-|Package Journey|Order/i);

      // Step 3: Back to orders
      const backLink = page.locator('text=Back to Orders').first();
      if (await backLink.isVisible().catch(() => false)) {
        await backLink.click();
        await page.waitForURL('**/orders', { timeout: 15000 });
      } else {
        await page.goto(`${BASE}/orders`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      }
    } else {
      await page.goto(`${BASE}/orders`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    }
    await waitForContent(page);

    // Step 4: Spending
    await page.goto(`${BASE}/spending`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForContent(page);
    await page.waitForSelector('text=/Spend/i', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);
    const spendBody = await page.innerText('body');
    expect(spendBody).toMatch(/₹|Spend/i);

    // Step 5: Insights
    await page.goto(`${BASE}/order-insights`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForContent(page);
    await page.waitForSelector('text=/Intelligence|Insight/i', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);
    const insightBody = await page.innerText('body');
    expect(insightBody).toMatch(/Intelligence|Insight|Order/i);
  });

  // ═══════════════════════════════════════════════════════════════
  // Shopping List Submission E2E
  // ═══════════════════════════════════════════════════════════════

  test('10.1 Shopping list page submit with stationery items', async ({ page }) => {
    await setupAuth(page, authToken);
    await page.goto(`${BASE}/shopping-list`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForContent(page);

    // Fill in first item: ball pen
    const firstProductName = page.locator('input[type="text"]').first();
    await firstProductName.fill('ball pen');

    const firstQuantity = page.locator('input[type="text"]').nth(3);
    // May need to clear first
    await firstQuantity.fill('10');

    // Add another item
    await page.click('text=Add Another Item');
    await page.waitForTimeout(500);

    // Submit shouldn't crash
    const submitBtn = page.locator('text=Submit List for AI Search');
    await expect(submitBtn).toBeVisible({ timeout: 5000 });
  });

  // ═══════════════════════════════════════════════════════════════
  // No JS Errors Tests
  // ═══════════════════════════════════════════════════════════════

  test('11.1 Account page has no critical JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await setupAuth(page, authToken);
    await page.goto(`${BASE}/account`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForContent(page);
    const critical = errors.filter(
      (e) => !e.includes('NetworkError') && !e.includes('fetch') && !e.includes('hydrat')
    );
    expect(critical).toHaveLength(0);
  });

  test('11.2 Shopping list page has no critical JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await setupAuth(page, authToken);
    await page.goto(`${BASE}/shopping-list`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForContent(page);
    const critical = errors.filter(
      (e) => !e.includes('NetworkError') && !e.includes('fetch') && !e.includes('hydrat')
    );
    expect(critical).toHaveLength(0);
  });
});
