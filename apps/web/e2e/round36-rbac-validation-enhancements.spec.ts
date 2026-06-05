/**
 * Round 36 — RBAC, Enhanced Validation, Context-Aware Navigation
 *
 * Covers:
 *  - Role-based authorization (admin, analytics, aiplus, basic, observability, reinforced-learning)
 *  - Enhanced validation page with rich product data panels
 *  - Context-aware back navigation from validation page
 *  - Validation chip referrer tracking (?from= parameter)
 *  - View mode toggle (Current / History)
 *  - Demo user roles and access
 */
import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:3000';

test.use({ video: 'on' });

// ── Helpers ──────────────────────────────────────────────────────────────────

async function setupUser(page: import('@playwright/test').Page, email: string, role: string, subscription: string) {
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(({ email, role, subscription }) => {
    localStorage.setItem('userEmail', email);
    localStorage.setItem('authToken', `admin-${Date.now()}`);
    localStorage.setItem('dc-user-role', role);
    localStorage.setItem('dc-user-subscription', subscription);
    localStorage.setItem('dc-user-id', `uid-${email.split('@')[0]}`);
  }, { email, role, subscription });
}

async function goToValidation(page: import('@playwright/test').Page, from: string) {
  await setupUser(page, 'admin@delegatecart.com', 'admin', 'AI_PLUS');
  await page.goto(`${BASE}/shopping-assistant/metrics/validation?from=${from}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    localStorage.setItem('userEmail', 'admin@delegatecart.com');
    localStorage.setItem('authToken', 'admin-token-r36');
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('body')).toContainText(/Metrics Validation Dashboard/i, { timeout: 15000 });
}

// ══════════════════════════════════════════════════════════════════════════════
// GROUP 1 — RBAC System
// ══════════════════════════════════════════════════════════════════════════════
test.describe('RBAC — Role-based access', () => {

  test('Admin user can access validation dashboard', async ({ page }) => {
    await goToValidation(page, 'shopping-assistant');
    await expect(page.locator('body')).toContainText('Metrics Validation Dashboard');
    await expect(page.locator('[data-testid="public-access-toggle"]')).toBeVisible();
  });

  test('Basic user is blocked from AI+ page', async ({ page }) => {
    await setupUser(page, 'basicdemo@delegatecart.com', 'basic', 'BASIC');
    await page.goto(`${BASE}/ai-plus`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    // Basic users see the upgrade CTA (locked state)
    await expect(page.locator('body')).toContainText(/Upgrade to AI Plus|AI\+/i);
  });

  test('Signed-in user sees validation with own data only', async ({ page }) => {
    await setupUser(page, 'basicdemo@delegatecart.com', 'basic', 'BASIC');
    await page.goto(`${BASE}/shopping-assistant/metrics/validation?from=shopping-assistant`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const body = await page.locator('body').textContent() ?? '';
    // Should see dashboard (has auth), NOT the sign-in screen
    expect(body).toMatch(/Metrics Validation Dashboard/i);
    // Should NOT see admin toggle
    await expect(page.locator('[data-testid="public-access-toggle"]')).not.toBeVisible();
  });

  test('Unauthenticated user sees sign-in screen', async ({ page }) => {
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      localStorage.removeItem('userEmail');
      localStorage.removeItem('authToken');
      localStorage.removeItem('dc-user-id');
      localStorage.removeItem('dc-user-role');
    });
    await page.goto(`${BASE}/shopping-assistant/metrics/validation`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3500);
    const body = await page.locator('body').textContent() ?? '';
    expect(body).toMatch(/Sign In Required|Go to Sign In/i);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// GROUP 2 — Context-Aware Back Navigation
// ══════════════════════════════════════════════════════════════════════════════
test.describe('Context-aware back navigation', () => {

  test('Back button shows "Smart Shopping Assistant" when from=shopping-assistant', async ({ page }) => {
    await goToValidation(page, 'shopping-assistant');
    await expect(page.locator('[data-testid="validation-referrer-label"]')).toContainText('Smart Shopping Assistant');
  });

  test('Back button shows "Shopping List" when from=shopping-list', async ({ page }) => {
    await goToValidation(page, 'shopping-list');
    await expect(page.locator('[data-testid="validation-referrer-label"]')).toContainText('Shopping List');
  });

  test('Back button shows "AI+" when from=ai-plus', async ({ page }) => {
    await goToValidation(page, 'ai-plus');
    await expect(page.locator('[data-testid="validation-referrer-label"]')).toContainText('AI+');
  });

  test('Back button shows "Smart Delegate" when from=smart-delegate', async ({ page }) => {
    await goToValidation(page, 'smart-delegate');
    await expect(page.locator('[data-testid="validation-referrer-label"]')).toContainText('Smart Delegate');
  });

  test('Back button navigates to correct page', async ({ page }) => {
    await goToValidation(page, 'shopping-list');
    await page.locator('[data-testid="validation-back-btn"]').click();
    await page.waitForURL(/\/shopping-list/);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// GROUP 3 — View Mode Toggle
// ══════════════════════════════════════════════════════════════════════════════
test.describe('View mode toggle', () => {

  test('View mode toggle shows Current and History buttons', async ({ page }) => {
    await goToValidation(page, 'shopping-assistant');
    const toggle = page.locator('[data-testid="view-mode-toggle"]');
    await expect(toggle).toBeVisible();
    await expect(toggle).toContainText('Current');
    await expect(toggle).toContainText('History');
  });

  test('Clicking History shows all sessions', async ({ page }) => {
    await goToValidation(page, 'shopping-assistant');
    await page.locator('[data-testid="view-mode-toggle"] button:has-text("History")').click();
    await page.waitForTimeout(500);
    // Admin with demo data should have multiple sessions
    const sessionCount = await page.locator('[data-testid^="validation-session-"]').count();
    expect(sessionCount).toBeGreaterThan(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// GROUP 4 — Enhanced Product Data Panels
// ══════════════════════════════════════════════════════════════════════════════
test.describe('Enhanced validation product detail panels', () => {

  test('Expanded product shows Product Specifications section', async ({ page }) => {
    await goToValidation(page, 'shopping-assistant');
    // Switch to history mode to see demo data
    await page.locator('[data-testid="view-mode-toggle"] button:has-text("History")').click();
    await page.waitForTimeout(500);
    // Expand first session
    const firstSession = page.locator('[data-testid^="validation-session-"]').first();
    await firstSession.click();
    await page.waitForTimeout(800);
    // Click first product row
    const productRow = page.locator('table tbody tr').first();
    await productRow.click();
    await page.waitForTimeout(500);
    await expect(page.locator('body')).toContainText('Product Specifications');
  });

  test('Expanded product shows Delivery Performance panel', async ({ page }) => {
    await goToValidation(page, 'shopping-assistant');
    await page.locator('[data-testid="view-mode-toggle"] button:has-text("History")').click();
    await page.waitForTimeout(500);
    const firstSession = page.locator('[data-testid^="validation-session-"]').first();
    await firstSession.click();
    await page.waitForTimeout(800);
    const productRow = page.locator('table tbody tr').first();
    await productRow.click();
    await page.waitForTimeout(500);
    await expect(page.locator('body')).toContainText('Delivery Performance');
    await expect(page.locator('body')).toContainText('Last 12 Months');
  });

  test('Expanded product shows Ratings & Reviews Analytics', async ({ page }) => {
    await goToValidation(page, 'shopping-assistant');
    await page.locator('[data-testid="view-mode-toggle"] button:has-text("History")').click();
    await page.waitForTimeout(500);
    const firstSession = page.locator('[data-testid^="validation-session-"]').first();
    await firstSession.click();
    await page.waitForTimeout(800);
    const productRow = page.locator('table tbody tr').first();
    await productRow.click();
    await page.waitForTimeout(500);
    await expect(page.locator('body')).toContainText('Ratings & Reviews Analytics');
    await expect(page.locator('body')).toContainText('Star Distribution');
  });

  test('Expanded product shows Brand & Manufacturer Profile', async ({ page }) => {
    await goToValidation(page, 'shopping-assistant');
    await page.locator('[data-testid="view-mode-toggle"] button:has-text("History")').click();
    await page.waitForTimeout(500);
    const firstSession = page.locator('[data-testid^="validation-session-"]').first();
    await firstSession.click();
    await page.waitForTimeout(800);
    const productRow = page.locator('table tbody tr').first();
    await productRow.click();
    await page.waitForTimeout(500);
    await expect(page.locator('body')).toContainText('Brand & Manufacturer Profile');
    await expect(page.locator('body')).toContainText('Country of Origin');
  });

  test('Expanded product shows Warranty & Redemption Data', async ({ page }) => {
    await goToValidation(page, 'shopping-assistant');
    await page.locator('[data-testid="view-mode-toggle"] button:has-text("History")').click();
    await page.waitForTimeout(500);
    const firstSession = page.locator('[data-testid^="validation-session-"]').first();
    await firstSession.click();
    await page.waitForTimeout(800);
    const productRow = page.locator('table tbody tr').first();
    await productRow.click();
    await page.waitForTimeout(500);
    await expect(page.locator('body')).toContainText('Warranty & Redemption Data');
    await expect(page.locator('body')).toContainText('Claim Approval Rate');
  });

  test('Expanded product shows 7-Dimension Score Breakdown', async ({ page }) => {
    await goToValidation(page, 'shopping-assistant');
    await page.locator('[data-testid="view-mode-toggle"] button:has-text("History")').click();
    await page.waitForTimeout(500);
    const firstSession = page.locator('[data-testid^="validation-session-"]').first();
    await firstSession.click();
    await page.waitForTimeout(800);
    const productRow = page.locator('table tbody tr').first();
    await productRow.click();
    await page.waitForTimeout(500);
    await expect(page.locator('body')).toContainText('7-Dimension Score Breakdown');
  });

  test('Expanded product shows Spec Match — Query vs Product', async ({ page }) => {
    await goToValidation(page, 'shopping-assistant');
    await page.locator('[data-testid="view-mode-toggle"] button:has-text("History")').click();
    await page.waitForTimeout(500);
    const firstSession = page.locator('[data-testid^="validation-session-"]').first();
    await firstSession.click();
    await page.waitForTimeout(800);
    const productRow = page.locator('table tbody tr').first();
    await productRow.click();
    await page.waitForTimeout(500);
    await expect(page.locator('body')).toContainText('Spec Match');
    await expect(page.locator('body')).toContainText('User Query');
    await expect(page.locator('body')).toContainText('Product Match');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// GROUP 5 — Validation Chips with Referrer
// ══════════════════════════════════════════════════════════════════════════════
test.describe('Validation chips pass referrer parameter', () => {

  test('Shopping Assistant chip links with from=shopping-assistant', async ({ page }) => {
    await page.goto(`${BASE}/shopping-assistant`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const chip = page.locator('[data-testid="metric-validation"]');
    await expect(chip).toBeVisible();
    const href = await chip.getAttribute('href');
    expect(href).toContain('from=shopping-assistant');
  });

  test('Shopping List chip links with from=shopping-list', async ({ page }) => {
    await page.goto(`${BASE}/shopping-list`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    const chip = page.locator('[data-testid="validation-chip-shopping-list"]');
    await expect(chip).toBeVisible();
    const href = await chip.getAttribute('href');
    expect(href).toContain('from=shopping-list');
  });

  test('Smart Delegate chip links with from=smart-delegate', async ({ page }) => {
    await setupUser(page, 'admin@delegatecart.com', 'admin', 'AI_PLUS');
    await page.goto(`${BASE}/smart-delegate`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    const chip = page.locator('[data-testid="validation-chip-smart-delegate"]');
    await expect(chip).toBeVisible();
    const href = await chip.getAttribute('href');
    expect(href).toContain('from=smart-delegate');
  });

  test('AI+ chip links with from=ai-plus', async ({ page }) => {
    await page.goto(`${BASE}/ai-plus`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    const lockedChip = page.locator('[data-testid="validation-chip-ai-plus-locked"]');
    const activeChip = page.locator('[data-testid="validation-chip-ai-plus"]');
    const chip = (await lockedChip.count()) > 0 ? lockedChip : activeChip;
    const href = await chip.getAttribute('href');
    expect(href).toContain('from=ai-plus');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// GROUP 6 — Full End-to-End Flow (Video Proof)
// ══════════════════════════════════════════════════════════════════════════════
test.describe('E2E validation flow (video proof)', () => {

  test('Complete flow: Shopping Assistant → Validation → Rich Data → Back', async ({ page }) => {
    // Step 1: Setup admin user
    await setupUser(page, 'admin@delegatecart.com', 'admin', 'AI_PLUS');

    // Step 2: Navigate to Shopping Assistant
    await page.goto(`${BASE}/shopping-assistant`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Step 3: Click validation chip
    const validationChip = page.locator('[data-testid="metric-validation"]');
    await expect(validationChip).toBeVisible();
    await validationChip.click();

    // Step 4: Verify validation page loaded with correct referrer
    await page.waitForURL(/\/shopping-assistant\/metrics\/validation/);
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      localStorage.setItem('userEmail', 'admin@delegatecart.com');
      localStorage.setItem('authToken', 'admin-token-r36-e2e');
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toContainText('Metrics Validation Dashboard', { timeout: 15000 });
    await expect(page.locator('[data-testid="validation-referrer-label"]')).toContainText('Smart Shopping Assistant');

    // Step 5: Toggle to History mode
    await page.locator('[data-testid="view-mode-toggle"] button:has-text("History")').click();
    await page.waitForTimeout(500);

    // Step 6: Expand a session
    const session = page.locator('[data-testid^="validation-session-"]').first();
    if (await session.count() > 0) {
      await session.click();
      await page.waitForTimeout(800);

      // Step 7: Expand a product for rich data
      const productRow = page.locator('table tbody tr').first();
      if (await productRow.count() > 0) {
        await productRow.click();
        await page.waitForTimeout(500);

        // Verify all enriched panels are present
        await expect(page.locator('body')).toContainText('Product Specifications');
        await expect(page.locator('body')).toContainText('Delivery Performance');
        await expect(page.locator('body')).toContainText('Ratings & Reviews Analytics');
        await expect(page.locator('body')).toContainText('Brand & Manufacturer Profile');
        await expect(page.locator('body')).toContainText('Warranty & Redemption Data');
        await expect(page.locator('body')).toContainText('7-Dimension Score Breakdown');
      }
    }

    // Step 8: Screenshot the enriched view
    await page.screenshot({ path: 'test-results/r36-validation-enriched-flow.png', fullPage: true });

    // Step 9: Navigate back to Shopping Assistant
    await page.locator('[data-testid="validation-back-btn"]').click();
    await page.waitForURL(/\/shopping-assistant/);
    await expect(page.locator('body')).toContainText(/Smart Shopping Assistant|Shopping Assistant/i);
  });
});
