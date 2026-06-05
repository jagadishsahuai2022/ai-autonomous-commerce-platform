import { NextRequest, NextResponse } from 'next/server';
import { validateSession, getUserOrders, createOrder } from '@/lib/db';

function getToken(req: NextRequest): string {
  const auth = req.headers.get('authorization') || '';
  return auth.replace('Bearer ', '').trim() || req.cookies.get('authToken')?.value || '';
}

export async function GET(req: NextRequest) {
  try {
    const token = getToken(req);
    const session = token ? await validateSession(token) : null;
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { orders, total } = await getUserOrders(session.userId);
    return NextResponse.json({ orders, total });
  } catch (err: any) {
    console.error('[orders GET]', err.message);
    return NextResponse.json({ orders: [], total: 0, error: 'Failed to load orders' }, { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = getToken(req);
    const session = token ? await validateSession(token) : null;
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const order = await createOrder(session.userId, body);
    if (!order) return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
    return NextResponse.json({ order }, { status: 201 });
  } catch (err: any) {
    console.error('[orders POST]', err.message);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}
