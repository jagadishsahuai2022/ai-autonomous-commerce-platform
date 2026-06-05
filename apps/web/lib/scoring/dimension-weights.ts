/**
 * Dimension Weights — Server-side cached weight configuration.
 *
 * Loads ScoringDimension rows from DB and caches for 60 seconds.
 * Used by the ranking engine on every search to get current weights.
 */

export interface DimensionConfig {
  key: string;
  label: string;
  weightage: number;
  group: string;
  scorerKey: string;
  isActive: boolean;
  isNegative: boolean;
  minWeightage: number;
  maxWeightage: number;
}

// ── In-memory cache with 60-second TTL ──────────────────────────────────────

let _cache: DimensionConfig[] | null = null;
let _cacheTime = 0;
const CACHE_TTL_MS = 60_000; // 60 seconds

// Default dimensions used before DB is available
const DEFAULT_DIMENSIONS: DimensionConfig[] = [
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

/**
 * Get active dimension configs. Tries DB first, falls back to defaults.
 * Results are cached for 60 seconds.
 */
export async function getActiveDimensions(): Promise<DimensionConfig[]> {
  const now = Date.now();
  if (_cache && (now - _cacheTime) < CACHE_TTL_MS) {
    return _cache;
  }

  try {
    // Dynamic import to avoid circular deps and work in both server/client
    const { query } = await import('../db');
    const rows = await query(
      `SELECT key, label, weightage, "group", "scorerKey", "isActive", "isNegative", "minWeightage", "maxWeightage"
       FROM "ScoringDimension"
       WHERE "isActive" = true
       ORDER BY "sortOrder" ASC`
    );

    if (rows && rows.length > 0) {
      _cache = rows.map((r: Record<string, unknown>) => ({
        key: r.key as string,
        label: r.label as string,
        weightage: Number(r.weightage),
        group: (r.group as string) || 'quality',
        scorerKey: (r.scorerKey as string) || r.key as string,
        isActive: r.isActive !== false,
        isNegative: r.isNegative === true,
        minWeightage: Number(r.minWeightage) || 0,
        maxWeightage: Number(r.maxWeightage) || 0.25,
      }));
      _cacheTime = now;
      return _cache;
    }
  } catch {
    // DB not available — use defaults
  }

  _cache = DEFAULT_DIMENSIONS;
  _cacheTime = now;
  return _cache;
}

/**
 * Get dimension weight map { key: weightage }
 */
export async function getDimensionWeightMap(): Promise<Record<string, number>> {
  const dims = await getActiveDimensions();
  const map: Record<string, number> = {};
  for (const d of dims) {
    map[d.key] = d.weightage;
  }
  return map;
}

/**
 * Force cache refresh (called after admin updates weights).
 */
export function invalidateDimensionCache(): void {
  _cache = null;
  _cacheTime = 0;
}

/**
 * Synchronous cache access — returns cached dimensions or defaults.
 * Used by the synchronous rankProducts() path.
 */
export function getActiveDimensionsSync(): DimensionConfig[] {
  if (_cache) return _cache;
  return DEFAULT_DIMENSIONS;
}

/**
 * Get dimensions by group.
 */
export async function getDimensionsByGroup(): Promise<Record<string, DimensionConfig[]>> {
  const dims = await getActiveDimensions();
  const groups: Record<string, DimensionConfig[]> = {};
  for (const d of dims) {
    if (!groups[d.group]) groups[d.group] = [];
    groups[d.group].push(d);
  }
  return groups;
}
