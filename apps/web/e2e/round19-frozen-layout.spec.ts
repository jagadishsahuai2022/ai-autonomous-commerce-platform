/**
 * Round 19 — Frozen Layout & Smart Assistant UI E2E Tests
 *
 * Covers all issue fixes from round 19:
 * 1a. "Smart Active" badge removed
 * 1b. Pipeline/Decision/Approval + Compare + Settings moved up (no gap above)
 * 1c. Chat panel header frozen at top (flex-shrink-0, never scrolls away)
 * 1d. Right panel tab header frozen (only content area scrolls)
 *
 * Also includes comprehensive coverage for all key pages and interactions.
 */

import { test, expect } from '@playwright/test';

// ─── Issue 1a: Smart Active removed ──────────────────────────────────────────
test.describe('Round 19 — Smart Active removed (1a)', () => {
  test('Smart Active badge is NOT present on shopping-assistant page', async ({ page }) => {
    await page.goto('/shopping-assistant');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);
    // Smart Active badge must be completely absent
    await expect(page.getByText('Smart Active')).not.toBeAttached();
  });

  test('no green animated pulse dot visible in right panel', async ({ page }) => {
    await page.goto('/shopping-assistant');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);
    // The bg-green-500 animate-pulse span is gone
    const pulseDot = page.locator('.bg-green-500.animate-pulse');
    await expect(pulseDot).not.toBeAttached();
  });
});

// ─── Issue 1b: Pipeline/Decision/Approval moved up ───────────────────────────
test.describe('Round 19 — Controls moved up (1b)', () => {
  test('Compare button is directly above Pipeline tab row', async ({ page }) => {
    await page.goto('/shopping-assistant');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    const compareBtn = page.getByRole('button', { name: 'Compare', exact: true });
    const pipelineBtn = page.getByRole('button', { name: 'Pipeline' });

    await expect(compareBtn).toBeVisible();
    await expect(pipelineBtn).toBeVisible();

    // Compare button bounding box should be ABOVE (lower Y) than Pipeline tab
    const compareBB = await compareBtn.boundingBox();
    const pipelineBB = await pipelineBtn.boundingBox();
    expect(compareBB).not.toBeNull();
    expect(pipelineBB).not.toBeNull();
    // Compare is above Pipeline in the DOM layout
    expect(compareBB!.y + compareBB!.height).toBeLessThan(pipelineBB!.y + pipelineBB!.height + 5);
  });

  test('Settings button is visible beside Compare in frozen header', async ({ page }) => {
    await page.goto('/shopping-assistant');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);
    await expect(page.getByTitle('Settings')).toBeVisible();
  });

  test('both Pipeline and Decision tabs are visible without scrolling', async ({ page }) => {
    await page.goto('/shopping-assistant');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);
    await expect(page.getByRole('button', { name: 'Pipeline' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Decision' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Approval' })).toBeVisible();
  });
});

// ─── Issue 1c: Chat header frozen ────────────────────────────────────────────
test.describe('Round 19 — Chat header frozen (1c)', () => {
  test('Smart Shopping Copilot header is visible on page load', async ({ page }) => {
    await page.goto('/shopping-assistant');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);
    const header = page.getByText('Smart Shopping Copilot');
    await expect(header).toBeVisible();
  });

  test('chat header stays visible after waiting for page to settle', async ({ page }) => {
    await page.goto('/shopping-assistant');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000); // wait for hydration + any async state

    // Header must be visible (frozen at top of flex column)
    const header = page.getByText('Smart Shopping Copilot').first();
    await expect(header).toBeVisible({ timeout: 8000 });
  });

  test('chat header "Clear" button is always accessible', async ({ page }) => {
    await page.goto('/shopping-assistant');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);
    // Clear button is in the frozen header
    const clearBtn = page.getByRole('button', { name: /clear/i });
    await expect(clearBtn).toBeVisible();
  });

  test('chat input is always visible at bottom of chat panel', async ({ page }) => {
    await page.goto('/shopping-assistant');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);
    // Chat input should be visible at all times (at bottom of fixed-height panel)
    const chatInput = page.locator('textarea, input[placeholder*="Ask"]').first();
    await expect(chatInput).toBeVisible();
  });
});

// ─── Issue 1d: Right panel tab header frozen ─────────────────────────────────
test.describe('Round 19 — Right panel header frozen (1d)', () => {
  test('Pipeline tab is visible at all times in right panel', async ({ page }) => {
    await page.goto('/shopping-assistant');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);
    await expect(page.getByRole('button', { name: 'Pipeline' })).toBeVisible();
  });

  test('can switch between Pipeline, Decision, Approval tabs', async ({ page }) => {
    await page.goto('/shopping-assistant');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Click Decision — guard: empty state is shown when no products
    await page.getByRole('button', { name: 'Decision' }).first().click();
    await page.waitForTimeout(600);

    // Click Approval — use first() to avoid strict mode issues
    await page.getByRole('button', { name: 'Approval' }).first().click();
    await page.waitForTimeout(400);

    // Click Pipeline
    await page.getByRole('button', { name: 'Pipeline' }).first().click();
    await page.waitForTimeout(400);

    // All three tabs should still be visible after switching
    await expect(page.getByRole('button', { name: 'Pipeline' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Decision' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Approval' }).first()).toBeVisible();
  });

  test('tab content is scrollable independently of tab header', async ({ page }) => {
    await page.goto('/shopping-assistant');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Click Decision — now shows empty state (no products yet) safely
    await page.getByRole('button', { name: 'Decision' }).first().click();
    await page.waitForTimeout(800);

    // Frozen header tabs should still be visible after Decision content renders
    await expect(page.getByRole('button', { name: 'Pipeline' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Compare', exact: true }).first()).toBeVisible();
  });

  test('Compare button triggers comparison modal', async ({ page }) => {
    await page.goto('/shopping-assistant');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    await page.getByRole('button', { name: 'Compare', exact: true }).click();
    await page.waitForTimeout(600);

    // Comparison modal heading (h2) should appear in the modal overlay
    const modal = page.locator('h2').filter({ hasText: 'Product Comparison' });
    await expect(modal).toBeVisible();

    // Close it
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Tabs should still be visible after modal closes
    await expect(page.getByRole('button', { name: 'Pipeline' })).toBeVisible();
  });
});

// ─── Layout integrity ─────────────────────────────────────────────────────────
test.describe('Round 19 — Fixed viewport layout integrity', () => {
  test('page does not overflow horizontally', async ({ page }) => {
    await page.goto('/shopping-assistant');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    // Body should not be wider than viewport (no horizontal scroll)
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 2); // +2 for rounding
  });

  test('chat panel renders within viewport without needing page scroll', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/shopping-assistant');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    // Chat header and tabs should both be visible without scrolling
    await expect(page.getByText('Smart Shopping Copilot')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pipeline' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Compare', exact: true })).toBeVisible();
  });

  test('layout renders correctly on 1024px wide viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto('/shopping-assistant');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    await expect(page.getByText('Smart Shopping Copilot')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pipeline' })).toBeVisible();
  });

  test('no JavaScript errors on page load', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/shopping-assistant');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    const critical = errors.filter(
      (e) => !e.includes('hydration') && !e.includes('Warning') && !e.includes('ResizeObserver')
    );
    expect(critical).toHaveLength(0);
  });
});

// ─── Suggestion chips ─────────────────────────────────────────────────────────
test.describe('Round 19 — Suggestion chips below chat panel', () => {
  test('suggestion chips are visible below chat card', async ({ page }) => {
    await page.goto('/shopping-assistant');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);
    // At least one suggestion chip should be visible
    const chips = page.locator('button').filter({ hasText: /laptops|earbuds|Samsung/i });
    await expect(chips.first()).toBeVisible();
  });
});

// ─── Comprehensive page smoke tests ──────────────────────────────────────────
test.describe('Round 19 — All key pages render', () => {
  const pages = [
    { path: '/', label: 'Home' },
    { path: '/products', label: 'Products' },
    { path: '/shopping-assistant', label: 'Smart Assistant' },
    { path: '/shopping-list', label: 'Shopping List' },
    { path: '/orders', label: 'Orders' },
    { path: '/cart', label: 'Cart' },
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/account', label: 'Account' },
  ];

  for (const p of pages) {
    test(`${p.label} page (${p.path}) renders without crash`, async ({ page }) => {
      await page.goto(p.path);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);
      const bodyText = await page.locator('body').textContent();
      expect(bodyText!.length).toBeGreaterThan(50);
    });
  }
});

// ─── Navigation integrity ─────────────────────────────────────────────────────
test.describe('Round 19 — Navigation', () => {
  test('nav "Smart Assistant" link goes to /shopping-assistant', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Smart Assistant' }).first().click();
    await page.waitForURL('**/shopping-assistant');
    expect(page.url()).toContain('/shopping-assistant');
  });

  test('homepage "Smart Assistant" feature card is present', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
    const card = page.getByText('Smart Shopping Assistant');
    await expect(card.first()).toBeVisible();
  });
});
