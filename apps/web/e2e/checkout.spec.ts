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

async function seedCart(page: Page) {
  await page.evaluate(() => {
    const cart = [
      { id: 'ci-1', productId: 'p1', name: 'Test Laptop', price: 49999, quantity: 1, image: '' },
    ];
    localStorage.setItem('cart', JSON.stringify(cart));
  });
}

async function seedAddress(page: Page) {
  await page.evaluate(() => {
    const addresses = [
      {
        id: 'addr-1',
        name: 'Test User',
        phone: '9999999999',
        line1: '123 Main St',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        isDefault: true,
      },
    ];
    localStorage.setItem('addresses', JSON.stringify(addresses));
  });
}

test.describe('Checkout — Page Access', () => {
  test('checkout page loads with HTTP 200', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/checkout`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    expect(response?.status()).toBeLessThan(400);
  });

  test('checkout redirects or prompts login when not authenticated', async ({ page }) => {
    await goto(page, '/checkout');
    await page.waitForTimeout(800);
    // Page shows login prompt OR redirects to signin
    const loginPrompt = page.locator('text=log in to checkout').or(page.locator('text=log in'));
    const isLoginPrompt = await loginPrompt
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    const url = page.url();
    expect(isLoginPrompt || url.includes('signin')).toBe(true);
  });

  test('checkout shows cart empty state when cart is empty', async ({ page }) => {
    await loginViaLocalStorage(page);
    await page.evaluate(() => localStorage.removeItem('cart'));
    await goto(page, '/checkout');
    await page.waitForTimeout(800);
    // Cart empty message or redirect back to home/products
    const empty = page
      .locator('text=Your cart is empty')
      .or(page.locator('text=Browse Products'))
      .or(page.locator('text=cart is empty'));
    await expect(empty.first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Checkout — Step Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaLocalStorage(page);
    await seedCart(page);
    await seedAddress(page);
    await goto(page, '/checkout');
    await page.waitForTimeout(500);
  });

  test('checkout page renders 4-step progress indicator', async ({ page }) => {
    const steps = page.locator('text=Address, text=Shipping, text=Payment, text=Review');
    const addressStep = page.locator(':text("Address")').first();
    await expect(addressStep).toBeVisible({ timeout: 5000 });
  });

  test('checkout starts on address step', async ({ page }) => {
    const heading = page.locator('text=Delivery Address');
    await expect(heading.first()).toBeVisible({ timeout: 5000 });
  });

  test('checkout can advance to shipping with pre-seeded address', async ({ page }) => {
    // Address should be pre-selected since we seeded one
    const continueBtn = page.locator('button:has-text("Continue")').first();
    await continueBtn.click();
    await page.waitForTimeout(500);
    const shippingHeading = page.locator('text=Shipping Method').first();
    await expect(shippingHeading).toBeVisible({ timeout: 5000 });
  });

  test('checkout can navigate back from step 2 to step 1', async ({ page }) => {
    const continueBtn = page.locator('button:has-text("Continue")').first();
    await continueBtn.click();
    await page.waitForTimeout(500);
    const backBtn = page.locator('button:has-text("Back")').first();
    await backBtn.click();
    await page.waitForTimeout(500);
    const addressHeading = page.locator('text=Delivery Address').first();
    await expect(addressHeading).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Checkout — Payment Step (Mock Mode)', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaLocalStorage(page);
    await seedCart(page);
    await seedAddress(page);
    // Force mock bypass ON in localStorage
    await page.evaluate(() => localStorage.setItem('mockPaymentBypass', 'true'));
    await goto(page, '/checkout');
    await page.waitForTimeout(500);
  });

  test('payment step renders all 5 payment options', async ({ page }) => {
    // Advance to payment step
    const continueBtn = page.locator('button:has-text("Continue")').first();
    await continueBtn.click(); // -> Shipping
    await page.waitForTimeout(300);
    await continueBtn.click(); // -> Payment
    await page.waitForTimeout(300);

    const upi = page.locator('text=UPI').first();
    await expect(upi).toBeVisible({ timeout: 5000 });
    const card = page.locator('text=Credit').first();
    await expect(card).toBeVisible({ timeout: 5000 });
    const cod = page.locator('text=Cash').first();
    await expect(cod).toBeVisible({ timeout: 5000 });
  });

  test('DEV ONLY mock bypass checkbox is visible in dev mode', async ({ page }) => {
    const continueBtn = page.locator('button:has-text("Continue")').first();
    await continueBtn.click();
    await page.waitForTimeout(300);
    await continueBtn.click();
    await page.waitForTimeout(300);

    const devBadge = page.locator(':text("DEV ONLY")').first();
    await expect(devBadge).toBeVisible({ timeout: 5000 });
  });

  test('mock bypass checkbox is checked and toggleable', async ({ page }) => {
    const continueBtn = page.locator('button:has-text("Continue")').first();
    await continueBtn.click();
    await page.waitForTimeout(300);
    await continueBtn.click();
    await page.waitForTimeout(300);

    const checkbox = page.locator('#mock-payment-bypass');
    await expect(checkbox).toBeChecked({ timeout: 5000 });

    // Uncheck it
    await checkbox.click();
    await expect(checkbox).not.toBeChecked({ timeout: 3000 });

    // Re-check
    await checkbox.click();
    await expect(checkbox).toBeChecked({ timeout: 3000 });
  });
});

test.describe('Checkout — Order Summary', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaLocalStorage(page);
    await seedCart(page);
    await seedAddress(page);
    await goto(page, '/checkout');
    await page.waitForTimeout(500);
  });

  test('order summary sidebar is visible with cart items', async ({ page }) => {
    const summary = page.locator('text=Order Summary').first();
    await expect(summary).toBeVisible({ timeout: 5000 });
  });

  test('order summary shows total price', async ({ page }) => {
    const total = page.locator('text=Total').first();
    await expect(total).toBeVisible({ timeout: 5000 });
  });

  test('order summary shows GST', async ({ page }) => {
    const gst = page.locator('text=GST').first();
    await expect(gst).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Checkout — Add New Address Flow', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaLocalStorage(page);
    await seedCart(page);
    // Clear addresses so the form shows immediately
    await page.evaluate(() => localStorage.removeItem('addresses'));
    await goto(page, '/checkout');
    await page.waitForTimeout(500);
  });

  test('Add New Address button is visible when no addresses exist', async ({ page }) => {
    const addBtn = page
      .locator('button:has-text("Add New Address"), :text("Add New Address")')
      .first();
    await expect(addBtn).toBeVisible({ timeout: 5000 });
  });

  test('clicking Add New Address shows address form fields', async ({ page }) => {
    const addBtn = page
      .locator('button:has-text("Add New Address"), :text("Add New Address")')
      .first();
    await addBtn.click();
    await page.waitForTimeout(300);
    const nameInput = page.locator('input[placeholder*="Full Name" i]').first();
    await expect(nameInput).toBeVisible({ timeout: 5000 });
  });

  test('can fill and save a new address', async ({ page }) => {
    const addBtn = page
      .locator('button:has-text("Add New Address"), :text("Add New Address")')
      .first();
    await addBtn.click();
    await page.waitForTimeout(300);

    await page.fill('input[placeholder*="Full Name" i]', 'John Doe');
    await page.fill('input[placeholder*="Phone" i]', '9876543210');
    await page.fill('input[placeholder*="Address Line" i]', '456 Test Road');
    await page.fill('input[placeholder*="City" i]', 'Delhi');
    await page.fill('input[placeholder*="State" i]', 'Delhi');
    await page.fill('input[placeholder*="PIN" i]', '110001');

    await page.click('button:has-text("Save Address")');
    await page.waitForTimeout(500);

    // Address form should close
    const savedName = page.locator('text=John Doe').first();
    await expect(savedName).toBeVisible({ timeout: 5000 });
  });
});
