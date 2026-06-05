/**
 * AI Scoring Engine — computes a composite score for product recommendations.
 *
 * score = relevance × 0.30 + userPreferenceMatch × 0.25 + priceFit × 0.20 + rating × 0.15 + aiConfidence × 0.10
 *
 * Each sub-score is 0-100.
 */

export interface ScoredProduct {
  name: string;
  brand: string;
  price: number;
  rating: number;
  matchScore: number;
  estimatedDelivery: string;
  emiAvailable: boolean;
  url: string;
  source: 'INTERNAL' | 'EXTERNAL' | 'CATALOG';
  // AI scoring fields
  aiScore: number;
  aiExplanation: string;
  aiConfidence: number;
  scoreBreakdown: {
    relevance: number;
    preferenceMatch: number;
    priceFit: number;
    ratingScore: number;
    aiConfidence: number;
  };
}

interface UserPrefs {
  preferredCategories?: string[];
  priceRange?: { min: number; max: number };
  brands?: string[];
}

interface BehaviorStats {
  productId: string;
  action: string;
  count: string;
}

const WEIGHTS = {
  relevance: 0.3,
  preferenceMatch: 0.25,
  priceFit: 0.2,
  rating: 0.15,
  aiConfidence: 0.1,
};

function computeRelevance(product: any, query: string): number {
  const q = query.toLowerCase();
  const name = (product.name || '').toLowerCase();
  const brand = (product.brand || '').toLowerCase();
  let score = 0;

  // Exact full-query match in name (highest signal)
  if (name.includes(q)) score += 50;
  // Brand match
  if (brand.includes(q) || q.includes(brand)) score += 20;

  // Keyword overlap — weight each query word by its position (earlier = more important)
  const queryWords = q.split(/\s+/).filter((w: string) => w.length >= 3);
  const nameWords = name.split(/\s+/);
  const overlap = queryWords.filter((w: string) =>
    nameWords.some((nw: string) => nw.includes(w) || w.includes(nw))
  );
  const coverageBonus = (overlap.length / Math.max(queryWords.length, 1)) * 30;
  score += coverageBonus;

  // Penalty: if less than half of meaningful query words are found → irrelevant
  if (queryWords.length >= 2 && overlap.length < Math.ceil(queryWords.length / 2)) {
    score = Math.max(0, score - 30); // heavy penalty for poor coverage
  }

  return Math.min(100, Math.max(0, score));
}

function computePreferenceMatch(
  product: any,
  prefs: UserPrefs,
  behaviorStats: BehaviorStats[]
): number {
  let score = 50; // neutral baseline
  // Brand preference
  if (prefs.brands?.length) {
    const brandLower = (product.brand || '').toLowerCase();
    if (prefs.brands.some((b) => b.toLowerCase() === brandLower)) score += 25;
  }
  // Price range fit
  if (prefs.priceRange) {
    const { min, max } = prefs.priceRange;
    if (product.price >= min && product.price <= max) score += 15;
  }
  // Behavior boost — if user previously interacted with this product/brand
  const productActions = behaviorStats.filter(
    (s) => s.productId === product.name || s.productId === product.brand
  );
  if (productActions.some((a) => a.action === 'add_to_cart')) score += 10;
  if (productActions.some((a) => a.action === 'purchase')) score += 5;
  if (productActions.some((a) => a.action === 'reject')) score -= 15;

  return Math.min(100, Math.max(0, score));
}

function computePriceFit(price: number, budget: number | null): number {
  if (!budget || budget === 0) return 70; // no budget specified = neutral-good
  const ratio = price / budget;
  if (ratio <= 0.7) return 90; // well under budget
  if (ratio <= 1.0) return 100; // at or under budget (best)
  if (ratio <= 1.1) return 70; // slightly over
  if (ratio <= 1.3) return 40; // moderately over
  return 10; // way over budget
}

function computeRatingScore(rating: number): number {
  return Math.min(100, (rating / 5) * 100);
}

function generateExplanation(
  product: any,
  breakdown: ScoredProduct['scoreBreakdown'],
  query: string
): string {
  const reasons: string[] = [];
  if (breakdown.relevance >= 70) reasons.push(`High relevance to "${query}"`);
  if (breakdown.preferenceMatch >= 70) reasons.push('Matches your preferences');
  if (breakdown.priceFit >= 80) reasons.push('Within your budget range');
  if (breakdown.ratingScore >= 80) reasons.push(`Highly rated (${product.rating}/5)`);
  if (product.emiAvailable) reasons.push('EMI available');
  if (reasons.length === 0) reasons.push('General recommendation based on category');
  return reasons.join('. ') + '.';
}

export function scoreProducts(
  products: any[],
  query: string,
  budget: number | null,
  userPrefs: UserPrefs,
  behaviorStats: BehaviorStats[],
  v2Intent?: { use_case?: string | null; features?: string[] } | null
): ScoredProduct[] {
  return products
    .map((product) => {
      const relevance = computeRelevance(product, query);
      const preferenceMatch = computePreferenceMatch(product, userPrefs, behaviorStats);
      const priceFit = computePriceFit(product.price, budget);
      const ratingScore = computeRatingScore(product.rating || 4.0);
      let aiConfidence = Math.min(100, (product.matchScore || 80) * 1.05);

      // ── v2 boosts: use_case + feature matching on attributes ─────────
      if (v2Intent && product.attributes) {
        const attrs = Object.values(product.attributes as Record<string, string>)
          .join(' ')
          .toLowerCase();
        // use_case match → +20
        if (v2Intent.use_case && attrs.includes(v2Intent.use_case)) {
          aiConfidence = Math.min(100, aiConfidence + 20);
        }
        // feature match → +15 per feature
        if (v2Intent.features) {
          for (const feat of v2Intent.features) {
            if (attrs.includes(feat.replace(/_/g, ' '))) {
              aiConfidence = Math.min(100, aiConfidence + 15);
            }
          }
        }
        // attribute depth → +10 if product has 5+ attributes
        if (Object.keys(product.attributes).length >= 5) {
          aiConfidence = Math.min(100, aiConfidence + 10);
        }
        // penalty: out of budget → -30
        if (budget && product.price > budget * 1.3) {
          aiConfidence = Math.max(0, aiConfidence - 30);
        }
        // penalty: missing key attributes → -15
        if (Object.keys(product.attributes).length < 2) {
          aiConfidence = Math.max(0, aiConfidence - 15);
        }
      }

      const aiScore = Math.round(
        relevance * WEIGHTS.relevance +
          preferenceMatch * WEIGHTS.preferenceMatch +
          priceFit * WEIGHTS.priceFit +
          ratingScore * WEIGHTS.rating +
          aiConfidence * WEIGHTS.aiConfidence
      );

      const breakdown = {
        relevance: Math.round(relevance),
        preferenceMatch: Math.round(preferenceMatch),
        priceFit: Math.round(priceFit),
        ratingScore: Math.round(ratingScore),
        aiConfidence: Math.round(aiConfidence),
      };

      const explanation = generateExplanation(product, breakdown, query);

      return {
        ...product,
        source: product.source || 'INTERNAL',
        aiScore,
        aiExplanation: explanation,
        aiConfidence: Math.round(aiConfidence),
        scoreBreakdown: breakdown,
      } as ScoredProduct;
    })
    .sort((a, b) => b.aiScore - a.aiScore);
}
