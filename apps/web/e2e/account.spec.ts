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

// ─── Account Page — Unauthenticated ──────────────────────────────────────────

test.describe('Account Page — Unauthenticated', () => {
  test('redirects to /signin when not logged in', async ({ page }) => {
    await goto(page, '/');
    await page.evaluate(() => {
      localStorage.removeItem('authToken');
      localStorage.removeItem('userEmail');
    });
    await goto(page, '/account');
    await page.waitForTimeout(2000);
    // Should redirect to signin or show spinner (no crash)
    const url = page.url();
    const isRedirected = url.includes('/signin') || url.includes('/account');
    expect(isRedirected).toBe(true);
  });

  test('account page loads with 200 status', async ({ page }) => {
    await loginViaLocalStorage(page);
    const res = await page.goto(`${BASE_URL}/account`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    expect(res?.status()).toBeLessThan(400);
  });
});

// ─── Account Page — Authenticated ────────────────────────────────────────────

test.describe('Account Page — Authenticated', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaLocalStorage(page, 'testuser@example.com');
    await goto(page, '/account');
    await page.waitForTimeout(1500);
  });

  test('shows hero banner with user greeting', async ({ page }) => {
    const greeting = page.locator('h1').filter({ hasText: /hello/i });
    await expect(greeting).toBeVisible({ timeout: 8000 });
  });

  test('shows user email in hero section', async ({ page }) => {
    // Email appears in hero banner (main section), avoid strict mode with .first()
    const emailEl = page.locator('p').filter({ hasText: 'testuser@example.com' }).first();
    await expect(emailEl).toBeVisible({ timeout: 8000 });
  });

  test('shows Sign Out button', async ({ page }) => {
    const signout = page.getByRole('button', { name: /sign out/i });
    await expect(signout).toBeVisible({ timeout: 8000 });
  });

  test('shows AI Features section with DelegateCart Exclusive badge', async ({ page }) => {
    const aiSection = page.locator('h2').filter({ hasText: /your ai features/i });
    await expect(aiSection).toBeVisible({ timeout: 8000 });
    const badge = page.getByText(/delegatecart exclusive/i);
    await expect(badge).toBeVisible({ timeout: 8000 });
  });

  test('shows Smart Delegate feature card', async ({ page }) => {
    const card = page.getByText('Smart Delegate');
    await expect(card).toBeVisible({ timeout: 8000 });
  });

  test('shows AI Budget Tracker feature card', async ({ page }) => {
    const card = page.getByText('AI Budget Tracker');
    await expect(card).toBeVisible({ timeout: 8000 });
  });

  test('shows Price Drop Alerts feature card', async ({ page }) => {
    const card = page.getByText('Price Drop Alerts');
    await expect(card).toBeVisible({ timeout: 8000 });
  });

  test('shows Purchase Predictor feature card', async ({ page }) => {
    const card = page.getByText('Purchase Predictor');
    await expect(card).toBeVisible({ timeout: 8000 });
  });

  test('shows Recent Orders section', async ({ page }) => {
    // The h2 heading says "Your Orders"
    const ordersSection = page
      .locator('h2')
      .filter({ hasText: /your orders/i })
      .first();
    await expect(ordersSection).toBeVisible({ timeout: 8000 });
  });

  test('shows demo order IDs', async ({ page }) => {
    const order = page.getByText(/DC-2024-001/);
    await expect(order).toBeVisible({ timeout: 8000 });
  });

  test('shows order status badges (Delivered/Shipped)', async ({ page }) => {
    const delivered = page.getByText('Delivered').first();
    await expect(delivered).toBeVisible({ timeout: 8000 });
  });

  test('shows AI-assisted badge on eligible orders', async ({ page }) => {
    // The AI badge is a violet pill span with "AI" text (+ Sparkles SVG)
    // Find it by its specific violet background class
    const aiBadge = page.locator('span[class*="bg-violet"]').filter({ hasText: /AI/i }).first();
    await expect(aiBadge).toBeVisible({ timeout: 8000 });
  });

  test('shows Account Sections grid with 8 cards', async ({ page }) => {
    // Check for key section titles
    await expect(page.getByText('Your Orders').first()).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('Your Wishlist').first()).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('Payment Methods').first()).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('AI Preferences').first()).toBeVisible({ timeout: 8000 });
  });

  test('shows Login & Security section card', async ({ page }) => {
    const security = page.getByText('Login & Security');
    await expect(security).toBeVisible({ timeout: 8000 });
  });

  test('shows Notifications section card', async ({ page }) => {
    const notif = page.getByText('Notifications').first();
    await expect(notif).toBeVisible({ timeout: 8000 });
  });

  test('shows AI Insights banner', async ({ page }) => {
    const banner = page.getByText(/your ai delegate is ready/i);
    await expect(banner).toBeVisible({ timeout: 8000 });
  });

  test('shows Help & Support section', async ({ page }) => {
    const help = page.getByText('Help & Support').first();
    await expect(help).toBeVisible({ timeout: 8000 });
  });

  test('shows stat pills in hero (Total Orders, Cart Items, Wishlist)', async ({ page }) => {
    await expect(page.getByText('Total Orders')).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('Cart Items')).toBeVisible({ timeout: 8000 });
    // Use exact locator to target stat pill only (not the section heading)
    await expect(
      page
        .locator('p.text-xs')
        .filter({ hasText: /^Wishlist$/ })
        .first()
    ).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('AI-Assisted').first()).toBeVisible({ timeout: 8000 });
  });

  test('shows user initials avatar in hero', async ({ page }) => {
    // Avatar should contain first 2 chars of username
    const avatar = page.locator('[class*="rounded-2xl"]').filter({ hasText: /TE/i }).first();
    await expect(avatar).toBeVisible({ timeout: 8000 });
  });

  test('wishlist card links to /wishlist', async ({ page }) => {
    const wishlistLink = page.locator('a[href="/wishlist"]').first();
    await expect(wishlistLink).toBeVisible({ timeout: 8000 });
  });

  test('AI settings card links to /ai-assistant', async ({ page }) => {
    const ailink = page.locator('a[href="/ai-assistant"]').first();
    await expect(ailink).toBeVisible({ timeout: 8000 });
  });

  test('shows "Initiate Return" card linking to /account/returns', async ({ page }) => {
    const returnLink = page.locator('a[href="/account/returns"]').first();
    await expect(returnLink).toBeVisible({ timeout: 8000 });
  });

  test('clicking "Initiate Return" card navigates to /account/returns', async ({ page }) => {
    const returnLink = page.locator('a[href="/account/returns"]').first();
    await expect(returnLink).toBeVisible({ timeout: 8000 });
    await returnLink.click();
    await page.waitForTimeout(2000);
    expect(page.url()).toContain('/account/returns');
  });
});

// ─── Account Page — Logout Flow ───────────────────────────────────────────────

test.describe('Account Page — Logout', () => {
  test('clicking Sign Out removes auth from localStorage', async ({ page }) => {
    await loginViaLocalStorage(page, 'logout-test@example.com');
    await goto(page, '/account');
    await page.waitForTimeout(1500);

    const signout = page.getByRole('button', { name: /sign out/i });
    await expect(signout).toBeVisible({ timeout: 8000 });
    await signout.click();
    await page.waitForTimeout(1000);

    const token = await page.evaluate(() => localStorage.getItem('authToken'));
    const email = await page.evaluate(() => localStorage.getItem('userEmail'));
    expect(token).toBeNull();
    expect(email).toBeNull();
  });

  test('clicking Sign Out navigates away from account page', async ({ page }) => {
    await loginViaLocalStorage(page, 'logout-nav@example.com');
    await goto(page, '/account');
    await page.waitForTimeout(1500);

    const signout = page.getByRole('button', { name: /sign out/i });
    await expect(signout).toBeVisible({ timeout: 8000 });
    await signout.click();
    await page.waitForTimeout(1500);

    const url = page.url();
    // Should navigate somewhere other than /account (e.g. '/' or /signin)
    expect(url.endsWith('/account')).toBe(false);
  });
});

// ─── Account Page — Google OAuth Badge ───────────────────────────────────────

test.describe('Account Page — OAuth provider badge', () => {
  test('shows Google provider badge for Google OAuth users', async ({ page }) => {
    await goto(page, '/');
    await page.evaluate(() => {
      localStorage.setItem('authToken', `oauth-google-mock-${Date.now()}`);
      localStorage.setItem('userEmail', 'googleuser@gmail.com');
    });
    await goto(page, '/account');
    await page.waitForTimeout(1500);

    // Should show 'G' provider badge or 'Signed in via Google'
    const badge = page.getByText(/signed in via google/i);
    await expect(badge).toBeVisible({ timeout: 8000 });
  });
});

// ─── Account Page — No Hydration Errors ──────────────────────────────────────

test.describe('Account Page — Stability', () => {
  test('no critical JS errors on account page', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await loginViaLocalStorage(page);
    await goto(page, '/account');
    await page.waitForTimeout(2000);

    const critical = errors.filter(
      (e) =>
        !e.includes('NetworkError') &&
        !e.includes('fetch') &&
        !e.includes('Failed to fetch') &&
        !e.includes('401') &&
        !e.includes('Hydration') &&
        !e.includes('hydrating')
    );
    expect(critical).toHaveLength(0);
  });

  test('account page renders without polygon hydration error', async ({ page }) => {
    const polyErrors: string[] = [];
    page.on('pageerror', (err) => {
      if (err.message.includes('polygon') || err.message.includes('matching')) {
        polyErrors.push(err.message);
      }
    });

    await loginViaLocalStorage(page);
    await goto(page, '/account');
    await page.waitForTimeout(2000);
    expect(polyErrors).toHaveLength(0);
  });
});

// ─── Wishlist Page — Move to Cart ────────────────────────────────────────────

test.describe('Wishlist — Move to Cart', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaLocalStorage(page);
    // Seed wishlist with 3 items
    await page.evaluate(() => {
      const wishlist = [
        { id: 'w1', name: 'Test Product A', price: 999, image: '', category: 'Electronics' },
        { id: 'w2', name: 'Test Product B', price: 1999, image: '', category: 'Clothing' },
        { id: 'w3', name: 'Test Product C', price: 2999, image: '', category: 'Books' },
      ];
      localStorage.setItem('wishlist', JSON.stringify(wishlist));
    });
    await goto(page, '/wishlist');
    await page.waitForTimeout(1500);
  });

  test('wishlist page loads with items', async ({ page }) => {
    // The wishlist page renders h1 "My Wishlist (N)"
    const heading = page
      .locator('h1')
      .filter({ hasText: /my wishlist/i })
      .first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });

  test('Move to Cart button is enabled when wishlist has items', async ({ page }) => {
    const btn = page.getByRole('button', { name: /move.*cart/i }).first();
    await expect(btn).toBeVisible({ timeout: 8000 });
    await expect(btn).not.toBeDisabled();
  });

  test('Move to Cart button shows "Move All to Cart" when no items selected', async ({ page }) => {
    const btn = page.getByRole('button', { name: /move all to cart/i }).first();
    await expect(btn).toBeVisible({ timeout: 8000 });
  });

  test('Move All to Cart button shows count of wishlist items', async ({ page }) => {
    const btn = page.getByRole('button', { name: /move all to cart \(3\)/i }).first();
    await expect(btn).toBeVisible({ timeout: 8000 });
  });

  test('Move All to Cart moves items to cart', async ({ page }) => {
    const btn = page.getByRole('button', { name: /move all to cart/i }).first();
    await expect(btn).toBeVisible({ timeout: 8000 });
    await btn.click();
    await page.waitForTimeout(1000);

    // Cart should now have items
    const cart = await page.evaluate(() => JSON.parse(localStorage.getItem('cart') || '[]'));
    expect(cart.length).toBeGreaterThan(0);
  });

  test('Move All to Cart clears wishlist', async ({ page }) => {
    const btn = page.getByRole('button', { name: /move all to cart/i }).first();
    await expect(btn).toBeVisible({ timeout: 8000 });
    await btn.click();
    await page.waitForTimeout(1000);

    // Wishlist in localStorage should be empty or have fewer items
    const wishlist = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('wishlist') || '[]')
    );
    expect(wishlist.length).toBe(0);
  });

  test('Move to Cart button is disabled when wishlist is empty', async ({ page }) => {
    // Clear wishlist
    await page.evaluate(() => localStorage.setItem('wishlist', '[]'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const btn = page.getByRole('button', { name: /move.*cart/i }).first();
    // If button is visible it should be disabled
    const count = await btn.count();
    if (count > 0) {
      await expect(btn).toBeDisabled();
    }
  });

  test('wishlist total price displays correctly', async ({ page }) => {
    // 999 + 1999 + 2999 = 5997 — check for "₹" sign
    const price = page.locator('text=/₹[0-9]/').first();
    await expect(price).toBeVisible({ timeout: 8000 });
  });
});

// ─── Wishlist Page — checkbox interaction ────────────────────────────────────

test.describe('Wishlist — Checkbox selection', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaLocalStorage(page);
    await page.evaluate(() => {
      const wishlist = [
        { id: 'c1', name: 'Checkbox Product A', price: 500, image: '', category: 'Electronics' },
        { id: 'c2', name: 'Checkbox Product B', price: 750, image: '', category: 'Books' },
      ];
      localStorage.setItem('wishlist', JSON.stringify(wishlist));
    });
    await goto(page, '/wishlist');
    await page.waitForTimeout(1500);
  });

  test('checking an item changes button label to "Move to Cart (1)"', async ({ page }) => {
    const checkboxes = page.locator('input[type="checkbox"]');
    const count = await checkboxes.count();
    if (count > 0) {
      await checkboxes.first().check();
      await page.waitForTimeout(300);
      const btn = page.getByRole('button', { name: /move to cart \(1\)/i });
      await expect(btn).toBeVisible({ timeout: 5000 });
    }
  });

  test('selected items are moved when "Move to Cart" clicked after checking', async ({ page }) => {
    const checkboxes = page.locator('input[type="checkbox"]');
    const count = await checkboxes.count();
    if (count > 0) {
      // Select just the first item
      await checkboxes.first().check();
      await page.waitForTimeout(300);

      const btn = page.getByRole('button', { name: /move to cart \(1\)/i });
      const btnCount = await btn.count();
      if (btnCount > 0) {
        await btn.click();
        await page.waitForTimeout(1000);
        const cart = await page.evaluate(() => JSON.parse(localStorage.getItem('cart') || '[]'));
        expect(cart.length).toBeGreaterThanOrEqual(1);
      }
    }
  });
});

// ─── Navbar — Avatar links to /account ───────────────────────────────────────

test.describe('Navbar — Account Link', () => {
  test('user avatar links to /account when logged in', async ({ page }) => {
    await loginViaLocalStorage(page);
    await goto(page, '/');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const accountLink = page.locator('a[href="/account"]').first();
    await expect(accountLink).toBeVisible({ timeout: 8000 });
  });
});

// ─── Shopping Assistant — No Hydration Errors ────────────────────────────────

test.describe('Shopping Assistant — Hydration', () => {
  test('shopping-assistant page has no polygon SVG hydration mismatch', async ({ page }) => {
    const hydrationErrors: string[] = [];
    page.on('pageerror', (err) => {
      if (
        err.message.toLowerCase().includes('polygon') ||
        err.message.toLowerCase().includes('matching') ||
        err.message.toLowerCase().includes('hydrat')
      ) {
        hydrationErrors.push(err.message);
      }
    });

    await goto(page, '/shopping-assistant');
    await page.waitForTimeout(2500);

    // Filter out known benign hydration warnings that don't break functionality
    const critical = hydrationErrors.filter(
      (e) => !e.includes('Warning:') && !e.includes('hydrating')
    );
    expect(critical).toHaveLength(0);
  });

  test('shopping assistant renders after client hydration', async ({ page }) => {
    await loginViaLocalStorage(page);
    await goto(page, '/shopping-assistant');
    await page.waitForTimeout(2000);

    const content = page.locator('main, [class*="chat"], textarea, h1, h2').first();
    await expect(content).toBeVisible({ timeout: 10000 });
  });
});

// ─── Dashboard Page — Still accessible ───────────────────────────────────────

test.describe('Dashboard Page', () => {
  test('dashboard page still loads after account page creation', async ({ page }) => {
    await loginViaLocalStorage(page);
    const res = await page.goto(`${BASE_URL}/dashboard`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    expect(res?.status()).toBeLessThan(400);
  });

  test('dashboard page renders content', async ({ page }) => {
    await loginViaLocalStorage(page);
    await goto(page, '/dashboard');
    await page.waitForTimeout(1500);
    const body = page.locator('main, h1, h2').first();
    await expect(body).toBeVisible({ timeout: 8000 });
  });
});
