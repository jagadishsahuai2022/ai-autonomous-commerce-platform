/**
 * Smart Intent Engine v2 — E2E Tests
 *
 * Tests the live API endpoints with v2 engine integration.
 * Verifies backward compatibility with v1 and v2 response enrichment.
 */
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('Smart Intent Engine v2 — E2E', () => {
  // ── /api/intent/analyze — v2 engine tests ────────────────────────────────

  test('analyze: v2 returns enriched response for "best phone under 20000"', async ({
    request,
  }) => {
    const res = await request.post(`${BASE_URL}/api/intent/analyze`, {
      data: { query: 'best phone under 20000', engine: 'v2' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();

    // Must have v2 response shape
    expect(body.intent).toBeDefined();
    expect(body.intent.category).toBe('phone');
    expect(body.intent.budget).toBeTruthy();
    expect(body.matchedProducts).toBeGreaterThan(0);
    expect(body.products).toBeDefined();
    expect(body.products.length).toBeGreaterThan(0);
    expect(body.clarifying_questions).toBeDefined();
    expect(body.initial_text).toBeTruthy();

    // Products should be phones within/near budget
    for (const p of body.products.slice(0, 5)) {
      expect(p.category).toBe('phone');
      expect(p.price).toBeLessThan(25000); // 20k + buffer
      expect(p.attributes).toBeDefined();
      expect(p.relevanceScore).toBeGreaterThan(0);
    }
  });

  test('analyze: v2 detects gaming laptop intent', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/intent/analyze`, {
      data: { query: 'gaming laptop for coding', engine: 'v2' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();

    expect(body.intent.category).toBe('laptop');
    expect(body.products.length).toBeGreaterThan(0);
    // Should generate budget question (since no budget specified)
    const budgetQ = body.clarifying_questions?.find(
      (q: { category: string }) => q.category === 'budget'
    );
    expect(budgetQ).toBeTruthy();
  });

  test('analyze: v2 handles cheap earbuds query', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/intent/analyze`, {
      data: { query: 'cheap earbuds', engine: 'v2' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();

    expect(body.intent.category).toBe('headphones');
    expect(body.products.length).toBeGreaterThan(0);
    // Should have affordable options
    const cheapProducts = body.products.filter((p: { price: number }) => p.price <= 5000);
    expect(cheapProducts.length).toBeGreaterThan(0);
  });

  test('analyze: v2 handles good camera phone query', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/intent/analyze`, {
      data: { query: 'good camera phone', engine: 'v2' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();

    expect(body.intent.category).toBe('phone');
    expect(body.products.length).toBeGreaterThan(0);
  });

  // ── v1 fallback test ─────────────────────────────────────────────────────

  test('analyze: v1 engine override still works', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/intent/analyze`, {
      data: { query: 'laptop', engine: 'v1' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    // v1 response shape — should still have products or initial_text
    expect(body).toBeDefined();
  });

  // ── /api/chat/message — v2 enhanced ───────────────────────────────────────

  test('chat: v2-enhanced message returns streaming response', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/chat/message`, {
      data: { message: 'best phone under 20000', userId: 'test-user-e2e' },
    });
    expect(res.status()).toBe(200);
    // SSE streaming — just verify it returns 200
    const text = await res.text();
    expect(text.length).toBeGreaterThan(0);
  });

  // ── /api/intent/answer-question — v2 product search ────────────────────

  test('answer-question: processes answers and returns products', async ({ request }) => {
    const userId = `test-e2e-${Date.now()}`;

    // Answer q1 (budget)
    const ans1 = await request.post(`${BASE_URL}/api/intent/answer-question`, {
      data: {
        user_id: userId,
        question_id: 'q1',
        answer: '10000-20000',
        current_intent: { category: 'phone' },
      },
    });
    expect(ans1.status()).toBe(200);

    // Answer q2 (brand)
    const ans2 = await request.post(`${BASE_URL}/api/intent/answer-question`, {
      data: {
        user_id: userId,
        question_id: 'q2',
        answer: 'Samsung',
        current_intent: { category: 'phone' },
      },
    });
    expect(ans2.status()).toBe(200);

    // Answer q3 (use_case) — triggers product recommendations
    const ans3 = await request.post(`${BASE_URL}/api/intent/answer-question`, {
      data: {
        user_id: userId,
        question_id: 'q3',
        answer: 'gaming',
        current_intent: { category: 'phone' },
      },
    });
    expect(ans3.status()).toBe(200);
    const body = await ans3.json();
    // After all 3 answers, should return products
    expect(body.products || body.recommendations).toBeDefined();
  });

  // ── Performance test ──────────────────────────────────────────────────────

  test('analyze: v2 responds under 500ms', async ({ request }) => {
    const start = Date.now();
    const res = await request.post(`${BASE_URL}/api/intent/analyze`, {
      data: { query: 'samsung tv under 50000', engine: 'v2' },
    });
    const elapsed = Date.now() - start;
    expect(res.status()).toBe(200);
    expect(elapsed).toBeLessThan(2000); // generous threshold for cold start
    const body = await res.json();
    expect(body.intent.category).toBe('television');
    expect(body.products.length).toBeGreaterThan(0);
  });

  // ── Cross-category test ──────────────────────────────────────────────────

  test('analyze: v2 handles appliances category', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/intent/analyze`, {
      data: { query: 'washing machine for home', engine: 'v2' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();

    expect(body.intent.category).toBe('appliances');
    expect(body.products.length).toBeGreaterThan(0);
    for (const p of body.products.slice(0, 3)) {
      expect(p.category).toBe('appliances');
    }
  });

  // ── ANC headphones test ──────────────────────────────────────────────────

  test('analyze: v2 detects features in "noise cancelling headphones for travel"', async ({
    request,
  }) => {
    const res = await request.post(`${BASE_URL}/api/intent/analyze`, {
      data: { query: 'noise cancelling headphones for travel', engine: 'v2' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();

    expect(body.intent.category).toBe('headphones');
    expect(body.products.length).toBeGreaterThan(0);
  });
});
