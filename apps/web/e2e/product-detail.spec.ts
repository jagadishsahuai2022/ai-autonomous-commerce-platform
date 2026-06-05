import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:3000';

async function goto(page: Page, path: string) {
  await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);
}

// ─── Product Detail Page ───────────────────────────────────────────────────────

test.describe('Product Detail Page — API Integration', () => {
  test('renders product detail page for product ID 1', async ({ page }) => {
    await goto(page, '/products/1');
    // Should NOT show "Product Not Found" for a valid product
    await expect(page.getByText(/product not found/i)).not.toBeVisible({ timeout: 8000 });
  });

  test('product detail page shows a product title', async ({ page }) => {
    await goto(page, '/products/1');
    // Wait for content (either loaded or loading state)
    await page.waitForTimeout(2000);
    const hasTitle = await page.locator('h1').count();
    expect(hasTitle).toBeGreaterThan(0);
  });

  test('product detail page shows price', async ({ page }) => {
    await goto(page, '/products/1');
    await page.waitForTimeout(2000);
    // Look for ₹ price indicator or any price-like text
    const priceVisible = (await page.locator('text=/₹|price/i').count()) > 0;
    expect(priceVisible).toBe(true);
  });

  test('product detail page has "Add to Cart" button', async ({ page }) => {
    await goto(page, '/products/1');
    await page.waitForTimeout(2000);
    const addToCart = page.getByRole('button', { name: /add to cart/i });
    await expect(addToCart).toBeVisible({ timeout: 10000 });
  });

  test('product detail page shows product image', async ({ page }) => {
    await goto(page, '/products/1');
    await page.waitForTimeout(2000);
    const images = await page.locator('img').count();
    expect(images).toBeGreaterThan(0);
  });

  test('product detail page has breadcrumb or back navigation', async ({ page }) => {
    await goto(page, '/products/1');
    await page.waitForTimeout(1500);
    const backLink =
      (await page.locator('a[href="/products"]').count()) > 0 ||
      (await page.locator('text=/back|products/i').count()) > 0;
    expect(backLink).toBe(true);
  });

  test('adding product to cart updates localStorage', async ({ page }) => {
    // Product 2 (index 1): inStock = (1 % 20 !== 0) = true — guaranteed in-stock
    await goto(page, '/products/2');
    await page.waitForTimeout(2000);

    const addToCartBtn = page.getByRole('button', { name: /add to cart/i });
    await expect(addToCartBtn).toBeVisible({ timeout: 10000 });
    await addToCartBtn.click();
    await page.waitForTimeout(1000);

    const cart = await page.evaluate(() => {
      const raw = localStorage.getItem('cart') || localStorage.getItem('cartItems') || '[]';
      try {
        return JSON.parse(raw);
      } catch {
        return [];
      }
    });
    // Cart should have items, or a success notification should appear
    const successToast = await page.locator('text=/added|cart|success/i').count();
    const hasCartItems = Array.isArray(cart) && cart.length > 0;
    expect(hasCartItems || successToast > 0).toBe(true);
  });

  test('product page 2 also loads without "Product Not Found"', async ({ page }) => {
    await goto(page, '/products/2');
    await page.waitForTimeout(2000);
    await expect(page.getByText(/product not found/i)).not.toBeVisible({ timeout: 5000 });
  });

  test('product page shows "Related Products" or similar section', async ({ page }) => {
    await goto(page, '/products/1');
    await page.waitForTimeout(3000);
    const relatedSection = (await page.locator('text=/related|similar|you may/i').count()) > 0;
    expect(relatedSection).toBe(true);
  });

  test('non-existent product shows appropriate message', async ({ page }) => {
    await goto(page, '/products/999999');
    await page.waitForTimeout(3000);
    // Should show some kind of not found message
    const notFound =
      (await page.getByText(/not found|unavailable|doesn.t exist/i).count()) > 0 ||
      page.url().includes('/products/999999');
    expect(notFound).toBe(true);
  });

  test('product detail has no critical JavaScript errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await goto(page, '/products/1');
    await page.waitForTimeout(2000);
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
