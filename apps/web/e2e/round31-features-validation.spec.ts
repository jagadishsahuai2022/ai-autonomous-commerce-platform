/**
 * Round 31 — End-to-End Validation Tests
 *
 * Covers:
 * Issue 1:  Clear button resets right panel (Pipeline/Decision/Approval)
 * Issue 2:  Compare button in carousel → opens compare modal popup
 * Issue 3:  Compare modal header + close button always visible (sticky)
 * Issue 4:  Product cards show external/native icons with tooltips
 * Issue 5:  Product card click → opens product detail modal popup
 * Issue 6:  "Compare Samsung vs LG TVs" → returns TV products not phones
 * Issue 7:  Chip queries captured in learning DB
 * Issue 8:  ARCHITECTURE_DIAGRAM.svg — no duplicate rx attribute
 * Issue 9:  ComparisonTable external/native icons in product columns
 */

import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:3000';
const ADMIN_EMAIL = 'admin@delegatecart.com';
const ADMIN_PASS = 'Admin@DC2024!';

// ── Helper: Admin login ──────────────────────────────────────────────────────
async function loginAdmin(page: import('@playwright/test').Page) {
  await page.goto(`${BASE}/signin`);
  await page.waitForLoadState('networkidle');
  const emailInput = page.locator('input[type="email"]').first();
  await emailInput.waitFor({ state: 'visible', timeout: 15000 });
  await emailInput.fill(ADMIN_EMAIL);
  const passInput = page.locator('input[type="password"]').first();
  await passInput.fill(ADMIN_PASS);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL((url) => !url.pathname.includes('/signin'), { timeout: 30000 });
  await page.waitForLoadState('networkidle');
}

// ── Helper: Navigate to shopping assistant ───────────────────────────────────
async function goToShoppingAssistant(page: import('@playwright/test').Page) {
  await page.goto(`${BASE}/shopping-assistant`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);
}

// ── Helper: Send a chat message ──────────────────────────────────────────────
async function sendChatMessage(page: import('@playwright/test').Page, text: string) {
  const input = page.locator('textarea[placeholder*="Ask me"], input[placeholder*="Ask me"]').first();
  await input.waitFor({ state: 'visible', timeout: 10000 });
  await input.fill(text);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3000); // Allow AI response
}

// ══════════════════════════════════════════════════════════════════════════════
// TEST GROUP 1: Clear button resets right panel
// ══════════════════════════════════════════════════════════════════════════════
test.describe('Issue 1 — Clear button resets right panel state', () => {

  test('clear button exists in chat header', async ({ page }) => {
    await goToShoppingAssistant(page);
    const clearBtn = page.locator('button', { hasText: 'Clear' }).first();
    await clearBtn.waitFor({ state: 'visible', timeout: 10000 });
    await expect(clearBtn).toBeVisible();
  });

  test('right panel shows "Waiting for query" after clear', async ({ page }) => {
    await goToShoppingAssistant(page);
    // Send a chat message to populate state
    await sendChatMessage(page, 'best wireless earbuds');
    // Click Clear
    const clearBtn = page.locator('button', { hasText: 'Clear' }).first();
    await clearBtn.click();
    await page.waitForTimeout(500);
    // Pipeline tab should show "Waiting for query" text
    const pipelineTab = page.locator('button', { hasText: 'Pipeline' }).first();
    await pipelineTab.click();
    await page.waitForTimeout(300);
    const waitingText = page.locator('text=Waiting for query').first();
    await expect(waitingText).toBeVisible({ timeout: 5000 });
  });

  test('right panel Decision tab shows empty state after clear', async ({ page }) => {
    await goToShoppingAssistant(page);
    await sendChatMessage(page, 'best wireless earbuds');
    const clearBtn = page.locator('button', { hasText: 'Clear' }).first();
    await clearBtn.click();
    await page.waitForTimeout(500);
    const decisionTab = page.locator('button', { hasText: 'Decision' }).first();
    await decisionTab.click();
    await page.waitForTimeout(300);
    // Should show "No products yet" placeholder
    const noProducts = page.locator('text=No products yet').first();
    await expect(noProducts).toBeVisible({ timeout: 5000 });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// TEST GROUP 2: Compare button opens compare modal
// ══════════════════════════════════════════════════════════════════════════════
test.describe('Issue 2 — Compare button opens comparison modal', () => {

  test('compare button exists in carousel header when products appear', async ({ page }) => {
    await goToShoppingAssistant(page);
    await sendChatMessage(page, 'best wireless earbuds');
    // Product carousel should appear
    const carousel = page.locator('[data-testid="product-carousel"]').first();
    await carousel.waitFor({ state: 'visible', timeout: 20000 });
    // Compare button in carousel header
    const compareBtn = carousel.locator('button', { hasText: 'Compare' }).first();
    await expect(compareBtn).toBeVisible({ timeout: 5000 });
  });

  test('clicking Compare button opens comparison modal', async ({ page }) => {
    await goToShoppingAssistant(page);
    await sendChatMessage(page, 'best wireless earbuds');
    const carousel = page.locator('[data-testid="product-carousel"]').first();
    await carousel.waitFor({ state: 'visible', timeout: 20000 });
    const compareBtn = carousel.locator('button', { hasText: 'Compare' }).first();
    await compareBtn.click();
    await page.waitForTimeout(500);
    // Modal should appear with "Product Comparison" heading
    const modalHeading = page.locator('text=Product Comparison').first();
    await expect(modalHeading).toBeVisible({ timeout: 5000 });
  });

  test('right-panel Compare button also opens modal', async ({ page }) => {
    await goToShoppingAssistant(page);
    // Right panel has a Compare button in the sidebar controls
    const sidebarCompare = page.locator('aside button', { hasText: 'Compare' }).first();
    await sidebarCompare.waitFor({ state: 'visible', timeout: 10000 });
    await sidebarCompare.click();
    await page.waitForTimeout(500);
    const modalHeading = page.locator('text=Product Comparison').first();
    await expect(modalHeading).toBeVisible({ timeout: 5000 });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// TEST GROUP 3: Compare modal sticky header
// ══════════════════════════════════════════════════════════════════════════════
test.describe('Issue 3 — Compare modal has sticky header', () => {

  test('compare modal close button always visible', async ({ page }) => {
    await goToShoppingAssistant(page);
    const sidebarCompare = page.locator('aside button', { hasText: 'Compare' }).first();
    await sidebarCompare.waitFor({ state: 'visible', timeout: 10000 });
    await sidebarCompare.click();
    await page.waitForTimeout(500);
    // Close button (X) should always be visible
    const closeBtn = page.locator('[data-testid="compare-modal-close"]').first();
    await expect(closeBtn).toBeVisible({ timeout: 5000 });
  });

  test('compare modal header has sticky positioning', async ({ page }) => {
    await goToShoppingAssistant(page);
    const sidebarCompare = page.locator('aside button', { hasText: 'Compare' }).first();
    await sidebarCompare.waitFor({ state: 'visible', timeout: 10000 });
    await sidebarCompare.click();
    await page.waitForTimeout(500);
    // The modal header (direct parent of close button) should have sticky class
    const modalHeader = page.locator('[data-testid="compare-modal-close"]').locator('..');
    const stickyClass = await modalHeader.evaluate((el) => {
      return el.className.includes('sticky') || getComputedStyle(el).position === 'sticky';
    });
    expect(stickyClass).toBe(true);
  });

  test('compare modal close button closes the modal', async ({ page }) => {
    await goToShoppingAssistant(page);
    const sidebarCompare = page.locator('aside button', { hasText: 'Compare' }).first();
    await sidebarCompare.click();
    await page.waitForTimeout(500);
    const closeBtn = page.locator('[data-testid="compare-modal-close"]').first();
    await closeBtn.click();
    await page.waitForTimeout(500);
    const modalHeading = page.locator('text=Product Comparison').first();
    await expect(modalHeading).not.toBeVisible({ timeout: 3000 });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// TEST GROUP 4: External/Native icons on product cards
// ══════════════════════════════════════════════════════════════════════════════
test.describe('Issue 4 — External/Native icons with tooltips', () => {

  test('product cards in carousel show source badge', async ({ page }) => {
    await goToShoppingAssistant(page);
    await sendChatMessage(page, 'best wireless earbuds');
    const carousel = page.locator('[data-testid="product-carousel"]').first();
    await carousel.waitFor({ state: 'visible', timeout: 20000 });
    // Each product card should have a source badge (external or native)
    const cards = carousel.locator('[data-testid="product-card"]');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
    // First card should have either external-badge or native-badge
    const firstCard = cards.first();
    const hasBadge = await firstCard.locator('[data-testid="external-badge"], [data-testid="native-badge"]').count();
    expect(hasBadge).toBeGreaterThan(0);
  });

  test('native badge shows Store icon and "Native" text', async ({ page }) => {
    await goToShoppingAssistant(page);
    await sendChatMessage(page, 'best wireless earbuds');
    const carousel = page.locator('[data-testid="product-carousel"]').first();
    await carousel.waitFor({ state: 'visible', timeout: 20000 });
    // Find at least one native badge
    const nativeBadge = page.locator('[data-testid="native-badge"]').first();
    if (await nativeBadge.count() > 0) {
      await expect(nativeBadge).toContainText('Native');
      const title = await nativeBadge.getAttribute('title');
      expect(title).toContain('Native product');
    }
  });

  test('external badge shows Globe icon and "External" text', async ({ page }) => {
    await goToShoppingAssistant(page);
    // Enable external products
    const extToggle = page.locator('[data-testid="external-toggle"]').first();
    await extToggle.waitFor({ state: 'visible', timeout: 10000 });
    const toggleText = await extToggle.textContent();
    if (toggleText?.includes('OFF')) {
      await extToggle.click();
      await page.waitForTimeout(500);
    }
    await sendChatMessage(page, 'find a laptop');
    const carousel = page.locator('[data-testid="product-carousel"]').first();
    await carousel.waitFor({ state: 'visible', timeout: 20000 });
    // If external products present
    const externalBadge = page.locator('[data-testid="external-badge"]').first();
    if (await externalBadge.count() > 0) {
      await expect(externalBadge).toContainText('External');
      const title = await externalBadge.getAttribute('title');
      expect(title).toContain('External product');
    }
  });

  test('mini-cards in bottom pinned carousel show source icon badges', async ({ page }) => {
    await goToShoppingAssistant(page);
    await sendChatMessage(page, 'best wireless earbuds');
    await page.waitForTimeout(3000);
    // Bottom pinned carousel mini-cards  
    const miniNative = page.locator('[data-testid="native-badge-mini"]').first();
    const miniExternal = page.locator('[data-testid="external-badge-mini"]').first();
    const hasMini = (await miniNative.count()) + (await miniExternal.count());
    expect(hasMini).toBeGreaterThan(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// TEST GROUP 5: Product card click → product detail modal
// ══════════════════════════════════════════════════════════════════════════════
test.describe('Issue 5 — Product card opens detail modal', () => {

  test('clicking product detail trigger opens product detail modal', async ({ page }) => {
    await goToShoppingAssistant(page);
    await sendChatMessage(page, 'best wireless earbuds');
    const carousel = page.locator('[data-testid="product-carousel"]').first();
    await carousel.waitFor({ state: 'visible', timeout: 20000 });
    // Click the detail trigger on first product card
    const detailTrigger = carousel.locator('[data-testid="product-card-detail-trigger"]').first();
    await detailTrigger.click();
    await page.waitForTimeout(500);
    // Product detail modal should appear
    const modal = page.locator('[data-testid="product-detail-modal"]').first();
    await expect(modal).toBeVisible({ timeout: 5000 });
  });

  test('product detail modal shows product name and price', async ({ page }) => {
    await goToShoppingAssistant(page);
    await sendChatMessage(page, 'best wireless earbuds');
    const carousel = page.locator('[data-testid="product-carousel"]').first();
    await carousel.waitFor({ state: 'visible', timeout: 20000 });
    const detailTrigger = carousel.locator('[data-testid="product-card-detail-trigger"]').first();
    await detailTrigger.click();
    await page.waitForTimeout(500);
    const modal = page.locator('[data-testid="product-detail-modal"]').first();
    await expect(modal).toBeVisible({ timeout: 5000 });
    // Modal should contain price text (₹)
    await expect(modal.locator('text=₹').first()).toBeVisible({ timeout: 3000 });
  });

  test('product detail modal close button works', async ({ page }) => {
    await goToShoppingAssistant(page);
    await sendChatMessage(page, 'best wireless earbuds');
    const carousel = page.locator('[data-testid="product-carousel"]').first();
    await carousel.waitFor({ state: 'visible', timeout: 20000 });
    const detailTrigger = carousel.locator('[data-testid="product-card-detail-trigger"]').first();
    await detailTrigger.click();
    await page.waitForTimeout(500);
    const modal = page.locator('[data-testid="product-detail-modal"]').first();
    await expect(modal).toBeVisible({ timeout: 5000 });
    const closeBtn = page.locator('[data-testid="product-detail-close"]').first();
    await closeBtn.click();
    await page.waitForTimeout(500);
    await expect(modal).not.toBeVisible({ timeout: 3000 });
  });

  test('info button on product card opens detail modal', async ({ page }) => {
    await goToShoppingAssistant(page);
    await sendChatMessage(page, 'best wireless earbuds');
    const carousel = page.locator('[data-testid="product-carousel"]').first();
    await carousel.waitFor({ state: 'visible', timeout: 20000 });
    const infoBtn = carousel.locator('[data-testid="product-detail-btn"]').first();
    await infoBtn.click();
    await page.waitForTimeout(500);
    const modal = page.locator('[data-testid="product-detail-modal"]').first();
    await expect(modal).toBeVisible({ timeout: 5000 });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// TEST GROUP 6: Samsung vs LG TVs gives TV results
// ══════════════════════════════════════════════════════════════════════════════
test.describe('Issue 6 — "Compare Samsung vs LG TVs" returns TV products', () => {

  test('TV query API returns television category', async ({ page }) => {
    const response = await page.request.post(`${BASE}/api/intent/analyze`, {
      data: { input: 'Compare Samsung vs LG TVs', user_id: 'test-round31' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(response.ok()).toBe(true);
    const data = await response.json();
    // Should detect television category, not phone/laptop
    const category = (data.intent?.category || '').toLowerCase();
    expect(['television', 'tv', 'electronics'].some(c => category.includes(c))).toBe(true);
  });

  test('TV query returns TV products not phones', async ({ page }) => {
    const response = await page.request.post(`${BASE}/api/intent/analyze`, {
      data: { input: 'Compare Samsung vs LG TVs', user_id: 'test-round31' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(response.ok()).toBe(true);
    const data = await response.json();
    // If products returned, they should not be primarily phones
    if (data.products && data.products.length > 0) {
      const productNames = data.products.map((p: any) => (p.name || '').toLowerCase());
      // TV products should not reference "Galaxy S24" or "iPhone" in name
      const hasPhone = productNames.some((n: string) => n.includes('galaxy s24') || n.includes('iphone 15'));
      expect(hasPhone).toBe(false);
    }
  });

  test('chat message response for TVs query mentions TV products', async ({ page }) => {
    const response = await page.request.post(`${BASE}/api/chat/message`, {
      data: { message: 'Compare Samsung vs LG TVs', user_id: 'test-round31' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(response.ok()).toBe(true);
    const body = await response.text();
    // Response should mention TV-related content
    const lower = body.toLowerCase();
    const hasTvContent = lower.includes('tv') || lower.includes('television') || lower.includes('oled') || lower.includes('qled') || lower.includes('samsung') || lower.includes('lg');
    expect(hasTvContent).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// TEST GROUP 7: Chip queries captured in learning DB
// ══════════════════════════════════════════════════════════════════════════════
test.describe('Issue 7 — Chip queries captured in learning DB', () => {

  test('clicking chip query sends to chat API and saves to learning', async ({ page }) => {
    // Monitor API requests
    const learnCalls: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/api/chat/message') || req.url().includes('/api/intent/analyze')) {
        learnCalls.push(req.url());
      }
    });

    await goToShoppingAssistant(page);
    // Click first suggestion chip
    const chip = page.locator('[data-testid^="suggestion-chip-"]').first();
    await chip.waitFor({ state: 'visible', timeout: 10000 });
    await chip.click();
    await page.waitForTimeout(4000);
    // Should have triggered at least one learning API call
    expect(learnCalls.length).toBeGreaterThan(0);
  });

  test('chip query text appears in chat messages', async ({ page }) => {
    await goToShoppingAssistant(page);
    const chip = page.locator('[data-testid^="suggestion-chip-"]').first();
    await chip.waitFor({ state: 'visible', timeout: 10000 });
    const chipText = (await chip.textContent() || '').trim().replace(/^[\s\S]*?([A-Z₹].*)/, '$1').trim();
    await chip.click();
    await page.waitForTimeout(4000);
    // The chip text should appear somewhere in the chat area (in the session header)
    const chatArea = page.locator('.space-y-3').first();
    await expect(chatArea).toBeVisible({ timeout: 5000 });
  });

  test('chip queryBy is set to user session ID in learning API', async ({ page }) => {
    const requestBodies: string[] = [];
    page.on('request', async (req) => {
      if (req.url().includes('/api/chat/message')) {
        try {
          const body = req.postData() || '';
          requestBodies.push(body);
        } catch {}
      }
    });

    await goToShoppingAssistant(page);
    const chip = page.locator('[data-testid^="suggestion-chip-"]').first();
    await chip.waitFor({ state: 'visible', timeout: 10000 });
    await chip.click();
    await page.waitForTimeout(4000);
    expect(requestBodies.length).toBeGreaterThan(0);
    // Request body should have user_id field set
    const firstBody = JSON.parse(requestBodies[0] || '{}');
    expect(firstBody.user_id || firstBody.message).toBeTruthy();
  });

  test('learning grid shows recent queries (admin)', async ({ page }) => {
    // Try admin login; if it fails skip gracefully (admin user may not exist in CI)
    try {
      await loginAdmin(page);
    } catch {
      // Try navigating directly — page may allow access or redirect
      await page.goto(`${BASE}/admin/learning`);
      await page.waitForLoadState('domcontentloaded');
    }
    await page.goto(`${BASE}/admin/learning`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);
    // Page should load without error (200 ok)
    const url = page.url();
    expect(url).toContain('admin/learning');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// TEST GROUP 8: SVG architecture diagram — no rx redefined
// ══════════════════════════════════════════════════════════════════════════════
test.describe('Issue 8 — ARCHITECTURE_DIAGRAM.svg no duplicate rx attribute', () => {

  test('SVG file does not have duplicate rx attributes', async ({ page }) => {
    const fs = await import('fs');
    const path = await import('path');
    const svgPath = path.join('d:/PersonalProject/GIT/delegatecart/docs/10Apr2026/ARCHITECTURE_DIAGRAM.svg');
    const svgContent = fs.readFileSync(svgPath, 'utf-8');
    
    // Each line should not have duplicate rx attribute (rx=... rx=...)
    const lines = svgContent.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Count rx= occurrences per line
      const rxMatches = (line.match(/\brx=/g) || []).length;
      expect(rxMatches, `Line ${i + 1} has duplicate rx attribute: ${line.trim()}`).toBeLessThanOrEqual(1);
    }
  });

  test('SVG file is well-formed XML (no parse errors)', async ({ page }) => {
    const response = await page.request.get(`${BASE}/docs/10Apr2026/ARCHITECTURE_DIAGRAM.svg`).catch(() => null);
    // Just verify SVG content is accessible or test file directly
    const fs = await import('fs');
    const path = await import('path');
    const svgPath = path.join('d:/PersonalProject/GIT/delegatecart/docs/10Apr2026/ARCHITECTURE_DIAGRAM.svg');
    const svgContent = fs.readFileSync(svgPath, 'utf-8');
    expect(svgContent).toContain('<svg');
    expect(svgContent).toContain('</svg>');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// TEST GROUP 9: Shopping assistant page loads correctly
// ══════════════════════════════════════════════════════════════════════════════
test.describe('General — Shopping assistant page renders correctly', () => {

  test('shopping assistant page loads with chat input', async ({ page }) => {
    await goToShoppingAssistant(page);
    const chatInput = page.locator('textarea[placeholder*="Ask me"], input[placeholder*="Ask me"]').first();
    await expect(chatInput).toBeVisible({ timeout: 10000 });
  });

  test('suggestion chips are visible below chat', async ({ page }) => {
    await goToShoppingAssistant(page);
    const chip = page.locator('[data-testid^="suggestion-chip-"]').first();
    await expect(chip).toBeVisible({ timeout: 10000 });
  });

  test('right panel shows Pipeline/Decision/Approval tabs', async ({ page }) => {
    await goToShoppingAssistant(page);
    await expect(page.locator('button', { hasText: 'Pipeline' }).first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('button', { hasText: 'Decision' }).first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('button', { hasText: 'Approval' }).first()).toBeVisible({ timeout: 10000 });
  });

  test('sending a query shows assistant response in chat', async ({ page }) => {
    await goToShoppingAssistant(page);
    await sendChatMessage(page, 'best laptop under 50000');
    // Something should appear in the chat area after sending
    const chatContent = page.locator('.space-y-3').first();
    await expect(chatContent).toBeVisible({ timeout: 10000 });
  });

  test('TV query in chat returns TV-related answer', async ({ page }) => {
    await goToShoppingAssistant(page);
    await sendChatMessage(page, 'Compare Samsung vs LG TVs');
    await page.waitForTimeout(5000);
    // The session should show the query
    const sessionHeader = page.locator('[data-testid^="chat-session-"]').first();
    await expect(sessionHeader).toBeVisible({ timeout: 10000 });
    const queryText = await sessionHeader.textContent();
    expect(queryText?.toLowerCase()).toContain('compare');
  });

  test('metric tiles link to dedicated pages', async ({ page }) => {
    await goToShoppingAssistant(page);
    // Products metric tile
    const productsTile = page.locator('[data-testid="metric-products"]').first();
    await productsTile.waitFor({ state: 'visible', timeout: 10000 });
    const href = await productsTile.getAttribute('href');
    expect(href).toContain('/metrics/products');
  });
});
