/**
 * /api/auth/session — Session query endpoint
 *
 * NextAuth convention: unauthenticated → HTTP 200 `{}`
 * Demo users: return synthetic session without DB
 * Real users: validate via DB session table
 */
import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/db';
import { DEMO_USERS } from '@/lib/admin-auth';

const DEMO_BY_EMAIL: Record<string, (typeof DEMO_USERS)[number]> = Object.fromEntries(
  DEMO_USERS.map(u => [u.email.toLowerCase(), u])
);

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization') || '';
  const token = auth.replace('Bearer ', '').trim() || req.cookies.get('authToken')?.value || '';
  const emailHeader = (req.headers.get('x-user-email') || '').toLowerCase();

  // ── No credentials at all → return empty (200 per NextAuth convention, not 401) ──
  if (!token && !emailHeader) {
    return NextResponse.json({});
  }

  // ── Try DB session first ──────────────────────────────────────────────────
  if (token) {
    try {
      const session = await validateSession(token);
      if (session) {
        return NextResponse.json({
          authenticated: true,
          user: {
            id: session.userId,
            email: session.email,
            name: session.name,
          },
        });
      }
    } catch { /* DB unavailable — fall through to demo fallback */ }
  }

  // ── Demo / admin token fallback ───────────────────────────────────────────
  // Demo tokens are stored in localStorage as "admin-{timestamp}" or "demo-{timestamp}"
  const isDemoToken = token.startsWith('admin-') || token.startsWith('demo-');
  const email = emailHeader;
  const demoUser = email ? DEMO_BY_EMAIL[email] : undefined;

  if (demoUser && (isDemoToken || !token)) {
    return NextResponse.json({
      authenticated: true,
      user: {
        id: `demo-${demoUser.email.split('@')[0]}`,
        email: demoUser.email,
        name: demoUser.displayName,
        firstName: demoUser.firstName || demoUser.displayName.split(' ')[0],
        lastName: demoUser.lastName || demoUser.displayName.split(' ').slice(1).join(' '),
        role: demoUser.role,
        subscription: demoUser.subscription,
      },
    });
  }

  // ── No valid session → return empty (200, not 401) ────────────────────────
  return NextResponse.json({});
}
