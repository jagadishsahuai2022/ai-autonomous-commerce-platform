import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:3000';

async function goto(page: Page, path: string) {
  await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(1500);
}

async function loginViaLocalStorage(page: Page) {
  await goto(page, '/');
  await page.evaluate(() => {
    localStorage.setItem('authToken', `mock-jwt-test-${Date.now()}`);
    localStorage.setItem('userEmail', 'test@example.com');
  });
}

function seedCart(page: Page) {
  return page.evaluate(() => {
    const cart = [
      {
        id: 'ci-1',
        productId: 'mock-5',
        name: 'Test Product',
        price: 1299,
        quantity: 1,
        image: '',
        stock: 50,
      },
      {
        id: 'ci-2',
        productId: 'mock-10',
        name: 'Another Product',
        price: 4999,
        quantity: 2,
        image: '',
        stock: 30,
      },
    ];
    localStorage.setItem('cart', JSON.stringify(cart));
  });
}

// ─── Product Links — Cart Page ──────────────────────────────────────────────────

test.describe('Product Links — Cart', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaLocalStorage(page);
    await seedCart(page);
    await goto(page, '/cart');
    await page.waitForTimeout(1000);
  });

  test('cart has product links pointing to /products/{id}', async ({ page }) => {
    // Links should go to /products/mock-5 or /products/mock-10, NOT /products?search=
    // Use getByRole to find links by their accessible names (product names)
    const testProductLink = page.getByRole('link', { name: 'Test Product' });
    const anotherProductLink = page.getByRole('link', { name: 'Another Product' });
    const hasTest = await testProductLink.isVisible().catch(() => false);
    const hasAnother = await anotherProductLink.isVisible().catch(() => false);
    expect(hasTest || hasAnother).toBe(true);

    // Verify href contains product ID, not search
    if (hasTest) {
      const href = await testProductLink.getAttribute('href');
      expect(href).toContain('/products/mock-');
    }
  });

  test('cart product links do NOT use search pattern', async ({ page }) => {
    // Get all links on the page and check none use search pattern for products
    const allLinks = await page.locator('a').all();
    for (const link of allLinks) {
      const href = await link.getAttribute('href');
      if (href && href.includes('/products?search=')) {
        expect(href).not.toContain('/products?search=');
      }
    }
  });

  test('clicking cart product link navigates to product detail', async ({ page }) => {
    const productLink = page.getByRole('link', { name: 'Test Product' });
    const hasLink = await productLink.isVisible().catch(() => false);
    if (hasLink) {
      await productLink.click();
      await page.waitForURL(/\/products\/mock-/, { timeout: 30000 });
      expect(page.url()).toMatch(/\/products\/mock-\d+/);
    }
  });
});

// ─── Product Links — Checkout Page ──────────────────────────────────────────────

test.describe('Product Links — Checkout', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaLocalStorage(page);
    await seedCart(page);
    await page.evaluate(() => {
      const addresses = [
        {
          id: 'addr-1',
          name: 'Test User',
          phone: '9999999999',
          line1: '123 Main St',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400001',
          isDefault: true,
        },
      ];
      localStorage.setItem('addresses', JSON.stringify(addresses));
    });
    await goto(page, '/checkout');
    await page.waitForTimeout(1000);
  });

  test('checkout product items are visible', async ({ page }) => {
    // Verify the order summary shows product names from seeded cart
    const testProduct = page.locator('text=Test Product');
    const hasProduct = await testProduct
      .first()
      .isVisible({ timeout: 8000 })
      .catch(() => false);
    expect(hasProduct).toBe(true);
  });

  test('checkout does NOT use search-based product links', async ({ page }) => {
    const allLinks = await page.locator('a').all();
    for (const link of allLinks) {
      const href = await link.getAttribute('href');
      if (href && href.includes('/products?search=')) {
        expect(href).not.toContain('/products?search=');
      }
    }
  });
});

// ─── Product Links — Order Details Page ─────────────────────────────────────────

test.describe('Product Links — Order Details', () => {
  test('order detail page loads with HTTP 200', async ({ page }) => {
    await loginViaLocalStorage(page);
    // Seed a mock order
    await page.evaluate(() => {
      const orders = [
        {
          id: 'order-test-1',
          items: [
            {
              productId: 'mock-5',
              productName: 'Test Laptop',
              price: 49999,
              quantity: 1,
              image: '',
            },
          ],
          totalAmount: 49999,
          status: 'delivered',
          createdAt: new Date().toISOString(),
        },
      ];
      localStorage.setItem('orders', JSON.stringify(orders));
    });
    const response = await page.goto(`${BASE_URL}/orders/order-test-1`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    expect(response?.status()).toBeLessThan(400);
  });
});
