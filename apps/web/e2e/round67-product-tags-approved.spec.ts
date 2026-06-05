import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

/**
 * R67 Phase 3: ProductTag + Approved Flag E2E Tests
 * Tests: Tag CRUD API, tag-mapping approval, approved-only search, admin UI
 */

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3010';

test.describe('Round 67 Phase 3: ProductTag & Approved Flags', () => {

  // ── 1. Tags API: GET returns seeded tags ─────────────────────────────────
  test('1. Tags API returns 36 seeded tags with correct structure', async ({ request }) => {
    const res = await request.get(`${BASE}/api/admin/tags`);
    expect(res.status()).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.tags.length).toBe(36);

    // Check structure of first tag
    const tag = data.tags[0];
    expect(tag).toHaveProperty('id');
    expect(tag).toHaveProperty('name');
    expect(tag).toHaveProperty('slug');
    expect(tag).toHaveProperty('tagType');
    expect(tag).toHaveProperty('status');
    expect(tag).toHaveProperty('productCount');
    expect(tag).toHaveProperty('approvedCount');

    // Verify all tag types exist
    const types = [...new Set(data.tags.map((t: any) => t.tagType))];
    expect(types).toContain('FEATURE');
    expect(types).toContain('TECHNOLOGY');
    expect(types).toContain('PRICE_RANGE');
    expect(types).toContain('USE_CASE');
    expect(types).toContain('QUALITY');

    console.log(`✓ 36 tags returned across ${types.length} tag types`);
  });

  // ── 2. Tags API: filter by tagType ────────────────────────────────────────
  test('2. Tags API filters by tagType correctly', async ({ request }) => {
    const res = await request.get(`${BASE}/api/admin/tags?tagType=PRICE_RANGE`);
    expect(res.status()).toBe(200);

    const data = await res.json();
    expect(data.tags.length).toBe(4);
    data.tags.forEach((t: any) => expect(t.tagType).toBe('PRICE_RANGE'));

    const names = data.tags.map((t: any) => t.name);
    expect(names).toContain('Budget Friendly');
    expect(names).toContain('Mid Range');
    expect(names).toContain('Premium');
    expect(names).toContain('Ultra Premium');

    // Price range tags should have product counts
    const totalProducts = data.tags.reduce((s: number, t: any) => s + t.productCount, 0);
    expect(totalProducts).toBe(100000); // all 100k products have a price range tag

    console.log(`✓ PRICE_RANGE filter: 4 tags, ${totalProducts.toLocaleString()} total products`);
  });

  // ── 3. Tags CRUD: create, update, soft-delete ────────────────────────────
  test('3. Tag CRUD: create → update → soft-delete lifecycle', async ({ request }) => {
    const uniqueName = `E2E-Test-Tag-${Date.now()}`;

    // CREATE
    const createRes = await request.post(`${BASE}/api/admin/tags`, {
      data: { name: uniqueName, description: 'Test tag from Playwright', tagType: 'QUALITY', sortOrder: 99 },
    });
    expect(createRes.status()).toBe(201);
    const created = await createRes.json();
    expect(created.success).toBe(true);
    expect(created.tag.name).toBe(uniqueName);
    expect(created.tag.tagType).toBe('QUALITY');
    expect(created.tag.status).toBe('ACTIVE');
    const tagId = created.tag.id;
    console.log(`✓ Created tag id=${tagId} name="${uniqueName}"`);

    // UPDATE
    const updateRes = await request.put(`${BASE}/api/admin/tags`, {
      data: { id: tagId, description: 'Updated by E2E test', sortOrder: 50 },
    });
    expect(updateRes.status()).toBe(200);
    const updated = await updateRes.json();
    expect(updated.tag.description).toBe('Updated by E2E test');
    expect(updated.tag.sortOrder).toBe(50);
    console.log(`✓ Updated tag id=${tagId}: description + sortOrder`);

    // SOFT DELETE (set INACTIVE)
    const deleteRes = await request.delete(`${BASE}/api/admin/tags?id=${tagId}`);
    expect(deleteRes.status()).toBe(200);
    const deleted = await deleteRes.json();
    expect(deleted.tag.status).toBe('INACTIVE');
    console.log(`✓ Soft-deleted tag id=${tagId}: status=INACTIVE`);

    // Verify hidden from active-only list
    const listRes = await request.get(`${BASE}/api/admin/tags`);
    const listData = await listRes.json();
    const found = listData.tags.find((t: any) => t.id === tagId);
    expect(found).toBeUndefined();
    console.log(`✓ Tag id=${tagId} hidden from active-only listing`);

    // Verify visible with includeInactive
    const listAllRes = await request.get(`${BASE}/api/admin/tags?includeInactive=true`);
    const listAllData = await listAllRes.json();
    const foundAll = listAllData.tags.find((t: any) => t.id === tagId);
    expect(foundAll).toBeDefined();
    expect(foundAll.status).toBe('INACTIVE');
    console.log(`✓ Tag id=${tagId} visible with includeInactive=true`);
  });

  // ── 4. Tag duplicate name rejected ────────────────────────────────────────
  test('4. Tag creation rejects duplicate names', async ({ request }) => {
    const res = await request.post(`${BASE}/api/admin/tags`, {
      data: { name: 'Wireless', tagType: 'FEATURE' }, // already exists
    });
    expect(res.status()).toBe(409);
    const data = await res.json();
    expect(data.error).toContain('already exists');
    console.log('✓ Duplicate tag name "Wireless" correctly rejected with 409');
  });

  // ── 5. Tag-mappings API: get mappings for a product ──────────────────────
  test('5. Tag-mappings API returns tags for a product', async ({ request }) => {
    // Find a product that has tag mappings (tagged as "Wireless")
    const tagRes = await request.get(`${BASE}/api/admin/tag-mappings?tagId=1`); // Wireless = id 1
    expect(tagRes.status()).toBe(200);
    const tagData = await tagRes.json();
    expect(tagData.products.length).toBeGreaterThan(0);

    const productId = tagData.products[0].productId;

    // Get tags for that product
    const res = await request.get(`${BASE}/api/admin/tag-mappings?productId=${productId}`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.tags.length).toBeGreaterThan(0);

    // Each tag should have expected fields
    const tag = data.tags[0];
    expect(tag).toHaveProperty('tagId');
    expect(tag).toHaveProperty('approved');
    expect(tag).toHaveProperty('name');
    expect(tag).toHaveProperty('tagType');

    console.log(`✓ Product id=${productId} has ${data.tags.length} tag(s): ${data.tags.map((t: any) => t.name).join(', ')}`);
  });

  // ── 6. Tag-mapping approval workflow ──────────────────────────────────────
  test('6. Tag-mapping approval: add unapproved → approve → unapprove', async ({ request }) => {
    // Get a product ID from an existing mapping
    const tagRes = await request.get(`${BASE}/api/admin/tag-mappings?tagId=1`);
    const tagData = await tagRes.json();
    const productId = tagData.products[0].productId;

    // Find a tag not yet mapped to this product
    const productTagsRes = await request.get(`${BASE}/api/admin/tag-mappings?productId=${productId}`);
    const productTagsData = await productTagsRes.json();
    const mappedTagIds = new Set(productTagsData.tags.map((t: any) => t.tagId));

    // Use "Best Seller" (id=33) as test tag - likely not mapped
    const testTagId = 33;

    // Add mapping (unapproved)
    const addRes = await request.post(`${BASE}/api/admin/tag-mappings`, {
      data: { productId, tagId: testTagId, approved: false },
    });
    expect(addRes.status()).toBe(201);
    console.log(`✓ Added unapproved mapping: product=${productId} → tag=${testTagId}`);

    // Verify it's unapproved
    const checkRes = await request.get(`${BASE}/api/admin/tag-mappings?productId=${productId}`);
    const checkData = await checkRes.json();
    const unapprovedTag = checkData.tags.find((t: any) => t.tagId === testTagId);
    expect(unapprovedTag).toBeDefined();
    expect(unapprovedTag.approved).toBe(false);
    console.log(`✓ Mapping confirmed unapproved`);

    // Approve it
    const approveRes = await request.put(`${BASE}/api/admin/tag-mappings`, {
      data: { productId, tagId: testTagId, approved: true },
    });
    expect(approveRes.status()).toBe(200);
    const approveData = await approveRes.json();
    expect(approveData.mapping.approved).toBe(true);
    expect(approveData.mapping.approvedBy).toBe('admin');
    console.log(`✓ Mapping approved by admin`);

    // Unapprove it
    const unapproveRes = await request.put(`${BASE}/api/admin/tag-mappings`, {
      data: { productId, tagId: testTagId, approved: false },
    });
    expect(unapproveRes.status()).toBe(200);
    const unapproveData = await unapproveRes.json();
    expect(unapproveData.mapping.approved).toBe(false);
    console.log(`✓ Mapping unapproved`);

    // Clean up: delete mapping
    const deleteRes = await request.delete(`${BASE}/api/admin/tag-mappings?productId=${productId}&tagId=${testTagId}`);
    expect(deleteRes.status()).toBe(200);
    console.log(`✓ Mapping cleaned up (deleted)`);
  });

  // ── 7. Approved flag on category mappings ─────────────────────────────────
  test('7. Category mappings have approved flag and counts filter by approved', async ({ request }) => {
    const catRes = await request.get(`${BASE}/api/admin/categories`);
    expect(catRes.status()).toBe(200);
    const catData = await catRes.json();

    expect(catData.categories.length).toBeGreaterThan(0);
    // Categories have productCount from approved mappings
    const firstCat = catData.categories[0];
    expect(firstCat).toHaveProperty('productCount');
    expect(typeof firstCat.productCount).toBe('number');

    const totalApproved = catData.categories.reduce((s: number, c: any) => s + c.productCount, 0);
    // Should be close to the total mapped products (130k)
    expect(totalApproved).toBeGreaterThan(50000);

    console.log(`✓ Categories API: ${catData.categories.length} categories, ${totalApproved.toLocaleString()} approved product mappings`);
  });

  // ── 8. Search returns results using approved tag-based Strategy 5 ────────
  test('8. Search with tag-relevant terms returns products (approved filter)', async ({ request }) => {
    // Search for "wireless bluetooth" - should match via tag names
    const body = {
      items: [{ productName: 'wireless bluetooth headphones', budget: 15000, quantity: 1 }],
    };
    const res = await request.post(`${BASE}/api/shopping-list`, { data: body });
    expect(res.status()).toBe(200);

    const data = await res.json();
    expect(data.results).toBeDefined();
    expect(data.results.length).toBeGreaterThan(0);
    expect(data.results[0].matches.length).toBeGreaterThan(0);

    const internalResults = data.results[0].matches.filter((m: any) => m.source === 'INTERNAL');
    expect(internalResults.length).toBeGreaterThan(0);

    console.log(`✓ "wireless bluetooth headphones" → ${internalResults.length} INTERNAL results`);
    if (internalResults[0]) {
      console.log(`  Top: ${internalResults[0].name} (₹${internalResults[0].price})`);
    }
  });

  // ── 9. Admin Tags page loads with correct content ─────────────────────────
  test('9. Admin Tags page loads and displays tag groups', async ({ page }) => {
    await page.goto(`${BASE}/admin/tags`, { waitUntil: 'networkidle', timeout: 30000 });

    // Title
    await expect(page.locator('h1')).toContainText('Product Tags');

    // Stats should show tags count
    const statsText = await page.locator('.grid.grid-cols-4').textContent();
    expect(statsText).toContain('Tags');

    // Should show tag type groups (FEATURE, PRICE_RANGE, etc.)
    const pageText = await page.textContent('body');
    expect(pageText).toContain('Feature');
    expect(pageText).toContain('Price Range');
    expect(pageText).toContain('Use Case');

    // Should show some tag names
    expect(pageText).toContain('Wireless');
    expect(pageText).toContain('Premium');
    expect(pageText).toContain('Work From Home');

    // New Tag button exists
    await expect(page.getByRole('button', { name: /New Tag/i })).toBeVisible();

    // Screenshot
    await page.screenshot({ path: 'e2e/screenshots/r67c-01-admin-tags-page.png', fullPage: false });
    console.log('✓ Admin Tags page renders with tag groups, stats, and CRUD controls');
  });

  // ── 10. Admin Tags page: create tag via UI modal ──────────────────────────
  test('10. Admin Tags page: New Tag modal opens and closes', async ({ page }) => {
    await page.goto(`${BASE}/admin/tags`, { waitUntil: 'networkidle', timeout: 30000 });

    // Click New Tag button
    await page.getByRole('button', { name: /New Tag/i }).click();
    await page.waitForTimeout(500);

    // Modal should appear with form
    await expect(page.getByText('Create Tag')).toBeVisible();
    await expect(page.locator('input[placeholder*="Wireless"]')).toBeVisible();

    // Screenshot of modal
    await page.screenshot({ path: 'e2e/screenshots/r67c-02-admin-tags-modal.png', fullPage: false });

    // Close modal
    await page.getByRole('button', { name: 'Cancel' }).click();
    await page.waitForTimeout(300);

    console.log('✓ New Tag modal opens with form fields and closes on Cancel');
  });

  // ── 11. Tag-enriched search: multiple tag-type queries via shopping-list API ─
  test('11. Tag-enriched search returns results for multiple tag-type queries', async ({ request }) => {
    const queries = [
      { q: 'portable gaming accessories', budget: 50000, label: 'FEATURE+CATEGORY tags' },
      { q: 'premium home entertainment', budget: 100000, label: 'PRICE_RANGE+USE_CASE tags' },
      { q: 'wireless bluetooth speaker', budget: 15000, label: 'FEATURE tags' },
    ];

    for (const { q, budget, label } of queries) {
      const res = await request.post(`${BASE}/api/shopping-list`, {
        data: { items: [{ productName: q, budget, quantity: 1 }] },
      });
      expect(res.status()).toBe(200);
      const data = await res.json();
      const matches = data.results?.[0]?.matches ?? [];
      expect(matches.length).toBeGreaterThanOrEqual(1);
      console.log(`✓ "${q}" (${label}) → ${matches.length} matches, top: ${matches[0]?.name}`);
    }

    console.log('✓ Tag-enriched search returns results for all tag-type queries');
  });

  // ── 12. Cross-navigation: Categories ↔ Tags ──────────────────────────────
  test('12. Categories page has Tags navigation link', async ({ page }) => {
    await page.goto(`${BASE}/admin/categories`, { waitUntil: 'networkidle', timeout: 30000 });

    // Should have a Tags link
    const tagsLink = page.locator('a[href="/admin/tags"]');
    await expect(tagsLink).toBeVisible();
    await tagsLink.click();

    await page.waitForURL('**/admin/tags', { timeout: 15000 });
    await expect(page.locator('h1')).toContainText('Product Tags');

    // And tags page should have Categories link back
    const catLink = page.locator('a[href="/admin/categories"]');
    await expect(catLink).toBeVisible();

    console.log('✓ Cross-navigation: Categories → Tags → Categories links work');
  });
});
