import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

const WEB_BASE = 'http://127.0.0.1:3010';
const DEMO_EMAIL = 'aiplusdemo@delegatecart.com';
const TIMEOUT = 45_000;

async function authenticateDemoUser(request: APIRequestContext, page: Page): Promise<string> {
  const response = await request.post(`${WEB_BASE}/api/auth/login`, {
    data: { email: DEMO_EMAIL },
    timeout: TIMEOUT,
  });

  expect(response.ok()).toBe(true);
  const body = await response.json();
  expect(body.token).toBeTruthy();

  await page.addInitScript(
    ({ token, email, role }) => {
      localStorage.setItem('authToken', token);
      localStorage.setItem('userEmail', email);
      localStorage.setItem('dc-user-role', role);
    },
    { token: body.token as string, email: DEMO_EMAIL, role: body.user?.dcRole || 'aiplus' }
  );

  return body.token as string;
}

async function createOrder(
  page: Page,
  token: string,
  item: {
    productId?: string | number;
    productSlug?: string;
    productName: string;
    quantity: number;
    price: number;
    imageUrl?: string;
  }
) {
  const response = await page.request.post(`${WEB_BASE}/api/orders`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: {
      items: [item],
      total: item.quantity * item.price,
      aiAssisted: false,
      paymentMethod: 'wallet',
      notes: 'round64 synthetic data regression test',
    },
    timeout: TIMEOUT,
  });

  expect(response.ok()).toBe(true);
  const body = await response.json();
  expect(body.order?.id).toBeTruthy();
  return body.order;
}

test.describe('Round 64 — Synthetic Data Guardrails', () => {
  test('smart delegate does not fabricate cross-user submissions for privileged users', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('authToken', 'round64-test-token');
      localStorage.setItem('userEmail', 'analytics@delegatecart.com');
      localStorage.setItem('dc-user-role', 'analytics');
      localStorage.setItem('shoppingListResults', '[]');
    });

    await page.goto(`${WEB_BASE}/smart-delegate`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });

    await expect(page.locator('text=No searches yet')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('text=demo-cross-')).toHaveCount(0);
    await expect(page.locator('select')).toHaveCount(0);
  });

  test('order detail falls back to search when stored product reference is synthetic', async ({ page, request }) => {
    const token = await authenticateDemoUser(request, page);
    const productName = 'Synthetic Link Guard Product';
    const order = await createOrder(page, token, {
      productId: 'synth-123',
      productSlug: 'sl-synthetic-link-guard-product',
      productName,
      quantity: 1,
      price: 999,
    });

    await page.goto(`${WEB_BASE}/orders/${order.id}`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });

    const productLink = page.locator(`a[href^="/products?search="]`).filter({ hasText: productName }).first();
    await expect(productLink).toBeVisible({ timeout: 20000 });
    await expect(productLink).toHaveAttribute('href', /\/products\?search=Synthetic%20Link%20Guard%20Product/);
    await expect(page.locator('a[href*="synth-123"], a[href*="sl-synthetic-link-guard-product"]')).toHaveCount(0);
  });

  test('order detail product link resolves to the same real DB product name', async ({ page, request }) => {
    const token = await authenticateDemoUser(request, page);

    const productResponse = await page.request.get(`${WEB_BASE}/api/products?search=${encodeURIComponent('Pad Plus Neo')}&limit=1`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: TIMEOUT,
    });
    expect(productResponse.ok()).toBe(true);

    const productBody = await productResponse.json();
    const product = Array.isArray(productBody.products) ? productBody.products[0] : null;
    expect(product?.id).toBeTruthy();
    expect(product?.name).toBeTruthy();

    const order = await createOrder(page, token, {
      productId: product.id,
      productSlug: String(product.id),
      productName: product.name,
      quantity: 1,
      price: Number(product.price) || 1,
      imageUrl: product.image || product.imageUrl,
    });

    await page.goto(`${WEB_BASE}/orders/${order.id}`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });

    const productLink = page.locator(`a[href="/products/${product.id}"]`).filter({ hasText: product.name }).first();
    await expect(productLink).toBeVisible({ timeout: 20000 });
    await productLink.click();

    await page.waitForURL(`**/products/${product.id}`, { timeout: TIMEOUT });
    await expect(page.locator('h1').filter({ hasText: product.name }).first()).toBeVisible({ timeout: 20000 });
  });
});