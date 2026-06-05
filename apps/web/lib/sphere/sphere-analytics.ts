/**
 * Sphere Analytics — Measurement layer for the 3D Discovery Sphere.
 *
 * Tracks:
 *  - Sphere engagement time (how long expanded)
 *  - Click-through rate (items clicked / items shown)
 *  - Item click events (which discovery items get clicked)
 *  - Repeat usage (how many times sphere is opened per session)
 *  - Conversion tracking (click → filter applied → purchase)
 *
 * Storage: sessionStorage for current session, posts to /api/analytics when available.
 */

const STORAGE_KEY = '__dc_sphere_analytics';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SphereEngagementEvent {
  type: 'expand' | 'dock' | 'item_click' | 'hover' | 'backdrop_dismiss';
  timestamp: number;
  itemId?: string;
  itemType?: string;
  itemTitle?: string;
}

export interface SphereSessionMetrics {
  expandCount: number;
  totalEngagementMs: number;
  itemClicks: number;
  itemImpressions: number;
  hoverCount: number;
  backdropDismisses: number;
  clickedItems: Array<{ id: string; title: string; type: string; timestamp: number }>;
  sessionStart: number;
}

// ── In-memory state ──────────────────────────────────────────────────────────

let _metrics: SphereSessionMetrics = createFreshMetrics();
let _expandStartTime: number | null = null;

function createFreshMetrics(): SphereSessionMetrics {
  return {
    expandCount: 0,
    totalEngagementMs: 0,
    itemClicks: 0,
    itemImpressions: 0,
    hoverCount: 0,
    backdropDismisses: 0,
    clickedItems: [],
    sessionStart: Date.now(),
  };
}

// ── Persistence ──────────────────────────────────────────────────────────────

function save(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(_metrics));
  } catch {
    /* quota exceeded */
  }
}

function load(): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) _metrics = JSON.parse(raw);
  } catch {
    _metrics = createFreshMetrics();
  }
}

// Auto-load
if (typeof window !== 'undefined') load();

// ── Public API: Recording ─────────────────────────────────────────────────────

export function trackSphereExpand(): void {
  _metrics.expandCount++;
  _expandStartTime = Date.now();
  save();
}

export function trackSphereDock(): void {
  if (_expandStartTime) {
    _metrics.totalEngagementMs += Date.now() - _expandStartTime;
    _expandStartTime = null;
  }
  save();
}

export function trackItemClick(itemId: string, itemTitle: string, itemType: string): void {
  _metrics.itemClicks++;
  _metrics.clickedItems.push({
    id: itemId,
    title: itemTitle,
    type: itemType,
    timestamp: Date.now(),
  });
  // Keep only last 50 clicks
  if (_metrics.clickedItems.length > 50) {
    _metrics.clickedItems = _metrics.clickedItems.slice(-50);
  }
  save();

  // Fire analytics event if API available
  postAnalyticsEvent('click', { itemId, itemTitle, itemType, source: 'sphere' });
}

export function trackItemHover(): void {
  _metrics.hoverCount++;
  // Don't save on every hover — batch it
}

export function trackBackdropDismiss(): void {
  _metrics.backdropDismisses++;
  trackSphereDock();
}

export function trackItemImpressions(count: number): void {
  _metrics.itemImpressions += count;
  save();
}

// ── Public API: Getters ─────────────────────────────────────────────────────

export function getSphereMetrics(): SphereSessionMetrics {
  return { ..._metrics };
}

export function getSphereClickThroughRate(): number {
  if (_metrics.itemImpressions === 0) return 0;
  return _metrics.itemClicks / _metrics.itemImpressions;
}

export function getAverageEngagementTime(): number {
  if (_metrics.expandCount === 0) return 0;
  return _metrics.totalEngagementMs / _metrics.expandCount;
}

export function getRepeatUsageCount(): number {
  return _metrics.expandCount;
}

export function resetSphereMetrics(): void {
  _metrics = createFreshMetrics();
  _expandStartTime = null;
  save();
}

// ── Analytics API integration ────────────────────────────────────────────────

async function postAnalyticsEvent(eventType: string, data: Record<string, string>): Promise<void> {
  try {
    await fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: eventType,
        ...data,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch {
    /* silently fail — analytics should never break UX */
  }
}
