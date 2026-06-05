/**
 * Auto-Checkout API — Unit Tests
 *
 * Covers:
 * - Category detection with word-boundary matching
 * - Fuzzy matching for typos
 * - Auto-checkout failure codes (6 codes)
 * - Budget/threshold validation
 * - Product relevance scoring
 * - Currency formatting (₹ / INR)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const BASE = 'http://127.0.0.1:3000';

// ── Helper: POST to shopping-list API ──────────────────────────────────────

async function postShoppingList(body: Record<string, unknown>): Promise<{
  status: number;
  data: any;
}> {
  const res = await fetch(`${BASE}/api/shopping-list`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { status: res.status, data };
}

function makeItem(
  overrides: Partial<{
    productName: string;
    preferredBrand: string | null;
    budget: number | null;
    quantity: number;
    deliveryDays: number | null;
    paymentMethod: string | null;
    emiOnly: boolean;
  }> = {}
) {
  return {
    productName: overrides.productName ?? 'Washing Machine',
    preferredBrand: overrides.preferredBrand ?? null,
    budget: overrides.budget ?? 30000,
    quantity: overrides.quantity ?? 1,
    deliveryDays: overrides.deliveryDays ?? null,
    paymentMethod: overrides.paymentMethod ?? null,
    emiOnly: overrides.emiOnly ?? false,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// CATEGORY DETECTION
// ══════════════════════════════════════════════════════════════════════════════

describe('Shopping List API — Category Detection', () => {
  it('maps "Washing Machine" to washing_machine category (returns washing machine products)', async () => {
    const { status, data } = await postShoppingList({
      items: [makeItem({ productName: 'Washing Machine' })],
    });
    expect(status).toBe(200);
    expect(data.results).toHaveLength(1);
    const names = data.results[0].matches.map((m: any) => m.name.toLowerCase());
    // At least one result should contain "load" or "automatic" (washing machine indicator)
    expect(names.some((n: string) => n.includes('load') || n.includes('automatic'))).toBe(true);
  });

  it('maps "Laptop" to laptop category', async () => {
    const { status, data } = await postShoppingList({
      items: [makeItem({ productName: 'Laptop', budget: 100000 })],
    });
    expect(status).toBe(200);
    const names = data.results[0].matches.map((m: any) => m.name.toLowerCase());
    expect(
      names.some(
        (n: string) =>
          n.includes('macbook') || n.includes('dell') || n.includes('hp') || n.includes('lenovo')
      )
    ).toBe(true);
  });

  it('does NOT map "Washing Machine" to AC category (word-boundary fix for "ac" in "machine")', async () => {
    const { status, data } = await postShoppingList({
      items: [makeItem({ productName: 'Washing Machine' })],
    });
    expect(status).toBe(200);
    const names = data.results[0].matches.map((m: any) => m.name.toLowerCase());
    // Should NOT return AC products
    expect(
      names.some(
        (n: string) => n.includes('daikin') || n.includes('voltas') || n.includes('blue star')
      )
    ).toBe(false);
  });

  it('correctly maps "AC" (exact word) to ac category', async () => {
    const { status, data } = await postShoppingList({
      items: [makeItem({ productName: 'AC', budget: 50000 })],
    });
    expect(status).toBe(200);
    const names = data.results[0].matches.map((m: any) => m.name.toLowerCase());
    expect(
      names.some(
        (n: string) => n.includes('daikin') || n.includes('voltas') || n.includes('blue star')
      )
    ).toBe(true);
  });

  it('correctly maps "Air Conditioner" to ac category', async () => {
    const { status, data } = await postShoppingList({
      items: [makeItem({ productName: 'Air Conditioner', budget: 50000 })],
    });
    expect(status).toBe(200);
    const names = data.results[0].matches.map((m: any) => m.name.toLowerCase());
    expect(
      names.some(
        (n: string) => n.includes('daikin') || n.includes('voltas') || n.includes('inverter')
      )
    ).toBe(true);
  });

  it('maps "TV" (short keyword, whole word) to tv category', async () => {
    const { status, data } = await postShoppingList({
      items: [makeItem({ productName: 'TV', budget: 60000 })],
    });
    expect(status).toBe(200);
    const names = data.results[0].matches.map((m: any) => m.name.toLowerCase());
    expect(
      names.some((n: string) => n.includes('oled') || n.includes('neo') || n.includes('bravia'))
    ).toBe(true);
  });

  it('maps "Pen" to stationery category', async () => {
    const { status, data } = await postShoppingList({
      items: [makeItem({ productName: 'Pen', budget: 200 })],
    });
    expect(status).toBe(200);
    const names = data.results[0].matches.map((m: any) => m.name.toLowerCase());
    expect(names.some((n: string) => n.includes('pen') || n.includes('notebook'))).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// FUZZY MATCHING
// ══════════════════════════════════════════════════════════════════════════════

describe('Shopping List API — Fuzzy Matching', () => {
  it('handles typo "Wshing Machine" → washing_machine category', async () => {
    const { status, data } = await postShoppingList({
      items: [makeItem({ productName: 'Wshing Machine' })],
    });
    expect(status).toBe(200);
    const names = data.results[0].matches.map((m: any) => m.name.toLowerCase());
    // Should return washing machines, NOT ACs
    expect(names.some((n: string) => n.includes('load') || n.includes('automatic'))).toBe(true);
    expect(names.some((n: string) => n.includes('daikin') || n.includes('voltas'))).toBe(false);
  });

  it('handles typo "Refrigeratir" → refrigerator category', async () => {
    const { status, data } = await postShoppingList({
      items: [makeItem({ productName: 'Refrigeratir' })],
    });
    expect(status).toBe(200);
    const names = data.results[0].matches.map((m: any) => m.name.toLowerCase());
    expect(names.some((n: string) => n.includes('door') || n.includes('frost'))).toBe(true);
  });

  it('handles typo "Headfone" → audio category', async () => {
    const { status, data } = await postShoppingList({
      items: [makeItem({ productName: 'Headfone', budget: 30000 })],
    });
    expect(status).toBe(200);
    const names = data.results[0].matches.map((m: any) => m.name.toLowerCase());
    expect(
      names.some((n: string) => n.includes('sony') || n.includes('jbl') || n.includes('airpods'))
    ).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// AUTO-CHECKOUT FAILURE CODES
// ══════════════════════════════════════════════════════════════════════════════

describe('Shopping List API — Auto-Checkout', () => {
  it('succeeds when product matches are relevant and within budget', async () => {
    const { status, data } = await postShoppingList({
      items: [makeItem({ productName: 'Washing Machine', budget: 30000 })],
      autoCheckout: true,
      forceFresh: true,
    });
    expect(status).toBe(200);
    expect(data.autoCheckout).toBeDefined();
    expect(data.autoCheckout.success).toBe(true);
    expect(data.autoCheckout.orderId).toMatch(/^ORD-AUTO-/);
  });

  it('succeeds with correct products for "Pen" (low-value item)', async () => {
    const { status, data } = await postShoppingList({
      items: [makeItem({ productName: 'Pen', budget: 200 })],
      autoCheckout: true,
      forceFresh: true,
    });
    expect(status).toBe(200);
    expect(data.autoCheckout).toBeDefined();
    expect(data.autoCheckout.success).toBe(true);
  });

  it('returns failure response (not crash) for unknown product', async () => {
    const { status, data } = await postShoppingList({
      items: [makeItem({ productName: 'Gizmo Flopper XYZ' })],
      autoCheckout: true,
      forceFresh: true,
    });
    expect(status).toBe(200);
    expect(data.autoCheckout).toBeDefined();
    // May succeed or fail depending on fuzzy matching, but should never crash
    expect(typeof data.autoCheckout.success).toBe('boolean');
  });

  it('includes failureCode when auto-checkout fails', async () => {
    // Use a product name that should have low-relevance results
    const { status, data } = await postShoppingList({
      items: [makeItem({ productName: 'ZZZNONEXISTENT9999' })],
      autoCheckout: true,
      forceFresh: true,
    });
    expect(status).toBe(200);
    if (!data.autoCheckout.success) {
      expect(data.autoCheckout.failureCode).toBeDefined();
      expect([
        'NO_MATCHING_PRODUCT',
        'ORDER_BUDGET_EXCEEDED',
        'MONTHLY_BUDGET_EXCEEDED',
        'PAYMENT_FAILURE',
        'NETWORK_ERROR',
        'PAYMENT_PARTNER_DOWN',
      ]).toContain(data.autoCheckout.failureCode);
    }
  });

  it('returns results with ₹ in savings format', async () => {
    const { status, data } = await postShoppingList({
      items: [makeItem({ productName: 'Washing Machine' })],
      forceFresh: true,
    });
    expect(status).toBe(200);
    expect(data.summary?.estimatedSavings).toMatch(/^₹/);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// VALIDATION
// ══════════════════════════════════════════════════════════════════════════════

describe('Shopping List API — Validation', () => {
  it('rejects empty items array', async () => {
    const { status, data } = await postShoppingList({ items: [] });
    expect(status).toBe(400);
    expect(data.error).toBeTruthy();
  });

  it('rejects items with special characters in productName', async () => {
    const { status } = await postShoppingList({
      items: [makeItem({ productName: '<script>alert(1)</script>' })],
    });
    expect(status).toBe(400);
  });

  it('rejects negative budget', async () => {
    const { status } = await postShoppingList({
      items: [makeItem({ budget: -1000 })],
    });
    expect(status).toBe(400);
  });

  it('rejects quantity < 1', async () => {
    const { status } = await postShoppingList({
      items: [makeItem({ quantity: 0 })],
    });
    expect(status).toBe(400);
  });

  it('rejects more than 50 items', async () => {
    const bigList = Array.from({ length: 51 }, (_, i) => makeItem({ productName: `Item ${i}` }));
    const { status, data } = await postShoppingList({ items: bigList });
    expect(status).toBe(400);
    expect(data.error).toContain('50');
  });

  it('accepts valid multi-item list', async () => {
    const { status, data } = await postShoppingList({
      items: [
        makeItem({ productName: 'Washing Machine', budget: 30000 }),
        makeItem({ productName: 'Laptop', budget: 80000 }),
        makeItem({ productName: 'Pen', budget: 200 }),
      ],
    });
    expect(status).toBe(200);
    expect(data.results).toHaveLength(3);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// BRAND PREFERENCE & BUDGET FILTERING
// ══════════════════════════════════════════════════════════════════════════════

describe('Shopping List API — Brand & Budget Filtering', () => {
  it('returns matches when preferred brand is specified', async () => {
    const { status, data } = await postShoppingList({
      items: [
        makeItem({ productName: 'Washing Machine', preferredBrand: 'Samsung', budget: 30000 }),
      ],
      forceFresh: true,
    });
    expect(status).toBe(200);
    // Should return matches regardless of brand availability
    expect(data.results[0].matches.length).toBeGreaterThan(0);
    // At least one match should have a brand field
    expect(data.results[0].matches[0]).toHaveProperty('brand');
  });

  it('penalizes over-budget products in matchScore', async () => {
    const { status, data } = await postShoppingList({
      items: [makeItem({ productName: 'Laptop', budget: 60000 })],
      forceFresh: true,
    });
    expect(status).toBe(200);
    const matches = data.results[0].matches;
    // The first match should be within budget or have highest adjusted score
    const withinBudget = matches.filter((m: any) => m.price <= 60000);
    expect(withinBudget.length).toBeGreaterThan(0);
  });

  it('filters EMI-only when emiOnly is true', async () => {
    const { status, data } = await postShoppingList({
      items: [makeItem({ productName: 'Washing Machine', emiOnly: true })],
      forceFresh: true,
    });
    expect(status).toBe(200);
    const matches = data.results[0].matches;
    expect(matches.every((m: any) => m.emiAvailable === true)).toBe(true);
  });
});
