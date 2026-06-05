import { NextRequest, NextResponse } from 'next/server';
import { validateSession, getUserPreferences, upsertUserPreferences } from '@/lib/db';

function getToken(req: NextRequest): string {
  const auth = req.headers.get('authorization') || '';
  return auth.replace('Bearer ', '').trim() || req.cookies.get('authToken')?.value || '';
}

export async function GET(req: NextRequest) {
  try {
    const token = getToken(req);
    const session = token ? await validateSession(token) : null;
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const prefs = await getUserPreferences(session.userId);
    return NextResponse.json({
      preferences: prefs || {
        preferredCategories: [],
        priceRange: { min: 0, max: 100000 },
        brands: [],
        interactionHistory: [],
      },
    });
  } catch (err: any) {
    console.error('[preferences GET]', err.message);
    return NextResponse.json({ preferences: { preferredCategories: [], priceRange: { min: 0, max: 100000 }, brands: [], interactionHistory: [] } });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const token = getToken(req);
    const session = token ? await validateSession(token) : null;
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const result = await upsertUserPreferences(session.userId, {
      preferredCategories: body.preferredCategories,
      priceRange: body.priceRange,
      brands: body.brands,
      interactionHistory: body.interactionHistory,
    });
    return NextResponse.json({ preferences: result });
  } catch (err: any) {
    console.error('[preferences PUT]', err.message);
    return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 });
  }
}
