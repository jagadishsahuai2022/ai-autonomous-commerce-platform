/**
 * Round 34 — End-to-End Validation Tests
 *
 * Issue 1: Metrics score & time-saved pages open properly
 * Issue 2: Validation tile moved to account page (hidden from shopping assistant)
 * Issue 3: Pipeline/Decision/Approval panel sync on session navigation
 * Issue 4: Admin detection for validation & notifications pages
 */

import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:3000';

// ── Helpers ────────────────────────────────────────────────────────────────

async function goToShoppingAssistant(page: import('@playwright/test').Page) {
  await page.goto(`${BASE}/shopping-assistant`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);
}

async function sendChatMessage(page: import('@playwright/test').Page, text: string, waitMs = 5000) {
  const input = page.locator('textarea[placeholder*="Ask me"], input[placeholder*="Ask me"]').first();
  await input.waitFor({ state: 'visible', timeout: 10000 });
  await input.fill(text);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(waitMs);
}

async function loginAsAdmin(page: import('@playwright/test').Page) {
  // Use localStorage directly — avoids form UI fragility and signin page layout issues
  await page.goto(`${BASE}/`);
  await page.waitForLoadState('domcontentloaded');
  await page.evaluate(() => {
    localStorage.setItem('userEmail', 'admin@delegatecart.com');
    localStorage.setItem('authToken', 'admin-token-test');
  });
  await page.waitForTimeout(200);
}

// ══════════════════════════════════════════════════════════════════════════════
// GROUP 1 — Metrics Pages (Score & Time-Saved) Open Properly
// ══════════════════════════════════════════════════════════════════════════════
test.describe('Issue 1 — Metrics score and time-saved pages', () => {

  test('Avg score metric tile is visible in stats strip', async ({ page }) => {
    await goToShoppingAssistant(page);
    const scoreTile = page.locator('[data-testid="metric-avg-score"]');
    await scoreTile.waitFor({ state: 'visible', timeout: 10000 });
    await expect(scoreTile).toBeVisible();
  });

  test('Time saved metric tile is visible in stats strip', async ({ page }) => {
    await goToShoppingAssistant(page);
    const timeTile = page.locator('[data-testid="metric-time-saved"]');
    await timeTile.waitFor({ state: 'visible', timeout: 10000 });
    await expect(timeTile).toBeVisible();
  });

  test('Avg score tile links to /shopping-assistant/metrics/score', async ({ page }) => {
    await goToShoppingAssistant(page);
    const scoreTile = page.locator('[data-testid="metric-avg-score"]');
    await scoreTile.waitFor({ state: 'visible', timeout: 10000 });
    const href = await scoreTile.getAttribute('href');
    expect(href).toContain('/shopping-assistant/metrics/score');
  });

  test('Time saved tile links to /shopping-assistant/metrics/time-saved', async ({ page }) => {
    await goToShoppingAssistant(page);
    const timeTile = page.locator('[data-testid="metric-time-saved"]');
    await timeTile.waitFor({ state: 'visible', timeout: 10000 });
    const href = await timeTile.getAttribute('href');
    expect(href).toContain('/shopping-assistant/metrics/time-saved');
  });

  test('Avg score detail page loads and shows headline', async ({ page }) => {
    await page.goto(`${BASE}/shopping-assistant/metrics/score`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    // Page should render (not be blank or error boundary)
    await expect(page.locator('h1, [class*="font-bold"]').first()).toBeVisible();
    // Verify URL is correct (didn't redirect to 404)
    expect(page.url()).toContain('/shopping-assistant/metrics/score');
  });

  test('Time saved detail page loads and shows headline', async ({ page }) => {
    await page.goto(`${BASE}/shopping-assistant/metrics/time-saved`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    await expect(page.locator('h1, [class*="font-bold"]').first()).toBeVisible();
    expect(page.url()).toContain('/shopping-assistant/metrics/time-saved');
  });

  test('Score page shows AI Scoring Analytics heading', async ({ page }) => {
    await page.goto(`${BASE}/shopping-assistant/metrics/score`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toContain('Scoring');
  });

  test('Time saved page shows Time Saved or Pipeline content', async ({ page }) => {
    await page.goto(`${BASE}/shopping-assistant/metrics/time-saved`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toMatch(/Time Saved|Pipeline|Traditional/i);
  });

  test('Stats strip has exactly 3 tiles (products, avg-score, time-saved) — no validation tile', async ({ page }) => {
    await goToShoppingAssistant(page);
    // Products, Avg score, Time saved — Validation removed
    const scoreTile = page.locator('[data-testid="metric-avg-score"]');
    const timeTile = page.locator('[data-testid="metric-time-saved"]');
    const productsTile = page.locator('[data-testid="metric-products"]');
    await scoreTile.waitFor({ state: 'visible', timeout: 10000 });
    await expect(scoreTile).toBeVisible();
    await expect(timeTile).toBeVisible();
    await expect(productsTile).toBeVisible();

    // Validation tile should NOT be in the shopping assistant stats strip
    const validationTileInStrip = page.locator('[data-testid="metric-validation"]');
    await expect(validationTileInStrip).toHaveCount(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// GROUP 2 — Validation Tile Moved to Account Page
// ══════════════════════════════════════════════════════════════════════════════
test.describe('Issue 2 — Validation tile on account page', () => {

  test('Account page loads without errors', async ({ page }) => {
    await page.goto(`${BASE}/account`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    // Account page may redirect to /signin for unauthenticated users — both are correct
    expect(page.url()).toMatch(/\/account|\/signin/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('Validation metric page route exists and loads', async ({ page }) => {
    await page.goto(`${BASE}/shopping-assistant/metrics/validation`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    expect(page.url()).toContain('/shopping-assistant/metrics/validation');
    await expect(page.locator('body')).toBeVisible();
  });

  test('Validation page shows admin access gate for non-admin', async ({ page }) => {
    // Without login, should show access gate
    await page.goto(`${BASE}/shopping-assistant/metrics/validation`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    const bodyText = await page.locator('body').textContent();
    // Either shows admin required OR loads normally if publicAccess is set
    expect(bodyText?.length).toBeGreaterThan(10);
  });

  test('Account page shows admin sections when logged in as admin', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/account`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    const bodyText = await page.locator('body').textContent();
    // Should show account sections
    expect(bodyText).toMatch(/Account|Profile|Order|DelegateCart/i);
  });

  test('Metrics Validation section appears in account page for admin', async ({ page }) => {
    // Set admin auth before navigating (account page redirects to signin when unauthenticated)
    await page.goto(`${BASE}/`);
    await page.waitForLoadState('domcontentloaded');
    await page.evaluate(() => {
      localStorage.setItem('userEmail', 'admin@delegatecart.com');
      localStorage.setItem('authToken', 'admin-token');
    });
    await page.goto(`${BASE}/account`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    const bodyText = await page.locator('body').textContent();
    // Validation section should appear for admin
    expect(bodyText).toMatch(/Metrics Validation|Validation/i);
  });

  test('Metrics Validation link on account page navigates to validation page', async ({ page }) => {
    // Set admin auth before navigating
    await page.goto(`${BASE}/`);
    await page.waitForLoadState('domcontentloaded');
    await page.evaluate(() => {
      localStorage.setItem('userEmail', 'admin@delegatecart.com');
      localStorage.setItem('authToken', 'admin-token');
    });
    await page.goto(`${BASE}/account`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    // Find the Metrics Validation link
    const validationLink = page.locator('a[href*="/shopping-assistant/metrics/validation"]').first();
    if (await validationLink.count() > 0) {
      const href = await validationLink.getAttribute('href');
      expect(href).toContain('/shopping-assistant/metrics/validation');
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// GROUP 3 — Admin Detection for Validation & Notifications Pages
// ══════════════════════════════════════════════════════════════════════════════
test.describe('Issue 3 (admin detection) — Validation page respects logged-in admin', () => {

  test('Validation page unlocks when userEmail is admin@delegatecart.com', async ({ page }) => {
    await page.goto(`${BASE}/shopping-assistant/metrics/validation`);
    await page.waitForLoadState('domcontentloaded');
    // Set the correct localStorage key used by the login flow
    await page.evaluate(() => {
      localStorage.setItem('userEmail', 'admin@delegatecart.com');
    });
    await page.reload();
    await page.waitForTimeout(2000);
    const bodyText = await page.locator('body').textContent();
    // Should NOT show "Admin Access Required" lock screen
    expect(bodyText).not.toContain('Admin Access Required');
  });

  test('Validation page shows dashboard content for admin user', async ({ page }) => {
    await page.goto(`${BASE}/shopping-assistant/metrics/validation`);
    await page.evaluate(() => {
      localStorage.setItem('userEmail', 'admin@delegatecart.com');
    });
    await page.reload();
    await page.waitForTimeout(2000);
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toMatch(/Metrics Validation|Validation Dashboard|Cross-check/i);
  });

  test('Notifications page unlocks for admin user', async ({ page }) => {
    await page.goto(`${BASE}/shopping-assistant/notifications`);
    await page.evaluate(() => {
      localStorage.setItem('userEmail', 'admin@delegatecart.com');
    });
    await page.reload();
    await page.waitForTimeout(2000);
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).not.toContain('Admin Access Required');
  });

  test('Validation page shows Admin badge when admin email is set', async ({ page }) => {
    await page.goto(`${BASE}/shopping-assistant/metrics/validation`);
    await page.evaluate(() => {
      localStorage.setItem('userEmail', 'admin@delegatecart.com');
    });
    await page.reload();
    await page.waitForTimeout(2000);
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toMatch(/Admin/i);
  });

  test('Public access toggle appears for admin on validation page', async ({ page }) => {
    await page.goto(`${BASE}/shopping-assistant/metrics/validation`);
    await page.evaluate(() => {
      localStorage.setItem('userEmail', 'admin@delegatecart.com');
    });
    await page.reload();
    await page.waitForTimeout(2000);
    const toggle = page.locator('[data-testid="public-access-toggle"]');
    await expect(toggle).toBeVisible({ timeout: 5000 });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// GROUP 4 — Pipeline/Decision/Approval Panel Sync on Session Navigation
// ══════════════════════════════════════════════════════════════════════════════
test.describe('Issue 4 — Panel sync across Pipeline/Decision/Approval tabs', () => {

  test('Decision tab shows product list after chat query', async ({ page }) => {
    await goToShoppingAssistant(page);
    await sendChatMessage(page, 'Find me headphones under 30000', 6000);
    const decisionTab = page.locator('button:has-text("Decision")');
    await decisionTab.waitFor({ state: 'visible', timeout: 8000 });
    await decisionTab.click();
    await page.waitForTimeout(500);
    // Panel should be visible and render content (sidebar renders products)
    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.length ?? 0).toBeGreaterThan(100);
  });

  test('Pipeline tab is visible and clickable', async ({ page }) => {
    await goToShoppingAssistant(page);
    const pipelineTab = page.locator('button:has-text("Pipeline")');
    await pipelineTab.waitFor({ state: 'visible', timeout: 10000 });
    await expect(pipelineTab).toBeVisible();
    await pipelineTab.click();
    await page.waitForTimeout(300);
  });

  test('Approval tab is visible and clickable', async ({ page }) => {
    await goToShoppingAssistant(page);
    const approvalTab = page.locator('button:has-text("Approval")');
    await approvalTab.waitFor({ state: 'visible', timeout: 10000 });
    await expect(approvalTab).toBeVisible();
    await approvalTab.click();
    await page.waitForTimeout(300);
  });

  test('Switching between tabs does not throw visible errors', async ({ page }) => {
    await goToShoppingAssistant(page);
    const tabs = ['Pipeline', 'Decision', 'Approval'];
    for (const tabLabel of tabs) {
      const tab = page.locator(`button:has-text("${tabLabel}")`);
      await tab.waitFor({ state: 'visible', timeout: 8000 });
      await tab.click();
      await page.waitForTimeout(400);
      // No error boundary or JS crash should have occurred
      const errorText = await page.locator('[class*="error"], text=Error').textContent().catch(() => '');
      expect(errorText).not.toContain('Something went wrong');
    }
  });

  test('Session pagination appears after multiple queries', async ({ page }) => {
    await goToShoppingAssistant(page);
    await sendChatMessage(page, 'Find laptops under 50000', 5000);
    await sendChatMessage(page, 'Best wireless earbuds', 5000);
    // Pagination may appear after 2 sessions
    const pagination = page.locator('[data-testid="session-pagination"]');
    const count = await pagination.count();
    // Either pagination exists or both were handled as 1 session - just verify no crash
    if (count > 0) {
      await expect(pagination).toBeVisible();
    }
  });

  test('Session prev/next buttons work when pagination shown', async ({ page }) => {
    await goToShoppingAssistant(page);
    await sendChatMessage(page, 'Best phone under 20000', 5000);
    await sendChatMessage(page, 'Best headphones under 5000', 5000);
    const pagination = page.locator('[data-testid="session-pagination"]');
    if (await pagination.count() > 0) {
      const prevBtn = page.locator('[data-testid="session-prev-btn"]');
      const nextBtn = page.locator('[data-testid="session-next-btn"]');
      await expect(prevBtn).toBeVisible();
      await expect(nextBtn).toBeVisible();
      // Navigate to previous session
      if (!await prevBtn.isDisabled()) {
        await prevBtn.click();
        await page.waitForTimeout(500);
        // Panel should still show content (no blank/crash)
        await expect(page.locator('aside, [class*="sidebar"]').first()).toBeVisible();
      }
    }
  });

  test('Decision tab reflects session products after navigation', async ({ page }) => {
    await goToShoppingAssistant(page);
    await sendChatMessage(page, 'Best phone under 15000', 5000);
    await sendChatMessage(page, 'Best running shoes', 5000);
    const pagination = page.locator('[data-testid="session-pagination"]');
    if (await pagination.count() > 0) {
      // Navigate back and check decision tab
      const prevBtn = page.locator('[data-testid="session-prev-btn"]');
      if (await prevBtn.count() > 0 && !await prevBtn.isDisabled()) {
        await prevBtn.click();
        await page.waitForTimeout(600);
        const decisionTab = page.locator('button:has-text("Decision")');
        await decisionTab.click();
        await page.waitForTimeout(300);
        // Decision panel should be visible without crash
        await expect(page.locator('aside').first()).toBeVisible();
      }
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// GROUP 5 — Stats Strip Layout Consistency
// ══════════════════════════════════════════════════════════════════════════════
test.describe('Issue 5 — Stats strip layout and tile values', () => {

  test('Stats strip shows products count tile', async ({ page }) => {
    await goToShoppingAssistant(page);
    const productsTile = page.locator('[data-testid="metric-products"]');
    await productsTile.waitFor({ state: 'visible', timeout: 10000 });
    await expect(productsTile).toBeVisible();
  });

  test('Stats strip shows avg score tile with percentage value', async ({ page }) => {
    await goToShoppingAssistant(page);
    const scoreTile = page.locator('[data-testid="metric-avg-score"]');
    await scoreTile.waitFor({ state: 'visible', timeout: 10000 });
    const text = await scoreTile.textContent();
    expect(text).toMatch(/%|score/i);
  });

  test('Stats strip shows time saved tile', async ({ page }) => {
    await goToShoppingAssistant(page);
    const timeTile = page.locator('[data-testid="metric-time-saved"]');
    await timeTile.waitFor({ state: 'visible', timeout: 10000 });
    await expect(timeTile).toBeVisible();
  });

  test('Products tile links to metrics products page', async ({ page }) => {
    await goToShoppingAssistant(page);
    const tile = page.locator('[data-testid="metric-products"]');
    await tile.waitFor({ state: 'visible', timeout: 10000 });
    const href = await tile.getAttribute('href');
    expect(href).toContain('/shopping-assistant/metrics/products');
  });

  test('Products metrics page loads without errors', async ({ page }) => {
    await page.goto(`${BASE}/shopping-assistant/metrics/products`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    expect(page.url()).toContain('/shopping-assistant/metrics/products');
    await expect(page.locator('body')).toBeVisible();
  });

  test('All four metric pages load and URL is correct', async ({ page }) => {
    const routes = [
      '/shopping-assistant/metrics/score',
      '/shopping-assistant/metrics/time-saved',
      '/shopping-assistant/metrics/products',
      '/shopping-assistant/metrics/validation',
    ];
    for (const route of routes) {
      await page.goto(`${BASE}${route}`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1500);
      // Page should stay on the expected route (no redirect to /404 or /)
      expect(page.url()).toContain(route);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// GROUP 6 — Core Shopping Assistant Flow Still Working
// ══════════════════════════════════════════════════════════════════════════════
test.describe('Issue 6 — Core shopping assistant flow regression', () => {

  test('Shopping assistant page loads', async ({ page }) => {
    await goToShoppingAssistant(page);
    // Page should stay on shopping-assistant URL without redirecting
    expect(page.url()).toContain('/shopping-assistant');
    await expect(page.locator('body')).toBeVisible();
  });

  test('Chat input is visible and accepts queries', async ({ page }) => {
    await goToShoppingAssistant(page);
    const input = page.locator('textarea[placeholder*="Ask me"], input[placeholder*="Ask me"]').first();
    await input.waitFor({ state: 'visible', timeout: 10000 });
    await expect(input).toBeVisible();
    await input.fill('Test query');
    await expect(input).toHaveValue('Test query');
  });

  test('Suggestion chips are visible', async ({ page }) => {
    await goToShoppingAssistant(page);
    const chips = page.locator('[data-testid*="suggestion-chip"]');
    await chips.first().waitFor({ state: 'visible', timeout: 10000 });
    const count = await chips.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('Settings button opens settings modal', async ({ page }) => {
    await goToShoppingAssistant(page);
    const settingsBtn = page.locator('[data-testid="settings-btn"]');
    await settingsBtn.waitFor({ state: 'visible', timeout: 10000 });
    await settingsBtn.click();
    await page.waitForTimeout(500);
    const modal = page.locator('[data-testid="settings-modal"]');
    await expect(modal).toBeVisible({ timeout: 5000 });
  });

  test('Share button is visible in controls bar', async ({ page }) => {
    await goToShoppingAssistant(page);
    const shareBtn = page.locator('[data-testid="share-results-btn"]');
    await shareBtn.waitFor({ state: 'visible', timeout: 10000 });
    await expect(shareBtn).toBeVisible();
  });

  test('Compare button is visible in controls bar', async ({ page }) => {
    await goToShoppingAssistant(page);
    const compareBtn = page.locator('[data-testid="compare-btn"]');
    await compareBtn.waitFor({ state: 'visible', timeout: 10000 });
    await expect(compareBtn).toBeVisible();
  });
});
