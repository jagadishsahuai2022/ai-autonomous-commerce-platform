/**
 * Tests for order detail product resolution logic
 * Covers: resolveProductByName cache, fallback URL construction, image resolution
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Simulated LRU cache matching the page.tsx implementation ──────────────────
class ProductResolutionCache {
  private cache = new Map<string, { imageUrl: string; productSlug: string }>();

  async resolve(
    name: string,
    fetcher: (name: string) => Promise<{ image?: string; id?: string } | null>
  ): Promise<{ imageUrl: string; productSlug: string } | null> {
    if (this.cache.has(name)) return this.cache.get(name)!;
    const product = await fetcher(name);
    if (!product) return null;
    const resolved = {
      imageUrl: product.image || '',
      productSlug: String(product.id || ''),
    };
    this.cache.set(name, resolved);
    return resolved;
  }

  size() {
    return this.cache.size;
  }

  clear() {
    this.cache.clear();
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildProductHref(
  productId?: string | number,
  productSlug?: string,
  productName?: string
): string {
  const numericId =
    typeof productId === 'number'
      ? (Number.isInteger(productId) && productId > 0 ? String(productId) : '')
      : (typeof productId === 'string' && /^\d+$/.test(productId) ? productId : '');
  const numericSlug = typeof productSlug === 'string' && /^\d+$/.test(productSlug) ? productSlug : '';

  if (numericId) return `/products/${numericId}`;
  if (numericSlug) return `/products/${numericSlug}`;
  return `/products?search=${encodeURIComponent(productName ?? '')}`;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('Order Detail — Product Resolution Cache', () => {
  let cache: ProductResolutionCache;

  beforeEach(() => {
    cache = new ProductResolutionCache();
  });

  it('resolves a product and caches the result', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue({ id: 'mock-5', image: 'https://images.unsplash.com/photo.jpg' });

    const result = await cache.resolve('Samsung Galaxy S24 Ultra', fetcher);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      imageUrl: 'https://images.unsplash.com/photo.jpg',
      productSlug: 'mock-5',
    });
    expect(cache.size()).toBe(1);
  });

  it('returns cached result without calling fetcher again', async () => {
    const fetcher = vi.fn().mockResolvedValue({ id: 'mock-5', image: 'https://img.jpg' });

    await cache.resolve('Samsung Galaxy S24 Ultra', fetcher);
    const second = await cache.resolve('Samsung Galaxy S24 Ultra', fetcher);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(second).toEqual({ imageUrl: 'https://img.jpg', productSlug: 'mock-5' });
  });

  it('returns null when fetcher returns null', async () => {
    const fetcher = vi.fn().mockResolvedValue(null);
    const result = await cache.resolve('Unknown Product', fetcher);

    expect(result).toBeNull();
    expect(cache.size()).toBe(0); // should NOT cache null results
  });

  it('handles missing image gracefully', async () => {
    const fetcher = vi.fn().mockResolvedValue({ id: 'mock-10', image: undefined });

    const result = await cache.resolve('Product Without Image', fetcher);

    expect(result).toEqual({ imageUrl: '', productSlug: 'mock-10' });
  });

  it('handles fetcher throwing error gracefully', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('Network error'));

    await expect(cache.resolve('Error Product', fetcher)).rejects.toThrow('Network error');
    expect(cache.size()).toBe(0);
  });

  it('caches different products independently', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ id: 'mock-1', image: 'https://img1.jpg' })
      .mockResolvedValueOnce({ id: 'mock-2', image: 'https://img2.jpg' });

    await cache.resolve('Product A', fetcher);
    await cache.resolve('Product B', fetcher);

    expect(cache.size()).toBe(2);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

describe('Order Detail — Product Link URL Construction', () => {
  it('uses numeric productId when available', () => {
    const href = buildProductHref('42', undefined, 'Test Product');
    expect(href).toBe('/products/42');
  });

  it('uses numeric productSlug when productId is missing', () => {
    const href = buildProductHref(undefined, '5', 'Test Product');
    expect(href).toBe('/products/5');
  });

  it('rejects non-numeric synthetic productId and falls back to search', () => {
    const href = buildProductHref('synth-42', undefined, 'Synthetic Product');
    expect(href).toBe('/products?search=Synthetic%20Product');
  });

  it('rejects non-numeric synthetic productSlug and falls back to search', () => {
    const href = buildProductHref(undefined, 'sl-nike-pegasus', 'Nike Pegasus');
    expect(href).toBe('/products?search=Nike%20Pegasus');
  });

  it('falls back to search URL when both slug and id are missing', () => {
    const href = buildProductHref(undefined, undefined, 'Samsung Galaxy S24 Ultra');
    expect(href).toBe('/products?search=Samsung%20Galaxy%20S24%20Ultra');
  });

  it('encodes special characters in search fallback', () => {
    const href = buildProductHref(undefined, undefined, 'AC 1.5 Ton & Heater');
    expect(href).toBe('/products?search=AC%201.5%20Ton%20%26%20Heater');
  });

  it('handles empty productName in search fallback', () => {
    const href = buildProductHref(undefined, undefined, '');
    expect(href).toBe('/products?search=');
  });

  it('prefers numeric productId over non-numeric productSlug', () => {
    const href = buildProductHref('10', 'mock-10', 'Test');
    expect(href).toBe('/products/10');
  });

  it('does not use name-resolved slug for direct navigation when it is synthetic', () => {
    const resolved = { imageUrl: 'https://img.jpg', productSlug: 'mock-5' };
    const href = buildProductHref(undefined, resolved.productSlug, 'Any Product');
    expect(href).toBe('/products?search=Any%20Product');
  });
});

describe('Order Detail — Display Image Resolution Priority', () => {
  function getDisplayImage(directImageUrl?: string, resolvedImageUrl?: string): string {
    return directImageUrl || resolvedImageUrl || '';
  }

  it('uses direct imageUrl from DB when available', () => {
    const img = getDisplayImage('https://db-image.jpg', 'https://api-image.jpg');
    expect(img).toBe('https://db-image.jpg');
  });

  it('falls back to resolved API image when DB image is missing', () => {
    const img = getDisplayImage(undefined, 'https://api-image.jpg');
    expect(img).toBe('https://api-image.jpg');
  });

  it('returns empty string when both are missing', () => {
    const img = getDisplayImage(undefined, undefined);
    expect(img).toBe('');
  });

  it('treats empty string DB image as missing, uses resolved', () => {
    const img = getDisplayImage('', 'https://api-image.jpg');
    // empty string is falsy → falls through to resolved
    expect(img).toBe('https://api-image.jpg');
  });
});
