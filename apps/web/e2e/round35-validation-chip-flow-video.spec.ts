import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:3000';

test.use({ video: 'on' });

test('Validation chip end-to-end flow (video proof)', async ({ page }) => {
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.setItem('userEmail', 'admin@delegatecart.com');
    localStorage.setItem('authToken', 'admin-token-r35-video');
    if (!localStorage.getItem('dc-user-id')) {
      localStorage.setItem('dc-user-id', 'video-user-001');
    }
  });

  await page.goto(`${BASE}/shopping-assistant`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);

  const validationChip = page.locator('[data-testid="metric-validation"]');
  await expect(validationChip).toBeVisible();
  await validationChip.click();

  await page.waitForURL(/\/shopping-assistant\/metrics\/validation/);
  await page.waitForTimeout(2500);

  await expect(page.locator('body')).toContainText('Metrics Validation Dashboard');

  const firstSession = page.locator('[data-testid^="validation-session-"]').first();
  if (await firstSession.count()) {
    await firstSession.click();
    await page.waitForTimeout(800);
  }

  await page.screenshot({ path: 'test-results/round35-validation-chip-flow-final.png', fullPage: true });
});
