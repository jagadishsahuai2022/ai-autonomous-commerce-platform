import { NextRequest, NextResponse } from 'next/server';
import { validateSession, query, queryOne } from '@/lib/db';

function getToken(req: NextRequest): string {
  const auth = req.headers.get('authorization') || '';
  return auth.replace('Bearer ', '').trim() || req.cookies.get('authToken')?.value || '';
}

/**
 * POST /api/admin/optimize-weights/apply — Apply or discard optimized weights.
 * Body: { jobId: string, action: 'apply' | 'discard' }
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

    const body = await req.json();
    const { jobId, action } = body;
    if (!jobId || !['apply', 'discard'].includes(action)) {
      return NextResponse.json({ error: 'jobId and action (apply|discard) required' }, { status: 400 });
    }

    const job = await queryOne(
      `SELECT "jobId", status, "optimizedWeights", applied FROM "OptimizationJob" WHERE "jobId" = $1`,
      [jobId]
    );

    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    if (job.status !== 'completed') return NextResponse.json({ error: 'Job is not completed' }, { status: 400 });
    if (job.applied) return NextResponse.json({ error: 'Weights already applied' }, { status: 400 });

    if (action === 'discard') {
      await query(
        `UPDATE "OptimizationJob" SET applied = false, "currentPhase" = 'discarded' WHERE "jobId" = $1`,
        [jobId]
      );
      return NextResponse.json({ success: true, message: 'Optimization discarded' });
    }

    // Apply optimized weights
    const optimizedWeights = typeof job.optimizedWeights === 'string'
      ? JSON.parse(job.optimizedWeights)
      : job.optimizedWeights;

    if (!optimizedWeights || typeof optimizedWeights !== 'object') {
      return NextResponse.json({ error: 'No optimized weights in job' }, { status: 400 });
    }

    // Create audit snapshot before applying
    const currentSnapshot = await query(
      `SELECT id, key, label, weightage, "isActive" FROM "ScoringDimension" ORDER BY "sortOrder" ASC`
    );
    await query(
      `INSERT INTO "ScoringDimensionAudit" ("changedBy", "changeSource", "changeReason", "snapshot", "previousSnapshot")
       VALUES ($1, $2, $3, $4, $5)`,
      [
        session.userId,
        'ml_optimization',
        `Applied optimization job ${jobId}`,
        JSON.stringify(optimizedWeights),
        JSON.stringify(currentSnapshot),
      ]
    );

    // Update each dimension's weight
    for (const [dimKey, weight] of Object.entries(optimizedWeights)) {
      await query(
        `UPDATE "ScoringDimension" SET weightage = $1, "updatedAt" = NOW(), version = version + 1 WHERE key = $2`,
        [weight, dimKey]
      );
    }

    // Mark job as applied
    await query(
      `UPDATE "OptimizationJob" SET applied = true, "currentPhase" = 'applied' WHERE "jobId" = $1`,
      [jobId]
    );

    // Invalidate server-side cache
    try {
      const { invalidateDimensionCache } = require('@/lib/scoring/dimension-weights');
      invalidateDimensionCache();
    } catch { /* ignore */ }

    const rows = await query(
      `SELECT id, key, label, weightage, description, "isActive", "sortOrder",
              "group", "scorerKey", "isNegative", "minWeightage", "maxWeightage"
       FROM "ScoringDimension"
       WHERE "isActive" = true
       ORDER BY "sortOrder" ASC`
    );

    return NextResponse.json({
      success: true,
      message: 'Optimized weights applied successfully',
      dimensions: rows,
    });
  } catch (err: any) {
    console.error('[optimize-weights/apply POST]', err.message);
    return NextResponse.json({ error: 'Failed to apply optimization' }, { status: 500 });
  }
}
