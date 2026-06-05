import { NextRequest, NextResponse } from 'next/server';
import { validateSession, query, queryOne } from '@/lib/db';

function getToken(req: NextRequest): string {
  const auth = req.headers.get('authorization') || '';
  return auth.replace('Bearer ', '').trim() || req.cookies.get('authToken')?.value || '';
}

/**
 * POST /api/admin/optimize-weights — Trigger a weight optimization job.
 * GET  /api/admin/optimize-weights — Get current/latest job status.
 */

export async function POST(req: NextRequest) {
  try {
    const token = getToken(req);
    const session = token ? await validateSession(token) : null;
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await queryOne(`SELECT role FROM "User" WHERE id = $1`, [session.userId]);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Check for already running job
    const running = await queryOne(
      `SELECT "jobId", status FROM "OptimizationJob" WHERE status IN ('pending', 'running') ORDER BY "startedAt" DESC LIMIT 1`
    );
    if (running) {
      return NextResponse.json({ error: 'An optimization job is already running', jobId: running.jobId }, { status: 409 });
    }

    // Get current weights as baseline
    const currentDims = await query(
      `SELECT key, weightage, "group" FROM "ScoringDimension" WHERE "isActive" = true ORDER BY "sortOrder"`
    );
    const currentWeights: Record<string, number> = {};
    for (const d of currentDims as any[]) {
      currentWeights[d.key] = d.weightage;
    }

    // Get ranking event stats for optimization
    const eventStats = await queryOne(
      `SELECT COUNT(*) as total,
              COUNT(CASE WHEN "clickedProductIds" IS NOT NULL AND array_length("clickedProductIds", 1) > 0 THEN 1 END) as with_clicks,
              COUNT(CASE WHEN "purchasedProductIds" IS NOT NULL AND array_length("purchasedProductIds", 1) > 0 THEN 1 END) as with_purchases
       FROM "RankingEventLog"
       WHERE "rankedAt" > NOW() - INTERVAL '30 days'`
    );

    const totalEvents = parseInt(eventStats?.total || '0');
    if (totalEvents < 50) {
      return NextResponse.json({
        error: `Insufficient data for optimization. Need at least 50 ranking events, found ${totalEvents}.`,
      }, { status: 400 });
    }

    // Create optimization job
    const jobRow = await queryOne(
      `INSERT INTO "OptimizationJob" ("triggeredBy", status, "progressPercent", "currentPhase")
       VALUES ($1, 'pending', 0, 'initializing')
       RETURNING "jobId", status, "startedAt"`,
      [session.userId]
    );

    // Run optimization asynchronously (non-blocking)
    setImmediate(() => runOptimization(jobRow.jobId, currentWeights, totalEvents).catch(console.error));

    return NextResponse.json({
      jobId: jobRow.jobId,
      status: 'pending',
      message: `Optimization started with ${totalEvents} ranking events`,
    });
  } catch (err: any) {
    console.error('[optimize-weights POST]', err.message);
    return NextResponse.json({ error: 'Failed to start optimization' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const token = getToken(req);
    const session = token ? await validateSession(token) : null;
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const job = await queryOne(
      `SELECT "jobId", "triggeredBy", status, "progressPercent", "currentPhase",
              "optimizedWeights", "weightChanges", "performanceMetrics",
              applied, "startedAt", "completedAt", "errorMessage"
       FROM "OptimizationJob"
       ORDER BY "startedAt" DESC
       LIMIT 1`
    );

    if (!job) {
      return NextResponse.json({ job: null, message: 'No optimization jobs found' });
    }

    return NextResponse.json({ job });
  } catch (err: any) {
    console.error('[optimize-weights GET]', err.message);
    return NextResponse.json({ error: 'Failed to get job status' }, { status: 500 });
  }
}

// ── Optimization logic (runs asynchronously) ────────────────────────────────

async function runOptimization(
  jobId: string,
  currentWeights: Record<string, number>,
  totalEvents: number
): Promise<void> {
  try {
    // Phase 1: Collecting data
    await query(
      `UPDATE "OptimizationJob" SET status = 'running', "progressPercent" = 10, "currentPhase" = 'collecting_data' WHERE "jobId" = $1`,
      [jobId]
    );

    // Get ranking events with outcomes
    const events = await query(
      `SELECT id, products, "clickedProductIds", "cartedProductIds", "purchasedProductIds", "outcomeType"
       FROM "RankingEventLog"
       WHERE "rankedAt" > NOW() - INTERVAL '30 days'
         AND "clickedProductIds" IS NOT NULL
         AND array_length("clickedProductIds", 1) > 0
       ORDER BY "rankedAt" DESC
       LIMIT 5000`
    ) as any[];

    // Phase 2: Computing correlations
    await query(
      `UPDATE "OptimizationJob" SET "progressPercent" = 30, "currentPhase" = 'computing_correlations' WHERE "jobId" = $1`,
      [jobId]
    );

    // Analyze which dimensions correlate with clicks/purchases
    const dimensionClickCorrelations: Record<string, number[]> = {};
    const dimensionPurchaseCorrelations: Record<string, number[]> = {};

    for (const event of events) {
      const products = typeof event.products === 'string' ? JSON.parse(event.products) : event.products;
      if (!Array.isArray(products)) continue;

      const clickedIds = new Set((event.clickedProductIds || []).map(String));
      const purchasedIds = new Set((event.purchasedProductIds || []).map(String));

      for (const p of products) {
        const scores = p.dimensionScores || {};
        const wasClicked = clickedIds.has(String(p.productId));
        const wasPurchased = purchasedIds.has(String(p.productId));

        for (const [dimKey, score] of Object.entries(scores)) {
          if (!dimensionClickCorrelations[dimKey]) dimensionClickCorrelations[dimKey] = [];
          if (!dimensionPurchaseCorrelations[dimKey]) dimensionPurchaseCorrelations[dimKey] = [];
          dimensionClickCorrelations[dimKey].push(wasClicked ? (score as number) : 0);
          dimensionPurchaseCorrelations[dimKey].push(wasPurchased ? (score as number) : 0);
        }
      }
    }

    // Phase 3: Optimizing weights
    await query(
      `UPDATE "OptimizationJob" SET "progressPercent" = 60, "currentPhase" = 'optimizing_weights' WHERE "jobId" = $1`,
      [jobId]
    );

    // Simple gradient-free optimization: dimensions with higher click/purchase correlation get more weight
    const optimizedWeights: Record<string, number> = { ...currentWeights };
    const weightChanges: Record<string, { before: number; after: number; delta: number }> = {};

    const allDimKeys = Object.keys(currentWeights);
    const correlationScores: Record<string, number> = {};

    for (const dimKey of allDimKeys) {
      const clickCorr = dimensionClickCorrelations[dimKey];
      const purchaseCorr = dimensionPurchaseCorrelations[dimKey];

      let score = 0;
      if (clickCorr && clickCorr.length > 10) {
        const mean = clickCorr.reduce((a, b) => a + b, 0) / clickCorr.length;
        score += mean * 0.4; // click correlation weight
      }
      if (purchaseCorr && purchaseCorr.length > 10) {
        const mean = purchaseCorr.reduce((a, b) => a + b, 0) / purchaseCorr.length;
        score += mean * 0.6; // purchase correlation weight (higher importance)
      }
      correlationScores[dimKey] = score;
    }

    // Normalize correlation scores to sum to 1.0
    const totalCorrelation = Object.values(correlationScores).reduce((a, b) => a + b, 0);
    if (totalCorrelation > 0) {
      for (const dimKey of allDimKeys) {
        // Blend: 60% current weight + 40% data-driven suggestion (conservative)
        const dataDriven = (correlationScores[dimKey] || 0) / totalCorrelation;
        const blended = currentWeights[dimKey] * 0.6 + dataDriven * 0.4;

        // Get min/max bounds from DB
        const dimRow = await queryOne(
          `SELECT "minWeightage", "maxWeightage" FROM "ScoringDimension" WHERE key = $1`,
          [dimKey]
        );
        const minW = dimRow?.minWeightage ?? 0.0;
        const maxW = dimRow?.maxWeightage ?? 0.25;

        optimizedWeights[dimKey] = Math.max(minW, Math.min(maxW, blended));
      }

      // Re-normalize to sum to 1.0
      const total = Object.values(optimizedWeights).reduce((a, b) => a + b, 0);
      for (const k of Object.keys(optimizedWeights)) {
        optimizedWeights[k] = Math.round((optimizedWeights[k] / total) * 10000) / 10000;
      }

      // Compute changes
      for (const k of allDimKeys) {
        const before = currentWeights[k] || 0;
        const after = optimizedWeights[k] || 0;
        weightChanges[k] = { before, after, delta: Math.round((after - before) * 10000) / 10000 };
      }
    }

    // Phase 4: Validating
    await query(
      `UPDATE "OptimizationJob" SET "progressPercent" = 85, "currentPhase" = 'validating' WHERE "jobId" = $1`,
      [jobId]
    );

    const performanceMetrics = {
      eventsAnalyzed: events.length,
      totalRankingEvents: totalEvents,
      avgClickRate: events.length > 0 ? events.filter(e => e.clickedProductIds?.length > 0).length / events.length : 0,
      avgPurchaseRate: events.length > 0 ? events.filter(e => e.purchasedProductIds?.length > 0).length / events.length : 0,
      dimensionsOptimized: allDimKeys.length,
      maxWeightShift: Math.max(...Object.values(weightChanges).map(c => Math.abs(c.delta)), 0),
    };

    // Complete
    await query(
      `UPDATE "OptimizationJob"
       SET status = 'completed', "progressPercent" = 100, "currentPhase" = 'done',
           "optimizedWeights" = $1, "weightChanges" = $2, "performanceMetrics" = $3,
           "completedAt" = NOW()
       WHERE "jobId" = $4`,
      [JSON.stringify(optimizedWeights), JSON.stringify(weightChanges), JSON.stringify(performanceMetrics), jobId]
    );
  } catch (err: any) {
    console.error('[optimize-weights] optimization failed:', err.message);
    await query(
      `UPDATE "OptimizationJob" SET status = 'failed', "errorMessage" = $1, "completedAt" = NOW() WHERE "jobId" = $2`,
      [err.message, jobId]
    ).catch(() => {});
  }
}
