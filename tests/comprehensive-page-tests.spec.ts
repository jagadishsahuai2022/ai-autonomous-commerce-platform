// DEPRECATED: These tests have been moved to apps/web/e2e/
// Please use the E2E tests in apps/web/e2e/ instead

// This file is kept for reference only
// import { test, expect } from '@playwright/test';

/*
const BASE_URL = 'http://localhost:3000';

// List of all page routes to test
const PAGES = [
  { url: '', name: 'Home' },
  { url: '/products', name: 'Products' },
  { url: '/about', name: 'About' },
  { url: '/features', name: 'Features' },
  { url: '/blog', name: 'Blog' },
  { url: '/contact', name: 'Contact' },
  { url: '/careers', name: 'Careers' },
  { url: '/terms', name: 'Terms' },
  { url: '/privacy', name: 'Privacy' },
  { url: '/signin', name: 'Sign In' },
  { url: '/signup', name: 'Sign Up' },
  { url: '/dashboard', name: 'Dashboard' },
  { url: '/wishlist', name: 'Wishlist' },
  { url: '/ai-assistant', name: 'AI Assistant' },
  { url: '/copilot', name: 'Copilot' },
  { url: '/shopping-assistant', name: 'Shopping Assistant' },
  { url: '/buy-requests', name: 'Buy Requests' },
  { url: '/create-request', name: 'Create Request' },
  { url: '/decision', name: 'Decision' },
  { url: '/order', name: 'Order' },
  { url: '/orders', name: 'Orders' },
  { url: '/profile', name: 'Profile' },
  { url: '/admin', name: 'Admin' },
  { url: '/pricing', name: 'Pricing' },
  { url: '/security', name: 'Security' },
  { url: '/insights', name: 'Insights' },
  { url: '/memory', name: 'Memory' },
  { url: '/sellers/dashboard', name: 'Seller Dashboard' },
  { url: '/sellers/profile', name: 'Seller Profile' },
  { url: '/sellers/create-listing', name: 'Create Listing' },
  { url: '/products/manage', name: 'Manage Products' },
  { url: '/forgot-password', name: 'Forgot Password' },
  { url: '/aibuy', name: 'AI Buy' },
];

test.describe('Comprehensive Page Load Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set up page error logging
    page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', (err) => console.error('PAGE ERROR:', err));
  });

  for (const page of PAGES) {
    test(`should load ${page.name} page (${page.url || '/'})`, async ({ page }) => {
      try {
        // Navigate to the page
        const response = await page.goto(`${BASE_URL}${page.url}`, {
          waitUntil: 'networkidle',
          timeout: 15000,
        });

        // Check that the page loaded successfully
        expect(response?.status()).toBeLessThan(400);

        // Wait a bit for hydration
        await page.waitForTimeout(500);

        // Check that there are no critical errors in the console
        const errors = await page.evaluate(() => {
          const logs: string[] = [];
          // Check for any uncaught errors
          if ((window as any).__NEXT_DATA__?.isPreview === false) {
            // Page loaded properly
            logs.push('✓ Next.js data loaded');
          }
          return logs;
        });

        // Verify page has some content
        const bodyContent = await page.locator('body').textContent();
        expect(bodyContent?.length).toBeGreaterThan(10);

        // Log success
        console.log(`✓ ${page.name} page loaded successfully`);
      } catch (error) {
        console.error(`✗ Failed to load ${page.name}: ${error}`);
        throw error;
      }
    });
  }

  test('should verify no JavaScript errors in any page', async ({ page }) => {
    const errors: string[] = [];

    page.on('pageerror', (err) => {
      errors.push(err.message);
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Test a few critical pages
    const criticalPages = [
      { url: '', name: 'Home' },
      { url: '/products', name: 'Products' },
      { url: '/signin', name: 'Sign In' },
    ];

    for (const p of criticalPages) {
      errors.length = 0; // Reset errors for each page
      await page.goto(`${BASE_URL}${p.url}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      if (errors.length > 0) {
        console.warn(`Warnings on ${p.name}:`, errors);
      }
    }
  });

  test('should verify all pages have proper HTML structure', async ({ page }) => {
    const criticalPages = [
      { url: '', name: 'Home' },
      { url: '/products', name: 'Products' },
      { url: '/about', name: 'About' },
    ];

    for (const p of criticalPages) {
      await page.goto(`${BASE_URL}${p.url}`);

      // Check for essential HTML elements
      await expect(page.locator('html')).toBeTruthy();
      await expect(page.locator('body')).toBeTruthy();

      // Check that page has some main content
      const hasContent = await page
        .locator('main, section, [role="main"], .container, [class*="container"]')
        .first()
        .isVisible();

      expect(hasContent).toBeTruthy();
      console.log(`✓ ${p.name} has proper HTML structure`);
    }
  });

  test('should verify responsive design works', async ({ page }) => {
    // Test on mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    const response = await page.goto(`${BASE_URL}/products`, {
      waitUntil: 'networkidle',
    });

    expect(response?.status()).toBeLessThan(400);
    await page.waitForTimeout(500);

    // Check that page is still accessible
    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.length).toBeGreaterThan(10);

    console.log('✓ Responsive design test passed');
  });

  test('should verify API connectivity', async ({ page }) => {
    // Navigate to a page and check for API calls
    await page.goto(`${BASE_URL}/products`);

    // Wait for any network requests to complete
    await page.waitForLoadState('networkidle');

    // Check that page loaded without 5xx errors
    const response = await page.evaluate(() => {
      return {
        title: document.title,
        hasContent: document.body.textContent?.length || 0,
      };
    });

    expect(response.hasContent).toBeGreaterThan(100);
    console.log(`✓ API connectivity verified - Title: ${response.title}`);
  });
});

test.describe('Page Navigation Tests', () => {
  test('should navigate between pages successfully', async ({ page }) => {
    // Start on home page
    await page.goto(`${BASE_URL}/`);
    await expect(page).toHaveTitle(/DelegateCart|Home/i);

    // Navigate to products
    await page.goto(`${BASE_URL}/products`);
    await expect(page.url()).toContain('/products');

    // Navigate to about
    await page.goto(`${BASE_URL}/about`);
    await expect(page.url()).toContain('/about');

    // Navigate back to home via link if available
    const homeLink = page.locator('a[href="/"]').first();
    if (await homeLink.isVisible()) {
      await homeLink.click();
      await page.waitForURL(`${BASE_URL}/`);
    }

    console.log('✓ Page navigation works correctly');
  });

  test('should handle page refresh correctly', async ({ page }) => {
    const testPages = ['/', '/products', '/about'];

    for (const testPage of testPages) {
      await page.goto(`${BASE_URL}${testPage}`);
      const urlBefore = page.url();

      // Refresh the page
      await page.reload();

      // Verify same page loaded
      expect(page.url()).toBe(urlBefore);

      // Verify content is present
      const content = await page.locator('body').textContent();
      expect(content?.length).toBeGreaterThan(10);
    }

    console.log('✓ Page refresh test passed');
  });
});

test.describe('Error Handling Tests', () => {
  test('should handle 404 gracefully', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/nonexistent-page-xyz`, {
      waitUntil: 'networkidle',
    });

    // Should either be 404 or redirect to home
    expect([404, 307, 200]).toContain(response?.status());
    console.log('✓ 404 handling works correctly');
  });

  test('should handle network timeouts', async ({ page }) => {
    // Set a short timeout
    page.setDefaultTimeout(5000);

    try {
      await page.goto(`${BASE_URL}/products`, { waitUntil: 'load' });
      console.log('✓ Page loads within timeout');
    } catch (err) {
      console.error('Timeout error (may be expected):', err);
    }
  });
});
*/
// End of moved tests
