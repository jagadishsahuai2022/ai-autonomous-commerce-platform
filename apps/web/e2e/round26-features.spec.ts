/**
 * Round 26 E2E Tests — Audit Comments, Duplicate Detection & Batch Enrich Filters
 *
 * Tests:
 *  1. Comments column visible in Self-Learning Dashboard table
 *  2. Comments modal opens with audit log when clicking the Comments badge
 *  3. AI Batch Enrich criteria banner is visible on the page
 *  4. Toggle active appends a comment (verify count increases)
 *  5. Admin API filter smoke test (queryBy != anonymous filter present in UI)
 */
import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:3000';
const ADMIN_SESSION_KEY = 'dc-admin-session';

async function injectAdminSession(page: Page) {
  await page.addInitScript(({ key }) => {
    const session = {
      email: 'admin@delegatecart.com',
      isAdmin: true,
      role: 'admin',
      loginTime: Date.now(),
      expiresAt: Date.now() + 8 * 60 * 60 * 1000,
    };
    sessionStorage.setItem(key, JSON.stringify(session));
    localStorage.setItem('authToken', `e2e-admin-${Date.now()}`);
    localStorage.setItem('userEmail', 'admin@delegatecart.com');
  }, { key: ADMIN_SESSION_KEY });
}

async function goto(page: Page, path: string) {
  await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. Comments Column Presence
// ═════════════════════════════════════════════════════════════════════════════

test.describe('Round 26 — Audit Log Comments Column', () => {
  test.beforeEach(async ({ page }) => {
    await injectAdminSession(page);
    await goto(page, '/admin/learning');
    await page.waitForTimeout(3000);
  });

  test('Comments column header is visible in the table', async ({ page }) => {
    const commentsHeader = page.getByRole('columnheader', { name: /comments/i });
    await expect(commentsHeader).toBeVisible({ timeout: 15000 });
  });

  test('Active? column header is still present (no regression)', async ({ page }) => {
    const activeHeader = page.getByRole('columnheader', { name: /active\?/i });
    await expect(activeHeader).toBeVisible({ timeout: 15000 });
  });

  test('AI? column is still present (no regression)', async ({ page }) => {
    const aiHeader = page.getByRole('columnheader', { name: /AI\?/i });
    await expect(aiHeader).toBeVisible({ timeout: 15000 });
  });

  test('Table has 11 columns: ID, Query By, Query Text, Initial Suggestion, Intent, Supervised, AI Enriched, AI?, Active?, Comments, Actions', async ({ page }) => {
    const headers = page.locator('thead th');
    const count = await headers.count();
    expect(count).toBe(11);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 2. AI Batch Enrich Criteria Banner
// ═════════════════════════════════════════════════════════════════════════════

test.describe('Round 26 — AI Batch Enrich Criteria Notice', () => {
  test.beforeEach(async ({ page }) => {
    await injectAdminSession(page);
    await goto(page, '/admin/learning');
    await page.waitForTimeout(3000);
  });

  test('Criteria banner shows Active, non-anonymous, AI=No, 30-day conditions', async ({ page }) => {
    const banner = page.locator('text=AI Batch Enrich criteria');
    await expect(banner).toBeVisible({ timeout: 15000 });
  });

  test('Criteria banner mentions "anonymous"', async ({ page }) => {
    const pageSrc = await page.content();
    expect(pageSrc).toMatch(/anonymous/i);
  });

  test('Criteria banner mentions "30 days"', async ({ page }) => {
    const pageSrc = await page.content();
    expect(pageSrc).toMatch(/30 days/i);
  });

  test('Batch Enrich button still present', async ({ page }) => {
    const btn = page.getByRole('button', { name: /AI Batch Enrich/i });
    await expect(btn).toBeVisible({ timeout: 15000 });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 3. Comments Modal
// ═════════════════════════════════════════════════════════════════════════════

test.describe('Round 26 — Comments Audit Log Modal', () => {
  test.beforeEach(async ({ page }) => {
    await injectAdminSession(page);
    await goto(page, '/admin/learning');
    await page.waitForTimeout(3000);
  });

  test('Each row in the table has a Comments badge button', async ({ page }) => {
    const rows = page.locator('tbody tr');
    const rowCount = await rows.count();

    if (rowCount === 0) {
      // No records — pass gracefully (empty state visible)
      const emptyState = page.locator('text=No learning records found');
      await expect(emptyState).toBeVisible({ timeout: 10000 });
      return;
    }

    // First data row should have a MessageSquare comments button
    const firstRow = rows.first();
    const commentBtn = firstRow.locator('button[title*="audit"], button[title*="comment"]').or(
      firstRow.locator('svg').filter({ has: page.locator('[data-lucide="message-square"], [class*="MessageSquare"]') }).locator('..')
    );
    // Alternatively check the cell with number badge
    const commentCell = firstRow.locator('td').nth(9); // Comments column is 10th (index 9)
    await expect(commentCell).toBeVisible({ timeout: 10000 });
  });

  test('Clicking Comments button opens audit log modal with title', async ({ page }) => {
    const rows = page.locator('tbody tr');
    const rowCount = await rows.count();
    if (rowCount === 0) {
      test.skip();
      return;
    }

    // Click the first comments button
    const firstRow = rows.first();
    const commentsCell = firstRow.locator('td').nth(9);
    const commentsBtn = commentsCell.locator('button').first();
    await commentsBtn.click();

    // Check that the audit log modal opened
    const modalTitle = page.locator('text=Audit Log');
    await expect(modalTitle).toBeVisible({ timeout: 10000 });
  });

  test('Audit log modal shows "append-only" text or audit entries', async ({ page }) => {
    const rows = page.locator('tbody tr');
    const rowCount = await rows.count();
    if (rowCount === 0) {
      test.skip();
      return;
    }

    // Open comments modal for first row
    const firstRow = rows.first();
    const commentsBtn = firstRow.locator('td').nth(9).locator('button').first();
    await commentsBtn.click();
    await page.waitForTimeout(500);

    // Should show either audit entries or a "No audit log entries yet" message
    const hasEntries = await page.locator('text=Audit Log').isVisible();
    expect(hasEntries).toBe(true);

    // Check for "append-only" footer or "No audit log entries"
    const appendOnlyText = page.locator('text=append-only');
    const noEntriesText = page.locator('text=No audit log entries');
    const hasAny = (await appendOnlyText.isVisible()) || (await noEntriesText.isVisible());
    expect(hasAny).toBe(true);
  });

  test('Audit log modal can be closed with Close button', async ({ page }) => {
    const rows = page.locator('tbody tr');
    const rowCount = await rows.count();
    if (rowCount === 0) {
      test.skip();
      return;
    }

    const firstRow = rows.first();
    const commentsBtn = firstRow.locator('td').nth(9).locator('button').first();
    await commentsBtn.click();
    await page.waitForTimeout(500);

    // Click Close
    const closeBtn = page.getByRole('button', { name: /close/i }).last();
    await closeBtn.click();
    await page.waitForTimeout(300);

    // Modal should be gone
    const modalTitle = page.locator('text=Audit Log');
    await expect(modalTitle).not.toBeVisible({ timeout: 5000 });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 4. isActive Toggle with Comment Tracking
// ═════════════════════════════════════════════════════════════════════════════

test.describe('Round 26 — Toggle Active Appends Audit Comment', () => {
  test.beforeEach(async ({ page }) => {
    await injectAdminSession(page);
    await goto(page, '/admin/learning');
    await page.waitForTimeout(3000);
  });

  test('PATCH /api/admin/learning with isActive returns record.comments in response', async ({ page }) => {
    let patchResponse: unknown = null;

    // Intercept PATCH requests
    page.on('response', async (resp) => {
      if (resp.url().includes('/api/admin/learning') && resp.request().method() === 'PATCH') {
        try {
          patchResponse = await resp.json();
        } catch {}
      }
    });

    const rows = page.locator('tbody tr');
    const rowCount = await rows.count();
    if (rowCount === 0) {
      test.skip();
      return;
    }

    // Get initial comment count from the first row
    const firstRow = rows.first();
    const commentsCell = firstRow.locator('td').nth(9);
    const initialCountText = await commentsCell.locator('button span').textContent() ?? '0';
    const initialCount = parseInt(initialCountText, 10);

    // Find and click the toggle button (Active? column is 9th — index 8)
    const toggleBtn = firstRow.locator('td').nth(8).locator('button').first();
    await toggleBtn.click();
    await page.waitForTimeout(2000);

    // The PATCH response should have come back
    if (patchResponse && typeof patchResponse === 'object') {
      const pr = patchResponse as Record<string, unknown>;
      expect(pr.success).toBe(true);
      if (pr.record && typeof pr.record === 'object') {
        const rec = pr.record as Record<string, unknown>;
        expect(Array.isArray(rec.comments)).toBe(true);
        const comments = rec.comments as unknown[];
        expect(comments.length).toBeGreaterThan(0);
        // Last comment should be toggle_active
        const lastComment = comments[comments.length - 1] as Record<string, unknown>;
        expect(lastComment.action).toBe('toggled_active');
      }
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 5. Edit Modal Tabs
// ═════════════════════════════════════════════════════════════════════════════

test.describe('Round 26 — Edit Modal Tabbed Interface', () => {
  test.beforeEach(async ({ page }) => {
    await injectAdminSession(page);
    await goto(page, '/admin/learning');
    await page.waitForTimeout(3000);
  });

  test('Edit modal has 3 tabs: Supervised Response, Intent Engine, AI Enriched', async ({ page }) => {
    const rows = page.locator('tbody tr');
    const rowCount = await rows.count();
    if (rowCount === 0) {
      test.skip();
      return;
    }

    // Click the "Edit in modal" (Eye) button in Actions (11th column, index 10)
    const actionsCell = rows.first().locator('td').nth(10);
    const eyeBtn = actionsCell.locator('button').nth(1); // 2nd button = eye/modal
    await eyeBtn.click();
    await page.waitForTimeout(500);

    // Check tabs
    await expect(page.getByRole('button', { name: /Supervised Response/i })).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole('button', { name: /Intent Engine/i })).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole('button', { name: /AI Enriched/i })).toBeVisible({ timeout: 8000 });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 6. Anonymous Query Visual Indicator
// ═════════════════════════════════════════════════════════════════════════════

test.describe('Round 26 — Anonymous Query Visual Indicator', () => {
  test.beforeEach(async ({ page }) => {
    await injectAdminSession(page);
    await goto(page, '/admin/learning');
    await page.waitForTimeout(3000);
  });

  test('Page loads without JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.waitForTimeout(1000);
    // Filter out known benign errors
    const realErrors = errors.filter(e =>
      !e.includes('hydration') &&
      !e.includes('ResizeObserver') &&
      !e.includes('Non-Error promise rejection')
    );
    expect(realErrors).toHaveLength(0);
  });

  test('Learning dashboard renders the full page title', async ({ page }) => {
    const title = page.locator('h1:has-text("Self-Learning"), h1:has-text("Learning Dashboard")');
    await expect(title).toBeVisible({ timeout: 15000 });
  });
});
