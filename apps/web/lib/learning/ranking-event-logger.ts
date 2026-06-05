/**
 * Ranking Event Logger — Captures every ranking decision for learning.
 *
 * Writes to RankingEventLog table asynchronously (non-blocking).
 * Supports outcome stitching: subsequent user events (click, cart, purchase)
 * update the original ranking event row.
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

export interface RankingEventProduct {
  productId: string | number;
  position: number;
  finalScore: number;
  dimensionScores: Record<string, number>;
  price: number;
  category: string;
  brand: string;
}

export interface LogRankingEventParams {
  sessionId: string;
  userId?: number;
  query: string;
  engineVersion: string;
  dimensionSnapshotId?: string;
  products: RankingEventProduct[];
  parsedIntent?: unknown;
  responseTimeMs?: number;
  deviceType?: string;
}

/**
 * Log a ranking event asynchronously. Returns the event ID for outcome stitching.
 */
export async function logRankingEvent(params: LogRankingEventParams): Promise<number | null> {
  try {
    const query = await getQueryFn();
    if (!query) return null;

    // Only log top 50 products for storage efficiency
    const topProducts = params.products.slice(0, 50);

    const rows = await query(
      `INSERT INTO "RankingEventLog"
        ("sessionId", "userId", "query", "engineVersion", "dimensionSnapshotId",
         "totalResults", "products", "parsedIntent", "responseTimeMs", "deviceType")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        params.sessionId,
        params.userId || null,
        params.query,
        params.engineVersion,
        params.dimensionSnapshotId || null,
        params.products.length,
        JSON.stringify(topProducts),
        params.parsedIntent ? JSON.stringify(params.parsedIntent) : null,
        params.responseTimeMs || null,
        params.deviceType || null,
      ]
    );
    return (rows as { id: number }[])?.[0]?.id ?? null;
  } catch (err) {
    console.error('[ranking-event-logger] Failed to log event:', (err as Error).message);
    return null;
  }
}

/**
 * Stitch a click event back to the ranking event log.
 */
export async function stitchClickEvent(
  rankingEventId: number,
  productId: number,
  position: number
): Promise<void> {
  try {
    const query = await getQueryFn();
    if (!query) return;
    await query(
      `UPDATE "RankingEventLog"
       SET "clickedProductIds" = array_append("clickedProductIds", $1),
           "clickPositions" = array_append("clickPositions", $2)
       WHERE id = $3`,
      [productId, position, rankingEventId]
    );
  } catch (err) {
    console.error('[ranking-event-logger] stitch click failed:', (err as Error).message);
  }
}

/**
 * Stitch a cart event back to the ranking event log.
 */
export async function stitchCartEvent(
  rankingEventId: number,
  productId: number
): Promise<void> {
  try {
    const query = await getQueryFn();
    if (!query) return;
    await query(
      `UPDATE "RankingEventLog"
       SET "cartedProductIds" = array_append("cartedProductIds", $1)
       WHERE id = $2`,
      [productId, rankingEventId]
    );
  } catch (err) {
    console.error('[ranking-event-logger] stitch cart failed:', (err as Error).message);
  }
}

/**
 * Stitch a purchase event back to the ranking event log.
 */
export async function stitchPurchaseEvent(
  rankingEventId: number,
  productId: number
): Promise<void> {
  try {
    const query = await getQueryFn();
    if (!query) return;
    await query(
      `UPDATE "RankingEventLog"
       SET "purchasedProductIds" = array_append("purchasedProductIds", $1),
           "outcomeType" = 'purchase'
       WHERE id = $2`,
      [productId, rankingEventId]
    );
  } catch (err) {
    console.error('[ranking-event-logger] stitch purchase failed:', (err as Error).message);
  }
}

/**
 * Mark a ranking event as bounced.
 */
export async function stitchBounceEvent(rankingEventId: number): Promise<void> {
  try {
    const query = await getQueryFn();
    if (!query) return;
    await query(
      `UPDATE "RankingEventLog" SET "bounced" = true, "outcomeType" = 'bounce' WHERE id = $1`,
      [rankingEventId]
    );
  } catch (err) {
    console.error('[ranking-event-logger] stitch bounce failed:', (err as Error).message);
  }
}

/**
 * Get recent ranking events for the learning dashboard.
 */
export async function getRecentRankingEvents(limit = 100): Promise<unknown[]> {
  try {
    const query = await getQueryFn();
    if (!query) return [];
    return await query(
      `SELECT id, "sessionId", "query", "engineVersion", "totalResults",
              "clickedProductIds", "cartedProductIds", "purchasedProductIds",
              "bounced", "rewardScore", "outcomeType", "responseTimeMs", "rankedAt"
       FROM "RankingEventLog"
       ORDER BY "rankedAt" DESC
       LIMIT $1`,
      [limit]
    );
  } catch {
    return [];
  }
}
