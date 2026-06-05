/**
 * Round 27 — E2E Tests
 * LLM model dropdown, connectivity badge, error handling, entity extractor
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:3000';
const LEARNING_URL = `${BASE_URL}/admin/learning`;
const ADMIN_EMAIL = 'admin@delegatecart.com';

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────
async function goToLearningPage(page: any) {
  await page.goto(LEARNING_URL);
  await page.evaluate((email: string) => localStorage.setItem('userEmail', email), ADMIN_EMAIL);
  await page.reload();
  await page.waitForLoadState('networkidle');
}

// ────────────────────────────────────────────────────────────────────────────
// 1. LLM Model Selector panel exists
// ────────────────────────────────────────────────────────────────────────────
test('Round 27: LLM model selector panel is visible', async ({ page }) => {
  await goToLearningPage(page);
  // The model selector row contains the brain icon and text
  await expect(page.getByText('LLM Model:')).toBeVisible({ timeout: 8000 });
});

test('Round 27: Model dropdown select element is present', async ({ page }) => {
  await goToLearningPage(page);
  const select = page.locator('select').first();
  await expect(select).toBeVisible({ timeout: 8000 });
});

test('Round 27: Dropdown has at least one model option', async ({ page }) => {
  await goToLearningPage(page);
  const select = page.locator('select').first();
  await expect(select).toBeVisible({ timeout: 8000 });
  const options = await select.locator('option').count();
  expect(options).toBeGreaterThanOrEqual(1);
});

// ────────────────────────────────────────────────────────────────────────────
// 2. AI Batch Enrich button still works
// ────────────────────────────────────────────────────────────────────────────
test('Round 27: AI Batch Enrich button is visible', async ({ page }) => {
  await goToLearningPage(page);
  const enrichBtn = page.getByRole('button', { name: /AI Batch Enrich/i });
  await expect(enrichBtn).toBeVisible({ timeout: 8000 });
});

// ────────────────────────────────────────────────────────────────────────────
// 3. Connectivity badge area exists
// ────────────────────────────────────────────────────────────────────────────
test('Round 27: Connectivity area (Check button or badge) is present', async ({ page }) => {
  await goToLearningPage(page);
  // Could be "Check", "Connected", "Checking…", "Key Missing", "API Error"
  const connectivityArea = page.locator('text=/Connected|Checking|Check|Key Missing|API Error/i');
  await expect(connectivityArea.first()).toBeVisible({ timeout: 10000 });
});

// ────────────────────────────────────────────────────────────────────────────
// 4. GET /api/admin/learning?action=models returns model list
// ────────────────────────────────────────────────────────────────────────────
test('Round 27: API models endpoint returns 3 models', async ({ request }) => {
  const resp = await request.get(`${BASE_URL}/api/admin/learning?action=models`, {
    headers: { 'x-user-email': ADMIN_EMAIL },
  });
  expect(resp.status()).toBe(200);
  const data = await resp.json();
  expect(Array.isArray(data.models)).toBe(true);
  expect(data.models.length).toBe(3);
  const ids = data.models.map((m: any) => m.id);
  expect(ids).toContain('claude-opus');
  expect(ids).toContain('gpt-4-turbo');
  expect(ids).toContain('gpt-3.5-turbo');
});

test('Round 27: API models returns model with apiKeyEnv field', async ({ request }) => {
  const resp = await request.get(`${BASE_URL}/api/admin/learning?action=models`, {
    headers: { 'x-user-email': ADMIN_EMAIL },
  });
  const data = await resp.json();
  const claude = data.models.find((m: any) => m.id === 'claude-opus');
  expect(claude).toBeDefined();
  expect(claude.apiKeyEnv).toBe('ANTHROPIC_API_KEY');
});

// ────────────────────────────────────────────────────────────────────────────
// 5. GET /api/admin/learning?action=check-connectivity returns structured response
// ────────────────────────────────────────────────────────────────────────────
test('Round 27: check-connectivity endpoint returns structured response', async ({ request }) => {
  const resp = await request.get(`${BASE_URL}/api/admin/learning?action=check-connectivity&model=claude-opus`, {
    headers: { 'x-user-email': ADMIN_EMAIL },
  });
  // Either 200 (connected) or 503 (not connected) — both are valid structured responses
  expect([200, 503]).toContain(resp.status());
  const data = await resp.json();
  expect(data).toHaveProperty('modelId');
  expect(data).toHaveProperty('connected');
  expect(data).toHaveProperty('provider');
  expect(data).toHaveProperty('apiKeyConfigured');
  expect(data.modelId).toBe('claude-opus');
  expect(data.provider).toBe('Anthropic');
});

test('Round 27: check-connectivity returns 503 when ANTHROPIC_API_KEY unset', async ({ request }) => {
  // In local Docker without a real API key, connectivity check should return 503
  const resp = await request.get(`${BASE_URL}/api/admin/learning?action=check-connectivity&model=claude-opus`, {
    headers: { 'x-user-email': ADMIN_EMAIL },
  });
  // Without a real API key, this should be 503
  if (resp.status() === 503) {
    const data = await resp.json();
    expect(data.connected).toBe(false);
    expect(typeof data.error).toBe('string');
    expect(data.error.length).toBeGreaterThan(5);
  } else {
    // If we have a real key configured, still verify structure
    const data = await resp.json();
    expect(data).toHaveProperty('connected');
  }
});

test('Round 27: check-connectivity for unknown model returns error', async ({ request }) => {
  const resp = await request.get(`${BASE_URL}/api/admin/learning?action=check-connectivity&model=mystic-model`, {
    headers: { 'x-user-email': ADMIN_EMAIL },
  });
  expect([400, 503]).toContain(resp.status());
  const data = await resp.json();
  expect(data.connected).toBe(false);
});

// ────────────────────────────────────────────────────────────────────────────
// 6. POST enrich-batch returns connectivity error when LLM is unavailable
// ────────────────────────────────────────────────────────────────────────────
test('Round 27: POST enrich-batch returns 503 with connectivity details when LLM unavailable', async ({ request }) => {
  const resp = await request.post(`${BASE_URL}/api/admin/learning`, {
    headers: {
      'Content-Type': 'application/json',
      'x-user-email': ADMIN_EMAIL,
    },
    data: { action: 'enrich-batch', batchSize: 5, model: 'claude-opus' },
  });

  // If real key is set → 200, if not → 503 with connectivity info
  if (resp.status() === 503) {
    const data = await resp.json();
    expect(data).toHaveProperty('error');
    expect(data).toHaveProperty('connectivity');
    expect(data.connectivity).toHaveProperty('connected');
    expect(data.connectivity).toHaveProperty('errorDetail');
    expect(data.connectivity).toHaveProperty('resolution');
    // CRITICAL: No damage to DB records
    expect(data.error).toMatch(/No records were processed/i);
  } else {
    expect(resp.status()).toBe(200);
  }
});

// ────────────────────────────────────────────────────────────────────────────
// 7. Dashboard layout integrity
// ────────────────────────────────────────────────────────────────────────────
test('Round 27: Dashboard still shows all 11 columns', async ({ page }) => {
  await goToLearningPage(page);
  const headers = page.locator('table thead th');
  await expect(headers.first()).toBeVisible({ timeout: 8000 });
  const count = await headers.count();
  expect(count).toBe(11);
});

test('Round 27: Criteria banner still shows enrich filters', async ({ page }) => {
  await goToLearningPage(page);
  await expect(page.getByText(/AI Batch Enrich criteria/i)).toBeVisible({ timeout: 8000 });
});

test('Round 27: Search box and Refresh button still present', async ({ page }) => {
  await goToLearningPage(page);
  await expect(page.locator('input[placeholder*="Search"]')).toBeVisible({ timeout: 8000 });
  await expect(page.getByRole('button', { name: /Refresh/i })).toBeVisible({ timeout: 8000 });
});
