/**
 * GET /api/homepage
 *
 * Returns 4 autonomously-optimized homepage sections:
 *   - trending    (highest trendingScore)
 *   - recommended (best finalScore for default session)
 *   - deals       (highest discount / clearance)
 *   - top_rated   (highest businessScore)
 *
 * Reads from ProductBusinessMetrics + ProductLearning via NestJS backend,
 * falls back to mock if unavailable.
 */

import { NextRequest, NextResponse } from 'next/server';
import { rankProducts, computeBusinessScore } from '@/lib/smart-intent/autonomous-ranking';
import { computeDynamicPrice } from '@/lib/smart-intent/dynamic-pricing';
import { getWindowedMetrics } from '@/lib/smart-intent/signal-processor';

const API_BASE =
  process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const SECTION_LIMIT = 10;

async function fetchProductsFromDB(params: Record<string, string>): Promise<unknown[]> {
  try {
    const qs = new URLSearchParams({ take: '50', ...params });
    const res = await fetch(`${API_BASE}/products?${qs}`, {
      next: { revalidate: 60 }, // cache 60s
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { data?: unknown[] };
    return data?.data ?? [];
  } catch {
    return [];
  }
}

// Shape raw DB products into ProductSignals
function toSignals(raw: Record<string, unknown>[]): Parameters<typeof rankProducts>[0] {
  return raw.map((p) => ({
    productId: Number(p.id),
    name: String(p.name ?? ''),
    category: String(p.category ?? ''),
    price: Number(p.price ?? 0),
    brand: String(p.brand ?? p.name?.toString().split(' ')[0] ?? ''),
    rating: Number(p.rating ?? 4.0),
    reviewCount: Number(p.reviewCount ?? 100),
    marginPercentage: Number(p.marginPercentage ?? 20),
    inventoryCount: Number(p.inventoryCount ?? 100),
    salesVelocity: Number(p.salesVelocity ?? 0),
    conversionRate: Number(p.conversionRate ?? 0.05),
    returnRate: Number(p.returnRate ?? 0),
    reinforcementScore: Number(p.reinforcementScore ?? 0),
    trendingScore: Number(p.trendingScore ?? 0),
  }));
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const signals = getWindowedMetrics();

  const [allProducts] = await Promise.all([
    fetchProductsFromDB({ take: '200', orderBy: 'createdAt', order: 'desc' }),
  ]);

  const products = allProducts as Record<string, unknown>[];
  const productSignals = toSignals(products);

  if (productSignals.length === 0) {
    // Return empty sections with metadata
    return NextResponse.json({
      sections: {
        trending: [],
        recommended: [],
        deals: [],
        topRated: [],
      },
      meta: { source: 'empty', signals },
    });
  }

  // Rank with neutral intent for homepage
  const ranked = rankProducts(productSignals, {
    keywords: [],
    category: null,
    budget: null,
    features: [],
  });

  // ── Section 1: Trending (by trendingScore) ──────────────────────────────────
  const trending = [...productSignals]
    .sort((a, b) => (b.trendingScore ?? 0) - (a.trendingScore ?? 0))
    .slice(0, SECTION_LIMIT)
    .map((p) => ({
      ...p,
      pricing: computeDynamicPrice({
        productId: p.productId,
        basePrice: p.price,
        ...p,
      }),
    }));

  // ── Section 2: Recommended (best finalScore) ────────────────────────────────
  const recommended = ranked.slice(0, SECTION_LIMIT).map((r) => ({
    productId: r.productId,
    name: r.name,
    price: r.price,
    category: r.category,
    finalScore: r.finalScore,
    pricing: computeDynamicPrice({
      productId: r.productId,
      basePrice: r.price,
    }),
  }));

  // ── Section 3: Deals (highest discount) ────────────────────────────────────
  const deals = productSignals
    .map((p) => {
      const pricing = computeDynamicPrice({ productId: p.productId, basePrice: p.price, ...p });
      return { ...p, pricing, discount: pricing.discountPercent };
    })
    .filter((p) => p.discount > 0)
    .sort((a, b) => b.discount - a.discount)
    .slice(0, SECTION_LIMIT);

  // ── Section 4: Top Rated (businessScore) ────────────────────────────────────
  const topRated = productSignals
    .map((p) => ({
      ...p,
      bizScore: computeBusinessScore(p, 30),
      pricing: computeDynamicPrice({ productId: p.productId, basePrice: p.price, ...p }),
    }))
    .sort((a, b) => b.bizScore - a.bizScore)
    .slice(0, SECTION_LIMIT);

  return NextResponse.json({
    sections: {
      trending,
      recommended,
      deals,
      topRated,
    },
    meta: {
      source: products.length > 0 ? 'db' : 'mock',
      productCount: products.length,
      signals,
      timestamp: new Date().toISOString(),
    },
  });
}
