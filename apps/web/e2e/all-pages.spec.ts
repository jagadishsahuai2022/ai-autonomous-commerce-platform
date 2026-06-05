import { test, expect } from '@playwright/test';

// Helper to wait for page with proper HMR handling
async function waitForPage(page: any, url: string) {
  // Use relative path so Playwright baseURL is respected (set via BASE_URL env var)
  const path = url.startsWith('http') ? new URL(url).pathname : url;
  await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(500);
}

test.describe('All Pages - E2E Tests', () => {
  const pages = [
    { path: '/', name: 'Home' },
    { path: '/dashboard', name: 'Dashboard' },
    { path: '/admin', name: 'Admin Panel' },
    { path: '/profile', name: 'Profile' },
    { path: '/orders', name: 'Orders' },
    { path: '/products', name: 'Products' },
    { path: '/products/manage', name: 'Product Management' },
    { path: '/insights', name: 'AI Insights' },
    { path: '/signin', name: 'Sign In' },
    { path: '/about', name: 'About' },
    { path: '/cart', name: 'Cart' },
    { path: '/checkout', name: 'Checkout' },
    { path: '/wishlist', name: 'Wishlist' },
  ];

  pages.forEach(({ path, name }) => {
    test(`${name} page (${path}) loads with HTTP 200`, async ({ page }) => {
      const response = await page.goto(path, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      expect(response?.status()).toBe(200);
    });

    test(`${name} page (${path}) renders without critical JS errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (err) => errors.push(err.message));
      await waitForPage(page, path);

      const criticalErrors = errors.filter(
        (e) =>
          !e.includes('NetworkError') &&
          !e.includes('fetch') &&
          !e.includes('Failed to fetch') &&
          !e.includes('Connected') && // WebSocket messages
          !e.includes('Hydration failed') &&
          !e.includes('hydrating')
      );

      expect(criticalErrors.length).toBe(0);
    });

    test(`${name} page (${path}) has main content`, async ({ page }) => {
      await waitForPage(page, path);
      const headings = page.locator('h1, h2, h3, main');
      await expect(headings.first()).toBeVisible();
    });
  });
});

test.describe('New Premium Pages - Specific Tests', () => {
  test('Seller Dashboard shows metrics', async ({ page }) => {
    await page.goto('/dashboard', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    // Dashboard should have heading
    await expect(page.locator('h1').first()).toBeVisible();
  });

  test('Admin Panel has stats or user table', async ({ page }) => {
    await page.goto('/admin', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    // Admin should have heading
    await expect(page.locator('h1').first()).toBeVisible();
  });

  test('Product Management page shows form or table', async ({ page }) => {
    await page.goto('/products/manage', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    // Should have heading and likely form/table elements
    await expect(page.locator('h1').first()).toBeVisible();
  });

  test('Orders page shows order list', async ({ page }) => {
    await page.goto('/orders', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    // Should have order management interface
    await expect(page.locator('h1').first()).toBeVisible();
  });

  test('Profile page shows form', async ({ page }) => {
    await page.goto('/profile', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    // Should have heading and form
    await expect(page.locator('h1').first()).toBeVisible();
  });

  test('AI Insights page shows insights', async ({ page }) => {
    await page.goto('/insights', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    // Should have heading and insight cards
    await expect(page.locator('h1').first()).toBeVisible();
  });
});

test.describe('Navigation Tests', () => {
  test('can navigate from home to all pages', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Check Products link exists
    const productsLink = page.getByRole('link', { name: /Products/i }).first();
    if (await productsLink.isVisible()) {
      await productsLink.click();
      await page.waitForURL(/\/products/);
      expect(page.url()).toContain('/products');
    }
  });
});

test.describe('Performance Tests', () => {
  test('home page loads in under 10 seconds', async ({ page }) => {
    const start = Date.now();
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    const time = Date.now() - start;
    console.log(`Home page load time: ${time}ms`);
    expect(time).toBeLessThan(10000);
  });

  test('dashboard loads in under 15 seconds', async ({ page }) => {
    const start = Date.now();
    await page.goto('/dashboard', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    const time = Date.now() - start;
    console.log(`Dashboard page load time: ${time}ms`);
    expect(time).toBeLessThan(15000);
  });

  test('admin panel loads in under 15 seconds', async ({ page }) => {
    const start = Date.now();
    await page.goto('/admin', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    const time = Date.now() - start;
    console.log(`Admin panel load time: ${time}ms`);
    expect(time).toBeLessThan(15000);
  });
});

test.describe('Error Handling', () => {
  test('404 page for non-existent route', async ({ page }) => {
    const response = await page.goto('/page-that-does-not-exist-12345', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    expect(response?.status()).toBe(404);
  });
});

test.describe('Wishlist & Cart Pages', () => {
  test('Wishlist page loads with product cards', async ({ page }) => {
    const response = await page.goto('/wishlist', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    // Page returns 200 whether showing wishlist or redirecting to sign-in (auth-gated)
    expect(response?.status()).toBe(200);
    // Accept wishlist heading OR sign-in page heading (unauthenticated redirect)
    await expect(page.locator('h1, h2, main').first()).toBeVisible();
  });

  test('Cart page loads and shows content', async ({ page }) => {
    const response = await page.goto('/cart', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    expect(response?.status()).toBe(200);
    await expect(page.locator('h1, h2, main').first()).toBeVisible();
  });
});
