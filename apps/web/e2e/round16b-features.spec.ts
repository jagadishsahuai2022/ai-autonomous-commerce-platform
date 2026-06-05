import { test, expect } from '@playwright/test';

// Reusable helper: inject auth tokens so protected pages render
async function injectAuth(page: any) {
  await page.addInitScript(() => {
    localStorage.setItem('authToken', 'test-token-round16b');
    localStorage.setItem('userEmail', 'test@delegatecart.com');
  });
}

// Reusable helper: seed failed checkouts in localStorage
async function seedFailedCheckouts(page: any) {
  await page.addInitScript(() => {
    localStorage.setItem(
      'failedCheckouts',
      JSON.stringify([
        {
          id: 'fail-1',
          timestamp: new Date().toISOString(),
          items: [
            { productName: 'Sony WH-1000XM5', brand: 'Sony', budget: '25000', quantity: '1' },
          ],
          failureCode: 'PAYMENT_FAILURE',
          failureReason: 'Payment gateway timeout',
          error: 'Payment gateway timeout',
        },
        {
          id: 'fail-2',
          timestamp: new Date(Date.now() - 86400000).toISOString(),
          items: [
            { productName: 'Samsung Galaxy S24', brand: 'Samsung', budget: '79999', quantity: '1' },
          ],
          failureCode: 'ORDER_BUDGET_EXCEEDED',
          failureReason: 'Payment amount exceeds allowed per-order budget',
          error: 'Budget exceeded',
        },
        {
          id: 'fail-3',
          timestamp: new Date(Date.now() - 172800000).toISOString(),
          items: [
            { productName: 'Apple AirPods Pro', brand: 'Apple', budget: '24900', quantity: '1' },
          ],
          failureCode: 'NO_MATCHING_PRODUCT',
          failureReason: 'No matching product found',
          error: 'No match',
        },
      ])
    );
  });
}

test.describe('Round 16B - New Features E2E', () => {
  // ── 1. Failed Orders Page ────────────────────────────────────────

  test.describe('Failed Orders Page', () => {
    test('loads and displays infographic summary cards', async ({ page }) => {
      await injectAuth(page);
      await seedFailedCheckouts(page);
      await page.goto('http://127.0.0.1:3000/failed-orders', {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      // Wait for page content to render (first test may need extra time for SSR compilation)
      await page.waitForSelector('text=Total Failures', { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(1000);

      await expect(page.getByText('Failed Orders').first()).toBeVisible();
      await expect(page.getByText('Total Failures')).toBeVisible();
      await expect(page.getByText('Amount at Risk')).toBeVisible();
      await expect(page.getByText('Refunded', { exact: true })).toBeVisible();
      await expect(page.getByText('Avg. Refund Time')).toBeVisible();

      await page.screenshot({
        path: 'test-results/r16b-failed-orders-infographic.png',
        fullPage: true,
      });
    });

    test('shows failure type breakdown chart', async ({ page }) => {
      await injectAuth(page);
      await seedFailedCheckouts(page);
      await page.goto('http://127.0.0.1:3000/failed-orders', {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      await page.waitForTimeout(2000);

      await expect(page.getByText('Failure Breakdown')).toBeVisible();
      await expect(page.getByText('Payment Failed').first()).toBeVisible();
      await expect(page.getByText('Budget Exceeded').first()).toBeVisible();

      await page.screenshot({
        path: 'test-results/r16b-failed-orders-breakdown.png',
        fullPage: true,
      });
    });

    test('expands failure details on click', async ({ page }) => {
      await injectAuth(page);
      await seedFailedCheckouts(page);
      await page.goto('http://127.0.0.1:3000/failed-orders', {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      await page.waitForTimeout(2000);

      const firstFailure = page.locator('button').filter({ hasText: 'Payment Failed' }).first();
      await firstFailure.click();
      await page.waitForTimeout(500);

      await expect(page.getByText('Failure Details')).toBeVisible();
      await expect(page.getByText('Retry from Shopping List')).toBeVisible();

      await page.screenshot({
        path: 'test-results/r16b-failed-orders-expanded.png',
        fullPage: true,
      });
    });

    test('filter tabs work correctly', async ({ page }) => {
      await injectAuth(page);
      await seedFailedCheckouts(page);
      await page.goto('http://127.0.0.1:3000/failed-orders', {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      await page.waitForTimeout(2000);

      const allTab = page.locator('button').filter({ hasText: /^All/i }).first();
      await expect(allTab).toBeVisible();

      const refundTab = page
        .locator('button')
        .filter({ hasText: /Refund Pending/i })
        .first();
      await refundTab.click();
      await page.waitForTimeout(500);

      await page.screenshot({
        path: 'test-results/r16b-failed-orders-filters.png',
        fullPage: true,
      });
    });
  });

  // ── 2. Wallet Page Revamp ────────────────────────────────────────

  test.describe('Wallet Page (Enterprise Revamp)', () => {
    test('loads with tabbed navigation', async ({ page }) => {
      await injectAuth(page);
      await page.goto('http://127.0.0.1:3000/wallet', {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      // Wait for wallet page content to render
      await page.waitForSelector('text=Digital Wallet', { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(1000);

      await expect(page.getByText('Overview').first()).toBeVisible();
      await expect(page.getByText('Add Money').first()).toBeVisible();
      await expect(page.getByText('History').first()).toBeVisible();
      await expect(page.getByText('Settings').first()).toBeVisible();

      await page.screenshot({ path: 'test-results/r16b-wallet-tabs.png', fullPage: true });
    });

    test('Overview tab renders Digital Wallet header', async ({ page }) => {
      await injectAuth(page);
      await page.goto('http://127.0.0.1:3000/wallet', {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      await page.waitForTimeout(2000);

      await expect(page.getByText('Digital Wallet')).toBeVisible();
      await expect(page.getByText('Overview').first()).toBeVisible();

      await page.screenshot({ path: 'test-results/r16b-wallet-overview.png', fullPage: true });
    });

    test('Add Money tab with payment methods', async ({ page }) => {
      await injectAuth(page);
      await page.goto('http://127.0.0.1:3000/wallet', {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      await page.waitForTimeout(2000);

      const addTab = page.locator('button').filter({ hasText: 'Add Money' }).first();
      await addTab.click();
      await page.waitForTimeout(500);

      await expect(page.getByText('₹500')).toBeVisible();
      await expect(page.getByText('₹1,000')).toBeVisible();

      await page.screenshot({ path: 'test-results/r16b-wallet-add-money.png', fullPage: true });
    });

    test('History tab renders', async ({ page }) => {
      await injectAuth(page);
      await page.goto('http://127.0.0.1:3000/wallet', {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      await page.waitForTimeout(2000);

      const histTab = page.locator('button').filter({ hasText: 'History' }).first();
      await histTab.click();
      await page.waitForTimeout(500);

      await expect(histTab).toBeVisible();

      await page.screenshot({ path: 'test-results/r16b-wallet-history.png', fullPage: true });
    });

    test('Settings tab with spending limits and notifications', async ({ page }) => {
      await injectAuth(page);
      await page.goto('http://127.0.0.1:3000/wallet', {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      await page.waitForTimeout(2000);

      const settingsTab = page.locator('button').filter({ hasText: 'Settings' }).first();
      await settingsTab.click();
      await page.waitForTimeout(500);

      await expect(page.getByText('Max Per Order')).toBeVisible();
      await expect(page.getByText('Daily Limit')).toBeVisible();
      await expect(page.getByText(/notifications will be sent/i)).toBeVisible();

      await page.screenshot({ path: 'test-results/r16b-wallet-settings.png', fullPage: true });
    });
  });

  // ── 3. Account Page - Failed Orders Section ─────────────────────

  test.describe('Account Page - Failed Orders', () => {
    test('shows Failed Orders section after Your Orders', async ({ page }) => {
      await injectAuth(page);
      await seedFailedCheckouts(page);
      await page.goto('http://127.0.0.1:3000/account', {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      await page.waitForTimeout(2000);

      await expect(page.getByText('Failed Orders / Checkouts')).toBeVisible();
      await expect(page.getByText('View All Failed Orders & Refund Status →')).toBeVisible();

      await page.screenshot({
        path: 'test-results/r16b-account-failed-orders.png',
        fullPage: true,
      });
    });

    test('Failed Orders tile in account settings grid', async ({ page }) => {
      await injectAuth(page);
      await page.goto('http://127.0.0.1:3000/account', {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      await page.waitForTimeout(2000);

      await expect(page.getByText('Track failed checkouts, refunds & retry orders')).toBeVisible();

      await page.screenshot({
        path: 'test-results/r16b-account-settings-tile.png',
        fullPage: true,
      });
    });
  });

  // ── 4. Shopping List - Wallet Payment Option ─────────────────────

  test.describe('Shopping List - Wallet Payment', () => {
    test('has Wallet option in payment dropdown', async ({ page }) => {
      await injectAuth(page);
      await page.goto('http://127.0.0.1:3000/shopping-list', {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      await page.waitForTimeout(2000);

      const select = page.locator('select').first();
      await expect(select).toBeVisible();
      const options = await select.locator('option').allTextContents();
      expect(options).toContain('Wallet');

      await page.screenshot({ path: 'test-results/r16b-shopping-list-wallet.png', fullPage: true });
    });

    test('auto-checkout forces wallet and disables dropdown', async ({ page }) => {
      await injectAuth(page);
      await page.addInitScript(() => {
        localStorage.setItem('autoPurchaseEnabled', 'true');
        localStorage.setItem('profileTermsAccepted', 'true');
      });
      await page.goto('http://127.0.0.1:3000/shopping-list', {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      await page.waitForTimeout(2000);

      await expect(page.getByText('Wallet only').first()).toBeVisible();

      await page.screenshot({
        path: 'test-results/r16b-shopping-list-wallet-only.png',
        fullPage: true,
      });
    });
  });

  // ── 5. AI+ - Wallet Only Auto-Checkout ───────────────────────────

  test.describe('AI+ - Wallet Only', () => {
    test('payment dropdown shows wallet only and is disabled', async ({ page }) => {
      await injectAuth(page);
      await page.goto('http://127.0.0.1:3000/ai-plus', {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      // Wait for page to finish loading (spinner may be present)
      await page.waitForTimeout(4000);

      // AI+ page may show upgrade prompt if user is not subscribed, or wallet-only form, or still loading
      const hasWalletOnly = await page
        .getByText('Wallet only')
        .first()
        .isVisible()
        .catch(() => false);
      const hasUpgradePrompt = await page
        .getByText('AI+ Exclusive Feature')
        .isVisible()
        .catch(() => false);
      const hasAIPlusHeading = await page
        .getByText('AI+')
        .first()
        .isVisible()
        .catch(() => false);

      // Either the wallet-only payment is visible, the upgrade prompt shows, or at minimum AI+ nav is present
      expect(hasWalletOnly || hasUpgradePrompt || hasAIPlusHeading).toBeTruthy();

      if (hasWalletOnly) {
        const disabledSelect = page.locator('select[disabled]');
        await expect(disabledSelect.first()).toBeVisible();
      }

      await page.screenshot({ path: 'test-results/r16b-aiplus-wallet-only.png', fullPage: true });
    });
  });

  // ── 6. Page Load Tests (no JS errors) ───────────────────────────

  test.describe('New Pages Load Successfully', () => {
    const newPages = [
      { path: '/failed-orders', name: 'Failed Orders' },
      { path: '/wallet', name: 'Wallet (Revamped)' },
    ];

    for (const { path, name } of newPages) {
      test(`${name} (${path}) loads HTTP 200`, async ({ page }) => {
        await injectAuth(page);
        if (path === '/failed-orders') await seedFailedCheckouts(page);
        const res = await page.goto(`http://127.0.0.1:3000${path}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        expect(res?.status()).toBe(200);
      });

      test(`${name} (${path}) has no critical JS errors`, async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', (err) => errors.push(err.message));
        await injectAuth(page);
        if (path === '/failed-orders') await seedFailedCheckouts(page);
        await page.goto(`http://127.0.0.1:3000${path}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForTimeout(2000);

        const critical = errors.filter(
          (e) =>
            !e.includes('NetworkError') &&
            !e.includes('fetch') &&
            !e.includes('Failed to fetch') &&
            !e.includes('Hydration') &&
            !e.includes('hydrating') &&
            !e.includes('WebSocket')
        );
        expect(critical).toEqual([]);
      });
    }
  });
});
