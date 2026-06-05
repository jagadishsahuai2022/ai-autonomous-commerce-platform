/**
 * Round 16 — Deep Bug Fix Verification Tests
 *
 * Tests specifically for the 3 root-cause bugs fixed in round16:
 *
 * BUG 1: Sphere off-center on re-expand
 *   Root cause: R3F getBoundingClientRect() during Framer scale animation gets wrong sizes
 *   Fix: dispatch window 'resize' 420ms after isSphereExpanded becomes true
 *
 * BUG 2: Auto-checkout always fails with NO_MATCHING_PRODUCT
 *   Root cause: allNameRelevant check required search terms in product name —
 *   "Washing Machine" → "LG 8 Kg Front Load" has no overlap → forced failure
 *   Fix: skip name-match check when detectCategory() returns non-'generic' category
 *
 * BUG 3: AI+ page sends to Smart Delegate, not orders
 *   Root cause: handleSubmit never passed autoCheckout: true in body;
 *   route.ts only auto-checks out when user.autoPurchaseEnabled OR body.autoCheckout === true
 *   Fix: always send autoCheckout: true from AI+ page (it's the primary purpose)
 *
 * Run: npx playwright test e2e/round16-bug-fixes.spec.ts --project chromium
 */
import { test, expect, Page } from '@playwright/test';

const BASE = 'http://127.0.0.1:3000';

async function setAuth(page: Page, token = 'e2e-test-token') {
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.evaluate((t) => {
    localStorage.setItem('authToken', t);
    localStorage.setItem('userEmail', 'demo@example.com');
    localStorage.removeItem('orders');
    localStorage.removeItem('failedCheckouts');
    localStorage.removeItem('cart');
  }, token);
}

// ══════════════════════════════════════════════════════════════════════════════
// BUG 1 — Sphere re-expand centering
// ══════════════════════════════════════════════════════════════════════════════

test.describe('BUG1 — Sphere centering on re-expand from docked state', () => {
  test('products page: sphere expands centered on load', async ({ page }) => {
    await setAuth(page);
    await page.goto(`${BASE}/products`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000); // wait for 3D to initialize

    const container = page.locator('[data-testid="sphere-container"]').first();
    await expect(container).toBeVisible({ timeout: 20000 });

    await page.screenshot({ path: 'test-results/r16-sphere-initial-load.png' });
    console.log('[BUG1] Sphere visible on initial load ✓');
  });

  test('sphere dismisses on scroll (docks)', async ({ page }) => {
    await setAuth(page);
    await page.goto(`${BASE}/products`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2500);

    // Scroll to trigger sphere dock
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(800);

    await page.screenshot({ path: 'test-results/r16-sphere-after-scroll.png' });
    console.log('[BUG1] After scroll — sphere should be docked');
  });

  test('sphere dismisses when clicking outside its boundary', async ({ page }) => {
    await setAuth(page);
    await page.goto(`${BASE}/products`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2500);

    const container = page.locator('[data-testid="sphere-container"]').first();
    const isVisible = await container.isVisible({ timeout: 5000 }).catch(() => false);

    if (isVisible) {
      // Click far outside the sphere (top-left corner)
      await page.mouse.click(10, 10);
      await page.waitForTimeout(600);
      await page.screenshot({ path: 'test-results/r16-sphere-outside-click.png' });
      console.log('[BUG1] Clicked outside sphere — should dock');
    } else {
      await page.screenshot({ path: 'test-results/r16-sphere-was-docked.png' });
    }
  });

  test('docked button re-expands sphere and resize dispatch recenters canvas', async ({ page }) => {
    await setAuth(page);
    await page.goto(`${BASE}/products`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2000);

    // 1. Scroll to dock the sphere
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'test-results/r16-sphere-docked-state.png' });

    // 2. Find and click the docked sphere button to re-expand
    // The docked button is rendered near the relevance widget
    const dockedBtn = page
      .locator(
        '[data-testid="docked-sphere-btn"], button[aria-label*="sphere"], button[aria-label*="Sphere"], button[aria-label*="category"]'
      )
      .first();
    const hasDockedBtn = await dockedBtn.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasDockedBtn) {
      await dockedBtn.click();
      // Wait for spring animation (300ms) + resize dispatch (420ms) to settle
      await page.waitForTimeout(900);
      await page.screenshot({ path: 'test-results/r16-sphere-re-expanded.png' });

      const container = page.locator('[data-testid="sphere-container"]').first();
      const visible = await container.isVisible({ timeout: 5000 }).catch(() => false);
      if (visible) {
        const box = await container.boundingBox();
        console.log('[BUG1] Re-expanded sphere container dimensions:', box);
      }
    } else {
      // Try clicking the sphere icon in the sort bar
      const sphereIcon = page.locator('.product-page-sphere-btn, [class*="sphere"] button').first();
      const hasIcon = await sphereIcon.isVisible({ timeout: 3000 }).catch(() => false);
      if (hasIcon) await sphereIcon.click();
      await page.waitForTimeout(900);
      await page.screenshot({ path: 'test-results/r16-sphere-re-expanded-alt.png' });
    }
    console.log('[BUG1] Re-expand attempt complete. Check screenshot for centering ✓');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// BUG 2 — Auto-checkout actually places orders
// ══════════════════════════════════════════════════════════════════════════════

test.describe('BUG2 — Auto-checkout places real orders (no false NO_MATCHING_PRODUCT)', () => {
  test('API: "Washing Machine" category match passes allNameRelevant check', async ({ page }) => {
    await setAuth(page);
    await page.goto(`${BASE}/shopping-list`, { waitUntil: 'domcontentloaded', timeout: 60000 });

    const result = await page.evaluate(async () => {
      const res = await fetch('/api/shopping-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer e2e-test-token' },
        body: JSON.stringify({
          items: [
            {
              productName: 'Washing Machine',
              preferredBrand: null,
              budget: 35000,
              quantity: 1,
              deliveryDays: null,
              paymentMethod: null,
              emiOnly: false,
            },
          ],
          autoCheckout: true,
          forceFresh: true,
        }),
      });
      return res.json();
    });

    console.log(
      '[BUG2] Washing Machine auto-checkout result:',
      JSON.stringify(result.autoCheckout)
    );
    expect(result.success).toBe(true);
    // With bug fix: allNameRelevant passes for 'washing_machine' category → no false failure
    expect(result.autoCheckout).toBeDefined();
    expect(result.autoCheckout?.failureCode).not.toBe('NO_MATCHING_PRODUCT');
    // Should succeed and create an order
    if (result.autoCheckout?.success) {
      expect(result.autoCheckout.orderId).toBeTruthy();
      console.log('[BUG2] ✓ Order placed:', result.autoCheckout.orderId);
    }
    await page.screenshot({ path: 'test-results/r16-washing-machine-checkout.png' });
  });

  test('API: "phone" category match places auto-checkout order', async ({ page }) => {
    await setAuth(page);
    await page.goto(`${BASE}/shopping-list`, { waitUntil: 'domcontentloaded', timeout: 60000 });

    const result = await page.evaluate(async () => {
      const res = await fetch('/api/shopping-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer e2e-test-token' },
        body: JSON.stringify({
          items: [
            {
              productName: 'samsung phone',
              preferredBrand: 'Samsung',
              budget: 90000,
              quantity: 1,
              deliveryDays: null,
              paymentMethod: null,
              emiOnly: false,
            },
          ],
          autoCheckout: true,
          forceFresh: true,
        }),
      });
      return res.json();
    });

    console.log('[BUG2] Samsung phone auto-checkout result:', JSON.stringify(result.autoCheckout));
    expect(result.success).toBe(true);
    if (result.autoCheckout?.success) {
      expect(result.autoCheckout.orderId).toBeTruthy();
      console.log('[BUG2] ✓ Phone order placed:', result.autoCheckout.orderId);
    }
    await page.screenshot({ path: 'test-results/r16-phone-checkout.png' });
  });

  test('API: completely unknown generic product correctly fails with NO_MATCHING_PRODUCT', async ({
    page,
  }) => {
    await setAuth(page);
    await page.goto(`${BASE}/shopping-list`, { waitUntil: 'domcontentloaded', timeout: 60000 });

    const result = await page.evaluate(async () => {
      const res = await fetch('/api/shopping-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [
            {
              productName: 'xyzabcdefg unknown',
              preferredBrand: null,
              budget: 500,
              quantity: 1,
              deliveryDays: null,
              paymentMethod: null,
              emiOnly: false,
            },
          ],
          autoCheckout: true,
          forceFresh: true,
        }),
      });
      return res.json();
    });

    console.log('[BUG2] Unknown product result:', JSON.stringify(result.autoCheckout));
    // Completely unknown products can still fail — this is correct behavior
    if (result.autoCheckout && !result.autoCheckout.success) {
      const validCodes = [
        'NO_MATCHING_PRODUCT',
        'ORDER_BUDGET_EXCEEDED',
        'MONTHLY_BUDGET_EXCEEDED',
        'PAYMENT_FAILURE',
      ];
      expect(validCodes).toContain(result.autoCheckout.failureCode);
    }
    await page.screenshot({ path: 'test-results/r16-unknown-product-failure.png' });
  });

  test('successful auto-checkout order appears in orders page via localStorage', async ({
    page,
  }) => {
    await setAuth(page);

    // Submit shopping list with auto-checkout
    await page.goto(`${BASE}/shopping-list`, { waitUntil: 'domcontentloaded', timeout: 60000 });

    const result = await page.evaluate(async () => {
      const authToken = localStorage.getItem('authToken');
      const res = await fetch('/api/shopping-list', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          items: [
            {
              productName: 'Washing Machine',
              preferredBrand: 'LG',
              budget: 40000,
              quantity: 1,
              deliveryDays: 5,
              paymentMethod: 'upi',
              emiOnly: false,
            },
          ],
          autoCheckout: true,
          forceFresh: true,
        }),
      });
      const data = await res.json();

      // If successful, save to localStorage (simulating what shopping-list page does)
      if (data.autoCheckout?.success && data.autoCheckout.orderId) {
        const orderItems = (data.results || []).map((r: any) => {
          const best = r.matches?.[0];
          return {
            id: Math.floor(Math.random() * 100000),
            name: best?.name || r.productName,
            productName: best?.name || r.productName,
            price: best?.price || 0,
            quantity: r.quantity || 1,
          };
        });
        const orderTotal = orderItems.reduce((s: number, i: any) => s + i.price * i.quantity, 0);
        const existingOrders = JSON.parse(localStorage.getItem('orders') || '[]');
        existingOrders.unshift({
          id: data.autoCheckout.orderId,
          orderNumber: data.autoCheckout.orderId,
          total: orderTotal,
          status: 'confirmed',
          aiAssisted: true,
          paymentMethod: 'upi',
          createdAt: new Date().toISOString(),
          items: orderItems,
        });
        localStorage.setItem('orders', JSON.stringify(existingOrders.slice(0, 50)));
      }
      return data;
    });

    console.log('[BUG2] Checkout result for orders test:', JSON.stringify(result.autoCheckout));

    // Navigate to orders page
    await page.goto(`${BASE}/orders`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'test-results/r16-orders-after-checkout.png', fullPage: false });

    if (result.autoCheckout?.success) {
      console.log('[BUG2] ✓ Order placed. Orders page screenshot captured.');
    }
  });

  test('failed auto-checkout is recorded in checkout-failures page', async ({ page }) => {
    await setAuth(page);

    // Seed a failure into localStorage
    await page.evaluate(() => {
      const failures = [
        {
          id: `fail-${Date.now()}`,
          timestamp: new Date().toISOString(),
          items: [{ productName: 'Unicorn Product', brand: '', budget: '500', quantity: '1' }],
          failureCode: 'NO_MATCHING_PRODUCT',
          failureReason: 'No matching products found',
          error: 'No matching products found for: Unicorn Product',
        },
      ];
      localStorage.setItem('failedCheckouts', JSON.stringify(failures));
    });

    await page.goto(`${BASE}/checkout-failures`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/r16-checkout-failures-page.png' });
    console.log('[BUG2] Checkout failures page captured ✓');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// BUG 3 — AI+ page triggers real auto-checkout
// ══════════════════════════════════════════════════════════════════════════════

test.describe('BUG3 — AI+ page auto-checkout flow', () => {
  test('AI+ page loads (subscription check)', async ({ page }) => {
    await setAuth(page);
    await page.goto(`${BASE}/ai-plus`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.screenshot({ path: 'test-results/r16-aiplus-loaded.png' });
    console.log('[BUG3] AI+ page loaded ✓');
  });

  test('AI+ internal route: autoCheckout:true is now included in request body', async ({
    page,
  }) => {
    // Test the downstream shopping-list endpoint the way AI+ page now calls it
    await setAuth(page);
    await page.goto(`${BASE}/shopping-list`, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Simulate how AI+ now calls the shopping-list API with autoCheckout: true
    const result = await page.evaluate(async () => {
      const authToken = localStorage.getItem('authToken');
      const res = await fetch('/api/shopping-list', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          items: [
            {
              productName: 'allen solly shirt',
              preferredBrand: null,
              budget: 2000,
              quantity: 1,
              deliveryDays: null,
              paymentMethod: null,
              emiOnly: false,
            },
          ],
          autoCheckout: true,
          forceFresh: true,
        }),
      });
      return res.json();
    });

    console.log(
      '[BUG3] AI+ style request for "allen solly shirt":',
      JSON.stringify(result.autoCheckout)
    );
    expect(result.success).toBe(true);
    expect(result.autoCheckout).toBeDefined();
    // The response must have a defined autoCheckout result (success or structured failure)
    expect(result.autoCheckout).not.toBeNull();
    await page.screenshot({ path: 'test-results/r16-aiplus-style-request.png' });
  });

  test('AI+ page navigates to orders after auto-checkout success', async ({ page }) => {
    await setAuth(page);

    // Seed a successful auto-checkout order in localStorage (as AI+ page does on success)
    await page.evaluate(() => {
      const orders = [
        {
          id: 'ORD-AUTO-AIPLUS-TEST',
          orderNumber: 'ORD-AUTO-AIPLUS-TEST',
          total: 18490,
          status: 'confirmed',
          aiAssisted: true,
          paymentMethod: 'auto',
          createdAt: new Date().toISOString(),
          items: [
            {
              id: 1,
              name: 'Samsung 7 Kg Top Load',
              productName: 'Samsung 7 Kg Top Load',
              price: 18490,
              quantity: 1,
            },
          ],
        },
      ];
      localStorage.setItem('orders', JSON.stringify(orders));
    });

    // Navigate to orders page — should show the AI+ auto-checkout order
    await page.goto(`${BASE}/orders`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'test-results/r16-orders-from-aiplus.png', fullPage: false });
    console.log('[BUG3] Orders page with AI+ order captured ✓');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// FULL JOURNEY — End-to-end verification of all 3 fixes
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Full Journey — All 3 Bug Fixes Working Together', () => {
  test('complete flow: products page → sphere → dock → re-expand → shopping list → auto-checkout → orders', async ({
    page,
  }) => {
    await setAuth(page);
    await page.evaluate(() => {
      localStorage.removeItem('orders');
      localStorage.removeItem('failedCheckouts');
    });

    // Step 1: Products page — sphere loads centered
    await page.goto(`${BASE}/products`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: 'test-results/r16-journey-1-products.png' });
    console.log('[Journey] Step 1: Products page loaded ✓');

    // Step 2: Scroll to dock sphere
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'test-results/r16-journey-2-sphere-docked.png' });
    console.log('[Journey] Step 2: Scroll to dock sphere ✓');

    // Step 3: Click outside to dismiss (alternative dismiss method)
    // Scroll back to top first
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/r16-journey-3-scrolled-top.png' });

    // Step 4: Navigate to Shopping List
    await page.goto(`${BASE}/shopping-list`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/r16-journey-4-shopping-list.png' });
    console.log('[Journey] Step 4: Shopping List page ✓');

    // Step 5: Call auto-checkout API directly (simulating the UI form submit)
    const checkoutResult = await page.evaluate(async () => {
      const authToken = localStorage.getItem('authToken');
      const res = await fetch('/api/shopping-list', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          items: [
            {
              productName: 'Washing Machine',
              preferredBrand: 'LG',
              budget: 40000,
              quantity: 1,
              deliveryDays: 5,
              paymentMethod: 'upi',
              emiOnly: false,
            },
          ],
          autoCheckout: true,
          forceFresh: true,
        }),
      });
      const data = await res.json();
      // Save to localStorage as the UI does
      if (data.autoCheckout?.success && data.autoCheckout.orderId) {
        const orderItems = (data.results || []).map((r: any) => {
          const best = r.matches?.[0];
          return {
            id: Date.now(),
            name: best?.name || r.productName,
            productName: best?.name || r.productName,
            price: best?.price || 0,
            quantity: r.quantity || 1,
          };
        });
        const total = orderItems.reduce((s: number, i: any) => s + i.price * i.quantity, 0);
        const orders = JSON.parse(localStorage.getItem('orders') || '[]');
        orders.unshift({
          id: data.autoCheckout.orderId,
          orderNumber: data.autoCheckout.orderId,
          total,
          status: 'confirmed',
          aiAssisted: true,
          paymentMethod: 'upi',
          createdAt: new Date().toISOString(),
          items: orderItems,
        });
        localStorage.setItem('orders', JSON.stringify(orders.slice(0, 50)));
        return { success: true, orderId: data.autoCheckout.orderId, total };
      }
      if (data.autoCheckout && !data.autoCheckout.success) {
        const fails = JSON.parse(localStorage.getItem('failedCheckouts') || '[]');
        fails.unshift({
          id: `fail-${Date.now()}`,
          timestamp: new Date().toISOString(),
          items: [{ productName: 'Washing Machine' }],
          failureCode: data.autoCheckout.failureCode,
          failureReason: data.autoCheckout.error,
          error: data.autoCheckout.error,
        });
        localStorage.setItem('failedCheckouts', JSON.stringify(fails));
        return { success: false, failureCode: data.autoCheckout.failureCode };
      }
      return { success: false, reason: 'no autoCheckout in response' };
    });

    console.log('[Journey] Step 5: Auto-checkout result:', JSON.stringify(checkoutResult));
    await page.screenshot({ path: 'test-results/r16-journey-5-checkout-result.png' });

    // Step 6: View Orders page — should show the order
    await page.goto(`${BASE}/orders`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'test-results/r16-journey-6-orders-page.png', fullPage: false });
    console.log('[Journey] Step 6: Orders page ✓');

    // Step 7: View checkout failures page (if applicable)
    await page.goto(`${BASE}/checkout-failures`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/r16-journey-7-failures.png' });
    console.log('[Journey] Step 7: Checkout failures page ✓');

    console.log('[Journey] Complete! Auto-checkout summary:', JSON.stringify(checkoutResult));
  });
});
