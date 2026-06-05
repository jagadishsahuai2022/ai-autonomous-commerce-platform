/**
 * GET /api/monitoring
 *
 * Returns real-time system health metrics:
 *   - signal processor windowed metrics
 *   - auto-tuning weights version
 *   - query learning stats
 *   - DB connectivity status
 */

import { NextResponse } from 'next/server';
import { getWindowedMetrics } from '@/lib/smart-intent/signal-processor';
import { getActiveWeights, getWeightsVersion } from '@/lib/smart-intent/auto-tuning';
import {
  getTopQueries,
  getFailedQueries,
  getQueryStoreSize,
} from '@/lib/smart-intent/query-learning';
import { getPriceCacheSize } from '@/lib/smart-intent/dynamic-pricing';

export async function GET(): Promise<NextResponse> {
  const signals = getWindowedMetrics();
  const weights = getActiveWeights();
  const weightsVersion = getWeightsVersion();
  const topQueries = getTopQueries(10);
  const failedQueries = getFailedQueries(2);
  const queryCacheSize = getQueryStoreSize();
  const priceCacheSize = getPriceCacheSize();

  // Health check DB
  let dbStatus = 'unknown';
  try {
    const apiBase =
      process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
    const res = await fetch(`${apiBase}/health`, { signal: AbortSignal.timeout(1500) });
    dbStatus = res.ok ? 'healthy' : 'degraded';
  } catch {
    dbStatus = 'unreachable';
  }

  const health = {
    status: dbStatus === 'healthy' ? 'healthy' : 'degraded',
    db: dbStatus,
    signals: {
      ctr: signals.ctr,
      conversionRate: signals.conversionRate,
      bounceRate: signals.bounceRate,
      querySuccessRate: signals.querySuccessRate,
      avgOrderValue: signals.avgOrderValue,
      windowAgeMs: signals.windowAgeMs,
    },
    autoTuning: {
      weightsVersion,
      weights,
    },
    queryLearning: {
      totalTracked: queryCacheSize,
      topQueries: topQueries.map((q) => ({
        query: q.normalizedQuery,
        searchCount: q.searchCount,
        successRate: q.successRate,
        category: q.category,
      })),
      failedQueries: failedQueries.map((q) => ({
        query: q.normalizedQuery,
        searchCount: q.searchCount,
        successRate: q.successRate,
      })),
    },
    pricing: {
      cachedDecisions: priceCacheSize,
    },
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(health);
}
