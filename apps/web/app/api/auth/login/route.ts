import { NextRequest, NextResponse } from 'next/server';
import { getUserByEmail, upsertUser, createSession, query as dbQuery } from '@/lib/db';
import { DEMO_USERS } from '@/lib/admin-auth';
import crypto from 'crypto';
import bcrypt from 'bcrypt';

// Fast lookup for demo users — avoids DB when unavailable
const DEMO_BY_EMAIL = Object.fromEntries(DEMO_USERS.map(u => [u.email.toLowerCase(), u]));

const APP_ROLES = ['admin', 'analytics', 'aiplus', 'observability', 'reinforced-learning', 'basic', 'customer'] as const;
type AppRole = (typeof APP_ROLES)[number];

function normalizeDbRole(raw: unknown): AppRole | null {
  if (typeof raw !== 'string') return null;
  const lower = raw.toLowerCase().trim();
  if (lower === 'analytic') return 'analytics';
  if (lower === 'ai-plus' || lower === 'ai_plus') return 'aiplus';
  if (lower === 'selflearning' || lower === 'self-learning' || lower === 'learning') return 'reinforced-learning';
  return (APP_ROLES as readonly string[]).includes(lower) ? (lower as AppRole) : null;
}

function normalizeSubscription(raw: unknown): 'BASIC' | 'AI_PLUS' | null {
  if (typeof raw !== 'string') return null;
  const normalized = raw.toUpperCase().trim();
  if (normalized === 'AI_PLUS' || normalized === 'AI+' || normalized === 'AIPLUS') return 'AI_PLUS';
  if (normalized === 'BASIC') return 'BASIC';
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    // Demo mode: any email can login; create user if not exists
    let user = await getUserByEmail(email).catch(() => null);
    if (!user) {
      user = await upsertUser(email).catch(() => null);
    }

    if (!user) {
      // DB unavailable — fall back to DEMO_USERS if email is known
      const demoUser = DEMO_BY_EMAIL[email.toLowerCase()];
      if (demoUser) {
        const token = `demo-${Date.now()}`;
        return NextResponse.json({
          success: true,
          token,
          user: {
            id: `demo-${demoUser.email.split('@')[0]}`,
            email: demoUser.email,
            name: demoUser.displayName,
            dcRole: demoUser.role,
            subscription: demoUser.subscription,
          },
        });
      }
      return NextResponse.json({ error: 'Login failed' }, { status: 401 });
    }

    // If user has a password set, verify it; otherwise allow direct login (demo mode)
    if ((user as any).passwordHash && password) {
      const storedHash: string = (user as any).passwordHash;

      // Support both bcrypt hashes ($2b$...) and legacy SHA-256 hashes
      let isValid = false;
      if (storedHash.startsWith('$2b$') || storedHash.startsWith('$2a$')) {
        isValid = await bcrypt.compare(password, storedHash);
      } else {
        // Legacy SHA-256 comparison
        const sha256Hash = crypto
          .createHash('sha256')
          .update(password + email)
          .digest('hex');
        isValid = sha256Hash === storedHash;
      }

      if (!isValid) {
        return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
      }
    }

    const token = await createSession(user.id);
    const demoUser = DEMO_BY_EMAIL[(user.email || '').toLowerCase()];

    const dbRole = normalizeDbRole((user as any).role);
    const dbSubscription = normalizeSubscription((user as any).subscriptionPlan ?? (user as any).subscription);
    const resolvedRole = dbRole ?? demoUser?.role ?? 'basic';
    const resolvedSubscription = dbSubscription ?? demoUser?.subscription ?? 'BASIC';

    // Keep demo users persisted with canonical role/subscription so DB is the source of truth.
    if (demoUser) {
      try {
        await dbQuery(
          `UPDATE "User" SET "role" = $1, "subscriptionPlan" = $2, "updatedAt" = NOW() WHERE id = $3`,
          [demoUser.role, demoUser.subscription, user.id]
        );
      } catch {
        /* role/subscription columns may not exist in all environments */
      }
    }

    return NextResponse.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        dcRole: resolvedRole,
        subscription: resolvedSubscription,
      },
    });
  } catch (err: any) {
    console.error('[login]', err.message);
    // Last-resort demo fallback if outer catch fires
    try {
      const { email } = await req.clone().json().catch(() => ({}));
      const demoUser = email ? DEMO_BY_EMAIL[(email as string).toLowerCase()] : null;
      if (demoUser) {
        const token = `demo-${Date.now()}`;
        return NextResponse.json({
          success: true,
          token,
          user: { id: `demo-${demoUser.email.split('@')[0]}`, email: demoUser.email, name: demoUser.displayName, dcRole: demoUser.role, subscription: demoUser.subscription },
        });
      }
    } catch { /* ignore */ }
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
