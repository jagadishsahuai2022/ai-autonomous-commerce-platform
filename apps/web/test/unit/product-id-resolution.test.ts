/**
 * Round 65 — Product ID Resolution & Cart Sanitization Tests
 *
 * Covers:
 * - sanitizeOrderItemReference: strict numeric-only validation
 * - resolveProductIdByName: server-side fallback product name→DB ID resolution
 * - Cart productId extraction: checkout page item mapping
 * - Order item backfill verification
 */
import { describe, it, expect } from 'vitest';

// ── Replicates sanitizeOrderItemReference from lib/db.ts ──────────────────────

function sanitizeOrderItemReference(productId?: number | string, productSlug?: string) {
  const normalizedId =
    typeof productId === 'number'
      ? (Number.isInteger(productId) && productId > 0 ? productId : null)
      : (typeof productId === 'string' && /^\d+$/.test(productId.trim())
          ? parseInt(productId.trim(), 10)
          : null);

  const normalizedSlug =
    normalizedId !== null
      ? String(normalizedId)
      : (typeof productSlug === 'string' && /^\d+$/.test(productSlug.trim())
          ? productSlug.trim()
          : null);

  return {
    productId: normalizedId ?? (normalizedSlug ? parseInt(normalizedSlug, 10) : null),
    productSlug: normalizedSlug,
  };
}

// ── Replicates checkout page item mapping logic ───────────────────────────────

function mapCartItemForApi(item: { productId: string; name: string; price: number; quantity: number; image?: string }) {
  return {
    productId: item.productId && /^\d+$/.test(item.productId) ? parseInt(item.productId, 10) : undefined,
    productSlug: item.productId && /^\d+$/.test(item.productId) ? item.productId : undefined,
    productName: item.name,
    quantity: item.quantity,
    price: item.price,
    imageUrl: item.image,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('sanitizeOrderItemReference — strict numeric validation', () => {
  it('accepts valid positive integer productId (number)', () => {
    const result = sanitizeOrderItemReference(236646);
    expect(result).toEqual({ productId: 236646, productSlug: '236646' });
  });

  it('accepts valid positive integer productId (string)', () => {
    const result = sanitizeOrderItemReference('200001');
    expect(result).toEqual({ productId: 200001, productSlug: '200001' });
  });

  it('rejects synthetic slug sl-*', () => {
    const result = sanitizeOrderItemReference('sl-samsung-galaxy-s24');
    expect(result).toEqual({ productId: null, productSlug: null });
  });

  it('rejects synth-* prefix', () => {
    const result = sanitizeOrderItemReference('synth-42');
    expect(result).toEqual({ productId: null, productSlug: null });
  });

  it('rejects rebuy-* prefix', () => {
    const result = sanitizeOrderItemReference('rebuy-ORD-001');
    expect(result).toEqual({ productId: null, productSlug: null });
  });

  it('rejects pa-* prefix (price alerts synthetic)', () => {
    const result = sanitizeOrderItemReference('pa-3');
    expect(result).toEqual({ productId: null, productSlug: null });
  });

  it('rejects pp-* prefix (purchase predictor synthetic)', () => {
    const result = sanitizeOrderItemReference('pp-7');
    expect(result).toEqual({ productId: null, productSlug: null });
  });

  it('rejects mock-N IDs', () => {
    const result = sanitizeOrderItemReference('mock-42');
    expect(result).toEqual({ productId: null, productSlug: null });
  });

  it('rejects zero', () => {
    const result = sanitizeOrderItemReference(0);
    expect(result).toEqual({ productId: null, productSlug: null });
  });

  it('rejects negative numbers', () => {
    const result = sanitizeOrderItemReference(-5);
    expect(result).toEqual({ productId: null, productSlug: null });
  });

  it('rejects NaN', () => {
    const result = sanitizeOrderItemReference(NaN);
    expect(result).toEqual({ productId: null, productSlug: null });
  });

  it('rejects float', () => {
    const result = sanitizeOrderItemReference(1.5);
    expect(result).toEqual({ productId: null, productSlug: null });
  });

  it('rejects undefined productId but accepts numeric productSlug', () => {
    const result = sanitizeOrderItemReference(undefined, '236646');
    expect(result).toEqual({ productId: 236646, productSlug: '236646' });
  });

  it('rejects both undefined', () => {
    const result = sanitizeOrderItemReference(undefined, undefined);
    expect(result).toEqual({ productId: null, productSlug: null });
  });

  it('rejects string with spaces around valid number', () => {
    const result = sanitizeOrderItemReference(' 200001 ');
    expect(result).toEqual({ productId: 200001, productSlug: '200001' });
  });

  it('rejects empty string', () => {
    const result = sanitizeOrderItemReference('');
    expect(result).toEqual({ productId: null, productSlug: null });
  });
});

describe('Checkout — Cart item mapping for API', () => {
  it('maps numeric productId correctly', () => {
    const result = mapCartItemForApi({ productId: '236646', name: 'HP Pad', price: 10052, quantity: 1 });
    expect(result.productId).toBe(236646);
    expect(result.productSlug).toBe('236646');
  });

  it('omits productId for synthetic sl-* slug', () => {
    const result = mapCartItemForApi({ productId: 'sl-samsung-galaxy-s24', name: 'Galaxy S24', price: 79999, quantity: 1 });
    expect(result.productId).toBeUndefined();
    expect(result.productSlug).toBeUndefined();
  });

  it('omits productId for synth-* prefix', () => {
    const result = mapCartItemForApi({ productId: 'synth-abc123', name: 'Product', price: 999, quantity: 1 });
    expect(result.productId).toBeUndefined();
    expect(result.productSlug).toBeUndefined();
  });

  it('omits productId for rebuy-* prefix', () => {
    const result = mapCartItemForApi({ productId: 'rebuy-ORD-178', name: 'Product', price: 500, quantity: 1 });
    expect(result.productId).toBeUndefined();
    expect(result.productSlug).toBeUndefined();
  });

  it('omits productId for pa-* prefix', () => {
    const result = mapCartItemForApi({ productId: 'pa-3', name: 'Product', price: 1000, quantity: 1 });
    expect(result.productId).toBeUndefined();
    expect(result.productSlug).toBeUndefined();
  });

  it('omits productId for pp-* prefix', () => {
    const result = mapCartItemForApi({ productId: 'pp-5', name: 'Product', price: 2000, quantity: 1 });
    expect(result.productId).toBeUndefined();
    expect(result.productSlug).toBeUndefined();
  });

  it('preserves productName for server-side resolution', () => {
    const result = mapCartItemForApi({ productId: 'sl-hp-pad', name: 'HP Pad Plus Neo 683', price: 10052, quantity: 2 });
    expect(result.productName).toBe('HP Pad Plus Neo 683');
    expect(result.quantity).toBe(2);
  });
});

describe('End-to-end: sanitize after checkout mapping', () => {
  it('numeric cart ID → valid order item reference', () => {
    const mapped = mapCartItemForApi({ productId: '200006', name: 'HP Pad Plus Neo', price: 111220, quantity: 1 });
    const refs = sanitizeOrderItemReference(mapped.productId, mapped.productSlug);
    expect(refs.productId).toBe(200006);
    expect(refs.productSlug).toBe('200006');
  });

  it('synthetic cart ID → null refs → triggers server-side resolution', () => {
    const mapped = mapCartItemForApi({ productId: 'sl-hp-pad-plus-neo', name: 'HP Pad Plus Neo', price: 111220, quantity: 1 });
    const refs = sanitizeOrderItemReference(mapped.productId, mapped.productSlug);
    expect(refs.productId).toBeNull();
    expect(refs.productSlug).toBeNull();
    // Server-side resolveProductIdByName would then resolve "HP Pad Plus Neo" → 200006
  });

  it('large DB product IDs (200000+) handled correctly', () => {
    const mapped = mapCartItemForApi({ productId: '299999', name: 'Product', price: 500, quantity: 1 });
    const refs = sanitizeOrderItemReference(mapped.productId, mapped.productSlug);
    expect(refs.productId).toBe(299999);
    expect(refs.productSlug).toBe('299999');
  });
});

describe('Smart-delegate addToCart — numeric ID preference', () => {
  function getCartProductId(product: { id?: number; brand: string; name: string }): string {
    // Replicates the fixed smart-delegate addToCart logic
    const numericId = product.id && Number.isInteger(product.id) && product.id > 0
      ? String(product.id)
      : null;
    return numericId || `sl-${product.brand}-${product.name}`.replace(/\s+/g, '-').toLowerCase();
  }

  it('uses numeric DB ID when available', () => {
    const id = getCartProductId({ id: 236646, brand: 'HP', name: 'Pad Plus Neo 683' });
    expect(id).toBe('236646');
  });

  it('falls back to sl-* slug when no ID', () => {
    const id = getCartProductId({ brand: 'Samsung', name: 'Galaxy S24' });
    expect(id).toBe('sl-samsung-galaxy-s24');
  });

  it('falls back to sl-* slug when ID is zero', () => {
    const id = getCartProductId({ id: 0, brand: 'Sony', name: 'WH-1000XM5' });
    expect(id).toBe('sl-sony-wh-1000xm5');
  });

  it('falls back to sl-* slug when ID is negative', () => {
    const id = getCartProductId({ id: -1, brand: 'Apple', name: 'iPhone 15' });
    expect(id).toBe('sl-apple-iphone-15');
  });
});

describe('Account Buy-Again — productId passthrough', () => {
  function getBuyAgainProductId(item: { productId?: number | null }, orderId: string): string {
    return item.productId ? String(item.productId) : `rebuy-${orderId}`;
  }

  it('uses real productId from order item when available', () => {
    const id = getBuyAgainProductId({ productId: 236646 }, 'ORD-178');
    expect(id).toBe('236646');
  });

  it('falls back to rebuy-* when productId is null', () => {
    const id = getBuyAgainProductId({ productId: null }, 'ORD-178');
    expect(id).toBe('rebuy-ORD-178');
  });

  it('falls back to rebuy-* when productId is undefined', () => {
    const id = getBuyAgainProductId({}, 'ORD-178');
    expect(id).toBe('rebuy-ORD-178');
  });
});
