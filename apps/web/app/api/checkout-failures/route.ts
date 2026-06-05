import { NextRequest, NextResponse } from 'next/server';
import { validateSession, getCheckoutFailures } from '@/lib/db';

function getToken(req: NextRequest): string {
  const auth = req.headers.get('authorization') || '';
  return auth.replace('Bearer ', '').trim() || req.cookies.get('authToken')?.value || '';
}

export async function GET(req: NextRequest) {
  try {
    const token = getToken(req);
    const session = token ? await validateSession(token) : null;
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const failures = await getCheckoutFailures(session.userId);
    return NextResponse.json({ failures });
  } catch (err: any) {
    console.error('[checkout-failures GET]', err.message);
    return NextResponse.json({ error: 'Failed to load checkout failures' }, { status: 500 });
  }
}
