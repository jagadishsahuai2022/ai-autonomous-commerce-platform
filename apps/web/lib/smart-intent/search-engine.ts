/**
 * Smart Intent Engine v2 — DB-backed Search (refactored)
 *
 * Product search has been moved entirely to fetchDBProducts() in db-product-bridge.ts.
 * Real PostgreSQL queries replace the former in-memory synthetic catalog search.
 * These shim exports exist for backward compatibility with callers and type references.
 */

import type { ParsedIntent, SearchableProduct } from './types';

// ── Search Engine ────────────────────────────────────────────────────────────

export interface SearchResult {
  product: SearchableProduct;
  matchScore: number;
  matchReasons: string[];
}

/**
 * Returns an empty array. Real product search is performed by fetchDBProducts()
 * in the route handlers (db-product-bridge.ts). This function exists only for
 * backward compatibility with callers that import it.
 */
export function searchProducts(_intent: ParsedIntent, _limit = 20): SearchResult[] {
  return [];
}

// ── Phase 7: Fallback Search ─────────────────────────────────────────────────

/**
 * Returns an empty array. Real product search is performed by fetchDBProducts()
 * in the route handlers (db-product-bridge.ts). This function exists only for
 * backward compatibility with callers that import it.
 */
export function searchWithFallback(_intent: ParsedIntent, _limit = 20): SearchResult[] {
  return [];
}
