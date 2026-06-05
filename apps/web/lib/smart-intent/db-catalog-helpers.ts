/**
 * Smart Intent Engine — DB-backed Catalog Helpers
 *
 * Replaces getSyntheticBrands() / getSyntheticPriceRange() from synthetic-catalog.ts
 * with real queries against ProductBrand + Product tables.
 *
 * Used by question-generator.ts and analyze/route.ts to build budget/brand question
 * options from actual database data — never from hardcoded lists.
 *
 * Both functions are safe to call concurrently; they catch all DB errors and
 * return empty/zero values so the caller can fall back to synthetic data gracefully.
 */

import { query } from '@/lib/db';

export interface DBPriceRange {
  min: number;
  max: number;
  p25: number;
  p50: number;
  p75: number;
}

/**
 * Returns up to 10 real brand names for the given intent category key
 * (e.g. "phone", "laptop", "appliances") from the ProductBrand table.
 *
 * Returns [] when the DB is unavailable or no brands are found.
 */
export async function getDBBrandsForCategory(intentCategory: string): Promise<string[]> {
  try {
    const catKeyword = getCategoryKeyword(intentCategory);
    if (!catKeyword) return [];

    const rows = await query<{ name: string }>(
      `SELECT DISTINCT pb.name
       FROM "ProductBrand" pb
       JOIN "ProductBrandMap" pbm ON pb.id = pbm."brandId"
       JOIN "Product" p ON pbm."productId" = p.id
       WHERE p.category ILIKE $1
         AND p."inStock" = true
       ORDER BY pb.name
       LIMIT 10`,
      [`%${catKeyword}%`]
    );
    return rows.map((r) => r.name);
  } catch {
    return [];
  }
}

/**
 * Returns real min/max/percentile prices for products in the given intent
 * category key.  Returns zeros when the DB is unavailable or the category
 * has no products.
 */
export async function getDBPriceRange(intentCategory: string): Promise<DBPriceRange> {
  const empty: DBPriceRange = { min: 0, max: 0, p25: 0, p50: 0, p75: 0 };
  try {
    const catKeyword = getCategoryKeyword(intentCategory);
    if (!catKeyword) return empty;

    const rows = await query<{
      min_price: string;
      max_price: string;
      p25: string;
      p50: string;
      p75: string;
    }>(
      `SELECT
         MIN(price)::int                                          AS min_price,
         MAX(price)::int                                          AS max_price,
         PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY price)::int AS p25,
         PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY price)::int AS p50,
         PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY price)::int AS p75
       FROM "Product"
       WHERE category ILIKE $1
         AND "inStock" = true`,
      [`%${catKeyword}%`]
    );

    const row = rows[0];
    if (!row || !row.max_price) return empty;

    return {
      min: parseInt(row.min_price, 10) || 0,
      max: parseInt(row.max_price, 10) || 0,
      p25: parseInt(row.p25, 10) || 0,
      p50: parseInt(row.p50, 10) || 0,
      p75: parseInt(row.p75, 10) || 0,
    };
  } catch {
    return empty;
  }
}

/**
 * Convenience: fetch both brands and price range in parallel.
 * Returns defaults on any DB failure so callers never need to handle errors.
 */
export async function getDBCatalogData(
  intentCategory: string
): Promise<{ brands: string[]; priceRange: DBPriceRange }> {
  const [brands, priceRange] = await Promise.all([
    getDBBrandsForCategory(intentCategory),
    getDBPriceRange(intentCategory),
  ]);
  return { brands, priceRange };
}

// ── Private helpers ──────────────────────────────────────────────────────────

/**
 * Maps intent category keys to the ILIKE search keyword used in
 * Product.category queries (ILIKE '%keyword%').
 *
 * The keyword must be a substring of the actual Product.category value seeded
 * by the DB migrations (e.g. "smartphone" matches "Smartphones").
 */
function getCategoryKeyword(intentCategory: string): string | null {
  const mapping: Record<string, string> = {
    phone: 'smartphone',
    laptop: 'laptop',
    tablet: 'tablet',
    camera: 'camera',
    headphones: 'headphone',
    speaker: 'speaker',
    watch: 'watch',
    television: 'television',
    gaming: 'gaming',
    appliances: 'appliances',
    furniture: 'furniture',
    accessories: 'accessories',
    storage: 'storage',
    networking: 'network',
    printer: 'printer',
    grooming: 'personal care',
    fitness: 'fitness',
    stationery: 'office supplies',
    office: 'office supplies',
  };
  return mapping[intentCategory] ?? intentCategory ?? null;
}
