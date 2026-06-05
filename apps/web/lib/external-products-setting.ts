/**
 * External Products Setting — Master toggle managed by admin.
 *
 * When OFF, external (Amazon/Flipkart) products are excluded from:
 *   - Search results (/api/products)
 *   - Intent analysis (/api/intent/analyze)
 *   - Product suggestions & "Top Recommendations"
 *   - Auto-checkout
 *
 * Stored in localStorage key 'dc-allow-external-products' (default: true).
 */

const STORAGE_KEY = 'dc-allow-external-products';

/** Check if external products are allowed (defaults to true if not set) */
export function isExternalProductsAllowed(): boolean {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem(STORAGE_KEY) !== 'false';
}

/** Check if a product is external based on common source indicators */
export function isExternalProduct(product: Record<string, unknown>): boolean {
  // Check explicit source field
  const source = (product.source as string)?.toUpperCase?.();
  if (source === 'EXTERNAL') return true;

  // Check isExternal flag
  if (product.isExternal === true) return true;

  // Check platform field (Amazon, Flipkart are external)
  const platform = (product.platform as string)?.toLowerCase?.();
  if (platform === 'amazon' || platform === 'flipkart') return true;

  // Check source URL
  const url = (product.url as string) || (product.buyUrl as string) || '';
  if (/amazon\.(com|in)|flipkart\.com/i.test(url)) return true;

  return false;
}

/** Filter out external products if toggle is OFF */
export function filterExternalProducts<T extends Record<string, unknown>>(products: T[]): T[] {
  if (isExternalProductsAllowed()) return products;
  return products.filter((p) => !isExternalProduct(p));
}
