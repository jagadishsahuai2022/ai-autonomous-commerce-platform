import { test, expect } from '@playwright/test';
const BASE = 'http://127.0.0.1:3000';
const PROOF = '../../r52-proof/r52plus';

async function loginAs(page: any, email: string, password: string, plan: string) {
  await page.goto(`${BASE}/signin`);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);
}

test.describe('R52+ Proof Screenshots', () => {
  test('capture observability dashboard', async ({ page }) => {
    await loginAs(page, 'admin@delegatecart.com', 'admin', 'ENTERPRISE');
    await page.goto(`${BASE}/admin/observability`);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${PROOF}/01-observability-dashboard.png`, fullPage: true });
  });

  test('capture self-learning dashboard', async ({ page }) => {
    await loginAs(page, 'admin@delegatecart.com', 'admin', 'ENTERPRISE');
    await page.goto(`${BASE}/admin/learning`);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${PROOF}/02-self-learning-dashboard.png`, fullPage: true });
  });

  test('capture metrics validation', async ({ page }) => {
    await loginAs(page, 'admin@delegatecart.com', 'admin', 'ENTERPRISE');
    await page.goto(`${BASE}/shopping-assistant/metrics/validation`);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${PROOF}/03-metrics-validation.png`, fullPage: true });
  });

  test('capture validation expanded session', async ({ page }) => {
    await loginAs(page, 'admin@delegatecart.com', 'admin', 'ENTERPRISE');
    await page.goto(`${BASE}/shopping-assistant/metrics/validation`);
    await page.waitForTimeout(3000);
    const card = page.locator('[class*="cursor-pointer"], [role="button"]').first();
    if (await card.isVisible()) {
      await card.click();
      await page.waitForTimeout(1000);
    }
    await page.screenshot({ path: `${PROOF}/04-validation-expanded.png`, fullPage: true });
  });

  test('capture products page', async ({ page }) => {
    await page.goto(`${BASE}/products`);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${PROOF}/05-products-page.png`, fullPage: true });
  });

  test('capture admin dashboard', async ({ page }) => {
    await loginAs(page, 'admin@delegatecart.com', 'admin', 'ENTERPRISE');
    await page.goto(`${BASE}/dashboard`);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${PROOF}/06-admin-dashboard.png`, fullPage: true });
  });

  test('capture shopping assistant', async ({ page }) => {
    await loginAs(page, 'admin@delegatecart.com', 'admin', 'ENTERPRISE');
    await page.goto(`${BASE}/shopping-assistant`);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${PROOF}/07-shopping-assistant.png`, fullPage: true });
  });

  test('capture wallet page', async ({ page }) => {
    await loginAs(page, 'admin@delegatecart.com', 'admin', 'ENTERPRISE');
    await page.goto(`${BASE}/wallet`);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${PROOF}/08-wallet-page.png`, fullPage: true });
  });
});
