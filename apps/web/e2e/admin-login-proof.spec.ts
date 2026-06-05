/**
 * Admin Login E2E Proof Test
 * Tests real admin login at http://localhost:3000/signin with actual DB credentials.
 * Video recording + screenshots are enabled in playwright.config.ts (video: 'on').
 */

import { test, expect } from '@playwright/test';

test.describe('Admin Login – End-to-End Proof', () => {
  test('admin@delegatecart.com can sign in with real credentials', async ({ page }) => {
    // 1. Navigate to the sign-in page
    await page.goto('/signin', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Screenshot: sign-in page loaded
    await page.screenshot({ path: 'test-results/01-signin-page.png', fullPage: true });

    // 2. Fill in admin credentials
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');

    await expect(emailInput).toBeVisible({ timeout: 15000 });
    await expect(passwordInput).toBeVisible({ timeout: 10000 });

    await emailInput.fill('admin@delegatecart.com');
    await passwordInput.fill('Admin@DC2024!');

    // Screenshot: credentials filled
    await page.screenshot({ path: 'test-results/02-credentials-filled.png', fullPage: true });

    // 3. Submit the login form — use the 'Sign In' button specifically
    const submitBtn = page.getByRole('button', { name: 'Sign In' });
    await expect(submitBtn).toBeVisible({ timeout: 10000 });
    await submitBtn.click();

    // 4. Wait for redirect after successful login (wait for URL to change away from /signin)
    await page.waitForURL((url) => !url.pathname.includes('/signin'), { timeout: 30000 });

    // Screenshot: after login attempt
    await page.screenshot({ path: 'test-results/03-after-login.png', fullPage: true });

    // 5. Verify we are no longer on the signin page (successful redirect)
    const currentUrl = page.url();
    console.log('After login URL:', currentUrl);
    expect(currentUrl).not.toContain('/signin');

    // 6. Verify dashboard or home page content is visible
    const pageContent = await page.locator('body').textContent();
    expect(pageContent!.length).toBeGreaterThan(200);

    // Screenshot: logged in state (final)
    await page.screenshot({ path: 'test-results/04-logged-in-dashboard.png', fullPage: true });

    console.log('✅ Admin login successful. URL after login:', currentUrl);
  });

  test('wrong password for existing user is rejected', async ({ page }) => {
    await page.goto('/signin', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    // Use an EXISTING user but wrong password — this triggers the 401 path
    await page.locator('input[type="email"]').fill('admin@delegatecart.com');
    await page.locator('input[type="password"]').fill('WrongPassword999!');
    await page.getByRole('button', { name: 'Sign In' }).click();

    await page.waitForTimeout(4000);

    // Should stay on signin page (not redirect) because password is wrong
    expect(page.url()).toContain('/signin');

    // Should show an error message
    const body = await page.locator('body').textContent();
    const hasError = /invalid|error|failed|incorrect|wrong|try again/i.test(body!);
    expect(hasError).toBeTruthy();

    await page.screenshot({ path: 'test-results/05-invalid-credentials-error.png', fullPage: true });
    console.log('✅ Invalid credentials correctly rejected');
  });
});
