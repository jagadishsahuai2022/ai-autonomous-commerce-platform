import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:3000';

test.use({ video: 'on' });

test('Round 37 — Admin Dashboard & RBAC flow (video proof)', async ({ page }) => {
  // 1. Visit signin page
  await page.goto(`${BASE}/signin`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  // 2. Set admin user via localStorage (simulates successful login)
  await page.evaluate(() => {
    localStorage.setItem('userEmail', 'admin@delegatecart.com');
    localStorage.setItem('authToken', `admin-${Date.now()}`);
    localStorage.setItem('dc-user-role', 'admin');
    localStorage.setItem('dc-user-subscription', 'AI_PLUS');
  });

  // 3. Navigate to Admin Dashboard
  await page.goto(`${BASE}/admin/dashboard`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Should see Admin Dashboard
  await expect(page.locator('body')).toContainText(/admin dashboard|user management/i, { timeout: 15000 });

  // 4. Screenshot the admin dashboard
  await page.screenshot({ path: 'test-results/round37-admin-dashboard.png', fullPage: true });

  // 5. Navigate to Shopping Assistant to verify validation chip
  await page.goto(`${BASE}/shopping-assistant`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const chip = page.locator('[data-testid="metric-validation"]');
  await expect(chip).toBeVisible({ timeout: 15000 });

  // 6. Click validation chip
  await chip.click();
  await page.waitForURL(/\/shopping-assistant\/metrics\/validation/, { timeout: 15000 });
  await page.waitForTimeout(2000);

  await expect(page.locator('body')).toContainText('Metrics Validation Dashboard');

  // 7. Screenshot validation page
  await page.screenshot({ path: 'test-results/round37-validation-page.png', fullPage: true });

  // 8. Switch to basic user - should be blocked from admin dashboard
  await page.evaluate(() => {
    localStorage.setItem('userEmail', 'basicdemo@delegatecart.com');
    localStorage.setItem('dc-user-role', 'basic');
    localStorage.setItem('dc-user-subscription', 'BASIC');
  });

  await page.goto(`${BASE}/admin/dashboard`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  // Should show access denied
  await expect(page.locator('body')).toContainText(/admin access required|access denied/i, { timeout: 10000 });

  // 9. Final screenshot
  await page.screenshot({ path: 'test-results/round37-basic-user-admin-blocked.png', fullPage: true });
});
