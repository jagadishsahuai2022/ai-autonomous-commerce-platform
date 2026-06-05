import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:3000';

async function goto(page: Page, path: string) {
  await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2000);
}

// ─── Light Theme Verification ──────────────────────────────────────────────────
// Verifies that key pages use light backgrounds and no forced dark styling.

test.describe('Light Theme — Homepage', () => {
  test('homepage has light background', async ({ page }) => {
    await goto(page, '/');
    const body = page.locator('body');
    const bgColor = await body.evaluate((el) => getComputedStyle(el).backgroundColor);
    // Should NOT be very dark (r,g,b all < 50)
    const match = bgColor.match(/\d+/g);
    if (match) {
      const [r, g, b] = match.map(Number);
      const isDark = r < 50 && g < 50 && b < 50;
      expect(isDark).toBe(false);
    }
  });

  test('homepage text is dark on light background', async ({ page }) => {
    await goto(page, '/');
    const mainHeading = page.locator('h1, h2').first();
    const color = await mainHeading.evaluate((el) => getComputedStyle(el).color);
    const match = color.match(/\d+/g);
    if (match) {
      const [r, g, b] = match.map(Number);
      // Text should be reasonably dark (not white-on-dark)
      const isLight = r > 200 && g > 200 && b > 200;
      expect(isLight).toBe(false);
    }
  });

  test('homepage does not have bg-gray-950 class', async ({ page }) => {
    await goto(page, '/');
    const darkBg = await page.locator('.bg-gray-950').count();
    expect(darkBg).toBe(0);
  });
});

test.describe('Light Theme — Products Page', () => {
  test('products page has light background', async ({ page }) => {
    await goto(page, '/products');
    const darkClasses = await page
      .locator('[class*="bg-gray-950"], [class*="bg-slate-900"]')
      .count();
    expect(darkClasses).toBe(0);
  });

  test('product cards have white/light backgrounds', async ({ page }) => {
    await goto(page, '/products');
    await page.waitForTimeout(2000);
    // Cards should use bg-white or light variant
    const cards = page.locator('[class*="bg-white"]');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });
});

test.describe('Light Theme — Orders Page', () => {
  test('orders page has light background', async ({ page }) => {
    await goto(page, '/');
    await page.evaluate(() => {
      localStorage.setItem('authToken', `mock-jwt-${Date.now()}`);
      localStorage.setItem('userEmail', 'test@example.com');
    });
    await goto(page, '/orders');
    const darkBg = await page.locator('.bg-gray-950, .bg-slate-900').count();
    expect(darkBg).toBe(0);
  });
});

test.describe('Light Theme — AI Buy Page', () => {
  test('aibuy page has light background', async ({ page }) => {
    await goto(page, '/aibuy');
    const darkBg = await page.locator('.bg-gray-950, .bg-slate-900').count();
    expect(darkBg).toBe(0);
  });

  test('aibuy search input has light styling', async ({ page }) => {
    await goto(page, '/aibuy');
    const input = page.locator('input, textarea').first();
    const bgColor = await input.evaluate((el) => getComputedStyle(el).backgroundColor);
    const match = bgColor.match(/\d+/g);
    if (match) {
      const [r, g, b] = match.map(Number);
      // Input background should be light (white or near-white)
      const isLight = r > 200 && g > 200 && b > 200;
      expect(isLight).toBe(true);
    }
  });
});

test.describe('Light Theme — Footer', () => {
  test('footer has light background', async ({ page }) => {
    await goto(page, '/');
    const footer = page.locator('footer').first();
    const hasFooter = await footer.isVisible().catch(() => false);
    if (hasFooter) {
      const bgColor = await footer.evaluate((el) => getComputedStyle(el).backgroundColor);
      const match = bgColor.match(/\d+/g);
      if (match) {
        const [r, g, b] = match.map(Number);
        const isDark = r < 50 && g < 50 && b < 50;
        expect(isDark).toBe(false);
      }
    }
  });
});

test.describe('Light Theme — No Forced Dark Classes', () => {
  const pages = ['/', '/products', '/orders', '/aibuy'];

  for (const path of pages) {
    test(`${path} has no bg-gray-950 anywhere`, async ({ page }) => {
      await goto(page, path);
      const count = await page.locator('[class*="bg-gray-950"]').count();
      expect(count).toBe(0);
    });
  }
});
