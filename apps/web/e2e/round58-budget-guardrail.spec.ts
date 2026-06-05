import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';

test.describe('Shopping Assistant budget guardrail', () => {
  test('laptop under 50000 returns only in-budget laptop results', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      localStorage.setItem('authToken', `e2e-${Date.now()}`);
      localStorage.setItem('userEmail', 'basicdemo@delegatecart.com');
      localStorage.setItem('dc-user-role', 'basic');
    });

    await page.goto(`${BASE_URL}/shopping-assistant`, { waitUntil: 'domcontentloaded' });

    const input = page.locator('textarea, input[type="text"], [role="textbox"]').first();
    await expect(input).toBeVisible({ timeout: 15000 });

    await input.fill('asus gaming laptop under 50000 16gb ram');
    await input.press('Enter');

    await expect(page.locator('text=/asus gaming laptop under 50000 16gb ram/i').first()).toBeVisible({ timeout: 15000 });

    // Validate the guardrail in a real browser context using the same app API.
    const analyzeResult = await page.evaluate(async () => {
      const response = await fetch('/api/intent/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'laptop under 50000', engine: 'v2' }),
      });
      const data = await response.json();
      return { status: response.status, data };
    });

    expect(analyzeResult.status).toBe(200);
    const analyzeResponse = analyzeResult.data;

    const products = Array.isArray(analyzeResponse?.products) ? analyzeResponse.products : [];
    expect(products.length).toBeGreaterThan(0);

    for (const p of products) {
      expect(Number(p.price)).toBeLessThanOrEqual(50000);
      const categoryText = `${String(p.category ?? '')} ${String(p.subCategory ?? '')} ${String(p.name ?? '')}`.toLowerCase();
      expect(categoryText.includes('laptop') || categoryText.includes('notebook')).toBe(true);
    }

    await page.screenshot({
      path: '../../r58-proof/r58-laptop-budget-guardrail.png',
      fullPage: true,
    });
  });
});
