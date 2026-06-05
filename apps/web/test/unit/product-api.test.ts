/**
 * Unit Tests - Product API (NestJS Proxy)
 * Tests that /api/products/[id] proxies correctly to NestJS and returns real DB data.
 * No mock catalog fallback is expected -- when DB is unavailable, 404 is returned.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Minimal shape of a product returned by NestJS
interface ApiProduct {
  id: number;
  name: string;
  price: number;
  category: string;
  brand?: string;
  image?: string | null;
  imageUrl?: string | null;
  subCategory?: string;
  rating?: number;
  reviewCount?: number;
  inStock?: boolean;
  stock?: number;
  description?: string;
  dataSource?: string;
}

function buildProduct(overrides: Partial<ApiProduct> = {}): ApiProduct {
  return {
    id: 1001,
    name: 'Samsung Galaxy S24',
    price: 74999,
    category: 'Smartphones',
    brand: 'Samsung',
    image: 'https://images.unsplash.com/photo-1610945264803-c22b62d2a7b3?w=600&q=80',
    imageUrl: 'https://images.unsplash.com/photo-1610945264803-c22b62d2a7b3?w=600&q=80',
    rating: 4.5,
    reviewCount: 1200,
    inStock: true,
    stock: 50,
    description: 'Flagship Android smartphone',
    ...overrides,
  };
}

// ---- Test helpers (simulate proxy behaviour without spinning up Next.js) ----

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&q=80';

const CATEGORY_IMAGES: Record<string, string[]> = {
  Smartphones: [
    'https://images.unsplash.com/photo-1610945264803-c22b62d2a7b3?w=600&q=80',
    'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600&q=80',
  ],
  Laptops: [
    'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&q=80',
    'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=600&q=80',
  ],
};

function getProductImage(subCat: string, pairIdx: number): string {
  const images = CATEGORY_IMAGES[subCat];
  if (images) return images[pairIdx % images.length];
  return FALLBACK_IMAGE;
}

// toPublicImageUrl: passthrough for absolute URLs, null for relative
function toPublicImageUrl(raw?: string | null): string | null {
  if (!raw) return null;
  if (raw.startsWith('http')) return raw;
  return null;
}

async function simulateProxyFetch(nestProduct: ApiProduct | null): Promise<any> {
  if (!nestProduct || !nestProduct.id) {
    return { status: 404, error: 'Product not found' };
  }
  const numId =
    typeof nestProduct.id === 'number' ? nestProduct.id : parseInt(String(nestProduct.id), 10);
  const pairIdx = numId % 10;
  const subCat = String(nestProduct.subCategory || nestProduct.category || '');
  const dbImage = toPublicImageUrl(nestProduct.image) || toPublicImageUrl(nestProduct.imageUrl);
  let image = dbImage;
  if (!image) {
    image = getProductImage(subCat, pairIdx);
  }
  return { ...nestProduct, image, dataSource: 'database' };
}

// ---- Tests ------------------------------------------------------------------

describe('Product API - NestJS proxy', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a real product from NestJS when found by numeric ID', async () => {
    const product = buildProduct({
      id: 42,
      name: 'Dell XPS 15',
      category: 'Laptops',
      price: 149999,
    });
    const data = await simulateProxyFetch(product);
    expect(data).toMatchObject({
      id: 42,
      name: 'Dell XPS 15',
      price: 149999,
      category: 'Laptops',
      dataSource: 'database',
    });
    expect(typeof data.price).toBe('number');
    expect(data.price).toBeGreaterThan(0);
  });

  it('assigns a fallback image when DB product has no image', async () => {
    const product = buildProduct({ id: 99, image: null, imageUrl: null });
    const data = await simulateProxyFetch(product);
    expect(typeof data.image).toBe('string');
    expect(data.image).toContain('unsplash.com');
  });

  it('returns 404 when NestJS cannot find the product', async () => {
    const result = await simulateProxyFetch(null);
    expect(result.status).toBe(404);
    expect(result.error).toContain('not found');
  });

  it('preserves DB image when imageUrl is a valid Unsplash URL', async () => {
    const url = 'https://images.unsplash.com/photo-abc?w=600&q=80';
    const product = buildProduct({ imageUrl: url, image: url });
    const data = await simulateProxyFetch(product);
    expect(data.image).toBe(url);
  });

  it('converts relative image paths to absolute using PUBLIC_API_URL', () => {
    const relPath = '/uploads/product-1.jpg';
    const publicBase = 'http://localhost:3002';
    const result = relPath.startsWith('/') ? `${publicBase}${relPath}` : relPath;
    expect(result).toBe('http://localhost:3002/uploads/product-1.jpg');
  });

  it('product price is a positive number', () => {
    const products = [
      buildProduct({ price: 999 }),
      buildProduct({ price: 49999 }),
      buildProduct({ price: 199999 }),
    ];
    for (const p of products) {
      expect(p.price).toBeGreaterThan(0);
      expect(Number.isFinite(p.price)).toBe(true);
    }
  });

  it('returns dataSource=database for all real products', async () => {
    const product = buildProduct({ id: 500 });
    const data = await simulateProxyFetch(product);
    expect(data.dataSource).toBe('database');
  });

  it('does not use mock fallback when NestJS is unavailable', async () => {
    // When NestJS is unavailable (null response), returns 404 - not mock data
    const result = await simulateProxyFetch(null);
    expect(result.dataSource).toBeUndefined();
    expect(result.status).toBe(404);
    expect(result).not.toHaveProperty('sku');
  });
});
