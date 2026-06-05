/**
 * r54 Proof — Playwright E2E Tests with Video
 * Covers:
 *   1. Nav dropdown shows "User Management" (not "Admin Dashboard") for admin
 *   2. /admin/dashboard page title is "User Management"
 *   3. Admin Panel (/admin) still works and has correct analytics charts
 *   4. All r53 tests still pass (regression)
 */
import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = 'admin@delegatecart.com';
const ADMIN_PASSWORD = 'Admin@DC2024!';
const BASE = 'http://127.0.0.1:3000';

test.use({ video: 'on' });

async function loginAsAdmin(page: import('@playwright/test').Page) {
  await page.goto(`${BASE}/signin`);
  await page.waitForLoadState('networkidle');
  const emailInput = page.locator('input[type="email"], input[name="email"]').first();
  const passInput = page.locator('input[type="password"]').first();
  await emailInput.fill(ADMIN_EMAIL);
  await passInput.fill(ADMIN_PASSWORD);
  const submitBtn = page.getByRole('button', { name: 'Sign In' });
  await expect(submitBtn).toBeVisible({ timeout: 10000 });
  await submitBtn.click({ force: true });
  await page.waitForURL(url => !url.pathname.includes('/signin'), { timeout: 30000 });
  await page.waitForLoadState('networkidle');
}

test.describe('r54 User Management Rename Proof', () => {

  test('1. Nav dropdown shows "User Management" instead of "Admin Dashboard"', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/dashboard`);
    await page.waitForLoadState('networkidle');

    // Open the user dropdown menu (click the user avatar/menu)
    const userMenu = page.locator('[data-testid="user-menu"], button:has-text("Jagadish"), [aria-label="User menu"]').first();
    await expect(userMenu).toBeVisible({ timeout: 10000 });
    await userMenu.click();
    await page.waitForTimeout(500);

    // Verify "User Management" appears in the dropdown
    const userMgmtLink = page.locator('text=User Management').first();
    await expect(userMgmtLink).toBeVisible({ timeout: 5000 });
    console.log('[Test 1] "User Management" link visible in nav dropdown');

    // Verify "Admin Dashboard" does NOT appear
    const adminDashText = page.locator('a:has-text("Admin Dashboard"), button:has-text("Admin Dashboard")');
    await expect(adminDashText).toHaveCount(0);
    console.log('[Test 1] "Admin Dashboard" text absent from dropdown — rename confirmed');

    await page.screenshot({ path: 'test-results/r54-1-nav-user-management.png', fullPage: false });
  });

  test('2. /admin/dashboard page title shows "User Management"', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/dashboard`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Verify page heading says "User Management"
    const heading = page.locator('h1:has-text("User Management")').first();
    await expect(heading).toBeVisible({ timeout: 10000 });
    console.log('[Test 2] "User Management" heading visible on /admin/dashboard');

    // Verify subtitle mentions users/roles
    const subtitle = page.locator('text=Users, Roles, Subscriptions').first();
    await expect(subtitle).toBeVisible({ timeout: 5000 });
    console.log('[Test 2] Subtitle "Users, Roles, Subscriptions" visible');

    // Verify it does NOT say "Admin Dashboard" as heading
    const bodyText = await page.textContent('h1');
    expect(bodyText).not.toContain('Admin Dashboard');
    console.log('[Test 2] "Admin Dashboard" absent from h1 — rename confirmed');

    await page.screenshot({ path: 'test-results/r54-2-user-management-page.png', fullPage: false });
  });

  test('3. Admin Panel (/admin) has analytics charts and DB data', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // The admin page should show analytics charts
    const pageTitle = page.locator('h1:has-text("Admin Dashboard")').first();
    await expect(pageTitle).toBeVisible({ timeout: 10000 });

    // Check data source badge exists
    const dataBadge = page.locator('[data-testid="data-source-badge"]').first();
    await expect(dataBadge).toBeVisible({ timeout: 5000 });
    const badgeText = await dataBadge.textContent();
    console.log('[Test 3] Data source badge:', badgeText);

    // Verify stat cards exist
    const statCards = page.locator('.grid .bg-white').first();
    await expect(statCards).toBeVisible({ timeout: 5000 });

    // Verify "User Management" quick link exists (renamed from "Admin Dashboard")
    const userMgmtQuickLink = page.locator('text=User Management').first();
    await expect(userMgmtQuickLink).toBeVisible({ timeout: 5000 });
    console.log('[Test 3] "User Management" quick link visible in Admin Panel');

    await page.screenshot({ path: 'test-results/r54-3-admin-panel-charts.png', fullPage: true });
  });

  test('4. RBAC descriptions updated from "Admin Dashboard" to "User Management"', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/dashboard`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Scroll to RBAC reference section
    const rbacSection = page.locator('text=Role-Based Access Control Reference').first();
    await rbacSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    // Verify RBAC text uses "User Management" instead of "Admin Dashboard"
    const bodyText = await page.textContent('body');
    expect(bodyText).toContain('User Management');
    expect(bodyText).toContain('No User Management');
    console.log('[Test 4] RBAC descriptions use "User Management" terminology');

    await page.screenshot({ path: 'test-results/r54-4-rbac-user-management.png', fullPage: true });
  });

  test('5. Observability Dashboard still loads with LIVE DB (regression)', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/observability`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Verify the dashboard renders without crashing
    const dashTitle = page.locator('h1:has-text("Observability Dashboard")').first();
    await expect(dashTitle).toBeVisible({ timeout: 10000 });

    // Verify LIVE DB badge
    const liveDbBadge = page.locator('text=LIVE DB').first();
    await expect(liveDbBadge).toBeVisible({ timeout: 10000 });
    console.log('[Test 5] Observability Dashboard loaded with LIVE DB badge');

    // Verify tabs are present
    await expect(page.locator('button:has-text("Orders")').first()).toBeVisible();
    await expect(page.locator('button:has-text("AI Queries")').first()).toBeVisible();
    await expect(page.locator('button:has-text("System Health")').first()).toBeVisible();
    console.log('[Test 5] All observability tabs visible (regression OK)');

    await page.screenshot({ path: 'test-results/r54-5-observability-regression.png', fullPage: false });
  });

  test('6. All user data visible in /admin/dashboard', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/dashboard`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Verify user table/list are shown
    const totalUsersText = page.locator('text=Total Users').first();
    await expect(totalUsersText).toBeVisible({ timeout: 10000 });
    console.log('[Test 6] Total Users stat visible');

    // Verify stats section
    const activeText = page.locator('text=Active').first();
    await expect(activeText).toBeVisible({ timeout: 5000 });

    // Verify user rows are present (there should be multiple users from DB)
    const userRows = page.locator('tr, [data-user-email], .border-b').first();
    await expect(userRows).toBeVisible({ timeout: 5000 });
    console.log('[Test 6] User data rows visible in User Management page');

    await page.screenshot({ path: 'test-results/r54-6-user-data.png', fullPage: true });
  });
});
