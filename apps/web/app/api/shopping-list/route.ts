import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import {
  validateSession,
  findCachedSearch,
  saveSearch,
  createMagicLink,
  getUserPreferences,
  getProductBehaviorStats,
  trackBehavior,
  trackAnalyticsEvent,
  createOrder,
  createOrderWithWalletPayment,
  getOrCreateWallet,
  query as dbQuery,
} from '@/lib/db';
import { scoreProducts } from '@/lib/ai-scoring';

// ── Types ────────────────────────────────────────────────────────────────────

interface ShoppingListItemInput {
  productName: string;
  preferredBrand: string | null;
  budget: number | null;
  quantity: number;
  deliveryDays: number | null;
  paymentMethod: string | null;
  emiOnly: boolean;
  categoryId: number | null;
  subCategoryId: number | null;
  tagIds: number[] | null;
  attributes: Array<{ key: string; value: string }> | null;
}

interface MatchedProduct {
  name: string;
  brand: string;
  price: number;
  rating: number;
  matchScore: number;
  estimatedDelivery: string;
  emiAvailable: boolean;
  url: string;
}

interface ShoppingListResult {
  productName: string;
  preferredBrand: string | null;
  budget: number | null;
  quantity: number;
  matches: (MatchedProduct | import('@/lib/ai-scoring').ScoredProduct)[];
}

// ── Validation ───────────────────────────────────────────────────────────────

function validateItem(item: unknown): item is ShoppingListItemInput {
  if (!item || typeof item !== 'object') return false;
  const i = item as Record<string, unknown>;
  if (typeof i.productName !== 'string' || !i.productName.trim()) return false;
  // Allow letters, digits, spaces, hyphens, dots — covers model names like "WH-1000XM5" and "iPad Pro 12.9"
  if (!/^[a-zA-Z0-9 \-\.]+$/.test(i.productName.trim())) return false;
  if (
    i.preferredBrand !== null &&
    i.preferredBrand !== undefined &&
    typeof i.preferredBrand !== 'string'
  )
    return false;
  if (i.preferredBrand && !/^[a-zA-Z0-9 \-]*$/.test(i.preferredBrand as string)) return false;
  if (
    i.budget !== null &&
    i.budget !== undefined &&
    (typeof i.budget !== 'number' || (i.budget as number) < 0)
  )
    return false;
  if (typeof i.quantity !== 'number' || i.quantity < 1) return false;
  if (
    i.deliveryDays !== null &&
    i.deliveryDays !== undefined &&
    (typeof i.deliveryDays !== 'number' || (i.deliveryDays as number) < 0)
  )
    return false;
  return true;
}

function generateProductUrl(productName: string, brand: string): string {
  const query = encodeURIComponent(`${brand} ${productName} buy online India`);
  return `https://www.google.com/search?tbm=shop&q=${query}`;
}

/**
 * Identify the most discriminating "anchor" terms for a query.
 * These are the terms that MUST appear in any result — otherwise the result is irrelevant.
 * Rules:
 *  - Skip generic stop-words that are too broad ("and", "the", "for", "with", "best", "good", "buy")
 *  - Prefer the longest terms (more specific) as anchors
 *  - For multi-word queries (≥2 meaningful words) require ALL meaningful words as anchors
 *  - For single-word queries the anchor is that word itself
 */
const STOP_WORDS = new Set([
  'and',
  'or',
  'the',
  'for',
  'with',
  'best',
  'good',
  'top',
  'buy',
  'new',
  'my',
  'me',
  'i',
  'a',
  'an',
  'in',
  'on',
  'at',
  'to',
  'by',
  'of',
  'any',
]);

function getAnchorTerms(searchTerms: string[]): string[] {
  const meaningful = searchTerms.filter((t) => t.length >= 3 && !STOP_WORDS.has(t));
  if (meaningful.length === 0) return searchTerms.filter((t) => t.length >= 2);
  return meaningful;
}

/**
 * Score a DB product against the search query.
 * Checks both `name` and `genericName` for anchor term presence.
 * Returns a number 0–100. Results below MIN_RELEVANCE_THRESHOLD are excluded.
 */
const MIN_RELEVANCE_THRESHOLD = 80; // products scoring below this are discarded as irrelevant (default 80%)

// ── Smart Intent Engine ──────────────────────────────────────────────────────
// 9-parameter weighted scoring with configurable weights loaded from DB.
// Missing optional parameters have their weight redistributed to productName (80%) + quantity (20%)
// in a 4:1 ratio respectively, since Product Name : Quantity = 4:1 by default.

interface SmartWeights {
  productName: number;
  brand: number;
  budget: number;
  tags: number;
  attributes: number;
  quantity: number;
  deliveryDays: number;
  paymentMethod: number;
  emiOnly: number;
  category: number;
  subCategory: number;
}

const DEFAULT_SMART_WEIGHTS: SmartWeights = {
  // Sum must equal 100.
  // productName(40) + brand(10) + quantity(10) + tags(5) + attributes(5)
  // + deliveryDays(5) + paymentMethod(5) + budget(5) + emiOnly(5) + category(5) + subCategory(5) = 100
  productName: 40,
  brand: 10,
  budget: 5,
  tags: 5,
  attributes: 5,
  quantity: 10,
  deliveryDays: 5,
  paymentMethod: 5,
  emiOnly: 5,
  category: 5,
  subCategory: 5,
};

// Cache DB weights for 5 minutes to avoid repeated queries per request
let cachedWeights: SmartWeights | null = null;
let cachedThreshold: number | null = null;
let weightsCachedAt = 0;
const WEIGHTS_CACHE_MS = 5 * 60 * 1000;

async function loadSmartWeights(): Promise<{ weights: SmartWeights; threshold: number }> {
  const now = Date.now();
  if (cachedWeights && cachedThreshold !== null && now - weightsCachedAt < WEIGHTS_CACHE_MS) {
    return { weights: cachedWeights, threshold: cachedThreshold };
  }
  try {
    const [wRows, tRows] = await Promise.all([
      dbQuery<{ parameterName: string; currentWeight: string }>(
        `SELECT "parameterName", "currentWeight"::text FROM "SearchWeightConfig" ORDER BY "sortOrder" ASC`
      ),
      dbQuery<{ threshold: string }>(
        `SELECT "threshold"::text AS threshold FROM "SearchPassThreshold" LIMIT 1`
      ),
    ]);
    if (wRows.length > 0) {
      const w: Partial<SmartWeights> = {};
      for (const row of wRows) {
        const key = row.parameterName as keyof SmartWeights;
        if (key in DEFAULT_SMART_WEIGHTS) w[key] = parseFloat(row.currentWeight) || 0;
      }
      cachedWeights = { ...DEFAULT_SMART_WEIGHTS, ...w };
    } else {
      cachedWeights = { ...DEFAULT_SMART_WEIGHTS };
    }
    // Default pass threshold is 80% for Smart Delegate display
    cachedThreshold = tRows.length > 0 ? parseFloat(tRows[0].threshold) || 80 : 80;
    weightsCachedAt = now;
  } catch {
    // Table not yet created — use defaults silently
    cachedWeights = { ...DEFAULT_SMART_WEIGHTS };
    cachedThreshold = 80;
  }
  return { weights: cachedWeights, threshold: cachedThreshold };
}

function isParamProvided(param: keyof SmartWeights, item: ShoppingListItemInput): boolean {
  switch (param) {
    case 'brand':
      return !!item.preferredBrand && (item.preferredBrand as string).trim().length > 0;
    case 'budget':
      return item.budget !== null && item.budget !== undefined && (item.budget as number) > 0;
    case 'tags':
      return !!(item.tagIds && item.tagIds.length > 0);
    case 'attributes':
      return !!(item.attributes && item.attributes.some((a) => a.value.trim().length > 0));
    case 'deliveryDays':
      return (
        item.deliveryDays !== null &&
        item.deliveryDays !== undefined &&
        (item.deliveryDays as number) > 0
      );
    case 'paymentMethod':
      return !!(item.paymentMethod && item.paymentMethod !== '' && item.paymentMethod !== 'any');
    case 'emiOnly':
      return item.emiOnly === true;
    case 'category':
      return item.categoryId !== null && item.categoryId !== undefined;
    case 'subCategory':
      return item.subCategoryId !== null && item.subCategoryId !== undefined;
    default:
      return true; // productName + quantity always provided
  }
}

function reallocateWeights(base: SmartWeights, item: ShoppingListItemInput): SmartWeights {
  const effective = { ...base };
  // All optional params (productName + quantity are mandatory, ratio 4:1)
  const optionals: (keyof SmartWeights)[] = [
    'brand',
    'budget',
    'tags',
    'attributes',
    'deliveryDays',
    'paymentMethod',
    'emiOnly',
    'category',
    'subCategory',
  ];
  let surplus = 0;
  for (const p of optionals) {
    if (!isParamProvided(p, item)) {
      surplus += effective[p];
      effective[p] = 0;
    }
  }
  // Redistribute surplus in 4:1 ratio → productName gets 4/5 = 80%, quantity gets 1/5 = 20%
  effective.productName += surplus * 0.8;
  effective.quantity += surplus * 0.2;
  return effective;
}

/**
 * Check whether ALL words of `phrase` appear in `target` in the same order (subsequence match).
 * Case-insensitive. e.g. allWordsInOrder("washing machine", "LG 8kg Washing Machine Front Load") → true
 */
function allWordsInOrder(phrase: string, target: string): boolean {
  const words = phrase
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 0);
  const t = target.toLowerCase();
  let pos = 0;
  for (const word of words) {
    const idx = t.indexOf(word, pos);
    if (idx === -1) return false;
    pos = idx + word.length;
  }
  return true;
}

/**
 * Compute 11-parameter weighted Smart Intent Score for a single DB product.
 * Returns { score 0-100, anchorHits, termHits, brandMatch }.
 *
 * Parameters (default weights sum to 100):
 *   1.  productName   (40%) — ALL search words must appear in order in name OR genericName
 *   2.  brand         (10%) — all brand words appear in order in product name (case-insensitive)
 *   3.  quantity      (10%) — sufficient inventory for requested qty
 *   4.  tags          ( 5%) — at least 1 matching tag required; score = matching/total
 *   5.  attributes    ( 5%) — ALL specified attributes must be found in product text
 *   6.  deliveryDays  ( 5%) — estimated delivery ≤ user's requested days
 *   7.  paymentMethod ( 5%) — requested payment type supported
 *   8.  budget        ( 5%) — price STRICTLY < budget
 *   9.  emiOnly       ( 5%) — EMI strictly available (price > 5000)
 *  10.  category      ( 5%) — product must belong to the specified category
 *  11.  subCategory   ( 5%) — product must belong to the specified sub-category
 */
function computeSmartIntentScore(
  p: { id: number; name: string; genericName: string | null; price: number; description: string },
  item: ShoppingListItemInput,
  searchTerms: string[],
  anchorTerms: string[],
  effectiveWeights: SmartWeights,
  productTagIds: number[],
  inventoryCount: number,
  productCategoryIds: number[],
  productSubCategoryIds: number[]
): { score: number; anchorHits: number; termHits: number; brandMatch: boolean } {
  const nameLower = p.name.toLowerCase();
  const genericLower = (p.genericName || '').toLowerCase();
  const combinedText = `${nameLower} ${genericLower} ${p.description.toLowerCase()}`.trim();
  const brandWords = (item.preferredBrand || '').toLowerCase().trim();

  // ── Anchor check (gate): ALL anchor terms must appear in name or genericName ─
  const nameAndGeneric = `${nameLower} ${genericLower}`;
  const anchorHits = anchorTerms.filter((t) => nameAndGeneric.includes(t)).length;
  const allAnchorsPresent = anchorHits === anchorTerms.length;

  if (!allAnchorsPresent) {
    if (anchorHits === 0) return { score: 0, anchorHits, termHits: 0, brandMatch: false };
    const partialScore = (anchorHits / anchorTerms.length) * 20;
    return { score: partialScore, anchorHits, termHits: 0, brandMatch: false };
  }

  // ── 1. productName score (40%) ─────────────────────────────────────────────
  // ALL search words must appear in sequence in name OR genericName (case-insensitive)
  const nameMatch = allWordsInOrder(item.productName, nameLower);
  const genericMatch = genericLower.length > 0 && allWordsInOrder(item.productName, genericLower);
  const termHits = searchTerms.filter((t) => nameAndGeneric.includes(t)).length;
  // Full credit if all words in order; partial credit based on term coverage
  const termCoverage = termHits / Math.max(searchTerms.length, 1);
  const productNameScore = nameMatch || genericMatch ? 1.0 : termCoverage * 0.7;

  // ── 2. brand score (5%) ────────────────────────────────────────────────────
  // All brand words must appear in the same order in product name (case-insensitive)
  const brandMatch = brandWords.length > 0 && allWordsInOrder(brandWords, nameLower);
  const brandScore = isParamProvided('brand', item) ? (brandMatch ? 1.0 : 0.0) : 0;

  // ── 3. budget score (10%) — STRICTLY less than budget ─────────────────────
  let budgetScore = 0;
  if (isParamProvided('budget', item) && item.budget && item.budget > 0) {
    // Strict: product price must be strictly less than the user's budget
    budgetScore = p.price < item.budget ? 1.0 : 0.0;
  }

  // ── 4. tags score (10%) — at least 1 must match; weighted average ──────────
  let tagsScore = 0;
  if (isParamProvided('tags', item) && item.tagIds && item.tagIds.length > 0) {
    const matchingTags = item.tagIds.filter((tid) => productTagIds.includes(tid)).length;
    // At least one tag MUST match; score = fraction of tags matched
    tagsScore = matchingTags > 0 ? matchingTags / item.tagIds.length : 0.0;
  }

  // ── 5. attributes score (5%) — ALL must match ──────────────────────────────
  let attributesScore = 0;
  if (isParamProvided('attributes', item) && item.attributes) {
    const attrVals = item.attributes
      .filter((a) => a.value.trim())
      .map((a) => a.value.toLowerCase().trim());
    if (attrVals.length > 0) {
      const matched = attrVals.filter((v) => combinedText.includes(v)).length;
      // ALL attributes should match for full score; partial = fraction matched
      attributesScore = matched / attrVals.length;
    }
  }

  // ── 6. quantity (stock) score (10%) ───────────────────────────────────────
  const qtyRequired = item.quantity || 1;
  const quantityScore = inventoryCount >= qtyRequired ? 1.0 : inventoryCount > 0 ? 0.5 : 0.0;

  // ── 7. deliveryDays score (10%) ────────────────────────────────────────────
  // User's delivery requirement must be >= product's estimated delivery time
  let deliveryScore = 0;
  if (isParamProvided('deliveryDays', item) && item.deliveryDays && item.deliveryDays > 0) {
    // Estimate delivery from price tier (no maxDeliveryDays field in DB)
    const estimatedDays = p.price > 30000 ? 6 : p.price > 10000 ? 4 : p.price > 3000 ? 3 : 2;
    // User's deliveryDays must be >= estimatedDays (user wants it within N days)
    deliveryScore = item.deliveryDays >= estimatedDays ? 1.0 : 0.0;
  }

  // ── 8. paymentMethod score (5%) ────────────────────────────────────────────
  let paymentScore = 0;
  if (isParamProvided('paymentMethod', item) && item.paymentMethod) {
    const pm = item.paymentMethod.toLowerCase();
    if (pm === 'emi') {
      paymentScore = p.price > 5000 ? 1.0 : 0.0;
    } else {
      // UPI, card, COD, wallet — generally available for all products
      paymentScore = 1.0;
    }
  }

  // ── 9. emiOnly score (5%) — separate strict EMI parameter ─────────────────
  let emiScore = 0;
  if (isParamProvided('emiOnly', item)) {
    // EMI strictly required: product price must be > 5000 (EMI threshold)
    emiScore = p.price > 5000 ? 1.0 : 0.0;
  }

  // ── 10. category score (5%) — strict match against ProductCategoryMap ───────
  let categoryScore = 0;
  if (isParamProvided('category', item) && item.categoryId) {
    categoryScore = productCategoryIds.includes(item.categoryId) ? 1.0 : 0.0;
  }

  // ── 11. subCategory score (5%) — strict match against ProductSubCategoryMap ─
  let subCategoryScore = 0;
  if (isParamProvided('subCategory', item) && item.subCategoryId) {
    subCategoryScore = productSubCategoryIds.includes(item.subCategoryId) ? 1.0 : 0.0;
  }

  // ── Weighted sum (total = sum of effective weights from reallocation) ───────
  const w = effectiveWeights;
  const totalWeight =
    w.productName +
    w.brand +
    w.budget +
    w.tags +
    w.attributes +
    w.quantity +
    w.deliveryDays +
    w.paymentMethod +
    w.emiOnly +
    w.category +
    w.subCategory;
  const rawScore =
    totalWeight > 0
      ? (productNameScore * w.productName +
          brandScore * w.brand +
          budgetScore * w.budget +
          tagsScore * w.tags +
          attributesScore * w.attributes +
          quantityScore * w.quantity +
          deliveryScore * w.deliveryDays +
          paymentScore * w.paymentMethod +
          emiScore * w.emiOnly +
          categoryScore * w.category +
          subCategoryScore * w.subCategory) /
        totalWeight
      : productNameScore;

  return {
    score: Math.min(rawScore * 100, 100),
    anchorHits,
    termHits,
    brandMatch,
  };
}

// Legacy thin wrapper kept for potential direct callers (now delegates to Smart Intent Engine)
function scoreDbProduct(
  productName: string,
  genericName: string | null,
  searchTerms: string[],
  anchorTerms: string[],
  brandLower: string,
  budget: number | null,
  price: number
): { score: number; anchorHits: number; termHits: number; brandMatch: boolean } {
  const nameLower = productName.toLowerCase();
  const genericLower = (genericName || '').toLowerCase();
  const combinedText = `${nameLower} ${genericLower}`.trim();

  const anchorHits = anchorTerms.filter((t) => combinedText.includes(t)).length;
  const allAnchorsPresent = anchorHits === anchorTerms.length;
  const termHits = searchTerms.filter((t) => combinedText.includes(t)).length;
  const termCoverage = termHits / Math.max(searchTerms.length, 1);
  const brandMatch = brandLower.length > 0 && nameLower.includes(brandLower);

  let budgetScore = 0.5;
  if (budget && budget > 0) {
    const ratio = price / budget;
    if (ratio <= 1.0) budgetScore = 1.0;
    else if (ratio <= 1.2) budgetScore = 0.6;
    else if (ratio <= 1.5) budgetScore = 0.3;
    else budgetScore = 0.0;
  }

  if (!allAnchorsPresent) {
    if (anchorHits === 0) return { score: 0, anchorHits, termHits, brandMatch };
    return { score: (anchorHits / anchorTerms.length) * 20, anchorHits, termHits, brandMatch };
  }

  const score = termCoverage * 50 + (brandMatch ? 25 : 0) + budgetScore * 25;
  return { score, anchorHits, termHits, brandMatch };
}

/**
 * Search products from the real database with relevance-gated result filtering.
 *
 * Strategy (ordered by precision):
 *   S1 — Sequential ILIKE: all terms in order → highest precision
 *   S2 — AND ILIKE: all anchor terms present in any order
 *   S3 — Brand ILIKE combined with anchor: brand+category specificity
 *   S4 — OR fallback: only used if DB has NO matching products at all
 *        (even then, results are scored and MUST meet the anchor filter)
 *
 * All candidates are scored; results below MIN_RELEVANCE_THRESHOLD are excluded.
 */
async function searchProductsFromDB(item: ShoppingListItemInput): Promise<MatchedProduct[]> {
  const searchName = item.productName.toLowerCase().trim();
  const searchTerms = searchName.split(/\s+/).filter((t) => t.length >= 1);
  if (searchTerms.length === 0) return [];

  const anchorTerms = getAnchorTerms(searchTerms);
  const brandLower = (item.preferredBrand || '').toLowerCase();

  type DbProduct = {
    id: number;
    name: string;
    genericName: string | null;
    price: number;
    category: string;
    description: string;
    imageUrl: string | null;
  };
  let dbProducts: DbProduct[] = [];

  // Helper: build a WHERE clause that checks BOTH name AND genericName
  function nameOrGeneric(term: string, paramIdx: number): string {
    return `(LOWER(name) LIKE $${paramIdx} OR LOWER(COALESCE("genericName",'')) LIKE $${paramIdx})`;
  }

  // Set to track IDs from user-hint strategies (boosted in scoring)
  const hintProductIds = new Set<number>();

  try {
    // Strategy 0: User-provided hints — direct mapping lookup via selected category/subcategory/tags
    // This is the highest-quality signal: user explicitly told us what they want.
    if (item.categoryId || item.subCategoryId || (item.tagIds && item.tagIds.length > 0)) {
      const conditions: string[] = [];
      const args: unknown[] = [];
      let paramIdx = 1;

      if (item.categoryId) {
        conditions.push(
          `EXISTS (SELECT 1 FROM "ProductCategoryMap" pcm WHERE pcm."productId" = p.id AND pcm."categoryId" = $${paramIdx} AND pcm.approved = TRUE)`
        );
        args.push(item.categoryId);
        paramIdx++;
      }
      if (item.subCategoryId) {
        conditions.push(
          `EXISTS (SELECT 1 FROM "ProductSubCategoryMap" pscm WHERE pscm."productId" = p.id AND pscm."subCategoryId" = $${paramIdx} AND pscm.approved = TRUE)`
        );
        args.push(item.subCategoryId);
        paramIdx++;
      }
      if (item.tagIds && item.tagIds.length > 0) {
        conditions.push(
          `EXISTS (SELECT 1 FROM "ProductTagMap" ptm WHERE ptm."productId" = p.id AND ptm."tagId" = ANY($${paramIdx}) AND ptm.approved = TRUE)`
        );
        args.push(item.tagIds);
        paramIdx++;
      }

      const hintProducts = (await dbQuery(
        `SELECT id, name, "genericName", price, category, COALESCE(description, '') as description, "imageUrl"
         FROM "Product" p
         WHERE ${conditions.join(' AND ')}
         ORDER BY price ASC LIMIT 50`,
        args
      )) as DbProduct[];

      for (const p of hintProducts) {
        hintProductIds.add(p.id);
        dbProducts.push(p);
      }
    }

    // Strategy 1: sequential ILIKE on name OR genericName — all terms in order (highest precision)
    // IMPORTANT: merge into existing dbProducts (from Strategy 0) — do NOT overwrite hint results
    const seqPattern = `%${searchTerms.join('%')}%`;
    const s1Products = (await dbQuery(
      `SELECT id, name, "genericName", price, category, COALESCE(description, '') as description, "imageUrl"
       FROM "Product" WHERE (LOWER(name) LIKE $1 OR LOWER(COALESCE("genericName",'')) LIKE $1)
       ORDER BY price ASC LIMIT 30`,
      [seqPattern]
    )) as DbProduct[];
    {
      const existingIds = new Set(dbProducts.map((p) => p.id));
      for (const p of s1Products) {
        if (!existingIds.has(p.id)) {
          dbProducts.push(p);
          existingIds.add(p.id);
        }
      }
    }

    // Strategy 2: AND on anchor terms — ALL anchor terms must appear in name or genericName
    if (dbProducts.length < 8 && anchorTerms.length >= 2) {
      const andClauses = anchorTerms.map((_t, i) => nameOrGeneric(_t, i + 1)).join(' AND ');
      const andArgs = anchorTerms.map((t) => `%${t}%`);
      const moreProducts = (await dbQuery(
        `SELECT id, name, "genericName", price, category, COALESCE(description, '') as description, "imageUrl"
         FROM "Product" WHERE ${andClauses}
         ORDER BY price ASC LIMIT 30`,
        andArgs
      )) as DbProduct[];
      const existingIds = new Set(dbProducts.map((p) => p.id));
      for (const p of moreProducts) {
        if (!existingIds.has(p.id)) {
          dbProducts.push(p);
          existingIds.add(p.id);
        }
      }
    }

    // Strategy 3: single anchor term (most specific) + optional brand in name or genericName
    if (dbProducts.length < 8 && anchorTerms.length >= 1) {
      const primaryAnchor = anchorTerms.reduce((a, b) => (a.length >= b.length ? a : b));
      const args: string[] = [`%${primaryAnchor}%`];
      let whereClause = nameOrGeneric(primaryAnchor, 1);
      if (brandLower) {
        args.push(`%${brandLower}%`);
        whereClause += ` AND LOWER(name) LIKE $2`;
      }
      const moreProducts = (await dbQuery(
        `SELECT id, name, "genericName", price, category, COALESCE(description, '') as description, "imageUrl"
         FROM "Product" WHERE ${whereClause}
         ORDER BY price ASC LIMIT 30`,
        args
      )) as DbProduct[];
      const existingIds = new Set(dbProducts.map((p) => p.id));
      for (const p of moreProducts) {
        if (!existingIds.has(p.id)) {
          dbProducts.push(p);
          existingIds.add(p.id);
        }
      }
    }

    // Strategy 4: broad OR fallback on genericName only — used ONLY when DB has no results at all
    // This is the KEY strategy for generic searches like "Washing Machine" or "Vacuum Cleaner"
    if (dbProducts.length === 0) {
      const sigTerms = anchorTerms.filter((t) => t.length >= 4);
      if (sigTerms.length > 0) {
        const orClauses = sigTerms.map((_t, i) => nameOrGeneric(_t, i + 1)).join(' OR ');
        const orArgs = sigTerms.map((t) => `%${t}%`);
        const orProducts = (await dbQuery(
          `SELECT id, name, "genericName", price, category, COALESCE(description, '') as description, "imageUrl"
           FROM "Product" WHERE ${orClauses}
           ORDER BY price ASC LIMIT 30`,
          orArgs
        )) as DbProduct[];
        for (const p of orProducts) dbProducts.push(p);
      }
    }

    // Strategy 5: Many-to-many Category/SubCategory mapping — match search terms against ALL
    // assigned category names (not just primary). Uses junction tables for comprehensive search.
    // This catches cases where product name/genericName don't contain the search term but the
    // subcategory or parent category name does (e.g. search "Electronics" finds Smartphones)
    if (dbProducts.length < 8) {
      const sigTerms = anchorTerms.filter((t) => t.length >= 3);
      if (sigTerms.length > 0) {
        const catOrClauses = sigTerms
          .map((_t, i) => {
            const pi = i * 1 + 1;
            return `(LOWER(psc.name) LIKE $${pi} OR LOWER(pc.name) LIKE $${pi} OR LOWER(COALESCE(psc.description,'')) LIKE $${pi})`;
          })
          .join(' OR ');
        const catArgs = sigTerms.map((t) => `%${t}%`);
        const catProducts = (await dbQuery(
          `SELECT DISTINCT p.id, p.name, p."genericName", p.price, p.category, COALESCE(p.description, '') as description, p."imageUrl"
           FROM "Product" p
           JOIN "ProductCategoryMap" pcm ON pcm."productId" = p.id AND pcm.approved = TRUE
           JOIN "ProductCategory" pc ON pc.id = pcm."categoryId" AND pc.status = 'ACTIVE'
           LEFT JOIN "ProductSubCategoryMap" pscm ON pscm."productId" = p.id AND pscm.approved = TRUE
           LEFT JOIN "ProductSubCategory" psc ON psc.id = pscm."subCategoryId" AND psc.status = 'ACTIVE'
           LEFT JOIN "ProductTagMap" ptm ON ptm."productId" = p.id AND ptm.approved = TRUE
           LEFT JOIN "ProductTag" pt ON pt.id = ptm."tagId" AND pt.status = 'ACTIVE'
           WHERE (${catOrClauses}
                  OR LOWER(COALESCE(pt.name,'')) LIKE $1)
           ORDER BY p.price ASC LIMIT 30`,
          catArgs
        )) as DbProduct[];
        const existingIds = new Set(dbProducts.map((p) => p.id));
        for (const p of catProducts) {
          if (!existingIds.has(p.id)) {
            dbProducts.push(p);
            existingIds.add(p.id);
          }
        }
      }
    }
  } catch (err) {
    console.error('[searchProductsFromDB] DB query failed:', err);
    return [];
  }

  // Deduplicate (strategies may return overlapping products)
  {
    const seen = new Set<number>();
    dbProducts = dbProducts.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }

  if (dbProducts.length === 0) return [];

  // ── Smart Intent Engine: load weights + batch-query tags and inventory ──────
  const productIds = dbProducts.map((p) => p.id);
  const [
    { weights: baseWeights, threshold: passThreshold },
    tagRows,
    invRows,
    categoryRows,
    subCategoryRows,
  ] = await Promise.all([
    loadSmartWeights(),
    // Batch-query all tag IDs for candidate products
    item.tagIds && item.tagIds.length > 0
      ? dbQuery<{ productId: number; tagId: number }>(
          `SELECT "productId", "tagId" FROM "ProductTagMap"
           WHERE "productId" = ANY($1::int[]) AND approved = TRUE`,
          [productIds]
        ).catch(() => [] as { productId: number; tagId: number }[])
      : Promise.resolve([] as { productId: number; tagId: number }[]),
    // Batch-query inventory counts
    dbQuery<{ productId: number; inventoryCount: number }>(
      `SELECT "productId", "inventoryCount" FROM "ProductBusinessMetrics"
       WHERE "productId" = ANY($1::int[])`,
      [productIds]
    ).catch(() => [] as { productId: number; inventoryCount: number }[]),
    // Batch-query approved category IDs per product (for category scoring)
    item.categoryId
      ? dbQuery<{ productId: number; categoryId: number }>(
          `SELECT "productId", "categoryId" FROM "ProductCategoryMap"
           WHERE "productId" = ANY($1::int[]) AND approved = TRUE`,
          [productIds]
        ).catch(() => [] as { productId: number; categoryId: number }[])
      : Promise.resolve([] as { productId: number; categoryId: number }[]),
    // Batch-query approved sub-category IDs per product (for subCategory scoring)
    item.subCategoryId
      ? dbQuery<{ productId: number; subCategoryId: number }>(
          `SELECT "productId", "subCategoryId" FROM "ProductSubCategoryMap"
           WHERE "productId" = ANY($1::int[]) AND approved = TRUE`,
          [productIds]
        ).catch(() => [] as { productId: number; subCategoryId: number }[])
      : Promise.resolve([] as { productId: number; subCategoryId: number }[]),
  ]);

  // Build lookup maps
  const tagMap = new Map<number, number[]>();
  for (const row of tagRows) {
    const existing = tagMap.get(row.productId) || [];
    existing.push(row.tagId);
    tagMap.set(row.productId, existing);
  }
  const invMap = new Map<number, number>();
  for (const row of invRows) invMap.set(row.productId, row.inventoryCount);
  const categoryMap = new Map<number, number[]>();
  for (const row of categoryRows) {
    const existing = categoryMap.get(row.productId) || [];
    existing.push(row.categoryId);
    categoryMap.set(row.productId, existing);
  }
  const subCategoryMap = new Map<number, number[]>();
  for (const row of subCategoryRows) {
    const existing = subCategoryMap.get(row.productId) || [];
    existing.push(row.subCategoryId);
    subCategoryMap.set(row.productId, existing);
  }

  // Reallocate weights based on which params the user provided
  const effectiveWeights = reallocateWeights(baseWeights, item);

  // Score all candidates and FILTER OUT irrelevant products
  type ScoredDbProduct = DbProduct & {
    hits: number;
    anchorHits: number;
    brandMatch: boolean;
    relevance: number;
    productBrand: string;
    hintMatch: boolean;
  };

  const scored: ScoredDbProduct[] = dbProducts.map((p) => {
    const productTagIds = tagMap.get(p.id) || [];
    const inventoryCount = invMap.get(p.id) ?? 100; // default 100 when metrics don't exist
    const productCategoryIds = categoryMap.get(p.id) || [];
    const productSubCategoryIds = subCategoryMap.get(p.id) || [];
    const hintMatch = hintProductIds.has(p.id);

    const { score, anchorHits, termHits, brandMatch } = computeSmartIntentScore(
      p,
      item,
      searchTerms,
      anchorTerms,
      effectiveWeights,
      productTagIds,
      inventoryCount,
      productCategoryIds,
      productSubCategoryIds
    );

    // Hint bonus: products from user-selected category/subcategory/tags get a relevance boost
    const hintBonus = hintMatch ? 30 : 0;
    const finalScore = Math.min(score + hintBonus, 100);

    const productBrand = p.name.toLowerCase().split(/\s+/)[0] || '';
    return {
      ...p,
      hits: termHits,
      anchorHits,
      brandMatch,
      relevance: finalScore,
      productBrand,
      hintMatch,
    };
  });

  // Discard irrelevant products (below threshold loaded from DB)
  const threshold = passThreshold || MIN_RELEVANCE_THRESHOLD;
  const relevant = scored.filter((p) => p.relevance >= threshold);

  // If zero products pass the threshold AND the max relevance is 0 (no anchor term matched at all),
  // return empty so the caller falls back to a broader DB search.
  const maxRelevance = scored.reduce((m, p) => Math.max(m, p.relevance), 0);
  if (relevant.length === 0 && maxRelevance === 0) return [];

  // Soft fallback: nothing meets threshold but some products have partial matches → return top 3
  const candidates =
    relevant.length > 0 ? relevant : scored.sort((a, b) => b.relevance - a.relevance).slice(0, 3);

  // Sort: hint matches first, then brand matches, then by relevance descending, then price ascending
  candidates.sort((a, b) => {
    if (a.hintMatch !== b.hintMatch) return a.hintMatch ? -1 : 1;
    if (a.brandMatch !== b.brandMatch) return a.brandMatch ? -1 : 1;
    if (b.relevance !== a.relevance) return b.relevance - a.relevance;
    return a.price - b.price;
  });

  // Take top 5
  const top = candidates.slice(0, 5);

  // Convert to MatchedProduct format
  return top.map((p) => {
    const brand = p.productBrand.charAt(0).toUpperCase() + p.productBrand.slice(1);
    return {
      name: p.name,
      brand: brand || 'Unknown',
      price: p.price,
      rating: 4.0 + Math.round((p.relevance / 100) * 10) / 10, // 4.0-5.0 based on relevance
      matchScore: Math.round(p.relevance),
      estimatedDelivery: p.price > 10000 ? '3-5 days' : '1-3 days',
      emiAvailable: p.price > 5000,
      url: generateProductUrl(p.name, brand),
      source: 'INTERNAL' as const,
      // Extra fields for downstream use
      id: p.id,
      category: p.category,
      genericName: p.genericName,
      imageUrl: p.imageUrl,
    } as MatchedProduct & {
      id: number;
      category: string;
      genericName: string | null;
      imageUrl: string | null;
      source: 'INTERNAL';
    };
  });
}

// ── In-memory store (production: DB) ─────────────────────────────────────────

const shoppingLists = new Map<
  string,
  { items: ShoppingListItemInput[]; results: ShoppingListResult[]; createdAt: Date }
>();

// ── WhatsApp Notification ────────────────────────────────────────────────────
// Uses Twilio WhatsApp API when env vars are present.
// Fallback: CallMeBot (free) when CALLMEBOT_API_KEY is set.
// Demo mode: logs to console + returns notification in response.

async function sendWhatsAppNotification(
  phone: string,
  results: ShoppingListResult[],
  magicLinkUrl?: string
): Promise<{ sent: boolean; method: string; error?: string }> {
  if (!phone) return { sent: false, method: 'none', error: 'No phone number provided' };

  // Format a concise message
  const lines = [
    '🛒 *DelegateCart AI Results*',
    `Found matches for ${results.length} item(s):`,
    '',
    ...results.map(
      (r, i) =>
        `${i + 1}. *${r.productName}*: ${r.matches.length} matches, best at ₹${
          r.matches[0]?.price?.toLocaleString('en-IN') ?? 'N/A'
        } (${r.matches[0]?.brand ?? ''})`
    ),
    '',
    magicLinkUrl
      ? `🔗 View full results (no sign-in needed): ${magicLinkUrl}`
      : 'View full results at DelegateCart → Smart Delegate page.',
  ];
  const message = lines.join('\n');

  // 1️⃣ Twilio WhatsApp (Production)
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';

  if (twilioSid && twilioToken) {
    try {
      const cleanPhone = phone.replace(/\s/g, '');
      const toPhone = cleanPhone.startsWith('+')
        ? `whatsapp:${cleanPhone}`
        : `whatsapp:+91${cleanPhone}`;

      const body = new URLSearchParams({
        From: twilioFrom,
        To: toPhone,
        Body: message,
      });

      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: body.toString(),
        }
      );

      if (res.ok) {
        console.log('[WhatsApp] Sent via Twilio to', toPhone);
        return { sent: true, method: 'twilio' };
      }
      const errData = await res.json().catch(() => ({}));
      console.error('[WhatsApp] Twilio error:', errData);
    } catch (err) {
      console.error('[WhatsApp] Twilio fetch error:', err);
    }
  }

  // 2️⃣ CallMeBot (Free personal WhatsApp API)
  // Setup: Add +34 644 81 99 84 to contacts as "CallMeBot", send "I allow callmebot to send me messages"
  // You'll receive an API key via WhatsApp. Set env var CALLMEBOT_API_KEY=<your_key>
  const callMeBotKey = process.env.CALLMEBOT_API_KEY;
  if (callMeBotKey) {
    try {
      const cleanPhone = phone.replace(/[\s+]/g, '');
      const encodedMsg = encodeURIComponent(message);
      const url = `https://api.callmebot.com/whatsapp.php?phone=${cleanPhone}&text=${encodedMsg}&apikey=${callMeBotKey}`;
      const res = await fetch(url);
      if (res.ok) {
        console.log('[WhatsApp] Sent via CallMeBot to', cleanPhone);
        return { sent: true, method: 'callmebot' };
      }
      console.error('[WhatsApp] CallMeBot failed, status:', res.status);
    } catch (err) {
      console.error('[WhatsApp] CallMeBot error:', err);
    }
  }

  // 3️⃣ Demo mode: log the message
  console.log('[WhatsApp DEMO] Would send to', phone, ':\n', message);
  return {
    sent: false,
    method: 'demo',
    error:
      'WhatsApp not configured. Set TWILIO_ACCOUNT_SID+TWILIO_AUTH_TOKEN or CALLMEBOT_API_KEY env vars.',
  };
}

// ── Handlers ─────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: 'At least one item is required' }, { status: 400 });
    }

    if (body.items.length > 50) {
      return NextResponse.json({ error: 'Maximum 50 items allowed per list' }, { status: 400 });
    }

    // Validate every item
    for (let i = 0; i < body.items.length; i++) {
      if (!validateItem(body.items[i])) {
        return NextResponse.json({ error: `Invalid item at position ${i + 1}` }, { status: 400 });
      }
    }

    const items = body.items as ShoppingListItemInput[];
    const whatsappPhone: string | null =
      typeof body.whatsappNumber === 'string' ? body.whatsappNumber.trim() : null;
    const forceFresh: boolean = body.forceFresh === true;

    // Get auth session (optional — used for magic link and per-user history)
    const authHeader = request.headers.get('authorization') || '';
    const authToken =
      authHeader.replace('Bearer ', '').trim() || request.cookies.get('authToken')?.value || '';
    const session = authToken ? await validateSession(authToken).catch(() => null) : null;
    const userId: number | null = session ? (session as any).userId : null;

    // Generate deterministic hash for cache lookup
    const itemsKey = JSON.stringify(
      [...items].sort((a, b) => a.productName.localeCompare(b.productName))
    );
    const searchHash = createHash('sha256').update(itemsKey).digest('hex');

    // Check DB cache (5-hour cache) unless forceFresh
    let results: ShoppingListResult[] | null = null;
    let fromCache = false;
    let listId: string;
    let summary: { totalItems: number; totalMatches: number; estimatedSavings: string };

    if (!forceFresh) {
      const cached = await findCachedSearch(searchHash).catch(() => null);
      if (cached) {
        try {
          results =
            typeof cached.results === 'string' ? JSON.parse(cached.results) : cached.results;
          summary =
            typeof cached.summary === 'string' ? JSON.parse(cached.summary) : cached.summary;
          fromCache = true;
          listId = `cache-${cached.id}`;
        } catch {
          /* fall through to fresh search */
        }
      }
    }

    // Fresh search if not cached
    if (!results) {
      // Fetch user preferences and behavior for AI scoring (non-blocking for anonymous)
      let userPrefs: {
        preferredCategories?: string[];
        priceRange?: { min: number; max: number };
        brands?: string[];
      } = {};
      let behaviorStats: { productId: string; action: string; count: string }[] = [];
      if (userId) {
        const [prefsRow, stats] = await Promise.all([
          getUserPreferences(userId).catch(() => null),
          getProductBehaviorStats(userId).catch(() => []),
        ]);
        if (prefsRow) {
          userPrefs = {
            preferredCategories: prefsRow.preferredCategories || [],
            priceRange: prefsRow.priceRange || undefined,
            brands: prefsRow.brands || [],
          };
        }
        behaviorStats = stats as any[];
      }

      results = await Promise.all(
        items.map(async (item) => {
          let rawMatches = await searchProductsFromDB(item);

          // Broader DB search when initial query returns no results
          if (rawMatches.length === 0) {
            // Try a looser category-based DB query using detected keywords so we
            // always return REAL products from the database when any exist.
            const broadSearchTerms = item.productName
              .toLowerCase()
              .trim()
              .split(/\s+/)
              .filter((t) => t.length >= 3);
            if (broadSearchTerms.length > 0) {
              try {
                const orClauses = broadSearchTerms
                  .map(
                    (_t, i) =>
                      `(LOWER(p.name) LIKE $${i + 1} OR LOWER(COALESCE(p."genericName",'')) LIKE $${i + 1})`
                  )
                  .join(' OR ');
                const orArgs = broadSearchTerms.map((t) => `%${t}%`);
                type BroadRow = {
                  id: number;
                  name: string;
                  genericName: string | null;
                  price: number;
                  category: string;
                  description: string;
                  imageUrl: string | null;
                };
                const broadRows = await dbQuery<BroadRow>(
                  `SELECT p.id, p.name, p."genericName", p.price, p.category,
                        COALESCE(p.description, '') as description, p."imageUrl"
                 FROM "Product" p
                 WHERE ${orClauses}
                 ORDER BY p.price ASC LIMIT 15`,
                  orArgs
                );
                if (broadRows.length > 0) {
                  // Score these broad results with the Smart Intent Engine
                  const { weights: bw } = await loadSmartWeights();
                  const effectiveW = reallocateWeights(bw, item);
                  const searchTermsForScore = item.productName
                    .toLowerCase()
                    .split(/\s+/)
                    .filter((t) => t.length >= 1);
                  const anchorTermsForScore = getAnchorTerms(searchTermsForScore);
                  const broadScored = broadRows.map((p) => {
                    const { score } = computeSmartIntentScore(
                      p,
                      item,
                      searchTermsForScore,
                      anchorTermsForScore,
                      effectiveW,
                      [],
                      100,
                      [],
                      []
                    );
                    const brand = p.name.split(/\s+/)[0] || 'Unknown';
                    return {
                      name: p.name,
                      brand: brand.charAt(0).toUpperCase() + brand.slice(1),
                      price: p.price,
                      rating: 4.0 + Math.round((score / 100) * 10) / 10,
                      matchScore: Math.max(Math.round(score), 50), // floor at 50 so broad matches still show
                      estimatedDelivery: p.price > 10000 ? '3-5 days' : '1-3 days',
                      emiAvailable: p.price > 5000,
                      url: generateProductUrl(p.name, brand),
                      source: 'INTERNAL' as const,
                      id: p.id,
                      category: p.category,
                      genericName: p.genericName,
                      imageUrl: p.imageUrl,
                    } as MatchedProduct & {
                      id: number;
                      category: string;
                      genericName: string | null;
                      imageUrl: string | null;
                      source: 'INTERNAL';
                    };
                  });
                  broadScored.sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0));
                  rawMatches = broadScored.slice(0, 5);
                }
              } catch (broadErr) {
                console.warn('[shopping-list] Broad DB search failed:', broadErr);
              }
            }
          }

          // Apply AI scoring engine
          const scored = scoreProducts(
            rawMatches,
            item.productName,
            item.budget,
            userPrefs,
            behaviorStats
          );
          return {
            productName: item.productName,
            preferredBrand: item.preferredBrand,
            budget: item.budget,
            quantity: item.quantity,
            matches: scored,
          };
        })
      );
      // Calculate real savings from budget vs best match price
      const totalBudget = items.reduce((s, i) => s + (i.budget || 0), 0);
      const totalBestPrice = results.reduce(
        (s, r) => s + ((r.matches[0] as any)?.price || 0) * r.quantity,
        0
      );
      const realSavings =
        totalBudget > 0 && totalBestPrice > 0 ? Math.max(0, totalBudget - totalBestPrice) : 0;
      summary = {
        totalItems: items.length,
        totalMatches: results.reduce((sum, r) => sum + r.matches.length, 0),
        estimatedSavings: realSavings > 0 ? `₹${realSavings.toLocaleString('en-IN')}` : '₹0',
      };
      listId = `sl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      // Track search behavior + analytics (fire-and-forget)
      if (userId) {
        for (const item of items) {
          trackBehavior(userId, item.productName, 'search', {
            budget: item.budget,
            brand: item.preferredBrand,
          }).catch(() => {});
        }
      }
      trackAnalyticsEvent('shopping_list_search', userId, null, {
        itemCount: items.length,
        totalMatches: summary.totalMatches,
      }).catch(() => {});

      // Save to DB cache asynchronously (don't block response)
      saveSearch(userId, searchHash, items, results, summary).catch((e) =>
        console.error('[shopping-list] saveSearch error:', e)
      );
    }

    // Create magic link for authenticated users (allows viewing results without sign-in)
    let magicLinkUrl: string | undefined;
    if (userId) {
      try {
        const mlToken = await createMagicLink(userId, 'shopping_list_view', {
          query: items.map((i) => i.productName).join(', '),
          results,
          summary,
        });
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        magicLinkUrl = `${appUrl}/view-results?token=${mlToken}`;
      } catch (e) {
        console.error('[shopping-list] createMagicLink error:', e);
      }
    }

    // Store in in-memory map for backwards compat
    shoppingLists.set(listId!, { items, results, createdAt: new Date() });

    // ── Auto-Checkout Logic ─────────────────────────────────────────────────
    const autoCheckout: boolean = body.autoCheckout === true;
    let autoCheckoutResult: {
      success: boolean;
      orderId?: string;
      error?: string;
      failureCode?: string;
    } | null = null;

    if (autoCheckout) {
      // ── SYSTEM RESTRICTION: Auto-checkout restricted to native DB products ────
      // External aggregator products (Amazon, Flipkart) cannot be auto-checked out
      // because DelegateCart has no control over third-party order fulfilment.
      // Auto-checkout is ONLY allowed for products in the app's own database.
      //
      // Step 0: Check if native DB products exist for the searched items.
      // NOTE: The Product table has no 'stock' column. We query by name similarity
      // using flexible OR-based ILIKE terms so short tokens (≤2 chars e.g. "HP")
      // are still included. All products in the DB are treated as available.
      let nativeProductMatches: {
        itemName: string;
        productId: number;
        productName: string;
        price: number;
        imageUrl: string | null;
      }[] = [];
      try {
        for (const result of results || []) {
          const searchName = result.productName.toLowerCase().trim();
          // Include all tokens (even 2-char ones like "HP", "LG") for better matching
          const searchTerms = searchName.split(/\s+/).filter((t) => t.length >= 1);
          if (searchTerms.length === 0) continue;

          // Strategy 1: sequential ILIKE match — fast, works when words appear in order
          const seqPattern = `%${searchTerms.join('%')}%`;
          // Strategy 2: individual ILIKE for each term (OR), then rank by hits in app layer
          // We run strategy 1 first; if no results, try broader OR-based approach

          let dbProducts = (await dbQuery(
            `SELECT id, name, price, "imageUrl" FROM "Product"
             WHERE LOWER(name) LIKE $1
             ORDER BY price ASC LIMIT 5`,
            [seqPattern]
          )) as { id: number; name: string; price: number; imageUrl: string | null }[];

          // Strategy 2 fallback: if sequential pattern returned nothing, try matching
          // any significant term (≥3 chars) so "HP Pad Plus Neo" → matches by "pad" alone
          if (dbProducts.length === 0) {
            const sigTerms = searchTerms.filter((t) => t.length >= 3);
            if (sigTerms.length > 0) {
              // Build OR conditions: LOWER(name) LIKE $1 OR LOWER(name) LIKE $2 ...
              const orClauses = sigTerms.map((_t, i) => `LOWER(name) LIKE $${i + 1}`).join(' OR ');
              const likeArgs = sigTerms.map((t) => `%${t}%`);
              dbProducts = (await dbQuery(
                `SELECT id, name, price, "imageUrl" FROM "Product"
                 WHERE ${orClauses}
                 ORDER BY price ASC LIMIT 5`,
                likeArgs
              )) as { id: number; name: string; price: number; imageUrl: string | null }[];
            }
          }

          if (dbProducts.length > 0) {
            // Score each candidate by how many search terms appear in its name
            const scored = dbProducts
              .map((p) => {
                const nameLower = p.name.toLowerCase();
                const hits = searchTerms.filter((t) => nameLower.includes(t)).length;
                return { ...p, hits };
              })
              .sort((a, b) => b.hits - a.hits);

            const best = scored[0];
            nativeProductMatches.push({
              itemName: result.productName,
              productId: best.id,
              productName: best.name,
              price: best.price,
              imageUrl: best.imageUrl,
            });
          }
        }
      } catch (err) {
        // Log the DB error for visibility — do NOT silently swallow it
        console.error('[auto-checkout] Native product DB lookup failed:', err);
        // Fall through: nativeProductMatches stays empty → auto-checkout restricted
      }

      if (nativeProductMatches.length === 0) {
        // No native DB products found — restrict auto-checkout
        autoCheckoutResult = {
          success: false,
          error:
            'Auto-checkout is restricted to native products saved in the app database. No matching native products found for your search. External aggregator products (Amazon, Flipkart) cannot be auto-checked out. Please review recommendations and purchase manually through the retailer.',
          failureCode: 'AUTO_CHECKOUT_EXTERNAL_RESTRICTED',
        };
      } else {
        // Native products found — proceed with auto-checkout validation
        const orderItems = nativeProductMatches.map((m) => ({
          name: m.productName,
          productName: m.productName,
          brand: 'DelegateCart Native',
          price: m.price,
          quantity: 1,
          image:
            m.imageUrl ||
            `https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=80&h=80&fit=crop&q=60`,
          productId: m.productId,
        }));

        const orderTotal = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

        // Validate per-order threshold
        const threshold = session ? ((session as any).autoPurchaseThreshold ?? 500000) : 500000;
        // Validate monthly budget
        const monthlyLimit = session
          ? ((session as any).autoCheckoutMonthlyBudget ?? 2000000)
          : 2000000;
        let currentMonthSpend = 0;
        if (userId) {
          try {
            const monthStart = new Date();
            monthStart.setDate(1);
            monthStart.setHours(0, 0, 0, 0);
            const spendRows = await dbQuery(
              `SELECT COALESCE(SUM(total), 0) as total_spend FROM "Order"
               WHERE "userId" = $1 AND "aiAssisted" = true AND "createdAt" >= $2`,
              [userId, monthStart.toISOString()]
            );
            currentMonthSpend = parseFloat((spendRows as any)?.[0]?.total_spend || '0');
          } catch {
            /* non-fatal */
          }
        }

        // Stock availability: no 'stock' column in Product table; all native DB
        // products are assumed to be available. Budget/threshold guards below.
        if (orderTotal > threshold) {
          autoCheckoutResult = {
            success: false,
            error: `Order total ₹${orderTotal.toLocaleString('en-IN')} exceeds your per-order auto-purchase limit of ₹${threshold.toLocaleString('en-IN')}. Please review and checkout manually.`,
            failureCode: 'ORDER_BUDGET_EXCEEDED',
          };
        } else if (currentMonthSpend + orderTotal > monthlyLimit) {
          autoCheckoutResult = {
            success: false,
            error: `This order would push your monthly AI checkout spend to ₹${(currentMonthSpend + orderTotal).toLocaleString('en-IN')}, exceeding your monthly limit of ₹${monthlyLimit.toLocaleString('en-IN')}.`,
            failureCode: 'MONTHLY_BUDGET_EXCEEDED',
          };
        } else {
          // All constraints met — proceed with native product auto-checkout
          try {
            if (userId) {
              const wallet = await getOrCreateWallet(userId);
              const shippingAddress = {
                type: 'default',
                city: 'Mumbai',
                state: 'Maharashtra',
                country: 'India',
                pincode: '400001',
              };
              const orderNotes = `Auto-checkout (native products only). Items: ${orderItems.map((i) => i.productName).join(', ')}`;
              // Calculate real AI savings: sum of budgets minus actual order total
              const budgetTotal = items.reduce((s, i) => s + (i.budget || 0), 0);
              const realAiSavings =
                budgetTotal > 0 && orderTotal > 0 ? Math.max(0, budgetTotal - orderTotal) : 0;
              const { order, walletBalanceAfter } = await createOrderWithWalletPayment(
                userId,
                wallet.id,
                {
                  items: orderItems.map((item) => ({
                    productName: item.productName,
                    productId: item.productId, // ← store real DB product ID
                    productSlug: String(item.productId), // ← slug = product ID for direct linking
                    quantity: item.quantity,
                    price: item.price,
                    imageUrl: item.image,
                  })),
                  total: orderTotal,
                  aiAssisted: true,
                  paymentMethod: 'wallet',
                  shippingAddress,
                  notes: JSON.stringify({
                    text: `Auto-checkout (native products only). Items: ${orderItems.map((i) => i.productName).join(', ')}`,
                    aiSavings: realAiSavings,
                    budgetTotal,
                  }),
                }
              );
              autoCheckoutResult = {
                success: true,
                orderId: order.orderNumber,
                walletBalanceAfter,
              } as any;
              trackAnalyticsEvent('auto_checkout_placed', userId, null, {
                orderId: order.orderNumber,
                itemCount: orderItems.length,
                total: orderTotal,
                dbOrderId: order.id,
                paymentMethod: 'wallet',
                nativeOnly: true,
              }).catch(() => {});
            } else {
              const orderId = `ORD-AUTO-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
              autoCheckoutResult = { success: true, orderId } as any;
            }
          } catch (err: any) {
            autoCheckoutResult = {
              success: false,
              error: err?.message?.includes('Insufficient')
                ? err.message
                : 'Auto-checkout failed. Please retry or checkout manually.',
              failureCode: err?.message?.includes('Insufficient')
                ? 'INSUFFICIENT_BALANCE'
                : 'SYSTEM_ERROR',
            };
          }
        }
      }
    }

    // Old dead auto-checkout code removed — native-products-only logic is now live above

    // Send WhatsApp notification
    let whatsappResult: { sent: boolean; method: string; error?: string } = {
      sent: false,
      method: 'none',
      error: 'No phone number',
    };
    if (whatsappPhone) {
      whatsappResult = await sendWhatsAppNotification(whatsappPhone, results, magicLinkUrl);
    }

    const orderTotal = autoCheckoutResult?.success
      ? results.reduce((s, r) => s + ((r.matches[0] as any)?.price || 0) * r.quantity, 0)
      : 0;
    const baseMessage = autoCheckoutResult?.success
      ? `Auto-checkout complete! Order ${(autoCheckoutResult as any).orderId} placed with ${results.length} item(s) totalling ₹${orderTotal.toLocaleString('en-IN')}. Wallet debited. Check your orders page for tracking.`
      : whatsappResult.sent
        ? `Shopping list submitted! AI agent found ${results.reduce((s, r) => s + r.matches.length, 0)} matches. Results sent to WhatsApp ${whatsappPhone}.`
        : `Shopping list submitted! AI agent found ${results.reduce((s, r) => s + r.matches.length, 0)} matches. Check Smart Delegate page for results.`;

    return NextResponse.json({
      success: true,
      listId,
      fromCache,
      cacheInfo: fromCache
        ? 'Results from cache (less than 5 hours old). Enable "Force fresh search" to get latest prices.'
        : undefined,
      message: baseMessage,
      results,
      summary,
      whatsappSent: whatsappResult.sent,
      whatsappMethod: whatsappResult.method,
      whatsappError: whatsappResult.error,
      magicLinkUrl,
      emailSent: false,
      autoCheckout: autoCheckoutResult,
    });
  } catch (err: any) {
    console.error('[shopping-list] POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  // Return all shopping lists (simplified - in production this would be user-scoped)
  const lists = Array.from(shoppingLists.entries()).map(([id, data]) => ({
    id,
    itemCount: data.items.length,
    createdAt: data.createdAt,
    results: data.results,
  }));

  return NextResponse.json({ lists });
}
