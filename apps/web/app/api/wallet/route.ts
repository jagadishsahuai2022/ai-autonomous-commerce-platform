import { NextRequest, NextResponse } from 'next/server';
import {
  validateSession,
  getOrCreateWallet,
  addWalletFunds,
  debitWallet,
  updateWalletSettings,
  getWalletTransactions,
  getUserByEmail,
} from '@/lib/db';
import { DEMO_USERS } from '@/lib/admin-auth';

const DEMO_BY_EMAIL = Object.fromEntries(DEMO_USERS.map((u) => [u.email.toLowerCase(), u]));

function getToken(req: NextRequest): string {
  const auth = req.headers.get('authorization') || '';
  return auth.replace('Bearer ', '').trim() || req.cookies.get('authToken')?.value || '';
}

async function resolveSession(req: NextRequest) {
  const token = getToken(req);
  const emailHeader = (req.headers.get('x-user-email') || '').toLowerCase();

  // 1. Try DB session
  if (token) {
    try {
      const session = await validateSession(token);
      if (session) return session;
    } catch {
      /* DB unavailable */
    }
  }

  // 2. Demo/admin fallback via x-user-email
  if (emailHeader) {
    try {
      const user = await getUserByEmail(emailHeader);
      if (user)
        return { userId: (user as any).id, email: (user as any).email, name: (user as any).name };
    } catch {
      /* DB unavailable */
    }

    const demoUser = DEMO_BY_EMAIL[emailHeader];
    const isKnownToken = !token || /^(sess_|admin-|demo-)/.test(token);
    if (demoUser && isKnownToken) {
      try {
        const user = await getUserByEmail(emailHeader);
        if (user)
          return { userId: (user as any).id, email: emailHeader, name: demoUser.displayName };
      } catch {
        /* ignore */
      }
    }
  }

  return null;
}

export async function GET(req: NextRequest) {
  try {
    const session = await resolveSession(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const wallet = await getOrCreateWallet(session.userId);
    const transactions = await getWalletTransactions(wallet.id, 10);
    return NextResponse.json({ wallet, transactions });
  } catch (err: any) {
    console.error('[wallet GET]', err.message);
    return NextResponse.json({ error: 'Failed to load wallet' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await resolveSession(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action } = body;

    const wallet = await getOrCreateWallet(session.userId);

    if (action === 'add_funds') {
      const amount = parseFloat(body.amount);
      if (!amount || amount <= 0 || amount > 1000000) {
        return NextResponse.json(
          { error: 'Amount must be between ₹1 and ₹10,00,000' },
          { status: 400 }
        );
      }
      const result = await addWalletFunds(wallet.id, amount, body.description || 'Added funds');
      return NextResponse.json(result, { status: 200 });
    }

    if (action === 'debit') {
      const amount = parseFloat(body.amount);
      if (!amount || amount <= 0) {
        return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
      }
      const result = await debitWallet(
        wallet.id,
        amount,
        body.description || 'Payment',
        body.orderId
      );
      return NextResponse.json(result, { status: 200 });
    }

    if (action === 'update_settings') {
      const result = await updateWalletSettings(wallet.id, session.userId, {
        maxPerOrder:
          body.maxPerOrder !== undefined
            ? body.maxPerOrder
              ? parseFloat(body.maxPerOrder)
              : null
            : undefined,
        dailyLimit:
          body.dailyLimit !== undefined
            ? body.dailyLimit
              ? parseFloat(body.dailyLimit)
              : null
            : undefined,
        isAiAuthorized: body.isAiAuthorized,
        aiSpendingLimit:
          body.aiSpendingLimit !== undefined
            ? body.aiSpendingLimit
              ? parseFloat(body.aiSpendingLimit)
              : null
            : undefined,
      });
      return NextResponse.json({ wallet: result });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    console.error('[wallet POST]', err.message);
    return NextResponse.json({ error: err.message || 'Wallet operation failed' }, { status: 500 });
  }
}
