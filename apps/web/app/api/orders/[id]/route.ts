import { NextRequest, NextResponse } from 'next/server';
import { validateSession, getOrderById } from '@/lib/db';

function getToken(req: NextRequest): string {
  const auth = req.headers.get('authorization') || '';
  return auth.replace('Bearer ', '').trim() || req.cookies.get('authToken')?.value || '';
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const token = getToken(req);
    const session = token ? await validateSession(token) : null;
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const order = await getOrderById(parseInt(id, 10), session.userId);
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    return NextResponse.json({ order });
  } catch (err: any) {
    console.error('[order GET]', err.message);
    return NextResponse.json({ error: 'Failed to load order' }, { status: 500 });
  }
}
