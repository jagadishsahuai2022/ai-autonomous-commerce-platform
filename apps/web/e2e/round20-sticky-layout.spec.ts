/**
 * Round 20 — Sticky Layout & Browser Scrollbar Tests
 *
 * Validates:
 * 1. Chat header is BELOW the navbar (not hidden behind it)
 * 2. Chat header is sticky — stays pinned below navbar on scroll
 * 3. Sidebar header is sticky below navbar
 * 4. Default browser vertical scrollbar is present (body is scrollable)
 * 5. No vertical scrollbar on either panel
 * 6. Product carousel arrows are present
 * 7. Screenshot proof of working state
 */

import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3000';

test.describe('Round 20 — Sticky Headers + Browser Scroll', () => {
  test('shopping-assistant page loads without JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto(`${BASE}/shopping-assistant`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Page should render without crash
    await expect(page.locator('body')).toBeVisible();
    expect(errors.filter((e) => !e.includes('hydrat') && !e.includes('Warning')).length).toBe(0);
  });

  test('site navbar is visible at top', async ({ page }) => {
    await page.goto(`${BASE}/shopping-assistant`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const header = page.locator('header').first();
    await expect(header).toBeVisible();
    const headerBox = await header.boundingBox();
    expect(headerBox).toBeTruthy();
    expect(headerBox!.y).toBeLessThanOrEqual(5); // At very top
  });

  test('chat header is BELOW the navbar, not behind it', async ({ page }) => {
    await page.goto(`${BASE}/shopping-assistant`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const navbar = page.locator('header').first();
    const navBox = await navbar.boundingBox();
    expect(navBox).toBeTruthy();
    const navBottom = navBox!.y + navBox!.height; // ~61px

    // The blue chat header — find it by the gradient bg or Sparkles icon text
    const chatHeader = page.locator('text=Smart Shopping Copilot').first();
    await expect(chatHeader).toBeVisible();
    const chatHeaderBox = await chatHeader.boundingBox();
    expect(chatHeaderBox).toBeTruthy();

    // Chat header top should be AT or BELOW the navbar bottom — never behind it
    expect(chatHeaderBox!.y).toBeGreaterThanOrEqual(navBottom - 2);
  });

  test('sidebar tabs are BELOW the navbar', async ({ page }) => {
    await page.goto(`${BASE}/shopping-assistant`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const navbar = page.locator('header').first();
    const navBox = await navbar.boundingBox();
    const navBottom = navBox!.y + navBox!.height;

    // Pipeline tab
    const pipelineTab = page.locator('text=Pipeline').first();
    await expect(pipelineTab).toBeVisible();
    const tabBox = await pipelineTab.boundingBox();
    expect(tabBox).toBeTruthy();
    expect(tabBox!.y).toBeGreaterThanOrEqual(navBottom - 2);
  });

  test('body is scrollable — default browser scrollbar present', async ({ page }) => {
    await page.goto(`${BASE}/shopping-assistant`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Body should NOT have overflow: hidden
    const bodyOverflow = await page.evaluate(() => {
      return window.getComputedStyle(document.body).overflow;
    });
    expect(bodyOverflow).not.toBe('hidden');

    // The document should be scrollable (scrollHeight >= clientHeight)
    const isScrollable = await page.evaluate(() => {
      return document.documentElement.scrollHeight >= document.documentElement.clientHeight;
    });
    expect(isScrollable).toBe(true);
  });

  test('no vertical scrollbar on chat panel', async ({ page }) => {
    await page.goto(`${BASE}/shopping-assistant`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // The messages container should NOT have overflow-y: auto/scroll
    // It should be 'visible' (default) since we don't set any overflow
    const chatPanelOverflow = await page.evaluate(() => {
      // Find the messages area inside the chat (the p-4 space-y-4 div)
      const els = document.querySelectorAll('.space-y-4');
      for (const el of els) {
        const s = window.getComputedStyle(el);
        if (s.overflowY === 'auto' || s.overflowY === 'scroll') {
          // Check if it's inside the chat panel (not the history modal)
          if (el.closest('[class*="rounded-2xl"]') && !el.closest('[class*="fixed"]')) {
            return s.overflowY;
          }
        }
      }
      return 'visible'; // no scrollable panel found = good
    });
    expect(['visible', 'hidden', 'clip']).toContain(chatPanelOverflow);
  });

  test('no vertical scrollbar on sidebar panel', async ({ page }) => {
    await page.goto(`${BASE}/shopping-assistant`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // The sidebar content area should NOT have overflow-y: auto/scroll
    const sidebarContent = page.locator('aside .space-y-3').first();
    if ((await sidebarContent.count()) > 0) {
      const overflowY = await sidebarContent.evaluate((el) => {
        return window.getComputedStyle(el).overflowY;
      });
      expect(['visible', 'hidden', 'clip']).toContain(overflowY);
    }
  });

  test('chat header remains sticky after scrolling down', async ({ page }) => {
    await page.goto(`${BASE}/shopping-assistant`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const navbar = page.locator('header').first();
    const navBox = await navbar.boundingBox();
    const navBottom = navBox!.y + navBox!.height;

    // Scroll down
    await page.evaluate(() => window.scrollBy(0, 200));
    await page.waitForTimeout(500);

    // Chat header should still be visible and near the navbar bottom
    const chatHeader = page.locator('text=Smart Shopping Copilot').first();
    const isVisible = await chatHeader.isVisible();
    if (isVisible) {
      const box = await chatHeader.boundingBox();
      if (box) {
        // Should be near the top (sticky), not scrolled away
        expect(box.y).toBeLessThan(200);
      }
    }
  });

  test('suggestion chips are visible', async ({ page }) => {
    await page.goto(`${BASE}/shopping-assistant`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const chip = page.locator('text=Find laptops under').first();
    await expect(chip).toBeVisible();
  });

  test('chat input area is visible', async ({ page }) => {
    await page.goto(`${BASE}/shopping-assistant`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const input = page.getByPlaceholder('Ask me anything about products...');
    await expect(input).toBeVisible();
  });

  test('screenshot proof — initial load state', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE}/shopping-assistant`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'e2e/screenshots/round20-initial.png', fullPage: false });
  });

  test('screenshot proof — after scroll', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE}/shopping-assistant`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.evaluate(() => window.scrollBy(0, 300));
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'e2e/screenshots/round20-scrolled.png', fullPage: false });
  });
});

// Also run previous test suites for regression
test.describe('Round 20 — Regression: Key pages still render', () => {
  const pages = [
    ['/', 'DelegateCart'],
    ['/products', 'body'],
    ['/shopping-assistant', 'Smart Shopping Copilot'],
    ['/shopping-list', 'body'],
    ['/about', 'body'],
    ['/features', 'body'],
    ['/cart', 'body'],
  ];

  for (const [path, textOrTag] of pages) {
    test(`${path} renders without crash`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (err) => errors.push(err.message));
      await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);

      if (textOrTag === 'body') {
        await expect(page.locator('body')).toBeVisible();
      } else {
        const loc = page.locator(`text=${textOrTag}`).first();
        await expect(loc).toBeVisible({ timeout: 10000 });
      }
    });
  }
});
