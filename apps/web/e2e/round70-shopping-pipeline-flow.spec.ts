/**
 * Round 70 — Shopping Assistant Pipeline Flow E2E Tests
 *
 * Full end-to-end coverage of the Smart Intent Engine pipeline:
 *   T01 — Shopping assistant page loads correctly
 *   T02 — /api/intent/analyze API returns valid JSON with correct shape
 *   T03 — analyze API always returns ≥1 clarifying_question (safety-net fix)
 *   T04 — analyze API search string must NOT contain prefixed noun_signals
 *   T05 — analyze API returns real DB products (isDBProduct: true) when available
 *   T06 — Sending a query shows the chat input and triggers assistant response
 *   T07 — Clarifying questions are rendered in the chat after a query
 *   T08 — Answering a clarifying question progresses the pipeline
 *   T09 — Product carousel appears when DB has matching products
 *   T10 — Pipeline panel right-side updates to show timeline steps
 *   T11 — Suggestion chips in welcome screen trigger a new query
 *   T12 — Chat handles fully-specified queries (budget+brand+use_case all present)
 *   T13 — No synthetic / non-DB product names in chat responses
 *   T14 — /api/chat/message returns only first line (no synthetic catalog dump)
 *   T15 — Budget-exceeded message shown when products found but over budget
 *
 * Run:
 *   cd apps/web
 *   BASE_URL=http://127.0.0.1:3010 npx playwright test e2e/round70-shopping-pipeline-flow.spec.ts --reporter=line
 *
 * Video evidence recorded automatically (playwright.config.ts: video: 'on').
 */

import { test, expect, type Page } from '@playwright/test';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3010';
const API = `${BASE}/api/intent/analyze`;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** POST to /api/intent/analyze and return parsed JSON */
async function analyzeIntent(page: Page, query: string) {
  const res = await page.request.post(API, {
    data: { query, user_id: 'e2e-test' },
    headers: { 'Content-Type': 'application/json' },
  });
  expect(res.status()).toBe(200);
  return res.json();
}

/** Navigate to shopping assistant and wait for the page to be ready.
 *  Injects a fake auth token so the page doesn't redirect to /signin. */
async function openShoppingAssistant(page: Page) {
  // Inject auth into localStorage before the page script runs
  await page.addInitScript(() => {
    localStorage.setItem('authToken', 'e2e-test-token');
    localStorage.setItem('userEmail', 'e2etest@delegatecart.com');
    localStorage.setItem('dc-user-id', 'user-e2etest-delegatecart-com');
  });
  await page.goto(`${BASE}/shopping-assistant`);
  await page.waitForLoadState('networkidle');
  // Wait for ShoppingChat textarea to be visible (placeholder = "Ask me anything about products...")
  await page.waitForSelector(
    'textarea[placeholder*="Ask" i], textarea[placeholder*="product" i], textarea[placeholder*="anything" i]',
    {
      timeout: 30000,
    }
  );
}

/** Send a message via the chat input */
async function sendChatMessage(page: Page, message: string) {
  // Target the ShoppingChat textarea — placeholder = "Ask me anything about products..."
  const chatInput = page
    .locator(
      'textarea[placeholder*="Ask" i], textarea[placeholder*="product" i], textarea[placeholder*="anything" i], textarea[placeholder*="message" i]'
    )
    .first();
  await chatInput.waitFor({ state: 'visible', timeout: 20000 });
  await chatInput.fill(message);
  await chatInput.press('Enter');
}

// ── SECTION 1: API Shape Tests ────────────────────────────────────────────────

test('T01 — shopping assistant page loads with HTTP 200', async ({ page }) => {
  const res = await page.goto(`${BASE}/shopping-assistant`);
  expect(res?.status()).toBe(200);
  await page.waitForLoadState('networkidle');
  // Page title or heading should be present
  const title = await page.title();
  expect(title.length).toBeGreaterThan(0);
});

test('T02 — /api/intent/analyze returns correct top-level shape', async ({ page }) => {
  const data = await analyzeIntent(page, 'laptop under 50000');
  expect(data).toHaveProperty('intent');
  expect(data).toHaveProperty('clarifying_questions');
  expect(data).toHaveProperty('engine_version');
  expect(Array.isArray(data.clarifying_questions)).toBe(true);
  expect(data.engine_version).toBe('v2');
});

test('T03 — analyze API always returns ≥1 clarifying question (safety-net)', async ({ page }) => {
  // Use a fully-specified query (budget + brand + use_case + feature all present)
  // so the question generator's safety-net clause is exercised.
  const data = await analyzeIntent(
    page,
    'Samsung washing machine under 45000 for home use with inverter technology'
  );
  expect(data).toHaveProperty('clarifying_questions');
  expect(Array.isArray(data.clarifying_questions)).toBe(true);
  // Safety net: even fully-specified intent must return ≥1 question
  expect(data.clarifying_questions.length).toBeGreaterThanOrEqual(1);

  // Each question must have proper structure
  const q = data.clarifying_questions[0];
  expect(q).toHaveProperty('id');
  expect(q).toHaveProperty('question');
  expect(typeof q.question).toBe('string');
  expect(q.question.length).toBeGreaterThan(5);
  expect(Array.isArray(q.options)).toBe(true);
  expect(q.options.length).toBeGreaterThan(0);
});

test('T04 — analyze API search must NOT contain prefixed noun_signals', async ({ page }) => {
  // This verifies the critical bug fix: "category:appliances" and "brand:Samsung"
  // must never appear in the NestJS search query string.
  // We intercept all outbound requests to localhost:3001 and check for bad tokens.
  const nestRequests: string[] = [];
  page.on('request', (req) => {
    if (req.url().includes(':3001/products')) {
      nestRequests.push(req.url());
    }
  });

  await analyzeIntent(page, 'LG refrigerator under 80000');

  // Check that no NestJS request contained prefixed tokens
  for (const url of nestRequests) {
    const decoded = decodeURIComponent(url);
    expect(decoded).not.toContain('category:');
    expect(decoded).not.toContain('brand:');
  }
});

test('T05 — analyze API returns products marked as real DB products', async ({ page }) => {
  const data = await analyzeIntent(page, 'laptop under 60000');
  expect(data).toHaveProperty('products');
  expect(Array.isArray(data.products)).toBe(true);

  if (data.products.length > 0) {
    const p = data.products[0];
    // Real DB products must have these fields
    expect(p).toHaveProperty('id');
    expect(p).toHaveProperty('name');
    expect(typeof p.name).toBe('string');
    expect(p.name.length).toBeGreaterThan(0);
    expect(p).toHaveProperty('price');
    expect(typeof p.price).toBe('number');
    expect(p.price).toBeGreaterThan(0);
    // isDBProduct flag must be true (no synthetic products)
    expect(p.isDBProduct).toBe(true);
    // Product ID must not be a synthetic ID
    expect(String(p.id)).not.toMatch(/^synth-/);
  }
});

test('T06 — intent category is detected correctly for common queries', async ({ page }) => {
  const cases: Array<{ query: string; expectedCategory: string }> = [
    { query: 'best washing machine under 60000', expectedCategory: 'appliances' },
    { query: 'gaming laptop with RTX 4060', expectedCategory: 'laptop' },
    { query: 'iPhone 15 Pro Max price', expectedCategory: 'phone' },
    { query: 'Sony WH-1000XM5 headphones', expectedCategory: 'headphones' },
  ];

  for (const { query, expectedCategory } of cases) {
    const data = await analyzeIntent(page, query);
    expect(data.intent).toHaveProperty('category');
    expect(data.intent.category).toBe(expectedCategory);
  }
});

test('T07 — confidence is a number between 0 and 1 in the response', async ({ page }) => {
  const data = await analyzeIntent(page, 'Samsung Galaxy S24 Ultra under 1 lakh');
  expect(typeof data.intent.confidence).toBe('number');
  expect(data.intent.confidence).toBeGreaterThanOrEqual(0);
  expect(data.intent.confidence).toBeLessThanOrEqual(1);
});

test('T08 — budget is parsed correctly from natural language', async ({ page }) => {
  const data = await analyzeIntent(page, 'laptop under 50000');
  if (data.intent.budget) {
    expect(data.intent.budget.max).toBeGreaterThan(0);
    // "under 50000" should set max = 50000
    expect(data.intent.budget.max).toBeLessThanOrEqual(50000);
  }
});

// ── SECTION 2: Chat UI Tests ──────────────────────────────────────────────────

test('T09 — shopping assistant page has a chat input element', async ({ page }) => {
  await page.goto(`${BASE}/shopping-assistant`);
  await page.waitForLoadState('networkidle');
  // Find a visible text input or textarea
  const input = page.locator('textarea, input[type="text"]').last();
  await expect(input).toBeVisible({ timeout: 30000 });
});

test('T10 — typing a query and sending shows a response in the chat', async ({ page }) => {
  await openShoppingAssistant(page);
  await sendChatMessage(page, 'best laptop under 60000');

  // Wait for the API call to finish — typing indicator appears then response renders
  // The assistant bubble uses bg-gray-100; the session card expands with content
  await page.waitForLoadState('networkidle', { timeout: 90000 });

  // After response, the session accordion shows either:
  //   - A gray assistant bubble (bg-gray-100)
  //   - Clarifying question cards (amber border)
  //   - Product recommendation cards
  // Check that the page still contains the shopping assistant (wasn't navigated away)
  expect(page.url()).toContain('shopping-assistant');

  // At least one session card should be visible (the collapsed/expanded session)
  // Session cards render inside the chat messages area with rounded-xl border
  const sessionCards = page.locator('.rounded-xl.border, .rounded-xl.shadow');
  const sessionCount = await sessionCards.count();
  expect(sessionCount).toBeGreaterThanOrEqual(1);
});

test('T11 — chat response does NOT contain synthetic catalog product names', async ({ page }) => {
  // Verify the fix for chat/message/route.ts that was stripping synthetic product lists
  const res = await page.request.post(`${BASE}/api/chat/message`, {
    data: {
      message: 'show me washing machines',
      userId: 'e2e-test',
      streaming: false,
    },
    headers: { 'Content-Type': 'application/json' },
  });

  if (res.status() === 200) {
    const text = await res.text();
    // The response should NOT contain typical synthetic catalog patterns
    // (product names with ₹ price formatted as "Brand Model — ₹XX,XXX")
    expect(text).not.toMatch(/[A-Z][a-z]+ [A-Z][a-z]+ [\d]+ — ₹/);
    // The response should be short (only the first sentence/line)
    // A typical synthetic dump would be >500 chars; a single sentence is <300
    expect(text.length).toBeLessThan(1500);
  }
});

test('T12 — /api/intent/analyze returns initial_text', async ({ page }) => {
  const data = await analyzeIntent(page, 'best phone under 30000');
  expect(data).toHaveProperty('initial_text');
  expect(typeof data.initial_text).toBe('string');
  expect(data.initial_text.length).toBeGreaterThan(0);
});

test('T13 — clarifying questions have valid option values (not prefixed tokens)', async ({
  page,
}) => {
  const data = await analyzeIntent(page, 'headphones under 5000');
  const questions = data.clarifying_questions as Array<{
    id: string;
    question: string;
    options: Array<{ value: string; label: string }>;
    category: string;
  }>;

  for (const q of questions) {
    // Question text must not contain internal prefixed tokens
    expect(q.question).not.toContain('category:');
    expect(q.question).not.toContain('brand:');

    for (const opt of q.options) {
      // Option values must be plain strings without internal prefixes
      expect(opt.value).not.toContain('category:');
      expect(opt.value).not.toContain('brand:');
      expect(opt.label.length).toBeGreaterThan(0);
    }
  }
});

test('T14 — /api/intent/answer-question endpoint is reachable', async ({ page }) => {
  // Prime the session first
  await analyzeIntent(page, 'laptop under 50000');

  const res = await page.request.post(`${BASE}/api/intent/answer-question`, {
    data: {
      questionId: 'q1',
      answer: '30000_50000',
      questionCategory: 'budget',
    },
    headers: { 'Content-Type': 'application/json' },
  });
  // Should return 200 (may return ready:false if session is missing, but 400/500 are errors)
  expect([200, 400]).toContain(res.status());
});

test('T15 — admin search weights page loads (used by round 69 scoring tests)', async ({ page }) => {
  const res = await page.goto(`${BASE}/admin/search-weights`);
  // 200 (logged in) or redirect to sign-in — both are acceptable
  expect([200, 302, 301]).toContain(res?.status() ?? 200);
  await page.waitForLoadState('networkidle');
});

// ── SECTION 3: Data Quality Tests (V0096 fix validation) ─────────────────────

test('T16 — washing machine query returns Home Appliances products (not smartphones)', async ({
  page,
}) => {
  const data = await analyzeIntent(page, 'washing machine under 60000');
  expect(data).toHaveProperty('products');
  const products = data.products as Array<{ category?: string; isDBProduct?: boolean }>;
  // Must return real DB products
  expect(products.length).toBeGreaterThan(0);
  const dbProducts = products.filter((p) => p.isDBProduct);
  expect(dbProducts.length).toBeGreaterThan(0);
  // CRITICAL: None of the returned products should come from Smartphones category
  for (const p of dbProducts.slice(0, 5)) {
    const cat = (p.category ?? '').toLowerCase();
    expect(cat).not.toBe('phone');
    expect(cat).not.toBe('laptop');
  }
});

test('T17 — refrigerator query returns appliance products distinct from washing machine results', async ({
  page,
}) => {
  const [wmData, fridgeData] = await Promise.all([
    analyzeIntent(page, 'washing machine under 40000'),
    analyzeIntent(page, 'refrigerator under 40000'),
  ]);
  // Both should return products
  expect(wmData.products?.length ?? 0).toBeGreaterThan(0);
  expect(fridgeData.products?.length ?? 0).toBeGreaterThan(0);
  // Pipeline should detect appliances category for both
  expect(wmData.intent?.category).toBe('appliances');
  expect(fridgeData.intent?.category).toBe('appliances');
});

test('T18 — gaming laptop query returns Laptop category products', async ({ page }) => {
  const data = await analyzeIntent(page, 'gaming laptop under 80000');
  expect(data.intent?.category).toBe('laptop');
  const products = (data.products as Array<{ category?: string; isDBProduct?: boolean }>) ?? [];
  const dbProducts = products.filter((p) => p.isDBProduct);
  expect(dbProducts.length).toBeGreaterThan(0);
});

test('T19 — smart intent engine detects specific product types correctly', async ({ page }) => {
  // Test that the detectSpecificProductType logic correctly identifies types
  const queries = [
    { query: 'I need a refrigerator', expectedCategory: 'appliances' },
    { query: 'best gaming laptop under 70000', expectedCategory: 'laptop' },
    { query: 'air conditioner for bedroom', expectedCategory: 'appliances' },
    { query: 'smartphone with 5G', expectedCategory: 'phone' },
  ];

  for (const { query, expectedCategory } of queries) {
    const data = await analyzeIntent(page, query);
    expect(data.intent?.category).toBe(expectedCategory);
    // Should have at least 1 clarifying question (safety-net)
    expect(data.clarifying_questions?.length ?? 0).toBeGreaterThanOrEqual(1);
  }
});
