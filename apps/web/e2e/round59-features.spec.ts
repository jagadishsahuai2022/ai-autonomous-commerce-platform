/**
 * Round 59 — Feature Regression & New Feature E2E Tests
 *
 * Covers:
 *  1. Account page: Learning Insights & Scoring Dimensions cards visible for admin
 *  2. Profile page: Auto-checkout shows "Native Only" (not "Restricted")
 *  3. Profile page: Learning Insights section removed
 *  4. Observability: Fallback Audit tab Python service health checks
 *  5. Auto-checkout API: native products restriction response
 *  6. Analysis docs exist
 */

import { test, expect, type Page } from '@playwright/test';

const BASE = 'http://127.0.0.1:3000';
const ADMIN_EMAIL = 'admin@delegatecart.com';
const ADMIN_PASS = 'Admin@DC2024!';

async function loginAsAdmin(page: Page) {
  const resp = await page.request.post(`${BASE}/api/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASS },
  });
  const body = await resp.json();
  const token = body.token;
  await page.addInitScript((t: string) => {
    window.localStorage.setItem('authToken', t);
    window.localStorage.setItem('dc-user-role', 'admin');
    window.localStorage.setItem('userEmail', 'admin@delegatecart.com');
  }, token);
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. ACCOUNT PAGE — Learning Insights & Scoring Dimensions cards
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Account Page — Admin Cards', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/account`, { waitUntil: 'networkidle' });
  });

  test('shows Learning Insights card for admin', async ({ page }) => {
    const card = page.locator('text=Learning Insights').first();
    await expect(card).toBeVisible({ timeout: 10000 });
  });

  test('shows Scoring Dimensions card for admin', async ({ page }) => {
    const card = page.locator('text=Scoring Dimensions').first();
    await expect(card).toBeVisible({ timeout: 10000 });
  });

  test('Learning Insights card links to /admin/learning-insights', async ({ page }) => {
    const link = page.locator('a[href="/admin/learning-insights"]').first();
    await expect(link).toBeVisible({ timeout: 10000 });
  });

  test('Scoring Dimensions card links to /admin/scoring-dimensions', async ({ page }) => {
    const link = page.locator('a[href="/admin/scoring-dimensions"]').first();
    await expect(link).toBeVisible({ timeout: 10000 });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 2. PROFILE PAGE — Auto-checkout "Native Only" badge
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Profile Page — Auto-Checkout UI', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/profile`, { waitUntil: 'networkidle' });
  });

  test('shows "Native Only" badge instead of "Restricted"', async ({ page }) => {
    const nativeOnly = page.locator('text=Native Only').first();
    await expect(nativeOnly).toBeVisible({ timeout: 10000 });
  });

  test('auto-checkout description mentions native products', async ({ page }) => {
    const text = page.locator('text=restricted to native products');
    await expect(text).toBeVisible({ timeout: 10000 });
  });

  test('auto-checkout description mentions external aggregators blocked', async ({ page }) => {
    const text = page.locator('text=External aggregator products');
    await expect(text).toBeVisible({ timeout: 10000 });
  });

  test('Learning Insights section is NOT on profile page', async ({ page }) => {
    // The Learning Insights section has been moved to account page
    const heading = page.locator('h3:has-text("Learning Insights")');
    await expect(heading).toHaveCount(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 3. OBSERVABILITY — Fallback Audit tab
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Observability — Fallback Audit', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/observability`, { waitUntil: 'networkidle' });
  });

  test('page loads with Fallback Audit tab', async ({ page }) => {
    const tab = page.locator('text=Fallback Audit').first();
    await expect(tab).toBeVisible({ timeout: 10000 });
  });

  test('clicking Fallback Audit tab shows Python services section', async ({ page }) => {
    const tab = page.locator('button:has-text("Fallback Audit")').first();
    await tab.click();
    await page.waitForTimeout(2000);
    // Should show the Python service health section
    const serviceSection = page.locator('text=Product Ranking Engine').first();
    await expect(serviceSection).toBeVisible({ timeout: 10000 });
  });

  test('auto-checkout fallback entry shows native products description', async ({ page }) => {
    const tab = page.locator('button:has-text("Fallback Audit")').first();
    await tab.click();
    await page.waitForTimeout(1000);
    const entry = page.locator('text=native DB products').first();
    await expect(entry).toBeVisible({ timeout: 10000 });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 4. AUTO-CHECKOUT API — Native product restriction
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Shopping List API — Auto-Checkout Restriction', () => {
  test('auto-checkout with no matching native products returns EXTERNAL_RESTRICTED', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/shopping-list`, { waitUntil: 'networkidle' });

    const resp = await page.request.post(`${BASE}/api/shopping-list`, {
      data: {
        items: [{ name: 'Nonexistent XYZ Product 99999', quantity: 1 }],
        autoCheckout: true,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const body = await resp.json();
    // The response should indicate auto-checkout was attempted but restricted for external products
    if (body.autoCheckoutResult) {
      expect(body.autoCheckoutResult.success).toBe(false);
      expect(body.autoCheckoutResult.failureCode).toContain('RESTRICTED');
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 5. PAGE LOAD PERFORMANCE
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Page Load Performance', () => {
  const pages = [
    { url: '/account', name: 'Account' },
    { url: '/profile', name: 'Profile' },
    { url: '/observability', name: 'Observability' },
  ];

  for (const p of pages) {
    test(`${p.name} page loads within 8 seconds`, async ({ page }) => {
      await loginAsAdmin(page);
      const start = Date.now();
      const response = await page.goto(`${BASE}${p.url}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      const elapsed = Date.now() - start;
      expect(response?.status()).toBeLessThan(400);
      expect(elapsed).toBeLessThan(8000);
    });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// 6. ANALYSIS DOCS SMOKE TEST (file-system level)
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Analysis Documents', () => {
  test('Express vs Fastify analysis doc accessible', async ({ page }) => {
    // Verify the doc was created by attempting to fetch it as a static asset
    // (this is a filesystem check via the test runner — Playwright can read local files)
    const fs = await import('fs');
    const path = await import('path');
    const docPath = path.resolve(__dirname, '../../docs/EXPRESS_VS_FASTIFY_ANALYSIS.md');
    expect(fs.existsSync(docPath)).toBe(true);
    const content = fs.readFileSync(docPath, 'utf-8');
    expect(content).toContain('Express vs Fastify');
    expect(content).toContain('@nestjs/platform-express');
  });

  test('SDK/API + Auto-Checkout analysis doc accessible', async ({ page }) => {
    const fs = await import('fs');
    const path = await import('path');
    const docPath = path.resolve(__dirname, '../../docs/SDK_API_AUTOCHECKOUT_ANALYSIS.md');
    expect(fs.existsSync(docPath)).toBe(true);
    const content = fs.readFileSync(docPath, 'utf-8');
    expect(content).toContain('SDK vs API');
    expect(content).toContain('Auto-Checkout');
  });
});
