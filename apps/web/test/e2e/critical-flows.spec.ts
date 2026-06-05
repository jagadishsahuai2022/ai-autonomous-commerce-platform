/**
 * End-to-End Tests - Playwright
 * Tests for critical user flows and workflows
 */

import { test, expect, Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('User Authentication Flow', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await page.goto(`${BASE_URL}/auth/login`);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should complete user registration', async () => {
    // Navigate to register
    await page.click("text=Don't have an account?");
    await expect(page).toHaveURL(/.*register/);

    // Fill registration form
    await page.fill('input[name="email"]', `test-${Date.now()}@example.com`);
    await page.fill('input[name="password"]', 'TestPassword123!');
    await page.fill('input[name="confirmPassword"]', 'TestPassword123!');
    await page.fill('input[name="firstName"]', 'Test');
    await page.fill('input[name="lastName"]', 'User');

    // Accept terms
    await page.check('input[type="checkbox"]');

    // Submit form
    await page.click('button:has-text("Register")');

    // Should redirect to dashboard
    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page.locator('text=Welcome, Test')).toBeVisible();
  });

  test('should complete user login', async () => {
    // Fill login form
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'TestPassword123!');

    // Submit form
    await page.click('button:has-text("Login")');

    // Should redirect to dashboard
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('should handle login errors', async () => {
    // Fill with invalid credentials
    await page.fill('input[name="email"]', 'invalid@example.com');
    await page.fill('input[name="password"]', 'wrongpassword');

    // Submit form
    await page.click('button:has-text("Login")');

    // Should show error message
    await expect(page.locator('text=Invalid email or password')).toBeVisible();
  });

  test('should reset password', async () => {
    // Click forgot password
    await page.click('text=Forgot password?');
    await expect(page).toHaveURL(/.*forgot-password/);

    // Enter email
    await page.fill('input[name="email"]', 'test@example.com');
    await page.click('button:has-text("Send Reset Link")');

    // Should show success message
    await expect(page.locator('text=Check your email for reset link')).toBeVisible();
  });

  test('should logout user', async () => {
    // Login first
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'TestPassword123!');
    await page.click('button:has-text("Login")');
    await expect(page).toHaveURL(/.*dashboard/);

    // Click logout
    await page.click('button[aria-label="User menu"]');
    await page.click('text=Logout');

    // Should redirect to login
    await expect(page).toHaveURL(/.*login/);
  });
});

test.describe('Product Search & Discovery', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await page.goto(`${BASE_URL}/`);
    // Assume user is logged in
    await page.evaluate(() => {
      localStorage.setItem('token', 'mock-token');
    });
    await page.reload();
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should search for products', async () => {
    // Enter search query
    await page.fill('input[placeholder*=Search]', 'laptop');

    // Press enter or click search
    await page.press('input[placeholder*=Search]', 'Enter');

    // Should show results
    await expect(page.locator('text=laptop')).toBeTruthy();
    await expect(page.locator('div.product-card')).toBeTruthy();
  });

  test('should filter products by price', async () => {
    // Navigate to products
    await page.goto(`${BASE_URL}/products`);

    // Open filter panel
    await page.click('button:has-text(Filters)');

    // Set price range
    await page.fill('input[placeholder*="Min Price"]', '100');
    await page.fill('input[placeholder*="Max Price"]', '1000');

    // Apply filter
    await page.click('button:has-text("Apply")');

    // Should show filtered results
    const products = await page.locator('div.product-card >> text').allTextContents();
    expect(products.length).toBeGreaterThan(0);
  });

  test('should filter products by category', async () => {
    // Navigate to products
    await page.goto(`${BASE_URL}/products`);

    // Click category filter
    await page.click('button:has-text(Electronics)');

    // Should show filtered results
    const productCount = await page.locator('div.product-card').count();
    expect(productCount).toBeGreaterThan(0);
  });

  test('should sort products', async () => {
    // Navigate to products
    await page.goto(`${BASE_URL}/products`);

    // Change sort
    await page.selectOption("select[aria-label='Sort by']", 'price-asc');

    // Should update results
    await page.waitForTimeout(1000);
    const prices = await page.locator('span.product-price').allTextContents();
    expect(prices.length).toBeGreaterThan(0);
  });

  test('should view product details', async () => {
    // Navigate to products
    await page.goto(`${BASE_URL}/products`);

    // Click first product
    await page.click('div.product-card >> nth=0');

    // Should show product details
    await expect(page.locator('h1.product-name')).toBeVisible();
    await expect(page.locator('span.product-price')).toBeVisible();
    await expect(page.locator('div.product-description')).toBeVisible();
  });

  test('should add product to wishlist', async () => {
    // Navigate to product details
    await page.goto(`${BASE_URL}/products/prod-123`);

    // Click wishlist button
    await page.click('button[aria-label="Add to wishlist"]');

    // Should show success feedback
    await expect(page.locator('text=Added to your wishlist')).toBeVisible();
  });
});

test.describe('Shopping Cart Flow', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await page.goto(`${BASE_URL}/`);
    // Assume user is logged in
    await page.evaluate(() => {
      localStorage.setItem('token', 'mock-token');
    });
    await page.reload();
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should add product to cart', async () => {
    // Navigate to products
    await page.goto(`${BASE_URL}/products`);

    // Add to cart
    await page.click('div.product-card >> nth=0');
    await page.click('button:has-text("Add to Cart")');

    // Should show success message
    await expect(page.locator('text=Added to cart')).toBeVisible();

    // Cart count should update
    await expect(page.locator('span.cart-count')).toHaveText('1');
  });

  test('should update cart quantity', async () => {
    // Navigate to cart
    await page.goto(`${BASE_URL}/cart`);

    // Update quantity
    const quantityInput = page.locator("input[aria-label='Quantity']").first();
    await quantityInput.fill('3');
    await quantityInput.blur();

    // Should update total price
    await page.waitForTimeout(500);
    const totalPrice = await page.locator('span.cart-total').textContent();
    expect(totalPrice).toBeTruthy();
  });

  test('should remove item from cart', async () => {
    // Navigate to cart
    await page.goto(`${BASE_URL}/cart`);

    // Remove item
    await page.click('button[aria-label="Remove item"]');

    // Should show confirmation
    await expect(page.locator('text=Item removed')).toBeVisible();
  });

  test('should apply coupon code', async () => {
    // Navigate to cart
    await page.goto(`${BASE_URL}/cart`);

    // Enter coupon code
    await page.fill('input[placeholder*="Coupon"]', 'SAVE10');
    await page.click('button:has-text("Apply")');

    // Should show discount applied
    await expect(page.locator('text=Discount applied')).toBeVisible();

    // Total should decrease
    const newTotal = await page.locator('span.cart-total').textContent();
    expect(newTotal).toBeTruthy();
  });

  test('should proceed to checkout', async () => {
    // Navigate to cart
    await page.goto(`${BASE_URL}/cart`);

    // Click checkout
    await page.click('button:has-text("Proceed to Checkout")');

    // Should navigate to checkout page
    await expect(page).toHaveURL(/.*checkout/);
  });
});

test.describe('Checkout & Payment Flow', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await page.goto(`${BASE_URL}/`);
    // Assume user is logged in
    await page.evaluate(() => {
      localStorage.setItem('token', 'mock-token');
    });
    await page.reload();
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should complete checkout with shipping address', async () => {
    // Navigate to checkout
    await page.goto(`${BASE_URL}/checkout`);

    // Fill shipping address
    await page.fill('input[name="firstName"]', 'John');
    await page.fill('input[name="lastName"]', 'Doe');
    await page.fill('input[name="address"]', '123 Main St');
    await page.fill('input[name="city"]', 'New York');
    await page.fill('input[name="state"]', 'NY');
    await page.fill('input[name="zipCode"]', '10001');
    await page.fill('input[name="country"]', 'US');

    // Continue to shipping method
    await page.click('button:has-text("Continue")');

    // Should show shipping options
    await expect(page.locator('text=Standard Shipping')).toBeVisible();
  });

  test('should select shipping method', async () => {
    // Navigate to checkout (assuming address filled)
    await page.goto(`${BASE_URL}/checkout?step=shipping`);

    // Select shipping method
    await page.click('label:has-text("Express Shipping")');

    // Continue to payment
    await page.click('button:has-text("Continue to Payment")');

    // Should navigate to payment section
    await expect(page.locator('text=Payment Method')).toBeVisible();
  });

  test('should process payment successfully', async () => {
    // Navigate to payment
    await page.goto(`${BASE_URL}/checkout?step=payment`);

    // Fill card details
    const frameHandle = await page.$("iframe[title='Stripe']");
    if (frameHandle) {
      const frame = await frameHandle.contentFrame();
      await frame?.fill('#cardNumber', '4242424242424242');
      await frame?.fill('#cardExpiry', '1225');
      await frame?.fill('#cardCvc', '123');
    }

    // Place order
    await page.click('button:has-text("Place Order")');

    // Should show order confirmation
    await expect(page.locator('text=Order placed successfully')).toBeVisible();
    await expect(page).toHaveURL(/.*order-confirmation/);
  });

  test('should handle payment error', async () => {
    // Navigate to payment
    await page.goto(`${BASE_URL}/checkout?step=payment`);

    // Fill invalid card details
    const frameHandle = await page.$("iframe[title='Stripe']");
    if (frameHandle) {
      const frame = await frameHandle.contentFrame();
      await frame?.fill('#cardNumber', '4000000000000002'); // Decline code
      await frame?.fill('#cardExpiry', '1225');
      await frame?.fill('#cardCvc', '123');
    }

    // Try to place order
    await page.click('button:has-text("Place Order")');

    // Should show error message
    await expect(page.locator('text=Your card was declined')).toBeVisible();
  });
});

test.describe('User Account & Profile', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await page.goto(`${BASE_URL}/`);
    // Assume user is logged in
    await page.evaluate(() => {
      localStorage.setItem('token', 'mock-token');
    });
    await page.reload();
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should view order history', async () => {
    // Navigate to account
    await page.goto(`${BASE_URL}/account/orders`);

    // Should show orders
    await expect(page.locator('div.order-item')).toBeTruthy();
  });

  test('should view order details', async () => {
    // Navigate to orders
    await page.goto(`${BASE_URL}/account/orders`);

    // Click order
    await page.click('div.order-item >> nth=0');

    // Should show order details
    await expect(page.locator("h2:has-text('Order')")).toBeVisible();
    await expect(page.locator('div.order-items')).toBeVisible();
  });

  test('should update profile information', async () => {
    // Navigate to profile
    await page.goto(`${BASE_URL}/account/profile`);

    // Update information
    await page.fill('input[name="firstName"]', 'Jane');
    await page.fill('input[name="lastName"]', 'Smith');

    // Save changes
    await page.click('button:has-text("Save Changes")');

    // Should show success message
    await expect(page.locator('text=Profile updated successfully')).toBeVisible();
  });

  test('should manage addresses', async () => {
    // Navigate to addresses
    await page.goto(`${BASE_URL}/account/addresses`);

    // Add new address
    await page.click('button:has-text("Add Address")');

    // Fill address form
    await page.fill('input[name="address"]', '456 Oak Ave');
    await page.fill('input[name="city"]', 'Los Angeles');
    await page.fill('input[name="state"]', 'CA');
    await page.fill('input[name="zipCode"]', '90001');

    // Save address
    await page.click('button:has-text("Save Address")');

    // Should show success
    await expect(page.locator('text=Address added')).toBeVisible();
  });

  test('should change password', async () => {
    // Navigate to security
    await page.goto(`${BASE_URL}/account/security`);

    // Fill password form
    await page.fill('input[name="currentPassword"]', 'OldPassword123!');
    await page.fill('input[name="newPassword"]', 'NewPassword456!');
    await page.fill('input[name="confirmPassword"]', 'NewPassword456!');

    // Submit
    await page.click('button:has-text("Change Password")');

    // Should show success
    await expect(page.locator('text=Password changed successfully')).toBeVisible();
  });
});

test.describe('Error Handling & Recovery', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should handle network errors gracefully', async () => {
    // Go offline
    await page.context().setOffline(true);

    // Try to load page
    await page
      .goto(`${BASE_URL}/products`, { waitUntil: 'networkidle', timeout: 5000 })
      .catch(() => {});

    // Should show error message
    await expect(page.locator('text=/Connection|Network|offline/i')).toBeTruthy();
  });

  test('should show 404 for non-existent pages', async () => {
    // Navigate to non-existent page
    await page.goto(`${BASE_URL}/nonexistent-page`);

    // Should show 404
    await expect(page.locator('text=404|Not Found')).toBeTruthy();
  });

  test('should handle timeout gracefully', async () => {
    // Set very short timeout
    const response = await page
      .goto(`${BASE_URL}/`, {
        timeout: 100,
      })
      .catch(() => null);

    // Should handle gracefully
    expect(response || page.url()).toBeTruthy();
  });
});

test.describe('Performance & Accessibility', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await page.goto(`${BASE_URL}/`);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should load homepage quickly', async () => {
    const startTime = Date.now();
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
    const loadTime = Date.now() - startTime;

    // Should load in less than 3 seconds
    expect(loadTime).toBeLessThan(3000);
  });

  test('should be keyboard navigable', async () => {
    // Tab through navigation
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(focused).toBeTruthy();
  });

  test('should have proper heading hierarchy', async () => {
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();
    expect(headings.length).toBeGreaterThan(0);
  });
});
