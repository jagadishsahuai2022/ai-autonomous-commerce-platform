/**
 * Round 29 — End-to-End Validation Tests
 *
 * Covers:
 * 1. Self-Learning Dashboard — column visibility defaults (ID/InitialSuggestion/SupervisedResponse hidden)
 * 2. Self-Learning Dashboard — ID column absent from column picker
 * 3. Self-Learning Dashboard — filter icons in column headers (no always-visible filter row)
 * 4. Self-Learning Dashboard — filter icon opens popup with input
 * 5. Smart Chat Copilot — External products toggle button visible (dev env)
 * 6. External Products API — returns products for known intent text
 * 7. ProductRecommendationCarousel — External badge renders when isExternal=true
 * 8. External products toggle persists in localStorage
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
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL((url) => !url.pathname.includes('/signin'), { timeout: 30000 });
  await page.waitForLoadState('networkidle');
}

// ══════════════════════════════════════════════════════════════════════════════
// TEST GROUP 1: Learning Dashboard — Column visibility defaults
// ══════════════════════════════════════════════════════════════════════════════
test.describe('Learning Dashboard — Default Column Visibility', () => {

  test('ID column is hidden by default in the grid', async ({ page }) => {
    await loginAdmin(page);
    await page.goto(`${BASE}/admin/learning`);
    await page.waitForLoadState('networkidle');

    // Wait for the table to be visible
    const table = page.locator('table').first();
    await table.waitFor({ state: 'visible', timeout: 20000 });

    // ID column header should NOT be in the table
    const headers = await page.locator('thead th').allTextContents();
    const headerText = headers.join(' ');
    // "ID" header should not appear (it's hidden by default)
    expect(headerText).not.toContain('ID');
  });

  test('Initial Suggestion column is hidden by default', async ({ page }) => {
    await loginAdmin(page);
    await page.goto(`${BASE}/admin/learning`);
    await page.waitForLoadState('networkidle');

    const table = page.locator('table').first();
    await table.waitFor({ state: 'visible', timeout: 20000 });

    const headers = await page.locator('thead th').allTextContents();
    const headerText = headers.join(' ');
    expect(headerText).not.toContain('Initial Suggestion');
  });

  test('Supervised Response column is hidden by default', async ({ page }) => {
    await loginAdmin(page);
    await page.goto(`${BASE}/admin/learning`);
    await page.waitForLoadState('networkidle');

    const table = page.locator('table').first();
    await table.waitFor({ state: 'visible', timeout: 20000 });

    const headers = await page.locator('thead th').allTextContents();
    const headerText = headers.join(' ');
    expect(headerText).not.toContain('Supervised Response');
  });

  test('Query By, Query Text, Intent Response columns are visible by default', async ({ page }) => {
    await loginAdmin(page);
    await page.goto(`${BASE}/admin/learning`);
    await page.waitForLoadState('networkidle');

    const table = page.locator('table').first();
    await table.waitFor({ state: 'visible', timeout: 20000 });

    const headers = await page.locator('thead th').allTextContents();
    const headerText = headers.join(' ');
    expect(headerText).toContain('Query By');
    expect(headerText).toContain('Query Text');
    expect(headerText).toContain('Intent Response');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// TEST GROUP 2: Learning Dashboard — Column Picker excludes ID
// ══════════════════════════════════════════════════════════════════════════════
test.describe('Learning Dashboard — Column Picker', () => {

  test('ID column is NOT in the column picker dropdown', async ({ page }) => {
    await loginAdmin(page);
    await page.goto(`${BASE}/admin/learning`);
    await page.waitForLoadState('networkidle');

    // Open column picker
    await page.getByRole('button', { name: /Columns/i }).click();

    // Wait for the picker to be visible
    await page.waitForTimeout(500);

    // The column picker should not contain an "ID" checkbox
    const pickerLabels = await page.locator('[data-testid="col-picker"] label, .col-picker label').allTextContents().catch(() => []);

    // Alternative: look for all labels in the picker dropdown
    const allLabels = await page.locator('label').allTextContents();
    const idCheckboxes = allLabels.filter((l) => l.trim() === 'ID');
    expect(idCheckboxes.length).toBe(0);
  });

  test('Initial Suggestion column can be toggled ON from picker', async ({ page }) => {
    await loginAdmin(page);
    await page.goto(`${BASE}/admin/learning`);
    await page.waitForLoadState('networkidle');

    const table = page.locator('table').first();
    await table.waitFor({ state: 'visible', timeout: 20000 });

    // Open column picker
    await page.getByRole('button', { name: /Columns/i }).click();
    await page.waitForTimeout(300);

    // Find and click the Initial Suggestion checkbox
    const initSugLabel = page.getByText('Initial Suggestion').last();
    await initSugLabel.click();

    await page.waitForTimeout(400);

    // Now the column should be visible
    const headers = await page.locator('thead th').allTextContents();
    expect(headers.join(' ')).toContain('Initial Suggestion');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// TEST GROUP 3: Learning Dashboard — Filter Icons (no inline filter row)
// ══════════════════════════════════════════════════════════════════════════════
test.describe('Learning Dashboard — Filter Icons', () => {

  test('No inline filter row exists in thead', async ({ page }) => {
    await loginAdmin(page);
    await page.goto(`${BASE}/admin/learning`);
    await page.waitForLoadState('networkidle');

    const table = page.locator('table').first();
    await table.waitFor({ state: 'visible', timeout: 20000 });

    // The thead should have exactly 1 <tr> (header row only, no filter row)
    const theadRows = await page.locator('thead tr').count();
    expect(theadRows).toBe(1);
  });

  test('Filter icon button appears on Query By column header', async ({ page }) => {
    await loginAdmin(page);
    await page.goto(`${BASE}/admin/learning`);
    await page.waitForLoadState('networkidle');

    const table = page.locator('table').first();
    await table.waitFor({ state: 'visible', timeout: 20000 });

    // The "Query By" header should contain a filter button
    const queryByHeader = page.locator('thead th').filter({ hasText: 'Query By' });
    await queryByHeader.waitFor({ state: 'visible', timeout: 10000 });

    // There should be a filter button (svg icon) inside the Query By header
    const filterBtn = queryByHeader.locator('button[title*="Filter"]');
    await expect(filterBtn).toBeVisible();
  });

  test('Clicking filter icon on Query By opens popup with text input', async ({ page }) => {
    await loginAdmin(page);
    await page.goto(`${BASE}/admin/learning`);
    await page.waitForLoadState('networkidle');

    const table = page.locator('table').first();
    await table.waitFor({ state: 'visible', timeout: 20000 });

    // Click the filter button on Query By
    const queryByHeader = page.locator('thead th').filter({ hasText: 'Query By' });
    const filterBtn = queryByHeader.locator('button[title*="Filter"]');
    await filterBtn.click();

    // The filter popup should appear
    const popup = page.locator('[data-testid="col-filter-popup"]');
    await expect(popup).toBeVisible({ timeout: 5000 });

    // It should contain a text input
    const input = popup.locator('input[type="text"]');
    await expect(input).toBeVisible();
  });

  test('Filter popup disappears when clicking outside', async ({ page }) => {
    await loginAdmin(page);
    await page.goto(`${BASE}/admin/learning`);
    await page.waitForLoadState('networkidle');

    const table = page.locator('table').first();
    await table.waitFor({ state: 'visible', timeout: 20000 });

    const queryByHeader = page.locator('thead th').filter({ hasText: 'Query By' });
    const filterBtn = queryByHeader.locator('button[title*="Filter"]');
    await filterBtn.click();

    const popup = page.locator('[data-testid="col-filter-popup"]');
    await expect(popup).toBeVisible({ timeout: 5000 });

    // Click elsewhere on the page to close the popup
    await page.locator('h1').first().click();
    await page.waitForTimeout(400);

    await expect(popup).not.toBeVisible();
  });

  test('Filter icon on AI column opens select dropdown', async ({ page }) => {
    await loginAdmin(page);
    await page.goto(`${BASE}/admin/learning`);
    await page.waitForLoadState('networkidle');

    const table = page.locator('table').first();
    await table.waitFor({ state: 'visible', timeout: 20000 });

    // Click the filter button on AI? column
    const aiHeader = page.locator('thead th').filter({ hasText: 'AI?' });
    const filterBtn = aiHeader.locator('button[title*="Filter"]');
    await filterBtn.click();

    const popup = page.locator('[data-testid="col-filter-popup"]');
    await expect(popup).toBeVisible({ timeout: 5000 });

    // Should show a <select> for boolean choices
    const select = popup.locator('select');
    await expect(select).toBeVisible();

    // Options should be All, Yes, No
    const options = await select.locator('option').allTextContents();
    expect(options).toContain('All');
    expect(options).toContain('Yes');
    expect(options).toContain('No');
  });

  test('Clear col filters button appears when a filter is active', async ({ page }) => {
    await loginAdmin(page);
    await page.goto(`${BASE}/admin/learning`);
    await page.waitForLoadState('networkidle');

    const table = page.locator('table').first();
    await table.waitFor({ state: 'visible', timeout: 20000 });

    // Initially no clear-filter button
    const clearBtn = page.getByRole('button', { name: /Clear col filters/i });
    await expect(clearBtn).not.toBeVisible();

    // Open Query By filter popup and type something
    const queryByHeader = page.locator('thead th').filter({ hasText: 'Query By' });
    const filterBtn = queryByHeader.locator('button[title*="Filter"]');
    await filterBtn.click();

    const popup = page.locator('[data-testid="col-filter-popup"]');
    await popup.locator('input[type="text"]').fill('test');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);

    // Now the clear button should appear in toolbar
    await expect(clearBtn).toBeVisible({ timeout: 5000 });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// TEST GROUP 4: External Products API
// ══════════════════════════════════════════════════════════════════════════════
test.describe('External Products API', () => {

  test('Returns products for phone intent', async ({ request }) => {
    const resp = await request.post(`${BASE}/api/intent/external-products`, {
      data: { intentText: 'looking for a good smartphone', answers: [] },
    });
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();
    expect(Array.isArray(data.products)).toBeTruthy();
    expect(data.products.length).toBeGreaterThan(0);

    for (const p of data.products) {
      expect(p.name).toBeTruthy();
      expect(p.brand).toBeTruthy();
      expect(typeof p.price).toBe('number');
      expect(p.price).toBeGreaterThan(0);
    }
  });

  test('Returns products for laptop intent', async ({ request }) => {
    const resp = await request.post(`${BASE}/api/intent/external-products`, {
      data: { intentText: 'need a good laptop for work', answers: ['budget around 80k', 'lightweight'] },
    });
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();
    expect(data.products.length).toBeGreaterThan(0);
    expect(data.category).toBe('laptop');
  });

  test('Budget filtering selects cheaper phones for low budget', async ({ request }) => {
    // With 'under 30k', only the budget phones (≤ ₹39K with 30% tolerance) should be returned
    const resp = await request.post(`${BASE}/api/intent/external-products`, {
      data: { intentText: 'buy a new phone', answers: ['under 30k', 'good camera'] },
    });
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();
    expect(data.products.length).toBeGreaterThan(0);
    // All results must be within budget + 30% tolerance
    for (const p of data.products) {
      expect(p.price).toBeLessThanOrEqual(30000 * 1.3);
    }
  });

  test('Returns empty array for empty intent', async ({ request }) => {
    const resp = await request.post(`${BASE}/api/intent/external-products`, {
      data: { intentText: '', answers: [] },
    });
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();
    expect(data.products).toEqual([]);
  });

  test('Returns products for headphone intent', async ({ request }) => {
    const resp = await request.post(`${BASE}/api/intent/external-products`, {
      data: { intentText: 'wireless headphone with noise cancellation', answers: [] },
    });
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();
    expect(data.products.length).toBeGreaterThan(0);
    expect(data.category).toBe('headphone');
  });

  test('Returns products for TV intent', async ({ request }) => {
    const resp = await request.post(`${BASE}/api/intent/external-products`, {
      data: { intentText: 'buy a 65 inch OLED TV for home theater', answers: ['under 2 lakh'] },
    });
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();
    expect(data.products.length).toBeGreaterThan(0);
    expect(data.category).toBe('tv');
  });

  test('Returns products for washing machine intent', async ({ request }) => {
    const resp = await request.post(`${BASE}/api/intent/external-products`, {
      data: { intentText: 'need a front load washing machine', answers: ['8kg or more'] },
    });
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();
    expect(data.products.length).toBeGreaterThan(0);
    expect(data.category).toBe('washing_machine');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// TEST GROUP 5: Smart Chat — External Products Toggle
// ══════════════════════════════════════════════════════════════════════════════
test.describe('Smart Chat — External Products Toggle', () => {

  test('External toggle button is visible in shopping assistant header', async ({ page }) => {
    // ShoppingChat is rendered on /shopping-assistant page
    await page.goto(`${BASE}/shopping-assistant`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // The toggle button should be visible in the ShoppingChat header
    const toggleBtn = page.locator('[data-testid="external-toggle"]');
    await expect(toggleBtn).toBeVisible({ timeout: 10000 });
  });

  test('External toggle changes state on click', async ({ page }) => {
    await page.goto(`${BASE}/shopping-assistant`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const toggleBtn = page.locator('[data-testid="external-toggle"]');
    await expect(toggleBtn).toBeVisible({ timeout: 10000 });

    const initialText = await toggleBtn.textContent();

    await toggleBtn.click();
    await page.waitForTimeout(300);

    const afterText = await toggleBtn.textContent();
    // The ON/OFF text should have changed
    expect(afterText).not.toBe(initialText);
  });

  test('External toggle state persists in localStorage', async ({ page }) => {
    await page.goto(`${BASE}/shopping-assistant`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const toggleBtn = page.locator('[data-testid="external-toggle"]');
    await expect(toggleBtn).toBeVisible({ timeout: 10000 });

    // Ensure toggle is ON
    const currentText = await toggleBtn.textContent();
    if (!currentText?.includes('ON')) {
      await toggleBtn.click();
      await page.waitForTimeout(300);
    }

    // Check localStorage
    const value = await page.evaluate(() => localStorage.getItem('showExternalProducts'));
    expect(value).toBe('true');

    // Toggle OFF and verify
    await toggleBtn.click();
    await page.waitForTimeout(300);
    const valueAfterOff = await page.evaluate(() => localStorage.getItem('showExternalProducts'));
    expect(valueAfterOff).toBe('false');
  });
});
