import { NextRequest, NextResponse } from 'next/server';
import { validateSession, getUserByEmail, query as dbQuery } from '@/lib/db';
import { DEMO_USERS } from '@/lib/admin-auth';

function getToken(req: NextRequest): string {
  const auth = req.headers.get('authorization') || '';
  return auth.replace('Bearer ', '').trim() || req.cookies.get('authToken')?.value || '';
}

// Fast lookup map for demo users by email
const DEMO_BY_EMAIL = Object.fromEntries(DEMO_USERS.map(u => [u.email.toLowerCase(), u]));

/**
 * Resolve authenticated user.
 * Priority:
 *  1. DB session token validation
 *  2. DB getUserByEmail fallback
 *  3. DEMO_USERS map when DB is unreachable and token/email is a known demo user
 */
async function resolveUser(req: NextRequest) {
  const token = getToken(req);
  const emailHeader = (req.headers.get('x-user-email') || '').toLowerCase();

  // 1. Try DB session via token
  if (token) {
    try {
      const session = await validateSession(token);
      if (session) return session;
    } catch { /* DB unavailable */ }
  }

  // 2. Try DB getUserByEmail
  if (emailHeader) {
    try {
      const user = await getUserByEmail(emailHeader);
      if (user) return { userId: (user as any).id, email: (user as any).email, name: (user as any).name };
    } catch { /* DB unavailable */ }

    // 3. DEMO_USERS fallback when DB is unreachable
    const isDemoToken = !token || token.startsWith('admin-') || token.startsWith('demo-');
    const demoUser = DEMO_BY_EMAIL[emailHeader];
    if (demoUser && isDemoToken) {
      return {
        userId: `demo-${demoUser.email.split('@')[0]}`,
        email: demoUser.email,
        name: demoUser.displayName,
        firstName: demoUser.firstName,
        lastName: demoUser.lastName,
        aliasName: demoUser.aliasName,
        role: demoUser.role,
        subscription: demoUser.subscription,
        _isDemo: true,
      };
    }
  }
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const session = await resolveUser(req) as any;
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // ── Demo user path: DB unavailable, return synthetic profile ─────────────
    if (session._isDemo) {
      const nameParts = (session.name || '').split(' ');
      return NextResponse.json({
        id: session.userId,
        email: session.email,
        name: session.name,
        firstName: session.firstName || nameParts[0] || '',
        lastName: session.lastName || nameParts.slice(1).join(' ') || '',
        whatsappNumber: null,
        notificationEmail: null,
        avatarUrl: null,
        autoPurchaseEnabled: false,
        autoPurchaseThreshold: 10000,
        displayName: session.name,
        aliasName: session.aliasName || null,
        preferredCommunicationEmail: null,
        defaultBillingAddressId: null,
        defaultShippingAddressId: null,
        subscriptionPlan: session.subscription || 'BASIC',
        preferredModel: 'gpt-4o-mini',
        monthlyAiBudget: 50000,
        defaultDeliveryDays: 7,
        defaultPaymentMethod: 'cod',
        createdAt: null,
        _source: 'demo',
      });
    }

    // ── DB path ───────────────────────────────────────────────────────────────
    let fullUser: any = {};
    try {
      const rows = await dbQuery(
        `SELECT id, email, name, "whatsappNumber", "notificationEmail", "avatarUrl",
                "autoPurchaseEnabled", "autoPurchaseThreshold",
                "displayName", "aliasName", "preferredCommunicationEmail",
                "defaultBillingAddressId", "defaultShippingAddressId",
                "subscriptionPlan", "preferredModel",
                "monthlyAiBudget", "defaultDeliveryDays", "defaultPaymentMethod",
                "createdAt"
         FROM "User" WHERE email = $1`,
        [session.email]
      );
      fullUser = rows?.[0] || {};
    } catch {
      try {
        const row = await getUserByEmail(session.email);
        fullUser = row || {};
      } catch {
        /* DB down */
      }
    }

    return NextResponse.json({
      id: session.userId,
      email: session.email,
      name: fullUser.name || session.name,
      whatsappNumber: fullUser.whatsappNumber || session.whatsappNumber || null,
      notificationEmail: fullUser.notificationEmail || session.notificationEmail || null,
      avatarUrl: fullUser.avatarUrl || session.avatarUrl || null,
      autoPurchaseEnabled: fullUser.autoPurchaseEnabled ?? false,
      autoPurchaseThreshold: fullUser.autoPurchaseThreshold ?? 10000,
      displayName: fullUser.displayName || null,
      aliasName: fullUser.aliasName || null,
      preferredCommunicationEmail: fullUser.preferredCommunicationEmail || null,
      defaultBillingAddressId: fullUser.defaultBillingAddressId || null,
      defaultShippingAddressId: fullUser.defaultShippingAddressId || null,
      subscriptionPlan: fullUser.subscriptionPlan || 'BASIC',
      preferredModel: fullUser.preferredModel || 'gpt-4o-mini',
      monthlyAiBudget: fullUser.monthlyAiBudget ?? 50000,
      defaultDeliveryDays: fullUser.defaultDeliveryDays ?? 7,
      defaultPaymentMethod: fullUser.defaultPaymentMethod || 'cod',
      createdAt: fullUser.createdAt || null,
    });
  } catch (err: any) {
    console.error('[profile GET] error:', err.message);
    return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await resolveUser(req) as any;
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();

  // Demo mode: DB unavailable — echo submitted fields back as success
  if (session._isDemo) {
    const demoUser = DEMO_BY_EMAIL[(session.email || '').toLowerCase()];
    return NextResponse.json({
      profile: {
        id: session.userId,
        email: session.email,
        name: body.name || demoUser?.displayName || session.name || 'Demo User',
        displayName: body.displayName !== undefined ? body.displayName : (demoUser?.displayName || null),
        aliasName: body.aliasName !== undefined ? body.aliasName : (demoUser?.aliasName || null),
        whatsappNumber: body.whatsappNumber || null,
        notificationEmail: body.notificationEmail || session.email,
        avatarUrl: body.avatarUrl || null,
        autoPurchaseEnabled: body.autoPurchaseEnabled ?? false,
        autoPurchaseThreshold: body.autoPurchaseThreshold ?? 10000,
        subscriptionPlan: demoUser?.subscription || 'BASIC',
        preferredModel: body.preferredModel || 'gpt-4o-mini',
        monthlyAiBudget: body.monthlyAiBudget ?? 50000,
        defaultDeliveryDays: body.defaultDeliveryDays ?? 7,
        defaultPaymentMethod: body.defaultPaymentMethod || 'cod',
        _source: 'demo',
      },
    });
  }

  const fieldMap: Record<
    string,
    { col: string; transform?: (v: any) => any; validate?: (v: any) => boolean }
  > = {
    name: { col: 'name' },
    whatsappNumber: { col: '"whatsappNumber"' },
    notificationEmail: { col: '"notificationEmail"' },
    avatarUrl: { col: '"avatarUrl"' },
    displayName: { col: '"displayName"' },
    aliasName: { col: '"aliasName"' },
    preferredCommunicationEmail: { col: '"preferredCommunicationEmail"' },
    defaultBillingAddressId: {
      col: '"defaultBillingAddressId"',
      transform: (v: any) => (v ? parseInt(v) : null),
    },
    defaultShippingAddressId: {
      col: '"defaultShippingAddressId"',
      transform: (v: any) => (v ? parseInt(v) : null),
    },
    autoPurchaseEnabled: { col: '"autoPurchaseEnabled"', transform: (v: any) => !!v },
    autoPurchaseThreshold: {
      col: '"autoPurchaseThreshold"',
      transform: (v: any) => parseInt(v),
      validate: (v: any) => {
        const n = parseInt(v);
        return !isNaN(n) && n >= 100 && n <= 500000;
      },
    },
    subscriptionPlan: {
      col: '"subscriptionPlan"',
      validate: (v: any) => ['BASIC', 'AI_PLUS'].includes(v),
    },
    preferredModel: {
      col: '"preferredModel"',
      validate: (v: any) =>
        ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'claude-3-haiku', 'claude-3-sonnet'].includes(v),
    },
    monthlyAiBudget: {
      col: '"monthlyAiBudget"',
      transform: (v: any) => parseFloat(v) || 50000,
      validate: (v: any) => {
        const n = parseFloat(v);
        return !isNaN(n) && n >= 1000 && n <= 5000000;
      },
    },
    defaultDeliveryDays: {
      col: '"defaultDeliveryDays"',
      transform: (v: any) => parseInt(v) || 7,
      validate: (v: any) => {
        const n = parseInt(v);
        return !isNaN(n) && n >= 1 && n <= 30;
      },
    },
    defaultPaymentMethod: {
      col: '"defaultPaymentMethod"',
      validate: (v: any) =>
        ['cod', 'upi', 'credit_card', 'debit_card', 'net_banking', 'wallet', 'emi'].includes(v),
    },
  };

  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;

  for (const [key, def] of Object.entries(fieldMap)) {
    if (body[key] !== undefined) {
      if (def.validate && !def.validate(body[key])) continue;
      sets.push(`${def.col} = $${i++}`);
      vals.push(def.transform ? def.transform(body[key]) : body[key] || null);
    }
  }

  if (!sets.length) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  sets.push(`"updatedAt" = NOW()`);
  vals.push(session.userId);

  try {
    const rows = await dbQuery(
      `UPDATE "User" SET ${sets.join(', ')} WHERE id = $${i} RETURNING id, email, name,
        "whatsappNumber", "notificationEmail", "avatarUrl",
        "autoPurchaseEnabled", "autoPurchaseThreshold",
        "displayName", "aliasName", "preferredCommunicationEmail",
        "defaultBillingAddressId", "defaultShippingAddressId",
        "subscriptionPlan", "preferredModel",
        "monthlyAiBudget", "defaultDeliveryDays", "defaultPaymentMethod"`,
      vals
    );
    return NextResponse.json({ profile: rows[0] });
  } catch (e: any) {
    console.error('[profile PUT] error:', e.message);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}
