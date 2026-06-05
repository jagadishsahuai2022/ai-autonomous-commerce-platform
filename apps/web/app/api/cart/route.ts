import { NextRequest, NextResponse } from 'next/server';
import { validateSession, query as dbQuery } from '@/lib/db';

function getToken(req: NextRequest): string {
  const auth = req.headers.get('authorization') || '';
  return auth.replace('Bearer ', '').trim() || req.cookies.get('authToken')?.value || '';
}

export async function GET(req: NextRequest) {
  try {
    const token = getToken(req);
    const session = token ? await validateSession(token) : null;
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rows = await dbQuery(`SELECT items FROM "UserCart" WHERE "userId" = $1`, [
      session.userId,
    ]);
    return NextResponse.json({ items: rows[0]?.items || [] });
  } catch (err: any) {
    console.error('[cart GET] error:', err.message);
    return NextResponse.json({ error: 'Failed to load cart' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const token = getToken(req);
    const session = token ? await validateSession(token) : null;
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const items = Array.isArray(body.items) ? body.items : [];

    const rows = await dbQuery(
      `INSERT INTO "UserCart" ("userId", items, "updatedAt")
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT ("userId") DO UPDATE SET
         items = EXCLUDED.items,
         "updatedAt" = NOW()
       RETURNING items`,
      [session.userId, JSON.stringify(items)]
    );

    return NextResponse.json({ items: rows[0]?.items || [] });
  } catch (err: any) {
    console.error('[cart PUT] error:', err.message);
    return NextResponse.json({ error: 'Failed to save cart' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const token = getToken(req);
    const session = token ? await validateSession(token) : null;
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await dbQuery(`DELETE FROM "UserCart" WHERE "userId" = $1`, [session.userId]);

    return NextResponse.json({ items: [] });
  } catch (err: any) {
    console.error('[cart DELETE] error:', err.message);
    return NextResponse.json({ error: 'Failed to clear cart' }, { status: 500 });
  }
}
