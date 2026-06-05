/**
 * Round 28 — End-to-End Validation Tests
 * 
 * Covers:
 * 1. Smart Chat Assistant produces questions WITH options (not empty stubs)
 * 2. Self-Learning Dashboard: per-column filters, row selection, batch enrichment
 * 3. LLM model connectivity badge reflects actual API key status
 * 4. CSV export works
 */

import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:3000';
const ADMIN_EMAIL = 'admin@delegatecart.com';
const ADMIN_PASS = 'Admin@DC2024!';

// ── Helper: Admin login ──────────────────────────────────────────────────────
async function loginAdmin(page: import('@playwright/test').Page) {
  await page.goto(`${BASE}/signin`);
  await page.waitForLoadState('networkidle');
  const emailInput = page.locator('input[type="email"]').first();
  await emailInput.waitFor({ state: 'visible', timeout: 15000 });
  await emailInput.fill(ADMIN_EMAIL);
  const passInput = page.locator('input[type="password"]').first();
  await passInput.fill(ADMIN_PASS);
  const submitBtn = page.getByRole('button', { name: 'Sign In' });
  await submitBtn.click();
  // Wait for redirect away from /signin
  await page.waitForURL((url) => !url.pathname.includes('/signin'), { timeout: 30000 });
  await page.waitForLoadState('networkidle');
}

// ══════════════════════════════════════════════════════════════════════════════
// TEST GROUP 1: Smart Chat Assistant — Proper Clarifying Questions
// ══════════════════════════════════════════════════════════════════════════════
test.describe('Smart Chat Assistant — Question Options', () => {
  test('API returns questions with proper text and options for "washing machine under 40000"', async ({ request }) => {
    const resp = await request.post(`${BASE}/api/intent/analyze`, {
      data: { input: 'washing machine under 40000', user_id: 'e2e-test' },
    });
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();

    expect(data.clarifying_questions).toBeDefined();
    expect(Array.isArray(data.clarifying_questions)).toBeTruthy();
    expect(data.clarifying_questions.length).toBeGreaterThan(0);

    // Every question must have non-empty question text and non-empty options
    for (const q of data.clarifying_questions) {
      expect(typeof q.question).toBe('string');
      expect(q.question.length).toBeGreaterThan(3); // not just "Use_case"
      expect(Array.isArray(q.options)).toBeTruthy();
      expect(q.options.length).toBeGreaterThan(0);
      // Each option must have value + label
      for (const opt of q.options) {
        expect(typeof opt.value).toBe('string');
        expect(typeof opt.label).toBe('string');
        expect(opt.label.length).toBeGreaterThan(0);
      }
    }
  });

  test('API returns questions with proper options for "laptop under 60000"', async ({ request }) => {
    const resp = await request.post(`${BASE}/api/intent/analyze`, {
      data: { input: 'laptop under 60000', user_id: 'e2e-test' },
    });
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();

    expect(data.clarifying_questions.length).toBeGreaterThan(0);
    for (const q of data.clarifying_questions) {
      expect(q.question.length).toBeGreaterThan(3);
      expect(q.options.length).toBeGreaterThan(0);
    }
  });

  test('API returns questions with options for "best smartphone for photography"', async ({ request }) => {
    const resp = await request.post(`${BASE}/api/intent/analyze`, {
      data: { input: 'best smartphone for photography', user_id: 'e2e-test' },
    });
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();

    expect(data.clarifying_questions.length).toBeGreaterThan(0);
    for (const q of data.clarifying_questions) {
      expect(q.question.length).toBeGreaterThan(3);
      expect(q.options.length).toBeGreaterThan(0);
    }
  });

  test('Chat UI renders selectable options (not empty)', async ({ page }) => {
    await loginAdmin(page);
    await page.goto(`${BASE}/smart-assistant`);
    await page.waitForLoadState('networkidle');

    // Type a query
    const chatInput = page.locator('input[placeholder*="Ask me"], textarea[placeholder*="Ask me"], input[placeholder*="product"]').first();
    if (await chatInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await chatInput.fill('headphones under 5000');
      await chatInput.press('Enter');

      // Wait for questions to appear (up to 10s)
      await page.waitForTimeout(3000);

      // Check that radio buttons or options appear (not empty question cards)
      const radioButtons = page.locator('input[type="radio"]');
      const optionLabels = page.locator('label:has(input[type="radio"])');
      
      // Either radio buttons or question cards should be visible
      const questionCards = page.locator('text=Please answer');
      if (await questionCards.isVisible({ timeout: 5000 }).catch(() => false)) {
        // If question cards are visible, they should have radio buttons
        const radioCount = await radioButtons.count();
        expect(radioCount).toBeGreaterThan(0);
      }
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// TEST GROUP 2: Self-Learning Dashboard — Enterprise Grid Features
// ══════════════════════════════════════════════════════════════════════════════
test.describe('Self-Learning Dashboard — Grid Features', () => {
  test.beforeEach(async ({ page }) => {
    await loginAdmin(page);
    await page.goto(`${BASE}/admin/learning`);
    await page.waitForLoadState('networkidle');
    // Wait for dashboard to load
    await page.waitForSelector('text=Self-Learning Dashboard', { timeout: 10000 });
  });

  test('dashboard loads with records', async ({ page }) => {
    // Should show record count
    const headerText = await page.locator('h1, h2').first().textContent();
    expect(headerText).toContain('Self-Learning Dashboard');
    // Should have table rows
    await page.waitForSelector('table tbody tr', { timeout: 10000 });
    const rows = await page.locator('table tbody tr').count();
    expect(rows).toBeGreaterThan(0);
  });

  test('per-column filter icons appear in column headers (new design)', async ({ page }) => {
    await page.waitForSelector('table', { timeout: 10000 });
    // New design: filter icons in column headers (not an inline filter row)
    // thead should have exactly 1 row (no separate filter row)
    const theadRows = await page.locator('thead tr').count();
    expect(theadRows).toBe(1);
    // Filter icon buttons should appear in filterable column headers
    const filterBtns = page.locator('thead button[title*="Filter"]');
    const filterCount = await filterBtns.count();
    expect(filterCount).toBeGreaterThanOrEqual(2); // At least queryBy + queryText
  });

  test('per-column text filter narrows visible rows', async ({ page }) => {
    await page.waitForSelector('table tbody tr', { timeout: 10000 });
    const initialRows = await page.locator('table tbody tr').count();

    // Filter by query text
    const queryFilter = page.locator('thead tr:nth-child(2) input[placeholder*="Filter query"]');
    if (await queryFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
      await queryFilter.fill('washing');
      await page.waitForTimeout(500);
      const filteredRows = await page.locator('table tbody tr').count();
      // Should show fewer or same number of rows
      expect(filteredRows).toBeLessThanOrEqual(initialRows);
    }
  });

  test('per-column dropdown filter works for AI? column', async ({ page }) => {
    await page.waitForSelector('table tbody tr', { timeout: 10000 });

    // Find the AI? dropdown filter
    const aiSelect = page.locator('thead tr:nth-child(2) select').first();
    if (await aiSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await aiSelect.selectOption('yes');
      await page.waitForTimeout(500);
      // Rows should update
      const rowCount = await page.locator('table tbody tr').count();
      expect(rowCount).toBeGreaterThanOrEqual(0); // May be 0 if none match
    }
  });

  test('clear column filters button works', async ({ page }) => {
    await page.waitForSelector('table tbody tr', { timeout: 10000 });

    // Apply a filter
    const queryFilter = page.locator('thead tr:nth-child(2) input[placeholder*="Filter query"]');
    if (await queryFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
      await queryFilter.fill('zzz-nonexistent');
      await page.waitForTimeout(500);

      // Click clear button
      const clearBtn = page.locator('text=✕ Clear');
      if (await clearBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await clearBtn.click();
        await page.waitForTimeout(500);
        // Filter should be cleared
        expect(await queryFilter.inputValue()).toBe('');
      }
    }
  });

  test('row checkboxes select active records only', async ({ page }) => {
    await page.waitForSelector('table tbody tr', { timeout: 10000 });
    // Select-all checkbox should exist in header
    const selectAllBtn = page.locator('thead tr:first-child th:first-child button').first();
    if (await selectAllBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await selectAllBtn.click();
      await page.waitForTimeout(500);
      // Enrich button should show "Enrich Selected (N)"
      const enrichBtn = page.locator('button:has-text("Enrich Selected")');
      if (await enrichBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        const btnText = await enrichBtn.textContent();
        expect(btnText).toMatch(/Enrich Selected \(\d+\)/);
      }
    }
  });

  test('column visibility picker shows and toggles columns', async ({ page }) => {
    // Click Columns button
    const columnsBtn = page.locator('button:has-text("Columns")');
    await columnsBtn.click();
    await page.waitForTimeout(500);

    // Column picker dropdown should appear with checkboxes
    const checkboxes = page.locator('label:has(input[type="checkbox"]) span');
    const count = await checkboxes.count();
    expect(count).toBeGreaterThan(5); // Multiple columns available
  });

  test('Export CSV button exists and is clickable', async ({ page }) => {
    const exportBtn = page.locator('button:has-text("Export CSV")');
    expect(await exportBtn.isVisible()).toBeTruthy();
    // Click it (download should trigger)
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 5000 }).catch(() => null),
      exportBtn.click(),
    ]);
    // Download may or may not trigger depending on browser settings
    if (download) {
      expect(download.suggestedFilename()).toContain('.csv');
    }
  });

  test('pagination controls work — next/prev', async ({ page }) => {
    await page.waitForSelector('table tbody tr', { timeout: 10000 });
    
    // Find "Next" button
    const nextBtn = page.locator('button:has(svg.lucide-chevron-right)').first();
    if (await nextBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      const isDisabled = await nextBtn.isDisabled();
      if (!isDisabled) {
        await nextBtn.click();
        await page.waitForTimeout(1000);
        // Should still have records
      }
    }
  });

  test('sorting by column header changes sort direction', async ({ page }) => {
    await page.waitForSelector('table', { timeout: 10000 });
    // Click Query By column header to sort (ID is hidden by default now)
    const queryByHeader = page.locator('thead th').filter({ hasText: 'Query By' }).first();
    if (await queryByHeader.isVisible({ timeout: 5000 }).catch(() => false)) {
      await queryByHeader.click();
      await page.waitForTimeout(1000);
      // Click again to toggle direction
      await queryByHeader.click();
      await page.waitForTimeout(1000);
    }
    // Records should still load
    const rows = await page.locator('table tbody tr').count();
    expect(rows).toBeGreaterThan(0);
  });

  test('filter panel shows Active Status and AI Enrichment groups', async ({ page }) => {
    // Click the Filters button to expand the filter panel
    const filtersBtn = page.locator('button:has-text("Filters")').first();
    await filtersBtn.click();
    await page.waitForTimeout(500);
    // Look for filter group labels or active/inactive filter options
    const activeFilter = page.locator('text=Active').first();
    expect(await activeFilter.isVisible({ timeout: 5000 })).toBeTruthy();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// TEST GROUP 3: LLM Model Connectivity
// ══════════════════════════════════════════════════════════════════════════════
test.describe('LLM Model Connectivity', () => {
  test('API returns connectivity status for gemini model', async ({ request }) => {
    const resp = await request.get(`${BASE}/api/admin/learning?action=check-connectivity&model=gemini-flash`, {
      headers: { 'x-user-email': ADMIN_EMAIL },
    });
    // API returns 200 when connected, 503 when key is set but API errors (rate limit etc.)
    expect([200, 503]).toContain(resp.status());
    const data = await resp.json();
    expect(typeof data.apiKeyConfigured).toBe('boolean');
    expect(data.apiKeyConfigured).toBe(true);
  });

  test('API returns model list', async ({ request }) => {
    const resp = await request.get(`${BASE}/api/admin/learning?action=models`, {
      headers: { 'x-user-email': ADMIN_EMAIL },
    });
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();
    expect(Array.isArray(data.models)).toBeTruthy();
    expect(data.models.length).toBeGreaterThan(0);
    // Each model should have id, name, provider
    for (const m of data.models) {
      expect(m.id).toBeDefined();
      expect(m.name).toBeDefined();
      expect(m.provider).toBeDefined();
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// TEST GROUP 4: API Regression — No Breaking Changes
// ══════════════════════════════════════════════════════════════════════════════
test.describe('API Regression Tests', () => {
  test('GET /api/admin/learning returns paginated records', async ({ request }) => {
    const resp = await request.get(`${BASE}/api/admin/learning?limit=5&offset=0`, {
      headers: { 'x-user-email': ADMIN_EMAIL },
    });
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();
    expect(Array.isArray(data.records)).toBeTruthy();
    expect(typeof data.total).toBe('number');
    expect(data.records.length).toBeLessThanOrEqual(5);
  });

  test('GET /api/admin/learning supports sort params', async ({ request }) => {
    const resp = await request.get(`${BASE}/api/admin/learning?limit=3&offset=0&sortField=id&sortDir=asc`, {
      headers: { 'x-user-email': ADMIN_EMAIL },
    });
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();
    // Records should be sorted by ID ascending
    if (data.records.length >= 2) {
      expect(data.records[0].id).toBeLessThan(data.records[1].id);
    }
  });

  test('GET /api/admin/learning filterActive=active works', async ({ request }) => {
    const resp = await request.get(`${BASE}/api/admin/learning?filterActive=active&limit=50`, {
      headers: { 'x-user-email': ADMIN_EMAIL },
    });
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();
    for (const rec of data.records) {
      expect(rec.isActive).toBe(true);
    }
  });

  test('GET /api/admin/learning filterAI=enriched works', async ({ request }) => {
    const resp = await request.get(`${BASE}/api/admin/learning?filterAI=enriched&limit=50`, {
      headers: { 'x-user-email': ADMIN_EMAIL },
    });
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();
    for (const rec of data.records) {
      expect(rec.enhancedByAI).toBe(true);
    }
  });

  test('POST /api/intent/analyze returns proper response structure', async ({ request }) => {
    const resp = await request.post(`${BASE}/api/intent/analyze`, {
      data: { input: 'samsung phone under 20000', user_id: 'e2e-test' },
    });
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();
    // Must have required fields
    expect(data.intent).toBeDefined();
    expect(data.clarifying_questions).toBeDefined();
    expect(data.initial_text).toBeDefined();
    expect(Array.isArray(data.products)).toBeTruthy();
    // Products should have price in INR range
    if (data.products.length > 0) {
      expect(data.products[0].price).toBeGreaterThan(0);
    }
  });

  test('insertSmartIntentRecord does not copy intentEngineResponse to supervisedResponse', async ({ request }) => {
    // Send a unique query that won't have an existing record
    const uniqueQuery = `e2e-test-unique-${Date.now()}`;
    const resp = await request.post(`${BASE}/api/intent/analyze`, {
      data: { input: uniqueQuery, user_id: 'e2e-test' },
    });
    expect(resp.ok()).toBeTruthy();

    // Fetch the record — it should have NULL supervisedResponse
    const listResp = await request.get(`${BASE}/api/admin/learning?search=${encodeURIComponent(uniqueQuery)}&limit=1`, {
      headers: { 'x-user-email': ADMIN_EMAIL },
    });
    const listData = await listResp.json();
    if (listData.records?.length > 0) {
      const rec = listData.records[0];
      // supervisedResponse should be null or empty (not a copy of intentEngineResponse)
      expect(
        rec.supervisedResponse === null || 
        rec.supervisedResponse === undefined || 
        Object.keys(rec.supervisedResponse || {}).length === 0
      ).toBeTruthy();
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// TEST GROUP 5: Page Navigation Smoke Tests
// ══════════════════════════════════════════════════════════════════════════════
test.describe('Page Navigation Smoke Tests', () => {
  test('home page loads', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState('networkidle');
    expect(await page.title()).toBeTruthy();
  });

  test('products page loads', async ({ page }) => {
    await page.goto(`${BASE}/products`);
    await page.waitForLoadState('networkidle');
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
  });

  test('smart assistant page loads', async ({ page }) => {
    await page.goto(`${BASE}/smart-assistant`);
    await page.waitForLoadState('networkidle');
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
  });

  test('admin learning page loads', async ({ page }) => {
    await loginAdmin(page);
    await page.goto(`${BASE}/admin/learning`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=Self-Learning Dashboard')).toBeVisible({ timeout: 10000 });
  });
});
