/**
 * Smart Intent Engine — Business Score Calculator
 *
 * Computes a multi-objective business score based on:
 *   - Conversion rate (0–20 pts)
 *   - Margin (0–15 pts)
 *   - Inventory optimization (0–15 pts)
 *
 * Max possible: 50 pts. This is ADDED to user relevance, never replaces it.
 */

import type { ProductBusinessMetrics } from './business-metrics';

export interface BusinessScoreBreakdown {
  conversionScore: number;
  marginScore: number;
  inventoryScore: number;
  totalBusinessScore: number;
}

/**
 * Compute a multi-objective business score.
 * This score is blended with user relevance at a lower weight (30%).
 *
 * @param metrics - Business metrics for the product
 * @returns breakdown with individual and total scores
 */
export function computeBusinessScore(metrics: ProductBusinessMetrics): BusinessScoreBreakdown {
  let conversionScore = 0;
  let marginScore = 0;
  let inventoryScore = 0;

  // ── Conversion (0–20 pts) ──────────────────────────────────────────────
  // conversionRate is 0-1 (e.g., 0.05 = 5% conversion)
  // Scale: 0.05 → 1pt, 0.10 → 2pts, ... capped at 20
  conversionScore = Math.min(20, (metrics.conversionRate || 0.05) * 100 * 0.2);

  // ── Margin (0–15 pts) ──────────────────────────────────────────────────
  // marginPercentage is 0-100 (e.g., 30 = 30%)
  // Scale: 10% → 1.5pts, 30% → 4.5pts, 60% → 9pts, capped at 15
  marginScore = Math.min(15, (metrics.marginPercentage || 10) * 0.15);

  // ── Inventory optimization (0–15 pts) ──────────────────────────────────
  // Low stock = scarcity boost (urgency)
  // High stock = overstock boost (need to sell)
  // Normal stock = moderate
  if (metrics.inventoryCount < 5) {
    inventoryScore = 15; // scarcity boost — create urgency
  } else if (metrics.inventoryCount > 100) {
    inventoryScore = 10; // overstock boost — need to move
  } else {
    inventoryScore = 5; // normal stock
  }

  const totalBusinessScore = Math.round((conversionScore + marginScore + inventoryScore) * 10) / 10;

  return {
    conversionScore: Math.round(conversionScore * 10) / 10,
    marginScore: Math.round(marginScore * 10) / 10,
    inventoryScore,
    totalBusinessScore,
  };
}

// ── Blending constants ───────────────────────────────────────────────────────
// User relevance MUST dominate. Business score is supplementary.
export const USER_WEIGHT = 0.7;
export const BUSINESS_WEIGHT = 0.3;

/**
 * Blend user relevance score with business score.
 * Ensures user intent relevance always dominates.
 *
 * @param userScore - Score from Smart Intent ranking engine (0–130+)
 * @param businessScore - Score from computeBusinessScore (0–50)
 * @returns blended score
 */
export function blendScores(userScore: number, businessScore: number): number {
  return Math.round(userScore * USER_WEIGHT + businessScore * BUSINESS_WEIGHT);
}
