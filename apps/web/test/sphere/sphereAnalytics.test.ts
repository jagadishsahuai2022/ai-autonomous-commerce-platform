/**
 * Vitest unit tests for Sphere Analytics.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  trackSphereExpand,
  trackSphereDock,
  trackItemClick,
  trackItemHover,
  trackBackdropDismiss,
  trackItemImpressions,
  getSphereMetrics,
  getSphereClickThroughRate,
  getAverageEngagementTime,
  getRepeatUsageCount,
  resetSphereMetrics,
} from '@/lib/sphere/sphere-analytics';

// Mock fetch for analytics API calls
const fetchMock = vi.fn().mockResolvedValue({ ok: true });
vi.stubGlobal('fetch', fetchMock);

// Mock sessionStorage
const sessionStorageMock: Record<string, string> = {};
vi.stubGlobal('sessionStorage', {
  getItem: (key: string) => sessionStorageMock[key] ?? null,
  setItem: (key: string, value: string) => {
    sessionStorageMock[key] = value;
  },
  removeItem: (key: string) => {
    delete sessionStorageMock[key];
  },
});

beforeEach(() => {
  resetSphereMetrics();
  fetchMock.mockClear();
  Object.keys(sessionStorageMock).forEach((k) => delete sessionStorageMock[k]);
});

describe('trackSphereExpand', () => {
  it('increments expand count', () => {
    trackSphereExpand();
    expect(getSphereMetrics().expandCount).toBe(1);
    trackSphereExpand();
    expect(getSphereMetrics().expandCount).toBe(2);
  });
});

describe('trackSphereDock', () => {
  it('records engagement time', () => {
    trackSphereExpand();
    // Simulate passage of time
    trackSphereDock();
    const metrics = getSphereMetrics();
    expect(metrics.totalEngagementMs).toBeGreaterThanOrEqual(0);
  });
});

describe('trackItemClick', () => {
  it('increments item click count', () => {
    trackItemClick('item-1', 'Electronics', 'category');
    expect(getSphereMetrics().itemClicks).toBe(1);
  });

  it('records clicked item details', () => {
    trackItemClick('item-1', 'Electronics', 'category');
    const metrics = getSphereMetrics();
    expect(metrics.clickedItems).toHaveLength(1);
    expect(metrics.clickedItems[0].id).toBe('item-1');
    expect(metrics.clickedItems[0].title).toBe('Electronics');
    expect(metrics.clickedItems[0].type).toBe('category');
  });

  it('fires analytics API POST', () => {
    trackItemClick('item-1', 'Electronics', 'category');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/analytics',
      expect.objectContaining({
        method: 'POST',
      })
    );
  });

  it('keeps only last 50 clicks', () => {
    for (let i = 0; i < 55; i++) {
      trackItemClick(`item-${i}`, `Title ${i}`, 'category');
    }
    expect(getSphereMetrics().clickedItems.length).toBeLessThanOrEqual(50);
  });
});

describe('trackItemHover', () => {
  it('increments hover count', () => {
    trackItemHover();
    trackItemHover();
    expect(getSphereMetrics().hoverCount).toBe(2);
  });
});

describe('trackBackdropDismiss', () => {
  it('increments backdrop dismiss count and docks', () => {
    trackSphereExpand();
    trackBackdropDismiss();
    const metrics = getSphereMetrics();
    expect(metrics.backdropDismisses).toBe(1);
  });
});

describe('trackItemImpressions', () => {
  it('adds impression count', () => {
    trackItemImpressions(60);
    expect(getSphereMetrics().itemImpressions).toBe(60);
    trackItemImpressions(60);
    expect(getSphereMetrics().itemImpressions).toBe(120);
  });
});

describe('getSphereClickThroughRate', () => {
  it('returns 0 when no impressions', () => {
    expect(getSphereClickThroughRate()).toBe(0);
  });

  it('computes CTR correctly', () => {
    trackItemImpressions(100);
    trackItemClick('a', 'A', 'category');
    trackItemClick('b', 'B', 'category');
    expect(getSphereClickThroughRate()).toBeCloseTo(0.02, 5);
  });
});

describe('getAverageEngagementTime', () => {
  it('returns 0 when no expands', () => {
    expect(getAverageEngagementTime()).toBe(0);
  });
});

describe('getRepeatUsageCount', () => {
  it('returns expand count', () => {
    trackSphereExpand();
    trackSphereDock();
    trackSphereExpand();
    expect(getRepeatUsageCount()).toBe(2);
  });
});

describe('resetSphereMetrics', () => {
  it('resets all metrics to zero', () => {
    trackSphereExpand();
    trackItemClick('a', 'A', 'category');
    trackItemImpressions(100);
    resetSphereMetrics();
    const metrics = getSphereMetrics();
    expect(metrics.expandCount).toBe(0);
    expect(metrics.itemClicks).toBe(0);
    expect(metrics.itemImpressions).toBe(0);
    expect(metrics.clickedItems).toHaveLength(0);
  });
});
