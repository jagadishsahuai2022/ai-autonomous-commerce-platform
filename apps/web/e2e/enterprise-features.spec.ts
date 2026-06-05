import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:3000';

async function goto(page: Page, path: string) {
  await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
}

async function loginViaLocalStorage(page: Page, email = 'test@example.com') {
  await goto(page, '/');
  await page.evaluate(
    ({ email }) => {
      localStorage.setItem('authToken', `mock-jwt-test-${Date.now()}`);
      localStorage.setItem('userEmail', email);
    },
    { email }
  );
}

/** Wait for profile page skeleton to resolve (React Query retries take ~15s) */
async function waitForProfileForm(page: Page) {
  await page.locator('form').first().waitFor({ state: 'visible', timeout: 40000 });
}

// ═════════════════════════════════════════════════════════════════════════════
// Phase 1: Profile Page — New Fields & Sections
// ═════════════════════════════════════════════════════════════════════════════

test.describe('Profile Page — Redesigned Sections', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaLocalStorage(page);
    await goto(page, '/profile');
    await waitForProfileForm(page);
  });

  test('profile page loads with 200', async ({ page }) => {
    const res = await page.goto(`${BASE_URL}/profile`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    expect(res?.status()).toBeLessThan(400);
  });

  test('shows section cards for Personal Info', async ({ page }) => {
    const section = page.locator('text=Personal Information');
    await expect(section).toBeVisible({ timeout: 10000 });
  });

  test('shows Communication section', async ({ page }) => {
    const section = page.locator('text=Communication');
    await expect(section).toBeVisible({ timeout: 10000 });
  });

  test('shows Saved Addresses section', async ({ page }) => {
    const section = page.locator('text=Saved Addresses');
    await expect(section).toBeVisible({ timeout: 10000 });
  });

  test('shows AI & Subscription section', async ({ page }) => {
    const section = page.locator('text=AI & Subscription');
    await expect(section).toBeVisible({ timeout: 10000 });
  });

  test('displays displayName and aliasName fields', async ({ page }) => {
    const displayName = page.locator('input[placeholder="How others see you"]');
    const aliasName = page.locator('input[placeholder="Optional nickname"]');
    await expect(displayName).toBeVisible({ timeout: 10000 });
    await expect(aliasName).toBeVisible({ timeout: 10000 });
  });

  test('displays WhatsApp number field', async ({ page }) => {
    const whatsapp = page.locator('input[placeholder="+91 9876543210"]');
    await expect(whatsapp).toBeVisible({ timeout: 10000 });
  });

  test('displays subscription plan selector', async ({ page }) => {
    const basic = page.getByText('Basic', { exact: true });
    const aiPlus = page.getByText('AI Plus', { exact: true });
    await expect(basic).toBeVisible({ timeout: 10000 });
    await expect(aiPlus).toBeVisible({ timeout: 10000 });
  });

  test('displays AI model selector', async ({ page }) => {
    const modelSelect = page.locator('select').filter({ hasText: /GPT-4o Mini/i });
    await expect(modelSelect).toBeVisible({ timeout: 10000 });
  });

  test('Save All Changes button is visible', async ({ page }) => {
    const saveBtn = page.locator('button[type="submit"]').filter({ hasText: /Save All Changes/i });
    await expect(saveBtn).toBeVisible({ timeout: 10000 });
  });

  test('can fill displayName and aliasName', async ({ page }) => {
    const displayName = page.locator('input[placeholder="How others see you"]');
    await displayName.fill('TestDisplay');
    await expect(displayName).toHaveValue('TestDisplay');

    const aliasName = page.locator('input[placeholder="Optional nickname"]');
    await aliasName.fill('TestAlias');
    await expect(aliasName).toHaveValue('TestAlias');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Phase 2: Address Management (Profile)
// ═════════════════════════════════════════════════════════════════════════════

test.describe('Profile — Address Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaLocalStorage(page);
    await goto(page, '/profile');
    await waitForProfileForm(page);
  });

  test('shows Add address button', async ({ page }) => {
    const addBtn = page.locator('button').filter({ hasText: /Add address/i });
    await expect(addBtn).toBeVisible({ timeout: 10000 });
  });

  test('clicking Add address shows form', async ({ page }) => {
    const addBtn = page.locator('button').filter({ hasText: /Add address/i });
    await addBtn.click();
    await page.waitForTimeout(500);

    const nameInput = page.locator('input[placeholder="Full name *"]');
    await expect(nameInput).toBeVisible({ timeout: 5000 });
  });

  test('address form has all required fields', async ({ page }) => {
    const addBtn = page.locator('button').filter({ hasText: /Add address/i });
    await addBtn.click();
    await page.waitForTimeout(500);

    await expect(page.locator('input[placeholder="Full name *"]')).toBeVisible();
    await expect(page.locator('input[placeholder="Phone"]')).toBeVisible();
    await expect(page.locator('input[placeholder="Address line 1 *"]')).toBeVisible();
    await expect(page.locator('input[placeholder="City *"]')).toBeVisible();
    await expect(page.locator('input[placeholder="State *"]')).toBeVisible();
    await expect(page.locator('input[placeholder="Pincode *"]')).toBeVisible();
  });

  test('cancel hides the address form', async ({ page }) => {
    const addBtn = page.locator('button').filter({ hasText: /Add address/i });
    await addBtn.click();
    await page.waitForTimeout(500);

    const cancelBtn = page.locator('button').filter({ hasText: /Cancel/i });
    await cancelBtn.click();
    await page.waitForTimeout(500);

    const nameInput = page.locator('input[placeholder="Full name *"]');
    await expect(nameInput).not.toBeVisible({ timeout: 3000 });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Phase 3: New API Routes
// ═════════════════════════════════════════════════════════════════════════════

test.describe('New API Routes', () => {
  test('Address API GET returns 401 without auth', async ({ page }) => {
    const res = await page.request.get(`${BASE_URL}/api/user/addresses`);
    expect(res.status()).toBe(401);
  });

  test('Behavior API GET returns response', async ({ page }) => {
    const res = await page.request.get(`${BASE_URL}/api/user/behavior`);
    expect(res.status()).toBeLessThan(500);
  });

  test('Preferences API GET returns 401 without auth', async ({ page }) => {
    const res = await page.request.get(`${BASE_URL}/api/user/preferences`);
    expect(res.status()).toBe(401);
  });

  test('Analytics API GET returns 401 without auth', async ({ page }) => {
    const res = await page.request.get(`${BASE_URL}/api/analytics`);
    expect(res.status()).toBe(401);
  });

  test('Analytics API rejects unauthenticated requests', async ({ page }) => {
    const res = await page.request.get(`${BASE_URL}/api/analytics?days=7`);
    expect(res.status()).toBe(401);
    const data = await res.json();
    expect(data).toHaveProperty('error');
  });

  test('Behavior API POST responds', async ({ page }) => {
    const res = await page.request.post(`${BASE_URL}/api/user/behavior`, {
      data: { productId: 'test-product', action: 'view' },
    });
    expect(res.status()).toBeLessThan(500);
  });

  test('Analytics API POST requires auth', async ({ page }) => {
    const res = await page.request.post(`${BASE_URL}/api/analytics`, {
      data: { eventType: 'page_view', metadata: { page: 'test' } },
    });
    expect(res.status()).toBe(401);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Phase 4: AI Scoring in Shopping List
// ═════════════════════════════════════════════════════════════════════════════

test.describe('Shopping List — AI Scoring', () => {
  test('shopping list API returns AI scoring fields', async ({ page }) => {
    const res = await page.request.post(`${BASE_URL}/api/shopping-list`, {
      data: {
        items: [
          {
            productName: 'laptop',
            preferredBrand: null,
            budget: 80000,
            quantity: 1,
            deliveryDays: null,
            paymentMethod: null,
            emiOnly: false,
          },
        ],
      },
    });
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.results).toBeDefined();
    expect(data.results.length).toBeGreaterThan(0);

    const firstMatch = data.results[0].matches[0];
    // AI scoring fields should be present
    expect(firstMatch).toHaveProperty('aiScore');
    expect(firstMatch).toHaveProperty('aiExplanation');
    expect(firstMatch).toHaveProperty('aiConfidence');
    expect(firstMatch).toHaveProperty('scoreBreakdown');
    expect(firstMatch).toHaveProperty('source');
    expect(typeof firstMatch.aiScore).toBe('number');
    expect(firstMatch.aiScore).toBeGreaterThan(0);
    expect(firstMatch.aiScore).toBeLessThanOrEqual(100);
  });

  test('shopping list results include source field', async ({ page }) => {
    const res = await page.request.post(`${BASE_URL}/api/shopping-list`, {
      data: {
        items: [
          {
            productName: 'washing machine',
            preferredBrand: 'LG',
            budget: 30000,
            quantity: 1,
            deliveryDays: null,
            paymentMethod: null,
            emiOnly: false,
          },
        ],
      },
    });
    const data = await res.json();
    const match = data.results[0].matches[0];
    expect(['INTERNAL', 'EXTERNAL']).toContain(match.source);
  });

  test('shopping list results are sorted by AI score', async ({ page }) => {
    const res = await page.request.post(`${BASE_URL}/api/shopping-list`, {
      data: {
        items: [
          {
            productName: 'headphones',
            preferredBrand: null,
            budget: 25000,
            quantity: 1,
            deliveryDays: null,
            paymentMethod: null,
            emiOnly: false,
          },
        ],
      },
    });
    const data = await res.json();
    const matches = data.results[0].matches;
    for (let i = 1; i < matches.length; i++) {
      expect(matches[i - 1].aiScore).toBeGreaterThanOrEqual(matches[i].aiScore);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Phase 5: Cart — External Product Control
// ═════════════════════════════════════════════════════════════════════════════

test.describe('Cart — External Product Handling', () => {
  test('cart page loads with 200', async ({ page }) => {
    const res = await page.goto(`${BASE_URL}/cart`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    expect(res?.status()).toBeLessThan(400);
  });

  test('cart shows external badge on EXTERNAL items', async ({ page }) => {
    // Navigate first to set localStorage, then reload
    await goto(page, '/cart');
    await page.evaluate(() => {
      const cart = [
        {
          id: 'ext-1',
          productId: 'ext-product',
          name: 'External Widget',
          price: 5000,
          quantity: 1,
          stock: 99,
          url: 'https://example.com/widget',
          source: 'EXTERNAL',
        },
      ];
      localStorage.setItem('cart', JSON.stringify(cart));
    });
    // Reload to pick up localStorage
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // The badge renders as: <ExternalLink icon /> External
    const badge = page.locator('text=External').first();
    await expect(badge).toBeVisible({ timeout: 10000 });
  });

  test('cart shows warning for external items', async ({ page }) => {
    await goto(page, '/cart');
    await page.evaluate(() => {
      const cart = [
        {
          id: 'int-1',
          productId: 'int-p',
          name: 'Internal Laptop',
          price: 50000,
          quantity: 1,
          stock: 99,
          source: 'INTERNAL',
        },
        {
          id: 'ext-1',
          productId: 'ext-p',
          name: 'External Phone',
          price: 30000,
          quantity: 1,
          stock: 99,
          url: 'https://example.com',
          source: 'EXTERNAL',
        },
      ];
      localStorage.setItem('cart', JSON.stringify(cart));
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const warning = page.locator('text=External products cannot be checked out');
    await expect(warning).toBeVisible({ timeout: 10000 });
  });

  test('checkout button disabled when only external items', async ({ page }) => {
    await goto(page, '/cart');
    await page.evaluate(() => {
      const cart = [
        {
          id: 'ext-1',
          productId: 'ext-p',
          name: 'External Phone',
          price: 30000,
          quantity: 1,
          stock: 99,
          source: 'EXTERNAL',
        },
      ];
      localStorage.setItem('cart', JSON.stringify(cart));
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const checkoutBtn = page.locator('button').filter({ hasText: /No Checkable Items/i });
    await expect(checkoutBtn).toBeVisible({ timeout: 10000 });
    await expect(checkoutBtn).toBeDisabled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Phase 6: Checkout — Address API Integration
// ═════════════════════════════════════════════════════════════════════════════

test.describe('Checkout — Address Loading', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaLocalStorage(page);
    // Add an internal item to cart
    await page.evaluate(() => {
      const cart = [
        {
          id: 'test-1',
          productId: 'laptop-1',
          name: 'Test Laptop',
          price: 50000,
          quantity: 1,
          stock: 99,
          source: 'INTERNAL',
        },
      ];
      localStorage.setItem('cart', JSON.stringify(cart));
    });
  });

  test('checkout page loads with 200', async ({ page }) => {
    const res = await page.goto(`${BASE_URL}/checkout`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    expect(res?.status()).toBeLessThan(400);
  });

  test('checkout shows address section', async ({ page }) => {
    await goto(page, '/checkout');
    await page.waitForTimeout(2000);

    const addressHeader = page.locator('text=Delivery Address');
    await expect(addressHeader).toBeVisible({ timeout: 8000 });
  });

  test('checkout shows Add New Address button', async ({ page }) => {
    await goto(page, '/checkout');
    await page.waitForTimeout(2000);

    const addBtn = page.locator('button').filter({ hasText: /Add New Address/i });
    await expect(addBtn).toBeVisible({ timeout: 8000 });
  });

  test('checkout filters out external items', async ({ page }) => {
    await page.evaluate(() => {
      const cart = [
        {
          id: 'int-1',
          productId: 'laptop-1',
          name: 'Internal Laptop',
          price: 50000,
          quantity: 1,
          stock: 99,
          source: 'INTERNAL',
        },
        {
          id: 'ext-1',
          productId: 'ext-1',
          name: 'External Phone',
          price: 30000,
          quantity: 1,
          stock: 99,
          source: 'EXTERNAL',
        },
      ];
      localStorage.setItem('cart', JSON.stringify(cart));
    });
    await goto(page, '/checkout');
    await page.waitForTimeout(2000);

    // External item should NOT appear in checkout
    const external = page.locator('text=External Phone');
    await expect(external).not.toBeVisible({ timeout: 5000 });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Phase 7: Analytics Dashboard
// ═════════════════════════════════════════════════════════════════════════════

test.describe('Analytics Dashboard', () => {
  test('analytics page loads with 200', async ({ page }) => {
    const res = await page.goto(`${BASE_URL}/admin/analytics`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    expect(res?.status()).toBeLessThan(400);
  });

  test('shows Conversion Analytics heading', async ({ page }) => {
    await goto(page, '/admin/analytics');
    await page.waitForTimeout(3000);

    const heading = page.locator('text=Conversion Analytics');
    await expect(heading).toBeVisible({ timeout: 10000 });
  });

  test('shows metric cards', async ({ page }) => {
    await goto(page, '/admin/analytics');
    await page.waitForTimeout(3000);

    const totalEvents = page.locator('text=Total Events');
    const uniqueUsers = page.locator('text=Unique Users');
    const conversionRate = page.locator('text=Conversion Rate');
    const aiSuccess = page.locator('text=AI Success Rate');

    await expect(totalEvents).toBeVisible({ timeout: 10000 });
    await expect(uniqueUsers).toBeVisible({ timeout: 5000 });
    await expect(conversionRate).toBeVisible({ timeout: 5000 });
    await expect(aiSuccess).toBeVisible({ timeout: 5000 });
  });

  test('shows chart sections', async ({ page }) => {
    await goto(page, '/admin/analytics');
    await page.waitForTimeout(3000);

    const trend = page.locator('text=Daily Activity Trend');
    const aiOutcomes = page.locator('text=AI Recommendation Outcomes');
    const topProducts = page.locator('text=Top Products');

    await expect(trend).toBeVisible({ timeout: 10000 });
    await expect(aiOutcomes).toBeVisible({ timeout: 5000 });
    await expect(topProducts).toBeVisible({ timeout: 5000 });
  });

  test('has time range selector', async ({ page }) => {
    await goto(page, '/admin/analytics');
    await page.waitForTimeout(3000);

    const select = page.locator('select').filter({ hasText: /Last 30 days/i });
    await expect(select).toBeVisible({ timeout: 10000 });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Phase 8: Chat API — Behavior Tracking
// ═════════════════════════════════════════════════════════════════════════════

test.describe('Chat API — Enhanced', () => {
  test('chat API still responds to messages', async ({ page }) => {
    const res = await page.request.post(`${BASE_URL}/api/chat/message`, {
      data: { message: 'hello' },
    });
    expect(res.status()).toBe(200);
    const text = await res.text();
    expect(text.length).toBeGreaterThan(10);
  });

  test('chat API handles empty message', async ({ page }) => {
    const res = await page.request.post(`${BASE_URL}/api/chat/message`, {
      data: { message: '' },
    });
    expect(res.status()).toBe(400);
  });

  test('chat API responds to product queries', async ({ page }) => {
    const res = await page.request.post(`${BASE_URL}/api/chat/message`, {
      data: { message: 'find me a good laptop' },
    });
    expect(res.status()).toBe(200);
    const text = await res.text();
    expect(text).toContain('laptop');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Phase 9: Smart Delegate — AI Score Display
// ═════════════════════════════════════════════════════════════════════════════

test.describe('Smart Delegate Page', () => {
  test('smart delegate page loads with 200', async ({ page }) => {
    const res = await page.goto(`${BASE_URL}/smart-delegate`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    expect(res?.status()).toBeLessThan(400);
  });

  test('smart delegate shows AI score on results', async ({ page }) => {
    // Login first (smart-delegate requires auth), then set localStorage
    await loginViaLocalStorage(page);
    await page.evaluate(() => {
      const results = [
        {
          id: 'test-sub-1',
          submittedAt: new Date().toISOString(),
          results: [
            {
              productName: 'Test Laptop',
              preferredBrand: null,
              budget: 80000,
              quantity: 1,
              matches: [
                {
                  name: 'MacBook Air M3',
                  brand: 'Apple',
                  price: 114990,
                  rating: 4.8,
                  matchScore: 95,
                  estimatedDelivery: '3-5 days',
                  emiAvailable: true,
                  url: '#',
                  source: 'INTERNAL',
                  aiScore: 87,
                  aiExplanation: 'High relevance to Test Laptop. Highly rated. EMI available.',
                  aiConfidence: 92,
                  scoreBreakdown: {
                    relevance: 85,
                    preferenceMatch: 50,
                    priceFit: 40,
                    ratingScore: 96,
                    aiConfidence: 92,
                  },
                },
              ],
            },
          ],
          summary: { totalItems: 1, totalMatches: 1, estimatedSavings: '5000' },
        },
      ];
      localStorage.setItem('shoppingListResults', JSON.stringify(results));
    });
    await goto(page, '/smart-delegate');
    // Wait for the page to load and render submissions
    await page.waitForTimeout(3000);

    // Look for AI Score text in the match card
    const scoreText = page.locator('text=/AI Score.*87\/100/');
    await expect(scoreText).toBeVisible({ timeout: 15000 });
  });
});
