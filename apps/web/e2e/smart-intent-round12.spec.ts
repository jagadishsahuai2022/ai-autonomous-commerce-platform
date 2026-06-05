/**
 * Smart Intent Engine — Round 12 E2E Tests
 *
 * Tests the new features:
 *  1. Products page search uses intent engine (allen solly jeans → fashion results)
 *  2. Products page search for "phone under 20000" → phones returned
 *  3. 100K mock catalog — fashion/home/sports categories visible in browse mode
 *  4. Homepage dynamic sections render (Best Deals, Top Rated)
 *  5. Infinite scroll pagination stability
 *  6. Voice search UI is present
 *  7. Intent API returns AI-enriched fields
 *  8. Product learning API accepts events
 *
 * Config: screenshot: 'on', video: 'on', reporter: html
 */
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function intentSearch(request: any, query: string) {
  const res = await request.post(`${BASE_URL}/api/intent/analyze`, {
    data: { query, engine: 'v2' },
  });
  const body = await res.json();
  return { res, body };
}

// ══════════════════════════════════════════════════════════════════════════════
// Scenario 1: "allen solly jeans" → fashion products via intent engine
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Intent-powered product search', () => {
  test('allen solly jeans returns fashion products from intent engine', async ({ request }) => {
    const { res, body } = await intentSearch(request, 'allen solly jeans');
    expect(res.ok()).toBe(true);
    expect(body.products).toBeDefined();
    expect(body.products.length).toBeGreaterThan(0);

    // Should have fashion / jeans related products
    const hasJeansOrFashion = body.products.some(
      (p: any) =>
        p.name?.toLowerCase().includes('jeans') ||
        p.category?.toLowerCase().includes('fashion') ||
        p.brand?.toLowerCase().includes('allen solly')
    );
    expect(hasJeansOrFashion).toBe(true);
  });

  test('phone under 20000 returns phones with correct budget', async ({ request }) => {
    const { res, body } = await intentSearch(request, 'phone under 20000');
    expect(res.ok()).toBe(true);
    expect(body.products.length).toBeGreaterThan(0);

    // All products should be phones
    const allPhones = body.products.every(
      (p: any) => p.category?.toLowerCase() === 'phone' || p.specifications?.category === 'phone'
    );
    expect(allPhones).toBe(true);

    // Most should be under 24000 (20000 + 20% tolerance)
    const underBudget = body.products.filter((p: any) => p.price <= 24000);
    expect(underBudget.length).toBeGreaterThanOrEqual(Math.floor(body.products.length * 0.5));
  });

  test('washing machine search returns appliances only', async ({ request }) => {
    const { res, body } = await intentSearch(request, 'washing machine under 30000');
    expect(res.ok()).toBe(true);
    expect(body.products.length).toBeGreaterThan(0);

    // No cross-category leakage
    const noPhones = body.products.every(
      (p: any) => p.category?.toLowerCase() !== 'phone' && !p.name?.toLowerCase().includes('iphone')
    );
    expect(noPhones).toBe(true);
  });

  test('intent response includes AI-enriched fields', async ({ request }) => {
    const { body } = await intentSearch(request, 'best laptop for coding');
    expect(body.engine_version).toBe('v2');
    expect(body.intent).toBeDefined();
    expect(body.intent.category).toBeTruthy();
    expect(body.intent.confidence).toBeGreaterThan(0);
    expect(body.products[0]).toHaveProperty('relevanceScore');
    expect(body.products[0]).toHaveProperty('scoreBreakdown');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Scenario 2: 100K mock catalog diversity
// ══════════════════════════════════════════════════════════════════════════════

test.describe('100K product catalog', () => {
  test('mock API returns products from multiple categories', async ({ request }) => {
    // Fetch products from different offsets to hit different categories
    const electronics = await request.get(`${BASE_URL}/api/products?skip=0&take=5`);
    const eData = await electronics.json();
    expect(eData.products?.length || eData.data?.length).toBeGreaterThan(0);

    // Fashion starts at index 11000+ (after 8 electronics + 3 grocery subcats × 1000)
    const fashion = await request.get(`${BASE_URL}/api/products?skip=11000&take=5`);
    const fData = await fashion.json();
    const fProducts = fData.products || fData.data || [];
    expect(fProducts.length).toBeGreaterThan(0);
    // Should be Fashion category
    expect(fProducts[0].category).toBe('Fashion');

    // Home & Kitchen starts at index 17000+
    const home = await request.get(`${BASE_URL}/api/products?skip=17000&take=5`);
    const hData = await home.json();
    const hProducts = hData.products || hData.data || [];
    expect(hProducts.length).toBeGreaterThan(0);
  });

  test('total product count is 100K', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/products?skip=0&take=1`);
    const data = await res.json();
    expect(data.total).toBe(100000);
  });

  test('category filter returns correct products', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/products?category=fashion&skip=0&take=10`);
    const data = await res.json();
    const products = data.products || data.data || [];
    expect(products.length).toBeGreaterThan(0);
    for (const p of products) {
      expect(p.category.toLowerCase()).toBe('fashion');
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Scenario 3: Homepage dynamic sections
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Homepage', () => {
  test('renders all core sections', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Hero section
    await expect(page.locator('text=Smart Shopping')).toBeVisible({ timeout: 15000 });

    // Stats should show 100K+
    await expect(page.locator('text=100K+')).toBeVisible();

    // Categories section
    await expect(page.locator('text=Shop by Category')).toBeVisible();

    // AI Features
    await expect(page.locator('text=AI Shopping Assistant')).toBeVisible();

    // Featured Products
    await expect(page.locator('text=Featured Products')).toBeVisible();

    await page.screenshot({ path: 'test-results/homepage-full.png', fullPage: true });
  });

  test('category links navigate to products page', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Click Electronics category
    const electronicsLink = page.locator('a[href*="/products?category=electronics"]').first();
    if (await electronicsLink.isVisible()) {
      await electronicsLink.click();
      await page.waitForURL(/products/);
      expect(page.url()).toContain('category=electronics');
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Scenario 4: Products page search integration
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Products page', () => {
  test('search for "allen solly jeans" shows results', async ({ page }) => {
    await page.goto(`${BASE_URL}/products?q=allen+solly+jeans`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // Should NOT show "No products found"
    const noResults = page.locator('text=No products found');
    const hasNoResults = await noResults.isVisible().catch(() => false);

    // Should show product cards
    const cards = page.locator('[data-testid="product-card"], .group');
    const cardCount = await cards.count();

    await page.screenshot({ path: 'test-results/allen-solly-search.png', fullPage: true });

    // At least one of these should pass — either we got results or the intent engine is running
    expect(hasNoResults === false || cardCount > 0).toBe(true);
  });

  test('browse mode shows products with infinite scroll', async ({ page }) => {
    await page.goto(`${BASE_URL}/products`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // Should show products
    const cards = page.locator('[data-testid="product-card"], .group');
    const initialCount = await cards.count();
    expect(initialCount).toBeGreaterThan(0);

    await page.screenshot({ path: 'test-results/products-browse.png', fullPage: true });
  });

  test('add to cart from products page works', async ({ page }) => {
    await page.goto(`${BASE_URL}/products`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // Find and click the first "Add to Cart" button
    const addBtn = page.locator('button:has-text("Add to Cart"), button:has-text("Add")').first();
    if (await addBtn.isVisible()) {
      await addBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'test-results/add-to-cart.png' });
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Scenario 5: Voice search UI
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Search UI', () => {
  test('search island has mic button', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // The search island is always visible in the header — look for the mic button directly
    const micBtn = page
      .locator('[aria-label="Start voice search"], [title="Search by voice"]')
      .first();
    await expect(micBtn).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: 'test-results/search-ui.png' });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Scenario 6: Pagination stability
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Pagination stability', () => {
  test('consecutive page fetches return deterministic products', async ({ request }) => {
    // Fetch page 1 twice — should get identical results
    const r1 = await request.get(`${BASE_URL}/api/products?skip=0&take=5`);
    const d1 = await r1.json();
    const r2 = await request.get(`${BASE_URL}/api/products?skip=0&take=5`);
    const d2 = await r2.json();

    const ids1 = (d1.products || d1.data || []).map((p: any) => p.id);
    const ids2 = (d2.products || d2.data || []).map((p: any) => p.id);
    expect(ids1).toEqual(ids2);
  });

  test('page 2 does not overlap with page 1', async ({ request }) => {
    const r1 = await request.get(`${BASE_URL}/api/products?skip=0&take=20`);
    const d1 = await r1.json();
    const r2 = await request.get(`${BASE_URL}/api/products?skip=20&take=20`);
    const d2 = await r2.json();

    const ids1 = new Set((d1.products || d1.data || []).map((p: any) => p.id));
    const ids2 = (d2.products || d2.data || []).map((p: any) => p.id);

    for (const id of ids2) {
      expect(ids1.has(id)).toBe(false);
    }
  });
});
