/**
 * Auto-Tuning Engine — Autonomous Weight Adjustment
 *
 * Reads performance signals (CTR, conversion, revenue) and adjusts
 * RankingWeights in-memory. DB sync happens on each decision.
 *
 * Rules:
 *   IF avgCTR < 0.05  → increase keywordWeight by 10%
 *   IF avgConv < 0.02 → increase relevanceWeight (feature+price) by 10%
 *   IF avgRev  < prev  → increase businessWeight by 10%
 *
 * Weights are bounded: [5, 50]
 */

import type { RankingWeightsConfig } from './autonomous-ranking';

export interface PerformanceSnapshot {
  avgCtr: number; // clicks / impressions
  avgConversion: number; // purchases / clicks
  avgRevenue: number; // revenue this window
  windowMs: number; // measurement window in ms
}

export interface TuningResult {
  weights: RankingWeightsConfig;
  adjustments: string[];
  version: number;
}

let _currentWeights: RankingWeightsConfig = {
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

let _version = 1;
let _prevRevenue = 0;

const MIN_WEIGHT = 5;
const MAX_WEIGHT = 50;
const TUNE_STEP = 0.1; // 10% adjustment

function clampWeight(w: number): number {
  return Math.min(MAX_WEIGHT, Math.max(MIN_WEIGHT, Math.round(w * 10) / 10));
}

function bump(w: number, factor: number): number {
  return clampWeight(w * (1 + factor));
}

export function tuneWeights(snapshot: PerformanceSnapshot): TuningResult {
  const adjustments: string[] = [];
  const w = { ..._currentWeights };

  // CTR too low → boost keyword matching
  if (snapshot.avgCtr < 0.05) {
    w.keywordWeight = bump(w.keywordWeight, TUNE_STEP);
    adjustments.push(`CTR=${snapshot.avgCtr.toFixed(3)} < 0.05 → keywordWeight→${w.keywordWeight}`);
  }

  // Conversion too low → boost relevance (feature + price fit)
  if (snapshot.avgConversion < 0.02) {
    w.featureWeight = bump(w.featureWeight, TUNE_STEP);
    w.priceFitWeight = bump(w.priceFitWeight, TUNE_STEP);
    adjustments.push(
      `conv=${snapshot.avgConversion.toFixed(3)} < 0.02 → feature→${w.featureWeight}, price→${w.priceFitWeight}`
    );
  }

  // Revenue declining → boost business signals
  if (_prevRevenue > 0 && snapshot.avgRevenue < _prevRevenue * 0.95) {
    w.businessWeight = bump(w.businessWeight, TUNE_STEP);
    adjustments.push(`revenue↓ → businessWeight→${w.businessWeight}`);
  }

  // Good CTR: slightly reward popularity
  if (snapshot.avgCtr > 0.12) {
    w.popularityWeight = bump(w.popularityWeight, TUNE_STEP / 2);
    adjustments.push(
      `CTR=${snapshot.avgCtr.toFixed(3)} high → popularityWeight→${w.popularityWeight}`
    );
  }

  _currentWeights = w;
  _prevRevenue = snapshot.avgRevenue;
  _version++;

  return { weights: { ..._currentWeights }, adjustments, version: _version };
}

export function getActiveWeights(): RankingWeightsConfig {
  return { ..._currentWeights };
}

export function setWeights(weights: Partial<RankingWeightsConfig>): void {
  _currentWeights = { ..._currentWeights, ...weights };
}

export function resetWeights(): void {
  _currentWeights = {
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
  _version = 1;
  _prevRevenue = 0;
}

export function getWeightsVersion(): number {
  return _version;
}
