import { NextRequest, NextResponse } from 'next/server';
import { validateSession, getOrCreateWallet, getWalletTransactions } from '@/lib/db';

function getToken(req: NextRequest): string {
  const auth = req.headers.get('authorization') || '';
  return auth.replace('Bearer ', '').trim() || req.cookies.get('authToken')?.value || '';
}

export async function GET(req: NextRequest) {
  try {
    const token = getToken(req);
    const session = token ? await validateSession(token) : null;
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    const wallet = await getOrCreateWallet(session.userId);
    const transactions = await getWalletTransactions(wallet.id, limit, offset);
    return NextResponse.json({ transactions });
  } catch (err: any) {
    console.error('[wallet/transactions GET]', err.message);
    return NextResponse.json({ error: 'Failed to load transactions' }, { status: 500 });
  }
}
