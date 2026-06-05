import { NextRequest, NextResponse } from 'next/server';
import { validateSession, getUserSearchHistory } from '@/lib/db';

function getToken(req: NextRequest): string {
  const auth = req.headers.get('authorization') || '';
  return auth.replace('Bearer ', '').trim() || req.cookies.get('authToken')?.value || '';
}

export async function GET(req: NextRequest) {
  try {
    const token = getToken(req);
    const session = token ? await validateSession(token) : null;
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const history = await getUserSearchHistory(session.userId);
    return NextResponse.json({ history });
  } catch (err: any) {
    console.error('[search-history GET]', err.message);
    return NextResponse.json({ history: [] });
  }
}
