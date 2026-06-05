import { NextRequest, NextResponse } from 'next/server';
import { validateSession, query, queryOne } from '@/lib/db';

function getToken(req: NextRequest): string {
  const auth = req.headers.get('authorization') || '';
  return auth.replace('Bearer ', '').trim() || req.cookies.get('authToken')?.value || '';
}

/**
 * GET /api/admin/learning-insights — Dashboard data for the learning system.
 */
export async function GET(req: NextRequest) {
  try {
    const token = getToken(req);
    const session = token ? await validateSession(token) : null;
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await queryOne(`SELECT role FROM "User" WHERE id = $1`, [session.userId]);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Ranking event stats (last 30 days)
    const eventStats = await queryOne(
      `SELECT
         COUNT(*) as total_events,
         COUNT(CASE WHEN "clickedProductIds" IS NOT NULL AND array_length("clickedProductIds", 1) > 0 THEN 1 END) as events_with_clicks,
         COUNT(CASE WHEN "purchasedProductIds" IS NOT NULL AND array_length("purchasedProductIds", 1) > 0 THEN 1 END) as events_with_purchases,
         COUNT(CASE WHEN bounced = true THEN 1 END) as bounced_events,
         AVG("responseTimeMs") as avg_response_time,
         AVG("totalResults") as avg_results_per_query
       FROM "RankingEventLog"
       WHERE "rankedAt" > NOW() - INTERVAL '30 days'`
    );

    // Dimension effectiveness
    const effectiveness = await query(
      `SELECT "dimensionKey", "clickCorrelation", "purchaseCorrelation",
              "predictivePower", "currentWeight", "suggestedWeight", "sampleCount"
       FROM "DimensionEffectiveness"
       WHERE "periodEnd" > NOW() - INTERVAL '7 days'
       ORDER BY "predictivePower" DESC`
    );

    // Recent audit trail
    const recentAudits = await query(
      `SELECT "snapshotId", "changedBy", "changeSource", "changeReason", "createdAt"
       FROM "ScoringDimensionAudit"
       ORDER BY "createdAt" DESC
       LIMIT 20`
    );

    // Latest optimization job
    const latestJob = await queryOne(
      `SELECT "jobId", status, "progressPercent", "currentPhase",
              "performanceMetrics", applied, "startedAt", "completedAt"
       FROM "OptimizationJob"
       ORDER BY "startedAt" DESC
       LIMIT 1`
    );

    // Daily event trends (last 14 days)
    const dailyTrends = await query(
      `SELECT DATE("rankedAt") as day,
              COUNT(*) as events,
              COUNT(CASE WHEN "clickedProductIds" IS NOT NULL AND array_length("clickedProductIds", 1) > 0 THEN 1 END) as clicks,
              COUNT(CASE WHEN "purchasedProductIds" IS NOT NULL AND array_length("purchasedProductIds", 1) > 0 THEN 1 END) as purchases
       FROM "RankingEventLog"
       WHERE "rankedAt" > NOW() - INTERVAL '14 days'
       GROUP BY DATE("rankedAt")
       ORDER BY day DESC`
    );

    return NextResponse.json({
      eventStats: eventStats || {},
      effectiveness: effectiveness || [],
      recentAudits: recentAudits || [],
      latestJob: latestJob || null,
      dailyTrends: dailyTrends || [],
    });
  } catch (err: any) {
    console.error('[learning-insights GET]', err.message);
    return NextResponse.json({ error: 'Failed to load insights' }, { status: 500 });
  }
}
