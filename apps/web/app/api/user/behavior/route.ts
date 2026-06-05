import { NextRequest, NextResponse } from 'next/server';
import { validateSession, trackBehavior, getUserBehavior, getProductBehaviorStats } from '@/lib/db';

function getToken(req: NextRequest): string {
  const auth = req.headers.get('authorization') || '';
  return auth.replace('Bearer ', '').trim() || req.cookies.get('authToken')?.value || '';
}

export async function POST(req: NextRequest) {
  try {
    const token = getToken(req);
    const session = token ? await validateSession(token) : null;

    const body = await req.json();
    const validActions = ['click', 'add_to_cart', 'remove_from_cart', 'purchase', 'reject', 'search', 'view'];
    if (!body.action || !validActions.includes(body.action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const result = await trackBehavior(
      session?.userId ?? null,
      body.productId ?? null,
      body.action,
      body.metadata ?? {}
    );
    return NextResponse.json({ tracked: true, id: result?.id });
  } catch (err: any) {
    console.error('[behavior POST]', err.message);
    return NextResponse.json({ tracked: false }, { status: 202 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const token = getToken(req);
    const session = token ? await validateSession(token) : null;
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');

    if (type === 'stats') {
      const stats = await getProductBehaviorStats(session.userId);
      return NextResponse.json({ stats });
    }

    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const behavior = await getUserBehavior(session.userId, Math.min(limit, 200));
    return NextResponse.json({ behavior });
  } catch (err: any) {
    console.error('[behavior GET]', err.message);
    return NextResponse.json({ behavior: [], stats: [] });
  }
}
