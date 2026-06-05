/**
 * Smart Intent Engine v2 — Main Orchestrator
 *
 * Entry point that chains all phases:
 * 1. Tokenize → 2. Extract entities → 3. Generate questions
 * 4. Search products (with fallback) → 5. Rank → 6. Generate response
 * 7. Async: trigger catalog enrichment (Phase 3)
 * 8. Feedback: apply boost scores (Phase 8)
 *
 * Wrapped in feature flag with fallback to v1.
 */

import { tokenize } from './tokenizer';
import { extractEntities } from './entity-extractor';
import { generateQuestions } from './question-generator';
import { searchWithFallback } from './search-engine';
import { rankProducts } from './ranking-engine';
import { generateResponse } from './response-generator';
import { isSmartIntentV2Enabled, logIntent, buildLogEntry } from './logger';
import { triggerAsyncCatalogEnrichment } from './async-catalog-generator';
import { getBatchFeedbackBoosts } from './feedback-tracker';
import type { IntentEngineResult, ParsedIntent, RankedProduct } from './types';

export type { IntentEngineResult, ParsedIntent };

// Re-export utilities for use in routes
export { isSmartIntentV2Enabled } from './logger';
export {
  getSyntheticCatalog,
  getCatalogStats,
  getSyntheticBrands,
  getSyntheticPriceRange,
} from './synthetic-catalog';
export { generateQuestions } from './question-generator';
export { searchProducts, searchWithFallback } from './search-engine';
export { rankProducts } from './ranking-engine';
export { rankProductsAsync } from './ranking-engine';
export { generateResponse } from './response-generator';
export { tokenize } from './tokenizer';
export { extractEntities } from './entity-extractor';
export { getRecentLogs } from './logger';
export {
  getPriceBand,
  buildSearchIndex,
  buildSpecifications,
  CATEGORY_ALIASES,
  BUDGET_BUCKETS,
} from './data-enrichment';
// Phase 3+9+10: Async catalog enrichment (feature-flagged)
export {
  triggerAsyncCatalogEnrichment,
  getCatalogProductCount,
  getCatalogSummary,
  getEnrichmentHistory,
} from './async-catalog-generator';
// Phase 8: Feedback loop
export {
  recordFeedbackEvent,
  getFeedbackBoost,
  getBatchFeedbackBoosts,
  recordIgnoredProducts,
  getRecentFeedbackEvents,
  getTopProductSignals,
} from './feedback-tracker';
// Phase 5: Product explanations
export { explainProduct, removeBrandPrefix } from './explain-product';
// Phase 6: DB product bridge
export { fetchDBProducts, isDBProductId, mergeProducts } from './db-product-bridge';
export type { FetchDBProductsOpts } from './db-product-bridge';
// Phase 9: Product learning (reinforcement)
export {
  recordLearningEvent,
  recordImpressions,
  getLearningBoost,
  getBatchLearningBoosts,
  getTrendingProducts,
  getLearningStats,
} from './product-learning';
// Phase 10: Session personalization
export {
  recordProductView,
  recordCategoryBrowse,
  getSessionBoost,
  getTopSessionCategories,
  getTopSessionBrands,
  getRecentlyViewedIds,
  getSessionPriceRange,
  getSessionUserContext,
  clearSessionContext,
} from './session-personalization';
// Phase 11: Business metrics + scoring
export {
  generateMetrics,
  getMetrics,
  getBatchMetrics,
  updateMetricsFromEvent,
  clearMetrics,
} from './business-metrics';
export {
  computeBusinessScore,
  blendScores,
  USER_WEIGHT,
  BUSINESS_WEIGHT,
} from './business-scoring';
// Phase 12: Dynamic pricing + discount engine
export {
  computeDynamicPrice,
  computeDiscount,
  applyIntentDiscount,
  clearSessionPriceCache,
  getSessionPriceCacheSize,
} from './pricing-engine';

/**
 * Process a user query through the full Smart Intent Engine v2 pipeline.
 *
 * @param query - Raw user input string
 * @param engineOverride - Optional: 'v1' or 'v2' to force engine version
 * @returns IntentEngineResult with full processing output
 */
export function processQuery(query: string, engineOverride?: string | null): IntentEngineResult {
  const startTime = Date.now();

  // Feature flag check
  if (!isSmartIntentV2Enabled(engineOverride)) {
    // Return a minimal stub that signals v1 should be used
    return {
      intent: {
        category: null,
        brand: null,
        budget: null,
        use_case: null,
        features: [],
        confidence: 0,
        raw_tokens: [],
        matched_entities: [],
      },
      questions: [],
      products: [],
      response: { text: '', confidence_level: 'low', follow_up_prompt: null },
      initial_text: '',
      engine_version: 'v1',
      processing_time_ms: 0,
    };
  }

  try {
    // Phase 1: Tokenize & Extract entities
    const { tokens, normalized } = tokenize(query);
    const intent = extractEntities(tokens, normalized);

    // Phase 2: Generate dynamic questions
    const questions = generateQuestions(intent);

    // Phase 3+4: Search with progressive fallback (never returns cross-category results)
    const searchResults = searchWithFallback(intent, 20);
    let rankedProducts = rankProducts(searchResults, intent);

    // Phase 8: Apply feedback boost scores to re-rank
    if (rankedProducts.length > 0) {
      const productIds = rankedProducts.map((p) => p.id);
      const boosts = getBatchFeedbackBoosts(productIds);

      if (boosts.size > 0) {
        rankedProducts = rankedProducts
          .map((p) => {
            const boost = boosts.get(p.id) ?? 0;
            return boost !== 0
              ? { ...p, relevanceScore: Math.max(0, p.relevanceScore + boost) }
              : p;
          })
          .sort((a, b) => b.relevanceScore - a.relevanceScore);
      }
    }

    // Phase 5: Generate response
    const response = generateResponse(intent, rankedProducts);

    const processingTime = Date.now() - startTime;

    // Phase 8: Logging
    const logEntry = buildLogEntry(query, intent, rankedProducts.length, processingTime);
    logEntry.questions_generated = questions.length;
    logIntent(logEntry);

    // Phase 3+9+10: Async catalog enrichment — NEVER blocks response
    setImmediate
      ? setImmediate(() => triggerAsyncCatalogEnrichment(intent.category))
      : setTimeout(() => triggerAsyncCatalogEnrichment(intent.category), 0);

    return {
      intent,
      questions,
      products: rankedProducts,
      response,
      initial_text: response.text,
      engine_version: 'v2',
      processing_time_ms: processingTime,
    };
  } catch (error) {
    const processingTime = Date.now() - startTime;

    // Log the error
    const errorIntent: ParsedIntent = {
      category: null,
      brand: null,
      budget: null,
      use_case: null,
      features: [],
      confidence: 0,
      raw_tokens: [],
      matched_entities: [],
    };
    logIntent(buildLogEntry(query, errorIntent, 0, processingTime, String(error)));

    // Fallback: signal v1 should handle it
    console.error('[SmartIntent v2] Error, falling back to v1:', error);
    return {
      intent: errorIntent,
      questions: [],
      products: [],
      response: { text: '', confidence_level: 'low', follow_up_prompt: null },
      initial_text: '',
      engine_version: 'v1', // signal fallback
      processing_time_ms: processingTime,
    };
  }
}
