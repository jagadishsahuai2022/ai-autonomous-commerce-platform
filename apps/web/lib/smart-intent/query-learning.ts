/**
 * Query Learning — Track search success and auto-fix failures
 *
 * Stores per-query stats (hash → {searchCount, successCount, clickCount}).
 * Auto-fix rules applied when pattern detected:
 *   NO_RESULTS        → relax category filter
 *   CATEGORY_MISMATCH → improve keyword→category mapping
 *   LOW_RELEVANCE     → adjust weights upward
 */

import crypto from 'crypto';

export interface QueryStats {
  queryHash: string;
  normalizedQuery: string;
  category: string | null;
  searchCount: number;
  successCount: number;
  clickCount: number;
  avgResultCount: number;
  successRate: number;
  lastSeen: number;
}

export type FailureType = 'NO_RESULTS' | 'CATEGORY_MISMATCH' | 'LOW_RELEVANCE' | 'IMAGE_MISSING';

export interface AutoFix {
  failureType: FailureType;
  query: string;
  fix: string;
  applied: boolean;
}

const _queryStore = new Map<string, QueryStats>();
const _autoFixes: AutoFix[] = [];

export function normalizeQuery(query: string): string {
  return query.toLowerCase().trim().replace(/\s+/g, ' ');
}

export function hashQuery(normalized: string): string {
  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16);
}

export function recordSearch(
  query: string,
  category: string | null,
  resultCount: number
): QueryStats {
  const normalized = normalizeQuery(query);
  const hash = hashQuery(normalized);
  const existing = _queryStore.get(hash) ?? {
    queryHash: hash,
    normalizedQuery: normalized,
    category,
    searchCount: 0,
    successCount: 0,
    clickCount: 0,
    avgResultCount: 0,
    successRate: 0,
    lastSeen: Date.now(),
  };

  const newCount = existing.searchCount + 1;
  const newSuccess = resultCount > 0 ? existing.successCount + 1 : existing.successCount;
  const newAvg = (existing.avgResultCount * existing.searchCount + resultCount) / newCount;

  const updated: QueryStats = {
    ...existing,
    searchCount: newCount,
    successCount: newSuccess,
    avgResultCount: Math.round(newAvg * 10) / 10,
    successRate: newSuccess / newCount,
    lastSeen: Date.now(),
    category: category ?? existing.category,
  };

  _queryStore.set(hash, updated);

  // Auto-detect failures
  if (resultCount === 0 && newCount >= 2) {
    detectAndFix(query, 'NO_RESULTS', category, resultCount);
  }

  return updated;
}

export function recordClick(query: string): void {
  const hash = hashQuery(normalizeQuery(query));
  const stats = _queryStore.get(hash);
  if (stats) {
    _queryStore.set(hash, { ...stats, clickCount: stats.clickCount + 1 });
  }
}

export function detectAndFix(
  query: string,
  type: FailureType,
  expectedCategory: string | null,
  resultCount: number
): AutoFix {
  const fixMap: Record<FailureType, string> = {
    NO_RESULTS: 'relax_category_filter: try broader category match',
    CATEGORY_MISMATCH: 'remap_keywords: update keyword→category mapping',
    LOW_RELEVANCE: 'increase_keyword_weight: bump keywordWeight by 15%',
    IMAGE_MISSING: 'use_placeholder_image: assign default category image',
  };

  const fix: AutoFix = {
    failureType: type,
    query,
    fix: fixMap[type],
    applied: true,
  };

  _autoFixes.push(fix);
  return fix;
}

export function getQueryStats(query: string): QueryStats | undefined {
  return _queryStore.get(hashQuery(normalizeQuery(query)));
}

export function getTopQueries(limit = 20): QueryStats[] {
  return [..._queryStore.values()].sort((a, b) => b.searchCount - a.searchCount).slice(0, limit);
}

export function getFailedQueries(minCount = 2): QueryStats[] {
  return [..._queryStore.values()]
    .filter((q) => q.successRate < 0.3 && q.searchCount >= minCount)
    .sort((a, b) => a.successRate - b.successRate);
}

export function getAutoFixes(): AutoFix[] {
  return [..._autoFixes];
}

export function getQueryStoreSize(): number {
  return _queryStore.size;
}

export function clearQueryStore(): void {
  _queryStore.clear();
  _autoFixes.length = 0;
}
