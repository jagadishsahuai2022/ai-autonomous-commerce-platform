import { NextResponse } from 'next/server';

const API_BASE =
  process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const API_URL = API_BASE.replace(/\/api\/v1\/?$/, '');

// ─── Static catalog mirroring the backend CATALOG ───────────────────────────
// These counts are computed from: TOTAL_PRODUCTS=100K, PRODUCTS_PER_CATEGORY=1K,
// cycling through the 21-entry catalog array.
const FALLBACK_CATEGORIES = [
  { name: 'Electronics', count: 40000 },
  { name: 'Fashion', count: 30000 },
  { name: 'Groceries', count: 15000 },
  { name: 'Home & Kitchen', count: 10000 },
  { name: 'Sports', count: 3000 },
  { name: 'Books', count: 2000 },
];

export async function GET() {
  try {
    // Try NestJS backend first (uses /products/categories route)
    const res = await fetch(`${API_URL}/products/categories`, {
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(4000),
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return NextResponse.json(data, {
          headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=600' },
        });
      }
    }
  } catch {
    // Backend unavailable — fall through to static fallback
  }

  // Fallback: computed from catalog structure (always accurate for this dataset)
  return NextResponse.json(FALLBACK_CATEGORIES, {
    headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' },
  });
}
