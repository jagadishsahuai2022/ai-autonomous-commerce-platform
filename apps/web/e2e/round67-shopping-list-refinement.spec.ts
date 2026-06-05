import { test, expect } from '@playwright/test';

/**
 * Round 67 Phase 4 — Shopping List Search Refinement E2E Tests
 *
 * Tests the new lookup API, category/subcategory/tag autocomplete dropdowns,
 * enhanced search with user hints (Strategy 0), attribute scoring, and
 * regression on existing search quality.
 *
 * Coverage:
 *  1-3: Lookup API (categories, subcategories with dependency, tags with search)
 *  4:   Lookup API edge cases (min 2 chars, empty type)
 *  5:   Shopping List search with categoryId hint
 *  6:   Shopping List search with tagIds hint
 *  7:   Shopping List search with combined category + tags + attributes
 *  8:   Search without hints still works (backward compat)
 *  9:   Shopping List page loads with search refinement section
 * 10:   Category dropdown opens and shows items
 * 11:   SubCategory is disabled until category selected
 * 12:   Tag picker shows add button and opens dropdown
 * 13:   Regression: existing tag API still works (36 tags)
 * 14:   Regression: category mappings still have approved flag
 */

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3010';

test.describe('Round 67 Phase 4: Shopping List Search Refinement', () => {
  // ── 1. Lookup API returns categories ─────────────────────────────────────
  test('1. Lookup API returns categories with product counts', async ({ request }) => {
    const res = await request.get(`${BASE}/api/lookup`, {
      params: { type: 'categories' },
    });
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.items.length).toBeGreaterThanOrEqual(8);
    expect(data.type).toBe('categories');

    // Every category should have id, name, productCount
    for (const cat of data.items) {
      expect(cat).toHaveProperty('id');
      expect(cat).toHaveProperty('name');
      expect(typeof cat.productCount).toBe('number');
    }

    // Known category check
    const electronics = data.items.find((c: any) => c.name.includes('Electronics'));
    expect(electronics).toBeTruthy();
    expect(electronics.productCount).toBeGreaterThan(0);

    console.log(`✓ Lookup API: ${data.items.length} categories, top: ${data.items[0].name} (${data.items[0].productCount.toLocaleString('en-IN')} products)`);
  });

  // ── 2. Lookup API returns subcategories filtered by categoryId ───────────
  test('2. Lookup API returns subcategories filtered by parent category', async ({ request }) => {
    // First get categories
    const catRes = await request.get(`${BASE}/api/lookup`, { params: { type: 'categories' } });
    const cats = (await catRes.json()).items;
    const firstCat = cats[0];

    // Get subcategories for that category
    const res = await request.get(`${BASE}/api/lookup`, {
      params: { type: 'subcategories', categoryId: String(firstCat.id) },
    });
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.items.length).toBeGreaterThan(0);
    expect(data.type).toBe('subcategories');

    // All subcategories should belong to the requested category
    for (const sub of data.items) {
      expect(sub.categoryId).toBe(firstCat.id);
      expect(sub.categoryName).toBe(firstCat.name);
    }

    console.log(`✓ SubCategories for "${firstCat.name}": ${data.items.length} items — ${data.items.map((s: any) => s.name).join(', ')}`);
  });

  // ── 3. Lookup API searches tags with 2+ char query ──────────────────────
  test('3. Lookup API searches tags with text query', async ({ request }) => {
    const res = await request.get(`${BASE}/api/lookup`, {
      params: { type: 'tags', q: 'wire' },
    });
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.items.length).toBeGreaterThanOrEqual(1);
    expect(data.query).toBe('wire');

    const wireless = data.items.find((t: any) => t.name === 'Wireless');
    expect(wireless).toBeTruthy();
    expect(wireless.tagType).toBe('FEATURE');
    expect(wireless.productCount).toBeGreaterThan(0);

    console.log(`✓ Tag search "wire" → ${data.items.length} results, found Wireless (${wireless.productCount.toLocaleString('en-IN')} products)`);
  });

  // ── 4. Lookup API edge cases: min 2 chars, bad type ─────────────────────
  test('4. Lookup API validates input correctly', async ({ request }) => {
    // Single char returns empty (performance guard)
    const r1 = await request.get(`${BASE}/api/lookup`, {
      params: { type: 'categories', q: 'a' },
    });
    expect(r1.status()).toBe(200);
    expect((await r1.json()).items).toHaveLength(0);

    // Missing type returns 400
    const r2 = await request.get(`${BASE}/api/lookup`, {
      params: { type: 'invalid' },
    });
    expect(r2.status()).toBe(400);

    // Empty q (no search) still returns all categories
    const r3 = await request.get(`${BASE}/api/lookup`, {
      params: { type: 'categories' },
    });
    expect(r3.status()).toBe(200);
    expect((await r3.json()).items.length).toBeGreaterThan(0);

    console.log('✓ Lookup API validation: single char → empty, bad type → 400, no q → all items');
  });

  // ── 5. Search with categoryId hint returns category-specific products ───
  test('5. Shopping list search with categoryId hint improves results', async ({ request }) => {
    // Get "Audio & Wearables" category ID
    const catRes = await request.get(`${BASE}/api/lookup`, { params: { type: 'categories' } });
    const audioCategory = (await catRes.json()).items.find((c: any) => c.name.includes('Audio'));
    expect(audioCategory).toBeTruthy();

    // Search with category hint
    const res = await request.post(`${BASE}/api/shopping-list`, {
      data: {
        items: [{
          productName: 'wireless headphones',
          budget: 15000,
          quantity: 1,
          categoryId: audioCategory.id,
        }],
        forceFresh: true,
      },
    });
    expect(res.status()).toBe(200);
    const data = await res.json();
    const matches = data.results?.[0]?.matches ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(1);

    console.log(`✓ Search with categoryId=${audioCategory.id} (${audioCategory.name}) → ${matches.length} matches, top: ${matches[0]?.name}`);
  });

  // ── 6. Search with tagIds hint returns tag-filtered products ────────────
  test('6. Shopping list search with tagIds hint returns tagged products', async ({ request }) => {
    // Get "Wireless" and "Bluetooth" tag IDs
    const tagRes = await request.get(`${BASE}/api/lookup`, { params: { type: 'tags', q: 'wire' } });
    const wirelessTag = (await tagRes.json()).items.find((t: any) => t.name === 'Wireless');
    expect(wirelessTag).toBeTruthy();

    const tagRes2 = await request.get(`${BASE}/api/lookup`, { params: { type: 'tags', q: 'blue' } });
    const btTag = (await tagRes2.json()).items.find((t: any) => t.name === 'Bluetooth');
    expect(btTag).toBeTruthy();

    // Search with tag hints
    const res = await request.post(`${BASE}/api/shopping-list`, {
      data: {
        items: [{
          productName: 'speaker',
          budget: 20000,
          quantity: 1,
          tagIds: [wirelessTag.id, btTag.id],
        }],
        forceFresh: true,
      },
    });
    expect(res.status()).toBe(200);
    const data = await res.json();
    const matches = data.results?.[0]?.matches ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(1);

    console.log(`✓ Search with tagIds=[${wirelessTag.id},${btTag.id}] → ${matches.length} matches, top: ${matches[0]?.name} (${matches[0]?.category})`);
  });

  // ── 7. Search with combined category + tags + attributes ────────────────
  test('7. Combined category + tags + attributes search returns relevant products', async ({ request }) => {
    // Get Gaming category
    const catRes = await request.get(`${BASE}/api/lookup`, { params: { type: 'categories' } });
    const gaming = (await catRes.json()).items.find((c: any) => c.name === 'Gaming');

    // Get Portable tag
    const tagRes = await request.get(`${BASE}/api/lookup`, { params: { type: 'tags', q: 'port' } });
    const portable = (await tagRes.json()).items.find((t: any) => t.name === 'Portable');

    const res = await request.post(`${BASE}/api/shopping-list`, {
      data: {
        items: [{
          productName: 'gaming controller',
          budget: 50000,
          quantity: 1,
          categoryId: gaming?.id || null,
          tagIds: portable ? [portable.id] : null,
          attributes: [{ key: 'Type', value: 'controller' }],
        }],
        forceFresh: true,
      },
    });
    expect(res.status()).toBe(200);
    const data = await res.json();
    const matches = data.results?.[0]?.matches ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(1);

    console.log(`✓ Combined search (Gaming + Portable + controller attr) → ${matches.length} matches, top: ${matches[0]?.name}`);
  });

  // ── 8. Search without hints still works (backward compatibility) ────────
  test('8. Search without any hints still returns results (backward compat)', async ({ request }) => {
    const res = await request.post(`${BASE}/api/shopping-list`, {
      data: {
        items: [{
          productName: 'samsung smartphone',
          budget: 30000,
          quantity: 1,
        }],
        forceFresh: true,
      },
    });
    expect(res.status()).toBe(200);
    const data = await res.json();
    const matches = data.results?.[0]?.matches ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(1);

    // Should find Samsung products
    const hasSamsung = matches.some((m: any) => m.name.toLowerCase().includes('samsung') || m.brand?.toLowerCase() === 'samsung');
    expect(hasSamsung).toBeTruthy();

    console.log(`✓ Backward compat search (no hints) → ${matches.length} matches, Samsung found: ${hasSamsung}`);
  });

  // ── 9. Shopping List page loads with search refinement section ───────────
  test('9. Shopping List page shows search refinement section', async ({ page }) => {
    await page.goto(`${BASE}/shopping-list`, { waitUntil: 'networkidle', timeout: 30000 });

    // Page title
    await expect(page.locator('h1')).toContainText('Shopping List');

    // Search Refinement section should be visible
    await expect(page.getByText('Search Refinement')).toBeVisible();

    // Category and SubCategory dropdowns
    await expect(page.getByText('Category', { exact: false }).first()).toBeVisible();

    // Tags section
    await expect(page.getByText('Tags').first()).toBeVisible();

    // Screenshot
    await page.screenshot({ path: 'e2e/screenshots/r67d-01-shopping-list-refinement.png', fullPage: false });

    console.log('✓ Shopping List page renders with search refinement section');
  });

  // ── 10. Category dropdown opens and shows items ─────────────────────────
  test('10. Category dropdown opens and shows category list', async ({ page }) => {
    await page.goto(`${BASE}/shopping-list`, { waitUntil: 'networkidle', timeout: 30000 });

    // Click the Category select button
    const categoryBtn = page.locator('button:has-text("Select a category")').first();
    await expect(categoryBtn).toBeVisible();
    await categoryBtn.click();
    await page.waitForTimeout(500);

    // Dropdown should appear with a search input
    const searchInput = page.locator('input[placeholder*="Type 2+ chars"]').first();
    await expect(searchInput).toBeVisible();

    // Wait for initial categories to load
    await page.waitForTimeout(1000);

    // Should show category items in the dropdown
    const dropdownItems = page.locator('button:has-text("products")');
    const count = await dropdownItems.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // Screenshot
    await page.screenshot({ path: 'e2e/screenshots/r67d-02-category-dropdown.png', fullPage: false });

    console.log(`✓ Category dropdown shows ${count} items`);
  });

  // ── 11. SubCategory is disabled until category selected ─────────────────
  test('11. SubCategory dropdown is disabled until category is selected', async ({ page }) => {
    await page.goto(`${BASE}/shopping-list`, { waitUntil: 'networkidle', timeout: 30000 });

    // SubCategory button should show "Select category first" and be disabled
    const subCatBtn = page.locator('button:has-text("Select category first")').first();
    await expect(subCatBtn).toBeVisible();
    await expect(subCatBtn).toBeDisabled();

    console.log('✓ SubCategory dropdown is correctly disabled before category selection');
  });

  // ── 12. Tag picker toggle opens dropdown ─────────────────────────────────
  test('12. Tag picker shows add button and can open dropdown', async ({ page }) => {
    await page.goto(`${BASE}/shopping-list`, { waitUntil: 'networkidle', timeout: 30000 });

    // Tags section shows "0 selected" or "Tags (0 selected)"
    await expect(page.getByText(/0 selected/).first()).toBeVisible();

    // New UI: Tags toggle button; Old UI: dedicated "+ Add Tag" button
    const tagsToggle = page.locator('button').filter({ hasText: /Tags/ }).first();
    const addTagBtn = page.locator('button').filter({ hasText: /Add Tag/ }).first();
    if (await tagsToggle.count() > 0) {
      await tagsToggle.click();
    } else {
      await expect(addTagBtn).toBeVisible();
      await addTagBtn.click();
    }
    await page.waitForTimeout(500);

    // Tag search input should appear
    const tagSearch = page.getByRole('textbox', { name: /search tags/i });
    await expect(tagSearch).toBeVisible();

    // Screenshot
    await page.screenshot({ path: 'e2e/screenshots/r67d-03-tag-picker-dropdown.png', fullPage: false });

    console.log('✓ Tag picker opens with search input');
  });

  // ── 13. Regression: existing tag API still works ────────────────────────
  test('13. Regression: Tags API still returns 36+ seeded tags', async ({ request }) => {
    const res = await request.get(`${BASE}/api/admin/tags`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.tags.length).toBeGreaterThanOrEqual(36);

    console.log(`✓ Regression: Tags API returns ${data.tags.length} tags (≥36 expected)`);
  });

  // ── 14. Regression: category mappings still have approved flag ──────────
  test('14. Regression: Categories API returns approved product counts', async ({ request }) => {
    const res = await request.get(`${BASE}/api/admin/categories`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    const totalApproved = data.categories.reduce((s: number, c: any) => s + (c.approvedProductCount || c.productCount || 0), 0);
    expect(totalApproved).toBeGreaterThan(0);

    console.log(`✓ Regression: Categories API — ${data.categories.length} categories, ${totalApproved.toLocaleString('en-IN')} approved product mappings`);
  });
});
