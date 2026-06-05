import { test, expect, Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';

async function goto(page: Page, path: string) {
  await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);
}

// ─── Answer-Question API — Full Recommendation Flow ───────────────────────────

test.describe('Answer-Question API — Full 3-Question Flow', () => {
  test('intent analyze enforces category and max budget for "laptop under 50000"', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/intent/analyze`, {
      data: { query: 'laptop under 50000', engine: 'v2' },
    });

    expect(res.status()).toBe(200);
    const data = await res.json();
    const products = Array.isArray(data.products) ? data.products : [];
    expect(products.length).toBeGreaterThan(0);

    for (const p of products) {
      expect(Number(p.price)).toBeLessThanOrEqual(50000);
      const catOrName = `${String(p.category ?? '')} ${String(p.subCategory ?? '')} ${String(p.name ?? '')}`.toLowerCase();
      expect(catOrName.includes('laptop') || catOrName.includes('notebook')).toBe(true);
    }
  });

  test('q1 (budget) → returns ready:false with answers_collected:1', async ({ request }) => {
    const userId = `flow-budget-${Date.now()}`;
    const res = await request.post(`${BASE_URL}/api/intent/answer-question`, {
      data: { user_id: userId, question_id: 'q1', answer: 'under_10k' },
    });
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.ready).toBe(false);
    expect(data.answers_collected).toBe(1);
    expect(data.updated_intent.budget).toMatchObject({ min: 0, max: 10000 });
  });

  test('q2 (brand:samsung) → updated_intent has preferred_brand Samsung', async ({ request }) => {
    const userId = `flow-brand-${Date.now()}`;
    await request.post(`${BASE_URL}/api/intent/answer-question`, {
      data: { user_id: userId, question_id: 'q1', answer: '10k_30k' },
    });
    const res = await request.post(`${BASE_URL}/api/intent/answer-question`, {
      data: { user_id: userId, question_id: 'q2', answer: 'samsung' },
    });
    const data = await res.json();
    expect(res.status()).toBe(200);
    expect(data.ready).toBe(false);
    expect(data.updated_intent.preferred_brand).toBe('Samsung');
    expect(data.answers_collected).toBe(2);
  });

  test('q2 (brand:any) → preferred_brand is null (no brand preference)', async ({ request }) => {
    const userId = `flow-any-${Date.now()}`;
    await request.post(`${BASE_URL}/api/intent/answer-question`, {
      data: { user_id: userId, question_id: 'q1', answer: '30k_60k' },
    });
    const res = await request.post(`${BASE_URL}/api/intent/answer-question`, {
      data: { user_id: userId, question_id: 'q2', answer: 'any' },
    });
    const data = await res.json();
    // 'any' maps to '' which evaluates to null in the intent (no brand preference)
    expect(
      data.updated_intent.preferred_brand == null || data.updated_intent.preferred_brand === ''
    ).toBe(true);
  });

  test('q3 (delivery) → ready:true with products array after all 3 questions', async ({
    request,
  }) => {
    const userId = `flow-complete-${Date.now()}`;
    await request.post(`${BASE_URL}/api/intent/answer-question`, {
      data: { user_id: userId, question_id: 'q1', answer: '60k_plus' },
    });
    await request.post(`${BASE_URL}/api/intent/answer-question`, {
      data: { user_id: userId, question_id: 'q2', answer: 'apple' },
    });
    const res = await request.post(`${BASE_URL}/api/intent/answer-question`, {
      data: { user_id: userId, question_id: 'q3', answer: 'this_week' },
    });
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.ready).toBe(true);
    expect(Array.isArray(data.products)).toBe(true);
    expect(data.products.length).toBeGreaterThan(0);
    expect(data.message).toContain('recommendations');
  });

  test('products in response have required fields (id, name, price, image)', async ({
    request,
  }) => {
    const userId = `flow-fields-${Date.now()}`;
    await request.post(`${BASE_URL}/api/intent/answer-question`, {
      data: { user_id: userId, question_id: 'q1', answer: '30k_60k' },
    });
    await request.post(`${BASE_URL}/api/intent/answer-question`, {
      data: { user_id: userId, question_id: 'q2', answer: 'samsung' },
    });
    const res = await request.post(`${BASE_URL}/api/intent/answer-question`, {
      data: { user_id: userId, question_id: 'q3', answer: 'this_week' },
    });
    const data = await res.json();
    expect(data.ready).toBe(true);
    const product = data.products[0] as Record<string, unknown>;
    expect(product).toHaveProperty('id');
    expect(product).toHaveProperty('name');
    expect(product).toHaveProperty('price');
    expect(product).toHaveProperty('image');
  });

  test('budget under_10k returns products priced ≤ 10000 (or fallback catalog)', async ({
    request,
  }) => {
    const userId = `flow-budget-filter-${Date.now()}`;
    await request.post(`${BASE_URL}/api/intent/answer-question`, {
      data: { user_id: userId, question_id: 'q1', answer: 'under_10k' },
    });
    await request.post(`${BASE_URL}/api/intent/answer-question`, {
      data: { user_id: userId, question_id: 'q2', answer: 'any' },
    });
    const res = await request.post(`${BASE_URL}/api/intent/answer-question`, {
      data: { user_id: userId, question_id: 'q3', answer: 'this_week' },
    });
    const data = await res.json();
    expect(data.ready).toBe(true);
    expect(Array.isArray(data.products)).toBe(true);
    if (data.products.length > 0) {
      for (const p of data.products) {
        expect(Number(p.price)).toBeLessThanOrEqual(10000);
      }
    }
  });

  test('60k_plus budget returns products (high-end)', async ({ request }) => {
    const userId = `flow-hifi-${Date.now()}`;
    await request.post(`${BASE_URL}/api/intent/answer-question`, {
      data: { user_id: userId, question_id: 'q1', answer: '60k_plus' },
    });
    await request.post(`${BASE_URL}/api/intent/answer-question`, {
      data: { user_id: userId, question_id: 'q2', answer: 'any' },
    });
    const res = await request.post(`${BASE_URL}/api/intent/answer-question`, {
      data: { user_id: userId, question_id: 'q3', answer: 'this_week' },
    });
    const data = await res.json();
    expect(data.ready).toBe(true);
    expect(data.products.length).toBeGreaterThan(0);
  });

  test('returns 400 for request missing user_id', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/intent/answer-question`, {
      data: { question_id: 'q1', answer: 'under_10k' },
    });
    expect(res.status()).toBe(400);
  });

  test('returns 400 for request missing question_id', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/intent/answer-question`, {
      data: { user_id: 'test-no-qid', answer: 'under_10k' },
    });
    expect(res.status()).toBe(400);
  });

  test('different user sessions are independent (no cross-contamination)', async ({ request }) => {
    const uid1 = `session-A-${Date.now()}`;
    const uid2 = `session-B-${Date.now()}`;

    // User 1: apple / 60k_plus
    await request.post(`${BASE_URL}/api/intent/answer-question`, {
      data: { user_id: uid1, question_id: 'q1', answer: '60k_plus' },
    });
    await request.post(`${BASE_URL}/api/intent/answer-question`, {
      data: { user_id: uid1, question_id: 'q2', answer: 'apple' },
    });

    // User 2: samsung / under_10k — different session should start fresh
    await request.post(`${BASE_URL}/api/intent/answer-question`, {
      data: { user_id: uid2, question_id: 'q1', answer: 'under_10k' },
    });
    const r2 = await request.post(`${BASE_URL}/api/intent/answer-question`, {
      data: { user_id: uid2, question_id: 'q2', answer: 'samsung' },
    });
    const data2 = await r2.json();
    // User 2 should have Samsung brand, not Apple (which belongs to user 1)
    expect(data2.updated_intent.preferred_brand).toBe('Samsung');
  });
});

// ─── Shopping Assistant Page — Recommendation Flow ────────────────────────────

test.describe('Shopping Assistant Page — Recommendation Flow', () => {
  test('chat input accepts text and shows it in the chat after submit', async ({ page }) => {
    await goto(page, '/shopping-assistant');
    await page.waitForTimeout(1500);

    const chatInput = page.locator('input[type="text"], textarea').first();
    await chatInput.fill('I need a samsung phone under 30000');
    await chatInput.press('Enter');
    await page.waitForTimeout(3000);

    // User message should appear in chat
    const hasMessage =
      (await page.locator('text=/samsung|phone|30000/i').count()) > 0 ||
      (await page.locator('[data-testid="chat-message"], .message, [class*="message"]').count()) >
        0;
    expect(hasMessage).toBe(true);
  });

  test('shopping assistant page shows quick-reply answer buttons after initial query', async ({
    page,
  }) => {
    await goto(page, '/shopping-assistant');
    await page.waitForTimeout(1500);

    const chatInput = page.locator('input[type="text"], textarea').first();
    await chatInput.fill('Looking for a smartphone');
    await chatInput.press('Enter');
    await page.waitForTimeout(4000);

    // Should show either a bot response with question or quick reply buttons
    const hasButtons =
      (await page.locator('button').count()) > 1 ||
      (await page.locator('[data-testid*="option"], [class*="quick"], [class*="reply"]').count()) >
        0 ||
      (await page.locator('text=/budget|brand|prefer|delivery/i').count()) > 0;
    expect(hasButtons).toBe(true);
  });

  test('shopping assistant page has no critical JS errors during use', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await goto(page, '/shopping-assistant');
    await page.waitForTimeout(1500);

    const chatInput = page.locator('input[type="text"], textarea').first();
    await chatInput.fill('I want to buy a laptop');
    await chatInput.press('Enter');
    await page.waitForTimeout(3000);

    const criticalErrors = errors.filter(
      (e) =>
        !e.includes('NetworkError') &&
        !e.includes('fetch') &&
        !e.includes('Failed to fetch') &&
        !e.includes('Hydration') &&
        !e.includes('hydrat')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test('answer-question API is reachable from browser (not 404)', async ({ page, request }) => {
    // Verify the route exists from the Next.js app perspective
    const res = await request.post(`${BASE_URL}/api/intent/answer-question`, {
      data: { user_id: 'page-origin-test', question_id: 'q1', answer: 'under_10k' },
    });
    expect(res.status()).not.toBe(404);
    expect(res.status()).toBe(200);
  });
});
