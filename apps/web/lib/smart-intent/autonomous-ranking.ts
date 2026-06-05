/**
 * Autonomous Multi-Objective Ranking Engine V3
 *
 * Score breakdown (100 pts max):
 *   relevance:        keyword(20) + feature(15) + priceFit(15) = 30 base
 *   rating:           10
 *   popularity:       10
 *   personalization:  20
 *   sessionBoost:     25
 *   trendingScore:    20
 *   reinforcement:    variable (from ProductLearning)
 *   businessScore:    30 (conversion + margin + inventory)
 *
 * Final = userScore * 0.7 + businessScore * 0.3
 * Stable sort: ORDER BY finalScore DESC, productId ASC
 */

export interface ProductSignals {
  productId: number;
  name: string;
  category: string;
  price: number;
  brand?: string;
  rating?: number;
  reviewCount?: number;
  // business metrics
  marginPercentage?: number;
  inventoryCount?: number;
  salesVelocity?: number;
  conversionRate?: number;
  returnRate?: number;
  // learning signals
  impressions?: number;
  clicks?: number;
  cartAdds?: number;
  purchases?: number;
  reinforcementScore?: number;
  trendingScore?: number;
}

export interface IntentContext {
  keywords: string[];
  category: string | null;
  budget: { min: number; max: number } | null;
  features: string[];
  use_case?: string | null;
}

export interface SessionContext {
  viewedCategories?: Record<string, number>;
  clickedBrands?: Record<string, number>;
  priceHistory?: number[];
}

export interface RankingWeightsConfig {
  keywordWeight: number; // default 20
  featureWeight: number; // default 15
  priceFitWeight: number; // default 15
  ratingWeight: number; // default 10
  popularityWeight: number; // default 10
  personalizationWeight: number; // default 20
  sessionBoostWeight: number; // default 25
  trendingWeight: number; // default 20
  businessWeight: number; // default 30
}

const DEFAULT_WEIGHTS: RankingWeightsConfig = {
  keywordWeight: 20,
  featureWeight: 15,
  priceFitWeight: 15,
  ratingWeight: 10,
  popularityWeight: 10,
  personalizationWeight: 20,
  sessionBoostWeight: 25,
  trendingWeight: 20,
  businessWeight: 30,
};

// ── Keyword match (0–20) ──────────────────────────────────────────────────────

function scoreKeyword(product: ProductSignals, keywords: string[], weight: number): number {
  if (!keywords.length) return weight * 0.5; // neutral if no keywords
  const text = `${product.name} ${product.category} ${product.brand ?? ''}`.toLowerCase();
  let hits = 0;
  for (const kw of keywords) {
    if (text.includes(kw.toLowerCase())) hits++;
  }
  return Math.round((hits / keywords.length) * weight);
}

// ── Feature match (0–15) ──────────────────────────────────────────────────────

function scoreFeature(product: ProductSignals, features: string[], weight: number): number {
  if (!features.length) return weight * 0.5;
  const text = product.name.toLowerCase();
  let hits = 0;
  for (const f of features) {
    if (text.includes(f.toLowerCase())) hits++;
  }
  return Math.round((hits / features.length) * weight);
}

// ── Price fit (0–15) ─────────────────────────────────────────────────────────

function scorePriceFit(
  price: number,
  budget: { min: number; max: number } | null,
  weight: number
): number {
  if (!budget) return weight * 0.6; // no budget = neutral
  if (price < budget.min || price > budget.max) {
    // penalty proportional to distance from range
    const dist =
      price < budget.min ? (budget.min - price) / budget.min : (price - budget.max) / budget.max;
    return Math.max(0, Math.round(weight * (1 - Math.min(2, dist))));
  }
  // within budget: boost products closer to top of budget (implies better quality)
  const pct = (price - budget.min) / Math.max(1, budget.max - budget.min);
  return Math.round(weight * (0.5 + pct * 0.5));
}

// ── Rating (0–10) ─────────────────────────────────────────────────────────────

function scoreRating(rating?: number, weight = 10): number {
  if (!rating) return weight * 0.4;
  return Math.round((rating / 5) * weight);
}

// ── Popularity (0–10) ────────────────────────────────────────────────────────

function scorePopularity(reviewCount?: number, weight = 10): number {
  if (!reviewCount) return 0;
  // log scale: 1000+ reviews = full score
  return Math.min(weight, Math.round(Math.log10(reviewCount + 1) * (weight / 3)));
}

// ── Session boost (0–25) ─────────────────────────────────────────────────────

function scoreSession(product: ProductSignals, session: SessionContext, weight: number): number {
  let boost = 0;
  const { viewedCategories = {}, clickedBrands = {}, priceHistory = [] } = session;

  // category match
  const catViews = viewedCategories[product.category.toLowerCase()] ?? 0;
  if (catViews > 0) boost += Math.min(10, catViews * 3);

  // brand match
  if (product.brand) {
    const brandClicks = clickedBrands[product.brand.toLowerCase()] ?? 0;
    if (brandClicks > 0) boost += Math.min(10, brandClicks * 5);
  }

  // price similarity
  if (priceHistory.length > 0) {
    const avgPrice = priceHistory.reduce((a, b) => a + b, 0) / priceHistory.length;
    const dist = Math.abs(product.price - avgPrice) / Math.max(1, avgPrice);
    if (dist < 0.2) boost += 5;
    else if (dist < 0.5) boost += 2;
  }

  return Math.min(weight, boost);
}

// ── Personalization (0–20) ───────────────────────────────────────────────────

function scorePersonalization(
  product: ProductSignals,
  session: SessionContext,
  weight: number
): number {
  const { viewedCategories = {} } = session;
  const totalViews = Object.values(viewedCategories).reduce((a, b) => a + b, 0);
  if (totalViews === 0) return 0;
  const catPct = (viewedCategories[product.category.toLowerCase()] ?? 0) / totalViews;
  return Math.round(catPct * weight);
}

// ── Trending (0–20) ──────────────────────────────────────────────────────────

function scoreTrending(trendingScore?: number, weight = 20): number {
  if (!trendingScore) return 0;
  return Math.min(weight, Math.round(trendingScore * (weight / 10)));
}

// ── Reinforcement (variable) ─────────────────────────────────────────────────

function scoreReinforcement(signals: ProductSignals): number {
  if (signals.reinforcementScore !== undefined) return Math.min(50, signals.reinforcementScore);
  // compute from raw signals
  const ctr =
    signals.impressions && signals.impressions > 0
      ? (signals.clicks ?? 0) / signals.impressions
      : 0;
  return Math.min(50, ctr * 10 + (signals.cartAdds ?? 0) * 2 + (signals.purchases ?? 0) * 5);
}

// ── Business score (0–30) ────────────────────────────────────────────────────

export function computeBusinessScore(signals: ProductSignals, weight: number): number {
  const conv = signals.conversionRate ?? 0.05;
  const margin = signals.marginPercentage ?? 20;
  const inventory = signals.inventoryCount ?? 100;
  const returnRate = signals.returnRate ?? 0;

  // conversion: up to 10 pts
  const convScore = Math.min(10, conv * 100);

  // margin: up to 10 pts (60% margin = full score)
  const marginScore = Math.min(10, margin / 6);

  // inventory: urgency (low) or clearance (high) boosts
  let invScore = 5; // neutral
  if (inventory < 10)
    invScore = 10; // low stock urgency
  else if (inventory < 30) invScore = 7;
  else if (inventory > 400) invScore = 8; // clearance boost

  // return rate penalty
  const returnPenalty = Math.min(5, returnRate * 50);

  const raw = convScore + marginScore + invScore - returnPenalty;
  return Math.round(Math.min(weight, Math.max(0, (raw / 30) * weight)));
}

// ── Main ranking function ────────────────────────────────────────────────────

export interface ScoredProduct {
  productId: number;
  name: string;
  price: number;
  category: string;
  brand?: string;
  userScore: number;
  businessScore: number;
  finalScore: number;
  scoreBreakdown: {
    keyword: number;
    feature: number;
    priceFit: number;
    rating: number;
    popularity: number;
    personalization: number;
    sessionBoost: number;
    trending: number;
    reinforcement: number;
    business: number;
  };
}

export function rankProducts(
  products: ProductSignals[],
  intent: IntentContext,
  session: SessionContext = {},
  weights: RankingWeightsConfig = DEFAULT_WEIGHTS
): ScoredProduct[] {
  const scored: ScoredProduct[] = products.map((p) => {
    const keyword = scoreKeyword(p, intent.keywords, weights.keywordWeight);
    const feature = scoreFeature(p, intent.features, weights.featureWeight);
    const priceFit = scorePriceFit(p.price, intent.budget, weights.priceFitWeight);
    const rating = scoreRating(p.rating, weights.ratingWeight);
    const popularity = scorePopularity(p.reviewCount, weights.popularityWeight);
    const persScore = scorePersonalization(p, session, weights.personalizationWeight);
    const sessionBst = scoreSession(p, session, weights.sessionBoostWeight);
    const trending = scoreTrending(p.trendingScore, weights.trendingWeight);
    const reinforcement = scoreReinforcement(p);

    const userScore =
      keyword +
      feature +
      priceFit +
      rating +
      popularity +
      persScore +
      sessionBst +
      trending +
      reinforcement;
    const businessScore = computeBusinessScore(p, weights.businessWeight);

    const finalScore = Math.round(userScore * 0.7 + businessScore * 0.3);

    return {
      productId: p.productId,
      name: p.name,
      price: p.price,
      category: p.category,
      brand: p.brand,
      userScore,
      businessScore,
      finalScore,
      scoreBreakdown: {
        keyword,
        feature,
        priceFit,
        rating,
        popularity,
        personalization: persScore,
        sessionBoost: sessionBst,
        trending,
        reinforcement,
        business: businessScore,
      },
    };
  });

  // Stable sort: finalScore DESC, productId ASC (pagination safe)
  return scored.sort((a, b) =>
    b.finalScore !== a.finalScore ? b.finalScore - a.finalScore : a.productId - b.productId
  );
}
