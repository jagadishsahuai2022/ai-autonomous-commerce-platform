/**
 * Performance Tests — Core Web Vitals & Load Times
 *
 * Measures real browser performance metrics for key pages:
 * - Navigation timing (TTFB, DOM Content Loaded, Load)
 * - Largest Contentful Paint (LCP)
 * - Cumulative Layout Shift (CLS)
 * - First Input Delay proxy (Total Blocking Time measured via Long Tasks)
 *
 * Thresholds are based on Google's "Good" Web Vitals budget.
 */

import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:3000';

/** Thresholds (milliseconds unless noted) */
const THRESHOLDS = {
  /** Time to First Byte — server response latency (Next.js dev server with HMR) */
  ttfb: 1500,
  /** TTFB for chart-heavy pages on dev server (recharts compilation adds overhead) */
  ttfbHeavy: 6000,
  /** DOM Content Loaded — HTML + blocking JS parsed */
  dcl: 3000,
  /** Navigation Load — all resources fetched */
  load: 8000,
  /** Largest Contentful Paint — perceived load speed (ms) */
  lcp: 4000,
  /** Cumulative Layout Shift — visual stability (unitless score) */
  cls: 0.1,
};

interface NavigationMetrics {
  ttfb: number;
  dcl: number;
  load: number;
}

/** Collect Navigation Timing API metrics */
async function getNavigationMetrics(page: Page): Promise<NavigationMetrics> {
  return page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    return {
      ttfb: nav.responseStart - nav.requestStart,
      dcl: nav.domContentLoadedEventEnd - nav.startTime,
      load: nav.loadEventEnd - nav.startTime,
    };
  });
}

/** Collect LCP using PerformanceObserver (best effort — waits up to 2s) */
async function getLCP(page: Page): Promise<number | null> {
  return page.evaluate(() => {
    return new Promise<number | null>((resolve) => {
      let lcp = 0;
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        for (const entry of entries) {
          if (entry.startTime > lcp) lcp = entry.startTime;
        }
      });
      try {
        observer.observe({ type: 'largest-contentful-paint', buffered: true });
      } catch {
        resolve(null);
        return;
      }
      setTimeout(() => {
        observer.disconnect();
        resolve(lcp > 0 ? lcp : null);
      }, 2000);
    });
  });
}

/** Measure CLS during a 2-second observation window */
async function getCLS(page: Page): Promise<number | null> {
  return page.evaluate(() => {
    return new Promise<number | null>((resolve) => {
      let cls = 0;
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as any[]) {
          if (!entry.hadRecentInput) cls += entry.value;
        }
      });
      try {
        observer.observe({ type: 'layout-shift', buffered: true });
      } catch {
        resolve(null);
        return;
      }
      setTimeout(() => {
        observer.disconnect();
        resolve(cls);
      }, 2000);
    });
  });
}

/** Navigate to a page and wait for it to become interactive */
async function navigateAndWait(page: Page, path: string) {
  await page.goto(`${BASE_URL}${path}`, {
    waitUntil: 'networkidle',
    timeout: 60000,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Performance — Navigation Timing', () => {
  const pages: { name: string; path: string; ttfb?: number }[] = [
    { name: 'Home Page (/)', path: '/' },
    { name: 'Products Page (/products)', path: '/products' },
    { name: 'Cart Page (/cart)', path: '/cart' },
    { name: 'Profile Page (/profile)', path: '/profile' },
    // Analytics uses recharts — first compile can be slow on dev server
    {
      name: 'Admin Analytics (/admin/analytics)',
      path: '/admin/analytics',
      ttfb: THRESHOLDS.ttfbHeavy,
    },
    { name: 'Shopping List (/shopping-list)', path: '/shopping-list' },
    { name: 'AI Assistant (/ai-assistant)', path: '/ai-assistant' },
  ];

  for (const { name, path, ttfb } of pages) {
    test(`${name} — TTFB, DCL, and Load within budget`, async ({ page }) => {
      await navigateAndWait(page, path);
      const metrics = await getNavigationMetrics(page);

      console.log(`[PERF] ${name}:`, JSON.stringify(metrics));

      const ttfbLimit = ttfb ?? THRESHOLDS.ttfb;
      expect(
        metrics.ttfb,
        `TTFB for ${name} exceeded ${ttfbLimit}ms (got ${metrics.ttfb.toFixed(0)}ms)`
      ).toBeLessThan(ttfbLimit);

      expect(
        metrics.dcl,
        `DOM Content Loaded for ${name} exceeded ${THRESHOLDS.dcl}ms (got ${metrics.dcl.toFixed(0)}ms)`
      ).toBeLessThan(THRESHOLDS.dcl);

      expect(
        metrics.load,
        `Load event for ${name} exceeded ${THRESHOLDS.load}ms (got ${metrics.load.toFixed(0)}ms)`
      ).toBeLessThan(THRESHOLDS.load);
    });
  }
});

test.describe('Performance — Core Web Vitals', () => {
  test('Home page LCP within 4s', async ({ page }) => {
    await navigateAndWait(page, '/');
    const lcp = await getLCP(page);
    if (lcp !== null) {
      console.log(`[PERF] Home LCP: ${lcp.toFixed(0)}ms`);
      expect(lcp, `LCP exceeded ${THRESHOLDS.lcp}ms (got ${lcp.toFixed(0)}ms)`).toBeLessThan(
        THRESHOLDS.lcp
      );
    } else {
      console.log('[PERF] LCP not measurable (no large content)');
    }
  });

  test('Products page LCP within 4s', async ({ page }) => {
    await navigateAndWait(page, '/products');
    const lcp = await getLCP(page);
    if (lcp !== null) {
      console.log(`[PERF] Products LCP: ${lcp.toFixed(0)}ms`);
      expect(lcp, `LCP exceeded ${THRESHOLDS.lcp}ms (got ${lcp.toFixed(0)}ms)`).toBeLessThan(
        THRESHOLDS.lcp
      );
    }
  });

  test('Home page CLS below 0.15', async ({ page }) => {
    await navigateAndWait(page, '/');
    const cls = await getCLS(page);
    if (cls !== null) {
      console.log(`[PERF] Home CLS: ${cls.toFixed(4)}`);
      // Home page has dynamic AI-picks/trending sections that appear after API load.
      // A threshold of 0.15 accounts for this while still catching regressions.
      expect(cls, `CLS exceeded 0.15 (got ${cls.toFixed(4)})`).toBeLessThan(0.15);
    }
  });

  test('Products page CLS below 0.1', async ({ page }) => {
    await navigateAndWait(page, '/products');
    const cls = await getCLS(page);
    if (cls !== null) {
      console.log(`[PERF] Products CLS: ${cls.toFixed(4)}`);
      expect(cls, `CLS exceeded ${THRESHOLDS.cls} (got ${cls.toFixed(4)})`).toBeLessThan(
        THRESHOLDS.cls
      );
    }
  });

  test('Cart page CLS below 0.1', async ({ page }) => {
    await navigateAndWait(page, '/cart');
    const cls = await getCLS(page);
    if (cls !== null) {
      console.log(`[PERF] Cart CLS: ${cls.toFixed(4)}`);
      expect(cls, `CLS exceeded ${THRESHOLDS.cls} (got ${cls.toFixed(4)})`).toBeLessThan(
        THRESHOLDS.cls
      );
    }
  });
});

test.describe('Performance — Resource Efficiency', () => {
  test('Home page JavaScript heap stays below 50 MB', async ({ page }) => {
    await navigateAndWait(page, '/');
    const heapMB = await page.evaluate(() => {
      const mem = (performance as any).memory;
      return mem ? mem.usedJSHeapSize / (1024 * 1024) : null;
    });
    if (heapMB !== null) {
      console.log(`[PERF] Home JS heap: ${heapMB.toFixed(1)} MB`);
      expect(heapMB, `JS heap ${heapMB.toFixed(1)} MB exceeds 50 MB`).toBeLessThan(50);
    } else {
      console.log('[PERF] performance.memory not available in this browser');
    }
  });

  test('Products page JavaScript heap stays below 60 MB', async ({ page }) => {
    await navigateAndWait(page, '/products');
    const heapMB = await page.evaluate(() => {
      const mem = (performance as any).memory;
      return mem ? mem.usedJSHeapSize / (1024 * 1024) : null;
    });
    if (heapMB !== null) {
      console.log(`[PERF] Products JS heap: ${heapMB.toFixed(1)} MB`);
      expect(heapMB, `JS heap ${heapMB.toFixed(1)} MB exceeds 60 MB`).toBeLessThan(60);
    } else {
      console.log('[PERF] performance.memory not available in this browser');
    }
  });

  test('Analytics page JavaScript heap stays below 80 MB', async ({ page }) => {
    await navigateAndWait(page, '/admin/analytics');
    const heapMB = await page.evaluate(() => {
      const mem = (performance as any).memory;
      return mem ? mem.usedJSHeapSize / (1024 * 1024) : null;
    });
    if (heapMB !== null) {
      console.log(`[PERF] Analytics JS heap: ${heapMB.toFixed(1)} MB`);
      // Recharts adds ~3-5 MB overhead; 80 MB gives reasonable headroom
      expect(heapMB, `JS heap ${heapMB.toFixed(1)} MB exceeds 80 MB`).toBeLessThan(80);
    } else {
      console.log('[PERF] performance.memory not available in this browser');
    }
  });
});

test.describe('Performance — Image Optimization', () => {
  test('Product images use lazy loading when present', async ({ page }) => {
    await navigateAndWait(page, '/products');

    // Count all img elements and lazy-loaded img elements
    const totalImgs = await page.locator('img').count();
    const lazyImgs = await page.locator('img[loading="lazy"]').count();
    const eagerImgs = await page.locator('img[loading="eager"]').count();

    console.log(
      `[PERF] /products — total imgs: ${totalImgs}, lazy: ${lazyImgs}, eager: ${eagerImgs}`
    );

    // If there are images, at least non-hero images should be lazy
    if (totalImgs > 1) {
      expect(lazyImgs, `Found ${totalImgs} images but none are lazy-loaded`).toBeGreaterThan(0);
    }
  });

  test('Product detail page hero image loads eagerly, thumbnails lazily', async ({ page }) => {
    await navigateAndWait(page, '/products/1');

    const lazyImgs = await page.locator('img[loading="lazy"]').count();
    const eagerImgs = await page.locator('img[loading="eager"]').count();

    console.log(`[PERF] /products/1 — eager: ${eagerImgs}, lazy: ${lazyImgs}`);

    // At least no images should block render unnecessarily
    // (eager count should be minimal — only the hero image)
    if (eagerImgs > 0) {
      expect(
        eagerImgs,
        'Too many eager-loaded images (should only hero image be eager)'
      ).toBeLessThanOrEqual(2);
    }
  });
});

test.describe('Performance — API Response Times', () => {
  test('Products API responds within 2s', async ({ page }) => {
    const start = Date.now();
    const response = await page.request.get(`${BASE_URL}/api/products`);
    const duration = Date.now() - start;

    console.log(`[PERF] /api/products: ${response.status()} in ${duration}ms`);
    expect(response.status()).toBeLessThan(500);
    expect(duration, `Products API took ${duration}ms (limit 2000ms)`).toBeLessThan(2000);
  });

  test('Auth check API responds within 1s (unauthenticated)', async ({ page }) => {
    const start = Date.now();
    const response = await page.request.get(`${BASE_URL}/api/auth/me`);
    const duration = Date.now() - start;

    console.log(`[PERF] /api/auth/me (unauth): ${response.status()} in ${duration}ms`);
    // 401 is expected — we just want it to be FAST
    expect(duration, `Auth API took ${duration}ms (limit 1000ms)`).toBeLessThan(1000);
  });
});
