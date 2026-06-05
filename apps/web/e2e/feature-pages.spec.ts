import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:3000';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function goto(page: Page, path: string) {
  await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
}

async function loginAndSeed(
  page: Page,
  opts: {
    orders?: any[];
    cartFromAI?: boolean;
    whatsappNumber?: string;
    shoppingListResults?: any[];
  } = {}
) {
  await goto(page, '/');
  await page.evaluate(
    ({ opts }) => {
      localStorage.setItem('authToken', `mock-jwt-${Date.now()}`);
      localStorage.setItem('userEmail', 'demo@example.com');
      if (opts.orders) localStorage.setItem('orders', JSON.stringify(opts.orders));
      if (opts.cartFromAI) localStorage.setItem('cartFromAI', 'true');
      if (opts.whatsappNumber) localStorage.setItem('whatsappNumber', opts.whatsappNumber);
      if (opts.shoppingListResults)
        localStorage.setItem('shoppingListResults', JSON.stringify(opts.shoppingListResults));
    },
    { opts }
  );
}

const SAMPLE_ORDER_AI = {
  id: 'ORD-TEST-AI',
  items: [{ name: 'iPhone 15 Pro Max 5G', price: 134900, quantity: 1 }],
  total: 134900,
  status: 'confirmed',
  createdAt: new Date().toISOString(),
  aiAssisted: true,
};

const SAMPLE_ORDER_MANUAL = {
  id: 'ORD-TEST-MAN',
  items: [{ name: 'OnePlus 12 Pro', price: 64999, quantity: 1 }],
  total: 64999,
  status: 'confirmed',
  createdAt: new Date().toISOString(),
  aiAssisted: false,
};

const SAMPLE_SL_RESULT = {
  id: 'sl-test-001',
  submittedAt: new Date().toISOString(),
  results: [
    {
      productName: 'ac',
      preferredBrand: 'LG',
      budget: 50000,
      quantity: 1,
      matches: [
        {
          name: 'Daikin 1.5 Ton 5-Star Inverter',
          brand: 'Daikin',
          price: 42990,
          rating: 4.6,
          matchScore: 95,
          estimatedDelivery: '3-5 days',
          emiAvailable: true,
          url: '#',
        },
        {
          name: 'LG 1.5 Ton Dual Inverter',
          brand: 'LG',
          price: 45990,
          rating: 4.5,
          matchScore: 90,
          estimatedDelivery: '3-5 days',
          emiAvailable: true,
          url: '#',
        },
      ],
    },
    {
      productName: 'washing machine',
      preferredBrand: 'IFB',
      budget: 30000,
      quantity: 1,
      matches: [
        {
          name: 'IFB 6.5 Kg Front Load',
          brand: 'IFB',
          price: 24990,
          rating: 4.6,
          matchScore: 92,
          estimatedDelivery: '3-5 days',
          emiAvailable: true,
          url: '#',
        },
      ],
    },
  ],
  summary: { totalItems: 2, totalMatches: 3, estimatedSavings: '₹1,200' },
  whatsappSent: false,
  emailSent: false,
};

// ════════════════════════════════════════════════════════════════════════════
// SMART DELEGATE PAGE
// ════════════════════════════════════════════════════════════════════════════

test.describe('Smart Delegate Page', () => {
  test('redirects to signin when not logged in', async ({ page }) => {
    await goto(page, '/');
    await page.evaluate(() => {
      localStorage.removeItem('authToken');
      localStorage.removeItem('userEmail');
    });
    await goto(page, '/smart-delegate');
    await page.waitForURL('**/signin', { timeout: 10000 }).catch(() => {});
    expect(page.url()).toContain('/signin');
  });

  test('shows empty state with CTA when no results', async ({ page }) => {
    await loginAndSeed(page);
    await goto(page, '/smart-delegate');
    await page.waitForTimeout(1000);
    await expect(page.locator('h2').filter({ hasText: /no searches yet/i })).toBeVisible({
      timeout: 8000,
    });
    await expect(page.getByRole('link', { name: /create shopping list/i })).toBeVisible();
  });

  test('displays shopping list results from localStorage', async ({ page }) => {
    await loginAndSeed(page, { shoppingListResults: [SAMPLE_SL_RESULT] });
    await goto(page, '/smart-delegate');
    await page.waitForTimeout(1000);
    await expect(page.getByText(/2 items searched/i)).toBeVisible({ timeout: 8000 });
    await expect(page.getByText(/3 matches/i)).toBeVisible({ timeout: 5000 });
  });

  test('shows product matches (Daikin AC, IFB Washer)', async ({ page }) => {
    await loginAndSeed(page, { shoppingListResults: [SAMPLE_SL_RESULT] });
    await goto(page, '/smart-delegate');
    await page.waitForTimeout(1000);
    await expect(page.getByText('Daikin 1.5 Ton 5-Star Inverter')).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('IFB 6.5 Kg Front Load')).toBeVisible({ timeout: 5000 });
  });

  test('Add to Cart works on matched product', async ({ page }) => {
    await loginAndSeed(page, { shoppingListResults: [SAMPLE_SL_RESULT] });
    await goto(page, '/smart-delegate');
    await page.waitForTimeout(1000);
    const addBtn = page.getByRole('button', { name: /add to cart/i }).first();
    await expect(addBtn).toBeVisible({ timeout: 8000 });
    await addBtn.click();
    await expect(page.getByRole('button', { name: /remove from cart/i }).first()).toBeVisible({
      timeout: 3000,
    });
  });

  test('"New Search" link goes to /shopping-list', async ({ page }) => {
    await loginAndSeed(page, { shoppingListResults: [SAMPLE_SL_RESULT] });
    await goto(page, '/smart-delegate');
    await page.waitForTimeout(1000);
    const link = page.getByRole('link', { name: /new search/i });
    await expect(link).toHaveAttribute('href', '/shopping-list');
  });

  test('multiple submissions show correctly', async ({ page }) => {
    const result2 = { ...SAMPLE_SL_RESULT, id: 'sl-002', results: [SAMPLE_SL_RESULT.results[0]] };
    await loginAndSeed(page, { shoppingListResults: [SAMPLE_SL_RESULT, result2] });
    await goto(page, '/smart-delegate');
    await page.waitForTimeout(1000);
    const cards = page.getByText(/items? searched/i);
    await expect(cards.first()).toBeVisible({ timeout: 8000 });
    expect(await cards.count()).toBeGreaterThanOrEqual(2);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// AI BUDGET TRACKER PAGE
// ════════════════════════════════════════════════════════════════════════════

test.describe('AI Budget Tracker Page', () => {
  test('redirects to signin when not logged in', async ({ page }) => {
    await goto(page, '/');
    await page.evaluate(() => {
      localStorage.removeItem('authToken');
      localStorage.removeItem('userEmail');
    });
    await goto(page, '/budget-tracker');
    await page.waitForURL('**/signin', { timeout: 10000 }).catch(() => {});
    expect(page.url()).toContain('/signin');
  });

  test('loads with header title', async ({ page }) => {
    await loginAndSeed(page, { orders: [SAMPLE_ORDER_AI] });
    await goto(page, '/budget-tracker');
    await page.waitForTimeout(1000);
    await expect(page.locator('h1').filter({ hasText: /ai budget tracker/i })).toBeVisible({
      timeout: 8000,
    });
  });

  test('shows monthly budget progress bar', async ({ page }) => {
    await loginAndSeed(page);
    await goto(page, '/budget-tracker');
    await page.waitForTimeout(1000);
    await expect(page.getByText(/monthly budget/i)).toBeVisible({ timeout: 8000 });
  });

  test('allows editing and saving monthly budget', async ({ page }) => {
    await loginAndSeed(page);
    await goto(page, '/budget-tracker');
    await page.waitForTimeout(1000);
    await page.getByText('Edit Budget').click();
    await page.waitForTimeout(300);
    const input = page.locator('input[type="number"]');
    await input.fill('75000');
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(300);
    await expect(page.getByText('₹75,000').first()).toBeVisible({ timeout: 3000 });
    // Verify persisted to localStorage
    const saved = await page.evaluate(() => localStorage.getItem('monthlyBudget'));
    expect(saved).toBe('75000');
  });

  test('shows spending by category', async ({ page }) => {
    await loginAndSeed(page, { orders: [SAMPLE_ORDER_AI, SAMPLE_ORDER_MANUAL] });
    await goto(page, '/budget-tracker');
    await page.waitForTimeout(1000);
    await expect(page.getByText(/spending by category/i)).toBeVisible({ timeout: 8000 });
  });

  test('shows recent order in list', async ({ page }) => {
    await loginAndSeed(page, { orders: [SAMPLE_ORDER_AI] });
    await goto(page, '/budget-tracker');
    await page.waitForTimeout(1000);
    await expect(page.getByText('ORD-TEST-AI')).toBeVisible({ timeout: 8000 });
  });

  test('shows AI savings insights section', async ({ page }) => {
    await loginAndSeed(page);
    await goto(page, '/budget-tracker');
    await page.waitForTimeout(1000);
    await expect(page.getByText(/ai savings insights/i)).toBeVisible({ timeout: 8000 });
  });

  test('shows 4 stat tiles in header', async ({ page }) => {
    await loginAndSeed(page, { orders: [SAMPLE_ORDER_AI] });
    await goto(page, '/budget-tracker');
    await page.waitForTimeout(1000);
    await expect(page.getByText('This Month').first()).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('Total Spent').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Orders').first()).toBeVisible({ timeout: 5000 });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// PRICE DROP ALERTS PAGE
// ════════════════════════════════════════════════════════════════════════════

test.describe('Price Drop Alerts Page', () => {
  test('redirects to signin when not logged in', async ({ page }) => {
    await goto(page, '/');
    await page.evaluate(() => {
      localStorage.removeItem('authToken');
      localStorage.removeItem('userEmail');
    });
    await goto(page, '/price-alerts');
    await page.waitForURL('**/signin', { timeout: 10000 }).catch(() => {});
    expect(page.url()).toContain('/signin');
  });

  test('loads with default tracked items', async ({ page }) => {
    await loginAndSeed(page);
    await goto(page, '/price-alerts');
    await page.waitForTimeout(1000);
    await expect(page.locator('h1').filter({ hasText: /price drop alerts/i })).toBeVisible({
      timeout: 8000,
    });
    await expect(page.getByText('Apple iPhone 15 Pro')).toBeVisible({ timeout: 8000 });
  });

  test('shows discount badges on items', async ({ page }) => {
    await loginAndSeed(page);
    await goto(page, '/price-alerts');
    await page.waitForTimeout(1000);
    await expect(page.getByText(/% OFF/).first()).toBeVisible({ timeout: 8000 });
  });

  test('toggles alert on/off', async ({ page }) => {
    await loginAndSeed(page);
    await goto(page, '/price-alerts');
    await page.waitForTimeout(1000);
    const alertOnBtn = page.getByRole('button', { name: /alert on/i }).first();
    await expect(alertOnBtn).toBeVisible({ timeout: 8000 });
    await alertOnBtn.click();
    await expect(page.getByRole('button', { name: /alert off/i }).first()).toBeVisible({
      timeout: 3000,
    });
    // Toggle back
    await page
      .getByRole('button', { name: /alert off/i })
      .first()
      .click();
    await expect(page.getByRole('button', { name: /alert on/i }).first()).toBeVisible({
      timeout: 3000,
    });
  });

  test('add to cart from price alert', async ({ page }) => {
    await loginAndSeed(page);
    await goto(page, '/price-alerts');
    await page.waitForTimeout(1000);
    await page
      .getByRole('button', { name: /add to cart/i })
      .first()
      .click();
    const cartSize = await page.evaluate(
      () => JSON.parse(localStorage.getItem('cart') || '[]').length
    );
    expect(cartSize).toBeGreaterThan(0);
  });

  test('price trend chart shows "Dropping" for items whose price fell', async ({ page }) => {
    await loginAndSeed(page);
    await goto(page, '/price-alerts');
    await page.waitForTimeout(1000);
    await expect(page.getByText(/dropping/i).first()).toBeVisible({ timeout: 8000 });
  });

  test('shows header stats: Tracked, Alerts On, At Target', async ({ page }) => {
    await loginAndSeed(page);
    await goto(page, '/price-alerts');
    await page.waitForTimeout(1000);
    await expect(page.getByText('Tracked')).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('Alerts On')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('At Target')).toBeVisible({ timeout: 5000 });
  });

  test('shows all 7 default tracked products', async ({ page }) => {
    await loginAndSeed(page);
    await goto(page, '/price-alerts');
    await page.waitForTimeout(1000);
    const addBtns = page.getByRole('button', { name: /add to cart/i });
    await expect(addBtns.first()).toBeVisible({ timeout: 8000 });
    const count = await addBtns.count();
    expect(count).toBeGreaterThanOrEqual(7);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// PURCHASE PREDICTOR PAGE
// ════════════════════════════════════════════════════════════════════════════

test.describe('Purchase Predictor Page', () => {
  test('redirects to signin when not logged in', async ({ page }) => {
    await goto(page, '/');
    await page.evaluate(() => {
      localStorage.removeItem('authToken');
      localStorage.removeItem('userEmail');
    });
    await goto(page, '/purchase-predictor');
    await page.waitForURL('**/signin', { timeout: 10000 }).catch(() => {});
    expect(page.url()).toContain('/signin');
  });

  test('loads with predictions', async ({ page }) => {
    await loginAndSeed(page);
    await goto(page, '/purchase-predictor');
    await page.waitForTimeout(1000);
    await expect(page.locator('h1').filter({ hasText: /purchase predictor/i })).toBeVisible({
      timeout: 8000,
    });
    await expect(page.getByText('Apple AirPods Pro 2')).toBeVisible({ timeout: 8000 });
  });

  test('shows AI confidence bars', async ({ page }) => {
    await loginAndSeed(page);
    await goto(page, '/purchase-predictor');
    await page.waitForTimeout(1000);
    await expect(page.getByText('AI Confidence').first()).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('94%')).toBeVisible({ timeout: 5000 });
  });

  test('HIGH priority banner visible', async ({ page }) => {
    await loginAndSeed(page);
    await goto(page, '/purchase-predictor');
    await page.waitForTimeout(1000);
    await expect(page.getByText(/you'll likely need soon/i)).toBeVisible({ timeout: 8000 });
  });

  test('add prediction to cart marks button as "In Cart"', async ({ page }) => {
    await loginAndSeed(page);
    await goto(page, '/purchase-predictor');
    await page.waitForTimeout(1000);
    await page
      .getByRole('button', { name: /add to cart/i })
      .first()
      .click();
    await expect(page.getByRole('button', { name: /in cart/i }).first()).toBeVisible({
      timeout: 3000,
    });
  });

  test('save to wishlist marks button as "Saved"', async ({ page }) => {
    await loginAndSeed(page);
    await goto(page, '/purchase-predictor');
    await page.waitForTimeout(1000);
    await page
      .getByRole('button', { name: /^save$/i })
      .first()
      .click();
    await expect(page.getByRole('button', { name: /saved/i }).first()).toBeVisible({
      timeout: 3000,
    });
  });

  test('refresh re-generates predictions', async ({ page }) => {
    await loginAndSeed(page);
    await goto(page, '/purchase-predictor');
    await page.waitForTimeout(1000);
    await page
      .getByRole('button')
      .filter({ hasText: /refresh/i })
      .first()
      .click();
    await page.waitForTimeout(2000);
    await expect(page.getByText('Apple AirPods Pro 2')).toBeVisible({ timeout: 5000 });
  });

  test('shows 4 insight stats', async ({ page }) => {
    await loginAndSeed(page);
    await goto(page, '/purchase-predictor');
    await page.waitForTimeout(1000);
    await expect(page.getByText('Prediction Accuracy', { exact: true })).toBeVisible({
      timeout: 8000,
    });
    await expect(page.getByText('High Priority').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Potential Savings', { exact: true })).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText('Past Orders Analyzed', { exact: true })).toBeVisible({
      timeout: 5000,
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// ACCOUNT PAGE — AI FEATURE TILE LINKS
// ════════════════════════════════════════════════════════════════════════════

test.describe('Account Page — Feature Tiles Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndSeed(page, { orders: [SAMPLE_ORDER_AI, SAMPLE_ORDER_MANUAL] });
    await goto(page, '/account');
    await page.waitForTimeout(1500);
  });

  test('Smart Delegate tile links to /smart-delegate', async ({ page }) => {
    const t = page.getByRole('link', { name: /smart delegate/i });
    await expect(t).toBeVisible({ timeout: 8000 });
    await expect(t).toHaveAttribute('href', '/smart-delegate');
  });

  test('AI Budget Tracker tile links to /budget-tracker', async ({ page }) => {
    const t = page.getByRole('link', { name: /ai budget tracker/i });
    await expect(t).toBeVisible({ timeout: 8000 });
    await expect(t).toHaveAttribute('href', '/budget-tracker');
  });

  test('Price Drop Alerts tile links to /price-alerts', async ({ page }) => {
    const t = page.getByRole('link', { name: /price drop alerts/i });
    await expect(t).toBeVisible({ timeout: 8000 });
    await expect(t).toHaveAttribute('href', '/price-alerts');
  });

  test('Purchase Predictor tile links to /purchase-predictor', async ({ page }) => {
    const t = page.getByRole('link', { name: /purchase predictor/i });
    await expect(t).toBeVisible({ timeout: 8000 });
    await expect(t).toHaveAttribute('href', '/purchase-predictor');
  });

  test('navigates to /smart-delegate on click', async ({ page }) => {
    await page.getByRole('link', { name: /smart delegate/i }).click();
    await page.waitForURL('**/smart-delegate', { timeout: 10000 });
    await expect(page.locator('h1').filter({ hasText: /smart delegate/i })).toBeVisible({
      timeout: 8000,
    });
  });

  test('navigates to /budget-tracker on click', async ({ page }) => {
    await page.getByRole('link', { name: /ai budget tracker/i }).click();
    await page.waitForURL('**/budget-tracker', { timeout: 10000 });
    await expect(page.locator('h1').filter({ hasText: /ai budget tracker/i })).toBeVisible({
      timeout: 8000,
    });
  });

  test('navigates to /price-alerts on click', async ({ page }) => {
    await page.getByRole('link', { name: /price drop alerts/i }).click();
    await page.waitForURL('**/price-alerts', { timeout: 10000 });
    await expect(page.locator('h1').filter({ hasText: /price drop alerts/i })).toBeVisible({
      timeout: 8000,
    });
  });

  test('navigates to /purchase-predictor on click', async ({ page }) => {
    await page.getByRole('link', { name: /purchase predictor/i }).click();
    await page.waitForURL('**/purchase-predictor', { timeout: 10000 });
    await expect(page.locator('h1').filter({ hasText: /purchase predictor/i })).toBeVisible({
      timeout: 8000,
    });
  });

  test('shows AI-Assisted count from real orders', async ({ page }) => {
    // SAMPLE_ORDER_AI has aiAssisted: true so count should be ≥ 1
    const hero = page
      .locator('div')
      .filter({ has: page.getByText('AI-Assisted') })
      .first();
    await expect(hero).toBeVisible({ timeout: 8000 });
    // Look for a non-zero number next to AI-Assisted
    const statValue = page.locator('p.text-2xl').filter({ hasText: /^[1-9]/ });
    await expect(statValue.first()).toBeVisible({ timeout: 5000 });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// SHOPPING LIST — SUBMIT AND VERIFY PERSISTENCE
// ════════════════════════════════════════════════════════════════════════════

test.describe('Shopping List — Submit Flow', () => {
  test('submits list and shows "View results in Smart Delegate" link', async ({ page }) => {
    await loginAndSeed(page, { whatsappNumber: '+919876543210' });
    await goto(page, '/shopping-list');
    await page.waitForTimeout(1000);

    // Fill product name
    await page
      .locator('input[placeholder*="Washing Machine"], input[placeholder*="e.g., Washing"]')
      .first()
      .fill('ac');
    await page.locator('input[placeholder*="Samsung"]').first().fill('LG');
    await page.locator('input[placeholder*="25000"]').first().fill('50000');

    // Submit
    await page.getByRole('button', { name: /submit list for ai search/i }).click();
    await page.waitForTimeout(4000);

    // Should show success + smart delegate link
    await expect(page.getByText(/view results in smart delegate/i)).toBeVisible({ timeout: 8000 });
  });

  test('after submit, localStorage has results saved', async ({ page }) => {
    await loginAndSeed(page);
    await goto(page, '/shopping-list');
    await page.waitForTimeout(1000);

    await page
      .locator('input[placeholder*="Washing Machine"], input[placeholder*="e.g., Washing"]')
      .first()
      .fill('phone');

    await page.getByRole('button', { name: /submit list for ai search/i }).click();
    await page.waitForTimeout(4000);

    const hasResults = await page.evaluate(() => {
      const raw = localStorage.getItem('shoppingListResults');
      if (!raw) return false;
      const arr = JSON.parse(raw);
      return Array.isArray(arr) && arr.length > 0;
    });
    expect(hasResults).toBe(true);
  });

  test('submitted results appear in Smart Delegate page', async ({ page }) => {
    // Seed results manually
    await loginAndSeed(page, { shoppingListResults: [SAMPLE_SL_RESULT] });
    await goto(page, '/smart-delegate');
    await page.waitForTimeout(1000);
    await expect(page.getByText('Daikin 1.5 Ton 5-Star Inverter')).toBeVisible({ timeout: 8000 });
  });
});
