/**
 * R38 E2E Tests — API Auth Fix, RBAC, Validation Chips
 * Tests all fixes applied in Round 38:
 * 1. Login API passwordless demo mode for all 6 demo users
 * 2. Profile API with real DB session tokens
 * 3. Addresses API with real DB session tokens
 * 4. Demo token fallback via x-user-email header
 * 5. All key pages return 200
 * 6. Feature flags endpoint (no auth required)
 */

import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3010';

const DEMO_USERS = [
  { email: 'admin@delegatecart.com', role: 'admin', subscription: 'AI_PLUS' },
  { email: 'analytics@delegatecart.com', role: 'analytics', subscription: 'BASIC' },
  { email: 'aiplusdemo@delegatecart.com', role: 'aiplus', subscription: 'AI_PLUS' },
  { email: 'observability@delegatecart.com', role: 'observability', subscription: 'BASIC' },
  { email: 'reenforcedlearning@delegatecart.com', role: 'reinforced-learning', subscription: 'BASIC' },
  { email: 'basicdemo@delegatecart.com', role: 'basic', subscription: 'BASIC' },
];

test.describe('R38 — Login & Profile API Fixes', () => {
  for (const user of DEMO_USERS) {
    test(`Login (passwordless) → ${user.email}`, async ({ request }) => {
      const res = await request.post(`${BASE}/api/auth/login`, {
        data: { email: user.email },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.token).toBeTruthy();
      expect(body.token).toContain('sess_');
      expect(body.user).toBeTruthy();
      expect(body.user.email).toBe(user.email);
    });

    test(`Profile via DB token → ${user.email}`, async ({ request }) => {
      const login = await request.post(`${BASE}/api/auth/login`, {
        data: { email: user.email },
      });
      const { token } = await login.json();
      const profile = await request.get(`${BASE}/api/user/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(profile.status()).toBe(200);
      const data = await profile.json();
      expect(data.email).toBe(user.email);
    });
  }

  test('Addresses API via DB token (admin)', async ({ request }) => {
    const login = await request.post(`${BASE}/api/auth/login`, {
      data: { email: 'admin@delegatecart.com' },
    });
    const { token } = await login.json();
    const res = await request.get(`${BASE}/api/user/addresses`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.addresses).toBeDefined();
  });

  test('Profile fallback via x-user-email header (demo token)', async ({ request }) => {
    const res = await request.get(`${BASE}/api/user/profile`, {
      headers: {
        Authorization: 'Bearer admin-demo-token',
        'X-User-Email': 'admin@delegatecart.com',
      },
    });
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.email).toBe('admin@delegatecart.com');
  });

  test('Addresses fallback via x-user-email header (demo token)', async ({ request }) => {
    const res = await request.get(`${BASE}/api/user/addresses`, {
      headers: {
        Authorization: 'Bearer admin-demo-token',
        'X-User-Email': 'admin@delegatecart.com',
      },
    });
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.addresses).toBeDefined();
  });

  test('Profile returns 401 without valid auth', async ({ request }) => {
    const res = await request.get(`${BASE}/api/user/profile`, {
      headers: { Authorization: 'Bearer invalid-token-xyz' },
    });
    expect(res.status()).toBe(401);
  });
});

test.describe('R38 — Page Accessibility', () => {
  const pages = [
    '/signin',
    '/profile',
    '/shopping-assistant',
    '/smart-delegate',
    '/shopping-assistant/metrics/validation',
    '/admin/learning',
    '/observability',
    '/admin/dashboard',
    '/shopping-list',
    '/cart',
  ];

  for (const path of pages) {
    test(`Page loads: ${path}`, async ({ request }) => {
      const res = await request.get(`${BASE}${path}`);
      expect(res.status()).toBe(200);
    });
  }
});

test.describe('R38 — Signin Flow (Browser)', () => {
  test('Admin signin → dashboard redirect → profile accessible', async ({ page }) => {
    await page.goto(`${BASE}/signin`);
    await page.fill('input[type="email"]', 'admin@delegatecart.com');
    await page.fill('input[type="password"]', 'Admin@DC2024!');
    await page.getByRole('button', { name: 'Sign In' }).click();
    
    // Should redirect to dashboard
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    expect(page.url()).toContain('/dashboard');
    
    // localStorage should have a real session token
    const token = await page.evaluate(() => localStorage.getItem('authToken'));
    expect(token).toBeTruthy();
    // Token should be a real DB session (sess_xxx) not a demo token (admin-xxx)
    expect(token).toContain('sess_');
    
    // Navigate to profile — should load without 401
    await page.goto(`${BASE}/profile`);
    await page.waitForTimeout(2000);
    
    // Check no 401 errors in console
    const errors: string[] = [];
    page.on('response', (res) => {
      if (res.status() === 401) errors.push(res.url());
    });
    await page.waitForTimeout(3000);
    expect(errors.length).toBe(0);
  });

  test('All demo users can sign in successfully', async ({ page }) => {
    for (const user of DEMO_USERS) {
      await page.goto(`${BASE}/signin`);
      await page.fill('input[type="email"]', user.email);
      await page.fill('input[type="password"]', 'Admin@DC2024!');
      await page.getByRole('button', { name: 'Sign In' }).click();
      await page.waitForURL('**/dashboard', { timeout: 10000 });
      expect(page.url()).toContain('/dashboard');
      
      // Clear session for next user
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
    }
  });
});

test.describe('R38 — Feature Flags & Health', () => {
  test('Feature flags returns 200 (no auth)', async ({ request }) => {
    const res = await request.get(`${BASE}/api/feature-flags`);
    expect(res.status()).toBe(200);
  });
});
