/**
 * POST /api/track/event
 *
 * Records user behavior events for the closed-loop learning system.
 * Updates: ProductLearning (in-memory + async DB), QueryLearning, SignalProcessor.
 *
 * Body: {
 *   type: 'impression' | 'click' | 'cart_add' | 'purchase' | 'bounce' | 'search'
 *   productId?: number
 *   query?: string
 *   category?: string
 *   price?: number
 *   sessionId?: string
 *   resultCount?: number      // for 'search' events
 *   success?: boolean         // for 'search' events
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { recordEvent } from '@/lib/smart-intent/signal-processor';
import { recordSearch, recordClick } from '@/lib/smart-intent/query-learning';
import { updateMetricsFromEvent } from '@/lib/smart-intent/business-metrics';

// In-memory product learning store (lightweight, synced to DB asynchronously)
const productLearning = new Map<
  number,
  {
    impressions: number;
    clicks: number;
    cartAdds: number;
    purchases: number;
  }
>();

function getOrInit(productId: number) {
  let rec = productLearning.get(productId);
  if (!rec) {
    rec = { impressions: 0, clicks: 0, cartAdds: 0, purchases: 0 };
    productLearning.set(productId, rec);
  }
  return rec;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json()) as {
      type: string;
      productId?: number;
      query?: string;
      category?: string;
      price?: number;
      sessionId?: string;
      resultCount?: number;
      success?: boolean;
    };

    const { type, productId, query, category, price, sessionId, resultCount, success } = body;

    // Validate event type
    const validTypes = ['impression', 'click', 'cart_add', 'purchase', 'bounce', 'search'];
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: 'Invalid event type' }, { status: 400 });
    }

    // Record in signal processor (windowed metrics)
    recordEvent(type as Parameters<typeof recordEvent>[0], {
      revenue: type === 'purchase' && price ? price : undefined,
      success:
        type === 'search' ? (success ?? (resultCount !== undefined && resultCount > 0)) : undefined,
    });

    // Product-level learning
    if (productId && productId > 0) {
      const rec = getOrInit(productId);
      switch (type) {
        case 'impression':
          rec.impressions++;
          break;
        case 'click':
          rec.clicks++;
          break;
        case 'cart_add':
          rec.cartAdds++;
          break;
        case 'purchase':
          rec.purchases++;
          break;
      }

      // Update business metrics in-memory store
      if (type === 'click') updateMetricsFromEvent(String(productId), 'click');
      if (type === 'cart_add') updateMetricsFromEvent(String(productId), 'add_to_cart');
      if (type === 'purchase') updateMetricsFromEvent(String(productId), 'purchase');
    }

    // Query learning
    if (type === 'search' && query) {
      recordSearch(query, category ?? null, resultCount ?? 0);
    }
    if (type === 'click' && query) {
      recordClick(query);
    }

    // Async DB update (fire-and-forget — non-blocking)
    if (productId && (type === 'click' || type === 'cart_add' || type === 'purchase')) {
      scheduleDbUpdate(productId, type).catch(() => {
        /* swallow - non-critical */
      });
    }

    return NextResponse.json({ ok: true, type, productId: productId ?? null });
  } catch (err) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
}

export async function GET(): Promise<NextResponse> {
  // Return current in-memory learning stats (monitoring endpoint)
  const topProducts = [...productLearning.entries()]
    .map(([id, rec]) => ({
      productId: id,
      ...rec,
      ctr: rec.impressions > 0 ? Math.round((rec.clicks / rec.impressions) * 10000) / 10000 : 0,
    }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 20);

  return NextResponse.json({
    totalTrackedProducts: productLearning.size,
    topProducts,
  });
}

// ── Async DB update ──────────────────────────────────────────────────────────

const DB_URL = process.env.DATABASE_URL ?? 'postgresql://admin:password@localhost:5432/delegatecart';

async function scheduleDbUpdate(productId: number, eventType: string): Promise<void> {
  // Use raw pg driver to avoid Prisma 7.x config issues in Next.js routes
  const apiUrl =
    process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  // Delegate to NestJS API for DB writes (it already has Prisma configured)
  try {
    await fetch(`${apiUrl}/products/${productId}/learn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventType }),
      signal: AbortSignal.timeout(2000),
    });
  } catch {
    // Non-critical — in-memory data is the source of truth for current session
  }
}
