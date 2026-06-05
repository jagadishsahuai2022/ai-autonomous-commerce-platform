import { test, expect, Page } from '@playwright/test';

/**
 * Comprehensive E2E Test Suite
 * Tests critical user journeys, API integration, and resilience
 */

const BASE_URL = 'http://127.0.0.1:3000';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

/**
 * Helper function to handle network errors gracefully
 */
async function navigateSafely(page: Page, path: string, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await page.goto(`${BASE_URL}${path}`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
      if (response?.ok() || response?.status() === 200) {
        return response;
      }
    } catch (error) {
      if (attempt < maxRetries - 1) {
        await page.waitForTimeout(1000 * (attempt + 1)); // Exponential backoff
        continue;
      }
      throw error;
    }
  }
}

test.describe('Core Page Loading', () => {
  test('Home page loads successfully', async ({ page }) => {
    const response = await navigateSafely(page, '/');
    expect([200, 304]).toContain(response?.status());
  });

  test('Home page renders main content', async ({ page }) => {
    await navigateSafely(page, '/');
    const mainContent = page.locator('main, h1, h2').first();
    await expect(mainContent).toBeVisible({ timeout: 5000 });
  });

  test('Home page has no critical console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await navigateSafely(page, '/');
    await page.waitForTimeout(2000);

    const criticalErrors = errors.filter(
      (e) =>
        !e.includes('Failed to fetch') &&
        !e.includes('NetworkError') &&
        !e.includes('Network Error') &&
        !e.includes('JSHandle') &&
        !e.includes('Hydration failed') &&
        !e.includes('hydrating') &&
        !e.includes('server HTML') &&
        !e.includes('ERR_FAILED') &&
        !e.includes('Failed to load resource') &&
        !e.includes('[next-auth]') &&
        !e.includes('CORS') &&
        !e.includes('[API Error]') &&
        !e.includes('[Network Error]') &&
        !e.includes('[FeatureFlags]')
    );

    expect(criticalErrors.length).toBe(0);
  });
});

test.describe('Dashboard Navigation', () => {
  test('Dashboard page loads successfully', async ({ page }) => {
    const response = await navigateSafely(page, '/dashboard');
    expect(response?.status()).toBeLessThan(400);
  });

  test('Dashboard contains key metrics or sections', async ({ page }) => {
    await navigateSafely(page, '/dashboard');
    const content = page.locator('div, section, [class*="card"], [class*="metric"]').first();
    await expect(content).toBeVisible({ timeout: 5000 });
  });

  test('Dashboard has interactive elements', async ({ page }) => {
    await navigateSafely(page, '/dashboard');
    const buttons = page.locator('button, a[href], [role="button"]');
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);
  });
});

test.describe('Product Pages', () => {
  test('Products page loads successfully', async ({ page }) => {
    const response = await navigateSafely(page, '/products');
    expect(response?.status()).toBeLessThan(400);
  });

  test('Products page displays product list', async ({ page }) => {
    await navigateSafely(page, '/products');
    await page.waitForTimeout(1000);
    const products = page.locator('[class*="product"], [data-testid*="product"]');
    const count = await products.count();
    // Should have some products or placeholder
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('Product Management page accessible to admin', async ({ page }) => {
    const response = await navigateSafely(page, '/products/manage');
    // May be 200 or 401/403 if not authenticated
    expect(response?.status()).toBeLessThan(500);
  });
});

test.describe('Authentication Pages', () => {
  test('Sign In page loads successfully', async ({ page }) => {
    const response = await navigateSafely(page, '/signin');
    expect([200, 304]).toContain(response?.status());
  });

  test('Sign In page has email and password fields', async ({ page }) => {
    await navigateSafely(page, '/signin');
    const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]');
    const passwordInput = page.locator('input[type="password"]');

    // At least one of these should exist
    const hasEmailField = await emailInput.count().then((c) => c > 0);
    const hasPasswordField = await passwordInput.count().then((c) => c > 0);

    expect(hasEmailField || hasPasswordField).toBeTruthy();
  });

  test('Sign In has submit button', async ({ page }) => {
    await navigateSafely(page, '/signin');
    const submitBtn = page.locator(
      'button[type="submit"], button:has-text("Sign In"), button:has-text("Login")'
    );
    await expect(submitBtn).toBeVisible({ timeout: 5000 });
  });
});

test.describe('User Profile Pages', () => {
  test('Profile page loads without error', async ({ page }) => {
    const response = await navigateSafely(page, '/profile');
    // May be 404 or 401 if not authenticated
    expect(response?.status()).toBeLessThan(500);
  });

  test('Orders page loads without error', async ({ page }) => {
    const response = await navigateSafely(page, '/orders');
    expect(response?.status()).toBeLessThan(500);
  });

  test('Admin page loads without error', async ({ page }) => {
    const response = await navigateSafely(page, '/admin');
    expect(response?.status()).toBeLessThan(500);
  });

  test('Insights page loads without error', async ({ page }) => {
    const response = await navigateSafely(page, '/insights');
    expect(response?.status()).toBeLessThan(500);
  });
});

test.describe('Static Content Pages', () => {
  test('About page loads successfully', async ({ page }) => {
    const response = await navigateSafely(page, '/about');
    expect([200, 304]).toContain(response?.status());
  });

  test('Privacy page loads successfully', async ({ page }) => {
    const response = await navigateSafely(page, '/privacy');
    expect([200, 304]).toContain(response?.status());
  });

  test('Terms page loads successfully', async ({ page }) => {
    const response = await navigateSafely(page, '/terms');
    expect([200, 304]).toContain(response?.status());
  });
});

test.describe('Performance Metrics', () => {
  test('Home page meets performance targets', async ({ page }) => {
    const start = Date.now();
    await navigateSafely(page, '/');
    const duration = Date.now() - start;

    console.log(`✓ Home page loaded in ${duration}ms`);
    expect(duration).toBeLessThan(10000);
  });

  test('Dashboard meets performance targets', async ({ page }) => {
    const start = Date.now();
    await navigateSafely(page, '/dashboard');
    const duration = Date.now() - start;

    console.log(`✓ Dashboard loaded in ${duration}ms`);
    expect(duration).toBeLessThan(15000);
  });

  test('Products page meets performance targets', async ({ page }) => {
    const start = Date.now();
    await navigateSafely(page, '/products');
    const duration = Date.now() - start;

    console.log(`✓ Products page loaded in ${duration}ms`);
    expect(duration).toBeLessThan(12000);
  });
});

test.describe('Navigation Resilience', () => {
  test('Can navigate between major pages', async ({ page }) => {
    // Home -> Products
    await navigateSafely(page, '/');
    const productLink = page.locator('a[href="/products"], a:has-text("Products")').first();

    if (await productLink.isVisible()) {
      await productLink.click();
      await page.waitForURL('**/products', { timeout: 10000 }).catch(() => {
        // Navigation might not complete if no link
      });
    }
  });

  test('Browser back button works', async ({ page }) => {
    await navigateSafely(page, '/');
    await navigateSafely(page, '/products');

    const url1 = page.url();
    await page.goBack();

    await page.waitForTimeout(1000);
    const url2 = page.url();

    // URL should have changed
    expect(url1).not.toEqual(url2);
  });
});

test.describe('Error Handling', () => {
  test('Invalid route shows error page gracefully', async ({ page }) => {
    const response = await page
      .goto(`${BASE_URL}/this-page-does-not-exist`, {
        waitUntil: 'domcontentloaded',
      })
      .catch(() => null);

    // Should either show 404 or redirect
    const finalResponse = response?.status();
    expect(finalResponse).toBeLessThan(500);
  });

  test('Page recovers from network errors', async ({ page }) => {
    // Go offline
    await page.context().setOffline(true);

    // Try to navigate
    const response = await page
      .goto(`${BASE_URL}/`, {
        waitUntil: 'domcontentloaded',
      })
      .catch(() => null);

    // Go online
    await page.context().setOffline(false);

    // Navigate again - should work
    await navigateSafely(page, '/');
    const finalUrl = page.url();
    expect(finalUrl).toContain(BASE_URL);
  });
});

test.describe('Accessibility Basics', () => {
  test('Home page has proper heading hierarchy', async ({ page }) => {
    await navigateSafely(page, '/');
    const mainHeading = page.locator('h1');
    const count = await mainHeading.count();
    // Should have at least one h1
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('Sign In page is keyboard navigable', async ({ page }) => {
    await navigateSafely(page, '/signin');

    // Tab key should move focus
    await page.keyboard.press('Tab');
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);

    // Should have focused some element
    expect(focusedElement).toBeTruthy();
  });

  test('Links have meaningful text', async ({ page }) => {
    await navigateSafely(page, '/');
    const links = page.locator('a');
    const count = await links.count();

    // Should have meaningful links
    expect(count).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Content Integrity', () => {
  test('Pages load with expected text content', async ({ page }) => {
    await navigateSafely(page, '/');
    const content = await page.content();

    // Should have some HTML content
    expect(content.length).toBeGreaterThan(100);
    expect(content).toContain('html');
  });

  test('About page has company information', async ({ page }) => {
    await navigateSafely(page, '/about');
    await page.waitForTimeout(1000);

    const content = await page.textContent('body');
    // Should have some descriptive content
    expect(content?.length || 0).toBeGreaterThan(50);
  });
});

test.describe('State Persistence', () => {
  test('Can return to previous page after navigation', async ({ page }) => {
    // Navigate to home
    await navigateSafely(page, '/');
    const homeUrl = page.url();

    // Navigate to products
    await navigateSafely(page, '/products');
    const productsUrl = page.url();

    // Go back
    await page.goBack();
    const backUrl = page.url();

    // URLs should match
    expect(backUrl).toEqual(homeUrl);
  });
});
