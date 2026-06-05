import { NextRequest, NextResponse } from 'next/server';
import { validateSession, getAnalyticsSummary, getAiRecommendationStats, trackAnalyticsEvent } from '@/lib/db';

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
  const days = parseInt(searchParams.get('days') || '30', 10);

  const [summary, aiStats] = await Promise.all([
    getAnalyticsSummary(Math.min(days, 365)),
    getAiRecommendationStats(Math.min(days, 365)),
  ]);

  const totalRecs = parseInt(aiStats?.total_recommendations || '0', 10);
  const accepted = parseInt(aiStats?.accepted || '0', 10);
  const cartAdds = parseInt(summary.metrics?.add_to_cart_count || '0', 10);
  const purchases = parseInt(summary.metrics?.purchase_count || '0', 10);

  return NextResponse.json({
    period: `${days} days`,
    overview: {
      totalEvents: parseInt(summary.metrics?.total_events || '0', 10),
      uniqueUsers: parseInt(summary.metrics?.unique_users || '0', 10),
      addToCartCount: cartAdds,
      purchaseCount: purchases,
      searchCount: parseInt(summary.metrics?.search_count || '0', 10),
      conversionRate: cartAdds > 0 ? ((purchases / cartAdds) * 100).toFixed(1) : '0',
      aiRecommendationSuccessRate: totalRecs > 0 ? ((accepted / totalRecs) * 100).toFixed(1) : '0',
    },
    topProducts: summary.topProducts,
    dailyTrend: summary.dailyTrend,
    aiStats: {
      totalRecommendations: totalRecs,
      accepted,
      rejected: parseInt(aiStats?.rejected || '0', 10),
    },
  });
  } catch (err: any) {
    console.error('[analytics GET]', err.message);
    return NextResponse.json({ period: '30 days', overview: { totalEvents: 0, uniqueUsers: 0, addToCartCount: 0, purchaseCount: 0, searchCount: 0, conversionRate: '0', aiRecommendationSuccessRate: '0' }, topProducts: [], dailyTrend: [], aiStats: { totalRecommendations: 0, accepted: 0, rejected: 0 } });
  }
}

export async function POST(req: NextRequest) {
  try {
  const token = getToken(req);
  const session = token ? await validateSession(token) : null;
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  if (!body.eventType) return NextResponse.json({ error: 'eventType required' }, { status: 400 });

  const allowedEvents = ['page_view', 'search', 'add_to_cart', 'remove_from_cart', 'purchase', 'ai_recommendation', 'click', 'view'];
  if (!allowedEvents.includes(body.eventType)) {
    return NextResponse.json({ error: 'Invalid eventType' }, { status: 400 });
  }

  await trackAnalyticsEvent(body.eventType, session.userId, body.productId ?? null, body.metadata ?? {});
  return NextResponse.json({ tracked: true });
  } catch (err: any) {
    console.error('[analytics POST]', err.message);
    return NextResponse.json({ tracked: false }, { status: 202 });
  }
}
