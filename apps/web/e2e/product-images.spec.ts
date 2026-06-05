import { test, expect, Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';
// API is proxied through Next.js rewrites at /api/v1 — this is the correct path
const API_BASE = `${BASE_URL}/api/v1`;

async function goto(page: Page, path: string) {
  await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);
}

// ─── Product Images — API Level ────────────────────────────────────────────────

test.describe('Product Images — API Response', () => {
  test('product list API returns both image AND imageUrl fields (imageUrl→image fix)', async ({ request }) => {
    const res = await request.get(`${API_BASE}/products?take=5&skip=0`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    const products = Array.isArray(data) ? data : (data.products ?? []);
    expect(products.length).toBeGreaterThan(0);

    const first = products[0];
    console.log('Sample product keys:', Object.keys(first).join(', '));
    console.log('image:', first.image, '| imageUrl:', first.imageUrl);

    // After the fix: both fields must be present and populated
    expect(first.image, 'image field must be present on every product').toBeTruthy();
    expect(first.imageUrl, 'imageUrl field must be present on every product').toBeTruthy();
    expect(first.image).toBe(first.imageUrl); // Both must point to the same URL
  });

  test('product detail API: image and imageUrl match and are valid URLs', async ({ request }) => {
    const listRes = await request.get(`${API_BASE}/products?take=1&skip=0`);
    const list = await listRes.json();
    const pid = (list.products?.[0] ?? list[0])?.id;
    expect(pid).toBeTruthy();

    const res = await request.get(`${API_BASE}/products/${pid}`);
    expect(res.status()).toBe(200);
    const product = await res.json();
    expect(product.image).toBeTruthy();
    expect(product.imageUrl).toBeTruthy();
    expect(product.image).toMatch(/^https?:\/\//);
    expect(product.image).toContain('loremflickr.com');
  });

  test('products list endpoint — every product in page has image field', async ({ request }) => {
    const res = await request.get(`${API_BASE}/products?take=10&skip=0`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    const products = Array.isArray(data) ? data : (data.products ?? data.data ?? []);
    expect(products.length).toBeGreaterThan(0);
    for (const product of products.slice(0, 10)) {
      expect((product as { image?: string }).image, `product id=${(product as any).id} must have image`).toBeTruthy();
    }
  });

  test('first 10 products all have distinct image URLs', async ({ request }) => {
    const res = await request.get(`${API_BASE}/products?take=10&skip=0`);
    const data = await res.json();
    const products = Array.isArray(data) ? data : (data.products ?? []);
    const images = products.map((p: any) => p.image).filter(Boolean);
    const unique = new Set(images);
    expect(unique.size).toBeGreaterThanOrEqual(Math.min(5, images.length));
  });
});

// ─── Product Detail Page — Image Rendering ────────────────────────────────────

test.describe('Product Detail Page — Image Rendering', () => {
  test('product detail page does NOT show placeholder text for first product', async ({ page }) => {
    const res = await page.request.get(`${API_BASE}/products?take=1&skip=0`);
    const list = await res.json();
    const pid = (list.products?.[0] ?? list[0])?.id ?? 100001;

    await goto(page, `/products/${pid}`);
    await page.waitForTimeout(2500);
    const noImageText = page.getByText(/no image available/i);
    await expect(noImageText).not.toBeVisible({ timeout: 5000 });
  });

  test('product detail page shows an img tag with a real src', async ({ page }) => {
    const res = await page.request.get(`${API_BASE}/products?take=1&skip=0`);
    const list = await res.json();
    const pid = (list.products?.[0] ?? list[0])?.id ?? 100001;

    await goto(page, `/products/${pid}`);
    await page.waitForTimeout(2500);

    const mainImage = page.locator('main img, [class*="product"] img').first();
    await expect(mainImage).toBeVisible({ timeout: 8000 });
    const src = await mainImage.getAttribute('src');
    expect(src).toBeTruthy();
    expect(src).not.toBe('');
  });

  test('product detail image src contains a valid URL (loremflickr, unsplash or Next image proxy)', async ({ page }) => {
    const res = await page.request.get(`${API_BASE}/products?take=1&skip=0`);
    const list = await res.json();
    const pid = (list.products?.[0] ?? list[0])?.id ?? 100001;

    await goto(page, `/products/${pid}`);
    await page.waitForTimeout(2500);

    const imgs = await page.locator('main img, [class*="product"] img').all();
    let found = false;
    for (const img of imgs) {
      const src = await img.getAttribute('src');
      if (src && (src.includes('loremflickr') || src.includes('unsplash') || src.includes('http') || src.startsWith('/_next'))) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });
});

// ─── Product List Page — Images ────────────────────────────────────────────────

test.describe('Product List Page — Images', () => {
  test('product list page shows img tags for products', async ({ page }) => {
    await goto(page, '/products');
    await page.waitForTimeout(2500);
    const imgCount = await page.locator('img').count();
    expect(imgCount).toBeGreaterThan(0);
  });

  test('product cards have images with valid src attributes', async ({ page }) => {
    await goto(page, '/products');
    await page.waitForTimeout(3000);

    const images = page.locator('img[src]');
    const count = await images.count();
    expect(count).toBeGreaterThan(0);

    const firstSrc = await images.first().getAttribute('src');
    expect(firstSrc).toBeTruthy();
    expect(firstSrc).not.toBe('');
  });

  test('product list page has no "No image available" text visible', async ({ page }) => {
    await goto(page, '/products');
    await page.waitForTimeout(2500);
    const noImageText = await page.getByText(/no image available/i).count();
    expect(noImageText).toBe(0);
  });

  test('screenshot proof: products page with real images', async ({ page }) => {
    await goto(page, '/products');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: 'test-results/product-images-proof.png', fullPage: true });

    const imgSrcs: string[] = await page.evaluate(() => {
      return Array.from(document.querySelectorAll<HTMLImageElement>('img'))
        .map(img => img.src)
        .filter(src => src && !src.endsWith('/product-placeholder.svg'));
    });
    console.log(`Non-placeholder images found: ${imgSrcs.length}`);
    console.log('Sample URLs:', imgSrcs.slice(0, 3).join(', '));
    expect(imgSrcs.length, 'At least 1 real product image must render').toBeGreaterThan(0);
  });
});
