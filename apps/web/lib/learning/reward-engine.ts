/**
 * Reward Engine — Computes reward scores for ranking events based on outcomes.
 *
 * Reward formula:
 *   click = +1.0 per clicked product
 *   cart  = +3.0 per carted product
 *   purchase = +10.0 per purchased product
 *   bounce = -2.0
 *   position-weighted: early clicks worth more
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

const CLICK_REWARD = 1.0;
const CART_REWARD = 3.0;
const PURCHASE_REWARD = 10.0;
const BOUNCE_PENALTY = -2.0;

export function computeRewardScore(event: {
  clickedProductIds?: number[];
  clickPositions?: number[];
  cartedProductIds?: number[];
  purchasedProductIds?: number[];
  bounced?: boolean;
  totalResults?: number;
}): number {
  let reward = 0;

  // Clicks — position-weighted (clicking result #1 is worth less than clicking result #10)
  if (event.clickedProductIds?.length) {
    for (let i = 0; i < event.clickedProductIds.length; i++) {
      const position = event.clickPositions?.[i] ?? i;
      const positionMultiplier = 1 + Math.log10(position + 1) * 0.3; // higher position = higher reward
      reward += CLICK_REWARD * positionMultiplier;
    }
  }

  // Cart adds
  if (event.cartedProductIds?.length) {
    reward += event.cartedProductIds.length * CART_REWARD;
  }

  // Purchases
  if (event.purchasedProductIds?.length) {
    reward += event.purchasedProductIds.length * PURCHASE_REWARD;
  }

  // Bounce penalty
  if (event.bounced) {
    reward += BOUNCE_PENALTY;
  }

  return Math.round(reward * 100) / 100;
}

/**
 * Process unscored ranking events and assign reward scores.
 */
export async function processRankingRewards(): Promise<number> {
  const query = await getQueryFn();
  if (!query) return 0;

  try {
    const unscoredEvents = await query(
      `SELECT id, "clickedProductIds", "clickPositions", "cartedProductIds",
              "purchasedProductIds", bounced, "totalResults"
       FROM "RankingEventLog"
       WHERE "rewardScore" IS NULL
         AND "rankedAt" < NOW() - INTERVAL '5 minutes'
       LIMIT 500`
    ) as any[];

    let processed = 0;
    for (const event of unscoredEvents) {
      const reward = computeRewardScore(event);
      const outcomeType = event.purchasedProductIds?.length > 0 ? 'purchase'
        : event.cartedProductIds?.length > 0 ? 'cart'
        : event.clickedProductIds?.length > 0 ? 'click'
        : event.bounced ? 'bounce'
        : 'no_action';

      await query(
        `UPDATE "RankingEventLog" SET "rewardScore" = $1, "outcomeType" = $2 WHERE id = $3`,
        [reward, outcomeType, event.id]
      );
      processed++;
    }
    return processed;
  } catch (err) {
    console.error('[reward-engine] processRankingRewards failed:', (err as Error).message);
    return 0;
  }
}
