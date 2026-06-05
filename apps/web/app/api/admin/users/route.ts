/**
 * GET /api/admin/users
 * Returns all registered users from the database for admin use.
 * Requires admin/analytics session token.
 */
import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';

export const runtime = 'nodejs';

const ELEVATED_ROLES = new Set(['admin', 'analytics']);

async function resolveAdminUser(req: NextRequest) {
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  try {
    const session = await queryOne<{ userId: number; email: string; role: string }>(
      `SELECT s."userId", u.email, u.role FROM "UserSession" s
       JOIN "User" u ON u.id = s."userId"
       WHERE s."sessionToken" = $1 AND s."expiresAt" > NOW() LIMIT 1`,
      [token]
    );
    return session;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const caller = await resolveAdminUser(req);
    if (!caller || !ELEVATED_ROLES.has(caller.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const users = await query<{
      id: number;
      email: string;
      name: string;
      role: string;
      subscriptionPlan: string;
      createdAt: string;
    }>(
      `SELECT id, email, name, COALESCE(role, 'customer') as role,
              COALESCE("subscriptionPlan", 'BASIC') as "subscriptionPlan",
              "createdAt"
       FROM "User"
       ORDER BY "createdAt" DESC
       LIMIT 200`,
      []
    );

    return NextResponse.json({ users, total: users.length });
  } catch (err: any) {
    console.error('[Admin Users API]', err.message);
    return NextResponse.json({ error: 'Failed to fetch users', users: [], total: 0 }, { status: 500 });
  }
}
