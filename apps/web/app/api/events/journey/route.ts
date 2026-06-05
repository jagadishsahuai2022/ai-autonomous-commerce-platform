import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

const VALID_EVENT_TYPES = new Set([
  'product_clicked',
  'wishlist_added',
  'wishlist_removed',
  'cart_added',
  'cart_removed',
  'checkout_started',
  'payment_started',
  'payment_success',
  'payment_failed',
  'order_placed',
  'order_failed',
]);

/* POST /api/events/journey  – record a single user journey event */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }

    const {
      sessionId,
      journeyId,
      eventType,
      productId,
      productName,
      productCategory,
      productPrice,
      orderId,
      metadata = {},
    } = body as Record<string, unknown>;

    // Validate required fields
    if (typeof sessionId !== 'string' || !sessionId) {
      return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
    }
    if (typeof eventType !== 'string' || !VALID_EVENT_TYPES.has(eventType)) {
      return NextResponse.json({ error: 'Invalid eventType' }, { status: 400 });
    }

    // Resolve user identity from cookie/session if available
    let userId: number | null = null;
    let userEmail: string | null = null;
    let userName: string | null = null;

    try {
      const authCookie = req.cookies.get('auth_token')?.value
        || req.cookies.get('session')?.value;
      if (authCookie) {
        // Try resolving from DB — simple lookup by session token
        const user = await query<{ id: number; email: string; name?: string }>(
          `SELECT id, email, COALESCE(name, email) as name FROM "User" WHERE "sessionToken" = $1 LIMIT 1`,
          [authCookie]
        );
        if (user.length > 0) {
          userId = user[0].id;
          userEmail = user[0].email;
          userName = user[0].name ?? null;
        }
      }
    } catch {
      // Non-critical — proceed without user identity
    }

    const result = await query<{ id: number }>(
      `INSERT INTO "UserJourneyEvent"
         ("sessionId","journeyId","userId","userEmail","userName","eventType",
          "productId","productName","productCategory","productPrice","orderId","metadata")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING id`,
      [
        sessionId,
        journeyId || null,
        userId,
        userEmail,
        userName,
        eventType,
        productId ?? null,
        productName ?? null,
        productCategory ?? null,
        productPrice ?? null,
        orderId ?? null,
        JSON.stringify(metadata),
      ]
    );

    return NextResponse.json(
      { ok: true, id: result[0]?.id },
      { status: 201 }
    );
  } catch (err) {
    console.error('[journey-event] POST error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

/* GET /api/events/journey  – list events for the observability dashboard */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '100', 10), 500);
  const offset = parseInt(searchParams.get('offset') ?? '0', 10);
  const eventType = searchParams.get('eventType');
  const sessionId = searchParams.get('sessionId');
  const userId = searchParams.get('userId');

  try {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let p = 1;

    if (eventType) { conditions.push(`"eventType" = $${p++}`); params.push(eventType); }
    if (sessionId) { conditions.push(`"sessionId" = $${p++}`); params.push(sessionId); }
    if (userId)    { conditions.push(`"userId" = $${p++}`);    params.push(parseInt(userId, 10)); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const events = await query(
      `SELECT id, "sessionId", "journeyId", "userId", "userEmail", "userName",
              "eventType", "productId", "productName", "productCategory",
              "productPrice", "orderId", metadata, "createdAt"
       FROM "UserJourneyEvent"
       ${where}
       ORDER BY "createdAt" DESC
       LIMIT $${p++} OFFSET $${p++}`,
      [...params, limit, offset]
    );

    // Get funnel counts for the dashboard
    const funnelRows = await query<{ eventType: string; count: string }>(
      `SELECT "eventType", COUNT(*) as count
       FROM "UserJourneyEvent"
       WHERE "createdAt" > NOW() - INTERVAL '24 hours'
       GROUP BY "eventType"
       ORDER BY "eventType"`
    );

    const funnel = Object.fromEntries(funnelRows.map(r => [r.eventType, parseInt(r.count, 10)]));

    return NextResponse.json({ events, funnel, total: events.length });
  } catch (err) {
    console.error('[journey-event] GET error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
