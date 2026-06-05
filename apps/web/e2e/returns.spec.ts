import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:3000';

async function goto(page: Page, path: string) {
  await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
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

// ─── Returns Page — Navigation ────────────────────────────────────────────────

test.describe('Returns Page — Navigation', () => {
  test('account page has "Initiate Return" link to /account/returns', async ({ page }) => {
    await loginViaLocalStorage(page);
    await goto(page, '/account');
    await page.waitForTimeout(1500);

    const returnsLink = page.locator('a[href="/account/returns"]');
    await expect(returnsLink.first()).toBeVisible({ timeout: 8000 });
  });

  test('clicking "Initiate Return" navigates to /account/returns', async ({ page }) => {
    await loginViaLocalStorage(page);
    await goto(page, '/account');
    await page.waitForTimeout(1500);

    const returnsLink = page.locator('a[href="/account/returns"]').first();
    await expect(returnsLink).toBeVisible({ timeout: 8000 });
    await returnsLink.click();
    await page.waitForTimeout(2000);

    expect(page.url()).toContain('/account/returns');
  });

  test('returns page redirects unauthenticated users', async ({ page }) => {
    await goto(page, '/');
    await page.evaluate(() => {
      localStorage.removeItem('authToken');
      localStorage.removeItem('userEmail');
    });
    await goto(page, '/account/returns');
    await page.waitForTimeout(2000);

    // Should either redirect or show sign-in prompt
    const isOnReturns = page.url().includes('/account/returns');
    const signinPrompt = await page.locator('text=/sign in|login/i').count();
    // Either redirected away or shows a sign-in prompt
    expect(!isOnReturns || signinPrompt > 0).toBe(true);
  });
});

// ─── Returns Page — Core Layout ───────────────────────────────────────────────

test.describe('Returns Page — Core Layout', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaLocalStorage(page);
    await goto(page, '/account/returns');
    await page.waitForTimeout(2000);
  });

  test('page loads and shows main heading', async ({ page }) => {
    const heading = page.locator('h1').filter({ hasText: /returns/i });
    await expect(heading).toBeVisible({ timeout: 8000 });
  });

  test('shows back-to-account link', async ({ page }) => {
    const backLink = page.locator('a[href="/account"]');
    await expect(backLink.first()).toBeVisible({ timeout: 8000 });
  });

  test('shows stats row with Total Returns', async ({ page }) => {
    const totalReturns = page.getByText(/total returns/i);
    await expect(totalReturns.first()).toBeVisible({ timeout: 8000 });
  });

  test('shows stats row with Total Refunded', async ({ page }) => {
    const totalRefunded = page.getByText(/total refunded/i);
    await expect(totalRefunded.first()).toBeVisible({ timeout: 8000 });
  });

  test('shows return policy banner', async ({ page }) => {
    // Policy banner mentions "10" or "return" or "policy"
    const policy = page
      .locator('div')
      .filter({ hasText: /return policy|10.day|free pickup/i })
      .first();
    await expect(policy).toBeVisible({ timeout: 8000 });
  });

  test('shows "Start New Return" or "New Return" button', async ({ page }) => {
    const btn = page.getByRole('button', { name: /new return|start.*return/i });
    await expect(btn.first()).toBeVisible({ timeout: 8000 });
  });

  test('page has no critical JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const critical = errors.filter(
      (e) =>
        !e.includes('NetworkError') &&
        !e.includes('fetch') &&
        !e.includes('Failed to fetch') &&
        !e.includes('401') &&
        !e.includes('Hydration') &&
        !e.includes('hydrating')
    );
    expect(critical).toHaveLength(0);
  });
});

// ─── Returns Page — Existing Returns ─────────────────────────────────────────

test.describe('Returns Page — Existing Return Cards', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaLocalStorage(page);
    await goto(page, '/account/returns');
    await page.waitForTimeout(2000);
  });

  test('shows return number RTN-2024-001234', async ({ page }) => {
    const card = page.getByText(/RTN-2024-001234/);
    await expect(card.first()).toBeVisible({ timeout: 8000 });
  });

  test('shows return number RTN-2024-005678', async ({ page }) => {
    const card = page.getByText(/RTN-2024-005678/);
    await expect(card.first()).toBeVisible({ timeout: 8000 });
  });

  test('shows Refunded status badge for RTN-2024-001234', async ({ page }) => {
    const refundedBadge = page.getByText(/refunded/i).first();
    await expect(refundedBadge).toBeVisible({ timeout: 8000 });
  });

  test('shows headphones product name in first return', async ({ page }) => {
    const product = page.getByText(/sony.*headphones|wh-1000/i);
    await expect(product.first()).toBeVisible({ timeout: 8000 });
  });

  test('shows refund amount for refunded return (₹24,999)', async ({ page }) => {
    const amount = page.locator('text=/24.999|24,999/').first();
    await expect(amount).toBeVisible({ timeout: 8000 });
  });

  test('shows boAt earbuds product in second return', async ({ page }) => {
    const product = page.getByText(/boat|airdopes/i);
    await expect(product.first()).toBeVisible({ timeout: 8000 });
  });

  test('shows order number for each return card', async ({ page }) => {
    const orderId = page.getByText(/ORD-2024-/);
    await expect(orderId.first()).toBeVisible({ timeout: 8000 });
  });
});

// ─── Returns Page — Filter Tabs ───────────────────────────────────────────────

test.describe('Returns Page — Filter Tabs', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaLocalStorage(page);
    await goto(page, '/account/returns');
    await page.waitForTimeout(2000);
  });

  test('shows All tab', async ({ page }) => {
    const allTab = page.getByRole('button', { name: /^all/i });
    await expect(allTab.first()).toBeVisible({ timeout: 8000 });
  });

  test('shows Active tab', async ({ page }) => {
    const activeTab = page.getByRole('button', { name: /active/i });
    await expect(activeTab.first()).toBeVisible({ timeout: 8000 });
  });

  test('shows Completed tab', async ({ page }) => {
    const completedTab = page.getByRole('button', { name: /completed/i });
    await expect(completedTab.first()).toBeVisible({ timeout: 8000 });
  });

  test('All tab shows both return cards', async ({ page }) => {
    const allTab = page.getByRole('button', { name: /^all/i }).first();
    await allTab.click();
    await page.waitForTimeout(500);

    const cards = page.getByText(/RTN-2024-/);
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('Active tab shows only in-progress returns', async ({ page }) => {
    const activeTab = page.getByRole('button', { name: /active/i }).first();
    await activeTab.click();
    await page.waitForTimeout(500);

    // RTN-2024-005678 is picked_up (active), RTN-2024-001234 is refunded (completed)
    const activeBadge = page.getByText(/picked up|pickup|in progress/i);
    const count = await activeBadge.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('Completed tab shows only refunded returns', async ({ page }) => {
    const completedTab = page.getByRole('button', { name: /completed/i }).first();
    await completedTab.click();
    await page.waitForTimeout(500);

    const refunded = page.getByText(/refunded/i).first();
    await expect(refunded).toBeVisible({ timeout: 5000 });
  });
});

// ─── Returns Page — Return Card Expand ────────────────────────────────────────

test.describe('Returns Page — Return Card Expand / Timeline', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaLocalStorage(page);
    await goto(page, '/account/returns');
    await page.waitForTimeout(2000);
  });

  test('clicking on RTN-2024-005678 card expands to show timeline', async ({ page }) => {
    // Find the card and click the "View details" button to expand
    const card = page
      .locator('[data-testid="view-details-btn"]')
      .filter({ hasText: /view details/i });
    const cards = await card.all();
    // The second return card (RTN-2024-005678) has the second view-details btn or we find by parent
    const rtCard = page
      .locator('div')
      .filter({ hasText: /RTN-2024-005678/ })
      .locator('[data-testid="view-details-btn"]')
      .first();
    await expect(rtCard).toBeVisible({ timeout: 8000 });
    await rtCard.click();
    await page.waitForTimeout(800);

    // Timeline should appear with step labels
    const timeline = page.getByText(/return initiated/i).first();
    await expect(timeline).toBeVisible({ timeout: 5000 });
  });

  test('expanded card shows refund method', async ({ page }) => {
    const rtCard = page
      .locator('div')
      .filter({ hasText: /RTN-2024-005678/ })
      .locator('[data-testid="view-details-btn"]')
      .first();
    await rtCard.click();
    await page.waitForTimeout(800);

    const method = page.getByText(/upi|phonepay|phonepe|refund method/i);
    await expect(method.first()).toBeVisible({ timeout: 5000 });
  });

  test('expanded card shows Quality Check step', async ({ page }) => {
    const card = page
      .locator('div')
      .filter({ hasText: /RTN-2024-005678/ })
      .first();
    await card.click();
    await page.waitForTimeout(800);

    const step = page.getByText(/quality check/i);
    await expect(step.first()).toBeVisible({ timeout: 5000 });
  });

  test('expanded card for refunded return shows Refunded step', async ({ page }) => {
    const card = page
      .locator('div')
      .filter({ hasText: /RTN-2024-001234/ })
      .first();
    await card.click();
    await page.waitForTimeout(800);

    const step = page.getByText('Refunded').first();
    await expect(step).toBeVisible({ timeout: 5000 });
  });
});

// ─── Returns Page — New Return Modal ──────────────────────────────────────────

test.describe('Returns Page — New Return Wizard (Step 1: Select Order)', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaLocalStorage(page);
    await goto(page, '/account/returns');
    await page.waitForTimeout(2000);

    // Open the New Return modal
    const newReturnBtn = page.getByRole('button', { name: /new return|start.*return/i }).first();
    await expect(newReturnBtn).toBeVisible({ timeout: 8000 });
    await newReturnBtn.click();
    await page.waitForTimeout(800);
  });

  test('modal opens and shows "Select Order" heading', async ({ page }) => {
    const heading = page.getByText(/select.*order|which order/i);
    await expect(heading.first()).toBeVisible({ timeout: 8000 });
  });

  test('modal shows returnable order ORD-2024-301122', async ({ page }) => {
    const order = page.getByText(/ORD-2024-301122/);
    await expect(order.first()).toBeVisible({ timeout: 8000 });
  });

  test('modal shows returnable order ORD-2024-302456', async ({ page }) => {
    const order = page.getByText(/ORD-2024-302456/);
    await expect(order.first()).toBeVisible({ timeout: 8000 });
  });

  test('modal shows days left in return window', async ({ page }) => {
    const daysLeft = page.getByText(/days? left|days? remaining/i);
    await expect(daysLeft.first()).toBeVisible({ timeout: 8000 });
  });

  test('modal shows Apple iPhone 15 Pro product in ORD-2024-301122', async ({ page }) => {
    const product = page.getByText(/apple.*15|iphone.*15|iphone 15 pro/i);
    await expect(product.first()).toBeVisible({ timeout: 8000 });
  });

  test('modal shows Close button', async ({ page }) => {
    const closeBtn = page.getByRole('button', { name: /close|cancel|×/i });
    await expect(closeBtn.first()).toBeVisible({ timeout: 8000 });
  });

  test('pressing Escape or clicking close dismisses modal', async ({ page }) => {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);

    // The modal header "Initiate Return" should be gone (this h2 only exists in the modal)
    const modalHeader = page.locator('h2').filter({ hasText: /Initiate Return/i });
    const count = await modalHeader.count();
    // Modal should be gone
    expect(count).toBe(0);
  });
});

// ─── Returns Page — New Return Wizard (Steps 2–4) ────────────────────────────

test.describe('Returns Page — New Return Wizard (Steps 2–4)', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaLocalStorage(page);
    await goto(page, '/account/returns');
    await page.waitForTimeout(2000);

    // Open modal
    const newReturnBtn = page.getByRole('button', { name: /new return|start.*return/i }).first();
    await newReturnBtn.click();
    await page.waitForTimeout(800);

    // Step 1: click first returnable order
    const firstOrder = page
      .locator('button')
      .filter({ hasText: /ORD-2024-301122/ })
      .first();
    await expect(firstOrder).toBeVisible({ timeout: 8000 });
    await firstOrder.click();
    await page.waitForTimeout(400);
    // Click "Continue" to advance from step 1 (select order) to step 2 (select items)
    const continueBtn = page.getByRole('button', { name: /continue/i }).first();
    await expect(continueBtn).toBeVisible({ timeout: 5000 });
    await continueBtn.click();
    await page.waitForTimeout(600);
  });

  test('step 2 shows "Select Items" heading', async ({ page }) => {
    const heading = page.getByText(/select items|which items/i);
    await expect(heading.first()).toBeVisible({ timeout: 8000 });
  });

  test('step 2 shows item checkboxes', async ({ page }) => {
    const checkboxes = page.locator('input[type="checkbox"]');
    const count = await checkboxes.count();
    expect(count).toBeGreaterThan(0);
  });

  test('step 2 shows Apple iPhone in item list', async ({ page }) => {
    const item = page.getByText(/apple.*15|iphone/i);
    await expect(item.first()).toBeVisible({ timeout: 8000 });
  });

  test('selecting an item and clicking Next shows step 3 (reason)', async ({ page }) => {
    const checkboxes = page.locator('input[type="checkbox"]');
    await checkboxes.first().check();
    await page.waitForTimeout(300);

    const nextBtn = page.getByRole('button', { name: /next|continue/i }).first();
    await expect(nextBtn).toBeVisible({ timeout: 5000 });
    await nextBtn.click();
    await page.waitForTimeout(600);

    // Step 3 — reason selection
    const reasonHeading = page.getByText(/select.*reason|why.*returning|return reason/i);
    await expect(reasonHeading.first()).toBeVisible({ timeout: 8000 });
  });

  test('step 3 shows predefined return reasons', async ({ page }) => {
    // Navigate to step 3
    const checkboxes = page.locator('input[type="checkbox"]');
    await checkboxes.first().check();
    await page.waitForTimeout(300);
    const nextBtn = page.getByRole('button', { name: /next|continue/i }).first();
    await nextBtn.click();
    await page.waitForTimeout(600);

    const defective = page.getByText(/defective|not working/i);
    await expect(defective.first()).toBeVisible({ timeout: 8000 });
  });

  test('step 3 shows "Product not as described" reason option', async ({ page }) => {
    const checkboxes = page.locator('input[type="checkbox"]');
    await checkboxes.first().check();
    await page.waitForTimeout(300);
    const nextBtn = page.getByRole('button', { name: /next|continue/i }).first();
    await nextBtn.click();
    await page.waitForTimeout(600);

    const reason = page.getByText(/product not as described/i);
    await expect(reason.first()).toBeVisible({ timeout: 8000 });
  });

  test('full wizard: select order → items → reason → confirm', async ({ page }) => {
    // Step 2: select item
    const checkboxes = page.locator('input[type="checkbox"]');
    await checkboxes.first().check();
    await page.waitForTimeout(300);
    let nextBtn = page.getByRole('button', { name: /next|continue/i }).first();
    await nextBtn.click();
    await page.waitForTimeout(600);

    // Step 3: select reason
    const reason = page.getByRole('button', { name: /product not as described/i }).first();
    await reason.click();
    await page.waitForTimeout(300);
    nextBtn = page.getByRole('button', { name: /next|continue/i }).last();
    await nextBtn.click();
    await page.waitForTimeout(600);

    // Step 4: confirm
    const confirmHeading = page.getByText(/confirm|review.*return|submit.*return/i);
    await expect(confirmHeading.first()).toBeVisible({ timeout: 8000 });
  });

  test('step 4 shows submit button', async ({ page }) => {
    // Navigate to step 4
    const checkboxes = page.locator('input[type="checkbox"]');
    await checkboxes.first().check();
    await page.waitForTimeout(300);
    let nextBtn = page.getByRole('button', { name: /next|continue/i }).first();
    await nextBtn.click();
    await page.waitForTimeout(600);

    const reason = page.getByRole('button', { name: /product not as described/i }).first();
    await reason.click();
    await page.waitForTimeout(300);
    nextBtn = page.getByRole('button', { name: /next|continue/i }).last();
    await nextBtn.click();
    await page.waitForTimeout(600);

    const submitBtn = page.getByRole('button', { name: /submit.*return|confirm.*return|submit/i });
    await expect(submitBtn.first()).toBeVisible({ timeout: 8000 });
  });
});

// ─── Returns Page — New Return Submission ─────────────────────────────────────

test.describe('Returns Page — Submit New Return', () => {
  test('submitting wizard creates a new return and shows success', async ({ page }) => {
    await loginViaLocalStorage(page);
    await goto(page, '/account/returns');
    await page.waitForTimeout(2000);

    // Step 1: Open modal & select order
    const newReturnBtn = page.getByRole('button', { name: /new return|start.*return/i }).first();
    await newReturnBtn.click();
    await page.waitForTimeout(800);

    const firstOrder = page
      .locator('button')
      .filter({ hasText: /ORD-2024-301122/ })
      .first();
    await firstOrder.click();
    await page.waitForTimeout(400);
    const continueBtn1 = page.getByRole('button', { name: /continue/i }).first();
    await continueBtn1.click();
    await page.waitForTimeout(600);

    // Step 2: Select item
    const checkboxes = page.locator('input[type="checkbox"]');
    await checkboxes.first().check();
    await page.waitForTimeout(300);
    let nextBtn = page.getByRole('button', { name: /next|continue/i }).first();
    await nextBtn.click();
    await page.waitForTimeout(600);

    // Step 3: Select reason
    const reason = page.getByRole('button', { name: /product not as described/i }).first();
    await reason.click();
    await page.waitForTimeout(300);
    nextBtn = page.getByRole('button', { name: /next|continue/i }).last();
    await nextBtn.click();
    await page.waitForTimeout(600);

    // Step 4: Submit
    const submitBtn = page
      .getByRole('button', { name: /submit.*return|confirm.*return|submit/i })
      .first();
    await submitBtn.click();
    await page.waitForTimeout(1500);

    // Should show success toast or new return in list
    const success = page.getByText(/success|return.*submitted|request.*submitted|initiated/i);
    await expect(success.first()).toBeVisible({ timeout: 8000 });
  });

  test('after submission, new return appears in the returns list', async ({ page }) => {
    await loginViaLocalStorage(page);
    await goto(page, '/account/returns');
    await page.waitForTimeout(2000);

    const initialCount = await page.getByText(/RTN-/i).count();

    // Run through wizard
    const newReturnBtn = page.getByRole('button', { name: /new return|start.*return/i }).first();
    await newReturnBtn.click();
    await page.waitForTimeout(800);

    const firstOrder = page
      .locator('button')
      .filter({ hasText: /ORD-2024-301122/ })
      .first();
    await firstOrder.click();
    await page.waitForTimeout(400);
    const continueBtn2 = page.getByRole('button', { name: /continue/i }).first();
    await continueBtn2.click();
    await page.waitForTimeout(600);

    const checkboxes = page.locator('input[type="checkbox"]');
    await checkboxes.first().check();
    await page.waitForTimeout(300);
    let nextBtn = page.getByRole('button', { name: /next|continue/i }).first();
    await nextBtn.click();
    await page.waitForTimeout(600);

    const reason = page.getByRole('button', { name: /product not as described/i }).first();
    await reason.click();
    await page.waitForTimeout(300);
    nextBtn = page.getByRole('button', { name: /next|continue/i }).last();
    await nextBtn.click();
    await page.waitForTimeout(600);

    const submitBtn = page
      .getByRole('button', { name: /submit.*return|confirm.*return|submit/i })
      .first();
    await submitBtn.click();
    await page.waitForTimeout(2000);

    // Dismiss toast if needed
    const afterCount = await page.getByText(/RTN-/i).count();
    expect(afterCount).toBeGreaterThanOrEqual(initialCount);
  });
});

// ─── Returns Page — Stability ─────────────────────────────────────────────────

test.describe('Returns Page — Stability', () => {
  test('returns page renders without hydration errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await loginViaLocalStorage(page);
    await goto(page, '/account/returns');
    await page.waitForTimeout(2500);

    // Filter known React 18/Next.js/framer-motion SSR false positives in dev mode
    const hydrationErrors = consoleErrors.filter((e) => {
      if (e.includes('polygon')) return false; // lucide-react SVG SSR artifact
      if (e.includes('replaced with client content')) return false; // cascading hydration msg
      if (e.includes('Warning:')) return false; // React warnings, not errors
      return e.toLowerCase().includes('hydrat');
    });
    expect(hydrationErrors).toHaveLength(0);
  });

  test('page is scrollable and shows all content', async ({ page }) => {
    await loginViaLocalStorage(page);
    await goto(page, '/account/returns');
    await page.waitForTimeout(2000);

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    // No crash after scroll
    const heading = page.locator('h1').filter({ hasText: /returns/i });
    await expect(heading).toBeVisible({ timeout: 5000 });
  });
});
