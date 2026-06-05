import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  // ── 1. User analytics ────────────────────────────────────────────────────
  let usersByRole: { role: string; count: string }[] = [];
  let userSignupTrend: { day: string; count: string }[] = [];
  try {
    usersByRole = await query<{ role: string; count: string }>(
      `SELECT COALESCE("role", 'customer') as role, COUNT(*) as count FROM "User" GROUP BY "role" ORDER BY count DESC`,
      [],
    );
    userSignupTrend = await query<{ day: string; count: string }>(
      `SELECT DATE("createdAt") as day, COUNT(*) as count FROM "User"
       WHERE "createdAt" > NOW() - INTERVAL '30 days'
       GROUP BY DATE("createdAt") ORDER BY day`,
      [],
    );
  } catch (e: any) {
    console.error('[Analytics] users query failed:', e.message);
  }

  // ── 2. Order analytics ────────────────────────────────────────────────────
  let ordersByStatus: { status: string; count: string }[] = [];
  let orderTrend: { day: string; count: string; total: string }[] = [];
  let topUsersBySpend: { name: string; email: string; total: string; count: string }[] = [];
  try {
    ordersByStatus = await query<{ status: string; count: string }>(
      `SELECT COALESCE("status", 'pending') as status, COUNT(*) as count FROM "Order" GROUP BY "status" ORDER BY count DESC`,
      [],
    );
    orderTrend = await query<{ day: string; count: string; total: string }>(
      `SELECT DATE("createdAt") as day, COUNT(*) as count, COALESCE(SUM("total"), 0) as total FROM "Order"
       WHERE "createdAt" > NOW() - INTERVAL '30 days'
       GROUP BY DATE("createdAt") ORDER BY day`,
      [],
    );
    topUsersBySpend = await query<{ name: string; email: string; total: string; count: string }>(
      `SELECT u."displayName" as name, u."email", COALESCE(SUM(o."total"), 0) as total, COUNT(o.id) as count
       FROM "Order" o JOIN "User" u ON o."userId" = u.id
       GROUP BY u.id, u."displayName", u."email"
       ORDER BY total DESC LIMIT 20`,
      [],
    );
  } catch (e: any) {
    console.error('[Analytics] orders query failed:', e.message);
  }

  // ── 3. Learning / AI analytics ────────────────────────────────────────────
  let learningByDay: { day: string; count: string }[] = [];
  let learningByUser: { user: string; count: string }[] = [];
  let topQueries: { query: string; count: string }[] = [];
  let aiEnrichmentStats: { total: string; enriched: string; active: string }[] = [];
  try {
    learningByDay = await query<{ day: string; count: string }>(
      `SELECT DATE("createdAt") as day, COUNT(*) as count FROM "SmartIntentEngineResponse"
       WHERE "createdAt" > NOW() - INTERVAL '30 days'
       GROUP BY DATE("createdAt") ORDER BY day`,
      [],
    );
    learningByUser = await query<{ user: string; count: string }>(
      `SELECT COALESCE("queryBy", 'anonymous') as user, COUNT(*) as count FROM "SmartIntentEngineResponse"
       GROUP BY "queryBy" ORDER BY count DESC LIMIT 20`,
      [],
    );
    topQueries = await query<{ query: string; count: string }>(
      `SELECT "queryText" as query, COUNT(*) as count FROM "SmartIntentEngineResponse"
       WHERE "isActive" = true
       GROUP BY "queryText" ORDER BY count DESC LIMIT 20`,
      [],
    );
    aiEnrichmentStats = await query<{ total: string; enriched: string; active: string }>(
      `SELECT COUNT(*) as total,
              SUM(CASE WHEN "enhancedByAI" = true THEN 1 ELSE 0 END) as enriched,
              SUM(CASE WHEN "isActive" = true THEN 1 ELSE 0 END) as active
       FROM "SmartIntentEngineResponse"`,
      [],
    );
  } catch (e: any) {
    console.error('[Analytics] learning query failed:', e.message);
  }

  // ── 4. Validation session analytics ──────────────────────────────────────
  let validationTrend: { day: string; count: string }[] = [];
  let validationByUser: { user: string; count: string }[] = [];
  try {
    validationTrend = await query<{ day: string; count: string }>(
      `SELECT DATE("createdAt") as day, COUNT(*) as count FROM "ValidationSession"
       WHERE "createdAt" > NOW() - INTERVAL '30 days'
       GROUP BY DATE("createdAt") ORDER BY day`,
      [],
    );
    validationByUser = await query<{ user: string; count: string }>(
      `SELECT COALESCE("userExternalId", 'anonymous') as user, COUNT(*) as count FROM "ValidationSession"
       GROUP BY "userExternalId" ORDER BY count DESC LIMIT 20`,
      [],
    );
  } catch (e: any) {
    console.error('[Analytics] validation query failed:', e.message);
  }

  // ── 5. Product catalog overview ───────────────────────────────────────────
  let productsByCategory: { category: string; count: string }[] = [];
  let lowStockProducts: { name: string; stock: string; category: string }[] = [];
  try {
    productsByCategory = await query<{ category: string; count: string }>(
      `SELECT COALESCE("category", 'Uncategorized') as category, COUNT(*) as count FROM "Product"
       GROUP BY "category" ORDER BY count DESC LIMIT 20`,
      [],
    );
  } catch (e: any) {
    console.error('[Analytics] products query failed:', e.message);
  }
  try {
    const stockCol = await query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'Product' AND column_name = 'stock'`,
      [],
    );
    if (stockCol.length > 0) {
      lowStockProducts = await query<{ name: string; stock: string; category: string }>(
        `SELECT "name", COALESCE("stock", 0) as stock, COALESCE("category", '') as category
         FROM "Product" WHERE COALESCE("stock", 0) < 10
         ORDER BY stock ASC LIMIT 100`,
        [],
      );
    }
  } catch { /* silent */ }

  return NextResponse.json({
    dataSource: 'database',
    users: {
      byRole: usersByRole.map(r => ({ role: r.role, count: parseInt(r.count, 10) })),
      signupTrend: userSignupTrend.map(r => ({ day: r.day, count: parseInt(r.count, 10) })),
    },
    orders: {
      byStatus: ordersByStatus.map(r => ({ status: r.status, count: parseInt(r.count, 10) })),
      trend: orderTrend.map(r => ({ day: r.day, count: parseInt(r.count, 10), total: parseFloat(r.total) })),
      topUsers: topUsersBySpend.map(r => ({ name: r.name, email: r.email, total: parseFloat(r.total), count: parseInt(r.count, 10) })),
    },
    learning: {
      trend: learningByDay.map(r => ({ day: r.day, count: parseInt(r.count, 10) })),
      byUser: learningByUser.map(r => ({ user: r.user, count: parseInt(r.count, 10) })),
      topQueries: topQueries.map(r => ({ query: r.query, count: parseInt(r.count, 10) })),
      stats: {
        total: parseInt(aiEnrichmentStats[0]?.total || '0', 10),
        enriched: parseInt(aiEnrichmentStats[0]?.enriched || '0', 10),
        active: parseInt(aiEnrichmentStats[0]?.active || '0', 10),
      },
    },
    validation: {
      trend: validationTrend.map(r => ({ day: r.day, count: parseInt(r.count, 10) })),
      byUser: validationByUser.map(r => ({ user: r.user, count: parseInt(r.count, 10) })),
    },
    products: {
      byCategory: productsByCategory.map(r => ({ category: r.category, count: parseInt(r.count, 10) })),
      lowStock: lowStockProducts.map(r => ({ name: r.name, stock: parseInt(r.stock, 10), category: r.category })),
    },
  });
}
