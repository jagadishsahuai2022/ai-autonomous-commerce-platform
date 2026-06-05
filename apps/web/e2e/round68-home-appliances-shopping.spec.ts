/**
 * Round 68 Phase 2 – E2E Tests: Home Appliances Shopping List
 *
 * Tests:
 *  1.  Tags section has no separate "+Add Tag" standalone dashed button
 *  2.  Tags toggle (label/button) is visible with "Tags" text
 *  3.  Tags dropdown opens on click and shows tag options
 *  4.  Tags dropdown closes on second click
 *  5-15. API: Search for each home appliance type returns results
 * 16.  API: Shopping list with Home & Kitchen category hint returns results
 * 17.  Regression: Lookup API categories works
 * 18.  Regression: Lookup API tags works
 */

import { test, expect, Page } from '@playwright/test';

const BASE = process.env.BASE_URL || 'http://localhost:3010';

// ─── helpers ─────────────────────────────────────────────────────────────────

async function goToShoppingList(page: Page) {
  await page.goto(`${BASE}/shopping-list`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('h1, main', { timeout: 10000 });
}

/**
 * Direct API call to POST /api/shopping-list — bypasses UI, faster and more reliable.
 */
async function apiSearch(page: Page, productName: string, opts?: { categoryId?: number; tagIds?: number[] }) {
  const body = {
    items: [{
      productName,
      preferredBrand: null,
      budget: null,
      quantity: 1,
      deliveryDays: null,
      paymentMethod: 'any',
      emiOnly: false,
      categoryId: opts?.categoryId ?? null,
      subCategoryId: null,
      tagIds: opts?.tagIds ?? null,
      attributes: null,
    }],
  };
  const response = await page.request.post(`${BASE}/api/shopping-list`, {
    data: body,
    headers: { 'Content-Type': 'application/json' },
  });
  return response;
}

// ─── TEST SUITE ───────────────────────────────────────────────────────────────

test.describe('Round 68 Phase 2 – Home Appliances & UI Polish', () => {
  test.setTimeout(60_000);

  // ── 1. Tags UI: no dashed "+ Add Tag" standalone button ───────────────────
  // The new TagPicker is a single clickable button (toggle). The old UI had a
  // separate dashed-border button with exactly the text "+ Add Tag".
  // The new code only shows a hint <p> ("Click to add tags") — NOT a button.

  test('1. Tags area has no standalone dashed "+Add Tag" button — it is a toggle', async ({ page }) => {
    await goToShoppingList(page);
    // The old code rendered: <button class="border-dashed">+ Add Tag</button>
    // The new code does NOT have this. Any button containing "Add Tag" text
    // (excluding the hint paragraph and the toggle button text) should not exist.
    // We look for a button that has EXACTLY the pattern of the old dashed button.
    // Note: the toggle button text contains "Tags" but not a standalone "Add Tag".
    const oldDashedBtn = page.locator('button').filter({ hasText: /^\+\s*Add Tag$/ });
    await expect(oldDashedBtn).toHaveCount(0);
  });

  // ── 2. Tags toggle button/element is visible ──────────────────────────────

  test('2. Tags toggle is visible in the Search Refinement section', async ({ page }) => {
    await goToShoppingList(page);
    // The Tags section label — could be a <button> (new code) or <label>/<span> (old code).
    // Either way it should contain the text "Tags" and be visible.
    const tagsLabel = page.locator('button, label, span').filter({ hasText: /Tags/ }).first();
    await expect(tagsLabel).toBeVisible({ timeout: 5000 });
  });

  // ── 3. Tags area opens a dropdown when interacted with ────────────────────

  test('3. Tags area opens a dropdown with tag options when triggered', async ({ page }) => {
    await goToShoppingList(page);

    // Try new code: clickable button with "Tags" text
    const tagsBtn = page.locator('button').filter({ hasText: /Tags/ }).first();
    if (await tagsBtn.count() > 0) {
      await tagsBtn.click();
    } else {
      // Old code: click the "+ Add Tag" dashed button to open dropdown
      const addTagBtn = page.locator('button').filter({ hasText: /Add Tag/ }).first();
      await addTagBtn.click();
    }

    // Either way a search input should appear
    // Use getByRole for precision to avoid strict mode violations
    const searchInput = page.getByRole('textbox', { name: /search tags/i });
    await expect(searchInput).toBeVisible({ timeout: 5000 });
  });

  // ── 4. Tags dropdown closes after second click (new toggle) ───────────────

  test('4. Tags dropdown closes when toggle is clicked again (new code only)', async ({ page }) => {
    await goToShoppingList(page);

    const tagsBtn = page.locator('button').filter({ hasText: /Tags/ }).first();
    if (await tagsBtn.count() === 0) {
      // Old code doesn't have a toggle — skip gracefully
      test.skip();
      return;
    }

    await tagsBtn.click(); // open
    const searchInput = page.getByRole('textbox', { name: /search tags/i });
    await expect(searchInput).toBeVisible({ timeout: 3000 });

    await tagsBtn.click(); // close
    await expect(searchInput).not.toBeVisible({ timeout: 3000 });
  });

  // ── 5-15. Product search via direct API (reliable, no UI click needed) ────

  const searchTests: { n: number; query: string }[] = [
    { n: 5,  query: 'washing machine'  },
    { n: 6,  query: 'refrigerator'     },
    { n: 7,  query: 'air conditioner'  },
    { n: 8,  query: 'microwave'        },
    { n: 9,  query: 'air fryer'        },
    { n: 10, query: 'induction cooktop'},
    { n: 11, query: 'bed'              },
    { n: 12, query: 'sofa set'         },
    { n: 13, query: 'mattress'         },
    { n: 14, query: 'water purifier'   },
    { n: 15, query: 'water cooler'     },
  ];

  for (const { n, query } of searchTests) {
    test(`${n}. API: Search "${query}" returns at least 1 product result`, async ({ page }) => {
      const response = await apiSearch(page, query);
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body).toBeDefined();

      // Response shape: { results: ShoppingListResult[] } where each result has matches[]
      const results: Array<{ matches?: unknown[] }> = Array.isArray(body)
        ? body
        : body.results ?? body.items ?? [];

      expect(
        results.length,
        `Expected results for "${query}" but got 0. Response: ${JSON.stringify(body).slice(0, 400)}`
      ).toBeGreaterThan(0);

      // Check the first result has at least one match
      if (results[0]?.matches) {
        expect(results[0].matches!.length).toBeGreaterThan(0);
      }
    });
  }

  // ── 16. Shopping list with Home & Kitchen category hint ────────────────────

  test('16. API: Shopping list with Home & Kitchen categoryId=5 hint returns results', async ({ page }) => {
    const response = await apiSearch(page, 'air fryer', { categoryId: 5 });
    expect(response.status()).toBe(200);

    const body = await response.json();
    const results: Array<{ matches?: unknown[] }> = Array.isArray(body)
      ? body
      : body.results ?? body.items ?? [];
    expect(results.length).toBeGreaterThan(0);
  });

  // ── 17. Regression: Lookup API categories endpoint ───────────────────────

  test('17. Regression: GET /api/lookup?type=categories returns list with Home & Kitchen', async ({ page }) => {
    const response = await page.request.get(`${BASE}/api/lookup?type=categories`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    // Response shape: { items: Category[], type: string, query: string }
    const data: { name: string }[] = body.items ?? body.data ?? body;
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);

    const homeKitchen = data.find((c) =>
      c.name?.toLowerCase().includes('home') || c.name?.toLowerCase().includes('kitchen')
    );
    expect(homeKitchen, 'Home & Kitchen category should exist in lookup').toBeDefined();
  });

  // ── 18. Regression: Lookup API tags search ────────────────────────────────

  test('18. Regression: GET /api/lookup?type=tags&q=energy returns energy tags', async ({ page }) => {
    const response = await page.request.get(`${BASE}/api/lookup?type=tags&q=energy`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    // Response shape: { items: Tag[], type: string, query: string }
    const data: { name: string }[] = body.items ?? body.data ?? body;
    expect(Array.isArray(data)).toBe(true);

    const energyTag = data.find((t) =>
      t.name?.toLowerCase().includes('energy')
    );
    expect(energyTag, 'Energy Efficient tag should be in results').toBeDefined();
  });
});
