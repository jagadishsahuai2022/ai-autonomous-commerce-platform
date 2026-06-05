/**
 * GET /api/admin/validation-data
 *
 * Returns real validation session data from the ValidationSession table,
 * enriched with real user and query data from the database.
 *
 * Admin/analytics role required.
 */
import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';

export const runtime = 'nodejs';

const ELEVATED_ROLES = new Set(['admin', 'analytics']);

async function resolveAdminUser(req: NextRequest) {
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  try {
    return await queryOne<{ userId: number; email: string; role: string }>(
      `SELECT s."userId", u.email, u.role FROM "UserSession" s
       JOIN "User" u ON u.id = s."userId"
       WHERE s."sessionToken" = $1 AND s."expiresAt" > NOW() LIMIT 1`,
      [token]
    );
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const caller = await resolveAdminUser(req);
    if (!caller || !ELEVATED_ROLES.has(caller.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Fetch real validation sessions from DB
    let dbSessions: any[] = [];
    try {
      dbSessions = await query(
        `SELECT vs.id, vs."userId", vs."userExternalId", vs."userEmail",
                vs."queryText", vs."sessionSource", vs."productsJson",
                vs."timelineJson", vs."feedbackJson", vs."metricsJson", vs."createdAt",
                u.name as "userName", u.email as "resolvedEmail", u.role as "userRole"
         FROM "ValidationSession" vs
         LEFT JOIN "User" u ON u.id = vs."userId"
         ORDER BY vs."createdAt" DESC LIMIT 200`,
        []
      );
    } catch {
      /* table may not exist or have data yet */
    }

    // 2. Fetch real query count from SmartIntentEngineResponse
    let realQueriesCount = 0;
    try {
      const countRow = await queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM "SmartIntentEngineResponse" WHERE "isActive" = true`,
        []
      );
      realQueriesCount = parseInt(countRow?.count ?? '0', 10);
    } catch {
      /* table may not exist */
    }

    const allSessions = dbSessions.map((s) => ({ ...s, isSynthetic: false }));

    return NextResponse.json({
      sessions: allSessions,
      realCount: dbSessions.length,
      syntheticCount: 0,
      realQueriesCount,
    });
  } catch (err: any) {
    console.error('[Validation Data API]', err.message);
    return NextResponse.json(
      {
        error: 'Failed to load validation data',
        sessions: [],
        realCount: 0,
        syntheticCount: 0,
      },
      { status: 500 }
    );
  }
}
