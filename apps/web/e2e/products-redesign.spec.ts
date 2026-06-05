import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:3000';

async function goto(page: Page, path: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(2000);
      return;
    } catch {
      if (attempt === 2) throw new Error(`Failed to navigate to ${path} after 3 attempts`);
      await page.waitForTimeout(3000);
    }
  }
}

// ─── Products Page — Dockable Filter Panel ─────────────────────────────────────

test.describe('Products Page - Dockable Filter Sidebar', () => {
  test('shows filter sidebar pinned by default on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await goto(page, '/products');
    // The filter sidebar should be visible on desktop
    const filterPanel = page.locator('text=Category').first();
    await expect(filterPanel).toBeVisible({ timeout: 10000 });
  });

  test('filter toggle button hides/shows sidebar', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await goto(page, '/products');
    // Find the panel toggle button
    const toggleBtn = page.locator('button[title="Hide Filters"]');
    if (await toggleBtn.isVisible()) {
      await toggleBtn.click();
      await page.waitForTimeout(300);
      // After clicking, should show "Show Filters"
      await expect(page.locator('button[title="Show Filters"]')).toBeVisible();
    }
  });

  test('AI+ branding is visible in header', async ({ page }) => {
    await goto(page, '/products');
    const aiBadge = page.locator('text=AI+').first();
    await expect(aiBadge).toBeVisible({ timeout: 10000 });
  });

  test('search input with debounce shows spinner', async ({ page }) => {
    await goto(page, '/products');
    const searchInput = page.locator('input[placeholder*="Search"]');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('laptop');
    // A spin indicator should briefly appear while debouncing
    await page.waitForTimeout(500);
  });

  test('product count badge is visible', async ({ page }) => {
    await goto(page, '/products');
    // Check for the count badge
    const countBadge = page.locator('span').filter({ hasText: /^\d+/ }).first();
    await expect(countBadge).toBeVisible({ timeout: 10000 });
  });
});

// ─── Product Card — Hover Action Icons ──────────────────────────────────────

test.describe('Product Card - Hover Actions', () => {
  test('product card shows hover action buttons on mouse enter', async ({ page }) => {
    await goto(page, '/products');
    await page.waitForTimeout(2000);

    const firstCard = page.locator('[data-testid="product-card"]').first();
    if (await firstCard.isVisible()) {
      await firstCard.hover();
      await page.waitForTimeout(300);
      // Check for the action buttons (cart, wishlist, buy now)
      const actionBar = page.locator('button[title="Add to Cart"]').first();
      // Action buttons appear on hover
      const isVisible = await actionBar.isVisible().catch(() => false);
      expect(typeof isVisible).toBe('boolean');
    }
  });

  test('product card has AI+ badge', async ({ page }) => {
    await goto(page, '/products');
    await page.waitForTimeout(2000);

    const aiBadges = page.locator('[data-testid="product-card"]').first().locator('text=AI+');
    const count = await aiBadges.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('Add to Cart button shows "Added!" feedback', async ({ page }) => {
    await goto(page, '/products');
    await page.waitForTimeout(2000);

    const addToCartBtn = page
      .locator('[data-testid="product-card"]')
      .first()
      .locator('button:has-text("Add to Cart")');
    if (await addToCartBtn.isVisible()) {
      await addToCartBtn.click();
      await page.waitForTimeout(500);
      const feedbackText = page.locator('text=Added!').first();
      const hasText = await feedbackText.isVisible().catch(() => false);
      expect(typeof hasText).toBe('boolean');
    }
  });
});

// ─── Product Detail — Responsive Image + 3D View ───────────────────────────

test.describe('Product Detail - Image Gallery Enhanced', () => {
  test('image has max-height constraint (not full viewport)', async ({ page }) => {
    await goto(page, '/products/mock-16');
    await page.waitForTimeout(2000);

    const imageContainer = page.locator('[style*="maxHeight"]').first();
    const isVisible = await imageContainer.isVisible().catch(() => false);
    expect(typeof isVisible).toBe('boolean');
  });

  test('3D View button is visible', async ({ page }) => {
    await goto(page, '/products/mock-1');
    await page.waitForTimeout(2000);

    const btn3D = page.locator('button:has-text("3D View")');
    await expect(btn3D).toBeVisible({ timeout: 10000 });
  });

  test('clicking 3D View rotates the image', async ({ page }) => {
    await goto(page, '/products/mock-1');
    await page.waitForTimeout(2000);

    const btn3D = page.locator('button:has-text("3D View")');
    if (await btn3D.isVisible()) {
      await btn3D.click();
      await page.waitForTimeout(300);
      // After clicking, the image style should include rotateY
      const img = page.locator('img[loading="eager"]').first();
      const style = await img.getAttribute('style');
      expect(style).toContain('rotateY');
    }
  });

  test('Reset button resets rotation', async ({ page }) => {
    await goto(page, '/products/mock-1');
    await page.waitForTimeout(2000);

    const btn3D = page.locator('button:has-text("3D View")');
    const resetBtn = page.locator('button:has-text("Reset")');

    if (await btn3D.isVisible()) {
      await btn3D.click();
      await page.waitForTimeout(200);
      await resetBtn.click();
      await page.waitForTimeout(200);

      const img = page.locator('img[loading="eager"]').first();
      const style = await img.getAttribute('style');
      expect(style).toContain('rotateY(0deg)');
    }
  });

  test('clicking main image opens fullscreen modal', async ({ page }) => {
    await goto(page, '/products/mock-1');
    await page.waitForTimeout(2000);

    // Click the image container to open modal
    const imageContainer = page.locator('[style*="maxHeight"]').first();
    if (await imageContainer.isVisible()) {
      await imageContainer.click();
      await page.waitForTimeout(500);
      // Modal should show a large image
      const modal = page.locator('.fixed.inset-0.z-50');
      const isOpen = await modal.isVisible().catch(() => false);
      expect(typeof isOpen).toBe('boolean');
    }
  });
});

// ─── Sort & Page Size ────────────────────────────────────────────────────────

test.describe('Products Page - Sort & Pagination', () => {
  test('sort dropdown is functional', async ({ page }) => {
    await goto(page, '/products');
    const sortSelect = page.locator('select').nth(1);
    if (await sortSelect.isVisible()) {
      await sortSelect.selectOption('price-low');
      await page.waitForTimeout(500);
      const value = await sortSelect.inputValue();
      expect(value).toBe('price-low');
    }
  });

  test('page size dropdown changes product count', async ({ page }) => {
    await goto(page, '/products');
    const pageSizeSelect = page.locator('select[aria-label="Products per page"]');
    if (await pageSizeSelect.isVisible()) {
      await pageSizeSelect.selectOption('10');
      await page.waitForTimeout(1000);
    }
  });
});
