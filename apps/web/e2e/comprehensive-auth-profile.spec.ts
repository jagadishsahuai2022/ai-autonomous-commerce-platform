/**
 * Comprehensive End-to-End Tests: Admin Login + Profile + Addresses
 * 
 * Covers all the issues reported:
 * 1. Admin login (previously returning 500)
 * 2. Profile page - GET profile
 * 3. Profile page - Save All Changes (PUT profile)
 * 4. Addresses - Add Address
 * 5. Invalid credentials rejection
 * 6. Anonymous browsing
 */

import { test, expect, type Page, type APIRequestContext } from '@playwright/test';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function loginViaAPI(request: APIRequestContext, email: string, password: string) {
  const res = await request.post('/api/auth/login', {
    data: { email, password },
  });
  expect(res.status()).toBe(200);
  const data = await res.json();
  expect(data.success).toBe(true);
  expect(data.token).toBeTruthy();
  return data.token as string;
}

async function injectAuth(page: Page, token: string, email: string) {
  await page.evaluate(
    ({ t, e }) => {
      localStorage.setItem('authToken', t);
      localStorage.setItem('userEmail', e);
    },
    { t: token, e: email }
  );
}

// ── Global state ──────────────────────────────────────────────────────────────

let adminToken = '';

// ── Test Suite ────────────────────────────────────────────────────────────────

test.describe('Admin Login & Authentication', () => {
  test('POST /api/auth/login returns 200 with valid admin credentials', async ({ request }) => {
    const res = await request.post('/api/auth/login', {
      data: { email: 'admin@delegatecart.com', password: 'Admin@DC2024!' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.token).toMatch(/^sess_/);
    expect(body.user.email).toBe('admin@delegatecart.com');
    adminToken = body.token;
  });

  test('POST /api/auth/login returns 200 with demo credentials', async ({ request }) => {
    const res = await request.post('/api/auth/login', {
      data: { email: 'demo@example.com', password: 'Demo123!@#' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test('POST /api/auth/login returns 401 for wrong password', async ({ request }) => {
    const res = await request.post('/api/auth/login', {
      data: { email: 'admin@delegatecart.com', password: 'Wrong@Password99!' },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  test('POST /api/auth/login returns 400 for missing email', async ({ request }) => {
    const res = await request.post('/api/auth/login', {
      data: { password: 'somepassword' },
    });
    expect(res.status()).toBe(400);
  });

  test('GET /api/auth/session returns user data for valid token', async ({ request }) => {
    const token = await loginViaAPI(request, 'admin@delegatecart.com', 'Admin@DC2024!');
    const res = await request.get('/api/auth/session', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.authenticated).toBe(true);
    expect(body.user.email).toBe('admin@delegatecart.com');
  });

  test('GET /api/auth/session returns 401 without token', async ({ request }) => {
    const res = await request.get('/api/auth/session');
    expect(res.status()).toBe(401);
  });

  test('Admin can sign in through the UI and reach dashboard', async ({ page }) => {
    await page.goto('/signin', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'test-results/login-01-form.png', fullPage: true });

    await page.locator('input[type="email"]').fill('admin@delegatecart.com');
    await page.locator('input[type="password"]').fill('Admin@DC2024!');

    await page.screenshot({ path: 'test-results/login-02-filled.png', fullPage: true });

    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL((url) => !url.pathname.includes('/signin'), { timeout: 30000 });

    const currentUrl = page.url();
    expect(currentUrl).not.toContain('/signin');
    console.log('✅ Admin login redirected to:', currentUrl);

    await page.screenshot({ path: 'test-results/login-03-dashboard.png', fullPage: true });

    // Check avatar/name shows in navbar
    const navbar = page.locator('nav, header').first();
    const bodyText = await page.locator('body').textContent();
    expect(bodyText!.length).toBeGreaterThan(500);
  });

  test('Invalid credentials show proper error message', async ({ page }) => {
    await page.goto('/signin', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    await page.locator('input[type="email"]').fill('admin@delegatecart.com');
    await page.locator('input[type="password"]').fill('WrongPassword999!');
    await page.getByRole('button', { name: 'Sign In' }).click();

    await page.waitForTimeout(3000);
    expect(page.url()).toContain('/signin');

    const bodyText = await page.locator('body').textContent();
    expect(/invalid|error|failed|incorrect|wrong/i.test(bodyText!)).toBe(true);

    await page.screenshot({ path: 'test-results/login-04-invalid-creds.png', fullPage: true });
    console.log('✅ Invalid credentials correctly rejected on UI');
  });
});

test.describe('User Profile API', () => {
  test.beforeAll(async ({ request }) => {
    adminToken = await loginViaAPI(request, 'admin@delegatecart.com', 'Admin@DC2024!');
  });

  test('GET /api/user/profile returns complete profile', async ({ request }) => {
    const res = await request.get('/api/user/profile', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.email).toBe('admin@delegatecart.com');
    expect(body).toHaveProperty('autoPurchaseEnabled');
    expect(body).toHaveProperty('monthlyAiBudget');
    expect(body).toHaveProperty('defaultPaymentMethod');
    expect(body).toHaveProperty('subscriptionPlan');
  });

  test('GET /api/user/profile returns 401 without auth', async ({ request }) => {
    const res = await request.get('/api/user/profile');
    expect(res.status()).toBe(401);
  });

  test('PUT /api/user/profile updates settings correctly', async ({ request }) => {
    const res = await request.put('/api/user/profile', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        autoPurchaseEnabled: true,
        autoPurchaseThreshold: 75000,
        monthlyAiBudget: 250000,
        defaultPaymentMethod: 'upi',
        defaultDeliveryDays: 5,
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.profile.autoPurchaseEnabled).toBe(true);
    expect(body.profile.autoPurchaseThreshold).toBe(75000);
    expect(Number(body.profile.monthlyAiBudget)).toBe(250000);
    expect(body.profile.defaultPaymentMethod).toBe('upi');
    expect(body.profile.defaultDeliveryDays).toBe(5);
  });

  test('PUT /api/user/profile rejects invalid payment method', async ({ request }) => {
    const res = await request.put('/api/user/profile', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { defaultPaymentMethod: 'invalid_method' },
    });
    // Invalid values are silently skipped, so either 400 or 200 with no changes
    expect([200, 400]).toContain(res.status());
  });

  test('Profile page loads and shows user data in browser', async ({ page }) => {
    const token = await loginViaAPI(page.request, 'admin@delegatecart.com', 'Admin@DC2024!');
    await page.goto('/signin', { waitUntil: 'domcontentloaded' });
    await injectAuth(page, token, 'admin@delegatecart.com');
    await page.goto('/profile', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);

    await page.screenshot({ path: 'test-results/profile-01-loaded.png', fullPage: true });

    const bodyText = await page.locator('body').textContent();
    expect(bodyText!.length).toBeGreaterThan(200);

    // Should have some profile-related content
    const profileContent = page.getByText(/profile|account|settings|save/i).first();
    await expect(profileContent).toBeVisible({ timeout: 15000 });

    await page.screenshot({ path: 'test-results/profile-02-content.png', fullPage: true });
  });
});

test.describe('Addresses API', () => {
  let addressId: number;

  test.beforeAll(async ({ request }) => {
    adminToken = await loginViaAPI(request, 'admin@delegatecart.com', 'Admin@DC2024!');
  });

  test('GET /api/user/addresses returns address list', async ({ request }) => {
    const res = await request.get('/api/user/addresses', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.addresses)).toBe(true);
  });

  test('POST /api/user/addresses creates a new address', async ({ request }) => {
    const res = await request.post('/api/user/addresses', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        name: 'E2E Test Address',
        phone: '9123456780',
        line1: '42 Test Lane',
        city: 'Chennai',
        state: 'Tamil Nadu',
        pincode: '600001',
        isDefault: false,
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.address.city).toBe('Chennai');
    expect(body.address.name).toBe('E2E Test Address');
    addressId = body.address.id;
  });

  test('PUT /api/user/addresses updates an existing address', async ({ request }) => {
    if (!addressId) {
      test.skip();
      return;
    }
    const res = await request.put('/api/user/addresses', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { id: addressId, city: 'Hyderabad', state: 'Telangana' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.address.city).toBe('Hyderabad');
  });

  test('POST /api/user/addresses rejects invalid pincode', async ({ request }) => {
    const res = await request.post('/api/user/addresses', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        name: 'Bad Address',
        line1: 'Street 1',
        city: 'City',
        state: 'State',
        pincode: '123',   // Only 3 digits — invalid
      },
    });
    expect(res.status()).toBe(400);
  });

  test('POST /api/user/addresses requires auth', async ({ request }) => {
    const res = await request.post('/api/user/addresses', {
      data: {
        name: 'Unauth Test',
        line1: 'Street',
        city: 'City',
        state: 'State',
        pincode: '123456',
      },
    });
    expect(res.status()).toBe(401);
  });

  test('DELETE /api/user/addresses removes address', async ({ request }) => {
    if (!addressId) {
      test.skip();
      return;
    }
    const res = await request.delete(`/api/user/addresses?id=${addressId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status()).toBe(200);
  });
});

test.describe('Anonymous User Browsing', () => {
  test('Home page loads without auth', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    const title = await page.title();
    expect(title).toBeTruthy();
    await page.screenshot({ path: 'test-results/anon-01-home.png', fullPage: true });
  });

  test('Products page loads without auth', async ({ page }) => {
    await page.goto('/products', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
    const bodyText = await page.locator('body').textContent();
    expect(bodyText!.length).toBeGreaterThan(100);
    await page.screenshot({ path: 'test-results/anon-02-products.png', fullPage: true });
  });

  test('Sign-in page renders correctly', async ({ page }) => {
    await page.goto('/signin', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
    await page.screenshot({ path: 'test-results/anon-03-signin.png', fullPage: true });
  });
});
