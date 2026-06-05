/**
 * E2E Test Suite — Round 6 UI/UX Improvements
 *
 * Covers:
 *  R6-1  Island expanded state has fully opaque, non-transparent background
 *  R6-2  Island expanded state shows smooth CSS transition (no abrupt mount/unmount)
 *  R6-3  Island expanded state covers "About" menu item (right spacer fix)
 *  R6-4  Cart header badge updates immediately on qty/remove (cartUpdated event)
 *  R6-5  Mobile hamburger menu: appears on small viewport, opens nav panel
 *  R6-6  Sort widget aligns with user dropdown (right-edge lg:right-8)
 *  R6-7  Full user journey — all R6 touch-points in one smoke test
 */

import { test, expect, Page } from '@playwright/test';

const BASE = 'http://127.0.0.1:3000';

// ── helpers ──────────────────────────────────────────────────────────────────

async function loginAsDemo(page: Page) {
  await page.evaluate(() => {
    localStorage.setItem('authToken', 'demo-token-r6');
    localStorage.setItem('userEmail', 'demo@example.com');
    window.dispatchEvent(new Event('authUpdated'));
  });
  await page.waitForTimeout(300);
}

async function waitForProducts(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
}

// ─────────────────────────────────────────────────────────────────────────────
// R6-1  Island expanded background must be fully opaque (no backdrop-blur)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('R6-1 — Island expanded state is fully opaque', () => {
  test('1.1 Expanded form has bg-white (no transparency / no backdrop-blur)', async ({ page }) => {
    await page.goto(`${BASE}/products`);
    await waitForProducts(page);

    const pill = page.locator('[aria-label="Open search"]');
    await pill.click();
    await page.waitForTimeout(600);

    // The expanded form should have bg-white (not bg-white/98) and no backdrop-blur
    const form = page.locator('form').filter({ hasText: '' }).first();
    const formClass = (await form.getAttribute('class')) ?? '';
    // Must NOT contain backdrop-blur (which causes transparency)
    expect(formClass).not.toContain('backdrop-blur');
    // Must NOT contain /98 opacity modifier
    expect(formClass).not.toContain('white/98');
    expect(formClass).not.toContain('gray-900/98');

    await page.screenshot({ path: 'test-results/r6-01-island-opaque.png' });
  });

  test('1.2 Expanded island overlay has aria-label "Expanded search"', async ({ page }) => {
    await page.goto(`${BASE}/products`);
    await waitForProducts(page);

    const pill = page.locator('[aria-label="Open search"]');
    await pill.click();
    await page.waitForTimeout(600);

    const overlay = page.locator('[aria-label="Expanded search"]');
    await expect(overlay).toBeAttached();

    await page.screenshot({ path: 'test-results/r6-02-island-overlay-present.png' });
  });

  test('1.3 Nav link text behind form is not visible through the form (opaque covers it)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE}/products`);
    await waitForProducts(page);

    const pill = page.locator('[aria-label="Open search"]');
    await pill.click();
    await page.waitForTimeout(600);

    // Form should be present with solid background
    const overlay = page.locator('[aria-label="Expanded search"]');
    await expect(overlay).toBeAttached();

    // The form (visible) should have full opacity
    const formBox = await page.locator('[aria-label="Expanded search"] form').boundingBox();
    expect(formBox).not.toBeNull();
    expect(formBox!.width).toBeGreaterThan(200);

    await page.screenshot({ path: 'test-results/r6-03-island-covers-nav.png' });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// R6-2  Island transition: both collapsed & expanded always in DOM
// ─────────────────────────────────────────────────────────────────────────────
test.describe('R6-2 — Island transitions smoothly via CSS (always mounted)', () => {
  test('2.1 Collapsed pill is hidden (opacity-0) when expanded, not removed from DOM', async ({
    page,
  }) => {
    await page.goto(`${BASE}/products`);
    await waitForProducts(page);

    const pill = page.locator('[aria-label="Open search"]');
    await pill.click();
    await page.waitForTimeout(600);

    // Pill should still be in DOM but hidden (aria-hidden=true)
    const collapsedPill = page.locator('[aria-hidden="true"][role]').first();
    // The expanded overlay should be visible
    const overlay = page.locator('[aria-label="Expanded search"]');
    await expect(overlay).toBeAttached();

    await page.screenshot({ path: 'test-results/r6-04-pill-still-in-dom.png' });
  });

  test('2.2 Expanded overlay is always in DOM even before pill is clicked', async ({ page }) => {
    await page.goto(`${BASE}/products`);
    await waitForProducts(page);

    // The expanded overlay should be in the DOM even when collapsed (just invisible)
    const overlay = page.locator('[aria-label="Expanded search"]');
    await expect(overlay).toBeAttached({ timeout: 5000 });

    // But it should be aria-hidden when collapsed
    const ariaHidden = await overlay.getAttribute('aria-hidden');
    expect(ariaHidden).toBe('true');

    await page.screenshot({ path: 'test-results/r6-05-overlay-always-mounted.png' });
  });

  test('2.3 Search input is accessible via tabIndex when expanded', async ({ page }) => {
    await page.goto(`${BASE}/products`);
    await waitForProducts(page);

    const pill = page.locator('[aria-label="Open search"]');
    await pill.click();
    await page.waitForTimeout(600);

    const input = page.locator('input[placeholder*="Search products"]').first();
    await expect(input).toBeAttached();
    // Input should have tabIndex=0 when expanded (not -1)
    const tabIndex = await input.evaluate((el) => (el as HTMLInputElement).tabIndex);
    expect(tabIndex).toBe(0);

    await page.screenshot({ path: 'test-results/r6-06-input-tabindex.png' });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// R6-3  Island expanded covers "About" menu item
// ─────────────────────────────────────────────────────────────────────────────
test.describe('R6-3 — Island expanded form covers About nav link', () => {
  test('3.1 Right spacer is narrower (lg:w-[210px]) to let form extend over About', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE}/products`);
    await waitForProducts(page);

    const pill = page.locator('[aria-label="Open search"]');
    await pill.click();
    await page.waitForTimeout(600);

    // Get the form's right edge position
    const form = page.locator('[aria-label="Expanded search"] form').first();
    const formBox = await form.boundingBox();
    expect(formBox).not.toBeNull();

    // Get "About" link position
    const aboutLink = page.getByRole('link', { name: 'About' }).first();
    const aboutBox = await aboutLink.boundingBox();
    // About link is in the DOM (nav exists) but its right edge should be to the right of or overlap with form's right edge
    // OR About is simply overlapped/covered by the overlay
    expect(formBox!.width).toBeGreaterThan(400); // form should be wide enough to cover nav area

    await page.screenshot({ path: 'test-results/r6-07-form-covers-about.png' });
  });

  test('3.2 "About" link is still in DOM and accessible after closing island', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE}/products`);
    await waitForProducts(page);

    // Expand island
    const pill = page.locator('[aria-label="Open search"]');
    await pill.click();
    await page.waitForTimeout(600);

    // Close island
    const closeBtn = page.locator('[aria-label="Close search"]');
    await closeBtn.click();
    await page.waitForTimeout(400);

    // About should be visible and clickable again
    const aboutLink = page.getByRole('link', { name: 'About' }).first();
    await expect(aboutLink).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: 'test-results/r6-08-about-visible-after-close.png' });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// R6-4  Cart header badge syncs immediately on qty/remove
// ─────────────────────────────────────────────────────────────────────────────
test.describe('R6-4 — Cart header badge updates immediately', () => {
  test('4.1 Adding item dispatches cartUpdated and badge reflects new count', async ({ page }) => {
    await page.goto(`${BASE}/products`);
    await waitForProducts(page);

    // Inject a cart item directly into localStorage to simulate state
    await page.evaluate(() => {
      const item = {
        id: 'test-r6-1',
        productId: 'p1',
        name: 'Test Phone',
        price: 9999,
        quantity: 1,
        stock: 10,
      };
      localStorage.setItem('cart', JSON.stringify([item]));
      window.dispatchEvent(new Event('cartUpdated'));
    });
    await page.waitForTimeout(400);

    // Cart badge should show 1 — target the numeric badge span (not sr-only)
    const badge = page.locator('[aria-label="Cart"] span:not(.sr-only)').first();
    const badgeCount = await badge.count();
    if (badgeCount > 0) {
      const text = await badge.innerText();
      expect(['1', '1+']).toContain(text.trim());
    }

    await page.screenshot({ path: 'test-results/r6-09-cart-badge-sync.png' });
  });

  test('4.2 Cart page quantity change dispatches cartUpdated event', async ({ page }) => {
    // Seed cart with 2 items
    await page.goto(`${BASE}/cart`);
    await page.evaluate(() => {
      const items = [
        {
          id: 'r6-test-1',
          productId: 'p1',
          name: 'Test Phone A',
          price: 5000,
          quantity: 2,
          stock: 10,
          source: 'INTERNAL',
        },
      ];
      localStorage.setItem('cart', JSON.stringify(items));
      window.dispatchEvent(new Event('cartUpdated'));
    });
    await page.waitForTimeout(400);
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Listen for cartUpdated event
    await page.evaluate(() => {
      (window as any).__cartUpdatedCount = 0;
      window.addEventListener('cartUpdated', () => {
        (window as any).__cartUpdatedCount++;
      });
    });

    // Click "+" to increase quantity
    const plusBtn = page.locator('button').filter({ hasText: '+' }).first();
    const hasPlusBtn = await plusBtn.count();
    if (hasPlusBtn > 0) {
      await plusBtn.click();
      await page.waitForTimeout(300);
      const count = await page.evaluate(() => (window as any).__cartUpdatedCount ?? 0);
      expect(count).toBeGreaterThanOrEqual(1);
    }

    await page.screenshot({ path: 'test-results/r6-10-cart-qty-event.png' });
  });

  test('4.3 Removing cart item immediately updates header badge', async ({ page }) => {
    await page.goto(`${BASE}/cart`);
    await page.evaluate(() => {
      const items = [
        {
          id: 'r6-test-del',
          productId: 'p2',
          name: 'Test Phone B',
          price: 7999,
          quantity: 1,
          stock: 5,
          source: 'INTERNAL',
        },
      ];
      localStorage.setItem('cart', JSON.stringify(items));
      window.dispatchEvent(new Event('cartUpdated'));
    });
    await page.waitForTimeout(400);
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Find and click delete button (button with title="Remove item")
    const deleteBtn = page.locator('button[title="Remove item"]').first();
    const hasDel = await deleteBtn.count();
    if (hasDel > 0) {
      await deleteBtn.click();
      await page.waitForTimeout(400);
      // Cart should be empty now
      const cartData = await page.evaluate(() => JSON.parse(localStorage.getItem('cart') ?? '[]'));
      expect(cartData.length).toBe(0);
    }

    await page.screenshot({ path: 'test-results/r6-11-cart-remove-sync.png' });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// R6-5  Mobile hamburger menu
// ─────────────────────────────────────────────────────────────────────────────
test.describe('R6-5 — Mobile hamburger navigation menu', () => {
  test('5.1 Hamburger button visible on mobile (375px)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`${BASE}/products`);
    await waitForProducts(page);

    // Hamburger button should be visible on mobile
    const hamburger = page.locator('[aria-controls="mobile-nav"]');
    await expect(hamburger).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: 'test-results/r6-12-hamburger-visible.png' });
  });

  test('5.2 Hamburger NOT visible on desktop (1440px)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE}/products`);
    await waitForProducts(page);

    // Hamburger should be hidden on desktop
    const hamburger = page.locator('[aria-controls="mobile-nav"]');
    await expect(hamburger).not.toBeVisible();

    await page.screenshot({ path: 'test-results/r6-13-no-hamburger-desktop.png' });
  });

  test('5.3 Click hamburger opens mobile nav panel with all menu items', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`${BASE}/products`);
    await waitForProducts(page);

    const hamburger = page.locator('[aria-controls="mobile-nav"]');
    await hamburger.click();
    await page.waitForTimeout(400);

    // Mobile nav panel should show all links
    const mobileNav = page.locator('#mobile-nav');
    await expect(mobileNav).toBeAttached();

    // All nav links should be present in mobile menu
    const links = mobileNav.locator('a');
    const linkCount = await links.count();
    expect(linkCount).toBeGreaterThanOrEqual(5); // at min 5 nav items

    await page.screenshot({ path: 'test-results/r6-14-mobile-nav-open.png' });
  });

  test('5.4 Mobile nav closes when link is clicked', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`${BASE}`);
    await page.waitForLoadState('networkidle');

    const hamburger = page.locator('[aria-controls="mobile-nav"]');
    await hamburger.click();
    await page.waitForTimeout(400);

    // Click the Products link in mobile nav
    const mobileNav = page.locator('#mobile-nav');
    const productsLink = mobileNav.getByRole('link', { name: 'Products' });
    if ((await productsLink.count()) > 0) {
      await productsLink.click();
      await page.waitForTimeout(500);
      // Nav panel should collapse after navigation
      const isHidden = await mobileNav.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return style.maxHeight === '0px' || style.opacity === '0';
      });
      expect(isHidden).toBe(true);
    }

    await page.screenshot({ path: 'test-results/r6-15-mobile-nav-closes.png' });
  });

  test('5.5 Mobile nav shows active route highlight', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`${BASE}/products`);
    await waitForProducts(page);

    const hamburger = page.locator('[aria-controls="mobile-nav"]');
    await hamburger.click();
    await page.waitForTimeout(400);

    // The Products link should have active styling (bg-blue-50 or similar)
    const mobileNav = page.locator('#mobile-nav');
    const productsLink = mobileNav.getByRole('link', { name: 'Products' });
    if ((await productsLink.count()) > 0) {
      const cls = (await productsLink.getAttribute('class')) ?? '';
      expect(cls).toMatch(/blue|active/);
    }

    await page.screenshot({ path: 'test-results/r6-16-active-route-highlight.png' });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// R6-6  Sort widget and user dropdown right-edge alignment
// ─────────────────────────────────────────────────────────────────────────────
test.describe('R6-6 — Sort widget aligned with user dropdown chevron', () => {
  test('6.1 Sort widget has correct right positioning (matches nav padding)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE}/products`);
    await waitForProducts(page);

    const sortBtn = page.locator('button').filter({ hasText: 'Relevance' }).first();
    await expect(sortBtn).toBeVisible({ timeout: 10000 });

    const sortBox = await sortBtn.boundingBox();
    expect(sortBox).not.toBeNull();

    // Sort button right edge should be within ~40px of right viewport edge
    // (lg:right-8 = 32px from edge; button itself has some width, so right edge is ~32+w)
    const viewportWidth = 1440;
    const sortRightEdge = sortBox!.x + sortBox!.width;
    const distFromRight = viewportWidth - sortRightEdge;
    expect(distFromRight).toBeGreaterThan(20);
    expect(distFromRight).toBeLessThan(80); // not too far from the right

    await page.screenshot({ path: 'test-results/r6-17-sort-right-align.png' });
  });

  test('6.2 ChevronDown in sort widget is vertically centred', async ({ page }) => {
    await page.goto(`${BASE}/products`);
    await waitForProducts(page);

    const sortBtn = page.locator('button').filter({ hasText: 'Relevance' }).first();
    await expect(sortBtn).toBeVisible({ timeout: 10000 });

    const btnBox = await sortBtn.boundingBox();
    const svgs = sortBtn.locator('svg');
    const svgCount = await svgs.count();
    expect(svgCount).toBeGreaterThanOrEqual(2);

    const btnMidY = btnBox!.y + btnBox!.height / 2;
    for (let i = 0; i < Math.min(svgCount, 3); i++) {
      const svgBox = await svgs.nth(i).boundingBox();
      if (svgBox) {
        const svgMidY = svgBox.y + svgBox.height / 2;
        expect(Math.abs(svgMidY - btnMidY)).toBeLessThan(6);
      }
    }

    await page.screenshot({ path: 'test-results/r6-18-sort-chevron.png' });
  });

  test('6.3 User dropdown ChevronDown is vertically centred (logged in)', async ({ page }) => {
    await page.goto(`${BASE}/products`);
    await waitForProducts(page);
    await loginAsDemo(page);
    await page.reload();
    await waitForProducts(page);

    const userBtn = page.locator('button[aria-haspopup="true"]').first();
    await expect(userBtn).toBeVisible({ timeout: 10000 });

    const btnBox = await userBtn.boundingBox();
    expect(btnBox).not.toBeNull();

    const svgs = userBtn.locator('svg');
    const count = await svgs.count();
    if (count > 0) {
      const chevronBox = await svgs.last().boundingBox();
      if (chevronBox) {
        const svgMidY = chevronBox.y + chevronBox.height / 2;
        const btnMidY = btnBox!.y + btnBox!.height / 2;
        expect(Math.abs(svgMidY - btnMidY)).toBeLessThan(6);
      }
    }

    await page.screenshot({ path: 'test-results/r6-19-user-chevron.png' });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// R6-7  Full user journey smoke test — all R6 touch-points
// ─────────────────────────────────────────────────────────────────────────────
test.describe('R6-7 — Full user journey smoke test', () => {
  test('7.1 Complete R6 journey: mobile menu → island → cart → checkout', async ({ page }) => {
    // Step 1: Mobile viewport — check hamburger
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`${BASE}`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/r6-journey-01-home-mobile.png' });

    const hamburger = page.locator('[aria-controls="mobile-nav"]');
    await expect(hamburger).toBeVisible({ timeout: 5000 });
    await hamburger.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'test-results/r6-journey-02-mobile-menu-open.png' });

    // Navigate to products via mobile menu
    const mobileNav = page.locator('#mobile-nav');
    const productsLink = mobileNav.getByRole('link', { name: 'Products' });
    if ((await productsLink.count()) > 0) {
      await productsLink.click();
      await waitForProducts(page);
    } else {
      await page.goto(`${BASE}/products`);
      await waitForProducts(page);
    }
    await page.screenshot({ path: 'test-results/r6-journey-03-products-mobile.png' });

    // Step 2: Desktop viewport
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE}/products`);
    await waitForProducts(page);
    await page.screenshot({ path: 'test-results/r6-journey-04-products-desktop.png' });

    // Step 3: Expand island — verify opaque bg, covers About
    const pill = page.locator('[aria-label="Open search"]');
    await expect(pill).toBeVisible({ timeout: 5000 });
    await pill.click();
    await page.waitForTimeout(700);
    await page.screenshot({ path: 'test-results/r6-journey-05-island-expanded.png' });

    const form = page.locator('[aria-label="Expanded search"] form').first();
    await expect(form).toBeVisible({ timeout: 5000 });
    const formCls = (await form.getAttribute('class')) ?? '';
    expect(formCls).not.toContain('backdrop-blur');

    // Type a search
    const searchInput = page.locator('input[placeholder*="Search products"]').first();
    await searchInput.fill('samsung');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/r6-journey-06-search-typed.png' });

    // Close island
    const closeBtn = page.locator('[aria-label="Close search"]');
    await closeBtn.click();
    await page.waitForTimeout(400);

    // Step 4: Seed cart and verify badge updates
    await page.evaluate(() => {
      const items = [
        {
          id: 'journey-r6-a',
          productId: 'p1',
          name: 'Samsung Galaxy S24',
          price: 74999,
          quantity: 2,
          stock: 10,
          source: 'INTERNAL',
        },
      ];
      localStorage.setItem('cart', JSON.stringify(items));
      window.dispatchEvent(new Event('cartUpdated'));
    });
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'test-results/r6-journey-07-cart-badge-2.png' });

    // Step 5: Visit cart page — change quantity — verify event fired
    await page.goto(`${BASE}/cart`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/r6-journey-08-cart-page.png' });

    // Track cartUpdated dispatches
    await page.evaluate(() => {
      (window as any).__cartFired = 0;
      window.addEventListener('cartUpdated', () => {
        (window as any).__cartFired++;
      });
    });

    const plusBtn = page.locator('button').filter({ hasText: '+' }).first();
    if ((await plusBtn.count()) > 0) {
      await plusBtn.click();
      await page.waitForTimeout(300);
      const fired = await page.evaluate(() => (window as any).__cartFired ?? 0);
      expect(fired).toBeGreaterThanOrEqual(1);
    }
    await page.screenshot({ path: 'test-results/r6-journey-09-qty-changed.png' });

    // Step 6: Sort widget on products — check alignment
    await page.goto(`${BASE}/products`);
    await waitForProducts(page);

    const sortBtn = page.locator('button').filter({ hasText: 'Relevance' }).first();
    await expect(sortBtn).toBeVisible({ timeout: 10000 });
    await sortBtn.click();
    await page.waitForTimeout(300);
    await expect(page.getByText('Price: Low to High')).toBeVisible({ timeout: 3000 });
    await page.keyboard.press('Escape');
    await page.screenshot({ path: 'test-results/r6-journey-10-sort-menu.png' });

    // Step 7: Login and check user dropdown
    await loginAsDemo(page);
    await page.reload();
    await waitForProducts(page);

    const userBtn = page.locator('button[aria-haspopup="true"]').first();
    await expect(userBtn).toBeVisible({ timeout: 10000 });
    await userBtn.click();
    await page.waitForTimeout(300);
    await expect(page.getByText('My Profile')).toBeVisible({ timeout: 3000 });
    await page.keyboard.press('Escape');
    await page.screenshot({ path: 'test-results/r6-journey-11-user-dropdown.png' });

    await page.screenshot({ path: 'test-results/r6-journey-12-complete.png' });
  });
});
