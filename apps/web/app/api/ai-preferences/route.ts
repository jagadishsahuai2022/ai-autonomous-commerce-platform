import { NextRequest, NextResponse } from 'next/server';
import { validateSession, query as dbQuery } from '@/lib/db';

function getToken(req: NextRequest): string {
  const auth = req.headers.get('authorization') || '';
  return auth.replace('Bearer ', '').trim() || req.cookies.get('authToken')?.value || '';
}

export async function GET(req: NextRequest) {
  try {
    const token = getToken(req);
    const session = token ? await validateSession(token) : null;
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Check AI Plus subscription
    const userRows = await dbQuery(`SELECT "subscriptionPlan" FROM "User" WHERE id = $1`, [
      session.userId,
    ]);
    const plan = userRows?.[0]?.subscriptionPlan || 'BASIC';
    if (plan !== 'AI_PLUS') {
      return NextResponse.json({ error: 'AI Plus subscription required' }, { status: 403 });
    }

    const rows = await dbQuery(
      `SELECT "priceAlerts", "aiRecommendations", "preferredCategories",
              "budgetPreference", "deliveryPreference"
       FROM "AiPreference" WHERE "userId" = $1`,
      [session.userId]
    );

    if (rows.length === 0) {
      return NextResponse.json({
        priceAlerts: true,
        aiRecommendations: true,
        preferredCategories: [],
        budgetPreference: 'balanced',
        deliveryPreference: 'standard',
      });
    }

    return NextResponse.json(rows[0]);
  } catch (err: any) {
    console.error('[ai-preferences GET] error:', err.message);
    return NextResponse.json({ error: 'Failed to load AI preferences' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const token = getToken(req);
    const session = token ? await validateSession(token) : null;
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Check AI Plus subscription
    const userRows = await dbQuery(`SELECT "subscriptionPlan" FROM "User" WHERE id = $1`, [
      session.userId,
    ]);
    const plan = userRows?.[0]?.subscriptionPlan || 'BASIC';
    if (plan !== 'AI_PLUS') {
      return NextResponse.json({ error: 'AI Plus subscription required' }, { status: 403 });
    }

    const body = await req.json();

    const priceAlerts = typeof body.priceAlerts === 'boolean' ? body.priceAlerts : true;
    const aiRecommendations =
      typeof body.aiRecommendations === 'boolean' ? body.aiRecommendations : true;
    const preferredCategories = Array.isArray(body.preferredCategories)
      ? body.preferredCategories.filter((c: any) => typeof c === 'string')
      : [];
    const budgetPreference = ['budget', 'balanced', 'premium'].includes(body.budgetPreference)
      ? body.budgetPreference
      : 'balanced';
    const deliveryPreference = ['fastest', 'standard', 'cheapest'].includes(body.deliveryPreference)
      ? body.deliveryPreference
      : 'standard';

    const rows = await dbQuery(
      `INSERT INTO "AiPreference" ("userId", "priceAlerts", "aiRecommendations", "preferredCategories", "budgetPreference", "deliveryPreference", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT ("userId") DO UPDATE SET
         "priceAlerts" = EXCLUDED."priceAlerts",
         "aiRecommendations" = EXCLUDED."aiRecommendations",
         "preferredCategories" = EXCLUDED."preferredCategories",
         "budgetPreference" = EXCLUDED."budgetPreference",
         "deliveryPreference" = EXCLUDED."deliveryPreference",
         "updatedAt" = NOW()
       RETURNING "priceAlerts", "aiRecommendations", "preferredCategories", "budgetPreference", "deliveryPreference"`,
      [
        session.userId,
        priceAlerts,
        aiRecommendations,
        preferredCategories,
        budgetPreference,
        deliveryPreference,
      ]
    );

    return NextResponse.json(rows[0]);
  } catch (err: any) {
    console.error('[ai-preferences PUT] error:', err.message);
    return NextResponse.json({ error: 'Failed to save AI preferences' }, { status: 500 });
  }
}
