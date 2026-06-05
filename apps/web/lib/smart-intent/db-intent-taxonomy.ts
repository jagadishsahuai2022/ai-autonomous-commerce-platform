/**
 * Intent Taxonomy — DB-driven category/noun mapping for the Smart Intent Engine.
 *
 * Replaces the hardcoded `SUBCATEGORY_CANDIDATES`, `PARENT_BROADENING_KEYWORD`
 * and `GENERIC_NOUNS` maps with a live DB table so the taxonomy grows as the
 * product catalog evolves — no code change or redeploy required.
 *
 * Data sources (merged in priority order):
 *   1. `IntentCategoryMap` table  — admin/ops-configurable at runtime
 *   2. Live `Product.genericName` — auto-enriches as new products are added
 *   3. Static FALLBACK constants  — safety net when DB is unreachable
 *
 * Admin workflow:
 *   -- Add a new product type noun (e.g. "Chromebook") without redeploying:
 *   UPDATE "IntentCategoryMap"
 *   SET    "genericNouns" = "genericNouns" || ARRAY['Chromebook'], "updatedAt" = NOW()
 *   WHERE  intent = 'laptop';
 *   -- The change is picked up within CACHE_TTL_MS (5 minutes).
 *
 * Cache:
 *   • Successful DB load → refresh every CACHE_TTL_MS (5 min)
 *   • DB failure         → retry after RETRY_AFTER_FAILURE_MS (30 s)
 *   • Cache is in-process; cleared on container restart (intentional)
 */

export interface IntentTaxonomy {
  /** Strategy 1 — exact `Product.category` names, tried in priority order. */
  subcategoryCandidates: Record<string, string[]>;
  /** Strategy 2a — parent ILIKE broadening keyword (undefined = skip). */
  parentBroadeningKeyword: Record<string, string | undefined>;
  /** Strategy 3 — canonical `Product.genericName` noun phrases. */
  genericNouns: Record<string, string[]>;
}

// ── Static fallback ──────────────────────────────────────────────────────────
// Used when IntentCategoryMap is unreachable or not yet seeded.
// Edit the DB table, not these constants, once the table exists.

const FALLBACK_SUBCATEGORY_CANDIDATES: Record<string, string[]> = {
  // Electronics & Mobile  (ProductCategory: "Electronics & Mobile")
  phone: ['Smartphones', 'Mobile Phones', 'Feature Phones'],
  laptop: ['Laptops', 'Notebooks', 'Ultrabooks'],
  tablet: ['Tablets', 'E-Readers'],
  camera: ['Cameras', 'DSLR Cameras', 'Action Cameras', 'Webcams'],
  // Audio & Wearables     (ProductCategory: "Audio & Wearables")
  headphones: ['Headphones', 'Earbuds', 'Earphones', 'Neckband', 'Audio Equipment'],
  speaker: ['Speakers', 'Bluetooth Speakers', 'Soundbars', 'Audio Equipment'],
  watch: ['Smartwatches', 'Fitness Trackers', 'Smart Bands'],
  watches: ['Smartwatches', 'Fitness Trackers', 'Smart Bands'],
  // TV & Display          (ProductCategory: "TV & Display")
  television: ['Televisions', 'Smart TV', 'OLED TV', 'QLED TV', 'LED TV'],
  // Gaming                (ProductCategory: "Gaming")
  gaming: ['Gaming', 'Gaming Consoles', 'Gaming Accessories'],
  // Home & Kitchen        (ProductCategory: "Home & Kitchen")
  appliances: ['Home Appliances', 'Kitchen Appliances'],
  furniture: ['Furniture'],
  // Computer & Peripherals(ProductCategory: "Computer & Peripherals")
  accessories: ['Computer Accessories'],
  storage: ['Storage Devices'],
  networking: ['Networking'],
  printer: ['Printers'],
  // Health & Wellness     (ProductCategory: "Health & Wellness")
  grooming: ['Personal Care'],
  fitness: ['Fitness Equipment'],
  // Office & Workspace    (ProductCategory: "Office & Workspace")
  stationery: ['Office Supplies'],
  office: ['Office Supplies'],
};

const FALLBACK_PARENT_BROADENING_KEYWORD: Record<string, string | undefined> = {
  phone: 'phone', // ILIKE '%phone%'      → Smartphones, Mobile Phones
  laptop: 'laptop', // ILIKE '%laptop%'     → Laptops, Notebooks
  tablet: 'tablet', // ILIKE '%tablet%'     → Tablets
  camera: 'camera', // ILIKE '%camera%'     → Cameras, Action Cameras
  headphones: 'headphone', // ILIKE '%headphone%'  → Headphones
  speaker: 'speaker', // ILIKE '%speaker%'    → Speakers, Bluetooth Speakers
  watch: 'watch', // ILIKE '%watch%'      → Smartwatches
  watches: 'watch',
  television: 'telev', // ILIKE '%telev%'      → Televisions
  gaming: 'gaming', // ILIKE '%gaming%'     → Gaming, Gaming Consoles
  appliances: 'appliances', // ILIKE '%appliances%' → Home Appliances + Kitchen Appliances
  furniture: 'furniture',
  accessories: 'accessories',
  storage: 'storage',
  networking: 'network',
  printer: 'printer',
  grooming: 'care', // ILIKE '%care%'       → Personal Care
  fitness: 'fitness',
  stationery: 'office',
  office: 'office',
};

const FALLBACK_GENERIC_NOUNS: Record<string, string[]> = {
  phone: ['Smartphone', 'Mobile Phone'],
  laptop: ['Laptop', 'Notebook', 'Ultrabook'],
  tablet: ['Tablet'],
  camera: ['Camera', 'DSLR Camera', 'Mirrorless Camera', 'Action Camera'],
  headphones: ['Headphones', 'Earphones', 'TWS Earbuds', 'Neckband', 'Earbuds'],
  speaker: ['Bluetooth Speaker', 'Speaker', 'Soundbar'],
  watch: ['Smartwatch', 'Fitness Tracker', 'Smart Band'],
  watches: ['Smartwatch', 'Fitness Tracker'],
  television: ['Television', 'Smart TV', '4K TV', 'LED TV'],
  gaming: ['Gaming Console', 'Gaming Laptop', 'Gaming Chair', 'Gaming Headset'],
  appliances: [
    'Washing Machine',
    'Refrigerator',
    'Air Conditioner',
    'Microwave',
    'Air Fryer',
    'Dishwasher',
    'Water Purifier',
    'Vacuum Cleaner',
  ],
  furniture: ['Sofa', 'Bed', 'Mattress', 'Ergonomic Chair', 'Standing Desk'],
  accessories: ['Keyboard', 'Mouse', 'Monitor', 'Webcam', 'USB Hub'],
  storage: ['SSD', 'Hard Drive', 'External SSD', 'Pen Drive', 'NAS Drive'],
  networking: ['WiFi Router', 'Mesh Router', 'Router', 'Network Switch'],
  printer: ['Laser Printer', 'Inkjet Printer', 'All-in-One Printer'],
  grooming: ['Trimmer', 'Electric Shaver', 'Hair Dryer', 'IPL Hair Removal Device'],
  fitness: ['Treadmill', 'Exercise Bike', 'Yoga Mat', 'Dumbbell Set'],
  stationery: ['Office Supplies', 'Paper Shredder', 'Calculator'],
  office: ['Ergonomic Chair', 'Standing Desk', 'Office Supplies'],
};

// ── Cache ────────────────────────────────────────────────────────────────────

/** Refresh interval after a successful DB load. */
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/** Retry interval after a DB failure (avoid hammering a down DB). */
const RETRY_AFTER_FAILURE_MS = 30 * 1000; // 30 seconds

interface CacheEntry {
  data: IntentTaxonomy;
  loadedAt: number;
  /** true when the cached data came from the static fallback (DB unavailable). */
  isDefault: boolean;
}

let _cache: CacheEntry | null = null;

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Load the intent taxonomy.  Returns from cache when fresh; otherwise queries
 * the `IntentCategoryMap` table and auto-enriches with live `Product.genericName`
 * values, then falls back to static defaults on any DB error.
 */
export async function loadIntentTaxonomy(): Promise<IntentTaxonomy> {
  const now = Date.now();
  if (_cache) {
    const ttl = _cache.isDefault ? RETRY_AFTER_FAILURE_MS : CACHE_TTL_MS;
    if (now - _cache.loadedAt < ttl) return _cache.data;
  }

  try {
    // Dynamic import keeps @/lib/db out of client bundles.
    const { query } = await import('@/lib/db');

    // ── 1. Load IntentCategoryMap (admin-configurable taxonomy) ─────────────
    const rows = await query<{
      intent: string;
      subcategoryCandidates: string[];
      parentBroadeningKeyword: string | null;
      genericNouns: string[];
    }>(`
      SELECT
        intent,
        "subcategoryCandidates",
        "parentBroadeningKeyword",
        "genericNouns"
      FROM "IntentCategoryMap"
      WHERE status = 'ACTIVE'
      ORDER BY "sortOrder", intent
    `);

    // ── 2. Auto-enrich genericNouns from live Product.genericName ────────────
    // Groups by lower(Product.category) ordered by frequency DESC so the most
    // common real-world noun appears first in the search.
    const liveRows = await query<{ cat: string; noun: string }>(`
      SELECT cat, noun
      FROM (
        SELECT LOWER(category) AS cat, "genericName" AS noun, COUNT(*) AS freq
        FROM   "Product"
        WHERE  "genericName" IS NOT NULL AND "genericName" != ''
          AND  category      IS NOT NULL AND category      != ''
        GROUP  BY LOWER(category), "genericName"
      ) sub
      ORDER BY cat, freq DESC
    `);

    // Build lookup: lower(subcategoryName) → nouns ordered by popularity.
    const liveByCategory: Record<string, string[]> = {};
    for (const r of liveRows) {
      (liveByCategory[r.cat] ??= []).push(r.noun);
    }

    // ── 3. Build taxonomy, merging DB config + live nouns ────────────────────
    const taxonomy: IntentTaxonomy = {
      subcategoryCandidates: {},
      parentBroadeningKeyword: {},
      genericNouns: {},
    };

    for (const row of rows) {
      taxonomy.subcategoryCandidates[row.intent] = row.subcategoryCandidates;
      taxonomy.parentBroadeningKeyword[row.intent] = row.parentBroadeningKeyword ?? undefined;

      // Merge: DB-configured nouns first, then live catalog nouns (deduped).
      const configured = row.genericNouns ?? [];
      const seen = new Set(configured.map((n) => n.toLowerCase()));
      const liveExtra: string[] = [];
      for (const subcat of row.subcategoryCandidates) {
        for (const noun of liveByCategory[subcat.toLowerCase()] ?? []) {
          if (!seen.has(noun.toLowerCase())) {
            seen.add(noun.toLowerCase());
            liveExtra.push(noun);
          }
        }
      }
      taxonomy.genericNouns[row.intent] = [...configured, ...liveExtra];
    }

    // ── 4. Fill any gap in IntentCategoryMap from static fallback ────────────
    // Ensures backward-compat while the DB table is being incrementally seeded.
    for (const [intent, candidates] of Object.entries(FALLBACK_SUBCATEGORY_CANDIDATES)) {
      if (!taxonomy.subcategoryCandidates[intent]) {
        taxonomy.subcategoryCandidates[intent] = candidates;
        taxonomy.parentBroadeningKeyword[intent] = FALLBACK_PARENT_BROADENING_KEYWORD[intent];
        taxonomy.genericNouns[intent] = FALLBACK_GENERIC_NOUNS[intent] ?? [];
      }
    }

    _cache = { data: taxonomy, loadedAt: Date.now(), isDefault: false };
    return taxonomy;
  } catch (err) {
    console.warn(
      '[IntentTaxonomy] DB load failed, using static fallback:',
      err instanceof Error ? err.message : String(err)
    );
    const fallback: IntentTaxonomy = {
      subcategoryCandidates: FALLBACK_SUBCATEGORY_CANDIDATES,
      parentBroadeningKeyword: FALLBACK_PARENT_BROADENING_KEYWORD,
      genericNouns: FALLBACK_GENERIC_NOUNS,
    };
    _cache = { data: fallback, loadedAt: Date.now(), isDefault: true };
    return fallback;
  }
}

/** Test-only: clear the in-process cache. */
export function _resetTaxonomyCache(): void {
  _cache = null;
}
