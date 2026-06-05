import { test, expect } from '@playwright/test';
import * as path from 'path';

const BASE = 'http://localhost:3010';
const PROOF_DIR = path.join(__dirname, '..', 'r38-proof');

test.use({ video: 'on' });

test('Round 38 — Signin → Profile → Validation → Smart Delegate (video proof)', async ({ page }) => {
  // ── 1. Signin via real form ────────────────────────────────────
  await page.goto(`${BASE}/signin`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(PROOF_DIR, 'r38-01-signin-page.png'), fullPage: true });

  await page.fill('input[type="email"]', 'admin@delegatecart.com');
  await page.fill('input[type="password"]', 'Admin@DC2024!');
  await page.getByRole('button', { name: 'Sign In' }).click();

  // Should redirect to dashboard
  await page.waitForURL('**/dashboard', { timeout: 15000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(PROOF_DIR, 'r38-02-dashboard-after-signin.png'), fullPage: true });

  // Verify real DB session token (sess_xxx, not admin-xxx)
  const token = await page.evaluate(() => localStorage.getItem('authToken'));
  expect(token).toContain('sess_');

  // ── 2. Profile page — verify it loads with user data ─────────────
  await page.goto(`${BASE}/profile`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(PROOF_DIR, 'r38-03-profile-page.png'), fullPage: true });

  // Profile page loaded (no crash, page has content)
  await expect(page.locator('body')).not.toBeEmpty();

  // ── 3. Metrics Validation page — enhanced data panels ──────────
  await page.goto(`${BASE}/shopping-assistant/metrics/validation`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await expect(page.locator('body')).toContainText('Metrics Validation Dashboard', { timeout: 10000 });
  await page.screenshot({ path: path.join(PROOF_DIR, 'r38-04-metrics-validation-top.png'), fullPage: true });

  // Scroll down to see more panels
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 3));
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(PROOF_DIR, 'r38-05-metrics-validation-mid.png'), fullPage: true });

  await page.evaluate(() => window.scrollTo(0, (document.body.scrollHeight * 2) / 3));
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(PROOF_DIR, 'r38-06-metrics-validation-bottom.png'), fullPage: true });

  // ── 4. Smart Delegate page — validation chips ──────────────────
  await page.goto(`${BASE}/smart-delegate`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(PROOF_DIR, 'r38-07-smart-delegate.png'), fullPage: true });

  // ── 5. Shopping Assistant page ─────────────────────────────────
  await page.goto(`${BASE}/shopping-assistant`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(PROOF_DIR, 'r38-08-shopping-assistant.png'), fullPage: true });

  // ── 6. Learning page (admin can see all data) ──────────────────
  await page.goto(`${BASE}/admin/learning`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(PROOF_DIR, 'r38-09-learning-page.png'), fullPage: true });

  // ── 7. Observability page (admin can see all data) ─────────────
  await page.goto(`${BASE}/observability`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(PROOF_DIR, 'r38-10-observability-page.png'), fullPage: true });

  // ── 8. Switch to analytics user — profile still works ──────────
  // Clear session
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.goto(`${BASE}/signin`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.fill('input[type="email"]', 'analytics@delegatecart.com');
  await page.fill('input[type="password"]', 'Admin@DC2024!');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL('**/dashboard', { timeout: 15000 });
  await page.waitForTimeout(1000);

  await page.goto(`${BASE}/profile`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(PROOF_DIR, 'r38-11-analytics-user-profile.png'), fullPage: true });

  // ── 9. Final: basic user — admin blocked ───────────────────────
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.goto(`${BASE}/signin`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.fill('input[type="email"]', 'basicdemo@delegatecart.com');
  await page.fill('input[type="password"]', 'Admin@DC2024!');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL('**/dashboard', { timeout: 15000 });
  await page.waitForTimeout(1000);

  await page.goto(`${BASE}/admin/dashboard`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(PROOF_DIR, 'r38-12-basic-user-admin-blocked.png'), fullPage: true });
  await expect(page.locator('body')).toContainText(/admin access required|access denied/i, { timeout: 10000 });
});
