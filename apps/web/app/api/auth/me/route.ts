/**
 * /api/auth/me — User identity endpoint
 * Resolves current user from demo/admin localStorage token or DB session.
 * Proxies to /api/user/profile for full profile data.
 * Prevents React Query from retrying on 401 storm caused by missing backend.
 */
import { NextRequest, NextResponse } from 'next/server';
import { validateSession, getUserByEmail, query as dbQuery } from '@/lib/db';

export const runtime = 'nodejs';

function getToken(req: NextRequest): string {
  const auth = req.headers.get('authorization') || '';
  return auth.replace('Bearer ', '').trim() || req.cookies.get('authToken')?.value || '';
}

export async function GET(req: NextRequest) {
  const token = getToken(req);
  const emailHeader = req.headers.get('x-user-email') || '';

  // Demo/admin token (format: "admin-{timestamp}")
  if (!token && !emailHeader) {
    return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
  }

  // Try DB session first
  if (token) {
    try {
      const session = await validateSession(token);
      if (session) {
        // Get full profile
        let fullUser: any = {};
        try {
          const rows = await dbQuery(
            `SELECT id, email, name, "displayName", "aliasName", "createdAt"
             FROM "User" WHERE email = $1`,
            [session.email]
          );
          fullUser = rows?.[0] || {};
        } catch { /* DB may be unavailable */ }

        const name = fullUser.name || session.name || '';
        const nameParts = name.trim().split(/\s+/);
        return NextResponse.json({
          authenticated: true,
          id: session.userId,
          email: session.email,
          name,
          firstName: nameParts[0] || '',
          lastName: nameParts.slice(1).join(' ') || '',
          displayName: fullUser.displayName || null,
          aliasName: fullUser.aliasName || null,
          role: 'CUSTOMER',
          emailVerified: true,
          createdAt: fullUser.createdAt || new Date().toISOString(),
        });
      }
    } catch { /* DB unavailable */ }
  }

  if (emailHeader) {
    try {
      const user = await getUserByEmail(emailHeader);
      if (user) {
        let fullUser: any = user;
        try {
          const rows = await dbQuery(
            `SELECT id, email, name, "displayName", "aliasName", "createdAt"
             FROM "User" WHERE email = $1`,
            [emailHeader]
          );
          fullUser = rows?.[0] || user;
        } catch {
          /* DB may be partially unavailable */
        }

        const name = fullUser.name || (user as any).name || '';
        const nameParts = name.trim().split(/\s+/);
        return NextResponse.json({
          authenticated: true,
          id: fullUser.id || (user as any).id,
          email: fullUser.email || (user as any).email || emailHeader,
          name,
          firstName: nameParts[0] || '',
          lastName: nameParts.slice(1).join(' ') || '',
          displayName: fullUser.displayName || null,
          aliasName: fullUser.aliasName || null,
          role: 'CUSTOMER',
          emailVerified: true,
          createdAt: fullUser.createdAt || new Date().toISOString(),
        });
      }
    } catch {
      /* DB unavailable */
    }
  }

  // Last-resort fallback — email is known but not in DB yet
  const email = emailHeader ||
    (token?.startsWith('admin-') ? req.headers.get('x-user-email') || '' : '');

  if (email) {
    // Return basic info derived from email — real profile should come from DB
    const namePart = email.split('@')[0];
    return NextResponse.json({
      authenticated: true,
      id: `user-${namePart}`,
      email,
      name: namePart,
      firstName: namePart,
      lastName: '',
      displayName: null,
      aliasName: null,
      role: 'CUSTOMER',
      emailVerified: false,
      createdAt: new Date().toISOString(),
    });
  }

  return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
}
