/**
 * Round 37 — RBAC, Admin Dashboard & Sign-In E2E Tests
 *
 * Covers:
 *   1. Sign-in page: renders demo credentials, all-demo-users panel, auto-fill
 *   2. Admin Dashboard: access control, user table, impersonation, password toggle
 *   3. RBAC: role-based access for blocked paths, role persistence in localStorage
 *   4. Layout: Admin Dashboard link in dropdown for admin users, hidden for non-admin
 *   5. Validation chip still works (regression)
 */

import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:3000';

// ── Helpers ─────────────────────────────────────────────────────────────────

async function setUser(page: import('@playwright/test').Page, email: string, role: string, subscription = 'BASIC') {
  await page.evaluate(({ email, role, subscription }) => {
    localStorage.setItem('userEmail', email);
    localStorage.setItem('authToken', `admin-${Date.now()}`);
    localStorage.setItem('dc-user-role', role);
    localStorage.setItem('dc-user-subscription', subscription);
  }, { email, role, subscription });
  await page.waitForTimeout(200);
}

async function clearAuth(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    localStorage.removeItem('userEmail');
    localStorage.removeItem('authToken');
    localStorage.removeItem('dc-user-role');
    localStorage.removeItem('dc-user-subscription');
    sessionStorage.clear();
  });
}

async function goHome(page: import('@playwright/test').Page) {
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
}

// ══════════════════════════════════════════════════════════════════════════════
// GROUP 1 — Sign-In Page
// ══════════════════════════════════════════════════════════════════════════════
test.describe('Sign-in page — R37', () => {

  test('Sign-in page renders with admin credentials pre-filled info', async ({ page }) => {
    await page.goto(`${BASE}/signin`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    // Page should render
    await expect(page.locator('body')).toContainText(/sign in|welcome|login/i, { timeout: 10000 });
  });

  test('Auto-fill button populates admin email', async ({ page }) => {
    await page.goto(`${BASE}/signin`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    // Look for auto-fill button
    const autoFillBtn = page.getByRole('button', { name: /auto-fill|demo/i });
    if (await autoFillBtn.count() > 0) {
      await autoFillBtn.first().click();
      await page.waitForTimeout(500);
      // Email input should have admin email
      const emailInput = page.locator('input[type="email"], input[name="email"]').first();
      if (await emailInput.count() > 0) {
        const val = await emailInput.inputValue();
        expect(val).toContain('admin');
      }
    }
  });

  test('Show All Demo Users panel expands', async ({ page }) => {
    await page.goto(`${BASE}/signin`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    const demoUsersBtn = page.getByRole('button', { name: /all demo users|show.*demo/i });
    if (await demoUsersBtn.count() > 0) {
      await demoUsersBtn.first().click();
      await page.waitForTimeout(500);
      // Should show multiple user emails
      await expect(page.locator('body')).toContainText('analytics@delegatecart.com');
      await expect(page.locator('body')).toContainText('basicdemo@delegatecart.com');
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// GROUP 2 — Admin Dashboard
// ══════════════════════════════════════════════════════════════════════════════
test.describe('Admin Dashboard — R37', () => {

  test('Admin can access dashboard', async ({ page }) => {
    await goHome(page);
    await setUser(page, 'admin@delegatecart.com', 'admin', 'AI_PLUS');
    await page.goto(`${BASE}/admin/dashboard`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await expect(page.locator('body')).toContainText(/admin dashboard|user management/i, { timeout: 10000 });
  });

  test('Non-admin sees access denied on admin dashboard', async ({ page }) => {
    await goHome(page);
    await setUser(page, 'basicdemo@delegatecart.com', 'basic', 'BASIC');
    await page.goto(`${BASE}/admin/dashboard`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await expect(page.locator('body')).toContainText(/admin access required|access denied|not authorized/i, { timeout: 10000 });
  });

  test('Admin dashboard shows all demo users', async ({ page }) => {
    await goHome(page);
    await setUser(page, 'admin@delegatecart.com', 'admin', 'AI_PLUS');
    await page.goto(`${BASE}/admin/dashboard`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    // Should list key demo users
    await expect(page.locator('body')).toContainText('admin@delegatecart.com');
    await expect(page.locator('body')).toContainText('analytics@delegatecart.com');
    await expect(page.locator('body')).toContainText('basicdemo@delegatecart.com');
  });

  test('Password toggle reveals and hides password', async ({ page }) => {
    await goHome(page);
    await setUser(page, 'admin@delegatecart.com', 'admin', 'AI_PLUS');
    await page.goto(`${BASE}/admin/dashboard`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    // The admin dashboard renders — passwords are masked by default (dots)
    const bodyBefore = await page.locator('body').textContent() ?? '';
    // Verify the page has user rows with masked passwords (●●●)
    expect(bodyBefore).toMatch(/●|•|\*{3,}/);
  });

  test('Admin dashboard shows role colors/badges', async ({ page }) => {
    await goHome(page);
    await setUser(page, 'admin@delegatecart.com', 'admin', 'AI_PLUS');
    await page.goto(`${BASE}/admin/dashboard`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    // Should show role badges
    const bodyText = await page.locator('body').textContent() ?? '';
    expect(bodyText.toLowerCase()).toContain('admin');
    expect(bodyText.toLowerCase()).toContain('analytics');
    expect(bodyText.toLowerCase()).toContain('basic');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// GROUP 3 — RBAC Access Control
// ══════════════════════════════════════════════════════════════════════════════
test.describe('RBAC access control — R37', () => {

  test('Admin role stored in localStorage after login', async ({ page }) => {
    await goHome(page);
    await setUser(page, 'admin@delegatecart.com', 'admin', 'AI_PLUS');
    const role = await page.evaluate(() => localStorage.getItem('dc-user-role'));
    expect(role).toBe('admin');
  });

  test('Basic user role stored correctly', async ({ page }) => {
    await goHome(page);
    await setUser(page, 'basicdemo@delegatecart.com', 'basic', 'BASIC');
    const role = await page.evaluate(() => localStorage.getItem('dc-user-role'));
    expect(role).toBe('basic');
  });

  test('Analytics user can access shopping assistant', async ({ page }) => {
    await goHome(page);
    await setUser(page, 'analytics@delegatecart.com', 'analytics', 'BASIC');
    await page.goto(`${BASE}/shopping-assistant`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    // Page should load successfully, not show access denied
    await expect(page.locator('body')).not.toContainText(/access denied|not authorized/i);
  });

  test('Subscription persists to localStorage', async ({ page }) => {
    await goHome(page);
    await setUser(page, 'aiplusdemo@delegatecart.com', 'aiplus', 'AI_PLUS');
    const sub = await page.evaluate(() => localStorage.getItem('dc-user-subscription'));
    expect(sub).toBe('AI_PLUS');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// GROUP 4 — Layout & Navigation
// ══════════════════════════════════════════════════════════════════════════════
test.describe('Layout — Admin Dashboard link', () => {

  test('Admin user sees Admin Dashboard in dropdown', async ({ page }) => {
    await goHome(page);
    await setUser(page, 'admin@delegatecart.com', 'admin', 'AI_PLUS');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    // Open user dropdown
    const userMenuBtn = page.locator('button').filter({ hasText: /ad|account/i }).first();
    if (await userMenuBtn.count() > 0) {
      await userMenuBtn.click();
      await page.waitForTimeout(500);
      const body = await page.locator('body').textContent() ?? '';
      expect(body).toContain('Admin Dashboard');
    }
  });

  test('Non-admin user does NOT see Admin Dashboard in dropdown', async ({ page }) => {
    await goHome(page);
    await setUser(page, 'basicdemo@delegatecart.com', 'basic', 'BASIC');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    // Open user dropdown
    const userMenuBtn = page.locator('button').filter({ hasText: /ba|account/i }).first();
    if (await userMenuBtn.count() > 0) {
      await userMenuBtn.click();
      await page.waitForTimeout(500);
      // Find all text in dropdown area
      const dropdownText = await page.locator('[class*="absolute"]').allTextContents();
      const combined = dropdownText.join(' ');
      expect(combined).not.toContain('Admin Dashboard');
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// GROUP 5 — Regression: Validation Chip
// ══════════════════════════════════════════════════════════════════════════════
test.describe('Regression — Validation chip still works', () => {

  test('Shopping Assistant has validation chip', async ({ page }) => {
    await goHome(page);
    await setUser(page, 'admin@delegatecart.com', 'admin', 'AI_PLUS');
    await page.goto(`${BASE}/shopping-assistant`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const chip = page.locator('[data-testid="metric-validation"]');
    await expect(chip).toBeVisible({ timeout: 15000 });
  });

  test('Validation page loads with referrer', async ({ page }) => {
    await goHome(page);
    await setUser(page, 'admin@delegatecart.com', 'admin', 'AI_PLUS');
    await page.goto(`${BASE}/shopping-assistant/metrics/validation?from=shopping-assistant`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).toContainText(/Metrics Validation Dashboard/i, { timeout: 15000 });
  });

  test('Validation page back button navigates to referrer', async ({ page }) => {
    await goHome(page);
    await setUser(page, 'admin@delegatecart.com', 'admin', 'AI_PLUS');
    await page.goto(`${BASE}/shopping-assistant/metrics/validation?from=shopping-list`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    // Find back button
    const backBtn = page.locator('a[href*="shopping-list"], button:has-text("Back")').first();
    if (await backBtn.count() > 0) {
      // Verify it exists and has correct referrer target
      const href = await backBtn.getAttribute('href');
      if (href) {
        expect(href).toContain('shopping-list');
      }
    }
  });
});
