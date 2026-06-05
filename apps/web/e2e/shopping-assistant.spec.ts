import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:3000';

async function goto(page: Page, path: string) {
  await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);
}

// ─── Answer-Question API Route ─────────────────────────────────────────────────

test.describe('AI Intent API — /api/intent/answer-question', () => {
  test('POST /api/intent/answer-question returns 200 (not 404)', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/intent/answer-question`, {
      data: {
        user_id: 'test-user-api',
        question_id: 'q1',
        answer: 'under_10k',
      },
    });
    expect(response.status()).toBe(200);
  });

  test('returns updated_intent after answering q1 (budget)', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/intent/answer-question`, {
      data: {
        user_id: 'test-user-q1',
        question_id: 'q1',
        answer: '10k_30k',
      },
    });
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('updated_intent');
    expect(data.updated_intent).toHaveProperty('budget');
    expect(data.updated_intent.budget).toMatchObject({ min: 10000, max: 30000 });
  });

  test('returns updated_intent after answering q2 (brand)', async ({ request }) => {
    const userId = `test-brand-${Date.now()}`;
    // First answer q1
    await request.post(`${BASE_URL}/api/intent/answer-question`, {
      data: { user_id: userId, question_id: 'q1', answer: 'under_10k' },
    });
    // Then answer q2
    const response = await request.post(`${BASE_URL}/api/intent/answer-question`, {
      data: { user_id: userId, question_id: 'q2', answer: 'samsung' },
    });
    const data = await response.json();
    expect(response.status()).toBe(200);
    expect(data.updated_intent).toHaveProperty('preferred_brand', 'Samsung');
  });

  test('returns ready:true and products after all 3 questions', async ({ request }) => {
    const userId = `test-ready-${Date.now()}`;
    // Pass current_intent between requests to survive multi-worker deployments (mirrors real frontend behaviour)
    const r1 = await request.post(`${BASE_URL}/api/intent/answer-question`, {
      data: { user_id: userId, question_id: 'q1', answer: 'under_10k', current_intent: { category: 'laptop' } },
    });
    const d1 = await r1.json();
    const r2 = await request.post(`${BASE_URL}/api/intent/answer-question`, {
      data: { user_id: userId, question_id: 'q2', answer: 'any', current_intent: d1.updated_intent ?? {} },
    });
    const d2 = await r2.json();
    const response = await request.post(`${BASE_URL}/api/intent/answer-question`, {
      data: { user_id: userId, question_id: 'q3', answer: 'this_week', current_intent: d2.updated_intent ?? {} },
    });
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('ready', true);
    expect(data).toHaveProperty('products');
    expect(Array.isArray(data.products)).toBe(true);
    expect(data.products.length).toBeGreaterThan(0);
  });

  test('returns 400 when user_id is missing', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/intent/answer-question`, {
      data: { question_id: 'q1', answer: 'under_10k' },
    });
    expect(response.status()).toBe(400);
  });

  test('returns 400 when question_id is missing', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/intent/answer-question`, {
      data: { user_id: 'test-user', answer: 'under_10k' },
    });
    expect(response.status()).toBe(400);
  });
});

// ─── Analyze Intent API Route ──────────────────────────────────────────────────

test.describe('AI Intent API — /api/intent/analyze', () => {
  test('POST /api/intent/analyze returns 200', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/intent/analyze`, {
      data: { query: 'I need a smartphone under budget', user_id: 'test-analyze' },
    });
    expect(response.status()).toBe(200);
  });

  test('returns clarifying_questions array', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/intent/analyze`, {
      data: { query: 'Looking for a laptop', user_id: 'test-analyze-lp' },
    });
    const data = await response.json();
    expect(data).toHaveProperty('clarifying_questions');
    expect(Array.isArray(data.clarifying_questions)).toBe(true);
    expect(data.clarifying_questions.length).toBeGreaterThan(0);
  });

  test('returns intent with category for phone query', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/intent/analyze`, {
      data: { query: 'I want to buy a new phone', user_id: 'test-phone' },
    });
    const data = await response.json();
    // category may be "phone" (singular) or "phones" (plural) depending on normalization
    expect(data.intent.category).toMatch(/^phone/);
  });

  test('returns 400 when query is empty', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/intent/analyze`, {
      data: { query: '', user_id: 'test-empty' },
    });
    expect(response.status()).toBe(400);
  });
});

// ─── Shopping Assistant Page — UI ─────────────────────────────────────────────

test.describe('Shopping Assistant Page — UI', () => {
  test('shopping-assistant page loads with HTTP 200', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/shopping-assistant`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    expect(response?.status()).toBe(200);
  });

  test('shows chat interface elements', async ({ page }) => {
    await goto(page, '/shopping-assistant');
    await page.waitForTimeout(2000);
    // Should show a text input or chat area
    const hasInput =
      (await page.locator('input[type="text"], textarea, [role="textbox"]').count()) > 0;
    expect(hasInput).toBe(true);
  });

  test('shows send/submit button', async ({ page }) => {
    await goto(page, '/shopping-assistant');
    // Wait for the chat input to appear (page may hydrate slowly)
    await page.waitForSelector('input[type="text"], textarea, [role="textbox"]', { timeout: 10000 }).catch(() => {});
    const hasSendBtn =
      (await page.getByRole('button', { name: /send|submit|ask/i }).count()) > 0 ||
      (await page.locator('button[type="submit"]').count()) > 0 ||
      (await page.locator('button svg').count()) > 0; // icon-only send button
    expect(hasSendBtn).toBe(true);
  });

  test('can type a message in the chat', async ({ page }) => {
    await goto(page, '/shopping-assistant');
    await page.waitForTimeout(1500);

    const chatInput = page.locator('input[type="text"], textarea').first();
    await chatInput.fill('I need a budget smartphone');
    const value = await chatInput.inputValue();
    expect(value).toBe('I need a budget smartphone');
  });

  test('submitting a message shows response in chat', async ({ page }) => {
    await goto(page, '/shopping-assistant');
    await page.waitForTimeout(1500);

    const chatInput = page.locator('input[type="text"], textarea').first();
    await chatInput.fill('I need a budget smartphone');

    // Press Enter or click send button
    await chatInput.press('Enter');
    await page.waitForTimeout(3000);

    // Should show the user's message in the chat or a response
    const hasResponse =
      (await page.locator('text=/smartphone|budget|phone/i').count()) > 0 ||
      (await page.locator('[data-testid="chat-message"]').count()) > 0 ||
      (await page.locator('.message, .chat-message, .bubble').count()) > 0;
    expect(hasResponse).toBe(true);
  });

  test('shopping assistant has no critical JavaScript errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await goto(page, '/shopping-assistant');
    await page.waitForTimeout(2000);

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
});
