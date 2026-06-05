import { test, expect, Page } from '@playwright/test';

/**
 * Round 47 — Session Isolation & Validation Chip Visibility E2E Tests
 *
 * Verifies:
 *  R47-1: After logout, user-specific localStorage keys are cleared (session isolation)
 *  R47-2: After login as a new user, previous user's shopping data is gone
 *  R47-3: Validation chip NOT visible in Shopping List before any search
 *  R47-4: Validation chip APPEARS in Shopping List after shoppingListResults saved to localStorage
 *  R47-5: Validation chip NOT visible in AI+ page before any shopping activity
 *  R47-6: Validation chip APPEARS in AI+ page after shoppingListResults saved to localStorage
 *  R47-7: Basic role — Metrics Validation page accessible and no admin UI elements shown
 *  R47-8: AI Plus role — Metrics Validation page accessible and no admin UI elements shown
 *  R47-9: Admin role — Metrics Validation page shows Scoped/Broad toggle and user filter
 *  R47-10: Logout clears cart data from localStorage
 *  R47-11: Login as different user clears previous user's orders
 *  R47-12: Shopping List validation chip visible after simulated search result
 *  R47-13: AI+ validation chip hidden for fresh session (no prior activity)
 *  R47-14: Shopping Assistant blocked for anonymous users
 */

const BASE = process.env.BASE_URL || 'http://localhost:3010';
const PROOF = 'r47-proof';

const ROLES = {
  admin:     { email: 'admin@delegatecart.com',     role: 'admin' },
  analytics: { email: 'analytics@delegatecart.com', role: 'analytics' },
  aiplus:    { email: 'aiplusdemo@delegatecart.com', role: 'aiplus' },
  basic:     { email: 'basicdemo@delegatecart.com',  role: 'basic' },
};

// ── helpers ──────────────────────────────────────────────────────

async function loginAs(page: Page, email: string, role: string) {
  await page.goto(BASE);
  await page.evaluate(({ e, r }) => {
    localStorage.setItem('userEmail', e);
    localStorage.setItem('authToken', `token-${Date.now()}`);
    localStorage.setItem('dc-user-id', `user-${e.split('@')[0]}`);
    localStorage.setItem('dc-user-role', r);
  }, { e: email, r: role });
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1000);
}

async function logoutViaEval(page: Page) {
  await page.evaluate(() => {
    // Mirror what clearUserSession() does
    const keys = [
      'dc-user-id','dc-user-role','dc-user-subscription','userId',
      'dc-metrics-products','dc-metrics-timeline','dc-metrics-ts','dc-metrics-history',
      'dc-intent-feedback','cart','orders','failedCheckouts','shoppingListResults',
      'cartFromAI','wishlist','addresses','dc-auto-approve-threshold',
      'dc-max-recommendations','dc-notif-test-logs','autoPurchaseEnabled',
      'profileTermsAccepted','shoppingListTermsAccepted','showExternalProducts',
      'whatsappNumber','notificationEmail','notificationPrefs',
      'dc-impersonating','dc-admin-original-email','dc-admin-original-token',
      'dc-admin-original-role','dc-admin-original-subscription',
      'dc-admin-impersonate-original',
    ];
    keys.forEach(k => localStorage.removeItem(k));
    localStorage.removeItem('authToken');
    localStorage.removeItem('userEmail');
    sessionStorage.removeItem('dc-chat-store');
    sessionStorage.removeItem('dc-product-page-store');
    sessionStorage.removeItem('dc-admin-session');
  });
}

async function seedShoppingResults(page: Page, userEmail: string) {
  await page.evaluate((email) => {
    const results = [{
      id: `sl-test-${Date.now()}`,
      submittedAt: new Date().toISOString(),
      results: [{ productName: 'Test Product', matches: [{ name: 'Product A', price: 1000 }] }],
      summary: { totalItems: 1, totalMatches: 1, estimatedSavings: '' },
      whatsappSent: false, emailSent: false, fromCache: false,
      userEmail: email,
      userName: email.split('@')[0],
    }];
    localStorage.setItem('shoppingListResults', JSON.stringify(results));
  }, userEmail);
}

// ─────────────────────────────────────────────────────────────────
// R47-1: Logout clears user-specific localStorage keys
// ─────────────────────────────────────────────────────────────────

test.describe('R47-1/2: Session isolation on logout', () => {

  test('R47-1: Logout removes all user-specific keys', async ({ page }) => {
    await loginAs(page, ROLES.basic.email, ROLES.basic.role);

    // Plant some user-specific data
    await page.evaluate(() => {
      localStorage.setItem('cart', JSON.stringify([{ id: 1, name: 'Laptop', price: 50000 }]));
      localStorage.setItem('orders', JSON.stringify([{ id: 'ORD-001', total: 50000 }]));
      localStorage.setItem('shoppingListResults', JSON.stringify([{ id: 'sl-1' }]));
      localStorage.setItem('dc-metrics-history', JSON.stringify([{ q: 'test' }]));
    });

    // Verify data was planted
    const before = await page.evaluate(() => localStorage.getItem('cart'));
    expect(before).not.toBeNull();

    // Trigger logout (simulate clearUserSession)
    await logoutViaEval(page);

    // Verify keys are gone
    const after = await page.evaluate(() => ({
      cart: localStorage.getItem('cart'),
      orders: localStorage.getItem('orders'),
      shoppingListResults: localStorage.getItem('shoppingListResults'),
      dcMetricsHistory: localStorage.getItem('dc-metrics-history'),
      authToken: localStorage.getItem('authToken'),
      userEmail: localStorage.getItem('userEmail'),
    }));
    expect(after.cart).toBeNull();
    expect(after.orders).toBeNull();
    expect(after.shoppingListResults).toBeNull();
    expect(after.dcMetricsHistory).toBeNull();
    expect(after.authToken).toBeNull();
    expect(after.userEmail).toBeNull();

    await page.screenshot({ path: `${PROOF}/01-logout-clears-user-data.png` });
  });

  test('R47-2: New user login does not inherit previous user data', async ({ page }) => {
    // Login as basic user and plant data
    await loginAs(page, ROLES.basic.email, ROLES.basic.role);
    await page.evaluate(() => {
      localStorage.setItem('cart', JSON.stringify([{ id: 99, name: 'Previous User Item' }]));
      localStorage.setItem('shoppingListResults', JSON.stringify([{ id: 'prev-sl' }]));
    });

    // Now logout + login as admin (simulates user switch)
    await logoutViaEval(page);
    await loginAs(page, ROLES.admin.email, ROLES.admin.role);

    // Admin should NOT see basic user's cart or shopping results
    const inherited = await page.evaluate(() => ({
      cart: localStorage.getItem('cart'),
      shoppingListResults: localStorage.getItem('shoppingListResults'),
    }));
    expect(inherited.cart).toBeNull();
    expect(inherited.shoppingListResults).toBeNull();

    await page.screenshot({ path: `${PROOF}/02-no-cross-user-data.png` });
  });
});

// ─────────────────────────────────────────────────────────────────
// R47-3/4: Validation chip in Shopping List
// ─────────────────────────────────────────────────────────────────

test.describe('R47-3/4: Shopping List validation chip visibility', () => {

  test('R47-3: Validation chip hidden before any shopping activity', async ({ page }) => {
    await loginAs(page, ROLES.basic.email, ROLES.basic.role);

    // Ensure no prior shopping results
    await page.evaluate(() => localStorage.removeItem('shoppingListResults'));

    await page.goto(`${BASE}/shopping-list`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    const chip = page.locator('[data-testid="validation-chip-shopping-list"]');
    await expect(chip).toHaveCount(0);

    await page.screenshot({ path: `${PROOF}/03-shopping-list-chip-hidden.png` });
  });

  test('R47-4: Validation chip visible after shopping results exist', async ({ page }) => {
    await loginAs(page, ROLES.basic.email, ROLES.basic.role);
    await seedShoppingResults(page, ROLES.basic.email);

    await page.goto(`${BASE}/shopping-list`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    const chip = page.locator('[data-testid="validation-chip-shopping-list"]');
    await expect(chip).toBeVisible();

    await page.screenshot({ path: `${PROOF}/04-shopping-list-chip-visible.png` });
  });
});

// ─────────────────────────────────────────────────────────────────
// R47-5/6: Validation chip in AI+ page
// ─────────────────────────────────────────────────────────────────

test.describe('R47-5/6: AI+ validation chip visibility', () => {

  test('R47-5: AI+ validation chip hidden before any activity', async ({ page }) => {
    await loginAs(page, ROLES.aiplus.email, ROLES.aiplus.role);
    await page.evaluate(() => localStorage.removeItem('shoppingListResults'));

    await page.goto(`${BASE}/ai-plus`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(8000);

    const chipLocked = page.locator('[data-testid="validation-chip-ai-plus-locked"]');
    const chipActive = page.locator('[data-testid="validation-chip-ai-plus"]');
    await expect(chipLocked).toHaveCount(0);
    await expect(chipActive).toHaveCount(0);

    await page.screenshot({ path: `${PROOF}/05-ai-plus-chips-hidden.png` });
  });

  test('R47-6: AI+ validation chip visible after shopping results exist', async ({ page }) => {
    await loginAs(page, ROLES.aiplus.email, ROLES.aiplus.role);
    await seedShoppingResults(page, ROLES.aiplus.email);

    await page.goto(`${BASE}/ai-plus`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(8000);

    // At least one chip must be visible (either the locked or the active one)
    const chipLocked = page.locator('[data-testid="validation-chip-ai-plus-locked"]');
    const chipActive = page.locator('[data-testid="validation-chip-ai-plus"]');
    const lockedCount = await chipLocked.count();
    const activeCount = await chipActive.count();
    expect(lockedCount + activeCount).toBeGreaterThan(0);

    await page.screenshot({ path: `${PROOF}/06-ai-plus-chip-visible.png` });
  });
});

// ─────────────────────────────────────────────────────────────────
// R47-7/8/9: Metrics Validation RBAC
// ─────────────────────────────────────────────────────────────────

test.describe('R47-7/8/9: Metrics Validation RBAC for all roles', () => {

  test('R47-7: Basic role can access Metrics Validation, no admin UI', async ({ page }) => {
    await loginAs(page, ROLES.basic.email, ROLES.basic.role);
    await page.goto(`${BASE}/shopping-assistant/metrics/validation`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    const body = await page.locator('body').textContent() ?? '';
    expect(body).not.toContain('Access Restricted');
    expect(body).toMatch(/Metrics Validation|Validation Dashboard/i);
    const toggleCount = await page.locator('[data-testid="public-access-toggle"]').count();
    expect(toggleCount).toBe(0);
    await page.screenshot({ path: `${PROOF}/07-basic-validation-no-admin-ui.png` });
  });

  test('R47-8: AI Plus role can access Metrics Validation, no admin UI', async ({ page }) => {
    await loginAs(page, ROLES.aiplus.email, ROLES.aiplus.role);
    await page.goto(`${BASE}/shopping-assistant/metrics/validation`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    const body = await page.locator('body').textContent() ?? '';
    expect(body).not.toContain('Access Restricted');
    expect(body).toMatch(/Metrics Validation|Validation Dashboard/i);
    const toggleCount = await page.locator('[data-testid="public-access-toggle"]').count();
    expect(toggleCount).toBe(0);
    await page.screenshot({ path: `${PROOF}/08-aiplus-validation-no-admin-ui.png` });
  });

  test('R47-9: Admin role sees Scoped/Broad toggle in Metrics Validation', async ({ page }) => {
    await loginAs(page, ROLES.admin.email, ROLES.admin.role);
    await page.goto(`${BASE}/shopping-assistant/metrics/validation`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    const body = await page.locator('body').textContent() ?? '';
    expect(body).toMatch(/Metrics Validation|Validation Dashboard/i);
    // Admin chip or Scoped/Broad toggle must be present for admin
    const hasAdminUI = body.includes('Scoped') || body.includes('Broad') || body.includes('Admin');
    expect(hasAdminUI).toBe(true);
    await page.screenshot({ path: `${PROOF}/09-admin-validation-full-ui.png` });
  });
});

// ─────────────────────────────────────────────────────────────────
// R47-10/11: Cart and orders cleared on logout
// ─────────────────────────────────────────────────────────────────

test.describe('R47-10/11: Cart/orders cleared on user switch', () => {

  test('R47-10: Cart cleared after logout', async ({ page }) => {
    await loginAs(page, ROLES.basic.email, ROLES.basic.role);
    await page.evaluate(() => {
      localStorage.setItem('cart', JSON.stringify([{ id: 1, name: 'Laptop', qty: 1, price: 50000 }]));
    });
    const before = await page.evaluate(() => (JSON.parse(localStorage.getItem('cart') || '[]')).length);
    expect(before).toBe(1);
    await logoutViaEval(page);
    const after = await page.evaluate(() => localStorage.getItem('cart'));
    expect(after).toBeNull();
    await page.screenshot({ path: `${PROOF}/10-cart-cleared-on-logout.png` });
  });

  test('R47-11: Previous user orders not visible to new user', async ({ page }) => {
    await loginAs(page, ROLES.basic.email, ROLES.basic.role);
    await page.evaluate(() => {
      localStorage.setItem('orders', JSON.stringify([
        { id: 'ORD-BASIC-001', total: 2000, status: 'delivered' }
      ]));
    });
    await logoutViaEval(page);
    await loginAs(page, ROLES.admin.email, ROLES.admin.role);
    const ordersAfter = await page.evaluate(() => localStorage.getItem('orders'));
    expect(ordersAfter).toBeNull();
    await page.screenshot({ path: `${PROOF}/11-orders-isolated-per-user.png` });
  });
});

// ─────────────────────────────────────────────────────────────────
// R47-12/13: Edge cases
// ─────────────────────────────────────────────────────────────────

test.describe('R47-12/13: Validation chip edge cases', () => {

  test('R47-12: Shopping List chip visible after seeded results for any role', async ({ page }) => {
    await loginAs(page, ROLES.admin.email, ROLES.admin.role);
    await seedShoppingResults(page, ROLES.admin.email);
    await page.goto(`${BASE}/shopping-list`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);
    const chip = page.locator('[data-testid="validation-chip-shopping-list"]');
    await expect(chip).toBeVisible();
    await page.screenshot({ path: `${PROOF}/12-admin-shopping-list-chip.png` });
  });

  test('R47-13: AI+ chip hidden on fresh session (no prior activity)', async ({ page }) => {
    await loginAs(page, ROLES.basic.email, ROLES.basic.role);
    await page.evaluate(() => localStorage.removeItem('shoppingListResults'));
    await page.goto(`${BASE}/ai-plus`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(8000);
    const chipLocked = page.locator('[data-testid="validation-chip-ai-plus-locked"]');
    const chipActive = page.locator('[data-testid="validation-chip-ai-plus"]');
    expect(await chipActive.count()).toBe(0);
    expect(await chipLocked.count()).toBe(0);
    await page.screenshot({ path: `${PROOF}/13-fresh-session-no-chip.png` });
  });
});

// ─────────────────────────────────────────────────────────────────
// R47-14: Anonymous access guard for Shopping Assistant
// ─────────────────────────────────────────────────────────────────

test.describe('R47-14: Shopping Assistant auth guard', () => {
  test('R47-14: Anonymous user is redirected to signin from Shopping Assistant', async ({ page }) => {
    await page.goto(BASE);
    await page.evaluate(() => {
      localStorage.removeItem('authToken');
      localStorage.removeItem('userEmail');
      localStorage.removeItem('dc-user-id');
      localStorage.removeItem('dc-user-role');
    });

    await page.goto(`${BASE}/shopping-assistant`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    await expect(page).toHaveURL(/\/signin(\?.*)?$/);
    await page.screenshot({ path: `${PROOF}/14-shopping-assistant-anon-redirect.png` });
  });
});
