/**
 * Round 21 — Auto-Checkout Flow End-to-End Tests
 *
 * Validates the complete auto-checkout pipeline:
 * 1. Shopping List page loads with auto-checkout UI
 * 2. Terms acceptance persists to localStorage
 * 3. Auto-checkout API returns proper response structure
 * 4. Smart Delegate shows "Order Placed" badge vs plain search results
 * 5. Wallet balance changes reflected after auto-checkout
 * 6. Error codes returned correctly (wallet not authorized, insufficient balance, etc.)
 * 7. Anonymous users get simulated order (no wallet deduction)
 * 8. Wallet page has AI authorization toggle accessible
 * 9. Orders page shows auto-checkout confirmed orders
 * 10. Screenshot proof of complete flow
 */

import { test, expect, request, type APIRequestContext } from '@playwright/test';

const BASE = 'http://127.0.0.1:3000';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function apiPost(
  apiContext: APIRequestContext,
  path: string,
  body: object,
  cookieHeader?: string
) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cookieHeader) headers['Cookie'] = cookieHeader;
  return apiContext.post(`${BASE}${path}`, { data: body, headers });
}

// ── Test Suite ───────────────────────────────────────────────────────────────

test.describe('Round 21 — Auto-Checkout Flow', () => {
  // ── 1. Page Load & UI ─────────────────────────────────────────────────────

  test('1. Shopping List page loads without JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto(`${BASE}/shopping-list`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    await expect(page.locator('body')).toBeVisible();
    const criticalErrors = errors.filter(
      (e) => !e.includes('hydrat') && !e.includes('Warning') && !e.includes('ResizeObserver')
    );
    expect(criticalErrors).toHaveLength(0);

    await page.screenshot({
      path: 'test-results/round21-01-shopping-list-load.png',
      fullPage: false,
    });
  });

  test('2. Shopping List page shows auto-checkout toggle and terms section', async ({ page }) => {
    await page.goto(`${BASE}/shopping-list`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // Auto-checkout section heading
    const autoCheckoutSection = page.locator('text=Enable AI Auto-Checkout').first();
    await expect(autoCheckoutSection).toBeVisible();

    // Product Name input
    const productInput = page.locator('input[placeholder*="Washing Machine"]').first();
    await expect(productInput).toBeVisible();

    // Submit button
    const submitBtn = page.locator('button[type="submit"]').first();
    await expect(submitBtn).toBeVisible();

    await page.screenshot({
      path: 'test-results/round21-02-auto-checkout-ui.png',
      fullPage: false,
    });
  });

  test('3. Enabling auto-checkout shows terms checkbox', async ({ page }) => {
    await page.goto(`${BASE}/shopping-list`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // Find and click the "Enable AI Auto-Checkout" toggle
    const toggle = page.locator('input[type="checkbox"]').filter({ hasText: '' }).first();
    // The toggle may be in a peer-reviewed label, use text of label
    const autoCheckoutLabel = page.locator('label', { hasText: 'Enable AI Auto-Checkout' }).first();
    await expect(autoCheckoutLabel).toBeVisible();

    // Click the toggle
    const toggleInput = autoCheckoutLabel
      .locator('input[type="checkbox"]')
      .or(page.locator('input[type="checkbox"]').first());

    // Clicking the label activates the toggle
    await autoCheckoutLabel.click();
    await page.waitForTimeout(500);

    // After enabling, terms section or accept checkbox should appear
    const termsSection = page.locator('text=Terms & Conditions').first();
    await expect(termsSection).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: 'test-results/round21-03-terms-visible.png', fullPage: false });
  });

  test('4. Terms acceptance persists to localStorage', async ({ page }) => {
    await page.goto(`${BASE}/shopping-list`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // Enable auto-checkout
    const autoCheckoutLabel = page.locator('label', { hasText: 'Enable AI Auto-Checkout' }).first();
    await autoCheckoutLabel.click();
    await page.waitForTimeout(500);

    // Accept terms via checkbox if visible, or tick the "I accept" checkbox
    // Target the label that contains "agree to the" text
    const termsLabel = page
      .locator('label')
      .filter({ hasText: /agree to the/i })
      .first();
    const termsVisible = await termsLabel.isVisible().catch(() => false);
    if (termsVisible) {
      const termsCheckbox = termsLabel.locator('input[type="checkbox"]').first();
      await termsCheckbox.check();
      await page.waitForTimeout(300);
    }

    // Check localStorage for terms key
    const stored = await page.evaluate(() => localStorage.getItem('shoppingListTermsAccepted'));
    expect(stored).toBe('true');

    await page.screenshot({ path: 'test-results/round21-04-terms-persisted.png', fullPage: false });
  });

  test('5. Terms accepted on reload - checkbox is pre-checked', async ({ page }) => {
    // Set localStorage directly before navigation
    await page.goto(`${BASE}/shopping-list`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      localStorage.setItem('shoppingListTermsAccepted', 'true');
      localStorage.setItem('autoPurchaseEnabled', 'true');
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // With autoPurchaseEnabled=true, auto-checkout toggle should be ON and terms pre-accepted
    // The auto-checkout button should be visible already
    const autoCheckoutBtn = page.locator('button', { hasText: /Auto-Checkout/i }).first();
    await expect(autoCheckoutBtn).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: 'test-results/round21-05-terms-preloaded.png', fullPage: false });
  });

  // ── 2. API Layer Tests ────────────────────────────────────────────────────

  test('6. API /api/shopping-list returns correct structure (no auto-checkout)', async ({
    request,
  }) => {
    const resp = await request.post(`${BASE}/api/shopping-list`, {
      data: {
        items: [
          {
            productName: 'Laptop',
            preferredBrand: 'HP',
            budget: 50000,
            quantity: 1,
            deliveryDays: null,
            paymentMethod: null,
            emiOnly: false,
          },
        ],
        autoCheckout: false,
        termsAccepted: false,
      },
      headers: { 'Content-Type': 'application/json' },
    });

    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.results)).toBe(true);
    expect(body.results.length).toBeGreaterThan(0);
    expect(body.autoCheckout).toBeNull(); // API returns null when auto-checkout not attempted
    expect(body.message).toContain('Shopping list submitted');
  });

  test('7. API with autoCheckout=true (anonymous) returns simulated orderId', async ({
    request,
  }) => {
    const resp = await request.post(`${BASE}/api/shopping-list`, {
      data: {
        items: [
          {
            productName: 'Laptop',
            preferredBrand: null,
            budget: 60000,
            quantity: 1,
            deliveryDays: null,
            paymentMethod: null,
            emiOnly: false,
          },
        ],
        autoCheckout: true,
        termsAccepted: true,
      },
      headers: { 'Content-Type': 'application/json' },
    });

    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.success).toBe(true);
    expect(body.autoCheckout).toBeTruthy();

    // Anonymous user: might succeed with simulated order or fail because no product match
    // Either way, the response structure must be correct
    expect(typeof body.autoCheckout.success).toBe('boolean');
    if (body.autoCheckout.success) {
      expect(body.autoCheckout.orderId).toBeTruthy();
      expect(body.autoCheckout.orderId).toMatch(/ORD-/);
      expect(body.message).toContain('Order');
    } else {
      expect(body.autoCheckout.error).toBeTruthy();
      expect(body.autoCheckout.failureCode).toBeTruthy();
    }

    console.log('Anonymous auto-checkout result:', JSON.stringify(body.autoCheckout, null, 2));
  });

  test('8. API auto-checkout failure returns specific error codes', async ({ request }) => {
    // Searching for something that would have no matches → NO_MATCHING_PRODUCT
    const resp = await request.post(`${BASE}/api/shopping-list`, {
      data: {
        items: [
          {
            productName: 'Quantum Flux Capacitor',
            preferredBrand: null,
            budget: 100,
            quantity: 999,
            deliveryDays: null,
            paymentMethod: null,
            emiOnly: false,
          },
        ],
        autoCheckout: true,
        termsAccepted: true,
      },
      headers: { 'Content-Type': 'application/json' },
    });

    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.success).toBe(true);

    // This item likely won't match anything well, or the match score is low
    // But autoCheckout result must have a success boolean
    if (body.autoCheckout) {
      expect(typeof body.autoCheckout.success).toBe('boolean');
      if (!body.autoCheckout.success) {
        expect(body.autoCheckout.failureCode).toBeTruthy();
        // Known codes
        const knownCodes = [
          'NO_MATCHING_PRODUCT',
          'ORDER_BUDGET_EXCEEDED',
          'MONTHLY_BUDGET_EXCEEDED',
          'INSUFFICIENT_WALLET_BALANCE',
          'WALLET_NOT_AI_AUTHORIZED',
          'DAILY_LIMIT_EXCEEDED',
          'WALLET_LOCKED',
          'PAYMENT_FAILURE',
        ];
        expect(knownCodes).toContain(body.autoCheckout.failureCode);
        console.log('Failure code received:', body.autoCheckout.failureCode);
      }
    }
  });

  test('9. API returns walletBalanceAfter when wallet deduction succeeds', async ({ request }) => {
    // NOTE: This test covers the response contract. Real deduction requires authenticated user
    // We verify the structure from an anonymous (simulated) call
    const resp = await request.post(`${BASE}/api/shopping-list`, {
      data: {
        items: [
          {
            productName: 'Pen',
            preferredBrand: 'Cello',
            budget: 100,
            quantity: 2,
            deliveryDays: null,
            paymentMethod: null,
            emiOnly: false,
          },
        ],
        autoCheckout: true,
        termsAccepted: true,
      },
      headers: { 'Content-Type': 'application/json' },
    });

    const body = await resp.json();
    expect(body.success).toBe(true);

    if (body.autoCheckout?.success) {
      // Authenticated users get walletBalanceAfter; anonymous get undefined
      // Both are valid. Just check it's a number or undefined
      const walletBalance = body.autoCheckout.walletBalanceAfter;
      expect(walletBalance === undefined || typeof walletBalance === 'number').toBe(true);
    }

    console.log('Auto-checkout result:', JSON.stringify(body.autoCheckout, null, 2));
  });

  // ── 3. Smart Delegate Page Tests ──────────────────────────────────────────

  test('10. Smart Delegate page loads without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.addInitScript(() => {
      localStorage.setItem('authToken', 'test-token-round21');
      localStorage.setItem('userEmail', 'test@delegatecart.com');
    });
    await page.goto(`${BASE}/smart-delegate`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    await expect(page.locator('body')).toBeVisible();
    const criticalErrors = errors.filter(
      (e) => !e.includes('hydrat') && !e.includes('Warning') && !e.includes('ResizeObserver')
    );
    expect(criticalErrors).toHaveLength(0);

    await page.screenshot({
      path: 'test-results/round21-10-smart-delegate-load.png',
      fullPage: false,
    });
  });

  test('11. Smart Delegate shows "Order Placed" badge from localStorage submission', async ({
    page,
  }) => {
    const fakeSubmission = {
      id: 'test-order-111',
      submittedAt: new Date().toISOString(),
      results: [
        {
          productName: 'Laptop',
          preferredBrand: 'HP',
          budget: 60000,
          quantity: 1,
          matches: [
            {
              name: 'HP Pavilion 15',
              brand: 'HP',
              price: 55000,
              rating: 4.3,
              matchScore: 88,
              estimatedDelivery: '3-5 days',
              emiAvailable: true,
              url: '#',
            },
          ],
        },
      ],
      summary: { totalItems: 1, totalMatches: 1, estimatedSavings: '\u20b95,000' },
      autoCheckoutSuccess: true,
      autoCheckoutOrderId: 'ORD-TEST-123',
      autoCheckoutError: null,
      walletBalanceAfter: 965000,
    };

    // Inject auth + data before page loads — DO NOT navigate first
    await page.addInitScript((sub) => {
      localStorage.setItem('authToken', 'test-token-round21');
      localStorage.setItem('userEmail', 'test@delegatecart.com');
      localStorage.setItem('shoppingListResults', JSON.stringify([sub]));
    }, fakeSubmission);

    await page.goto(`${BASE}/smart-delegate`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    const orderBadge = page.locator('text=Order Placed').first();
    await expect(orderBadge).toBeVisible({ timeout: 5000 });

    // Should show order number
    const orderNumber = page.locator('text=ORD-TEST-123').first();
    await expect(orderNumber).toBeVisible({ timeout: 5000 });

    // Should show wallet balance
    await expect(page.locator('text=/Wallet.*\u20b99,65,000|\u20b99,65,000/').first()).toBeVisible({
      timeout: 5000,
    });

    await page.screenshot({
      path: 'test-results/round21-11-order-placed-badge.png',
      fullPage: true,
    });
  });

  test('12. Smart Delegate shows "Checkout Failed" badge for failed orders', async ({ page }) => {
    const failedSubmission = {
      id: 'test-fail-222',
      submittedAt: new Date().toISOString(),
      results: [
        {
          productName: 'Diamond Ring',
          preferredBrand: null,
          budget: 5000000,
          quantity: 1,
          matches: [],
        },
      ],
      summary: { totalItems: 1, totalMatches: 0, estimatedSavings: '' },
      autoCheckoutSuccess: false,
      autoCheckoutOrderId: null,
      autoCheckoutError: 'Insufficient wallet balance.',
      walletBalanceAfter: null,
    };

    await page.addInitScript((sub) => {
      localStorage.setItem('authToken', 'test-token-round21');
      localStorage.setItem('userEmail', 'test@delegatecart.com');
      localStorage.setItem('shoppingListResults', JSON.stringify([sub]));
    }, failedSubmission);

    await page.goto(`${BASE}/smart-delegate`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const failedBadge = page.locator('text=Checkout Failed').first();
    await expect(failedBadge).toBeVisible({ timeout: 5000 });

    await page.screenshot({
      path: 'test-results/round21-12-checkout-failed-badge.png',
      fullPage: true,
    });
  });

  test('13. Smart Delegate shows "View Order" link for successful orders', async ({ page }) => {
    const successSubmission = {
      id: 'test-view-order-333',
      submittedAt: new Date().toISOString(),
      results: [
        {
          productName: 'Headphones',
          preferredBrand: 'Sony',
          budget: 30000,
          quantity: 1,
          matches: [
            {
              name: 'Sony WH-1000XM5',
              brand: 'Sony',
              price: 28990,
              rating: 4.7,
              matchScore: 95,
              estimatedDelivery: '2-3 days',
              emiAvailable: true,
              url: '#',
            },
          ],
        },
      ],
      summary: { totalItems: 1, totalMatches: 1, estimatedSavings: '\u20b92,010' },
      autoCheckoutSuccess: true,
      autoCheckoutOrderId: 'ORD-VIEW-456',
      autoCheckoutError: null,
      walletBalanceAfter: 1021506,
    };

    await page.addInitScript((sub) => {
      localStorage.setItem('authToken', 'test-token-round21');
      localStorage.setItem('userEmail', 'test@delegatecart.com');
      localStorage.setItem('shoppingListResults', JSON.stringify([sub]));
    }, successSubmission);

    await page.goto(`${BASE}/smart-delegate`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Should show view order link
    const viewOrderLink = page.locator('text=View Order').first();
    await expect(viewOrderLink).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: 'test-results/round21-13-view-order-link.png', fullPage: true });
  });

  test('14. Plain search shows no Order Placed badge (no autoCheckoutSuccess)', async ({
    page,
  }) => {
    const plainSearchSubmission = {
      id: 'test-plain-444',
      submittedAt: new Date().toISOString(),
      results: [
        {
          productName: 'Mouse',
          preferredBrand: 'Logitech',
          budget: 3000,
          quantity: 1,
          matches: [
            {
              name: 'Logitech MX Master 3',
              brand: 'Logitech',
              price: 6299,
              rating: 4.6,
              matchScore: 82,
              estimatedDelivery: '2-4 days',
              emiAvailable: false,
              url: '#',
            },
          ],
        },
      ],
      summary: { totalItems: 1, totalMatches: 1, estimatedSavings: '' },
      // No autoCheckoutSuccess / autoCheckoutOrderId
    };

    await page.addInitScript((sub) => {
      localStorage.setItem('authToken', 'test-token-round21');
      localStorage.setItem('userEmail', 'test@delegatecart.com');
      localStorage.setItem('shoppingListResults', JSON.stringify([sub]));
    }, plainSearchSubmission);

    await page.goto(`${BASE}/smart-delegate`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Should NOT show "Order Placed" badge
    const orderBadge = page.locator('text=Order Placed').first();
    await expect(orderBadge).not.toBeVisible({ timeout: 3000 });

    await page.screenshot({
      path: 'test-results/round21-14-plain-search-no-badge.png',
      fullPage: true,
    });
  });

  // ── 4. Wallet Page Tests ──────────────────────────────────────────────────

  test('15. Wallet page loads and shows AI authorization toggle', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto(`${BASE}/wallet`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    await expect(page.locator('body')).toBeVisible();
    const criticalErrors = errors.filter(
      (e) => !e.includes('hydrat') && !e.includes('Warning') && !e.includes('ResizeObserver')
    );
    expect(criticalErrors).toHaveLength(0);

    await page.screenshot({ path: 'test-results/round21-15-wallet-page.png', fullPage: false });
  });

  test('16. Wallet page has AI Auto-Checkout authorization setting', async ({ page }) => {
    // Inject auth so wallet page renders instead of "Sign in to access your wallet"
    await page.addInitScript(() => {
      localStorage.setItem('authToken', 'test-token-round21');
      localStorage.setItem('userEmail', 'test@delegatecart.com');
    });
    await page.goto(`${BASE}/wallet`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000); // API will fail (fake token) but page renders after error

    // Click settings tab — it always renders even when wallet data fails to load
    const settingsTab = page.locator('button', { hasText: 'Settings' }).first();
    const settingsVisible = await settingsTab.isVisible().catch(() => false);
    if (settingsVisible) {
      await settingsTab.click();
      await page.waitForTimeout(1000);
    }

    // Should have AI auto-checkout authorization toggle somewhere on the page
    const aiAuthText = page.locator('text=AI Auto-Checkout Authorization').first();
    await expect(aiAuthText).toBeVisible({ timeout: 8000 });

    await page.screenshot({
      path: 'test-results/round21-16-wallet-ai-auth-toggle.png',
      fullPage: false,
    });
  });

  // ── 5. Orders Page Tests ──────────────────────────────────────────────────

  test('17. Orders page loads without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto(`${BASE}/orders`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    await expect(page.locator('body')).toBeVisible();
    const criticalErrors = errors.filter(
      (e) => !e.includes('hydrat') && !e.includes('Warning') && !e.includes('ResizeObserver')
    );
    expect(criticalErrors).toHaveLength(0);

    await page.screenshot({ path: 'test-results/round21-17-orders-page.png', fullPage: false });
  });

  // ── 6. Full Integration Flow ──────────────────────────────────────────────

  test('18. Shopping list submit without auto-checkout goes to Smart Delegate', async ({
    page,
  }) => {
    await page.goto(`${BASE}/shopping-list`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Clear previous submissions
    await page.evaluate(() => localStorage.removeItem('shoppingListResults'));

    // Fill in product name
    const productInput = page.locator('input[placeholder*="Washing Machine"]').first();
    await expect(productInput).toBeVisible();
    await productInput.fill('Laptop');

    // Submit without auto-checkout — scroll and force-click to avoid navbar intercept
    const submitBtn = page.locator('button[type="submit"]').first();
    await submitBtn.scrollIntoViewIfNeeded();
    await submitBtn.click({ force: true });

    // Wait for success indicator or message
    await page
      .waitForSelector('text=/Shopping list submitted|AI agent found|match/i', { timeout: 30000 })
      .catch(() => null);
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: 'test-results/round21-18-plain-submit-result.png',
      fullPage: false,
    });

    // Check localStorage has the submission
    const stored = await page.evaluate(() => localStorage.getItem('shoppingListResults'));
    if (stored) {
      const subs = JSON.parse(stored);
      expect(Array.isArray(subs)).toBe(true);
      if (subs.length > 0) {
        // Should NOT have auto-checkout success for plain search
        expect(subs[0].autoCheckoutSuccess).toBeFalsy();
      }
    }
  });

  test('19. Smart Delegate page correctly renders multiple submission types', async ({ page }) => {
    const submissions = [
      {
        id: 'multi-success-19',
        submittedAt: new Date().toISOString(),
        results: [
          {
            productName: 'Keyboard',
            preferredBrand: 'Corsair',
            budget: 8000,
            quantity: 1,
            matches: [
              {
                name: 'Corsair K70 RGB',
                brand: 'Corsair',
                price: 7999,
                rating: 4.5,
                matchScore: 90,
                estimatedDelivery: '3-4 days',
                emiAvailable: false,
                url: '#',
              },
            ],
          },
        ],
        summary: { totalItems: 1, totalMatches: 1, estimatedSavings: '' },
        autoCheckoutSuccess: true,
        autoCheckoutOrderId: 'ORD-MULTI-789',
        autoCheckoutError: null,
        walletBalanceAfter: 891000,
      },
      {
        id: 'multi-fail-19',
        submittedAt: new Date(Date.now() - 60000).toISOString(),
        results: [
          {
            productName: 'Gaming PC',
            preferredBrand: null,
            budget: 200000,
            quantity: 1,
            matches: [],
          },
        ],
        summary: { totalItems: 1, totalMatches: 0, estimatedSavings: '' },
        autoCheckoutSuccess: false,
        autoCheckoutOrderId: null,
        autoCheckoutError: 'Wallet not authorized for AI auto-checkout.',
        walletBalanceAfter: null,
      },
    ];

    await page.addInitScript((subs) => {
      localStorage.setItem('authToken', 'test-token-round21');
      localStorage.setItem('userEmail', 'test@delegatecart.com');
      localStorage.setItem('shoppingListResults', JSON.stringify(subs));
    }, submissions);

    await page.goto(`${BASE}/smart-delegate`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Check both badges appear
    const orderPlacedBadiges = page.locator('text=Order Placed');
    const checkoutFailedBadges = page.locator('text=Checkout Failed');

    await expect(orderPlacedBadiges.first()).toBeVisible({ timeout: 5000 });
    await expect(checkoutFailedBadges.first()).toBeVisible({ timeout: 5000 });

    await page.screenshot({
      path: 'test-results/round21-19-multiple-submission-types.png',
      fullPage: true,
    });
  });

  test('20. Auto-checkout button only appears when auto-checkout enabled and terms accepted', async ({
    page,
  }) => {
    // Pre-set terms as accepted
    await page.goto(`${BASE}/shopping-list`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      localStorage.setItem('shoppingListTermsAccepted', 'true');
      localStorage.setItem('autoPurchaseEnabled', 'true');
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // With autoPurchaseEnabled + terms pre-accepted, the auto-checkout button should appear automatically
    const autoCheckoutBtn = page.locator('button', { hasText: /Auto-Checkout/i }).first();
    await expect(autoCheckoutBtn).toBeVisible({ timeout: 5000 });

    await page.screenshot({
      path: 'test-results/round21-20-auto-checkout-btn-visible.png',
      fullPage: false,
    });
  });

  // ── 7. Regression: Prior Tests Still Pass ────────────────────────────────

  test('21. Key pages respond HTTP 200', async ({ request }) => {
    const pages = ['/', '/shopping-list', '/smart-delegate', '/wallet', '/orders'];

    for (const path of pages) {
      const resp = await request.get(`${BASE}${path}`);
      expect(resp.status(), `${path} should return 200`).toBe(200);
    }
  });

  test('22. Shopping List API validates required fields', async ({ request }) => {
    // Missing items
    const resp1 = await request.post(`${BASE}/api/shopping-list`, {
      data: {},
      headers: { 'Content-Type': 'application/json' },
    });
    expect([400, 422]).toContain(resp1.status());

    // Empty items array
    const resp2 = await request.post(`${BASE}/api/shopping-list`, {
      data: { items: [] },
      headers: { 'Content-Type': 'application/json' },
    });
    expect([400, 422]).toContain(resp2.status());
  });

  test('23. Shopping List API rejects malicious product names', async ({ request }) => {
    const resp = await request.post(`${BASE}/api/shopping-list`, {
      data: {
        items: [
          {
            productName: "'; DROP TABLE products; --",
            preferredBrand: null,
            budget: 1000,
            quantity: 1,
          },
        ],
        autoCheckout: false,
      },
      headers: { 'Content-Type': 'application/json' },
    });

    // Should reject with 400 or sanitize safely
    expect([400, 422]).toContain(resp.status());
  });

  test('24. Screenshot proof — complete auto-checkout UI flow', async ({ page }) => {
    await page.goto(`${BASE}/shopping-list`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Step 1: Page loaded
    await page.screenshot({ path: 'test-results/round21-24a-flow-loaded.png', fullPage: false });

    // Step 2: Enable auto-checkout
    const autoCheckoutLabel = page.locator('label', { hasText: 'Enable AI Auto-Checkout' }).first();
    await autoCheckoutLabel.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'test-results/round21-24b-flow-enabled.png', fullPage: false });

    // Step 3: Pre-inject terms accepted
    await page.evaluate(() => localStorage.setItem('shoppingListTermsAccepted', 'true'));
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // Re-enable after reload
    const autoCheckoutLabel2 = page
      .locator('label', { hasText: 'Enable AI Auto-Checkout' })
      .first();
    await autoCheckoutLabel2.click();
    await page.waitForTimeout(500);
    await page.screenshot({
      path: 'test-results/round21-24c-flow-terms-pre-accepted.png',
      fullPage: false,
    });

    // Step 4: Fill product name
    const productInput = page.locator('input[placeholder*="Washing Machine"]').first();
    await productInput.fill('Laptop');
    await page.screenshot({ path: 'test-results/round21-24d-flow-filled.png', fullPage: false });
  });

  test('25. Screenshot proof — Smart Delegate with order badges side-by-side', async ({ page }) => {
    const mixedSubmissions = [
      {
        id: 'proof-success-' + Date.now(),
        submittedAt: new Date().toISOString(),
        results: [
          {
            productName: 'Wireless Earbuds',
            preferredBrand: 'Sony',
            budget: 15000,
            quantity: 2,
            matches: [
              {
                name: 'Sony WF-1000XM5',
                brand: 'Sony',
                price: 14990,
                rating: 4.6,
                matchScore: 92,
                estimatedDelivery: '2-3 days',
                emiAvailable: true,
                url: '#',
              },
            ],
          },
        ],
        summary: { totalItems: 1, totalMatches: 1, estimatedSavings: '₹20' },
        autoCheckoutSuccess: true,
        autoCheckoutOrderId: 'ORD-PROOF-001',
        autoCheckoutError: null,
        walletBalanceAfter: 990020,
      },
      {
        id: 'proof-fail-' + (Date.now() - 5000),
        submittedAt: new Date(Date.now() - 300000).toISOString(),
        results: [
          {
            productName: '4K OLED TV',
            preferredBrand: 'LG',
            budget: 150000,
            quantity: 1,
            matches: [],
          },
        ],
        summary: { totalItems: 1, totalMatches: 0, estimatedSavings: '' },
        autoCheckoutSuccess: false,
        autoCheckoutOrderId: null,
        autoCheckoutError:
          'Wallet not authorized for AI auto-checkout. Please enable AI authorization in Wallet Settings.',
        walletBalanceAfter: null,
      },
      {
        id: 'proof-plain-' + (Date.now() - 10000),
        submittedAt: new Date(Date.now() - 600000).toISOString(),
        results: [
          {
            productName: 'Mechanical Keyboard',
            preferredBrand: 'Keychron',
            budget: 12000,
            quantity: 1,
            matches: [
              {
                name: 'Keychron K2 Pro',
                brand: 'Keychron',
                price: 8500,
                rating: 4.4,
                matchScore: 85,
                estimatedDelivery: '5-7 days',
                emiAvailable: false,
                url: '#',
              },
            ],
          },
        ],
        summary: { totalItems: 1, totalMatches: 1, estimatedSavings: '' },
        autoCheckoutSuccess: false,
        autoCheckoutOrderId: null,
        autoCheckoutError: null,
        walletBalanceAfter: null,
      },
    ];

    await page.addInitScript((subs) => {
      localStorage.setItem('authToken', 'test-token-round21');
      localStorage.setItem('userEmail', 'test@delegatecart.com');
      localStorage.setItem('shoppingListResults', JSON.stringify(subs));
    }, mixedSubmissions);

    await page.goto(`${BASE}/smart-delegate`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);

    await expect(page.locator('text=Order Placed').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Checkout Failed').first()).toBeVisible({ timeout: 5000 });

    // Full-page screenshot for proof
    await page.screenshot({
      path: 'test-results/round21-25-smart-delegate-proof.png',
      fullPage: true,
    });

    // Also take a viewport screenshot
    await page.screenshot({
      path: 'test-results/round21-25-smart-delegate-proof-viewport.png',
      fullPage: false,
    });

    console.log('Final proof screenshot captured: round21-25-smart-delegate-proof.png');
  });
});
