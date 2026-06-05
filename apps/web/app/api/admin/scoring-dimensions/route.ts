import { NextRequest, NextResponse } from 'next/server';
import { validateSession, query, queryOne } from '@/lib/db';

function getToken(req: NextRequest): string {
  const auth = req.headers.get('authorization') || '';
  return auth.replace('Bearer ', '').trim() || req.cookies.get('authToken')?.value || '';
}

export async function GET() {
  try {
    const rows = await query(
      `SELECT id, key, label, weightage, description, "isActive", "sortOrder",
              "group", "scorerKey", "isNegative", "minWeightage", "maxWeightage"
       FROM "ScoringDimension"
       WHERE "isActive" = true
       ORDER BY "sortOrder" ASC`
    );
    return NextResponse.json({ dimensions: rows });
  } catch (err: any) {
    console.error('[scoring-dimensions GET]', err.message);
    return NextResponse.json({ dimensions: [], error: 'Failed to load dimensions' }, { status: 200 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const token = getToken(req);
    const session = token ? await validateSession(token) : null;
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await queryOne(`SELECT role FROM "User" WHERE id = $1`, [session.userId]);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { dimensions } = body;
    if (!Array.isArray(dimensions)) return NextResponse.json({ error: 'dimensions array required' }, { status: 400 });

    // Validate total weightage sums to 1.0 (within tolerance)
    const totalWeight = dimensions.reduce((sum: number, d: any) => sum + (d.weightage || 0), 0);
    if (Math.abs(totalWeight - 1.0) > 0.01) {
      return NextResponse.json({ error: `Total weightage must equal 100%. Current: ${(totalWeight * 100).toFixed(1)}%` }, { status: 400 });
    }

    // R59: Create audit snapshot before updating
    try {
      const currentSnapshot = await query(
        `SELECT id, key, label, weightage, "isActive", "group", "scorerKey" FROM "ScoringDimension" ORDER BY "sortOrder" ASC`
      );
      await query(
        `INSERT INTO "ScoringDimensionAudit" ("changedBy", "changeSource", "changeReason", "snapshot", "previousSnapshot")
         VALUES ($1, $2, $3, $4, $5)`,
        [
          session.userId,
          'admin_ui',
          body.reason || 'Manual weight update',
          JSON.stringify(dimensions),
          JSON.stringify(currentSnapshot),
        ]
      );
    } catch (auditErr) {
      // Audit failure should not block the update
      console.warn('[scoring-dimensions PUT] audit snapshot failed:', (auditErr as Error).message);
    }

    // Update each dimension
    for (const dim of dimensions) {
      if (!dim.id) continue;
      await query(
        `UPDATE "ScoringDimension"
         SET weightage = $1, label = $2, description = $3, "isActive" = $4, "sortOrder" = $5,
             "group" = COALESCE($6, "group"), "scorerKey" = COALESCE($7, "scorerKey"),
             "isNegative" = COALESCE($8, "isNegative"),
             "minWeightage" = COALESCE($9, "minWeightage"), "maxWeightage" = COALESCE($10, "maxWeightage"),
             "updatedAt" = NOW(), version = version + 1
         WHERE id = $11`,
        [
          dim.weightage, dim.label, dim.description || null,
          dim.isActive !== false, dim.sortOrder || 0,
          dim.group || null, dim.scorerKey || null,
          dim.isNegative ?? null, dim.minWeightage ?? null, dim.maxWeightage ?? null,
          dim.id,
        ]
      );
    }

    // R59: Invalidate server-side dimension cache
    try {
      const { invalidateDimensionCache } = require('@/lib/scoring/dimension-weights');
      invalidateDimensionCache();
    } catch { /* ignore if module not available */ }

    const rows = await query(
      `SELECT id, key, label, weightage, description, "isActive", "sortOrder",
              "group", "scorerKey", "isNegative", "minWeightage", "maxWeightage"
       FROM "ScoringDimension"
       WHERE "isActive" = true
       ORDER BY "sortOrder" ASC`
    );
    return NextResponse.json({ dimensions: rows, success: true });
  } catch (err: any) {
    console.error('[scoring-dimensions PUT]', err.message);
    return NextResponse.json({ error: 'Failed to update dimensions' }, { status: 500 });
  }
}

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
    const { key, label, weightage, description } = body;
    if (!key || !label) return NextResponse.json({ error: 'key and label required' }, { status: 400 });

    const maxOrder = await queryOne(`SELECT COALESCE(MAX("sortOrder"), 0) + 1 as next FROM "ScoringDimension"`);
    const row = await queryOne(
      `INSERT INTO "ScoringDimension" (key, label, weightage, description, "sortOrder") VALUES ($1, $2, $3, $4, $5) ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label, weightage = EXCLUDED.weightage, description = EXCLUDED.description, "updatedAt" = NOW() RETURNING *`,
      [key, label, weightage || 0.10, description || null, maxOrder?.next || 10]
    );
    return NextResponse.json({ dimension: row }, { status: 201 });
  } catch (err: any) {
    console.error('[scoring-dimensions POST]', err.message);
    return NextResponse.json({ error: 'Failed to create dimension' }, { status: 500 });
  }
}
