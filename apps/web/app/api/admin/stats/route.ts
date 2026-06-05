import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const [users, products, orders, sellers, learning, validations] = await Promise.all([
      query<{ count: string }>('SELECT COUNT(*) as count FROM "User"', []),
      query<{ count: string }>('SELECT COUNT(*) as count FROM "Product"', []),
      query<{ count: string }>('SELECT COUNT(*) as count FROM "Order"', []),
      query<{ count: string }>('SELECT COUNT(*) as count FROM "Seller"', []),
      query<{ count: string }>('SELECT COUNT(*) as count FROM "SmartIntentEngineResponse"', []),
      query<{ count: string }>('SELECT COUNT(*) as count FROM "ValidationSession"', []),
    ]);

    // Recent activity: orders in last 7 days
    const recentOrders = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM "Order" WHERE "createdAt" > NOW() - INTERVAL '7 days'`,
      [],
    );

    // Active sessions: validation sessions in last 24h
    const recentSessions = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM "ValidationSession" WHERE "createdAt" > NOW() - INTERVAL '24 hours'`,
      [],
    );

    return NextResponse.json({
      totalUsers: parseInt(users[0]?.count || '0', 10),
      totalProducts: parseInt(products[0]?.count || '0', 10),
      activeOrders: parseInt(orders[0]?.count || '0', 10),
      totalSellers: parseInt(sellers[0]?.count || '0', 10),
      learningRecords: parseInt(learning[0]?.count || '0', 10),
      validationSessions: parseInt(validations[0]?.count || '0', 10),
      recentOrders7d: parseInt(recentOrders[0]?.count || '0', 10),
      recentSessions24h: parseInt(recentSessions[0]?.count || '0', 10),
      pendingApprovals: 0,
      dataSource: 'database',
    });
  } catch (error: any) {
    console.error('[Admin Stats API] Error:', error.message);
    return NextResponse.json({
      totalUsers: 0,
      totalProducts: 0,
      activeOrders: 0,
      totalSellers: 0,
      learningRecords: 0,
      validationSessions: 0,
      recentOrders7d: 0,
      recentSessions24h: 0,
      pendingApprovals: 0,
      dataSource: 'unavailable',
      error: 'Database unavailable',
    });
  }
}
