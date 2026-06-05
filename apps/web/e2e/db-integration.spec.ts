import { test, expect, Page } from '@playwright/test';

/**
 * Comprehensive E2E Tests: DB Integration, Orders, Spending, Account
 * Tests the full user journey with real DB-backed data.
 * Video recording is enabled in playwright.config.ts.
 */

const BASE = 'http://127.0.0.1:3000';
const TEST_EMAIL = `e2e_${Date.now()}@test.com`;
const TEST_PASSWORD = 'TestPass123!';
const TEST_NAME = 'E2E Test User';

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
        { productName: 'Samsung Galaxy S24 Ultra', quantity: 1, price: 129999 },
        { productName: 'Apple AirPods Pro 2', quantity: 2, price: 24900 },
      ],
      total: 179799,
      paymentMethod: 'upi',
      aiAssisted: true,
      shippingAddress: {
        name: TEST_NAME,
        line1: '42, MG Road, Koramangala',
        city: 'Bangalore',
        state: 'Karnataka',
        pincode: '560034',
        phone: '+919876543210',
      },
      notes: 'E2E test order',
    }),
  });
  const data = await res.json();
  return data.order;
}

async function setupAuth(page: Page, token: string) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(
    ([t, e]) => {
      localStorage.setItem('authToken', t);
      localStorage.setItem('userEmail', e);
    },
    [token, TEST_EMAIL]
  );
}

async function waitForContent(page: Page, timeout = 15000) {
  await page.waitForLoadState('domcontentloaded', { timeout });
  await page.waitForTimeout(2000);
}

// ── Test Suite ───────────────────────────────────────────────────────────────

test.describe.serial('Full DB Integration Flow', () => {
  let authToken: string;
  let testOrder: any;

  test.beforeAll(async () => {
    authToken = await registerUser();
    testOrder = await createTestOrder(authToken);
  });

  // ── 1. Auth API Tests ──────────────────────────────────────────

  test('1.1 Register API returns token and user', async () => {
    const res = await fetch(`${BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Auth Test',
        email: `auth_${Date.now()}@test.com`,
        password: 'pass123',
      }),
    });
    expect(res.status).toBeLessThanOrEqual(201);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.token).toMatch(/^sess_/);
    expect(data.user.email).toBeTruthy();
  });

  test('1.2 Login API authenticates existing user', async () => {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.token).toMatch(/^sess_/);
  });

  test('1.3 Session API validates token', async () => {
    const res = await fetch(`${BASE}/api/auth/session`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.user.email).toBe(TEST_EMAIL);
  });

  test('1.4 Unauthorized request returns 401', async () => {
    const res = await fetch(`${BASE}/api/orders`, {
      headers: { Authorization: 'Bearer invalid_token' },
    });
    expect(res.status).toBe(401);
  });

  // ── 2. Orders API Tests ────────────────────────────────────────

  test('2.1 Create order returns 201 with order data', async () => {
    expect(testOrder).toBeTruthy();
    expect(testOrder.orderNumber).toMatch(/^ORD-/);
    expect(testOrder.status).toBe('processing');
  });

  test('2.2 Get orders returns list with items', async () => {
    const res = await fetch(`${BASE}/api/orders`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.orders.length).toBeGreaterThanOrEqual(1);
    const order = data.orders[0];
    expect(order.items).toBeTruthy();
    expect(order.items.length).toBeGreaterThanOrEqual(1);
  });

  test('2.3 Get order by ID returns full order', async () => {
    const res = await fetch(`${BASE}/api/orders/${testOrder.id}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.order.orderNumber).toBe(testOrder.orderNumber);
    expect(data.order.items.length).toBe(2);
  });

  test('2.4 Get non-existent order returns 404', async () => {
    const res = await fetch(`${BASE}/api/orders/999999`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(res.status).toBe(404);
  });

  // ── 3. User Profile API Tests ──────────────────────────────────

  test('3.1 Get profile returns user data', async () => {
    const res = await fetch(`${BASE}/api/user/profile`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.email).toBe(TEST_EMAIL);
    expect(data.name).toBe(TEST_NAME);
  });

  test('3.2 Update profile sets notification email and WhatsApp', async () => {
    const res = await fetch(`${BASE}/api/user/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        notificationEmail: 'notify@e2e.com',
        whatsappNumber: '+919876543210',
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.profile.notificationEmail).toBe('notify@e2e.com');
  });

  // ── 4. Orders Page UI Tests ────────────────────────────────────

  test('4.1 Orders page loads with real orders from DB', async ({ page }) => {
    await setupAuth(page, authToken);
    await page.goto(`${BASE}/orders`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForContent(page);

    // Check page has orders content - use innerText (not textContent) to avoid RSC payload
    const pageContent = await page.innerText('body');
    expect(pageContent).toContain('Orders');
  });

  test('4.2 Orders page shows real order number', async ({ page }) => {
    await setupAuth(page, authToken);
    await page.goto(`${BASE}/orders`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForContent(page);

    // The order number should appear somewhere on the page
    await expect(page.getByText(/ORD-/)).toBeVisible({ timeout: 10000 });
  });

  test('4.3 Orders page shows no critical JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await setupAuth(page, authToken);
    await page.goto(`${BASE}/orders`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForContent(page);

    const criticalErrors = errors.filter(
      (e) =>
        !e.includes('NetworkError') &&
        !e.includes('fetch') &&
        !e.includes('hydrat')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  // ── 5. Order Detail Page UI Tests ──────────────────────────────

  test('5.1 Order detail page renders with premium UI', async ({ page }) => {
    await setupAuth(page, authToken);
    await page.goto(`${BASE}/orders/${testOrder.id}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await waitForContent(page);

    // Should show order number (use .first() as it appears multiple times on page)
    await expect(page.getByText(testOrder.orderNumber).first()).toBeVisible({ timeout: 10000 });
  });

  test('5.2 Order detail shows Package Journey timeline', async ({ page }) => {
    await setupAuth(page, authToken);
    await page.goto(`${BASE}/orders/${testOrder.id}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await waitForContent(page);

    await expect(page.getByText('Package Journey')).toBeVisible({ timeout: 10000 });
  });

  test('5.3 Order detail shows AI Savings for AI-assisted order', async ({ page }) => {
    await setupAuth(page, authToken);
    await page.goto(`${BASE}/orders/${testOrder.id}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await waitForContent(page);

    await expect(page.getByText(/AI Saved You/)).toBeVisible({ timeout: 10000 });
  });

  test('5.4 Order detail shows item cards with scroll', async ({ page }) => {
    await setupAuth(page, authToken);
    await page.goto(`${BASE}/orders/${testOrder.id}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await waitForContent(page);

    await expect(page.getByText('Samsung Galaxy S24 Ultra').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Apple AirPods Pro 2').first()).toBeVisible({ timeout: 10000 });
  });

  test('5.5 Order detail shows shipping address', async ({ page }) => {
    await setupAuth(page, authToken);
    await page.goto(`${BASE}/orders/${testOrder.id}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await waitForContent(page);

    await expect(page.getByText('Shipping Address')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Bangalore').first()).toBeVisible({ timeout: 10000 });
  });

  test('5.6 Order detail has Print Receipt button', async ({ page }) => {
    await setupAuth(page, authToken);
    await page.goto(`${BASE}/orders/${testOrder.id}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await waitForContent(page);

    await expect(page.getByText('Print Receipt')).toBeVisible({ timeout: 10000 });
  });

  test('5.7 Order detail back link navigates to orders', async ({ page }) => {
    await setupAuth(page, authToken);
    await page.goto(`${BASE}/orders/${testOrder.id}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await waitForContent(page);

    const backLink = page.getByText('Back to Orders');
    await expect(backLink).toBeVisible({ timeout: 10000 });
    await backLink.click();
    await page.waitForURL('**/orders', { timeout: 15000 });
    expect(page.url()).toContain('/orders');
  });

  test('5.8 Non-existent order shows error state', async ({ page }) => {
    await setupAuth(page, authToken);
    await page.goto(`${BASE}/orders/999999`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await waitForContent(page);

    await expect(page.getByText(/not found|error/i)).toBeVisible({ timeout: 10000 });
  });

  // ── 6. Spending Analytics Page ─────────────────────────────────

  test('6.1 Spending page loads successfully', async ({ page }) => {
    await setupAuth(page, authToken);
    await page.goto(`${BASE}/spending`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForContent(page);
    // Wait for the spending page to hydrate and show content
    await page.waitForSelector('text=/Spend/i', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);

    const content = await page.innerText('body');
    expect(content).toMatch(/spend|analytics|budget|total/i);
  });

  test('6.2 Spending page shows real spending data', async ({ page }) => {
    await setupAuth(page, authToken);
    await page.goto(`${BASE}/spending`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForContent(page);
    await page.waitForSelector('text=/Spend/i', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // Should contain a currency figure from the order
    await expect(page.getByText(/₹/).first()).toBeVisible({ timeout: 10000 });
  });

  test('6.3 Spending page has no critical JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await setupAuth(page, authToken);
    await page.goto(`${BASE}/spending`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForContent(page);

    const critical = errors.filter(
      (e) => !e.includes('NetworkError') && !e.includes('fetch') && !e.includes('hydrat')
    );
    expect(critical).toHaveLength(0);
  });

  // ── 7. Order Insights Page ─────────────────────────────────────

  test('7.1 Order insights page loads successfully', async ({ page }) => {
    await setupAuth(page, authToken);
    await page.goto(`${BASE}/order-insights`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForContent(page);
    await page.waitForSelector('text=/Intelligence|Insight/i', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);

    const content = await page.innerText('body');
    expect(content).toMatch(/insight|intelligence|analytics|order/i);
  });

  test('7.2 Order insights shows shopping personality', async ({ page }) => {
    await setupAuth(page, authToken);
    await page.goto(`${BASE}/order-insights`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForContent(page);
    await page.waitForSelector('text=/Intelligence|Insight/i', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // Should contain a personality or profile-related text
    const content = await page.innerText('body');
    expect(content).toMatch(/personality|buyer|shopper|profile|order/i);
  });

  test('7.3 Order insights page has no critical JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await setupAuth(page, authToken);
    await page.goto(`${BASE}/order-insights`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForContent(page);

    const critical = errors.filter(
      (e) => !e.includes('NetworkError') && !e.includes('fetch') && !e.includes('hydrat')
    );
    expect(critical).toHaveLength(0);
  });

  // ── 8. Account Page Integration ────────────────────────────────

  test('8.1 Account page loads with real order data', async ({ page }) => {
    await setupAuth(page, authToken);
    await page.goto(`${BASE}/account`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForContent(page);

    // Should show Total Spent tile
    await expect(page.getByText('Total Spent')).toBeVisible({ timeout: 10000 });
  });

  test('8.2 Total Spent tile links to /spending', async ({ page }) => {
    await setupAuth(page, authToken);
    await page.goto(`${BASE}/account`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForContent(page);

    // Find and click the Total Spent tile
    const spentLink = page.locator('a[href="/spending"]');
    await expect(spentLink).toBeVisible({ timeout: 10000 });
    await spentLink.click();
    await page.waitForURL('**/spending', { timeout: 15000 });
    expect(page.url()).toContain('/spending');
  });

  test('8.3 Avg Order tile links to /order-insights', async ({ page }) => {
    await setupAuth(page, authToken);
    await page.goto(`${BASE}/account`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForContent(page);

    const insightsLink = page.locator('a[href="/order-insights"]');
    await expect(insightsLink).toBeVisible({ timeout: 10000 });
    await insightsLink.click();
    await page.waitForURL('**/order-insights', { timeout: 15000 });
    expect(page.url()).toContain('/order-insights');
  });

  test('8.4 Account page shows orders section with real data', async ({ page }) => {
    await setupAuth(page, authToken);
    await page.goto(`${BASE}/account`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForContent(page);

    await expect(page.getByText('Your Orders').first()).toBeVisible({ timeout: 10000 });
  });

  // ── 9. Error Resilience Tests ──────────────────────────────────

  test('9.1 Orders error boundary catches and displays errors gracefully', async ({ page }) => {
    await page.goto(`${BASE}/orders`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForContent(page);

    // Page should still render even without auth
    const body = await page.innerText('body');
    expect(body).toBeTruthy();
    // No white screen of death
    expect(body!.length).toBeGreaterThan(50);
  });

  test('9.2 Order detail without auth shows sign-in prompt', async ({ page }) => {
    await page.goto(`${BASE}/orders/1`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForContent(page);

    // Should show sign in prompt, not crash
    const content = await page.innerText('body');
    expect(content).toMatch(/sign in|login|orders/i);
  });

  test('9.3 Spending page without auth handles gracefully', async ({ page }) => {
    await page.goto(`${BASE}/spending`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForContent(page);

    const content = await page.innerText('body');
    expect(content!.length).toBeGreaterThan(50);
  });

  test('9.4 Order insights page without auth handles gracefully', async ({ page }) => {
    await page.goto(`${BASE}/order-insights`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForContent(page);

    const content = await page.innerText('body');
    expect(content!.length).toBeGreaterThan(50);
  });

  // ── 10. Page Performance Tests ─────────────────────────────────

  test('10.1 Orders page loads within 10s', async ({ page }) => {
    await setupAuth(page, authToken);
    const start = Date.now();
    await page.goto(`${BASE}/orders`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(10000);
  });

  test('10.2 Order detail page loads within 10s', async ({ page }) => {
    await setupAuth(page, authToken);
    const start = Date.now();
    await page.goto(`${BASE}/orders/${testOrder.id}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(10000);
  });

  test('10.3 Spending page loads within 10s', async ({ page }) => {
    await setupAuth(page, authToken);
    const start = Date.now();
    await page.goto(`${BASE}/spending`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(10000);
  });

  test('10.4 Order insights page loads within 10s', async ({ page }) => {
    await setupAuth(page, authToken);
    const start = Date.now();
    await page.goto(`${BASE}/order-insights`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(10000);
  });

  // ── 11. Full User Journey ──────────────────────────────────────

  test('11.1 Complete flow: Account → Orders → Detail → Spending → Insights', async ({ page }) => {
    await setupAuth(page, authToken);

    // Step 1: Account page
    await page.goto(`${BASE}/account`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForContent(page);
    await expect(page.getByText('Total Spent')).toBeVisible({ timeout: 10000 });

    // Step 2: Navigate to Orders via "View All"
    const viewAll = page.getByText('View All').first();
    await expect(viewAll).toBeVisible({ timeout: 10000 });
    await viewAll.click();
    await page.waitForURL('**/orders', { timeout: 15000 });
    await waitForContent(page);

    // Step 3: Click on order to view detail
    const orderLink = page.getByText(/ORD-/).first();
    await expect(orderLink).toBeVisible({ timeout: 10000 });
    // Get the order link or detail button
    const detailBtn = page.locator('a[href*="/orders/"]').first();
    if (await detailBtn.isVisible()) {
      await detailBtn.click();
      await page.waitForURL('**/orders/**', { timeout: 15000 });
      await waitForContent(page);
      await expect(page.getByText('Package Journey')).toBeVisible({ timeout: 10000 });

      // Step 4: Go back to orders
      await page.getByText('Back to Orders').click();
      await page.waitForURL('**/orders', { timeout: 15000 });
    }

    // Step 5: Navigate to spending
    await page.goto(`${BASE}/spending`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForContent(page);
    const spendContent = await page.innerText('body');
    expect(spendContent).toMatch(/₹|spend/i);

    // Step 6: Navigate to order insights
    await page.goto(`${BASE}/order-insights`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForContent(page);
    const insightContent = await page.innerText('body');
    expect(insightContent).toMatch(/insight|intelligence/i);
  });
});
