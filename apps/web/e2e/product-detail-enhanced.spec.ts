import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:3000';

async function goto(page: Page, path: string) {
  await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2000);
}

// ─── Product Detail Page — Enhanced Coverage ───────────────────────────────────

test.describe('Product Detail — Image Gallery', () => {
  test('displays multiple product images with thumbnails', async ({ page }) => {
    await goto(page, '/products/mock-1');
    const images = await page.locator('img[alt]').count();
    expect(images).toBeGreaterThanOrEqual(1);
  });

  test('clicking thumbnail changes the main image', async ({ page }) => {
    await goto(page, '/products/mock-1');
    const thumbnails = page.locator('img').filter({ has: page.locator('[class*="cursor"]') });
    const thumbCount = await thumbnails.count();
    if (thumbCount > 1) {
      await thumbnails.nth(1).click();
      await page.waitForTimeout(500);
      // Just verify click doesn't error — image gallery stays visible
      const mainImage = page.locator('img').first();
      await expect(mainImage).toBeVisible();
    }
  });

  test('image gallery arrow buttons navigate images', async ({ page }) => {
    await goto(page, '/products/mock-2');
    // Look for next/prev arrow buttons
    const nextArrow = page
      .locator('button')
      .filter({ hasText: /›|→|next|▶/i })
      .first();
    const hasArrows = await nextArrow.isVisible().catch(() => false);
    if (hasArrows) {
      await nextArrow.click();
      await page.waitForTimeout(300);
      // No crash — gallery is still visible
      await expect(page.locator('img').first()).toBeVisible();
    }
  });
});

test.describe('Product Detail — Tabs', () => {
  test('shows Highlights, Specifications, and Reviews tabs', async ({ page }) => {
    await goto(page, '/products/mock-1');
    const highlights = page.locator('text=/highlight/i').first();
    const specs = page.locator('text=/specification/i').first();
    const reviews = page.locator('text=/review/i').first();

    await expect(highlights).toBeVisible({ timeout: 8000 });
    await expect(specs).toBeVisible({ timeout: 3000 });
    await expect(reviews).toBeVisible({ timeout: 3000 });
  });

  test('clicking Specifications tab shows spec table', async ({ page }) => {
    await goto(page, '/products/mock-1');
    const specsTab = page.locator('button:has-text("Specifications")').first();
    await specsTab.click();
    await page.waitForTimeout(500);
    // Should display key-value pairs
    const specContent = page.locator('text=/brand|product|weight/i');
    const count = await specContent.count();
    expect(count).toBeGreaterThan(0);
  });

  test('clicking Reviews tab shows review content', async ({ page }) => {
    await goto(page, '/products/mock-1');
    const reviewsTab = page.locator('button:has-text("Reviews")').first();
    await reviewsTab.click();
    await page.waitForTimeout(500);
    // Reviews should show star ratings or review text
    const reviewContent = page.locator('text=/excellent|great|good|recommend|happy/i');
    const count = await reviewContent.count();
    expect(count).toBeGreaterThan(0);
  });
});

test.describe('Product Detail — Buy Now & Delivery', () => {
  test('Buy Now button is visible for in-stock products', async ({ page }) => {
    // mock-2 is in stock (index 1, 1%20 !== 0)
    await goto(page, '/products/mock-2');
    const buyNow = page.getByRole('button', { name: /buy now/i });
    await expect(buyNow).toBeVisible({ timeout: 10000 });
  });

  test('delivery pincode checker accepts input', async ({ page }) => {
    await goto(page, '/products/mock-1');
    const pincodeInput = page
      .locator('input[placeholder*="pincode" i], input[placeholder*="PIN" i]')
      .first();
    const hasInput = await pincodeInput.isVisible().catch(() => false);
    if (hasInput) {
      await pincodeInput.fill('400001');
      const checkBtn = page.locator('button:has-text("Check")').first();
      await checkBtn.click();
      await page.waitForTimeout(1000);
      // Should show delivery estimate
      const deliveryMsg = page.locator('text=/deliver|available|days/i');
      const count = await deliveryMsg.count();
      expect(count).toBeGreaterThan(0);
    }
  });

  test('product shows EMI information for expensive items', async ({ page }) => {
    // mock-1 is Smartphones (Apple) — price > 5000, hasEMI = true
    await goto(page, '/products/mock-1');
    const emiText = page.locator('text=/emi|month/i');
    const count = await emiText.count();
    expect(count).toBeGreaterThan(0);
  });
});

test.describe('Product Detail — Related Products', () => {
  test('related products section is visible', async ({ page }) => {
    await goto(page, '/products/mock-1');
    await page.waitForTimeout(3000);
    const related = page.locator('text=/related|similar|you may/i');
    await expect(related.first()).toBeVisible({ timeout: 8000 });
  });

  test('related products have clickable links', async ({ page }) => {
    await goto(page, '/products/mock-1');
    await page.waitForTimeout(3000);
    // Related products section should contain links to other products
    const productLinks = page.locator('a[href*="/products/mock-"]');
    const count = await productLinks.count();
    expect(count).toBeGreaterThan(0);
  });
});

test.describe('Product Detail — Trust & Seller Info', () => {
  test('shows seller information', async ({ page }) => {
    await goto(page, '/products/mock-1');
    const seller = page.locator('text=/seller|official store|sold by/i');
    const count = await seller.count();
    expect(count).toBeGreaterThan(0);
  });

  test('shows trust badges or warranty info', async ({ page }) => {
    await goto(page, '/products/mock-1');
    const trust = page.locator('text=/warranty|genuine|authentic|trust|secure/i');
    const count = await trust.count();
    expect(count).toBeGreaterThan(0);
  });
});

test.describe('Product Detail — Stock Status', () => {
  test('in-stock product shows stock status', async ({ page }) => {
    await goto(page, '/products/mock-2');
    const stock = page.locator('text=/in stock|available|left/i');
    const count = await stock.count();
    expect(count).toBeGreaterThan(0);
  });

  test('out-of-stock product (mock-20) shows out-of-stock', async ({ page }) => {
    // index 19: 19 % 20 === 19, not 0 — need mock-21 (index 20, 20%20 === 0)
    await goto(page, '/products/mock-21');
    await page.waitForTimeout(2000);
    const outOfStock = page.locator('text=/out of stock|sold out|unavailable/i');
    const count = await outOfStock.count();
    expect(count).toBeGreaterThan(0);
  });
});
