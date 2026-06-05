import { test, expect, Page } from '@playwright/test';

// Helper: wait for page to be fully loaded (Next.js HMR websockets prevent networkidle)
async function waitForPage(page: Page, url: string) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(1500);
}

test.describe('Home Page', () => {
  test('loads successfully with HTTP 200', async ({ page }) => {
    const response = await page.goto('http://127.0.0.1:3000', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    expect(response?.status()).toBe(200);
  });

  test('shows navigation header with DelegateCart brand', async ({ page }) => {
    await waitForPage(page, '/');
    await expect(page.locator('h1').filter({ hasText: 'DelegateCart' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Home', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Products', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign In' }).first()).toBeVisible();
  });

  test('shows hero section with key content', async ({ page }) => {
    await waitForPage(page, '/');
    await expect(page.locator('h2').first()).toBeVisible();
    await expect(
      page.getByRole('link', { name: /get started|shop now|explore/i }).first()
    ).toBeVisible();
  });

  test('shows footer with copyright', async ({ page }) => {
    await waitForPage(page, '/');
    await expect(page.locator('footer')).toBeVisible();
    await expect(
      page
        .locator('footer')
        .getByText(/DelegateCart/i)
        .first()
    ).toBeVisible();
  });

  test('no critical JavaScript errors on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await waitForPage(page, '/');
    const criticalErrors = errors.filter(
      (e) =>
        !e.includes('NetworkError') &&
        !e.includes('fetch') &&
        !e.includes('Failed to fetch') &&
        !e.includes('Hydration failed') &&
        !e.includes('hydrating')
    );
    expect(criticalErrors).toHaveLength(0);
  });
});

test.describe('Products Page', () => {
  test('loads successfully with HTTP 200', async ({ page }) => {
    const response = await page.goto('http://127.0.0.1:3000/products', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    expect(response?.status()).toBe(200);
  });

  test('shows page title Our Products', async ({ page }) => {
    await waitForPage(page, '/products');
    await expect(
      page
        .locator('h1')
        .filter({ hasText: /products/i })
        .first()
    ).toBeVisible();
  });

  test('shows search input', async ({ page }) => {
    await waitForPage(page, '/products');
    await expect(page.locator('input').first()).toBeVisible();
  });

  test('search input accepts text', async ({ page }) => {
    await waitForPage(page, '/products');
    const searchInput = page.locator('input').first();
    await searchInput.fill('laptop');
    await expect(searchInput).toHaveValue('laptop');
  });

  test('shows category filter section', async ({ page }) => {
    await waitForPage(page, '/products');
    // Products page has a category filter section in the sidebar
    await expect(page.getByRole('button', { name: /category/i }).first()).toBeVisible();
  });
});

test.describe('About Page', () => {
  test('loads successfully with HTTP 200', async ({ page }) => {
    const response = await page.goto('http://127.0.0.1:3000/about', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    expect(response?.status()).toBe(200);
  });

  test('shows page content', async ({ page }) => {
    await waitForPage(page, '/about');
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });
});

test.describe('Sign In Page', () => {
  test('loads successfully with HTTP 200', async ({ page }) => {
    const response = await page.goto('http://127.0.0.1:3000/signin', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    expect(response?.status()).toBe(200);
  });

  test('shows email and password fields', async ({ page }) => {
    await waitForPage(page, '/signin');
    await expect(page.locator('input[type="email"]').first()).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
  });

  test('shows Sign In submit button', async ({ page }) => {
    await waitForPage(page, '/signin');
    await expect(page.getByRole('button', { name: /sign in/i }).first()).toBeVisible();
  });

  test('demo credentials can be filled', async ({ page }) => {
    await waitForPage(page, '/signin');
    await page.locator('input[type="email"]').first().fill('demo@example.com');
    await page.locator('input[type="password"]').first().fill('Demo123!@#');
    await expect(page.locator('input[type="email"]').first()).toHaveValue('demo@example.com');
    await expect(page.locator('input[type="password"]').first()).toHaveValue('Demo123!@#');
  });
});

test.describe('AI Assistant Page', () => {
  test('loads successfully with HTTP 200', async ({ page }) => {
    const response = await page.goto('http://127.0.0.1:3000/ai-assistant', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    expect(response?.status()).toBe(200);
  });

  test('shows assistant interface heading', async ({ page }) => {
    await waitForPage(page, '/ai-assistant');
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });
});

test.describe('Dashboard Page', () => {
  test('loads with 200 status', async ({ page }) => {
    const response = await page.goto('http://127.0.0.1:3000/dashboard', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    expect(response?.status()).toBe(200);
  });

  test('shows heading content', async ({ page }) => {
    await waitForPage(page, '/dashboard');
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });
});

test.describe('Navigation', () => {
  test('Products nav link navigates to /products', async ({ page }) => {
    await waitForPage(page, '/');
    await page.getByRole('link', { name: 'Products', exact: true }).click();
    await page.waitForURL(/\/products/, { timeout: 30000 });
    await expect(page).toHaveURL(/\/products/);
  });

  test('Logo link navigates to home', async ({ page }) => {
    await waitForPage(page, '/about');
    await page
      .getByRole('link', { name: /DelegateCart/i })
      .first()
      .click();
    await page.waitForURL('http://127.0.0.1:3000/', { timeout: 30000 });
    await expect(page).toHaveURL('http://127.0.0.1:3000/');
  });

  test('Sign In link navigates to /signin', async ({ page }) => {
    await waitForPage(page, '/');
    await page.getByRole('link', { name: 'Sign In' }).first().click();
    await page.waitForURL(/\/signin/, { timeout: 30000 });
    await expect(page).toHaveURL(/\/signin/);
  });

  test('returns 404 for non-existent route', async ({ page }) => {
    const response = await page.goto('http://127.0.0.1:3000/this-page-does-not-exist-xyz', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    expect(response?.status()).toBe(404);
  });
});

test.describe('Performance Checks', () => {
  test('home page loads within 10 seconds', async ({ page }) => {
    const start = Date.now();
    await page.goto('http://127.0.0.1:3000', { waitUntil: 'domcontentloaded', timeout: 60000 });
    const loadTime = Date.now() - start;
    console.log(`Home page DOMContentLoaded: ${loadTime}ms`);
    expect(loadTime).toBeLessThan(10000);
  });

  test('home page has proper HTML lang attribute', async ({ page }) => {
    await page.goto('http://127.0.0.1:3000', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('products page loads within 20 seconds', async ({ page }) => {
    const start = Date.now();
    await page.goto('http://127.0.0.1:3000/products', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    const loadTime = Date.now() - start;
    console.log(`Products page DOMContentLoaded: ${loadTime}ms`);
    expect(loadTime).toBeLessThan(20000);
  });

  test('compiled pages load under 3 seconds on reload', async ({ page }) => {
    // First load (triggers compile)
    await page.goto('http://127.0.0.1:3000/about', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    // Second load (from cache)
    const start = Date.now();
    await page.goto('http://127.0.0.1:3000/about', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    const loadTime = Date.now() - start;
    console.log(`Cached about page load: ${loadTime}ms`);
    expect(loadTime).toBeLessThan(3000);
  });
});

test.describe('Accessibility', () => {
  test('home page has at least one h1 heading', async ({ page }) => {
    await waitForPage(page, '/');
    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBeGreaterThanOrEqual(1);
  });

  test('all navigation links have visible text', async ({ page }) => {
    await waitForPage(page, '/');
    const navLinks = page.locator('header a');
    const count = await navLinks.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const text = await navLinks.nth(i).textContent();
      expect(text?.trim().length).toBeGreaterThan(0);
    }
  });

  test('sign in form inputs have identifiers', async ({ page }) => {
    await waitForPage(page, '/signin');
    const emailInput = page.locator('input[type="email"]').first();
    await expect(emailInput).toBeVisible();
    const placeholder = await emailInput.getAttribute('placeholder');
    const ariaLabel = await emailInput.getAttribute('aria-label');
    const id = await emailInput.getAttribute('id');
    expect(placeholder || ariaLabel || id).toBeTruthy();
  });
});
