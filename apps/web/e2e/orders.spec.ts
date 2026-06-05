import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:3000';

async function goto(page: Page, path: string) {
  await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);
}

async function loginViaLocalStorage(page: Page, email = 'demo@example.com') {
  await goto(page, '/');
  await page.evaluate(
    ({ email }) => {
      localStorage.setItem('authToken', `mock-jwt-orders-${Date.now()}`);
      localStorage.setItem('userEmail', email);
    },
    { email }
  );
}

// ─── Orders Page ──────────────────────────────────────────────────────────────

test.describe('Orders Page — Authentication', () => {
  test('unauthenticated user sees sign in prompt on /orders', async ({ page }) => {
    await goto(page, '/');
    // Clear any existing auth
    await page.evaluate(() => {
      localStorage.removeItem('authToken');
      localStorage.removeItem('userEmail');
    });
    await goto(page, '/orders');
    await page.waitForTimeout(2000);
    // Should show sign-in prompt or redirect
    const signinText =
      (await page.locator('text=/sign in|log in|signin/i').count()) > 0 ||
      page.url().includes('/signin') ||
      page.url().includes('/login');
    expect(signinText).toBe(true);
  });

  test('authenticated user does NOT see sign in prompt on /orders', async ({ page }) => {
    await loginViaLocalStorage(page);
    await goto(page, '/orders');
    await page.waitForTimeout(2500);

    // Should NOT show "Sign in to view your orders"
    await expect(page.getByText(/sign in to view your orders/i)).not.toBeVisible({
      timeout: 6000,
    });
  });

  test('authenticated user sees orders page content', async ({ page }) => {
    await loginViaLocalStorage(page);
    await goto(page, '/orders');
    await page.waitForTimeout(2500);

    // Should show orders page — either orders list OR empty state
    const hasPageContent =
      (await page
        .locator('h1, h2')
        .filter({ hasText: /orders|order/i })
        .count()) > 0 ||
      (await page.getByText(/no orders|no order/i).count()) > 0 ||
      (await page.getByText(/your orders/i).count()) > 0;
    expect(hasPageContent).toBe(true);
  });

  test('authenticated user sees their email in navbar', async ({ page }) => {
    await loginViaLocalStorage(page, 'test-orders@example.com');
    await goto(page, '/orders');
    await page.waitForTimeout(2000);

    // Navbar should display user email or avatar
    const navbarEmailOrAvatar =
      (await page.locator('text=/test-orders@example.com/i').count()) > 0 ||
      (await page.locator('[data-testid="user-avatar"], [aria-label*="user"], .avatar').count()) >
        0 ||
      (await page.locator('nav').locator('text=/account|profile/i').count()) > 0;
    expect(navbarEmailOrAvatar).toBe(true);
  });

  test('/orders page renders at HTTP 200', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/orders`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    expect(response?.status()).toBe(200);
  });

  test('orders page has no critical JavaScript errors when authenticated', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await loginViaLocalStorage(page);
    await goto(page, '/orders');
    await page.waitForTimeout(2500);

    const criticalErrors = errors.filter(
      (e) =>
        !e.includes('NetworkError') &&
        !e.includes('fetch') &&
        !e.includes('Failed to fetch') &&
        !e.includes('Hydration') &&
        !e.includes('hydrat')
    );
    expect(criticalErrors).toHaveLength(0);
  });
});

// ─── Account Returns Page — Auth ──────────────────────────────────────────────

test.describe('Account Returns Page — Authentication', () => {
  test('authenticated user sees returns page (not sign-in prompt)', async ({ page }) => {
    await loginViaLocalStorage(page);
    await goto(page, '/account/returns');
    await page.waitForTimeout(2500);

    // Should NOT redirect away or show "Sign in" instantly
    expect(page.url()).toContain('/account/returns');
  });

  test('/account/returns page renders at HTTP 200', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/account/returns`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    expect(response?.status()).toBe(200);
  });
});
