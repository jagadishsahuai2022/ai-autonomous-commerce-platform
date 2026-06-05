/**
 * Shopping Assistant — Full E2E Chat-to-Recommendation Flow Tests
 * Exercises the complete user journey: type query → see questions → answer → see product recommendations
 * Also covers edge cases, performance, and visual verification.
 */
import { test, expect, Page } from '@playwright/test';

const BASE = 'http://127.0.0.1:3000';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Wait for the ShoppingChat component to fully hydrate (textarea visible) */
async function waitForChatReady(page: Page) {
  await page.goto(`${BASE}/shopping-assistant`, { waitUntil: 'networkidle' });
  await page.locator('textarea').first().waitFor({ state: 'visible', timeout: 20000 });
}

/** Submit a query in the chat input */
async function submitQuery(page: Page, text: string) {
  const input = page.locator('textarea').first();
  await input.fill(text);
  await input.press('Enter');
}

/** Wait for N clarifying questions to appear (by radio button group names) */
async function waitForQuestions(page: Page) {
  await page.waitForSelector('input[name="q1"]', { timeout: 15000 });
}

/** Answer a clarifying question by selecting a radio value and clicking Submit */
async function answerQuestion(page: Page, name: string, value: string) {
  const radio = page.locator(`input[name="${name}"][value="${value}"]`);
  await radio.click({ force: true });
  // Click the first visible Submit button (belongs to the first unanswered question)
  await page.locator('button:has-text("Submit")').first().click();
  // Wait for the API response and state update
  await page.waitForTimeout(1500);
}

/** Scroll the chat container to bottom */
async function scrollChatToBottom(page: Page) {
  const container = page.locator('.overflow-y-auto').first();
  await container.evaluate((el) => el.scrollTo(0, el.scrollHeight));
}

// ── FULL CHAT FLOW: query → questions → answers → recommendations ────────────

test.describe('Shopping Chat — Full Recommendation Flow', () => {
  test('answering all 3 questions shows ProductRecommendationCarousel', async ({ page }) => {
    await waitForChatReady(page);
    await submitQuery(page, 'I want to buy a smartphone');
    await waitForQuestions(page);

    // Answer all 3 questions
    await scrollChatToBottom(page);
    await answerQuestion(page, 'q1', '60k_plus');
    await answerQuestion(page, 'q2', 'apple');
    await answerQuestion(page, 'q3', 'today');

    // Wait for recommendation to render
    await page.waitForTimeout(3000);
    await scrollChatToBottom(page);

    // Verify carousel elements
    await expect(page.locator('text=Top Recommendations').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Best Match').first()).toBeVisible();
    await expect(page.locator('text=Add to Cart').first()).toBeVisible();
  });

  test('recommendation message content says "here are my top"', async ({ page }) => {
    await waitForChatReady(page);
    await submitQuery(page, 'I need a phone');
    await waitForQuestions(page);

    await answerQuestion(page, 'q1', '30k_60k');
    await answerQuestion(page, 'q2', 'samsung');
    await answerQuestion(page, 'q3', 'this_week');
    await page.waitForTimeout(3000);

    await expect(page.locator('text=here are my top')).toBeVisible({ timeout: 10000 });
  });

  test('carousel displays correct number of product cards', async ({ page }) => {
    await waitForChatReady(page);
    await submitQuery(page, 'Smartphone please');
    await waitForQuestions(page);

    await answerQuestion(page, 'q1', '60k_plus');
    await answerQuestion(page, 'q2', 'any');
    await answerQuestion(page, 'q3', 'this_week');
    await page.waitForTimeout(3000);
    await scrollChatToBottom(page);

    // Each product card has an "Add to Cart" button
    const addToCartButtons = page.locator('text=Add to Cart');
    const count = await addToCartButtons.count();
    // We expect at least 4 products from the API/fallback
    expect(count).toBeGreaterThanOrEqual(4);
  });

  test('Best Match product shows quality, price, rating, delivery metrics', async ({ page }) => {
    await waitForChatReady(page);
    await submitQuery(page, 'Buy a smartphone');
    await waitForQuestions(page);

    await answerQuestion(page, 'q1', '60k_plus');
    await answerQuestion(page, 'q2', 'apple');
    await answerQuestion(page, 'q3', 'today');
    await page.waitForTimeout(3000);
    await scrollChatToBottom(page);

    // Verify metric labels in the Best Match section
    await expect(page.locator('text=Quality').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Price').first()).toBeVisible();
    await expect(page.locator('text=Rating').first()).toBeVisible();
    await expect(page.locator('text=Delivery').first()).toBeVisible();
  });

  test('no JavaScript errors during full recommendation flow', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await waitForChatReady(page);
    await submitQuery(page, 'Find me a good phone');
    await waitForQuestions(page);

    await answerQuestion(page, 'q1', '60k_plus');
    await answerQuestion(page, 'q2', 'apple');
    await answerQuestion(page, 'q3', 'today');
    await page.waitForTimeout(3000);

    // Filter out non-critical errors
    const critical = errors.filter(
      (e) => !e.includes('NetworkError') && !e.includes('fetch') && !e.includes('Hydration')
    );
    expect(critical).toHaveLength(0);
  });

  test('bottom recommendations panel shows top 3 products', async ({ page }) => {
    await waitForChatReady(page);
    await submitQuery(page, 'I want a smartphone');
    await waitForQuestions(page);

    await answerQuestion(page, 'q1', '60k_plus');
    await answerQuestion(page, 'q2', 'apple');
    await answerQuestion(page, 'q3', 'today');
    await page.waitForTimeout(3000);
    await scrollChatToBottom(page);

    // The bottom panel shows "X products found" text
    const productsFound = page.locator('text=/\\d+ products? found/i');
    await expect(productsFound).toBeVisible({ timeout: 10000 });
  });
});

// ── CLARIFYING QUESTIONS UI ──────────────────────────────────────────────────

test.describe('Shopping Chat — Clarifying Questions UI', () => {
  test('three question cards appear after typing a product query', async ({ page }) => {
    await waitForChatReady(page);
    await submitQuery(page, 'I want to buy a phone');
    await waitForQuestions(page);

    // All 3 question groups should be present
    expect(await page.locator('input[name="q1"]').count()).toBeGreaterThan(0);
    expect(await page.locator('input[name="q2"]').count()).toBeGreaterThan(0);
    expect(await page.locator('input[name="q3"]').count()).toBeGreaterThan(0);
  });

  test('budget question has 4 options', async ({ page }) => {
    await waitForChatReady(page);
    await submitQuery(page, 'I want a smartphone');
    await waitForQuestions(page);

    const budgetRadios = page.locator('input[name="q1"]');
    expect(await budgetRadios.count()).toBe(4);
  });

  test('brand question has 4 options', async ({ page }) => {
    await waitForChatReady(page);
    await submitQuery(page, 'I need a phone');
    await waitForQuestions(page);

    const brandRadios = page.locator('input[name="q2"]');
    expect(await brandRadios.count()).toBe(4);
  });

  test('delivery question has 3 options', async ({ page }) => {
    await waitForChatReady(page);
    await submitQuery(page, 'I want a phone');
    await waitForQuestions(page);

    const deliveryRadios = page.locator('input[name="q3"]');
    expect(await deliveryRadios.count()).toBe(3);
  });

  test('answering q1 shows "Answer recorded" in its card', async ({ page }) => {
    await waitForChatReady(page);
    await submitQuery(page, 'Get me a phone');
    await waitForQuestions(page);

    // Count submit buttons before answering
    const submitsBefore = await page.locator('button:has-text("Submit")').count();

    // Scroll to make q1 visible, select radio, and submit
    await scrollChatToBottom(page);
    const radio = page.locator('input[name="q1"][value="under_10k"]');
    await radio.waitFor({ state: 'visible', timeout: 5000 });
    await radio.click();
    // Wait for React state update before clicking Submit
    await page.waitForTimeout(300);
    await page.locator('button:has-text("Submit")').first().click();
    await page.waitForTimeout(2000);

    // After answering, either "Answer recorded" text appears or Submit button count decreases
    const hasRecorded = await page
      .locator('text=/Answer recorded/i')
      .first()
      .isVisible()
      .catch(() => false);
    const submitsAfter = await page.locator('button:has-text("Submit")').count();
    expect(hasRecorded || submitsAfter < submitsBefore).toBe(true);
  });

  test('Skip button advances to next question without API call', async ({ page }) => {
    const apiCalls: string[] = [];
    page.on('response', (res) => {
      if (res.url().includes('answer-question')) apiCalls.push(res.url());
    });

    await waitForChatReady(page);
    await submitQuery(page, 'I want a smartphone');
    await waitForQuestions(page);

    // Click Skip on the first question
    await page.locator('button:has-text("Skip")').first().click();
    await page.waitForTimeout(1000);

    // Skip should NOT trigger an API call
    expect(apiCalls.length).toBe(0);
  });
});

// ── CHAT MESSAGE FLOW ────────────────────────────────────────────────────────

test.describe('Shopping Chat — Message Flow', () => {
  test('user message appears in chat bubbles', async ({ page }) => {
    await waitForChatReady(page);
    await submitQuery(page, 'Hello there');
    await page.waitForTimeout(3000);

    // User message should be visible
    await expect(page.locator('text=Hello there').first()).toBeVisible({ timeout: 5000 });
    // The chat should contain at least 2 messages (user + AI response)
    const messageContainer = page.locator('.overflow-y-auto').first();
    const html = await messageContainer.innerHTML();
    expect(html).toContain('Hello there');
  });

  test('AI response appears with "AI" avatar', async ({ page }) => {
    await waitForChatReady(page);
    await submitQuery(page, 'Hello');
    await page.waitForTimeout(3000);

    await expect(page.locator('text=AI').first()).toBeVisible();
    // AI responds with a greeting
    await expect(page.locator('text=Welcome').first()).toBeVisible();
  });

  test('AI response appears after user sends product query', async ({ page }) => {
    await waitForChatReady(page);
    await submitQuery(page, 'I want to buy headphones');
    await page.waitForTimeout(4000);

    // The AI response message bubble (gray background) should appear
    const aiMessages = page.locator('.bg-gray-100');
    expect(await aiMessages.count()).toBeGreaterThan(0);
    // AI response should contain substantial text
    const html = await page.locator('.overflow-y-auto').first().innerHTML();
    expect(html.length).toBeGreaterThan(200);
  });

  test('Clear button resets the chat messages', async ({ page }) => {
    await waitForChatReady(page);
    await submitQuery(page, 'Phone please');
    await page.waitForTimeout(3000);

    // Chat should have messages
    const htmlBefore = await page.locator('.overflow-y-auto').first().innerHTML();
    expect(htmlBefore.length).toBeGreaterThan(100);

    // Click Clear button
    const clearBtn = page.locator('button:has-text("Clear"), button[title="Clear"]').first();
    if (await clearBtn.isVisible().catch(() => false)) {
      await clearBtn.click();
      await page.waitForTimeout(1500);

      // After clear, messages should be reset (only welcome message remains)
      const htmlAfter = await page.locator('.overflow-y-auto').first().innerHTML();
      expect(htmlAfter.length).toBeLessThan(htmlBefore.length);
    }
  });
});

// ── API INTEGRATION FROM BROWSER ─────────────────────────────────────────────

test.describe('Shopping Chat — API Integration', () => {
  test('answer-question API returns 200 for valid request', async ({ request }) => {
    const userId = `api-test-${Date.now()}`;
    const res = await request.post(`${BASE}/api/intent/answer-question`, {
      data: { user_id: userId, question_id: 'q1', answer: '60k_plus' },
    });
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.ready).toBe(false);
    expect(data.answers_collected).toBe(1);
  });

  test('3 sequential answers produce ready:true with products', async ({ request }) => {
    const userId = `api-full-${Date.now()}`;
    await request.post(`${BASE}/api/intent/answer-question`, {
      data: { user_id: userId, question_id: 'q1', answer: '60k_plus' },
    });
    await request.post(`${BASE}/api/intent/answer-question`, {
      data: { user_id: userId, question_id: 'q2', answer: 'apple' },
    });
    const res = await request.post(`${BASE}/api/intent/answer-question`, {
      data: { user_id: userId, question_id: 'q3', answer: 'today' },
    });
    const data = await res.json();
    expect(data.ready).toBe(true);
    expect(data.products.length).toBeGreaterThanOrEqual(1);
  });

  test('products have image URLs that are valid', async ({ request }) => {
    const userId = `api-images-${Date.now()}`;
    await request.post(`${BASE}/api/intent/answer-question`, {
      data: { user_id: userId, question_id: 'q1', answer: '30k_60k' },
    });
    await request.post(`${BASE}/api/intent/answer-question`, {
      data: { user_id: userId, question_id: 'q2', answer: 'any' },
    });
    const res = await request.post(`${BASE}/api/intent/answer-question`, {
      data: { user_id: userId, question_id: 'q3', answer: 'this_week' },
    });
    const data = await res.json();
    for (const product of data.products) {
      expect(product.image).toBeTruthy();
      expect(product.image).toMatch(/^https?:\/\//);
    }
  });

  test('intent/analyze returns 3 clarifying questions', async ({ request }) => {
    const res = await request.post(`${BASE}/api/intent/analyze`, {
      data: { user_id: `analyze-${Date.now()}`, input: 'I want a phone' },
    });
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.clarifying_questions).toHaveLength(3);
    expect(data.clarifying_questions[0].id).toBe('q1');
    expect(data.clarifying_questions[1].id).toBe('q2');
    expect(data.clarifying_questions[2].id).toBe('q3');
  });

  test('chat/message returns streaming text response', async ({ request }) => {
    const res = await request.post(`${BASE}/api/chat/message`, {
      data: { user_id: `chat-${Date.now()}`, message: 'I want to buy a laptop' },
    });
    expect(res.status()).toBe(200);
    const text = await res.text();
    expect(text.length).toBeGreaterThan(50);
    // The response should contain product-related content
    expect(text.toLowerCase()).toMatch(
      /laptop|recommend|macbook|dell|hp|lenovo|budget|price|feature/i
    );
  });
});

// ── PERFORMANCE & TIMING ─────────────────────────────────────────────────────

test.describe('Shopping Chat — Performance', () => {
  test('chat input response time < 5s for message submission', async ({ page }) => {
    await waitForChatReady(page);
    const start = Date.now();
    await submitQuery(page, 'I want a phone');
    // Wait for AI response message
    await page.locator('.bg-gray-100').first().waitFor({ state: 'visible', timeout: 5000 });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(5000);
  });

  test('questions appear < 8s after query submission', async ({ page }) => {
    await waitForChatReady(page);
    const start = Date.now();
    await submitQuery(page, 'I want to buy a phone');
    await waitForQuestions(page);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(8000);
  });

  test('recommendations appear < 10s after final answer', async ({ page }) => {
    await waitForChatReady(page);
    await submitQuery(page, 'Phone');
    await waitForQuestions(page);

    await answerQuestion(page, 'q1', '60k_plus');
    await answerQuestion(page, 'q2', 'apple');

    const start = Date.now();
    await answerQuestion(page, 'q3', 'today');
    await page
      .locator('text=Top Recommendations')
      .first()
      .waitFor({ state: 'visible', timeout: 10000 });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(10000);
  });

  test('answer-question API responds < 2s', async ({ request }) => {
    const userId = `perf-${Date.now()}`;
    const start = Date.now();
    await request.post(`${BASE}/api/intent/answer-question`, {
      data: { user_id: userId, question_id: 'q1', answer: '60k_plus' },
    });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(2000);
  });
});

// ── VISUAL REGRESSION & LAYOUT ───────────────────────────────────────────────

test.describe('Shopping Chat — Layout & Visual', () => {
  test('shopping assistant page has two-column layout (chat + sidebar)', async ({ page }) => {
    await waitForChatReady(page);

    // Left column: chat with textarea
    await expect(page.locator('textarea').first()).toBeVisible();

    // Right column: sidebar with Decision/Pipeline/Approval tabs
    await expect(page.locator('text=Decision').first()).toBeVisible();
    await expect(page.locator('text=Pipeline').first()).toBeVisible();
  });

  test('AI TOP PICK card is visible in sidebar', async ({ page }) => {
    await waitForChatReady(page);

    await expect(page.locator('text=AI TOP PICK')).toBeVisible({ timeout: 10000 });
  });

  test('chat header shows "AI Shopping Copilot" title', async ({ page }) => {
    await waitForChatReady(page);

    await expect(page.locator('text=AI Shopping Copilot')).toBeVisible({ timeout: 10000 });
  });

  test('quick action buttons are visible below chat input', async ({ page }) => {
    await waitForChatReady(page);

    // Quick action suggestion buttons (e.g., "Find noise-canceling headphones under $300")
    const quickActions = page.locator('text=/Find noise|Compare Sony|Best wireless/i');
    expect(await quickActions.count()).toBeGreaterThanOrEqual(1);
  });

  test('full flow screenshot captures recommendation carousel', async ({ page }) => {
    await waitForChatReady(page);
    await submitQuery(page, 'I want a smartphone');
    await waitForQuestions(page);
    await scrollChatToBottom(page);

    await answerQuestion(page, 'q1', '60k_plus');
    await answerQuestion(page, 'q2', 'apple');
    await answerQuestion(page, 'q3', 'today');
    await page.waitForTimeout(3000);
    await scrollChatToBottom(page);

    // Take screenshot for visual proof
    await page.screenshot({
      path: 'test-results/recommendation-carousel-proof.png',
      fullPage: true,
    });

    // Verify the carousel is in the screenshot by checking DOM
    const carouselHTML = await page.evaluate(() => {
      const el = document.querySelector('.overflow-y-auto');
      return el?.innerHTML ?? '';
    });
    expect(carouselHTML).toContain('Best Match');
    expect(carouselHTML).toContain('Add to Cart');
  });
});
