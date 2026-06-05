/**
 * Smart Intent Engine v2 — Type definitions
 *
 * Deterministic LLM-like intelligence without external API calls.
 */

// ── Phase 1: Intent Understanding ────────────────────────────────────────────

export interface ParsedIntent {
  category: string | null;
  brand: string | null;
  budget: { min: number; max: number } | null;
  use_case: string | null;
  features: string[];
  confidence: number; // 0–100
  raw_tokens: string[];
  matched_entities: MatchedEntity[];
  /** Noun signals: product-category nouns + brand nouns detected in query.
   * These are the MOST important signals for intent resolution. */
  noun_signals?: string[];
  /** Amount signals: price/budget tokens detected in query (numbers, currency, ranges).
   * These are equally critical for filtering products. */
  amount_signals?: string[];
}

export interface MatchedEntity {
  type: 'category' | 'brand' | 'budget' | 'use_case' | 'feature';
  value: string;
  source_token: string;
  score: number;
}

// ── Phase 2: Dynamic Questions ───────────────────────────────────────────────

export interface ClarifyingQuestion {
  id: string;
  question: string;
  type: 'multiple_choice' | 'free_text';
  options: { value: string; label: string }[];
  category: 'budget' | 'brand' | 'use_case' | 'feature' | 'delivery';
  required: boolean;
  reason: string; // Why this question was picked
}

// ── Phase 3: Product Search ──────────────────────────────────────────────────

export interface ProductSearchParams {
  category: string;
  budget?: { min: number; max: number };
  brand?: string | null;
  use_case?: string | null;
  features?: string[];
  keywords?: string[];
}

// ── Phase 1: Enriched Product Specifications (stored in SellerProduct.specifications) ──

export type PriceBand = 'ultra_budget' | 'budget' | 'midrange' | 'upper_mid' | 'premium';

export interface ProductSpecifications {
  category: string; // normalised: "smartphone", "laptop", etc.
  subcategory: string; // "flagship", "gaming", "tws_earbuds", etc.
  brand: string;
  price_band: PriceBand;
  use_cases: string[]; // ["gaming", "camera", "battery"]
  features: string[]; // ["5G", "fast charging", "amoled"]
  attributes: Record<string, string>; // { ram: "8GB", storage: "128GB", ... }
  search_tags: string[]; // flat list for full-text search
  price_bucket: { min: number; max: number };
}

export interface SearchableProduct {
  id: string;
  name: string;
  brand: string;
  price: number;
  originalPrice: number;
  category: string;
  subCategory: string;
  rating: number;
  reviewCount: number;
  image: string;
  inStock: boolean;
  delivery: { daysMin: number; daysMax: number; free: boolean };
  codAvailable: boolean;
  hasEMI: boolean;
  attributes: Record<string, string>;
  // Phase 1: enriched fields
  searchIndex: string; // pre-built full-text search string
  specifications: ProductSpecifications; // structured metadata
}

// ── Phase 4: Ranking ─────────────────────────────────────────────────────────

export interface RankedProduct extends SearchableProduct {
  relevanceScore: number;
  scoreBreakdown: {
    categoryMatch: number;
    priceMatch: number;
    brandMatch: number;
    useCaseMatch: number;
    featureMatch: number;
    attributeDepth: number;
    ratingScore: number;
    penalty: number;
    budgetProximity: number; // Phase 5: 0–10, closeness to budget centre
    popularity: number; // Phase 5: 0–8, log-scale from reviewCount
    // R59: Extended dimension-based fields
    dimensionScores?: Record<string, number>;
    dimensionTotal?: number;
  };
}

// ── Phase 5: Response Generation ─────────────────────────────────────────────

export interface GeneratedResponse {
  text: string;
  confidence_level: 'high' | 'medium' | 'low';
  follow_up_prompt: string | null;
}

// ── Orchestrator ─────────────────────────────────────────────────────────────

export interface IntentEngineResult {
  intent: ParsedIntent;
  questions: ClarifyingQuestion[];
  products: RankedProduct[];
  response: GeneratedResponse;
  initial_text: string;
  engine_version: 'v1' | 'v2';
  processing_time_ms: number;
}

// ── Logging ──────────────────────────────────────────────────────────────────

export interface IntentLog {
  timestamp: string;
  query: string;
  intent: ParsedIntent;
  questions_generated: number;
  products_found: number;
  engine_version: string;
  processing_time_ms: number;
  error?: string;
}
