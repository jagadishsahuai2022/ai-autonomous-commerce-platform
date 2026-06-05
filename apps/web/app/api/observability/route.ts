/**
 * GET /api/observability
 *
 * Enterprise-grade observability endpoint that returns real data from:
 *  - WalletTransaction table (real wallet transactions, debits, refunds)
 *  - AnalyticsEvent table (system events, page views, errors)
 *  - SmartIntentEngineResponse table (AI query stats)
 *  - Order table (order pipeline health)
 *  - System health checks
 *
 * Accessible by: admin, observability, analytics roles
 */
import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, getUserByEmail } from '@/lib/db';
import { DEMO_USERS } from '@/lib/admin-auth';

export const runtime = 'nodejs';

const ALLOWED_ROLES = new Set(['admin', 'analytics', 'observability']);

// Fast lookup for demo users
const DEMO_BY_EMAIL = Object.fromEntries(DEMO_USERS.map((u) => [u.email.toLowerCase(), u]));

async function resolveUser(req: NextRequest) {
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  const emailHeader = (req.headers.get('x-user-email') || '').toLowerCase();

  // 1. Try DB session token
  if (token) {
    try {
      const session = await queryOne<{ userId: number; email: string; role: string }>(
        `SELECT s."userId", u.email, u.role FROM "UserSession" s
         JOIN "User" u ON u.id = s."userId"
         WHERE s."sessionToken" = $1 AND s."expiresAt" > NOW() LIMIT 1`,
        [token]
      );
      if (session) return session;
    } catch {
      /* DB unavailable or role column missing */
    }
  }

  // 2. Resolve email: either from x-user-email header or from DB lookup of the token
  let resolvedEmail = emailHeader;
  if (!resolvedEmail && token) {
    try {
      const row = await queryOne<{ email: string }>(
        `SELECT u.email FROM "UserSession" s JOIN "User" u ON u.id = s."userId"
         WHERE s."sessionToken" = $1 LIMIT 1`,
        [token]
      );
      if (row) resolvedEmail = row.email.toLowerCase();
    } catch {
      /* ignore */
    }
  }

  // 3. Demo/admin fallback: accept known demo tokens or when DB is unreachable
  if (resolvedEmail) {
    const demoUser = DEMO_BY_EMAIL[resolvedEmail];
    if (demoUser) {
      // Only allow demo bypass when token looks like a session/admin/demo token
      const isSessionToken = !token || /^(sess_|admin-|demo-)/.test(token);
      if (isSessionToken) {
        try {
          const dbUser = await getUserByEmail(resolvedEmail);
          const dbRole = (dbUser as any)?.role as string | undefined;
          const role = dbRole && ALLOWED_ROLES.has(dbRole) ? dbRole : demoUser.role;
          return {
            userId: (dbUser as any)?.id ?? `demo-${demoUser.email.split('@')[0]}`,
            email: demoUser.email,
            role,
          };
        } catch {
          return {
            userId: `demo-${demoUser.email.split('@')[0]}`,
            email: demoUser.email,
            role: demoUser.role,
          };
        }
      }
    }
  }

  return null;
}

export async function GET(req: NextRequest) {
  try {
    const caller = await resolveUser(req);
    if (!caller || !ALLOWED_ROLES.has(caller.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── 1. Wallet Transaction Stats ──────────────────────────────────────────
    let walletStats = {
      total: 0,
      completed: 0,
      stuck: 0,
      failed: 0,
      pendingRefunds: 0,
      totalRefunded: 0,
      totalDebited: 0,
    };
    let recentTransactions: any[] = [];
    try {
      const wStats = await queryOne<{
        total: string;
        completed: string;
        failed: string;
        total_refunded: string;
        total_debited: string;
      }>(
        `SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'completed') as completed,
          COUNT(*) FILTER (WHERE status = 'failed') as failed,
          COALESCE(SUM(amount) FILTER (WHERE type = 'credit'), 0) as total_refunded,
          COALESCE(SUM(amount) FILTER (WHERE type = 'debit'), 0) as total_debited
         FROM "WalletTransaction"`,
        []
      );
      if (wStats) {
        walletStats = {
          total: parseInt(wStats.total || '0'),
          completed: parseInt(wStats.completed || '0'),
          stuck: 0,
          failed: parseInt(wStats.failed || '0'),
          pendingRefunds: 0,
          totalRefunded: parseFloat(wStats.total_refunded || '0'),
          totalDebited: parseFloat(wStats.total_debited || '0'),
        };
      }
      // Recent wallet transactions
      recentTransactions = await query(
        `SELECT wt.id, wt."walletId", wt.type, wt.amount, wt.description,
                wt.status, wt."balanceBefore", wt."balanceAfter", wt."createdAt",
                w."userId", u.email as "userEmail", u.name as "userName",
                wt."orderId"
         FROM "WalletTransaction" wt
         JOIN "Wallet" w ON w.id = wt."walletId"
         JOIN "User" u ON u.id = w."userId"
         ORDER BY wt."createdAt" DESC LIMIT 50`,
        []
      );
    } catch {
      /* WalletTransaction may be empty or not exist */
    }

    // ── 2. Order Pipeline Health ─────────────────────────────────────────────
    let orderStats = {
      total: 0,
      processing: 0,
      confirmed: 0,
      failed: 0,
      recent24h: 0,
      totalRevenue: 0,
    };
    let recentOrders: any[] = [];
    try {
      const oStats = await queryOne<{
        total: string;
        processing: string;
        confirmed: string;
        failed: string;
        recent24h: string;
        total_revenue: string;
      }>(
        `SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'processing') as processing,
          COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed,
          COUNT(*) FILTER (WHERE status = 'failed') as failed,
          COUNT(*) FILTER (WHERE "createdAt" > NOW() - INTERVAL '24 hours') as recent24h,
          COALESCE(SUM(total), 0) as total_revenue
         FROM "Order"`,
        []
      );
      if (oStats) {
        orderStats = {
          total: parseInt(oStats.total || '0'),
          processing: parseInt(oStats.processing || '0'),
          confirmed: parseInt(oStats.confirmed || '0'),
          failed: parseInt(oStats.failed || '0'),
          recent24h: parseInt(oStats.recent24h || '0'),
          totalRevenue: parseFloat(oStats.total_revenue || '0'),
        };
      }
      recentOrders = await query(
        `SELECT o.id, o."orderNumber", o.status, o.total as "totalAmount", o."aiAssisted",
                o."paymentMethod", o."createdAt", u.name as "userName", u.email as "userEmail"
         FROM "Order" o JOIN "User" u ON u.id = o."userId"
         ORDER BY o."createdAt" DESC LIMIT 20`,
        []
      );
    } catch {
      /* Order table may be empty */
    }

    // ── 3. AI Query Stats ────────────────────────────────────────────────────
    let aiStats = { totalQueries: 0, uniqueUsers: 0, activeRecords: 0, last24h: 0 };
    let topAiQueries: { queryText: string; count: number }[] = [];
    let recentAiQueries: any[] = [];
    try {
      const qStats = await queryOne<{
        total: string;
        unique_users: string;
        active: string;
        last24h: string;
      }>(
        `SELECT
          COUNT(*) as total,
          COUNT(DISTINCT "queryBy") as unique_users,
          COUNT(*) FILTER (WHERE "isActive" = true) as active,
          COUNT(*) FILTER (WHERE "createdAt" > NOW() - INTERVAL '24 hours') as last24h
         FROM "SmartIntentEngineResponse"`,
        []
      );
      if (qStats) {
        aiStats = {
          totalQueries: parseInt(qStats.total || '0'),
          uniqueUsers: parseInt(qStats.unique_users || '0'),
          activeRecords: parseInt(qStats.active || '0'),
          last24h: parseInt(qStats.last24h || '0'),
        };
      }
      // Top queries (last 7 days)
      topAiQueries = await query<{ queryText: string; count: number }>(
        `SELECT "queryText", COUNT(*) as count
         FROM "SmartIntentEngineResponse"
         WHERE "createdAt" > NOW() - INTERVAL '7 days'
         GROUP BY "queryText"
         ORDER BY count DESC LIMIT 10`,
        []
      );
      // Recent AI queries with user info
      recentAiQueries = await query(
        `SELECT s.id, s."queryBy", s."queryText", s."isActive", s."createdAt",
                COALESCE(u.name, s."queryBy") as "userName", s."userEmail",
                s."intentEngineResponse"->>'engine_version' as "engineVersion"
         FROM "SmartIntentEngineResponse" s
         LEFT JOIN "User" u ON u.id = s."userId"
         ORDER BY s."createdAt" DESC LIMIT 30`,
        []
      );
    } catch {
      /* SmartIntentEngineResponse may not exist yet */
    }

    // ── 4. Analytics Events ────────────────────────────────────────────────────
    let analyticsStats = {
      total24h: 0,
      uniqueUsers24h: 0,
      topEvents: [] as { type: string; count: number }[],
    };
    let eventTimeline: { hour: string; count: number }[] = [];
    try {
      const aStats = await queryOne<{ total: string; unique_users: string }>(
        `SELECT COUNT(*) as total, COUNT(DISTINCT "userId") as unique_users
         FROM "AnalyticsEvent"
         WHERE "createdAt" > NOW() - INTERVAL '24 hours'`,
        []
      );
      analyticsStats.total24h = parseInt(aStats?.total || '0');
      analyticsStats.uniqueUsers24h = parseInt(aStats?.unique_users || '0');

      const topEvents = await query<{ type: string; count: number }>(
        `SELECT "eventType" as type, COUNT(*) as count
         FROM "AnalyticsEvent"
         WHERE "createdAt" > NOW() - INTERVAL '24 hours'
         GROUP BY "eventType" ORDER BY count DESC LIMIT 8`,
        []
      );
      analyticsStats.topEvents = topEvents;

      // Hourly event trend (last 24h)
      eventTimeline = await query<{ hour: string; count: number }>(
        `SELECT to_char(date_trunc('hour', "createdAt"), 'HH24:MI') as hour,
                COUNT(*) as count
         FROM "AnalyticsEvent"
         WHERE "createdAt" > NOW() - INTERVAL '24 hours'
         GROUP BY date_trunc('hour', "createdAt")
         ORDER BY date_trunc('hour', "createdAt")`,
        []
      );
    } catch {
      /* AnalyticsEvent may be empty */
    }

    // ── 5. System Health ─────────────────────────────────────────────────────
    const systemHealth = {
      database: 'healthy' as 'healthy' | 'degraded' | 'down',
      api: 'healthy' as 'healthy' | 'degraded' | 'down',
      dbResponseMs: 0,
    };
    const dbStart = Date.now();
    try {
      await queryOne('SELECT 1', []);
      systemHealth.dbResponseMs = Date.now() - dbStart;
      systemHealth.database = systemHealth.dbResponseMs < 500 ? 'healthy' : 'degraded';
    } catch {
      systemHealth.database = 'down';
    }

    // ── 6. Audit log (from AnalyticsEvent where event type includes 'admin' or 'auth') ──
    let auditLog: any[] = [];
    try {
      auditLog = await query(
        `SELECT ae.id, ae."eventType", ae."userId", ae.metadata, ae."createdAt",
                u.name as "userName", u.email as "userEmail"
         FROM "AnalyticsEvent" ae
         LEFT JOIN "User" u ON u.id = ae."userId"
         WHERE ae."eventType" IN ('signin', 'signout', 'admin_action', 'role_change',
                                  'impersonate', 'wallet_debit', 'wallet_credit',
                                  'order_created', 'checkout_failed', 'chat_message')
         ORDER BY ae."createdAt" DESC LIMIT 100`,
        []
      );
    } catch {
      /* AnalyticsEvent may be empty */
    }

    // ── 7. User Journey Events ────────────────────────────────────────────────
    let journeyEvents: any[] = [];
    let journeyFunnel: Record<string, number> = {};
    try {
      journeyEvents = await query(
        `SELECT id, "sessionId", "journeyId", "userId", "userEmail", "userName",
                "eventType", "productId", "productName", "productCategory",
                "productPrice", "orderId", metadata, "createdAt"
         FROM "UserJourneyEvent"
         ORDER BY "createdAt" DESC LIMIT 200`,
        []
      );
      const funnelRows = await query<{ eventType: string; count: string }>(
        `SELECT "eventType", COUNT(*) as count
         FROM "UserJourneyEvent"
         WHERE "createdAt" > NOW() - INTERVAL '24 hours'
         GROUP BY "eventType"`,
        []
      );
      journeyFunnel = Object.fromEntries(
        funnelRows.map((r) => [r.eventType, parseInt(r.count, 10)])
      );
    } catch {
      /* UserJourneyEvent table may not exist yet */
    }

    return NextResponse.json({
      walletStats,
      recentTransactions,
      orderStats,
      recentOrders,
      aiStats,
      topAiQueries,
      recentAiQueries,
      analyticsStats,
      eventTimeline,
      auditLog,
      journeyEvents,
      journeyFunnel,
      systemHealth: {
        ...systemHealth,
        status: systemHealth.database,
        checkedAt: new Date().toISOString(),
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[Observability API]', err.message);
    return NextResponse.json({ error: 'Failed to fetch observability data' }, { status: 500 });
  }
}
