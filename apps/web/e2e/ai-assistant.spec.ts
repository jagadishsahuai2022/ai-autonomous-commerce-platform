import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:3000';

async function goto(page: Page, path: string) {
  await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
}

test.describe('AI Assistant — Page Load', () => {
  test('shopping-assistant page loads with HTTP 200', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/shopping-assistant`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    expect(response?.status()).toBeLessThan(400);
  });

  test('shopping-assistant page renders main layout', async ({ page }) => {
    await goto(page, '/shopping-assistant');
    const main = page.locator('main, h1, h2, [class*="chat"]').first();
    await expect(main).toBeVisible({ timeout: 8000 });
  });

  test('shopping-assistant has text input or chat interface', async ({ page }) => {
    await goto(page, '/shopping-assistant');
    // Wait for React hydration — ChatInput uses a textarea rendered client-side
    await page.waitForSelector('textarea', { timeout: 10000, state: 'attached' }).catch(() => {});
    const input = page.locator('textarea, input[type="text"]');
    const count = await input.count();
    expect(count).toBeGreaterThan(0);
  });
});

test.describe('AI Assistant — Intent API', () => {
  test('POST /api/intent/analyze returns 200 for laptop query', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/intent/analyze`, {
      data: { input: 'laptop', user_id: 'test-user' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('clarifying_questions');
    expect(Array.isArray(body.clarifying_questions)).toBe(true);
    expect(body.clarifying_questions.length).toBeGreaterThan(0);
  });

  test('intent/analyze clarifying_questions have correct shape', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/intent/analyze`, {
      data: { input: 'laptop', user_id: 'test-user' },
    });
    const body = await res.json();
    const firstQ = body.clarifying_questions[0];
    // Must have id, question, type, options, category
    expect(firstQ).toHaveProperty('id');
    expect(firstQ).toHaveProperty('question');
    expect(firstQ).toHaveProperty('type');
    expect(firstQ).toHaveProperty('options');
    expect(Array.isArray(firstQ.options)).toBe(true);
  });

  test('intent/analyze options have value+label shape (not plain strings)', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/intent/analyze`, {
      data: { input: 'headphones', user_id: 'test' },
    });
    const body = await res.json();
    for (const q of body.clarifying_questions) {
      if (q.type === 'multiple_choice') {
        for (const opt of q.options) {
          expect(typeof opt).toBe('object');
          expect(opt).toHaveProperty('value');
          expect(opt).toHaveProperty('label');
          expect(typeof opt.label).toBe('string');
          expect(opt.label.length).toBeGreaterThan(0);
        }
      }
    }
  });

  test('intent/analyze accepts both input and query field names', async ({ request }) => {
    const resInput = await request.post(`${BASE_URL}/api/intent/analyze`, {
      data: { input: 'phone' },
    });
    const resQuery = await request.post(`${BASE_URL}/api/intent/analyze`, {
      data: { query: 'phone' },
    });
    expect(resInput.status()).toBe(200);
    expect(resQuery.status()).toBe(200);
  });

  test('intent/analyze returns 400 for empty query', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/intent/analyze`, {
      data: { input: '' },
    });
    expect(res.status()).toBe(400);
  });

  test('intent/analyze detects category correctly', async ({ request }) => {
    const cases = [
      { input: 'looking for a smartphone', expectedCat: 'phones' },
      { input: 'buy laptop for coding', expectedCat: 'laptops' },
      { input: 'wireless earbuds', expectedCat: 'audio' },
    ];
    for (const { input, expectedCat } of cases) {
      const res = await request.post(`${BASE_URL}/api/intent/analyze`, { data: { input } });
      const body = await res.json();
      expect(body.intent.category).toBe(expectedCat);
    }
  });
});

test.describe('AI Assistant — Chat API', () => {
  test('POST /api/chat/message returns 200', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/chat/message`, {
      data: { message: 'laptop' },
    });
    expect(res.status()).toBe(200);
  });

  test('chat/message responds to laptop query with product suggestions', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/chat/message`, {
      data: { message: 'I need a laptop', user_id: 'test' },
    });
    expect(res.status()).toBe(200);
    const text = await res.text();
    expect(text.length).toBeGreaterThan(10);
  });

  test('chat/message accepts multiple field name variants', async ({ request }) => {
    const variants = [{ message: 'headphones' }, { input: 'headphones' }, { text: 'headphones' }];
    for (const data of variants) {
      const res = await request.post(`${BASE_URL}/api/chat/message`, { data });
      expect(res.status()).toBe(200);
    }
  });
});

test.describe('AI Assistant — Shopping Assistant Page Flow', () => {
  test('ai-assistant landing page loads', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/ai-assistant`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    expect(response?.status()).toBeLessThan(400);
  });

  test('ai-assistant page has a CTA button linking to shopping-assistant', async ({ page }) => {
    await goto(page, '/ai-assistant');
    const cta = page.locator(
      'a[href*="shopping-assistant"], button:has-text("Try"), button:has-text("Start"), button:has-text("Launch")'
    );
    const count = await cta.count();
    expect(count).toBeGreaterThan(0);
  });

  test('shopping-assistant page has visible submit or send button', async ({ page }) => {
    await goto(page, '/shopping-assistant');
    // Wait for React hydration — ChatInput send button is client-side rendered
    await page
      .waitForSelector('[aria-label="Send message"], [title="Send message"]', {
        timeout: 10000,
        state: 'attached',
      })
      .catch(() => {});
    const sendBtn = page.locator(
      '[aria-label="Send message"], [title="Send message"], button[type="submit"]'
    );
    const count = await sendBtn.count();
    expect(count).toBeGreaterThan(0);
  });
});
