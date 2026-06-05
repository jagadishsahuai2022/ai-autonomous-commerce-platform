/**
 * Smart Intent Engine — DB Product Bridge
 *
 * Fetches REAL database products and maps them to SearchableProduct format.
 * Ensures product IDs are DB-safe (single source of truth).
 *
 * NEVER returns non-DB / synthetic products.
 *
 * Two-tier fetch strategy:
 *   A. NestJS API (`/products` with full filter passthrough) — fast, typed
 *   B. Direct PostgreSQL via `query()` from @/lib/db — used when NestJS is down
 *
 * Search strategy (in priority order):
 *   1. Targeted: `search=<noun phrase>` + `category=<canonical>` + budget + brand
 *   2. Broadened: drop category, keep search + budget (handles category misclass.)
 *   3. Generic: search by genericName / canonical noun only + budget
 */

import type { SearchableProduct, ProductSpecifications } from './types';
import { buildSpecifications } from './data-enrichment';
import { loadIntentTaxonomy, type IntentTaxonomy } from './db-intent-taxonomy';

// ── DB Category Taxonomy ─────────────────────────────────────────────────────
//
// Built from the real DB schema (V0067 migration).
//
// PARENT CATEGORY              SUBCATEGORIES  (= Product.category text values)
// ─────────────────────────── ──────────────────────────────────────────────────
// Electronics & Mobile        Smartphones · Laptops · Tablets · Cameras
// Audio & Wearables           Headphones · Speakers · Audio Equipment · Smartwatches
// TV & Display                Televisions
// Gaming                      Gaming
// Home & Kitchen              Home Appliances · Kitchen Appliances · Furniture
// Computer & Peripherals      Computer Accessories · Storage Devices · Networking · Printers
// Health & Wellness           Personal Care · Fitness Equipment
// Office & Workspace          Office Supplies
//
// `Product.category` stores the SUBCATEGORY name (e.g. "Smartphones").
// NestJS `/products?category=<value>` applies: `ILIKE '%value%'`
// → Passing 'appliances' matches BOTH "Home Appliances" AND "Kitchen Appliances".
// → Passing 'phone'      matches "Smartphones" (and "Mobile Phones" if present).
// This substring property is exploited in Strategy 2a (parent-keyword broadening).

/**
 * Strategy 1 — Exact subcategory names tried in priority order.
 * These are real `Product.category` values seeded by the DB migrations.
 * List the most specific/common alias first.
 */
const SUBCATEGORY_CANDIDATES: Record<string, string[]> = {
  // ── Electronics & Mobile ────────────────────────────────────────────────
  phone: ['Smartphones', 'Mobile Phones', 'Feature Phones'],
  laptop: ['Laptops', 'Notebooks', 'Ultrabooks'],
  tablet: ['Tablets', 'E-Readers'],
  camera: ['Cameras', 'DSLR Cameras', 'Action Cameras', 'Webcams'],
  // ── Audio & Wearables ───────────────────────────────────────────────────
  headphones: ['Headphones', 'Earbuds', 'Earphones', 'Neckband', 'Audio Equipment'],
  speaker: ['Speakers', 'Bluetooth Speakers', 'Soundbars', 'Audio Equipment'],
  watch: ['Smartwatches', 'Fitness Trackers', 'Smart Bands'],
  watches: ['Smartwatches', 'Fitness Trackers', 'Smart Bands'],
  // ── TV & Display ────────────────────────────────────────────────────────
  television: ['Televisions', 'Smart TV', 'OLED TV', 'QLED TV', 'LED TV'],
  // ── Gaming ──────────────────────────────────────────────────────────────
  gaming: ['Gaming', 'Gaming Consoles', 'Gaming Accessories'],
  // ── Home & Kitchen ──────────────────────────────────────────────────────
  appliances: ['Home Appliances', 'Kitchen Appliances'],
  furniture: ['Furniture'],
  // ── Computer & Peripherals ──────────────────────────────────────────────
  accessories: ['Computer Accessories'],
  storage: ['Storage Devices'],
  networking: ['Networking'],
  printer: ['Printers'],
  // ── Health & Wellness ───────────────────────────────────────────────────
  grooming: ['Personal Care'],
  fitness: ['Fitness Equipment'],
  // ── Office & Workspace ──────────────────────────────────────────────────
  stationery: ['Office Supplies'],
  office: ['Office Supplies'],
};

/**
 * Strategy 2a — Parent-level broadening keyword.
 *
 * Passed as `category=<keyword>`.  The ILIKE '%keyword%' filter catches ALL
 * subcategory names that contain this substring in a SINGLE API call.
 * Omit (undefined) when the subcategory list already covers the full parent,
 * or when a parent-level catch-all would pull in unrelated products.
 *
 * Key win: "appliances" catches both "Home Appliances" + "Kitchen Appliances"
 * so a query for "washing machine under 60000" broadens correctly without
 * having to make two separate targeted calls that both return nothing.
 */
const PARENT_BROADENING_KEYWORD: Record<string, string | undefined> = {
  phone: 'phone', // → "Smartphones", "Mobile Phones"
  laptop: 'laptop', // → "Laptops", "Notebooks"
  tablet: 'tablet', // → "Tablets"
  camera: 'camera', // → "Cameras", "Action Cameras"
  headphones: 'headphone', // → "Headphones"
  speaker: 'speaker', // → "Speakers", "Bluetooth Speakers"
  watch: 'watch', // → "Smartwatches", "Smart Watch"
  watches: 'watch',
  television: 'telev', // → "Televisions"  ('TV' does NOT appear in the name)
  gaming: 'gaming', // → "Gaming", "Gaming Consoles", "Gaming Accessories"
  appliances: 'appliances', // → "Home Appliances" + "Kitchen Appliances" ← key win
  furniture: 'furniture', // → "Furniture"
  accessories: 'accessories', // → "Computer Accessories"
  storage: 'storage', // → "Storage Devices"
  networking: 'network', // → "Networking"
  printer: 'printer', // → "Printers"
  grooming: 'care', // → "Personal Care"
  fitness: 'fitness', // → "Fitness Equipment"
  stationery: 'office', // → "Office Supplies"
  office: 'office',
};

/**
 * Strategy 3 — Canonical `Product.genericName` values used for noun-only
 * search (no category filter).  List the most common product nouns first;
 * each is tried as a standalone search term until results are returned.
 */
const GENERIC_NOUNS: Record<string, string[]> = {
  phone: ['Smartphone', 'Android Phone', '5G Phone', 'Mobile Phone'],
  laptop: ['Laptop', 'Gaming Laptop', 'Ultrabook', 'Notebook'],
  tablet: ['Tablet', 'Android Tablet'],
  camera: ['Camera', 'DSLR Camera', 'Mirrorless Camera', 'Action Camera', 'Webcam'],
  headphones: ['Headphones', 'TWS Earbuds', 'Neckband', 'Earphones'],
  speaker: ['Bluetooth Speaker', 'Soundbar', 'Smart Speaker', 'Portable Speaker'],
  watch: ['Smartwatch', 'Fitness Tracker', 'Smart Band'],
  watches: ['Smartwatch', 'Fitness Tracker'],
  television: ['Television', 'Smart TV', '4K TV', 'LED TV', 'OLED TV'],
  gaming: ['Gaming Console', 'Gaming Keyboard', 'Gaming Mouse', 'Gaming Headset', 'Gaming Chair'],
  // Home Appliances first, then Kitchen Appliances — order matters for Strategy 1 priority
  appliances: [
    'Washing Machine', // Home Appliances
    'Refrigerator', // Home Appliances
    'Air Conditioner', // Home Appliances
    'Microwave', // Home Appliances
    'Vacuum Cleaner', // Home Appliances
    'Air Fryer', // Home Appliances
    'Dishwasher', // Home Appliances
    'Water Purifier', // Home Appliances
    'Blender', // Kitchen Appliances
    'Mixer Grinder', // Kitchen Appliances
    'Food Processor', // Kitchen Appliances
    'Coffee Maker', // Kitchen Appliances
    'Induction Cooktop', // Kitchen Appliances
  ],
  furniture: ['Ergonomic Chair', 'Sofa', 'Bed Frame', 'Study Desk', 'Wardrobe'],
  accessories: ['Mechanical Keyboard', 'Gaming Mouse', 'Monitor', 'Webcam', 'USB Hub'],
  storage: ['External SSD', 'SSD', 'Hard Drive', 'Pen Drive', 'Memory Card'],
  networking: ['WiFi Router', 'Mesh Router', 'Network Switch', 'WiFi Extender'],
  printer: ['Laser Printer', 'Inkjet Printer', 'All-in-One Printer', 'Photo Printer'],
  grooming: ['Beard Trimmer', 'Electric Shaver', 'Hair Dryer', 'Hair Straightener'],
  fitness: ['Treadmill', 'Exercise Bike', 'Yoga Mat', 'Dumbbell Set'],
  stationery: ['Office Supplies', 'Paper Shredder', 'Calculator', 'Label Maker'],
  office: ['Ergonomic Chair', 'Standing Desk', 'Office Supplies'],
};

// ── Specific Product Type Detection ──────────────────────────────────────────
//
// Maps user query patterns to exact genericName values stored in the DB.
// Used in buildSearchString() to pick the SPECIFIC product type when the user
// query unambiguously names one (e.g. "washing machine" → "Washing Machine").
// Without this, primaryNoun would always default to genericNouns[0] which is
// always the FIRST appliance type regardless of what the user asked for.
//
// IMPORTANT: The genericName values here MUST match what V0096 migration seeds
// into the DB.  Any mismatch means Strategy 1 returns 0 results.

interface ProductTypePattern {
  /** Intent categories this pattern applies to. */
  categories: string[];
  /** Regex to match against the lowercase raw query. */
  pattern: RegExp;
  /** Exact genericName value as stored in Product.genericName after V0096. */
  genericName: string;
}

const SPECIFIC_PRODUCT_TYPE_PATTERNS: ProductTypePattern[] = [
  // ── Home Appliances ──────────────────────────────────────────────────────
  {
    categories: ['appliances'],
    pattern: /\bwashing\b|\bwasher\b|\bfront\s*load\b|\btop\s*load\b|\bsemi[-\s]?auto/i,
    genericName: 'Washing Machine',
  },
  {
    categories: ['appliances'],
    pattern: /\brefrigerator\b|\bfridge\b|\bfreez(er)?\b/i,
    genericName: 'Refrigerator',
  },
  {
    categories: ['appliances'],
    pattern:
      /\bair\s*condition(er|ing)?\b|\bsplit\s*ac\b|\bwindow\s*ac\b|\binverter\s*ac\b|\b(1\.5|2|3)\s*ton\b|\bac\b/i,
    genericName: 'Air Conditioner',
  },
  {
    categories: ['appliances'],
    pattern: /\bmicrowav/i,
    genericName: 'Microwave',
  },
  {
    categories: ['appliances'],
    pattern: /\bvacuum\b/i,
    genericName: 'Vacuum Cleaner',
  },
  {
    categories: ['appliances'],
    pattern: /\bair\s*fry/i,
    genericName: 'Air Fryer',
  },
  {
    categories: ['appliances'],
    pattern: /\bdishwash/i,
    genericName: 'Dishwasher',
  },
  {
    categories: ['appliances'],
    pattern: /\bwater\s*purif|\bro\s*purif|\bwater\s*filter/i,
    genericName: 'Water Purifier',
  },
  // ── Kitchen Appliances ──────────────────────────────────────────────────
  {
    categories: ['appliances'],
    pattern: /\bblend/i,
    genericName: 'Blender',
  },
  {
    categories: ['appliances'],
    pattern: /\bmixer\b|\bgrinder\b/i,
    genericName: 'Mixer Grinder',
  },
  {
    categories: ['appliances'],
    pattern: /\bfood\s*process/i,
    genericName: 'Food Processor',
  },
  {
    categories: ['appliances'],
    pattern: /\bcoffee\s*(mak|brew|machine)|\bespresso/i,
    genericName: 'Coffee Maker',
  },
  {
    categories: ['appliances'],
    pattern: /\binduction\b|\bcooktop\b/i,
    genericName: 'Induction Cooktop',
  },
  // ── Laptops ──────────────────────────────────────────────────────────────
  {
    categories: ['laptop'],
    pattern: /\bgaming\s*laptop\b|\bgaming\s*notebook\b/i,
    genericName: 'Gaming Laptop',
  },
  {
    categories: ['laptop'],
    pattern: /\bultrabook\b|\bultra\s*book\b|\bslim\s*laptop\b/i,
    genericName: 'Ultrabook',
  },
  // ── Phones ───────────────────────────────────────────────────────────────
  {
    categories: ['phone'],
    pattern: /\b5g\s*phone\b|\b5g\s*mobile\b/i,
    genericName: '5G Phone',
  },
  {
    categories: ['phone'],
    pattern: /\bandroid\s*phone\b/i,
    genericName: 'Android Phone',
  },
  // ── TVs ──────────────────────────────────────────────────────────────────
  {
    categories: ['television'],
    pattern: /\b4k\s*tv\b|\b4k\s*television\b|\buhd\s*tv\b/i,
    genericName: '4K TV',
  },
  {
    categories: ['television'],
    pattern: /\boled\s*tv\b|\boled\s*television\b/i,
    genericName: 'OLED TV',
  },
  {
    categories: ['television'],
    pattern: /\bsmart\s*tv\b/i,
    genericName: 'Smart TV',
  },
  // ── Headphones ───────────────────────────────────────────────────────────
  {
    categories: ['headphones'],
    pattern: /\btws\b|\bearbuds?\b|\bairpods?\b/i,
    genericName: 'TWS Earbuds',
  },
  {
    categories: ['headphones'],
    pattern: /\bneckband\b/i,
    genericName: 'Neckband',
  },
];

/**
 * Detect the specific product type the user is looking for within a category.
 * Returns the exact genericName value as seeded in the DB by V0096, or null
 * if no specific type was detected (caller falls back to primaryNoun).
 */
function detectSpecificProductType(intentCategory: string, rawQuery: string): string | null {
  for (const entry of SPECIFIC_PRODUCT_TYPE_PATTERNS) {
    if (entry.categories.includes(intentCategory) && entry.pattern.test(rawQuery)) {
      return entry.genericName;
    }
  }
  return null;
}

/** Derived: primary subcategory name for exact-match SQL in fetchDBProductsDirect. */
const PRIMARY_SUBCATEGORY: Record<string, string> = Object.fromEntries(
  Object.entries(SUBCATEGORY_CANDIDATES).map(([k, v]) => [k, v[0]])
);

// ── NestJS API base URL (server-side) ────────────────────────────────────────
// Try multiple bases in order so we work in dev (localhost), Docker (service
// name), and prod (BACKEND_URL) without configuration.
function getApiBases(): string[] {
  const bases = [
    process.env.NESTJS_API_URL,
    process.env.API_INTERNAL_URL, // Docker Compose: http://api:3001
    process.env.BACKEND_URL,
    'http://localhost:3001', // local dev
    'http://localhost:3002', // Docker host → dc-latest-api
    'http://api:3001', // Docker internal service name
  ].filter(Boolean) as string[];
  // De-duplicate while preserving order
  return Array.from(new Set(bases));
}

/** Optional context to enrich the DB search beyond category/budget/brand. */
export interface FetchDBProductsOpts {
  /** Free-form search terms (use_case keywords, features, noun signals).
   *  Joined with the canonical category noun to form the `search=` query. */
  searchTerms?: string[];
  /** Selected use_case (e.g. "study", "gaming") — added to search terms. */
  useCase?: string | null;
  /** Selected feature labels — added to search terms. */
  features?: string[];
  /** Allow the search to broaden (drop category) when the targeted query
   *  returns nothing.  Defaults to true. */
  allowBroadening?: boolean;
  /**
   * The original raw user query (e.g. "washing machine under 60000").
   * Used by detectSpecificProductType() to pick the exact genericName rather
   * than always defaulting to genericNouns[0].
   * Example: "refrigerator" → "Refrigerator" instead of "Washing Machine".
   */
  rawQuery?: string;
}

/** Build the canonical search string for a category.
 *
 * Strategy 1 (targeted) uses the canonical `primaryNoun` ONLY — adding extra
 * tokens (use_case, features) is counter-productive because the NestJS search
 * requires EVERY token to match a product's name/description/category/genericName
 * with an AND condition.  A token like "home" or "gaming" that is absent from
 * most product names turns Strategy 1 into a guaranteed zero-result query.
 *
 * Extra context (use_case, features) is kept in `opts` and applied by the
 * caller as a Strategy 3+ enhancement when Strategy 1/2 already returns results
 * and we need to re-rank, or when we have no primaryNoun and fall back to raw
 * search terms.
 */
function buildSearchString(
  intentCategory: string | null,
  primaryNoun: string | undefined,
  opts: FetchDBProductsOpts | undefined
): string {
  // If the caller provided the raw query, try to detect the SPECIFIC product
  // type first.  This ensures "washing machine" → "Washing Machine" and
  // "refrigerator" → "Refrigerator" instead of both always returning the
  // first genericNoun (which would be "Washing Machine" for both).
  if (intentCategory && opts?.rawQuery) {
    const specificType = detectSpecificProductType(intentCategory, opts.rawQuery);
    if (specificType) return specificType;
  }
  // Use the canonical noun next — it is the most reliable single search token.
  if (primaryNoun) return primaryNoun;
  // No noun configured → fall back to the intent category name itself.
  if (intentCategory) return intentCategory;
  // Last resort: use the first raw search term provided by the caller.
  return opts?.searchTerms?.[0] ?? '';
}

// ── Fetch real DB products by intent category ────────────────────────────────

export async function fetchDBProducts(
  intentCategory: string | null,
  budget?: { min: number; max: number } | null,
  brand?: string | null,
  maxResults: number = 50,
  opts?: FetchDBProductsOpts
): Promise<SearchableProduct[]> {
  if (!intentCategory) return [];

  // Load taxonomy from DB (cached 5 min; falls back to static defaults on error).
  const taxonomy = await loadIntentTaxonomy();
  const dbCategories = taxonomy.subcategoryCandidates[intentCategory] ?? [];
  const parentKeyword = taxonomy.parentBroadeningKeyword[intentCategory];
  const genericNouns = taxonomy.genericNouns[intentCategory] ?? [];
  const primaryNoun = genericNouns[0];

  const searchString = buildSearchString(intentCategory, primaryNoun, opts);
  const allowBroadening = opts?.allowBroadening !== false;

  // ── Strategy 1: targeted — exact subcategory + search + budget + brand ────
  // Each subcategory alias is tried in order; stops as soon as results arrive.
  for (const dbCat of dbCategories) {
    const products = await fetchFromNestApi({
      search: searchString,
      category: dbCat,
      brand: brand ?? undefined,
      minPrice: budget?.min,
      maxPrice: budget?.max,
      take: maxResults,
      intentCategory,
    });
    if (products.length > 0) return products.slice(0, maxResults);
  }

  // ── Strategy 1b: category-only (no search) — handles DBs where product names
  // are generic (e.g. "Xiaomi V15 Detect Premium") and don't contain product-type
  // keywords like "Washing Machine". Falls back when Strategy 1 returns nothing.
  if (searchString) {
    for (const dbCat of dbCategories) {
      const products = await fetchFromNestApi({
        category: dbCat,
        brand: brand ?? undefined,
        minPrice: budget?.min,
        maxPrice: budget?.max,
        take: maxResults,
        intentCategory,
      });
      if (products.length > 0) return products.slice(0, maxResults);
    }
  }

  if (!allowBroadening) return [];

  // ── Strategy 2a: parent-keyword broadening ────────────────────────────────
  // A single ILIKE '%keyword%' call catches ALL sibling subcategories under the
  // same parent (e.g. 'appliances' → "Home Appliances" + "Kitchen Appliances").
  if (parentKeyword && searchString) {
    const products = await fetchFromNestApi({
      search: searchString,
      category: parentKeyword,
      brand: brand ?? undefined,
      minPrice: budget?.min,
      maxPrice: budget?.max,
      take: maxResults,
      intentCategory,
    });
    if (products.length > 0) return products.slice(0, maxResults);
  }

  // ── Strategy 2b: full category-drop — search + budget, no category filter ──
  if (searchString) {
    const products = await fetchFromNestApi({
      search: searchString,
      brand: brand ?? undefined,
      minPrice: budget?.min,
      maxPrice: budget?.max,
      take: maxResults,
      intentCategory,
    });
    if (products.length > 0) return products.slice(0, maxResults);
  }

  // ── Strategy 3: noun-only — drop all filters except budget, try each noun ──
  for (const noun of genericNouns) {
    const products = await fetchFromNestApi({
      search: noun,
      minPrice: budget?.min,
      maxPrice: budget?.max,
      take: maxResults,
      intentCategory,
    });
    if (products.length > 0) return products.slice(0, maxResults);
  }

  // ── Strategy 4 (last resort): direct PostgreSQL query ────────────────────
  return await fetchDBProductsDirect(intentCategory, budget, brand, maxResults, taxonomy);
}

/** Single NestJS `/products` call with structured filters; returns mapped
 *  SearchableProduct[] or [] on any failure (caller decides how to react). */
async function fetchFromNestApi(args: {
  search?: string;
  category?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  take: number;
  intentCategory: string;
}): Promise<SearchableProduct[]> {
  const params = new URLSearchParams();
  if (args.search) params.set('search', args.search);
  if (args.category) params.set('category', args.category);
  if (args.brand) params.set('brand', args.brand);
  if (typeof args.minPrice === 'number' && args.minPrice > 0) {
    params.set('minPrice', String(args.minPrice));
  }
  if (typeof args.maxPrice === 'number' && args.maxPrice > 0) {
    params.set('maxPrice', String(args.maxPrice));
  }
  params.set('take', String(Math.max(1, Math.min(args.take, 100))));
  params.set('skip', '0');

  for (const base of getApiBases()) {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 1500); // 1.5s per base (fail fast on dead hosts)
      const res = await fetch(`${base}/products?${params.toString()}`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(t);
      if (!res.ok) continue;
      const data = await res.json();
      const raw: unknown[] = Array.isArray(data)
        ? data
        : ((data as { products?: unknown[]; data?: unknown[] }).products ??
          (data as { data?: unknown[] }).data ??
          []);
      if (raw.length === 0) return [];
      return raw
        .map((p) => mapRawProduct(p as Record<string, unknown>, args.intentCategory))
        .filter((p): p is SearchableProduct => p !== null);
    } catch {
      // try next base
    }
  }
  return [];
}

/** Map a raw product record from the NestJS API to a SearchableProduct. */
function mapRawProduct(
  p: Record<string, unknown>,
  intentCategory: string
): SearchableProduct | null {
  const price = (p.price as number) || (p.sellingPrice as number) || 0;
  if (!p.id || price <= 0) return null;
  const subCategory = (p.subCategory as string) || '';
  const brandStr = (p.brand as string) || extractBrandFromName((p.name as string) || '');
  const rawSpecs = (p.specifications as Record<string, unknown>) || {};
  const stringSpecs: Record<string, string> = {};
  for (const [k, v] of Object.entries(rawSpecs)) {
    if (v !== null && v !== undefined) stringSpecs[k] = String(v);
  }
  const specs: ProductSpecifications = buildSpecifications(
    intentCategory,
    subCategory,
    brandStr,
    price,
    stringSpecs
  );
  const images = p.images;
  const image =
    (p.image as string) ||
    (p.thumbnailUrl as string) ||
    (p.imageUrl as string) ||
    (Array.isArray(images) ? (images[0] as string) : '') ||
    '/product-placeholder.svg';
  return {
    id: String(p.id),
    name: (p.name as string) || 'Unknown Product',
    brand: brandStr,
    price,
    originalPrice: (p.originalPrice as number) || (p.mrp as number) || price,
    category: intentCategory,
    subCategory,
    rating: (p.rating as number) || 3.5,
    reviewCount: (p.reviewCount as number) || (p.ratingCount as number) || 0,
    image,
    inStock: p.inStock !== false,
    delivery: {
      daysMin: 1,
      daysMax: (p.deliveryDays as number) || 5,
      free: price > 500,
    },
    codAvailable: price < 100000,
    hasEMI: price > 5000,
    attributes: stringSpecs,
    searchIndex: [p.name, brandStr, intentCategory, subCategory, p.description, p.genericName]
      .filter(Boolean)
      .join(' ')
      .toLowerCase(),
    specifications: specs,
  };
}

/** Extract a likely brand name from the first token(s) of a product name.
 *  The seed data places the brand at the start (e.g. "LG 8 Kg Front Load…"). */
function extractBrandFromName(name: string): string {
  if (!name) return '';
  const first = name.trim().split(/\s+/)[0] || '';
  // Filter out obvious non-brands (numbers, units)
  if (/^\d/.test(first)) return '';
  return first;
}

// ── Tier B: Direct PostgreSQL fallback ───────────────────────────────────────
// Used when the NestJS API is not reachable. Queries the Product table directly
// using the same `query()` helper used by the shopping-list route.

async function fetchDBProductsDirect(
  intentCategory: string | null,
  budget?: { min: number; max: number } | null,
  brand?: string | null,
  maxResults: number = 50,
  taxonomy?: IntentTaxonomy
): Promise<SearchableProduct[]> {
  if (!intentCategory) return [];

  try {
    // Dynamic import to avoid bundling pg in client bundles
    const { query: dbQuery } = await import('@/lib/db');

    // Use taxonomy if provided (already loaded by caller); otherwise fall back
    // to a direct taxonomy load so this function stays self-contained.
    const tax = taxonomy ?? (await loadIntentTaxonomy());
    const dbCategory = tax.subcategoryCandidates[intentCategory]?.[0] ?? intentCategory;
    const validSubcats = (tax.subcategoryCandidates[intentCategory] ?? []).map((s) =>
      s.toLowerCase()
    );

    // Build WHERE conditions
    // Strategy A: exact category match (fast path)
    // Strategy B: ILIKE on category OR name/genericName (broader fallback, used in a second query)
    const conditions: string[] = [];
    const args: unknown[] = [];
    let pi = 1;

    if (dbCategory) {
      // Use ILIKE so "Home Appliances" is matched by searching for "appliances"
      conditions.push(`LOWER(p.category) LIKE $${pi}`);
      args.push(`%${dbCategory.toLowerCase()}%`);
      pi++;
    }
    if (brand) {
      conditions.push(`LOWER(p.name) LIKE $${pi}`);
      args.push(`%${brand.toLowerCase()}%`);
      pi++;
    }
    if (budget?.max && budget.max > 0) {
      conditions.push(`p.price <= $${pi}`);
      args.push(budget.max);
      pi++;
    }
    if (budget?.min && budget.min > 0) {
      conditions.push(`p.price >= $${pi}`);
      args.push(budget.min * 0.5);
      pi++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    type RawProduct = {
      id: number;
      name: string;
      price: number;
      category: string;
      description: string | null;
      imageUrl: string | null;
      subCategoryName: string | null;
      rating: number | null;
    };

    const rows = await dbQuery<RawProduct>(
      `SELECT DISTINCT p.id, p.name, p.price, p.category,
              p.description, p."imageUrl",
              psc.name AS "subCategoryName",
              pbm.rating
       FROM "Product" p
       LEFT JOIN "ProductSubCategoryMap" pscm ON pscm."productId" = p.id AND pscm.approved = TRUE
       LEFT JOIN "ProductSubCategory" psc ON psc.id = pscm."subCategoryId"
       LEFT JOIN "ProductBusinessMetrics" pbm ON pbm."productId" = p.id
       ${whereClause}
       ORDER BY p.price ASC
       LIMIT $${pi}`,
      [...args, maxResults * 2]
    );

    // ── Fallback B: name/genericName ILIKE search when category query returns nothing ──
    // Handles cases where Product.category value doesn't exactly contain our dbCategory
    // keyword but the product name or genericName clearly matches (e.g. "Washing Machine").
    let effectiveRows = rows;
    if (rows.length === 0 && dbCategory) {
      const primaryNounFallback = tax.genericNouns[intentCategory]?.[0] ?? dbCategory;
      const fallbackArgs: unknown[] = [
        `%${primaryNounFallback.toLowerCase()}%`,
        `%${primaryNounFallback.toLowerCase()}%`,
      ];
      let fpi = 3;
      const extraConditions: string[] = [];
      if (budget?.max && budget.max > 0) {
        extraConditions.push(`p.price <= $${fpi}`);
        fallbackArgs.push(budget.max);
        fpi++;
      }
      if (brand) {
        extraConditions.push(`LOWER(p.name) LIKE $${fpi}`);
        fallbackArgs.push(`%${brand.toLowerCase()}%`);
        fpi++;
      }
      const fallbackWhere =
        `WHERE (LOWER(p.name) LIKE $1 OR LOWER(p."genericName") LIKE $2)` +
        (extraConditions.length > 0 ? ` AND ${extraConditions.join(' AND ')}` : '');
      const fallbackRows = await dbQuery<RawProduct>(
        `SELECT DISTINCT p.id, p.name, p.price, p.category,
                p.description, p."imageUrl",
                psc.name AS "subCategoryName",
                pbm.rating
         FROM "Product" p
         LEFT JOIN "ProductSubCategoryMap" pscm ON pscm."productId" = p.id AND pscm.approved = TRUE
         LEFT JOIN "ProductSubCategory" psc ON psc.id = pscm."subCategoryId"
         LEFT JOIN "ProductBusinessMetrics" pbm ON pbm."productId" = p.id
         ${fallbackWhere}
         ORDER BY p.price ASC
         LIMIT $${fpi}`,
        [...fallbackArgs, maxResults * 2]
      );
      effectiveRows = fallbackRows;
    }

    const mapped: SearchableProduct[] = [];
    for (const p of effectiveRows) {
      // Filter by subcategory when known
      if (validSubcats.length > 0 && p.subCategoryName) {
        const scLower = p.subCategoryName.toLowerCase();
        if (!validSubcats.some((sc) => scLower.includes(sc) || sc.includes(scLower))) {
          // Check if product name matches subcategory keywords
          const nameLower = p.name.toLowerCase();
          if (
            !validSubcats.some((sc) =>
              sc.split(/[\s\/]+/).some((w) => w.length >= 3 && nameLower.includes(w))
            )
          ) {
            continue;
          }
        }
      }

      const specs: ProductSpecifications = buildSpecifications(
        intentCategory,
        p.subCategoryName || '',
        p.name.split(/\s+/)[0] || '',
        p.price,
        {}
      );
      const brand0 = p.name.split(/\s+/)[0] || '';

      mapped.push({
        id: String(p.id),
        name: p.name,
        brand: brand0,
        price: p.price,
        originalPrice: p.price,
        category: intentCategory,
        subCategory: p.subCategoryName || '',
        rating: typeof p.rating === 'number' ? p.rating : 4.0,
        reviewCount: 0,
        image: p.imageUrl || '/product-placeholder.svg',
        inStock: true,
        delivery: {
          daysMin: 1,
          daysMax: p.price > 30000 ? 7 : p.price > 10000 ? 5 : 3,
          free: p.price > 500,
        },
        codAvailable: p.price < 100000,
        hasEMI: p.price > 5000,
        attributes: {},
        searchIndex: [p.name, brand0, intentCategory, p.subCategoryName, p.description]
          .filter(Boolean)
          .join(' ')
          .toLowerCase(),
        specifications: specs,
      });
    }

    return mapped.slice(0, maxResults);
  } catch (directErr) {
    console.error('[db-product-bridge] Direct DB query also failed:', directErr);
    return [];
  }
}

// ── Helper: Check if a product ID is from the real DB ────────────────────────

export function isDBProductId(id: string | number): boolean {
  return !String(id).startsWith('synth-');
}

// ── Helper: Merge DB and synthetic products (DB takes priority) ──────────────

export function mergeProducts(
  dbProducts: SearchableProduct[],
  _syntheticProducts: SearchableProduct[], // kept for API compat — never used
  maxTotal: number = 20
): SearchableProduct[] {
  // Only return real DB products — never backfill with synthetic/mock data.
  // If there are fewer DB results than maxTotal that is the correct answer;
  // callers should show an appropriate "no results" state rather than
  // fabricating products that cannot be purchased.
  return dbProducts.slice(0, maxTotal);
}
