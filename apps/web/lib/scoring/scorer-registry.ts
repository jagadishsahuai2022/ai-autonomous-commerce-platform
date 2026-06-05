/**
 * Scorer Registry — Maps dimension keys to scoring functions.
 *
 * Every dimension in the ScoringDimension table has a `scorerKey` that maps
 * to a pure function here. The ranking engine calls scorers through this
 * registry, making the entire scoring pipeline fully dynamic.
 */

import {
  computeSpecScore,
  computeWarrantyInfo,
  getBrandTier,
  parseDeliveryInfo,
  computeVerifiedRating,
  computeReturnEligibility,
  computeReplacementEligibility,
} from './product-scoring';
import { getLearningBoost } from '../smart-intent/product-learning';
import { getFeedbackBoost } from '../smart-intent/feedback-tracker';
import type { ParsedIntent } from '../smart-intent/types';

// ── Scorer context passed to every scoring function ──────────────────────────

export interface ScorerContext {
  product: {
    id: string;
    name: string;
    brand: string;
    price: number;
    originalPrice: number;
    category: string;
    subCategory: string;
    rating: number;
    reviewCount: number;
    inStock: boolean;
    delivery: { daysMin: number; daysMax: number; free: boolean };
    attributes: Record<string, string>;
    codAvailable: boolean;
    hasEMI: boolean;
    image: string;
    specifications?: {
      features?: string[];
      use_cases?: string[];
      search_tags?: string[];
    };
  };
  intent: ParsedIntent;
  userContext?: {
    preferredBrands?: string[];
    recentClickBrands?: string[];
    priceRange?: { min: number; max: number };
    preferredCategories?: string[];
  };
  features: string[];  // product key_features array
}

// ── Scorer function type ─────────────────────────────────────────────────────

export type ScorerFunction = (ctx: ScorerContext) => number;

// ── Use-case attribute preference maps ───────────────────────────────────────

const USE_CASE_ATTR_PREFERENCES: Record<string, Record<string, string[]>> = {
  gaming: { gpu: ['rtx 4060', 'rtx 4070', 'rtx 4080', 'rtx 4090'], processor: ['i7', 'i9', 'ryzen 7', 'ryzen 9'], display: ['144hz', '165hz', '240hz'], ram: ['16gb', '32gb'] },
  office: { weight: ['1.0', '1.2', '1.4', '1.6'], battery: ['10hrs', '12hrs', '15hrs', '18hrs', '22hrs'], display: ['ips', 'oled'], occasion: ['formal', 'office', 'business'] },
  student: { battery: ['10hrs', '12hrs', '15hrs'], weight: ['1.0', '1.2', '1.4', '1.5', '1.6', '1.7'], occasion: ['casual', 'college'] },
  coding: { ram: ['16gb', '32gb'], processor: ['i7', 'i9', 'ryzen 7', 'ryzen 9', 'm3 pro', 'm3 max', 'core ultra 7', 'core ultra 9'], display: ['qhd', 'oled', '2.8k'] },
  photography: { camera: ['108mp', '200mp', 'quad', 'ois'], display: ['amoled', 'oled'] },
  music: { driver: ['40mm', '45mm', '50mm'], anc: ['active noise cancelling', 'adaptive anc', 'hybrid anc'], codec: ['ldac', 'aptx'] },
  fitness: { waterproof: ['ipx4', 'ipx5', 'ip55', 'ip57'], battery: ['24hrs', '30hrs', '40hrs', '60hrs'] },
  travel: { weight: ['1.0', '1.2', '200g', '250g'], battery: ['10hrs', '12hrs', '15hrs', '18hrs', '22hrs', '30hrs', '40hrs'], anc: ['active noise cancelling', 'adaptive anc'] },
  entertainment: { size: ['55', '65', '75', '85'], panel: ['oled', 'qled', 'neo qled', 'mini led'], hdr: ['dolby vision', 'hdr10+'], audio: ['dolby atmos', '40w', '60w', '80w'] },
  home: { star_rating: ['5 star'], technology: ['inverter', 'dual inverter', 'digital inverter'] },
};

// ── Budget resolution helper ─────────────────────────────────────────────────

function resolveBudget(intent: ParsedIntent): { min: number; max: number } {
  if (!intent.budget) return { min: 0, max: 999999 };
  let { min, max } = intent.budget;
  if (max === -1) { min = 0; max = 4000; }
  if (max === -2) { min = 50000; max = 500000; }
  return { min, max };
}

// ── Individual scorer implementations ────────────────────────────────────────

const scorers: Record<string, ScorerFunction> = {

  // ── Intent Group ──────────────────────────────────────────────────────────

  categoryMatch: (ctx) => {
    if (!ctx.intent.category) return 0.5;
    return ctx.product.category === ctx.intent.category ? 1.0 : 0.1;
  },

  brandMatch: (ctx) => {
    if (!ctx.intent.brand) return 0.0;
    return ctx.product.brand.toLowerCase() === ctx.intent.brand.toLowerCase() ? 1.0 : 0.0;
  },

  useCaseMatch: (ctx) => {
    if (!ctx.intent.use_case) return 0.0;
    const prefs = USE_CASE_ATTR_PREFERENCES[ctx.intent.use_case];
    if (!prefs) return 0.0;
    let hits = 0;
    const totalPrefs = Object.keys(prefs).length;
    for (const [attrKey, preferredValues] of Object.entries(prefs)) {
      const attrVal = ctx.product.attributes[attrKey]?.toLowerCase();
      if (attrVal && preferredValues.some(pv => attrVal.includes(pv))) hits++;
    }
    return totalPrefs > 0 ? hits / totalPrefs : 0;
  },

  featureMatch: (ctx) => {
    if (ctx.intent.features.length === 0) return 0.5;
    let featureHits = 0;
    const attrValues = Object.values(ctx.product.attributes).join(' ').toLowerCase();
    for (const feature of ctx.intent.features) {
      const featureKw = feature.toLowerCase().replace(/_/g, ' ');
      if (attrValues.includes(featureKw)) featureHits++;
      if (feature === 'anc' && attrValues.includes('noise cancell')) featureHits++;
      if (feature === '5g' && attrValues.includes('5g')) featureHits++;
      if (feature === 'inverter' && attrValues.includes('inverter')) featureHits++;
    }
    return Math.min(1, featureHits / ctx.intent.features.length);
  },

  // ── Quality Group ─────────────────────────────────────────────────────────

  budgetFit: (ctx) => {
    if (!ctx.intent.budget) return 0.6;
    const { min, max } = resolveBudget(ctx.intent);
    if (ctx.product.price >= min && ctx.product.price <= max) {
      const ratio = ctx.product.price / max;
      if (ratio >= 0.75) return 1.0;
      if (ratio >= 0.5) return 0.75;
      return 0.5;
    }
    if (ctx.product.price <= max * 1.1) return 0.6;
    if (ctx.product.price <= max * 1.25) return 0.3;
    return 0.0;
  },

  specMatch: (ctx) => {
    return computeSpecScore(ctx.features).score;
  },

  warrantyCoverage: (ctx) => {
    return computeWarrantyInfo(ctx.features).score;
  },

  manufacturerProfile: (ctx) => {
    return getBrandTier(ctx.product.brand).score;
  },

  brandTrust: (ctx) => {
    const tier = getBrandTier(ctx.product.brand);
    let score = tier.score;
    // Boost if user has brand preference overlap
    if (ctx.userContext?.preferredBrands?.some(b => b.toLowerCase() === ctx.product.brand.toLowerCase())) {
      score = Math.min(1.0, score + 0.1);
    }
    return score;
  },

  deliveryPerformance: (ctx) => {
    const deliveryStr = ctx.product.delivery
      ? `${ctx.product.delivery.daysMin}-${ctx.product.delivery.daysMax} days`
      : 'unknown';
    return parseDeliveryInfo(deliveryStr).score;
  },

  verifiedRatings: (ctx) => {
    return computeVerifiedRating(ctx.product.rating, ctx.product.reviewCount).verifiedScore;
  },

  returnEligibility: (ctx) => {
    return computeReturnEligibility(undefined, ctx.features).score;
  },

  replacementEligibility: (ctx) => {
    return computeReplacementEligibility(undefined, ctx.features).score;
  },

  // ── Engagement Group ──────────────────────────────────────────────────────

  popularity: (ctx) => {
    if (ctx.product.reviewCount <= 0) return 0;
    return Math.min(1.0, Math.log10(ctx.product.reviewCount) / 4.48);
  },

  learningBoost: (ctx) => {
    const boost = getLearningBoost(ctx.product.id);
    return Math.min(1.0, boost / 50); // normalize: max 50 → 1.0
  },

  trendingScore: (ctx) => {
    // Simple trending proxy: high review count + high rating = trending
    const recencyProxy = ctx.product.reviewCount > 1000 ? 0.5 : ctx.product.reviewCount / 2000;
    const ratingBoost = ctx.product.rating >= 4.5 ? 0.3 : ctx.product.rating >= 4.0 ? 0.15 : 0;
    return Math.min(1.0, recencyProxy + ratingBoost);
  },

  // ── Personalization Group ─────────────────────────────────────────────────

  preferredBrandBoost: (ctx) => {
    if (!ctx.userContext?.preferredBrands) return 0;
    return ctx.userContext.preferredBrands.some(
      b => b.toLowerCase() === ctx.product.brand.toLowerCase()
    ) ? 1.0 : 0;
  },

  recentClickBoost: (ctx) => {
    if (!ctx.userContext?.recentClickBrands) return 0;
    return ctx.userContext.recentClickBrands.some(
      b => b.toLowerCase() === ctx.product.brand.toLowerCase()
    ) ? 0.7 : 0;
  },

  priceRangeFit: (ctx) => {
    if (!ctx.userContext?.priceRange) return 0.5;
    const { min, max } = ctx.userContext.priceRange;
    if (ctx.product.price >= min && ctx.product.price <= max) return 1.0;
    if (ctx.product.price < min) return 0.3;
    const overage = ctx.product.price / max;
    if (overage <= 1.2) return 0.5;
    return 0.1;
  },

  sessionAffinity: (ctx) => {
    // Feedback-based session affinity
    const feedback = getFeedbackBoost(ctx.product.id);
    return Math.min(1.0, Math.max(0, (feedback + 10) / 25)); // range [-10,15] → [0,1]
  },

  // ── Business Group ────────────────────────────────────────────────────────

  conversionPotential: (ctx) => {
    // Simplified conversion signal from rating + review count
    const ratingSignal = ctx.product.rating / 5;
    const volumeSignal = Math.min(1.0, Math.log10(Math.max(1, ctx.product.reviewCount)) / 4);
    return (ratingSignal * 0.6 + volumeSignal * 0.4);
  },

  budgetPenalty: (ctx) => {
    if (!ctx.intent.budget) return 0;
    const { max } = resolveBudget(ctx.intent);
    if (ctx.product.price <= max) return 0;
    const overageRatio = ctx.product.price / max;
    if (overageRatio <= 1.1) return 0.2;
    if (overageRatio <= 1.25) return 0.5;
    if (overageRatio <= 1.5) return 0.7;
    return 1.0; // heavily over budget
  },
};

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Get a scorer function by its scorerKey. Returns undefined if not found.
 */
export function getScorer(scorerKey: string): ScorerFunction | undefined {
  return scorers[scorerKey];
}

/**
 * Execute a scorer by key, returning 0 if the scorer is not found.
 */
export function executeScorer(scorerKey: string, ctx: ScorerContext): number {
  const fn = scorers[scorerKey];
  if (!fn) return 0;
  try {
    const raw = fn(ctx);
    return Math.max(0, Math.min(1, raw)); // clamp to [0, 1]
  } catch {
    return 0;
  }
}

/**
 * Get all registered scorer keys.
 */
export function getRegisteredScorerKeys(): string[] {
  return Object.keys(scorers);
}
