import { test, expect, Page } from '@playwright/test';

/**
 * E2E Tests for Round 2 Fixes (Issues 1-9)
 * 1. Smart Delegate product links
 * 2. Cart/Checkout product images + links
 * 3. Profile page DB save + display
 * 4. Shopping list auto-checkout button
 * 5. Profile auto-checkout default + T&C
 * 6. AI Chat stationery suggestions
 * 7. VS Code Problems (compile verification)
 * 8. Extended test coverage
 * 9. AI model analysis (verified via API)
 */

test.describe.configure({ mode: 'serial' });

const BASE = 'http://127.0.0.1:3000';
const TEST_EMAIL = `r2_${Date.now()}@test.com`;
const TEST_PASSWORD = 'TestPass123!';
const TEST_NAME = 'Round Two Tester';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function registerUser(): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: TEST_NAME, email: TEST_EMAIL, password: TEST_PASSWORD }),
  });
  const data = await res.json();
  if (!data.token) throw new Error('Registration failed: ' + JSON.stringify(data));
  return data.token;
}

async function injectAuth(page: Page, token: string) {
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(([t, email]) => {
    localStorage.setItem('authToken', t);
    localStorage.setItem('userName', 'Round Two Tester');
    localStorage.setItem('userEmail', email);
  }, [token, TEST_EMAIL]);
}

let authToken = '';

test.beforeAll(async () => {
  authToken = await registerUser();
});

// ═════════════════════════════════════════════════════════════════════════════
// Issue #1: Smart Delegate Product Links
// ═════════════════════════════════════════════════════════════════════════════

test.describe('Issue #1 — Smart Delegate Product Links', () => {
  test('shopping list API returns real product URLs (not #)', async () => {
    const res = await fetch(`${BASE}/api/shopping-list`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        items: [
          { productName: 'pen', preferredBrand: null, budget: 200, quantity: 1, deliveryDays: null, paymentMethod: null, emiOnly: false },
        ],
        forceFresh: true,
      }),
    });
    expect(res.ok).toBeTruthy();
    const data = await res.json();
    const matches = data.results?.[0]?.matches || [];
    expect(matches.length).toBeGreaterThan(0);
    // All URLs should be real Google Shopping URLs, not '#'
    for (const match of matches) {
      expect(match.url).not.toBe('#');
      expect(match.url).toContain('google.com/search');
    }
  });

  test('smart delegate page displays product results with clickable links', async ({ page }) => {
    await injectAuth(page, authToken);
    // Submit a shopping list for pen first
    await page.evaluate(() => {
      const results = [{
        id: `test-${Date.now()}`,
        submittedAt: new Date().toISOString(),
        results: [{
          productName: 'pen',
          preferredBrand: null,
          budget: 200,
          quantity: 1,
          matches: [{
            name: 'Cello Butterflow Ball Pen',
            brand: 'Cello',
            price: 100,
            rating: 4.3,
            matchScore: 95,
            estimatedDelivery: '1-2 days',
            emiAvailable: false,
            url: 'https://www.google.com/search?tbm=shop&q=Cello+Butterflow+Ball+Pen+buy+online+India',
          }],
        }],
        summary: { totalItems: 1, totalMatches: 1, estimatedSavings: '₹50' },
      }];
      localStorage.setItem('shoppingListResults', JSON.stringify(results));
    });
    await page.goto(`${BASE}/smart-delegate`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);
    // Should have a clickable link with the product name
    const link = page.locator('a[target="_blank"]').filter({ hasText: 'Cello Butterflow' }).first();
    await expect(link).toBeVisible({ timeout: 30000 });
    const href = await link.getAttribute('href');
    expect(href).toContain('google.com/search');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Issue #2: Cart/Checkout Product Images + Links
// ═════════════════════════════════════════════════════════════════════════════

test.describe('Issue #2 — Cart Product Images & Links', () => {
  test('cart page shows product image placeholder and clickable name', async ({ page }) => {
    await injectAuth(page, authToken);
    // Add a test item to cart with URL
    await page.evaluate(() => {
      const cart = [{
        id: 'cart-test-1',
        productId: 'test-pen',
        name: 'Cello Butterflow Ball Pen',
        price: 100,
        quantity: 2,
        stock: 99,
        image: '',
        url: 'https://www.google.com/search?tbm=shop&q=Cello+Butterflow+Ball+Pen',
      }];
      localStorage.setItem('cart', JSON.stringify(cart));
    });
    await page.goto(`${BASE}/cart`, { waitUntil: 'domcontentloaded' });
    // Wait for cart to finish loading
    await page.waitForTimeout(5000);

    // Should show product image placeholder (📦 emoji)
    const placeholder = page.locator('text=📦').first();
    await expect(placeholder).toBeVisible({ timeout: 10000 });

    // Product name should be a clickable link
    const productLink = page.locator('a[target="_blank"]').filter({ hasText: 'Cello Butterflow' }).first();
    await expect(productLink).toBeVisible({ timeout: 10000 });
    const href = await productLink.getAttribute('href');
    expect(href).toContain('google.com');
  });

  test('checkout review step shows product thumbnails', async ({ page }) => {
    test.setTimeout(120000); // checkout multi-step needs extra time
    await injectAuth(page, authToken);
    // Setup cart + address + mock payment bypass for checkout
    await page.evaluate(() => {
      const cart = [{
        id: 'cart-test-1',
        productId: 'test-pen',
        name: 'Cello Butterflow Ball Pen',
        price: 100,
        quantity: 2,
        stock: 99,
        url: 'https://www.google.com/search?tbm=shop&q=Cello+Butterflow+Ball+Pen',
      }];
      localStorage.setItem('cart', JSON.stringify(cart));
      const addresses = [{
        id: 'addr-1',
        name: 'Test User',
        phone: '9876543210',
        line1: '123 MG Road',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        isDefault: true,
      }];
      localStorage.setItem('addresses', JSON.stringify(addresses));
      localStorage.setItem('mockPaymentBypass', 'true');
    });
    await page.goto(`${BASE}/checkout`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Navigate through steps to Review
    const continueBtn = page.locator('button:has-text("Continue")');
    // Step 0: Address - should auto-select
    await expect(continueBtn).toBeVisible({ timeout: 10000 });
    await continueBtn.click();
    await page.waitForTimeout(500);
    // Step 1: Shipping
    await expect(continueBtn).toBeVisible({ timeout: 5000 });
    await continueBtn.click();
    await page.waitForTimeout(500);
    // Step 2: Payment (mock bypass)
    await expect(continueBtn).toBeVisible({ timeout: 5000 });
    await continueBtn.click();
    await page.waitForTimeout(500);

    // Step 3: Review - should show product with placeholder
    await expect(page.locator('text=Review Your Order')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Cello Butterflow').first()).toBeVisible({ timeout: 5000 });
    // Should show emoji placeholder since no image 
    await expect(page.locator('text=📦').first()).toBeVisible({ timeout: 5000 });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Issue #3: Profile Page DB Save + Display
// ═════════════════════════════════════════════════════════════════════════════

test.describe('Issue #3 — Profile DB Save & Display', () => {
  test('profile API GET returns user data', async () => {
    const res = await fetch(`${BASE}/api/user/profile`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(res.ok).toBeTruthy();
    const data = await res.json();
    expect(data.email).toBeTruthy();
    expect(data.name).toBeTruthy();
    expect(data).toHaveProperty('autoPurchaseEnabled');
    expect(data).toHaveProperty('autoPurchaseThreshold');
  });

  test('profile API PUT saves auto-checkout settings to DB', async () => {
    const res = await fetch(`${BASE}/api/user/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        name: 'Round Two Updated',
        whatsappNumber: '+919876543210',
        autoPurchaseEnabled: true,
        autoPurchaseThreshold: 25000,
      }),
    });
    expect(res.ok).toBeTruthy();
    const data = await res.json();
    expect(data.autoCheckoutUpdated).toBe(true);

    // Verify by reading back
    const readRes = await fetch(`${BASE}/api/user/profile`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const readData = await readRes.json();
    expect(readData.name).toBe('Round Two Updated');
    expect(readData.autoPurchaseEnabled).toBe(true);
    expect(readData.autoPurchaseThreshold).toBe(25000);
  });

  test('profile page loads and displays user name and email', async ({ page }) => {
    test.setTimeout(90000);
    await injectAuth(page, authToken);
    await page.goto(`${BASE}/profile`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);

    // Should display First Name and Last Name fields
    const firstNameInput = page.locator('input[name="firstName"]');
    await expect(firstNameInput).toBeVisible({ timeout: 30000 });

    // Email should be disabled/read-only
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible({ timeout: 10000 });
    await expect(emailInput).toBeDisabled();
  });

  test('profile page has save button and auto-checkout section', async ({ page }) => {
    test.setTimeout(90000);
    await injectAuth(page, authToken);
    await page.goto(`${BASE}/profile`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);

    // Auto-checkout section should be visible
    await expect(page.locator('text=Agentic Auto-Checkout')).toBeVisible({ timeout: 30000 });
    // Save button
    await expect(page.locator('button:has-text("Save Changes")').first()).toBeVisible({ timeout: 10000 });
    // WhatsApp section
    await expect(page.locator('text=WhatsApp Integration')).toBeVisible({ timeout: 10000 });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Issue #4: Shopping List Auto-Checkout Button
// ═════════════════════════════════════════════════════════════════════════════

test.describe('Issue #4 — Shopping List Auto-Checkout Button', () => {
  test('shopping list shows AI Search button by default', async ({ page }) => {
    await injectAuth(page, authToken);
    // Clear auto-checkout setting
    await page.evaluate(() => {
      localStorage.setItem('autoPurchaseEnabled', 'false');
      localStorage.setItem('profileTermsAccepted', 'false');
    });
    await page.goto(`${BASE}/shopping-list`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    // The default submit button should show "Submit List for AI Search"
    await expect(page.locator('button:has-text("Submit List for AI Search")')).toBeVisible({ timeout: 10000 });
  });

  test('shopping list shows Auto-Checkout button when enabled + terms accepted', async ({ page }) => {
    await injectAuth(page, authToken);
    // Set auto-checkout as enabled with terms accepted
    await page.evaluate(() => {
      localStorage.setItem('autoPurchaseEnabled', 'true');
      localStorage.setItem('profileTermsAccepted', 'true');
    });
    await page.goto(`${BASE}/shopping-list`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);
    // Should show auto-checkout button instead
    await expect(page.getByRole('button', { name: '🚀 Auto-Checkout' })).toBeVisible({ timeout: 15000 });
  });

  test('shopping list auto-checkout checkbox and T&C link are present', async ({ page }) => {
    await injectAuth(page, authToken);
    await page.evaluate(() => {
      localStorage.removeItem('autoPurchaseEnabled');
      localStorage.removeItem('profileTermsAccepted');
    });
    await page.goto(`${BASE}/shopping-list`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    // Auto-checkout checkbox
    const autoCheckoutLabel = page.locator('label').filter({ hasText: 'Enable AI Auto-Checkout' });
    await expect(autoCheckoutLabel).toBeVisible({ timeout: 10000 });
    // Click the auto-checkout checkbox specifically (not EMI checkbox)
    const checkbox = autoCheckoutLabel.locator('input[type="checkbox"]');
    await checkbox.check();
    await page.waitForTimeout(2000);
    // Terms link should appear after enabling auto-checkout
    await expect(page.locator('text=Terms & Conditions for Auto-Checkout')).toBeVisible({ timeout: 10000 });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Issue #5: Profile Auto-Checkout Default + T&C  
// ═════════════════════════════════════════════════════════════════════════════

test.describe('Issue #5 — Profile Auto-Checkout & T&C Sync', () => {
  test('profile page has T&C modal for auto-checkout', async ({ page }) => {
    test.setTimeout(90000);
    await injectAuth(page, authToken);
    await page.goto(`${BASE}/profile`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);

    // Enable auto-checkout
    const autoCheckbox = page.locator('label').filter({ hasText: 'Enable auto-checkout by AI agent' }).locator('input[type="checkbox"]');
    await expect(autoCheckbox).toBeVisible({ timeout: 30000 });
    await autoCheckbox.check();
    await page.waitForTimeout(1000);

    // T&C link should appear
    const termsLink = page.locator('button:has-text("Terms & Conditions for Auto-Checkout")');
    await expect(termsLink).toBeVisible({ timeout: 5000 });

    // Click T&C link to open modal
    await termsLink.click();
    await page.waitForTimeout(1000);

    // Modal should appear with terms content
    await expect(page.locator('text=Auto-Checkout Terms')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=1. Overview')).toBeVisible();

    // Accept terms
    await page.locator('button:has-text("I Accept")').click();
    await page.waitForTimeout(500);
  });

  test('profile auto-checkout threshold field accepts values', async ({ page }) => {
    test.setTimeout(90000);
    await injectAuth(page, authToken);
    await page.goto(`${BASE}/profile`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);

    // Enable auto-checkout
    const autoCheckbox = page.locator('label').filter({ hasText: 'Enable auto-checkout by AI agent' }).locator('input[type="checkbox"]');
    await expect(autoCheckbox).toBeVisible({ timeout: 30000 });
    await autoCheckbox.check();
    await page.waitForTimeout(1000);

    // Threshold input should be visible
    const thresholdInput = page.locator('input[type="number"]');
    await expect(thresholdInput).toBeVisible({ timeout: 5000 });

    // Set new threshold
    await thresholdInput.fill('50000');
    const value = await thresholdInput.inputValue();
    expect(value).toBe('50000');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Issue #6: AI Chat Stationery Suggestions
// ═════════════════════════════════════════════════════════════════════════════

test.describe('Issue #6 — AI Chat Correct Suggestions', () => {
  test('chat API returns stationery products for "bal pen" query', async () => {
    const res = await fetch(`${BASE}/api/chat/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'I need a bal pen', userId: 'test-user' }),
    });
    expect(res.ok).toBeTruthy();
    const text = await res.text();
    // Should contain stationery products, not laptops or random items
    expect(text.toLowerCase()).toContain('cello');
    expect(text.toLowerCase()).toContain('pen');
  });

  test('chat API returns stationery products for "pen" query', async () => {
    const res = await fetch(`${BASE}/api/chat/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'recommend a good pen', userId: 'test-user' }),
    });
    expect(res.ok).toBeTruthy();
    const text = await res.text();
    expect(text.toLowerCase()).toContain('butterflow');
  });

  test('chat API returns stationery products for "notebook" query', async () => {
    const res = await fetch(`${BASE}/api/chat/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'I want to buy notebook', userId: 'test-user' }),
    });
    expect(res.ok).toBeTruthy();
    const text = await res.text();
    // Should contain Classmate notebook, not laptop notebooks
    expect(text.toLowerCase()).toContain('classmate');
  });

  test('intent analysis API detects stationery category for "pen"', async () => {
    const res = await fetch(`${BASE}/api/intent/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'I need a ball pen' }),
    });
    expect(res.ok).toBeTruthy();
    const data = await res.json();
    expect(data.intent.category).toBe('stationery');
  });

  test('chat API still returns laptop products for "laptop" query', async () => {
    const res = await fetch(`${BASE}/api/chat/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'I need a laptop', userId: 'test-user' }),
    });
    expect(res.ok).toBeTruthy();
    const text = await res.text();
    expect(text.toLowerCase()).toContain('macbook');
  });

  test('shopping list API returns pen products for stationery search', async () => {
    const res = await fetch(`${BASE}/api/shopping-list`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        items: [
          { productName: 'ball pen', preferredBrand: null, budget: 200, quantity: 1, deliveryDays: null, paymentMethod: null, emiOnly: false },
        ],
        forceFresh: true,
      }),
    });
    expect(res.ok).toBeTruthy();
    const data = await res.json();
    const matches = data.results?.[0]?.matches || [];
    expect(matches.length).toBeGreaterThan(0);
    // Should contain stationery products
    const hasStationery = matches.some((m: any) =>
      m.name.toLowerCase().includes('pen') || m.name.toLowerCase().includes('pencil')
    );
    expect(hasStationery).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Issue #9: AI Model Analysis — Verify No Real AI
// ═════════════════════════════════════════════════════════════════════════════

test.describe('Issue #9 — AI Model Verification', () => {
  test('chat API returns hardcoded responses (keyword-based)', async () => {
    // Test greeting
    const greetRes = await fetch(`${BASE}/api/chat/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'hello', userId: 'test' }),
    });
    expect(greetRes.ok).toBeTruthy();
    const greetText = await greetRes.text();
    expect(greetText).toContain('Welcome to DelegateCart');

    // Test help
    const helpRes = await fetch(`${BASE}/api/chat/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'help', userId: 'test' }),
    });
    expect(helpRes.ok).toBeTruthy();
    const helpText = await helpRes.text();
    expect(helpText).toContain('Product Search');

    // Test generic fallback
    const genericRes = await fetch(`${BASE}/api/chat/message`, {
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'quantum computer', userId: 'test' }),
    });
    expect(genericRes.ok).toBeTruthy();
    const genericText = await genericRes.text();
    expect(genericText).toContain('popular search');
  });

  test('intent analysis API uses rule-based category detection', async () => {
    // Phone category
    const phoneRes = await fetch(`${BASE}/api/intent/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'best smartphone under 30000' }),
    });
    const phoneData = await phoneRes.json();
    expect(phoneData.intent.category).toBe('phones');
    expect(phoneData.intent.confidence).toBeLessThanOrEqual(1);

    // Unknown category
    const unknownRes = await fetch(`${BASE}/api/intent/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'quantum computing device' }),
    });
    const unknownData = await unknownRes.json();
    expect(unknownData.intent.category).toBe('general');
    expect(unknownData.intent.confidence).toBeLessThan(0.8); // low confidence for unknown
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Additional Test Coverage — Pages, Navigation, Cart Flow
// ═════════════════════════════════════════════════════════════════════════════

test.describe('Extended Coverage — Pages & Flows', () => {
  test('smart-delegate page renders heading and empty state', async ({ page }) => {
    await injectAuth(page, authToken);
    await page.evaluate(() => localStorage.removeItem('shoppingListResults'));
    await page.goto(`${BASE}/smart-delegate`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    const heading = page.locator('h1:has-text("Smart Delegate")');
    await expect(heading).toBeVisible({ timeout: 10000 });
  });

  test('shopping list page renders with correct heading', async ({ page }) => {
    await injectAuth(page, authToken);
    await page.goto(`${BASE}/shopping-list`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    await expect(page.locator('h1:has-text("Shopping List")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Add Another Item')).toBeVisible();
  });

  test('shopping list form validates required fields', async ({ page }) => {
    await injectAuth(page, authToken);
    await page.evaluate(() => {
      localStorage.setItem('autoPurchaseEnabled', 'false');
      localStorage.setItem('profileTermsAccepted', 'false');
    });
    await page.goto(`${BASE}/shopping-list`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Try submitting without filling product name
    const submitBtn = page.locator('button:has-text("Submit List for AI Search")');
    await submitBtn.click();
    await page.waitForTimeout(1000);

    // Should show validation error
    await expect(page.locator('text=Product name is required')).toBeVisible({ timeout: 5000 });
  });

  test('cart page shows empty cart when no items', async ({ page }) => {
    await injectAuth(page, authToken);
    await page.evaluate(() => localStorage.removeItem('cart'));
    await page.goto(`${BASE}/cart`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await expect(page.locator('text=Your cart is empty')).toBeVisible({ timeout: 10000 });
  });

  test('cart quantity controls work correctly', async ({ page }) => {
    test.setTimeout(90000);
    await injectAuth(page, authToken);
    await page.evaluate(() => {
      const cart = [{
        id: 'cart-qty-test',
        productId: 'qty-test',
        name: 'Test Product for Quantity',
        price: 500,
        quantity: 1,
        stock: 10,
        image: '',
      }];
      localStorage.setItem('cart', JSON.stringify(cart));
    });
    await page.goto(`${BASE}/cart`, { waitUntil: 'domcontentloaded' });
    // Wait for cart to finish loading (Loading cart... should disappear)
    await expect(page.locator('text=Test Product for Quantity')).toBeVisible({ timeout: 30000 });

    // Find the + button and click to increase quantity
    const plusBtn = page.locator('button[title="Increase quantity"]');
    await expect(plusBtn).toBeVisible({ timeout: 10000 });
    await plusBtn.click();
    await page.waitForTimeout(1000);

    // Quantity should now be 2
    await expect(page.locator('text=2').first()).toBeVisible({ timeout: 5000 });
  });

  test('profile page T&C modal opens and closes', async ({ page }) => {
    test.setTimeout(90000);
    await injectAuth(page, authToken);
    await page.goto(`${BASE}/profile`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);

    // Enable auto-checkout to show T&C
    const autoCheckbox = page.locator('label').filter({ hasText: 'Enable auto-checkout by AI agent' }).locator('input[type="checkbox"]');
    await expect(autoCheckbox).toBeVisible({ timeout: 30000 });
    await autoCheckbox.check();
    await page.waitForTimeout(1000);

    // Open T&C modal
    await page.locator('button:has-text("Terms & Conditions for Auto-Checkout")').click();
    await page.waitForTimeout(1000);

    // Modal visible
    await expect(page.locator('text=Auto-Checkout Terms')).toBeVisible();

    // Close modal
    await page.locator('button:has-text("Close")').click();
    await page.waitForTimeout(500);

    // Modal should be gone
    await expect(page.locator('text=Auto-Checkout Terms')).not.toBeVisible({ timeout: 3000 });
  });

  test('shopping assistant page loads', async ({ page }) => {
    await injectAuth(page, authToken);
    await page.goto(`${BASE}/shopping-assistant`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    const body = await page.innerText('body');
    // Should have the shopping assistant or chat interface
    expect(body.length).toBeGreaterThan(100);
  });
});
