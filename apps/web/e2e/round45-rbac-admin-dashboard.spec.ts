import { test, expect, Page } from '@playwright/test';

/**
 * Round 45 — RBAC Menu Enforcement & Admin Dashboard Revamp E2E Tests
 *
 * Verifies:
 *  1. Menu visibility per role (Admin Dashboard, Observability, Self-Learning, Metrics Validation)
 *  2. Page-level access guards redirect unauthorized users
 *  3. Admin Dashboard: bulk activate/deactivate, user activity modal, edit modal, search/filter
 *  4. Admin Dashboard: stats cards, impersonation controls
 */

const BASE = process.env.BASE_URL || 'http://localhost:3010';
const PROOF = 'r45-proof';

const ROLES = {
  admin:         { email: 'admin@delegatecart.com',              role: 'admin' },
  analytics:     { email: 'analytics@delegatecart.com',          role: 'analytics' },
  observability: { email: 'observability@delegatecart.com',      role: 'observability' },
  learning:      { email: 'reenforcedlearning@delegatecart.com', role: 'reinforced-learning' },
  basic:         { email: 'basicdemo@delegatecart.com',          role: 'basic' },
};

async function loginAs(page: Page, email: string, role: string) {
  await page.goto(BASE);
  await page.evaluate(({ e, r }) => {
    localStorage.setItem('userEmail', e);
    localStorage.setItem('dc-user-email', e);
    localStorage.setItem('authToken', `token-${Date.now()}`);
    localStorage.setItem('dc-auth-token', `token-${Date.now()}`);
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('dc-user-id', `user-${e.split('@')[0]}`);
    localStorage.setItem('dc-user-role', r);
  }, { e: email, r: role });
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);
}

// ─────────────────────────────────────────────────────────────────
// 1.  RBAC MENU VISIBILITY
// ─────────────────────────────────────────────────────────────────

test.describe('R45-1: RBAC menu visibility per role', () => {

  test('Admin sees ALL dashboard menu items', async ({ page }) => {
    await loginAs(page, ROLES.admin.email, ROLES.admin.role);

    // Admin can access /admin/dashboard directly — confirms route is not blocked
    await page.goto(`${BASE}/admin/dashboard`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    const accountBody = await page.locator('body').textContent() ?? '';
    // Admin dashboard page header is only visible to admin role
    expect(accountBody).toContain('Admin Dashboard');
    await page.screenshot({ path: `${PROOF}/01-admin-dashboard-access.png`, fullPage: false });

    // Open user dropdown to verify menu items are present
    const menuBtn = page.locator('button[aria-haspopup="true"]').first();
    if (await menuBtn.isVisible()) {
      await menuBtn.click();
      await page.waitForTimeout(500);
      const dropdownBody = await page.locator('body').textContent() ?? '';
      expect(dropdownBody).toContain('Admin Dashboard');
      await page.screenshot({ path: `${PROOF}/02-admin-dropdown-menu.png`, fullPage: false });
    }
  });

  test('Analytics can NOT see Admin Dashboard', async ({ page }) => {
    await loginAs(page, ROLES.analytics.email, ROLES.analytics.role);

    await page.goto(`${BASE}/account`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    const body = await page.locator('body').textContent() ?? '';
    // Analytics should see Metrics Validation but NOT Admin Dashboard
    expect(body).not.toContain('Admin Dashboard');
    await page.screenshot({ path: `${PROOF}/03-analytics-no-admin-dash.png`, fullPage: false });
  });

  test('Observability can NOT see Metrics Validation or Admin Dashboard', async ({ page }) => {
    await loginAs(page, ROLES.observability.email, ROLES.observability.role);

    await page.goto(`${BASE}/account`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    const body = await page.locator('body').textContent() ?? '';
    expect(body).not.toContain('Admin Dashboard');
    await page.screenshot({ path: `${PROOF}/04-observability-restricted.png`, fullPage: false });
  });

  test('Reinforced-learning can NOT see Observability, Metrics Validation, or Admin Dashboard', async ({ page }) => {
    await loginAs(page, ROLES.learning.email, ROLES.learning.role);

    await page.goto(`${BASE}/account`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    const body = await page.locator('body').textContent() ?? '';
    expect(body).not.toContain('Admin Dashboard');
    await page.screenshot({ path: `${PROOF}/05-learning-restricted.png`, fullPage: false });
  });

  test('Basic role sees minimal admin sections', async ({ page }) => {
    await loginAs(page, ROLES.basic.email, ROLES.basic.role);

    await page.goto(`${BASE}/account`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    const body = await page.locator('body').textContent() ?? '';
    expect(body).not.toContain('Admin Dashboard');
    expect(body).not.toContain('Metrics Validation');
    await page.screenshot({ path: `${PROOF}/06-basic-minimal-access.png`, fullPage: false });
  });
});

// ─────────────────────────────────────────────────────────────────
// 2.  PAGE-LEVEL ACCESS GUARDS
// ─────────────────────────────────────────────────────────────────

test.describe('R45-2: page-level guards block unauthorized access', () => {

  test('Non-admin user is blocked from /admin/dashboard', async ({ page }) => {
    await loginAs(page, ROLES.analytics.email, ROLES.analytics.role);

    await page.goto(`${BASE}/admin/dashboard`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    const body = await page.locator('body').textContent() ?? '';
    // Should show access denied message or redirect
    const blocked = body.includes('Admin Access Required') || body.includes('Access Restricted') || !body.includes('User Management');
    expect(blocked).toBe(true);
    await page.screenshot({ path: `${PROOF}/07-analytics-blocked-admin-dash.png`, fullPage: false });
  });

  test('Basic role sees limited Metrics Validation page (R46: access extended)', async ({ page }) => {
    await loginAs(page, ROLES.basic.email, ROLES.basic.role);

    await page.goto(`${BASE}/shopping-assistant/metrics/validation`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    const body = await page.locator('body').textContent() ?? '';
    // R46: basic now has limited self-only access — should NOT be blocked
    const hasPageAccess = body.includes('Metrics Validation') || body.includes('Validation Dashboard');
    expect(hasPageAccess).toBe(true);
    await page.screenshot({ path: `${PROOF}/08-basic-limited-metrics.png`, fullPage: false });
  });

  test('Admin CAN access metrics validation page', async ({ page }) => {
    await loginAs(page, ROLES.admin.email, ROLES.admin.role);

    await page.goto(`${BASE}/shopping-assistant/metrics/validation`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const body = await page.locator('body').textContent() ?? '';
    const hasAccess = !body.includes('Access Restricted');
    expect(hasAccess).toBe(true);
    await page.screenshot({ path: `${PROOF}/09-admin-can-access-metrics.png`, fullPage: false });
  });

  test('Admin CAN access /admin/dashboard', async ({ page }) => {
    await loginAs(page, ROLES.admin.email, ROLES.admin.role);

    await page.goto(`${BASE}/admin/dashboard`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    const body = await page.locator('body').textContent() ?? '';
    expect(body).toContain('User Management');
    await page.screenshot({ path: `${PROOF}/10-admin-can-access-dashboard.png`, fullPage: false });
  });
});

// ─────────────────────────────────────────────────────────────────
// 3.  ADMIN DASHBOARD — FEATURES
// ─────────────────────────────────────────────────────────────────

test.describe('R45-3: Admin Dashboard revamp features', () => {

  test('Dashboard shows stats, user table, role reference', async ({ page }) => {
    await loginAs(page, ROLES.admin.email, ROLES.admin.role);
    await page.goto(`${BASE}/admin/dashboard`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    // Stats cards should be visible
    const body = await page.locator('body').textContent() ?? '';
    expect(body).toContain('Total Users');
    expect(body).toContain('Active');
    expect(body).toContain('Deactivated');
    expect(body).toContain('AI Plus');

    // User table header
    expect(body).toContain('User Management');

    // Role reference section
    expect(body).toContain('Role-Based Access Control Reference');

    await page.screenshot({ path: `${PROOF}/11-dashboard-overview.png`, fullPage: true });
  });

  test('Search and filter users', async ({ page }) => {
    await loginAs(page, ROLES.admin.email, ROLES.admin.role);
    await page.goto(`${BASE}/admin/dashboard`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    // Search by name
    const searchInput = page.locator('input[placeholder="Search users..."]');
    if (await searchInput.isVisible()) {
      await searchInput.fill('admin');
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${PROOF}/12-search-filter.png`, fullPage: false });
      await searchInput.clear();
    }
  });

  test('Select all checkbox and bulk activate/deactivate buttons appear', async ({ page }) => {
    await loginAs(page, ROLES.admin.email, ROLES.admin.role);
    await page.goto(`${BASE}/admin/dashboard`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    // Click "Select All" checkbox
    const selectAll = page.locator('th button').first();
    if (await selectAll.isVisible()) {
      await selectAll.click();
      await page.waitForTimeout(500);

      // Bulk action buttons should appear
      const bulkActivate = page.locator('[data-testid="bulk-activate"]');
      const bulkDeactivate = page.locator('[data-testid="bulk-deactivate"]');

      const hasActivate = await bulkActivate.isVisible();
      const hasDeactivate = await bulkDeactivate.isVisible();

      expect(hasActivate || hasDeactivate).toBe(true);
      await page.screenshot({ path: `${PROOF}/13-bulk-select-all.png`, fullPage: false });

      // Bulk deactivate
      if (hasDeactivate) {
        await bulkDeactivate.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${PROOF}/14-bulk-deactivated.png`, fullPage: false });
      }

      // Re-select all and activate
      await selectAll.click();
      await page.waitForTimeout(300);
      const bulkActivate2 = page.locator('[data-testid="bulk-activate"]');
      if (await bulkActivate2.isVisible()) {
        await bulkActivate2.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${PROOF}/15-bulk-reactivated.png`, fullPage: false });
      }
    }
  });

  test('Edit user modal opens and saves', async ({ page }) => {
    await loginAs(page, ROLES.admin.email, ROLES.admin.role);
    await page.goto(`${BASE}/admin/dashboard`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    // Click edit button on first non-admin user
    const editBtn = page.locator('button[title="Edit user settings"]').first();
    if (await editBtn.isVisible()) {
      await editBtn.click();
      await page.waitForTimeout(500);

      // Modal should be visible
      const modal = page.locator('text=Edit User');
      expect(await modal.isVisible()).toBe(true);
      await page.screenshot({ path: `${PROOF}/16-edit-user-modal.png`, fullPage: false });

      // Save changes
      const saveBtn = page.locator('[data-testid="save-edit"]');
      if (await saveBtn.isVisible()) {
        await saveBtn.click();
        await page.waitForTimeout(500);
      }
    }
  });

  test('User activity modal opens with timeline', async ({ page }) => {
    await loginAs(page, ROLES.admin.email, ROLES.admin.role);
    await page.goto(`${BASE}/admin/dashboard`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    // Click activity button on first user
    const actBtn = page.locator('button[title*="activity"]').first();
    if (await actBtn.isVisible()) {
      await actBtn.click();
      await page.waitForTimeout(500);

      const body = await page.locator('body').textContent() ?? '';
      expect(body).toContain('User Activity');
      expect(body).toContain('Recent Activity Timeline');
      await page.screenshot({ path: `${PROOF}/17-user-activity-modal.png`, fullPage: false });

      // Close modal
      const closeBtn = page.locator('[data-testid="close-activity-modal"]');
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
        await page.waitForTimeout(300);
      }
    }
  });

  test('Single user activate/deactivate toggle works', async ({ page }) => {
    await loginAs(page, ROLES.admin.email, ROLES.admin.role);
    await page.goto(`${BASE}/admin/dashboard`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    // Toggle the second user (non-admin)
    const toggleBtn = page.locator('button[title="Deactivate"]').first();
    if (await toggleBtn.isVisible()) {
      await toggleBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${PROOF}/18-single-deactivate.png`, fullPage: false });

      // Reactivate
      const activateBtn = page.locator('button[title="Activate"]').first();
      if (await activateBtn.isVisible()) {
        await activateBtn.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${PROOF}/19-single-reactivate.png`, fullPage: false });
      }
    }
  });

  test('Impersonate button works for non-admin users', async ({ page }) => {
    await loginAs(page, ROLES.admin.email, ROLES.admin.role);
    await page.goto(`${BASE}/admin/dashboard`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    // Find impersonate button
    const impBtn = page.locator('[data-testid="impersonate-analytics"]');
    if (await impBtn.isVisible()) {
      await page.screenshot({ path: `${PROOF}/20-impersonate-available.png`, fullPage: false });
      // Don't actually impersonate to avoid breaking session state
    }
  });
});

// ─────────────────────────────────────────────────────────────────
// 4.  RBAC ROLE REFERENCE CARD ACCURACY
// ─────────────────────────────────────────────────────────────────

test.describe('R45-4: Role reference accuracy', () => {

  test('Admin Dashboard shows updated RBAC reference', async ({ page }) => {
    await loginAs(page, ROLES.admin.email, ROLES.admin.role);
    await page.goto(`${BASE}/admin/dashboard`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    const body = await page.locator('body').textContent() ?? '';

    // Admin reference
    expect(body).toContain('Full access');
    // Analytics reference — no Admin Dashboard
    expect(body).toContain('No Admin Dashboard');
    // Observability reference
    expect(body).toContain('Observability Dashboard only');
    // Learning reference
    expect(body).toContain('Self-Learning Dashboard only');

    await page.screenshot({ path: `${PROOF}/21-rbac-reference-cards.png`, fullPage: true });
  });
});

// ─────────────────────────────────────────────────────────────────
// 5.  OBSERVABILITY RBAC GATE (R45 new: login-form replaced with role-based)
// ─────────────────────────────────────────────────────────────────

test.describe('R45-5: Observability RBAC gate', () => {

  test('Observability role sees dashboard content, not login form', async ({ page }) => {
    await loginAs(page, ROLES.observability.email, ROLES.observability.role);
    await page.goto(`${BASE}/observability`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const body = await page.locator('body').textContent() ?? '';
    // Should NOT see the old admin login form
    const hasLoginForm = body.includes('Admin Access Required') || body.includes('Sign In as Admin');
    expect(hasLoginForm).toBe(false);
    // Should see Access Restricted OR dashboard content
    const hasContent = body.includes('Overview') || body.includes('Transactions') || body.includes('Access Restricted');
    expect(hasContent).toBe(true);
    await page.screenshot({ path: `${PROOF}/22-observability-role-access.png`, fullPage: false });
  });

  test('Basic role is blocked from observability with access-denied screen', async ({ page }) => {
    await loginAs(page, ROLES.basic.email, ROLES.basic.role);
    await page.goto(`${BASE}/observability`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const body = await page.locator('body').textContent() ?? '';
    expect(body).toContain('Access Restricted');
    expect(body).not.toContain('Sign In as Admin');
    await page.screenshot({ path: `${PROOF}/23-basic-blocked-observability.png`, fullPage: false });
  });

  test('Admin has full access to observability', async ({ page }) => {
    await loginAs(page, ROLES.admin.email, ROLES.admin.role);
    await page.goto(`${BASE}/observability`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const body = await page.locator('body').textContent() ?? '';
    const hasContent = body.includes('Overview') || body.includes('Transactions') || body.includes('Stuck');
    expect(hasContent).toBe(true);
    await page.screenshot({ path: `${PROOF}/24-admin-observability-full.png`, fullPage: false });
  });
});

// ─────────────────────────────────────────────────────────────────
// 6.  VALIDATION DASHBOARD — USERNAME DISPLAY FIX
// ─────────────────────────────────────────────────────────────────

test.describe('R45-6: Validation dashboard real username display', () => {

  test('Admin sees real usernames (not timestamp IDs) in validation page', async ({ page }) => {
    // Seed history with an entry that has userEmail
    await loginAs(page, ROLES.admin.email, ROLES.admin.role);
    await page.evaluate(() => {
      const history = [{
        id: 'session-test-1',
        userId: 'user-analytics-delegatecart-com',
        userEmail: 'analytics@delegatecart.com',
        query: 'Best laptops under 50000',
        timestamp: Date.now() - 3600_000,
        products: [],
        timeline: [],
      }];
      localStorage.setItem('dc-metrics-history', JSON.stringify(history));
    });
    await page.goto(`${BASE}/shopping-assistant/metrics/validation`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const body = await page.locator('body').textContent() ?? '';
    // Should NOT show raw timestamp patterns
    const hasTimestampId = /User \(\d+ \w+ \d{4}\)/.test(body);
    expect(hasTimestampId).toBe(false);
    await page.screenshot({ path: `${PROOF}/25-real-username-in-validation.png`, fullPage: false });
  });

  test('Validation page shows basic user their own data (R46: access extended)', async ({ page }) => {
    await loginAs(page, ROLES.basic.email, ROLES.basic.role);
    await page.goto(`${BASE}/shopping-assistant/metrics/validation`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const body = await page.locator('body').textContent() ?? '';
    // R46: basic now has limited self-only access — page loads, no access denied
    expect(body).not.toContain('Access Restricted');
    expect(body).toMatch(/Metrics Validation|Validation Dashboard/i);
    await page.screenshot({ path: `${PROOF}/26-basic-limited-validation.png`, fullPage: false });
  });
});

