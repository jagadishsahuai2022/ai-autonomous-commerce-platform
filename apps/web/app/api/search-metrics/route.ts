/**
 * /api/search-metrics
 *
 * Stores and retrieves per-query validation session data from PostgreSQL.
 *
 * RBAC rules (enforced server-side):
 *  - admin / analytics : can read ALL users' sessions (full view for monitoring)
 *  - basic / aiplus    : can read ONLY their own sessions (own-data view)
 *  - unauthenticated   : 401
 *
 * POST  /api/search-metrics  — save a new search/ranking session
 * GET   /api/search-metrics  — fetch sessions (scoped by role)
 */

import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';

// Roles that may view every user's data
const ELEVATED_ROLES = new Set(['admin', 'analytics', 'observability']);

/** Resolve the current request's user + role from session token */
async function resolveRequestUser(req: NextRequest): Promise<{
  userId: number | null;
  email: string | null;
  role: string;
} | null> {
  const auth = req.headers.get('authorization') || '';
  const tokenRaw = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!tokenRaw) return null;

  try {
    // Our session token is stored in the UserSession table
    const session = await queryOne<{ userId: number; email: string; role: string; subscriptionPlan: string }>(
      `SELECT s."userId", u.email, u.role, u."subscriptionPlan"
         FROM "UserSession" s
         JOIN "User" u ON u.id = s."userId"
        WHERE s."sessionToken" = $1 AND s."expiresAt" > NOW()
        LIMIT 1`,
      [tokenRaw]
    );
    if (!session) return null;
    return { userId: session.userId, email: session.email, role: session.role };
  } catch {
    // Fallback if UserSession table not available — decode base64 mock JWT
    try {
      const payload = JSON.parse(Buffer.from(tokenRaw, 'base64').toString('utf8'));
      if (!payload?.userId || !payload?.email) return null;
      const user = await queryOne<{ id: number; email: string; role: string }>(
        `SELECT id, email, role FROM "User" WHERE id = $1 LIMIT 1`,
        [payload.userId]
      );
      if (!user) return null;
      return { userId: user.id, email: user.email, role: user.role || 'customer' };
    } catch {
      return null;
    }
  }
}

// ─── POST: save a session ────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      userExternalId,
      userEmail,
      queryText,
      sessionSource = 'smart-shopping-assistant',
      productsJson = [],
      timelineJson = null,
      feedbackJson = [],
      metricsJson = {},
    } = body ?? {};

    if (!userExternalId || !queryText) {
      return NextResponse.json({ error: 'userExternalId and queryText are required' }, { status: 400 });
    }

    // ── Dedup: skip insert if same userExternalId + queryText within last 60 seconds ──
    // Prevents duplicate rows when session is fired multiple times for same search
    const existing = await queryOne<{ id: number }>(
      `SELECT id FROM "ValidationSession"
        WHERE "userExternalId" = $1
          AND "queryText" = $2
          AND "sessionSource" = $3
          AND "createdAt" > NOW() - INTERVAL '60 seconds'
        LIMIT 1`,
      [userExternalId, queryText, sessionSource]
    );
    if (existing) {
      return NextResponse.json({ success: true, id: existing.id, deduplicated: true });
    }

    // Resolve DB userId if available
    const dbUser = userEmail
      ? await queryOne<{ id: number }>(`SELECT id FROM "User" WHERE email = $1 LIMIT 1`, [userEmail])
      : null;

    const rows = await query<{ id: number }>(
      `INSERT INTO "ValidationSession"
         ("userId", "userExternalId", "userEmail", "queryText", "sessionSource",
          "productsJson", "timelineJson", "feedbackJson", "metricsJson", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
       RETURNING id`,
      [
        dbUser?.id ?? null,
        userExternalId,
        userEmail ?? null,
        queryText,
        sessionSource,
        JSON.stringify(productsJson),
        timelineJson ? JSON.stringify(timelineJson) : null,
        JSON.stringify(feedbackJson),
        JSON.stringify(metricsJson),
      ]
    );

    return NextResponse.json({ success: true, id: rows[0]?.id ?? null });
  } catch (err: any) {
    console.error('[search-metrics POST]', err.message);
    return NextResponse.json({ error: 'Failed to save session' }, { status: 500 });
  }
}

// ─── GET: fetch sessions ─────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const caller = await resolveRequestUser(req);
    if (!caller) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const source = searchParams.get('source') || null;

    let sessions: any[];

    if (ELEVATED_ROLES.has(caller.role)) {
      // Admin / analytics — return ALL sessions, deduplicated by user+query+2s window
      sessions = await query(
        `SELECT DISTINCT ON (vs."userExternalId", vs."queryText", date_trunc('second', vs."createdAt"))
                vs.id, vs."userId", vs."userExternalId", vs."userEmail",
                vs."queryText", vs."sessionSource",
                vs."productsJson", vs."timelineJson", vs."feedbackJson", vs."metricsJson",
                vs."createdAt",
                u.email AS "resolvedEmail", u.role AS "userRole"
           FROM "ValidationSession" vs
           LEFT JOIN "User" u ON u.id = vs."userId"
          WHERE ($1::text IS NULL OR vs."sessionSource" = $1)
          ORDER BY vs."userExternalId", vs."queryText", date_trunc('second', vs."createdAt"), vs.id DESC`,
        [source]
      );
      // Re-sort by createdAt DESC and apply limit/offset after dedup
      sessions.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      sessions = sessions.slice(offset, offset + limit);
    } else {
      // Basic / aiplus — own sessions only, deduplicated
      sessions = await query(
        `SELECT DISTINCT ON (vs."userExternalId", vs."queryText", date_trunc('second', vs."createdAt"))
                vs.id, vs."userId", vs."userExternalId", vs."userEmail",
                vs."queryText", vs."sessionSource",
                vs."productsJson", vs."timelineJson", vs."feedbackJson", vs."metricsJson",
                vs."createdAt"
           FROM "ValidationSession" vs
          WHERE (vs."userId" = $1 OR vs."userEmail" = $2 OR vs."userExternalId" = $2)
            AND ($3::text IS NULL OR vs."sessionSource" = $3)
          ORDER BY vs."userExternalId", vs."queryText", date_trunc('second', vs."createdAt"), vs.id DESC`,
        [caller.userId, caller.email, source]
      );
      sessions.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      sessions = sessions.slice(offset, offset + limit);
    }

    return NextResponse.json({
      sessions,
      total: sessions.length,
      role: caller.role,
      isElevated: ELEVATED_ROLES.has(caller.role),
    });
  } catch (err: any) {
    console.error('[search-metrics GET]', err.message);
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
  }
}
