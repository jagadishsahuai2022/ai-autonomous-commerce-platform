/**
 * Dimension Effectiveness — Analyzes correlation between dimensions and outcomes.
 *
 * Computes Pearson correlation between each dimension's raw scores
 * and click/purchase outcomes across ranking events.
 */

let _queryFn: ((sql: string, params?: unknown[]) => Promise<unknown[]>) | null = null;

async function getQueryFn() {
  if (_queryFn) return _queryFn;
  try {
    const db = await import('../db');
    _queryFn = db.query;
    return _queryFn;
  } catch {
    return null;
  }
}

/**
 * Pearson correlation coefficient between two arrays.
 */
function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n < 5) return 0;

  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let denomX = 0;
  let denomY = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }

  const denom = Math.sqrt(denomX * denomY);
  return denom === 0 ? 0 : numerator / denom;
}

/**
 * Analyze effectiveness of each active dimension over a time period.
 * Writes results to DimensionEffectiveness table.
 */
export async function analyzeDimensionEffectiveness(
  periodDays = 7
): Promise<number> {
  const query = await getQueryFn();
  if (!query) return 0;

  try {
    // Get scored ranking events with product-level dimension scores
    const events = await query(
      `SELECT id, products, "clickedProductIds", "purchasedProductIds", "rewardScore"
       FROM "RankingEventLog"
       WHERE "rankedAt" > NOW() - INTERVAL '${periodDays} days'
         AND products IS NOT NULL
         AND "rewardScore" IS NOT NULL
       LIMIT 3000`
    ) as any[];

    if (events.length < 20) return 0;

    // Collect per-dimension score arrays
    const dimClickScores: Record<string, number[]> = {};
    const dimClickLabels: Record<string, number[]> = {};
    const dimPurchaseScores: Record<string, number[]> = {};
    const dimPurchaseLabels: Record<string, number[]> = {};

    for (const event of events) {
      const products = typeof event.products === 'string' ? JSON.parse(event.products) : event.products;
      if (!Array.isArray(products)) continue;

      const clickedIds = new Set((event.clickedProductIds || []).map(String));
      const purchasedIds = new Set((event.purchasedProductIds || []).map(String));

      for (const p of products) {
        const scores = p.dimensionScores;
        if (!scores || typeof scores !== 'object') continue;

        const wasClicked = clickedIds.has(String(p.productId)) ? 1 : 0;
        const wasPurchased = purchasedIds.has(String(p.productId)) ? 1 : 0;

        for (const [dimKey, score] of Object.entries(scores)) {
          if (typeof score !== 'number') continue;
          if (!dimClickScores[dimKey]) {
            dimClickScores[dimKey] = [];
            dimClickLabels[dimKey] = [];
            dimPurchaseScores[dimKey] = [];
            dimPurchaseLabels[dimKey] = [];
          }
          dimClickScores[dimKey].push(score);
          dimClickLabels[dimKey].push(wasClicked);
          dimPurchaseScores[dimKey].push(score);
          dimPurchaseLabels[dimKey].push(wasPurchased);
        }
      }
    }

    // Compute correlations and write to DB
    let written = 0;
    const periodStart = new Date(Date.now() - periodDays * 86400000).toISOString();
    const periodEnd = new Date().toISOString();

    // Get current weights
    const currentWeights = await query(
      `SELECT key, weightage FROM "ScoringDimension" WHERE "isActive" = true`
    ) as { key: string; weightage: number }[];
    const weightMap = Object.fromEntries(currentWeights.map(r => [r.key, r.weightage]));

    for (const dimKey of Object.keys(dimClickScores)) {
      const clickCorr = pearsonCorrelation(dimClickScores[dimKey], dimClickLabels[dimKey]);
      const purchaseCorr = pearsonCorrelation(dimPurchaseScores[dimKey], dimPurchaseLabels[dimKey]);
      const predictivePower = clickCorr * 0.4 + purchaseCorr * 0.6;
      const sampleCount = dimClickScores[dimKey].length;
      const currentWeight = weightMap[dimKey] ?? 0;

      // Suggest weight based on predictive power (normalized)
      const suggestedWeight = Math.max(0.01, Math.min(0.25, currentWeight + predictivePower * 0.05));

      await query(
        `INSERT INTO "DimensionEffectiveness"
          ("dimensionKey", "periodStart", "periodEnd", "clickCorrelation",
           "purchaseCorrelation", "predictivePower", "currentWeight",
           "suggestedWeight", "sampleCount")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT ("dimensionKey", "periodStart") DO UPDATE SET
           "clickCorrelation" = $4, "purchaseCorrelation" = $5,
           "predictivePower" = $6, "currentWeight" = $7,
           "suggestedWeight" = $8, "sampleCount" = $9`,
        [dimKey, periodStart, periodEnd, clickCorr, purchaseCorr, predictivePower, currentWeight, suggestedWeight, sampleCount]
      );
      written++;
    }

    return written;
  } catch (err) {
    console.error('[dimension-effectiveness] analysis failed:', (err as Error).message);
    return 0;
  }
}
