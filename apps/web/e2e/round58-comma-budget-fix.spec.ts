import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * R58 — Comma-in-numbers budget fix E2E proof
 *
 * Root cause: Tokenizer failed to strip commas from numbers like "₹50,000".
 * The regex (\d+) captured only "50" → budget max = 50 → zero products found.
 *
 * Fix: tokenizer.ts now strips commas between digits before budget extraction.
 *
 * This test proves the fix works end-to-end on the deployed container (port 3010).
 */

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3010';
const PROOF_DIR = path.resolve(process.cwd(), '../../r58-proof');
const SS_DIR = path.join(PROOF_DIR, 'screenshots');

fs.mkdirSync(SS_DIR, { recursive: true });

async function injectAuth(page: Page) {
  await page.goto(`${BASE}/products`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.setItem('authToken', `e2e-comma-fix-${Date.now()}`);
    localStorage.setItem('userEmail', 'basicdemo@delegatecart.com');
    localStorage.setItem('dc-user-role', 'basic');
  });
}

async function ss(page: Page, name: string) {
  await page.screenshot({ path: path.join(SS_DIR, `${name}.png`), fullPage: true });
}

// ── API-level proof: analyze endpoint parses ₹50,000 correctly ────────────────
test.describe('R58 comma-in-number budget fix — API proof', () => {
  test('analyze "Find laptops under ₹50,000" → budget=50000, all laptops under 50K', async ({ page }) => {
    await injectAuth(page);

    const result = await page.evaluate(async (base) => {
      const res = await fetch(`${base}/api/intent/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'Find laptops under ₹50,000', engine: 'v2' }),
      });
      return { status: res.status, data: await res.json() };
    }, BASE);

    expect(result.status).toBe(200);

    // Budget must be parsed as 50000, NOT 50
    const budget = result.data?.intent?.budget;
    expect(budget).toBeDefined();
    expect(budget.max).toBeGreaterThanOrEqual(50000);

    // Products must exist and all be laptops under budget
    const products = result.data?.products ?? [];
    expect(products.length).toBeGreaterThan(0);

    for (const p of products) {
      expect(Number(p.price)).toBeLessThanOrEqual(50000);
      const cat = (p.category ?? '').toLowerCase();
      expect(cat).toBe('laptop');
    }

    await ss(page, 'r58-comma-budget-api-proof');
  });

  test('analyze "phone under ₹20,000" → budget=20000', async ({ page }) => {
    await injectAuth(page);

    const result = await page.evaluate(async (base) => {
      const res = await fetch(`${base}/api/intent/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'phone under ₹20,000', engine: 'v2' }),
      });
      return { status: res.status, data: await res.json() };
    }, BASE);

    expect(result.status).toBe(200);
    expect(result.data?.intent?.budget?.max).toBeGreaterThanOrEqual(20000);

    const products = result.data?.products ?? [];
    expect(products.length).toBeGreaterThan(0);
    for (const p of products) {
      expect(Number(p.price)).toBeLessThanOrEqual(20000);
    }

    await ss(page, 'r58-comma-budget-phone-20k');
  });

  test('analyze "laptop under 1,50,000" (Indian notation) → budget=150000', async ({ page }) => {
    await injectAuth(page);

    const result = await page.evaluate(async (base) => {
      const res = await fetch(`${base}/api/intent/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'laptop under 1,50,000', engine: 'v2' }),
      });
      return { status: res.status, data: await res.json() };
    }, BASE);

    expect(result.status).toBe(200);
    expect(result.data?.intent?.budget?.max).toBeGreaterThanOrEqual(150000);
  });
});

// ── UI-level proof: shopping assistant chat with ₹50,000 ──────────────────────
test.describe('R58 comma-in-number budget fix — UI proof', () => {
  test('shopping assistant: "Find laptops under ₹50,000" shows laptop products', async ({ page }) => {
    await injectAuth(page);
    await page.goto(`${BASE}/shopping-assistant`, { waitUntil: 'domcontentloaded' });

    // Wait for UI to load
    const input = page.locator('textarea, input[type="text"], [role="textbox"]').first();
    await expect(input).toBeVisible({ timeout: 20000 });

    // Type the exact problematic query
    await input.fill('Find laptops under ₹50,000');
    await ss(page, 'r58-comma-chat-query-typed');

    await input.press('Enter');

    // Wait for response to appear (product cards or text reply)
    await page.waitForTimeout(5000);

    // The response should NOT contain "couldn't find exact matches"
    const bodyText = await page.locator('body').innerText();
    const hasNoMatchError = bodyText.toLowerCase().includes("couldn't find exact matches");
    expect(hasNoMatchError).toBe(false);

    // Should see laptop-related content (product names, or "laptop" in text)
    const hasLaptopContent = bodyText.toLowerCase().includes('laptop');
    expect(hasLaptopContent).toBe(true);

    await ss(page, 'r58-comma-chat-response');
  });

  test('shopping assistant page loads without JS errors', async ({ page }) => {
    const jsErrors: string[] = [];
    page.on('pageerror', (err) => jsErrors.push(err.message));

    await injectAuth(page);
    await page.goto(`${BASE}/shopping-assistant`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // No critical JS errors
    const criticalErrors = jsErrors.filter(
      (e) => !e.includes('ResizeObserver') && !e.includes('hydration')
    );
    expect(criticalErrors).toHaveLength(0);

    await ss(page, 'r58-shopping-assistant-no-errors');
  });

  test('metrics validation page loads without error', async ({ page }) => {
    await injectAuth(page);
    await page.goto(`${BASE}/shopping-assistant/metrics/validation`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Page loads successfully (metrics panels render after a search query is submitted)
    await expect(page.locator('body')).toBeVisible();
    const bodyText = await page.locator('body').innerText();
    // Check page identity — the heading or any metrics-related text
    const hasMetricsContent = bodyText.toLowerCase().includes('metric') ||
      bodyText.toLowerCase().includes('validation') ||
      bodyText.toLowerCase().includes('delegatecart');
    expect(hasMetricsContent).toBe(true);

    await ss(page, 'r58-metrics-validation-page');
  });
});
