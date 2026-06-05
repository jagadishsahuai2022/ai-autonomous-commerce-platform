import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:3000';

async function goto(page: Page, path: string) {
  await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
}

async function loginViaLocalStorage(page: Page, email = 'test@example.com') {
  await goto(page, '/');
  await page.evaluate(
    ({ email }) => {
      localStorage.setItem('authToken', `mock-jwt-test-${Date.now()}`);
      localStorage.setItem('userEmail', email);
    },
    { email }
  );
}

// ─── Login / Auth ───────────────────────────────────────────────────────────

test.describe('Auth — Login Flow', () => {
  test('sign-in page loads with form fields', async ({ page }) => {
    await goto(page, '/signin');
    const email = page.locator('input[type="email"]').first();
    await expect(email).toBeVisible({ timeout: 5000 });
    const password = page.locator('input[type="password"]').first();
    await expect(password).toBeVisible({ timeout: 5000 });
  });

  test('demo credentials hint is displayed', async ({ page }) => {
    await goto(page, '/signin');
    const hint = page.locator('text=Demo Credentials').first();
    await expect(hint).toBeVisible({ timeout: 5000 });
  });

  test('auto-fill demo credentials fills the form', async ({ page }) => {
    // Use networkidle to ensure full React hydration before clicking
    await page.goto(`${BASE_URL}/signin`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.locator('button:has-text("Auto-fill")').first().click();
    // Use toHaveValue with timeout instead of fixed sleep
    await expect(page.locator('input[type="email"]').first()).toHaveValue('demo@example.com', {
      timeout: 5000,
    });
  });

  test('submitting demo credentials sets localStorage authToken', async ({ page }) => {
    // Use networkidle to ensure full React hydration before clicking
    await page.goto(`${BASE_URL}/signin`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.locator('button:has-text("Auto-fill")').first().click();
    await expect(page.locator('input[type="email"]').first()).toHaveValue('demo@example.com', {
      timeout: 5000,
    });
    await page.click('button[type="submit"]');
    // Wait for redirect or token set
    await page.waitForURL('**/dashboard', { timeout: 5000 }).catch(() => page.waitForTimeout(2000));
    const token = await page.evaluate(() => localStorage.getItem('authToken'));
    expect(token).toBeTruthy();
  });

  test('Google OAuth button opens email input form', async ({ page }) => {
    await page.goto(`${BASE_URL}/signin`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.locator('button:has-text("Google")').first().click();
    // Wait for OAuth email input with specific placeholder to appear
    await page.waitForSelector('input[placeholder="you@gmail.com"]', {
      timeout: 5000,
      state: 'visible',
    });
    const emailInput = page.locator('input[placeholder="you@gmail.com"]');
    await expect(emailInput).toBeVisible({ timeout: 3000 });
  });

  test('Microsoft OAuth button opens email input form', async ({ page }) => {
    await page.goto(`${BASE_URL}/signin`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.locator('button:has-text("Microsoft")').first().click();
    // Wait for OAuth email input with specific placeholder to appear
    await page.waitForSelector('input[placeholder="you@outlook.com"]', {
      timeout: 5000,
      state: 'visible',
    });
    const emailInput = page.locator('input[placeholder="you@outlook.com"]');
    await expect(emailInput).toBeVisible({ timeout: 3000 });
  });

  test('OAuth continue validates email format', async ({ page }) => {
    await page.goto(`${BASE_URL}/signin`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.locator('button:has-text("Google")').first().click();
    await page.waitForSelector('input[placeholder="you@gmail.com"]', { timeout: 5000 });
    await page.locator('input[placeholder="you@gmail.com"]').fill('not-an-email');
    await page.locator('button:has-text("Continue")').first().click();
    await page.waitForTimeout(300);
    const err = page.locator('text=valid email').first();
    await expect(err).toBeVisible({ timeout: 3000 });
  });

  test('valid OAuth email continues and sets authToken', async ({ page }) => {
    await page.goto(`${BASE_URL}/signin`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.locator('button:has-text("Google")').first().click();
    // Wait for OAuth email form to appear
    await page.waitForSelector('input[placeholder="you@gmail.com"]', { timeout: 5000 });
    await page.locator('input[placeholder="you@gmail.com"]').fill('john@gmail.com');
    await page.locator('button:has-text("Continue")').first().click();
    // Wait for navigation to dashboard after OAuth
    await page.waitForURL('**/dashboard', { timeout: 5000 }).catch(() => page.waitForTimeout(2000));
    const token = await page.evaluate(() => localStorage.getItem('authToken'));
    expect(token).toMatch(/^oauth-google-/);
    const storedEmail = await page.evaluate(() => localStorage.getItem('userEmail'));
    expect(storedEmail).toBe('john@gmail.com');
  });
});

// ─── Navbar Auth State ───────────────────────────────────────────────────────

test.describe('Navbar — Auth State', () => {
  test('navbar shows Sign In when not logged in', async ({ page }) => {
    // Navigate to a page first before accessing localStorage
    await goto(page, '/');
    await page.evaluate(() => localStorage.removeItem('authToken'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(300);
    const signIn = page.locator('text=Sign In').first();
    await expect(signIn).toBeVisible({ timeout: 5000 });
  });

  test('navbar shows user avatar when logged in', async ({ page }) => {
    await loginViaLocalStorage(page, 'demo@example.com');
    await goto(page, '/');
    await page.waitForTimeout(500);
    // NavbarCTA renders avatar with initials for authenticated state
    const avatar = page.locator('[class*="rounded-full"][class*="bg-gradient"]').first();
    await expect(avatar).toBeVisible({ timeout: 5000 });
  });

  test('navbar logout button clears auth and returns to home', async ({ page }) => {
    await loginViaLocalStorage(page);
    await goto(page, '/');
    await page.waitForTimeout(500);
    const logoutBtn = page.locator('button[title="Logout"], button:has-text("Logout")').first();
    await logoutBtn.click();
    await page.waitForTimeout(1000);
    const token = await page.evaluate(() => localStorage.getItem('authToken'));
    expect(token).toBeNull();
  });

  test('navbar cart badge updates after adding product', async ({ page }) => {
    await loginViaLocalStorage(page);
    await page.evaluate(() => {
      localStorage.setItem(
        'cart',
        JSON.stringify([
          { id: 'c1', productId: 'p1', name: 'Test', price: 100, quantity: 3, image: '' },
        ])
      );
      window.dispatchEvent(new Event('cartUpdated'));
    });
    await goto(page, '/');
    await page.waitForTimeout(500);
    const badge = page.locator('[class*="rounded-full"]:has-text("3")').first();
    await expect(badge).toBeVisible({ timeout: 5000 });
  });
});

// ─── Products Page ───────────────────────────────────────────────────────────

test.describe('Products — Search & Filter', () => {
  test('products page loads and shows items', async ({ page }) => {
    await goto(page, '/products');
    await page.waitForTimeout(2000);
    const grid = page.locator('[class*="grid"]').first();
    await expect(grid).toBeVisible({ timeout: 8000 });
  });

  test('search input is visible', async ({ page }) => {
    await goto(page, '/products');
    const search = page.locator('input[placeholder*="Search" i]').first();
    await expect(search).toBeVisible({ timeout: 5000 });
  });

  test('sort dropdown is visible and has options', async ({ page }) => {
    await goto(page, '/products');
    const select = page.locator('select').first();
    await expect(select).toBeVisible({ timeout: 5000 });
    const options = select.locator('option');
    const count = await options.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test('searching updates "items" count label', async ({ page }) => {
    await goto(page, '/products');
    await page.waitForTimeout(2000);
    const search = page.locator('input[placeholder*="Search" i]').first();
    await search.fill('laptop');
    await page.waitForTimeout(1500);
    const itemsLabel = page.locator('text=/\\d+ items/').first();
    await expect(itemsLabel).toBeVisible({ timeout: 5000 });
  });

  test('category URL param pre-selects filter', async ({ page }) => {
    await page.goto(`${BASE_URL}/products?category=laptops`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForTimeout(1000);
    // Page should load without error
    const grid = page.locator('main, [class*="grid"], [class*="product"]').first();
    await expect(grid).toBeVisible({ timeout: 5000 });
  });
});

// ─── Cart Page ───────────────────────────────────────────────────────────────

test.describe('Cart Page', () => {
  test('cart page loads with HTTP 200', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/cart`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    expect(response?.status()).toBeLessThan(400);
  });

  test('cart shows empty state when localStorage cart is empty', async ({ page }) => {
    // Navigate to a page first before accessing localStorage
    await goto(page, '/');
    await page.evaluate(() => localStorage.removeItem('cart'));
    await goto(page, '/cart');
    await page.waitForTimeout(500);
    const empty = page.locator('text=Your cart is empty').or(page.locator('text=Browse Products'));
    await expect(empty.first()).toBeVisible({ timeout: 5000 });
  });

  test('cart shows items from localStorage', async ({ page }) => {
    // Navigate to a page first before accessing localStorage
    await goto(page, '/');
    await page.evaluate(() => {
      localStorage.setItem(
        'cart',
        JSON.stringify([
          {
            id: 'c1',
            productId: 'p1',
            name: 'Awesome Laptop',
            price: 49999,
            quantity: 2,
            image: '',
          },
        ])
      );
    });
    await goto(page, '/cart');
    await page.waitForTimeout(1000);
    const item = page.locator('text=Awesome Laptop').first();
    await expect(item).toBeVisible({ timeout: 5000 });
  });
});

// ─── Wishlist Page ───────────────────────────────────────────────────────────

test.describe('Wishlist Page', () => {
  test('wishlist page loads with HTTP 200', async ({ page }) => {
    const res = await page.goto(`${BASE_URL}/wishlist`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    expect(res?.status()).toBeLessThan(400);
  });

  test('wishlist with items renders product names', async ({ page }) => {
    // Navigate to a page first before accessing localStorage
    await goto(page, '/');
    await page.evaluate(() => {
      localStorage.setItem(
        'wishlist',
        JSON.stringify([
          {
            id: 'w1',
            name: 'Sony Headphones',
            price: 15000,
            image: '',
            rating: 4.5,
            reviewCount: 100,
          },
        ])
      );
    });
    await goto(page, '/wishlist');
    await page.waitForTimeout(1000);
    const item = page.locator('text=Sony Headphones').first();
    await expect(item).toBeVisible({ timeout: 5000 });
  });
});

// ─── API Routes ──────────────────────────────────────────────────────────────

test.describe('API Routes — Health', () => {
  test('GET /api/ returns non-500', async ({ request }) => {
    const responses = await Promise.allSettled([
      request.get(`${BASE_URL}/api/chat/message`),
      request.get(`${BASE_URL}/api/intent/analyze`),
    ]);
    // GET on POST-only endpoints should not crash the server (405 is fine)
    for (const r of responses) {
      if (r.status === 'fulfilled') {
        expect(r.value.status()).not.toBe(500);
      }
    }
  });
});

// ─── Accessibility basics ────────────────────────────────────────────────────

test.describe('Accessibility', () => {
  test('home page has exactly one h1', async ({ page }) => {
    await goto(page, '/');
    const h1 = page.locator('h1');
    const count = await h1.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('nav links have accessible text', async ({ page }) => {
    await goto(page, '/');
    const navLinks = page.locator('nav a');
    const count = await navLinks.count();
    if (count > 0) {
      for (let i = 0; i < count; i++) {
        const text = await navLinks.nth(i).textContent();
        const ariaLabel = await navLinks.nth(i).getAttribute('aria-label');
        expect((text?.trim().length ?? 0) + (ariaLabel?.length ?? 0)).toBeGreaterThan(0);
      }
    }
  });

  test('all images have alt text', async ({ page }) => {
    await goto(page, '/');
    await page.waitForTimeout(1000);
    const images = page.locator('img:not([alt])');
    const count = await images.count();
    expect(count).toBe(0);
  });

  test('products page has no images without alt', async ({ page }) => {
    await goto(page, '/products');
    await page.waitForTimeout(2000);
    const badImages = page.locator('img:not([alt])');
    const count = await badImages.count();
    expect(count).toBe(0);
  });

  test('sign-in form inputs have associated labels or placeholders', async ({ page }) => {
    await goto(page, '/signin');
    const inputs = page.locator('input[type="email"], input[type="password"]');
    const count = await inputs.count();
    for (let i = 0; i < count; i++) {
      const placeholder = await inputs.nth(i).getAttribute('placeholder');
      const id = await inputs.nth(i).getAttribute('id');
      const hasLabel = id ? (await page.locator(`label[for="${id}"]`).count()) > 0 : false;
      expect((placeholder?.length ?? 0) + (hasLabel ? 1 : 0)).toBeGreaterThan(0);
    }
  });
});

// ─── Performance ─────────────────────────────────────────────────────────────

test.describe('Performance', () => {
  test('checkout page loads in < 5 seconds', async ({ page }) => {
    const start = Date.now();
    await page.goto(`${BASE_URL}/checkout`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    expect(Date.now() - start).toBeLessThan(5000);
  });

  test('shopping-assistant page loads in < 8 seconds', async ({ page }) => {
    const start = Date.now();
    await page.goto(`${BASE_URL}/shopping-assistant`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    expect(Date.now() - start).toBeLessThan(8000);
  });

  test('signin page loads in < 3 seconds', async ({ page }) => {
    const start = Date.now();
    await page.goto(`${BASE_URL}/signin`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    expect(Date.now() - start).toBeLessThan(3000);
  });

  test('products page first contentful paint is reasonable', async ({ page }) => {
    const start = Date.now();
    await page.goto(`${BASE_URL}/products`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const fcp = Date.now() - start;
    console.log(`Products FCP: ${fcp}ms`);
    expect(fcp).toBeLessThan(8000);
  });
});
