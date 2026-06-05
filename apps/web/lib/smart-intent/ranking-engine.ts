/**
 * Smart Intent Engine — Ranking Engine V2 (Phase 6 → R59 Dimension-Based)
 *
 * ARCHITECTURE:
 * 1. Primary: Delegates heavy ranking computation to Python ranking-engine via HTTP
 * 2. Fallback: In-process scoring using scorer registry + dimension weights (if Python unavailable)
 *
 * The Python service runs 22 dimension scorers using NumPy-optimized scoring,
 * with dimension weights loaded from PostgreSQL (60s cache). This offloads
 * CPU-intensive ranking from the Node.js event loop.
 */

import type { ParsedIntent, RankedProduct, SearchableProduct } from './types';
import type { SearchResult } from './search-engine';
import { executeScorer, type ScorerContext } from '../scoring/scorer-registry';
import { getActiveDimensions, getActiveDimensionsSync, type DimensionConfig } from '../scoring/dimension-weights';

// ── Python Ranking Service URL ───────────────────────────────────────────────

const RANKING_SERVICE_URL = process.env.RANKING_SERVICE_URL || 'http://product-ranking-engine:8000';
const RANKING_SERVICE_TIMEOUT_MS = 2000; // 2s timeout; fall back to in-process
let _serviceAvailable: boolean | null = null;
let _serviceCheckTime = 0;
const SERVICE_CHECK_INTERVAL = 30000; // re-check every 30s

// ── Expected attributes per category (kept for backwards compatibility) ──────

const EXPECTED_ATTRIBUTES: Record<string, string[]> = {
  phone: ['ram', 'storage', 'display', 'camera', 'battery', 'processor', 'connectivity'],
  laptop: ['ram', 'storage', 'display', 'gpu', 'processor', 'battery', 'weight'],
  headphones: ['driver', 'battery', 'connectivity'],
  television: ['size', 'panel', 'resolution', 'smart_platform'],
  appliances: ['type', 'capacity'],
  fashion: ['type', 'material', 'fit', 'occasion'],
  footwear: ['material', 'sole', 'closure', 'occasion'],
  watches: ['movement', 'display', 'strap', 'water_resistance'],
  furniture: ['type', 'material', 'finish', 'assembly'],
  accessories: ['type', 'material', 'color', 'compartments'],
};

// ── Personalization Context (Phase 4) ────────────────────────────────────────

export interface UserContext {
  preferredBrands?: string[];
  preferredCategories?: string[];
  priceRange?: { min: number; max: number };
  recentClickBrands?: string[];
}

// ── Dimension-based ranking (R59) ────────────────────────────────────────────

/**
 * Check if the Python ranking service is reachable.
 */
async function isServiceAvailable(): Promise<boolean> {
  const now = Date.now();
  if (_serviceAvailable !== null && now - _serviceCheckTime < SERVICE_CHECK_INTERVAL) {
    return _serviceAvailable;
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    const res = await fetch(`${RANKING_SERVICE_URL}/health`, { signal: controller.signal });
    clearTimeout(timeout);
    _serviceAvailable = res.ok;
  } catch {
    _serviceAvailable = false;
  }
  _serviceCheckTime = now;
  return _serviceAvailable;
}

/**
 * Delegate ranking to the Python service via HTTP POST /rank/v2.
 * Returns null if the service is unavailable or errors.
 */
async function rankViaService(
  searchResults: SearchResult[],
  intent: ParsedIntent,
  userContext?: UserContext,
): Promise<RankedProduct[] | null> {
  try {
    if (!(await isServiceAvailable())) return null;

    // Build request payload matching Python RankingRequest model
    const products = searchResults.map(({ product, matchScore }) => ({
      id: product.id,
      name: product.name,
      price: product.price,
      original_price: product.originalPrice || product.price,
      rating: product.rating || 0,
      review_count: product.reviewCount || 0,
      brand: product.brand || '',
      delivery_time: product.delivery
        ? `${product.delivery.daysMin}-${product.delivery.daysMax} days`
        : '5-7 days',
      source: 'internal',
      in_stock: product.inStock ?? true,
      key_features: product.specifications?.features || [],
      category: product.category || '',
      sub_category: product.subCategory || '',
      attributes: product.attributes || {},
      specifications_features: product.specifications?.features || [],
      specifications_use_cases: product.specifications?.use_cases || [],
      specifications_search_tags: product.specifications?.search_tags || [],
      relevance_score: matchScore,
      learning_boost: 0,
      feedback_boost: 0,
    }));

    const body = {
      request_id: Date.now(),
      user_id: 0,
      products,
      budget_min: intent.budget?.min ?? 0,
      budget_max: intent.budget?.max ?? 999999,
      preferred_brands: userContext?.preferredBrands || [],
      category: intent.category || null,
      intent_brand: intent.brand || null,
      intent_features: intent.features || [],
      use_case: intent.use_case || null,
      keywords: intent.raw_tokens || [],
      recent_click_brands: userContext?.recentClickBrands || [],
      user_price_min: userContext?.priceRange?.min ?? null,
      user_price_max: userContext?.priceRange?.max ?? null,
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), RANKING_SERVICE_TIMEOUT_MS);
    const res = await fetch(`${RANKING_SERVICE_URL}/rank/v2`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return null;
    const data = await res.json();

    // Map Python response back to RankedProduct[]
    const productMap = new Map(searchResults.map(sr => [sr.product.id, sr]));
    return (data.ranked_products || []).map((rp: any) => {
      const sr = productMap.get(rp.product.id);
      const product = sr?.product;
      if (!product) return null;

      const dimScores = rp.explanation?.dimension_scores || {};
      const dimTotal = rp.explanation?.dimension_total || 0;
      const finalScore = Math.max(0, Math.round(dimTotal + (sr.matchScore / 100) * 20));

      return {
        ...product,
        relevanceScore: finalScore,
        scoreBreakdown: {
          categoryMatch: Math.round((dimScores.category_match || 0) * 30),
          priceMatch: Math.round((dimScores.budget_fit || 0) * 20),
          brandMatch: Math.round((dimScores.brand_match || 0) * 10),
          useCaseMatch: Math.round((dimScores.use_case_match || 0) * 10),
          featureMatch: Math.round((dimScores.feature_match || 0) * 20),
          attributeDepth: Math.round((dimScores.spec_match || 0) * 5),
          ratingScore: Math.round((dimScores.verified_ratings || 0) * 15),
          penalty: -Math.round((dimScores.budget_penalty || 0) * 5),
          budgetProximity: Math.round((dimScores.budget_fit || 0) * 5),
          popularity: Math.round((dimScores.popularity || 0) * 10),
          dimensionScores: dimScores,
          dimensionTotal: Math.round(dimTotal),
        },
      } as RankedProduct;
    }).filter(Boolean)
     .sort((a: RankedProduct, b: RankedProduct) => b.relevanceScore - a.relevanceScore || a.id.localeCompare(b.id));
  } catch {
    // Service unavailable or timeout — fall through to in-process
    return null;
  }
}

/**
 * Rank products using the fully dynamic dimension-based scoring system.
 * Primary: delegates to Python ranking service (async, HTTP).
 * Fallback: in-process scoring via scorer registry + dimension weights.
 */
export async function rankProductsAsync(
  searchResults: SearchResult[],
  intent: ParsedIntent,
  userContext?: UserContext
): Promise<RankedProduct[]> {
  // Try Python ranking service first (offloads CPU from Node.js)
  const serviceResult = await rankViaService(searchResults, intent, userContext);
  if (serviceResult && serviceResult.length > 0) return serviceResult;

  // Fallback: in-process scoring
  const dimensions = await getActiveDimensions();
  return rankWithDimensions(searchResults, intent, dimensions, userContext);
}

/**
 * Synchronous ranking with provided dimensions (used when cache is pre-loaded).
 */
export function rankProducts(
  searchResults: SearchResult[],
  intent: ParsedIntent,
  userContext?: UserContext
): RankedProduct[] {
  // Use cached dimensions synchronously — the cache is warm after first async call
  let dimensions: DimensionConfig[];
  try {
    dimensions = getActiveDimensionsSync();
  } catch {
    // Fallback: use default dimensions inline
    dimensions = getDefaultDimensions();
  }
  return rankWithDimensions(searchResults, intent, dimensions, userContext);
}

function rankWithDimensions(
  searchResults: SearchResult[],
  intent: ParsedIntent,
  dimensions: DimensionConfig[],
  userContext?: UserContext
): RankedProduct[] {
  return searchResults
    .map(({ product, matchScore, matchReasons }) => {
      const features = extractFeatures(product);
      const ctx: ScorerContext = {
        product,
        intent,
        userContext,
        features,
      };

      // Score each active dimension
      const dimensionScores: Record<string, number> = {};
      let totalPositiveScore = 0;
      let totalPenalty = 0;

      for (const dim of dimensions) {
        if (!dim.isActive || !dim.scorerKey) continue;
        const rawScore = executeScorer(dim.scorerKey, ctx);
        dimensionScores[dim.key] = rawScore;

        const weighted = rawScore * dim.weightage * 100;
        if (dim.isNegative) {
          totalPenalty += weighted;
        } else {
          totalPositiveScore += weighted;
        }
      }

      // Final score = positive contributions - penalties
      // Also blend with search engine match score for robustness (20% search signal)
      const dimensionTotal = totalPositiveScore - totalPenalty;
      const searchSignal = (matchScore / 100) * 20;
      const finalScore = Math.max(0, Math.round(dimensionTotal + searchSignal));

      // Build legacy breakdown for backwards compatibility
      const breakdown = {
        categoryMatch: Math.round((dimensionScores['category_match'] || 0) * 30),
        priceMatch: Math.round((dimensionScores['budget_fit'] || 0) * 20),
        brandMatch: Math.round((dimensionScores['brand_match'] || 0) * 10),
        useCaseMatch: Math.round((dimensionScores['use_case_match'] || 0) * 10),
        featureMatch: Math.round((dimensionScores['feature_match'] || 0) * 20),
        attributeDepth: Math.round((dimensionScores['spec_match'] || 0) * 5),
        ratingScore: Math.round((dimensionScores['verified_ratings'] || 0) * 15),
        penalty: -Math.round(totalPenalty),
        budgetProximity: Math.round((dimensionScores['budget_fit'] || 0) * 5),
        popularity: Math.round((dimensionScores['popularity'] || 0) * 10),
        // Extended fields
        dimensionScores,
        dimensionTotal: Math.round(dimensionTotal),
      };

      return {
        ...product,
        relevanceScore: finalScore,
        scoreBreakdown: breakdown,
      } as RankedProduct;
    })
    .sort((a, b) => b.relevanceScore - a.relevanceScore || a.id.localeCompare(b.id));
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractFeatures(product: SearchableProduct): string[] {
  const features: string[] = [];
  if (product.specifications?.features) features.push(...product.specifications.features);
  if (product.specifications?.search_tags) features.push(...product.specifications.search_tags);
  // Fall back to attribute values
  if (features.length === 0) {
    features.push(...Object.values(product.attributes));
  }
  return features;
}

function resolveBudget(intent: ParsedIntent): { min: number; max: number } {
  if (!intent.budget) return { min: 0, max: 999999 };
  let { min, max } = intent.budget;
  if (max === -1) { min = 0; max = 4000; }
  if (max === -2) { min = 50000; max = 500000; }
  return { min, max };
}

function getDefaultDimensions(): DimensionConfig[] {
  return [
    { key: 'category_match', label: 'Category Match', weightage: 0.08, group: 'intent', scorerKey: 'categoryMatch', isActive: true, isNegative: false, minWeightage: 0.02, maxWeightage: 0.25 },
    { key: 'brand_match', label: 'Brand Match', weightage: 0.04, group: 'intent', scorerKey: 'brandMatch', isActive: true, isNegative: false, minWeightage: 0.0, maxWeightage: 0.20 },
    { key: 'use_case_match', label: 'Use Case Match', weightage: 0.03, group: 'intent', scorerKey: 'useCaseMatch', isActive: true, isNegative: false, minWeightage: 0.0, maxWeightage: 0.15 },
    { key: 'feature_match', label: 'Feature Match', weightage: 0.05, group: 'intent', scorerKey: 'featureMatch', isActive: true, isNegative: false, minWeightage: 0.01, maxWeightage: 0.20 },
    { key: 'budget_fit', label: 'Budget Fit', weightage: 0.08, group: 'quality', scorerKey: 'budgetFit', isActive: true, isNegative: false, minWeightage: 0.02, maxWeightage: 0.25 },
    { key: 'spec_match', label: 'Spec Match', weightage: 0.06, group: 'quality', scorerKey: 'specMatch', isActive: true, isNegative: false, minWeightage: 0.01, maxWeightage: 0.20 },
    { key: 'warranty_coverage', label: 'Warranty Coverage', weightage: 0.05, group: 'quality', scorerKey: 'warrantyCoverage', isActive: true, isNegative: false, minWeightage: 0.0, maxWeightage: 0.15 },
    { key: 'manufacturer_profile', label: 'Manufacturer Profile', weightage: 0.04, group: 'quality', scorerKey: 'manufacturerProfile', isActive: true, isNegative: false, minWeightage: 0.0, maxWeightage: 0.15 },
    { key: 'brand_trust', label: 'Brand Trust', weightage: 0.04, group: 'quality', scorerKey: 'brandTrust', isActive: true, isNegative: false, minWeightage: 0.0, maxWeightage: 0.15 },
    { key: 'delivery_performance', label: 'Delivery Performance', weightage: 0.05, group: 'quality', scorerKey: 'deliveryPerformance', isActive: true, isNegative: false, minWeightage: 0.0, maxWeightage: 0.15 },
    { key: 'verified_ratings', label: 'Verified Ratings', weightage: 0.06, group: 'quality', scorerKey: 'verifiedRatings', isActive: true, isNegative: false, minWeightage: 0.01, maxWeightage: 0.20 },
    { key: 'eligible_for_return', label: 'Eligible For Return', weightage: 0.04, group: 'quality', scorerKey: 'returnEligibility', isActive: true, isNegative: false, minWeightage: 0.0, maxWeightage: 0.15 },
    { key: 'eligible_for_replacement', label: 'Eligible For Replacement', weightage: 0.04, group: 'quality', scorerKey: 'replacementEligibility', isActive: true, isNegative: false, minWeightage: 0.0, maxWeightage: 0.15 },
    { key: 'popularity', label: 'Popularity', weightage: 0.04, group: 'engagement', scorerKey: 'popularity', isActive: true, isNegative: false, minWeightage: 0.0, maxWeightage: 0.15 },
    { key: 'learning_boost', label: 'Learning Boost', weightage: 0.03, group: 'engagement', scorerKey: 'learningBoost', isActive: true, isNegative: false, minWeightage: 0.0, maxWeightage: 0.15 },
    { key: 'trending_score', label: 'Trending Score', weightage: 0.02, group: 'engagement', scorerKey: 'trendingScore', isActive: true, isNegative: false, minWeightage: 0.0, maxWeightage: 0.10 },
    { key: 'preferred_brand_boost', label: 'Preferred Brand Boost', weightage: 0.03, group: 'personal', scorerKey: 'preferredBrandBoost', isActive: true, isNegative: false, minWeightage: 0.0, maxWeightage: 0.15 },
    { key: 'recent_click_boost', label: 'Recent Click Boost', weightage: 0.02, group: 'personal', scorerKey: 'recentClickBoost', isActive: true, isNegative: false, minWeightage: 0.0, maxWeightage: 0.10 },
    { key: 'price_range_fit', label: 'Price Range Fit', weightage: 0.02, group: 'personal', scorerKey: 'priceRangeFit', isActive: true, isNegative: false, minWeightage: 0.0, maxWeightage: 0.10 },
    { key: 'session_affinity', label: 'Session Affinity', weightage: 0.02, group: 'personal', scorerKey: 'sessionAffinity', isActive: true, isNegative: false, minWeightage: 0.0, maxWeightage: 0.10 },
    { key: 'conversion_potential', label: 'Conversion Potential', weightage: 0.05, group: 'business', scorerKey: 'conversionPotential', isActive: true, isNegative: false, minWeightage: 0.01, maxWeightage: 0.20 },
    { key: 'budget_penalty', label: 'Budget Penalty', weightage: 0.05, group: 'business', scorerKey: 'budgetPenalty', isActive: true, isNegative: true, minWeightage: 0.05, maxWeightage: 0.25 },
  ];
}
