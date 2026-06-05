import { test, expect } from '@playwright/test';

test.describe('Sphere Navigation & Hydration - Round 62 Comprehensive Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Start with clear state
    await page.context().clearCookies();
    await page.evaluate(() => {
      sessionStorage.clear();
      localStorage.clear();
    });
  });

  test('TC-S1: Sphere displays on initial /products page load', async ({ page }) => {
    await page.goto('http://localhost:3010/products');
    await page.waitForLoadState('networkidle');

    // Check sphere container exists
    const sphereContainer = page.locator('[data-testid="sphere-container"]');
    await expect(sphereContainer).toBeVisible({ timeout: 5000 });

    // Verify sphere canvas is rendered
    const canvas = sphereContainer.locator('canvas');
    await expect(canvas).toBeVisible();

    // Verify discovery items visible
    const discoveryItems = page.locator('[data-testid="discovery-item"]');
    const count = await discoveryItems.count();
    expect(count).toBeGreaterThan(0);
  });

  test('TC-S2: Sphere expands when page loads with initialExpanded=true', async ({ page }) => {
    await page.goto('http://localhost:3010/products');
    await page.waitForLoadState('networkidle');

    const sphereContainer = page.locator('[data-testid="sphere-container"]');
    await expect(sphereContainer).toBeVisible({ timeout: 5000 });

    // Check expansion state
    const expandedClass = await sphereContainer.evaluate((el) => {
      return el.classList.contains('sphere-expanded');
    });
    expect(expandedClass).toBe(true);
  });

  test('TC-S3: User can collapse/dock sphere using UI button', async ({ page }) => {
    await page.goto('http://localhost:3010/products');
    await page.waitForLoadState('networkidle');

    const dockButton = page.locator('[data-testid="sphere-dock-button"]');
    await expect(dockButton).toBeVisible({ timeout: 5000 });

    // Click dock button
    await dockButton.click();
    await page.waitForTimeout(600); // Wait for animation

    // Verify animation & docked state
    const sphereContainer = page.locator('[data-testid="sphere-container"]');
    const dockedClass = await sphereContainer.evaluate((el) => {
      return el.classList.contains('sphere-docked');
    });
    expect(dockedClass).toBe(true);
  });

  test('TC-S4: User can expand docked sphere using UI button', async ({ page }) => {
    await page.goto('http://localhost:3010/products');
    await page.waitForLoadState('networkidle');

    // Dock the sphere
    const dockButton = page.locator('[data-testid="sphere-dock-button"]');
    await dockButton.click();
    await page.waitForTimeout(600);

    // Now expand it
    const expandButton = page.locator('[data-testid="sphere-expand-button"]');
    await expandButton.click();
    await page.waitForTimeout(600);

    // Verify expanded state
    const sphereContainer = page.locator('[data-testid="sphere-container"]');
    const expandedClass = await sphereContainer.evaluate((el) => {
      return el.classList.contains('sphere-expanded');
    });
    expect(expandedClass).toBe(true);
  });

  test('TC-S5: CRITICAL - Sphere persists after navigating away and returning', async ({ page }) => {
    // Step 1: Load products and expand sphere
    await page.goto('http://localhost:3010/products');
    await page.waitForLoadState('networkidle');

    const sphereContainer = page.locator('[data-testid="sphere-container"]');
    await expect(sphereContainer).toBeVisible({ timeout: 5000 });

    // Store initial sphere state
    const initialExpanded = await sphereContainer.evaluate((el) => {
      return el.classList.contains('sphere-expanded');
    });
    expect(initialExpanded).toBe(true);

    // Step 2: Navigate away to different page
    await page.goto('http://localhost:3010/shopping-assistant');
    await page.waitForLoadState('networkidle');

    // Sphere should not be visible on other pages
    await expect(sphereContainer).not.toBeVisible();

    // Step 3: Return to /products
    await page.goto('http://localhost:3010/products');
    await page.waitForLoadState('networkidle');

    // Step 4: Verify sphere is still expanded (KEY TEST)
    await expect(sphereContainer).toBeVisible({ timeout: 5000 });
    const finalExpanded = await sphereContainer.evaluate((el) => {
      return el.classList.contains('sphere-expanded');
    });
    expect(finalExpanded).toBe(true);
  });

  test('TC-S6: Sphere maintains docked state after navigation', async ({ page }) => {
    // Step 1: Load products and dock sphere
    await page.goto('http://localhost:3010/products');
    await page.waitForLoadState('networkidle');

    const sphereContainer = page.locator('[data-testid="sphere-container"]');
    const dockButton = page.locator('[data-testid="sphere-dock-button"]');
    
    await dockButton.click();
    await page.waitForTimeout(600);

    // Step 2: Navigate away
    await page.goto('http://localhost:3010/wallet');
    await page.waitForLoadState('networkidle');

    // Step 3: Return to /products
    await page.goto('http://localhost:3010/products');
    await page.waitForLoadState('networkidle');

    // Step 4: Verify docked state persisted (KEY TEST)
    await expect(sphereContainer).toBeVisible({ timeout: 5000 });
    const dockedClass = await sphereContainer.evaluate((el) => {
      return el.classList.contains('sphere-docked');
    });
    expect(dockedClass).toBe(true);
  });

  test('TC-S7: Category selection persists across navigations', async ({ page }) => {
    await page.goto('http://localhost:3010/products');
    await page.waitForLoadState('networkidle');

    // Select a category from sphere
    const firstCategory = page.locator('[data-testid="sphere-category-item"]').first();
    const categoryName = await firstCategory.getAttribute('data-category-id');
    
    await firstCategory.click();
    await page.waitForTimeout(300);

    // Navigate away
    await page.goto('http://localhost:3010/shopping-assistant');
    await page.waitForLoadState('networkidle');

    // Return to /products
    await page.goto('http://localhost:3010/products');
    await page.waitForLoadState('networkidle');

    // Verify category is still selected
    const selectedCategory = page.locator('[data-testid="sphere-category-item"][data-selected="true"]');
    const selectedId = await selectedCategory.getAttribute('data-category-id');
    expect(selectedId).toBe(categoryName);
  });

  test('TC-S8: Rapid navigation does not break sphere state', async ({ page }) => {
    await page.goto('http://localhost:3010/products');
    await page.waitForLoadState('networkidle');

    // Rapidly navigate between pages
    for (let i = 0; i < 3; i++) {
      await page.goto('http://localhost:3010/wallet');
      await page.goto('http://localhost:3010/products');
    }
    await page.waitForLoadState('networkidle');

    // Verify sphere still works
    const sphereContainer = page.locator('[data-testid="sphere-container"]');
    await expect(sphereContainer).toBeVisible({ timeout: 5000 });

    const canvas = sphereContainer.locator('canvas');
    await expect(canvas).toBeVisible();
  });

  test('TC-S9: Filter changes trigger API call and update products', async ({ page }) => {
    await page.goto('http://localhost:3010/products');
    await page.waitForLoadState('networkidle');

    // Monitor network requests
    let apiCallMade = false;
    page.on('response', (response) => {
      if (response.url().includes('/api/') && response.status() === 200) {
        apiCallMade = true;
      }
    });

    // Click a category to filter
    const firstCategory = page.locator('[data-testid="sphere-category-item"]').first();
    await firstCategory.click();
    await page.waitForTimeout(1000);

    // Verify API was called
    expect(apiCallMade).toBe(true);

    // Verify products updated
    const productCards = page.locator('[data-testid="product-card"]');
    const count = await productCards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('TC-S10: Sphere renders correctly on session resume', async ({ browser }) => {
    // Create a new context (simulating new session)
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('http://localhost:3010/products');
    await page.waitForLoadState('networkidle');

    // Setup state
    const sphereContainer = page.locator('[data-testid="sphere-container"]');
    const dockButton = page.locator('[data-testid="sphere-dock-button"]');
    
    await dockButton.click();
    await page.waitForTimeout(600);

    // Store session state
    const sessionState = await page.evaluate(() => {
      return sessionStorage.getItem('sphere-state');
    });
    expect(sessionState).toBeTruthy();

    // Create new page in same context (simulating session persistence)
    const page2 = await context.newPage();
    await page2.goto('http://localhost:3010/products');
    await page2.waitForLoadState('networkidle');

    // Verify state persisted
    const sphereContainer2 = page2.locator('[data-testid="sphere-container"]');
    const dockedClass = await sphereContainer2.evaluate((el) => {
      return el.classList.contains('sphere-docked');
    });
    expect(dockedClass).toBe(true);

    await context.close();
  });

  test('TC-S11: Mobile responsiveness - sphere adapts on small screen', async ({ page }) => {
    // Simulate mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('http://localhost:3010/products');
    await page.waitForLoadState('networkidle');

    const sphereContainer = page.locator('[data-testid="sphere-container"]');
    await expect(sphereContainer).toBeVisible({ timeout: 5000 });

    // Check mobile-specific styling applied
    const isMobileView = await sphereContainer.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return el.classList.contains('sphere-mobile') || 
             parseInt(styles.width!) < 300;
    });
    expect(isMobileView).toBe(true);
  });

  test('TC-S12: Error recovery - sphere recovers after API failure', async ({ page }) => {
    await page.route('**/api/products', (route) => {
      route.abort('failed');
    });

    await page.goto('http://localhost:3010/products');
    await page.waitForLoadState('networkidle');

    // Sphere should still render despite API failure
    const sphereContainer = page.locator('[data-testid="sphere-container"]');
    await expect(sphereContainer).toBeVisible({ timeout: 5000 });

    // Remove route block
    await page.unroute('**/api/products');

    // Click category to retry
    const firstCategory = page.locator('[data-testid="sphere-category-item"]').first();
    await firstCategory.click();
    await page.waitForTimeout(1000);

    // Verify recovery - should get products
    const productCards = page.locator('[data-testid="product-card"]');
    const count = await productCards.count();
    expect(count).toBeGreaterThan(0);
  });
});
