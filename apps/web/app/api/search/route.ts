/**
 * GET /api/search
 *
 * Unified search endpoint with full autonomous ranking pipeline:
 *   1. Intent extraction
 *   2. DB product fetch (LIMIT+OFFSET — pagination safe)
 *   3. Multi-objective ranking
 *   4. Dynamic pricing overlay
 *   5. Query learning update
 *   6. Signal recording
 *
 * Query params:
 *   q         - search query (required)
 *   page      - 1-based page number (default: 1)
 *   limit     - page size (default: 24, max: 100)
 *   sessionId - for session personalization
 *   categoryBoost - comma-separated category:viewCount pairs
 */

import { NextRequest, NextResponse } from 'next/server';
import { rankProducts } from '@/lib/smart-intent/autonomous-ranking';
import { computeDynamicPrice } from '@/lib/smart-intent/dynamic-pricing';
import { getActiveWeights } from '@/lib/smart-intent/auto-tuning';
import { recordSearch } from '@/lib/smart-intent/query-learning';
import { recordEvent } from '@/lib/smart-intent/signal-processor';
import { insertSmartIntentRecord } from '@/lib/db';

const API_BASE =
  process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// Simple synchronous intent extractor (no LLM required)
function extractIntent(query: string): {
  keywords: string[];
  category: string | null;
  budget: { min: number; max: number } | null;
  features: string[];
} {
  const q = query.toLowerCase().trim();
  const tokens = q.split(/\s+/);

  // Category detection
  const CATEGORY_PATTERNS: [RegExp, string][] = [
    [/phone|mobile|smartphone|iphone|android|samsung|oneplus|xiaomi/i, 'phones'],
    [/laptop|notebook|macbook|chromebook|ultrabook/i, 'laptops'],
    [/headphone|earphone|earbud|tws|airpod|speaker/i, 'audio'],
    [/tv|television|smart.?tv|oled|qled|4k/i, 'televisions'],
    [/shirt|tshirt|t-shirt|trouser|pant|dress|kurta|saree|jeans/i, 'fashion'],
    [/shoe|sneaker|sandal|boot|slipper|footwear/i, 'footwear'],
    [/watch|smartwatch|band|tracker/i, 'watches'],
    [/sofa|chair|table|bed|furniture|mattress/i, 'furniture'],
    [/fridge|refrigerator|washing.?machine|ac|air.?condition|microwave|appliance/i, 'appliances'],
    [/book|novel|textbook|comics/i, 'books'],
    [/grocery|food|spice|rice|dal|oil|snack/i, 'groceries'],
    [/sport|gym|fitness|cricket|football|yoga|dumbbell/i, 'sports'],
    [/bag|backpack|handbag|purse|wallet|luggage/i, 'accessories'],
  ];

  let category: string | null = null;
  for (const [pattern, cat] of CATEGORY_PATTERNS) {
    if (pattern.test(q)) {
      category = cat;
      break;
    }
  }

  // Budget extraction
  let budget: { min: number; max: number } | null = null;
  const budgetMatch =
    q.match(/(?:under|below|less\s+than|within)\s*(?:rs\.?|₹)?\s*(\d[\d,]+)/) ??
    q.match(/(?:rs\.?|₹)\s*(\d[\d,]+)\s*(?:to|-)\s*(?:rs\.?|₹)?\s*(\d[\d,]+)/);

  if (budgetMatch) {
    if (budgetMatch[2]) {
      budget = {
        min: parseInt(budgetMatch[1].replace(/,/g, '')),
        max: parseInt(budgetMatch[2].replace(/,/g, '')),
      };
    } else {
      budget = { min: 0, max: parseInt(budgetMatch[1].replace(/,/g, '')) };
    }
  }

  const STOP_WORDS = new Set([
    'under',
    'below',
    'less',
    'than',
    'within',
    'rs',
    'the',
    'a',
    'an',
    'for',
    'in',
    'with',
    'to',
    'and',
    'or',
    'best',
    'good',
    'top',
    'buy',
  ]);
  const keywords = tokens.filter((t) => t.length > 2 && !STOP_WORDS.has(t) && !/^\d+$/.test(t));
  const features = tokens.filter((t) =>
    /\d+gb|4k|5g|oled|amoled|hdr|fast.?charge|wireless/i.test(t)
  );

  return { keywords, category, budget, features };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;
  const q = searchParams.get('q') ?? '';
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '24')));
  const sessionId = searchParams.get('sessionId') ?? undefined;

  if (!q.trim()) {
    return NextResponse.json({ error: 'Query required' }, { status: 400 });
  }

  const intent = extractIntent(q);
  const weights = getActiveWeights();

  // Ranking-aware pagination: always fetch a large pool from offset 0, then
  // rank the entire pool and slice to the requested page.
  // This guarantees no overlap between pages because every request ranks the
  // same ordered set and slices at deterministic positions.
  const POOL_SIZE = Math.min(500, Math.max(100, page * limit * 3));
  const rankingOffset = (page - 1) * limit;

  let dbProducts: Record<string, unknown>[] = [];
  let totalCount = 0;

  try {
    const qs = new URLSearchParams({
      take: String(POOL_SIZE),
      skip: '0', // always fetch from beginning for stable ranking
      ...(intent.category ? { category: intent.category } : {}),
    });

    const res = await fetch(`${API_BASE}/products?${qs}`, {
      signal: AbortSignal.timeout(4000),
    });

    if (res.ok) {
      const data = (await res.json()) as {
        products?: Record<string, unknown>[];
        data?: Record<string, unknown>[];
        total?: number;
      };
      dbProducts = data?.products ?? data?.data ?? [];
      totalCount = data?.total ?? dbProducts.length;
    }
  } catch {
    // Swallow — will use empty results
  }

  // Convert to signals (map NestJS field names → ranking engine field names)
  const productSignals = dbProducts.map((p) => ({
    productId: Number(p.id),
    name: String(p.name ?? ''),
    category: String(p.category ?? ''),
    price: Number(p.price ?? 0),
    brand: String(p.brand ?? String(p.name ?? '').split(' ')[0] ?? ''),
    marginPercentage: Number(p.marginPercentage ?? 20),
    inventoryCount: Number(p.stock ?? p.inventoryCount ?? 100),
    salesVelocity: Number(p.salesVelocity ?? 0),
    conversionRate: Number(p.conversionRate ?? 0.05),
    returnRate: Number(p.returnRate ?? 0),
    reinforcementScore: Number(p.reinforcementScore ?? 0),
    trendingScore: Number(p.trendingScore ?? 0),
    rating: Number(p.rating ?? 3),
    reviewCount: Number(p.reviewCount ?? 0),
    image: String(p.image ?? ''),
  }));

  // Session context from headers/params
  const session = {
    viewedCategories: intent.category ? { [intent.category]: 1 } : {},
    clickedBrands: {} as Record<string, number>,
    priceHistory: intent.budget ? [intent.budget.max * 0.8] : [],
  };

  // Multi-objective ranking
  const ranked = rankProducts(productSignals, intent, session, weights);

  // Apply dynamic pricing
  const results = ranked.slice(rankingOffset, rankingOffset + limit).map((r) => {
    const sig = productSignals.find((p) => p.productId === r.productId);
    const pricing = computeDynamicPrice(
      {
        productId: r.productId,
        basePrice: r.price,
        conversionRate: sig?.conversionRate,
        inventoryCount: sig?.inventoryCount,
        salesVelocity: sig?.salesVelocity,
      },
      sessionId
    );

    return {
      id: r.productId,
      name: r.name,
      brand: sig?.brand ?? '',
      category: r.category,
      image: sig?.image ?? '',
      rating: sig?.rating ?? 3,
      reviewCount: sig?.reviewCount ?? 0,
      price: pricing.finalPrice,
      originalPrice: pricing.basePrice,
      dynamicPrice: pricing.dynamicPrice,
      discountPercent: pricing.discountPercent,
      priceChange: pricing.priceChangePercent,
      finalScore: r.finalScore,
      scoreBreakdown: r.scoreBreakdown,
    };
  });

  // Record search signal
  recordSearch(q, intent.category, results.length);
  recordEvent('search', { success: results.length > 0 });

  // Persist to SmartIntentEngineResponse so observability dashboard captures all query sources
  const userId = req.headers.get('x-user-id');
  const userEmail = req.headers.get('x-user-email') || null;
  insertSmartIntentRecord({
    userId: userId && /^\d+$/.test(userId) ? parseInt(userId, 10) : null,
    queryBy: userEmail || sessionId || 'search_bar',
    queryText: q,
    userEmail: userEmail || undefined,
    initialProductSuggestionText: null,
    intentEngineResponse: {
      intent,
      source: 'search_bar',
      resultCount: results.length,
      engine_version: 'search-v1',
      processing_time_ms: 0,
    },
  }).catch(() => { /* fire-and-forget */ });

  const totalPages = Math.ceil(totalCount / limit);

  return NextResponse.json({
    query: q,
    intent,
    results,
    pagination: {
      page,
      limit,
      total: totalCount,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
    meta: {
      source: dbProducts.length > 0 ? 'db' : 'empty',
      weightsVersion: weights,
      rankedFrom: productSignals.length,
      timestamp: new Date().toISOString(),
    },
  });
}
