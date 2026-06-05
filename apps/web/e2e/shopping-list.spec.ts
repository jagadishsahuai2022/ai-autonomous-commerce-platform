/**
 * Shopping List & Profile — E2E Tests
 * Covers: Shopping List page, add/remove items, form validation,
 * list submission, profile WhatsApp config, auto-checkout settings.
 *
 * Run: npx playwright test e2e/shopping-list.spec.ts --project chromium
 */
import { test, expect, Page } from '@playwright/test';

const BASE = 'http://127.0.0.1:3000';

// ── Helper: sign in via localStorage ─────────────────────────────────────────
async function setAuth(page: Page) {
  await page.goto(BASE);
  await page.evaluate(() => {
    localStorage.setItem('authToken', 'e2e-test-token');
    localStorage.setItem('userEmail', 'e2e@test.com');
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// SHOPPING LIST PAGE TESTS
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Shopping List Page', () => {
  test.beforeEach(async ({ page }) => {
    await setAuth(page);
  });

  test('page loads with one empty item form', async ({ page }) => {
    await page.goto(`${BASE}/shopping-list`);
    await expect(page.getByRole('heading', { name: 'Shopping List' })).toBeVisible();
    // Should have one item form with "Item #1"
    await expect(page.locator('text=Item #1')).toBeVisible();
    // Product name input should be empty
    const productInput = page.locator('input[placeholder="e.g., Washing Machine"]');
    await expect(productInput).toBeVisible();
    await expect(productInput).toHaveValue('');
  });

  test('can fill in product details', async ({ page }) => {
    await page.goto(`${BASE}/shopping-list`);
    // Fill product name
    await page.locator('input[placeholder="e.g., Washing Machine"]').fill('Washing Machine');
    // Fill brand
    await page.locator('input[placeholder="e.g., Samsung"]').fill('Samsung');
    // Fill budget
    await page.locator('input[placeholder="e.g., 25000"]').fill('25000');
    // Fill quantity
    await page.locator('input[placeholder="1"]').fill('2');
    // Verify values
    await expect(page.locator('input[placeholder="e.g., Washing Machine"]')).toHaveValue(
      'Washing Machine'
    );
    await expect(page.locator('input[placeholder="e.g., Samsung"]')).toHaveValue('Samsung');
    await expect(page.locator('input[placeholder="e.g., 25000"]')).toHaveValue('25000');
  });

  test('product name rejects special characters', async ({ page }) => {
    await page.goto(`${BASE}/shopping-list`);
    const input = page.locator('input[placeholder="e.g., Washing Machine"]');
    await input.fill('Test<script>');
    // The input should strip special chars, so value won't have < or >
    const val = await input.inputValue();
    expect(val).not.toContain('<');
    expect(val).not.toContain('>');
  });

  test('budget field only accepts numeric input', async ({ page }) => {
    await page.goto(`${BASE}/shopping-list`);
    const budgetInput = page.locator('input[placeholder="e.g., 25000"]');
    await budgetInput.fill('abc123def');
    // Should strip non-numeric chars
    const val = await budgetInput.inputValue();
    expect(/^\d*$/.test(val)).toBe(true);
  });

  test('can add additional items', async ({ page }) => {
    await page.goto(`${BASE}/shopping-list`);
    // Click Add Another Item
    await page.locator('text=Add Another Item').click();
    // Should now show Item #2
    await expect(page.locator('text=Item #2')).toBeVisible();
    // Add a third
    await page.locator('text=Add Another Item').click();
    await expect(page.locator('text=Item #3')).toBeVisible();
  });

  test('can remove an item', async ({ page }) => {
    await page.goto(`${BASE}/shopping-list`);
    // Add a second item
    await page.locator('text=Add Another Item').click();
    await expect(page.locator('text=Item #2')).toBeVisible();
    // Remove the first item via trash button
    const trashButtons = page.locator('button[title="Remove item"]');
    await trashButtons.first().click();
    // Should only have 1 item now
    await expect(page.locator('text=Item #2')).not.toBeVisible();
  });

  test('cannot remove last item', async ({ page }) => {
    await page.goto(`${BASE}/shopping-list`);
    // Try to remove the only item
    const trashButton = page.locator('button[title="Remove item"]');
    await trashButton.click();
    // Should still have Item #1
    await expect(page.locator('text=Item #1')).toBeVisible();
  });

  test('shows validation error for empty product name on submit', async ({ page }) => {
    await page.goto(`${BASE}/shopping-list`);
    // Leave product name empty, click submit
    await page.locator('text=Submit List for AI Search').click();
    // Should show validation error
    await expect(page.locator('text=Product name is required')).toBeVisible();
  });

  test('shows validation error for empty quantity', async ({ page }) => {
    await page.goto(`${BASE}/shopping-list`);
    await page.locator('input[placeholder="e.g., Washing Machine"]').fill('Phone');
    // Clear quantity and type 0
    const qtyInput = page.locator('input[placeholder="1"]');
    await qtyInput.clear();
    await qtyInput.fill('0');
    await page.locator('text=Submit List for AI Search').click();
    await expect(page.locator('text=Quantity must be at least 1')).toBeVisible({ timeout: 10000 });
  });

  test('submits a valid shopping list and shows success', async ({ page }) => {
    await page.goto(`${BASE}/shopping-list`);
    // Fill in item
    await page.locator('input[placeholder="e.g., Washing Machine"]').fill('Washing Machine');
    await page.locator('input[placeholder="e.g., Samsung"]').fill('LG');
    await page.locator('input[placeholder="e.g., 25000"]').fill('20000');
    // Submit
    await page.locator('text=Submit List for AI Search').click();
    // Wait for success message
    await expect(page.locator('text=submitted successfully')).toBeVisible({ timeout: 10000 });
    // Take screenshot of success
    await page.screenshot({ path: 'e2e/screenshots/shopping-list-success.png', fullPage: true });
  });

  test('submits multi-item list successfully', async ({ page }) => {
    await page.goto(`${BASE}/shopping-list`);
    // Item 1 — fill product name (first product input)
    await page.locator('input[placeholder="e.g., Washing Machine"]').first().fill('Laptop');
    // Add item 2
    await page.locator('text=Add Another Item').click();
    // Item 2 — fill product name and quantity (second of each input)
    await page.locator('input[placeholder="e.g., Washing Machine"]').nth(1).fill('Headphone');
    await page.locator('input[placeholder="1"]').nth(1).fill('2');
    // Submit
    await page.locator('text=Submit List for AI Search').click();
    await expect(page.locator('text=submitted successfully')).toBeVisible({ timeout: 10000 });
  });

  test('payment method dropdown has expected options', async ({ page }) => {
    await page.goto(`${BASE}/shopping-list`);
    const select = page.locator('select').first();
    await expect(select).toBeVisible();
    const options = await select.locator('option').allTextContents();
    expect(options).toContain('Any');
    expect(options).toContain('UPI');
    expect(options).toContain('Credit Card');
    expect(options).toContain('EMI');
    expect(options).toContain('Cash on Delivery');
  });

  test('EMI checkbox is toggleable', async ({ page }) => {
    await page.goto(`${BASE}/shopping-list`);
    const checkbox = page.locator('input[type="checkbox"]').first();
    await expect(checkbox).not.toBeChecked();
    await checkbox.check();
    await expect(checkbox).toBeChecked();
    await checkbox.uncheck();
    await expect(checkbox).not.toBeChecked();
  });

  test('Shopping List nav link is visible', async ({ page }) => {
    await page.goto(BASE);
    const navLink = page.locator('a[href="/shopping-list"]');
    await expect(navLink).toBeVisible();
    await expect(navLink).toContainText('Shopping List');
  });

  test('how it works section is visible', async ({ page }) => {
    await page.goto(`${BASE}/shopping-list`);
    await expect(page.locator('text=How it works')).toBeVisible();
    await expect(page.locator('text=Add your desired products')).toBeVisible();
  });

  test('screenshot: full shopping list page', async ({ page }) => {
    await page.goto(`${BASE}/shopping-list`);
    await page.locator('input[placeholder="e.g., Washing Machine"]').fill('Refrigerator');
    await page.locator('input[placeholder="e.g., Samsung"]').fill('LG');
    await page.locator('input[placeholder="e.g., 25000"]').fill('30000');
    await page.locator('input[placeholder="e.g., 3"]').fill('5');
    await page.locator('text=Add Another Item').click();
    await page.locator('input[placeholder="e.g., Washing Machine"]').last().fill('Air Conditioner');
    await page.locator('input[placeholder="e.g., Samsung"]').last().fill('Daikin');
    await page.locator('input[placeholder="e.g., 25000"]').last().fill('45000');
    await page.screenshot({ path: 'e2e/screenshots/shopping-list-filled.png', fullPage: true });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// PROFILE PAGE — WHATSAPP & AUTO-CHECKOUT TESTS
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Profile Page - WhatsApp & Auto-Checkout', () => {
  test.beforeEach(async ({ page }) => {
    await setAuth(page);
  });

  test('profile page loads with WhatsApp section', async ({ page }) => {
    await page.goto(`${BASE}/profile`);
    await expect(page.locator('text=WhatsApp Integration')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('input[placeholder="+91 9876543210"]')).toBeVisible();
  });

  test('profile page loads with Auto-Checkout section', async ({ page }) => {
    await page.goto(`${BASE}/profile`);
    await expect(page.locator('text=Agentic Auto-Checkout')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=Enable auto-checkout by AI agent')).toBeVisible();
  });

  test('can enter WhatsApp number', async ({ page }) => {
    await page.goto(`${BASE}/profile`);
    const input = page.locator('input[placeholder="+91 9876543210"]');
    await input.waitFor({ state: 'visible', timeout: 15000 });
    await input.click();
    await input.fill('+919876543210');
    await page.waitForTimeout(300);
    await expect(input).toHaveValue('+919876543210', { timeout: 5000 });
  });

  test('auto-checkout checkbox toggles threshold input', async ({ page }) => {
    await page.goto(`${BASE}/profile`);
    const checkbox = page.locator('text=Enable auto-checkout by AI agent');
    // Before checking — threshold input should not be visible
    const thresholdLabel = page.locator('text=Auto-approve limit');
    // Click enable
    await checkbox.click();
    // Threshold field should appear
    await expect(thresholdLabel).toBeVisible({ timeout: 5000 });
  });

  test('auto-checkout threshold defaults to 10000', async ({ page }) => {
    await page.goto(`${BASE}/profile`);
    // Enable auto-checkout
    await page.locator('text=Enable auto-checkout by AI agent').click();
    // Check default value
    const thresholdInput = page.locator('input[type="number"]');
    await expect(thresholdInput).toBeVisible({ timeout: 5000 });
    const val = await thresholdInput.inputValue();
    expect(val).toBe('10000');
  });

  test('can change auto-checkout threshold', async ({ page }) => {
    await page.goto(`${BASE}/profile`);
    await page.locator('text=Enable auto-checkout by AI agent').click();
    const thresholdInput = page.locator('input[type="number"]');
    await thresholdInput.clear();
    await thresholdInput.fill('25000');
    await expect(thresholdInput).toHaveValue('25000');
  });

  test('save profile stores WhatsApp and auto-checkout settings', async ({ page }) => {
    await page.goto(`${BASE}/profile`);
    // Fill WhatsApp — wait for hydration
    const whatsInput = page.locator('input[placeholder="+91 9876543210"]');
    await whatsInput.waitFor({ state: 'visible', timeout: 15000 });
    await whatsInput.click();
    await whatsInput.fill('+919876543210');
    await page.waitForTimeout(300);
    // Enable auto-checkout
    await page.locator('text=Enable auto-checkout by AI agent').click();
    const thresholdInput = page.locator('input[type="number"]');
    await thresholdInput.clear();
    await thresholdInput.fill('15000');
    await page.waitForTimeout(300);
    // Save
    await page.locator('text=Save Changes').click();
    await page.waitForTimeout(500);
    // Verify localStorage was updated
    const whatsapp = await page.evaluate(() => localStorage.getItem('whatsappNumber'));
    const autoEnabled = await page.evaluate(() => localStorage.getItem('autoPurchaseEnabled'));
    const autoThreshold = await page.evaluate(() => localStorage.getItem('autoPurchaseThreshold'));
    expect(whatsapp).toBe('+919876543210');
    expect(autoEnabled).toBe('true');
    expect(autoThreshold).toBe('15000');
  });

  test('screenshot: profile page with WhatsApp and auto-checkout', async ({ page }) => {
    await page.goto(`${BASE}/profile`);
    await page.locator('input[placeholder="+91 9876543210"]').fill('+919876543210');
    await page.locator('text=Enable auto-checkout by AI agent').click();
    await page.screenshot({
      path: 'e2e/screenshots/profile-whatsapp-autocheckout.png',
      fullPage: true,
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SHOPPING LIST API TESTS
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Shopping List API', () => {
  test('POST returns matched products for valid list', async ({ request }) => {
    const res = await request.post(`${BASE}/api/shopping-list`, {
      data: {
        items: [
          {
            productName: 'Washing Machine',
            preferredBrand: 'LG',
            budget: 25000,
            quantity: 1,
            deliveryDays: 5,
            paymentMethod: 'upi',
            emiOnly: false,
          },
        ],
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.results).toHaveLength(1);
    expect(body.results[0].matches.length).toBeGreaterThan(0);
    expect(body.results[0].matches[0]).toHaveProperty('name');
    expect(body.results[0].matches[0]).toHaveProperty('price');
    expect(body.results[0].matches[0]).toHaveProperty('matchScore');
  });

  test('POST validates empty items', async ({ request }) => {
    const res = await request.post(`${BASE}/api/shopping-list`, {
      data: { items: [] },
    });
    expect(res.status()).toBe(400);
  });

  test('POST rejects items with special chars in product name', async ({ request }) => {
    const res = await request.post(`${BASE}/api/shopping-list`, {
      data: {
        items: [
          {
            productName: '<script>alert(1)</script>',
            preferredBrand: null,
            budget: null,
            quantity: 1,
            deliveryDays: null,
            paymentMethod: null,
            emiOnly: false,
          },
        ],
      },
    });
    expect(res.status()).toBe(400);
  });

  test('POST handles multi-item list', async ({ request }) => {
    const res = await request.post(`${BASE}/api/shopping-list`, {
      data: {
        items: [
          {
            productName: 'Laptop',
            preferredBrand: 'Dell',
            budget: 60000,
            quantity: 1,
            deliveryDays: null,
            paymentMethod: null,
            emiOnly: false,
          },
          {
            productName: 'Headphone',
            preferredBrand: 'Sony',
            budget: 15000,
            quantity: 2,
            deliveryDays: null,
            paymentMethod: null,
            emiOnly: false,
          },
          {
            productName: 'Refrigerator',
            preferredBrand: null,
            budget: null,
            quantity: 1,
            deliveryDays: 7,
            paymentMethod: 'emi',
            emiOnly: true,
          },
        ],
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.results).toHaveLength(3);
    expect(body.summary.totalItems).toBe(3);
  });

  test('POST prefers brand matches when specified', async ({ request }) => {
    const res = await request.post(`${BASE}/api/shopping-list`, {
      data: {
        items: [
          {
            productName: 'Washing Machine',
            preferredBrand: 'IFB',
            budget: null,
            quantity: 1,
            deliveryDays: null,
            paymentMethod: null,
            emiOnly: false,
          },
        ],
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    // IFB should be ranked high
    expect(body.results[0].matches[0].brand).toBe('IFB');
  });

  test('GET returns stored lists', async ({ request }) => {
    // First submit a list
    await request.post(`${BASE}/api/shopping-list`, {
      data: {
        items: [
          {
            productName: 'Phone',
            preferredBrand: null,
            budget: null,
            quantity: 1,
            deliveryDays: null,
            paymentMethod: null,
            emiOnly: false,
          },
        ],
      },
    });
    // Then GET
    const res = await request.get(`${BASE}/api/shopping-list`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.lists).toBeDefined();
    expect(body.lists.length).toBeGreaterThan(0);
  });
});
