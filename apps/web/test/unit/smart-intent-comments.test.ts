/**
 * Round 26 Unit Tests — Audit Comments, Duplicate Detection & Batch Enrich Filters
 * Tests:
 *  - buildComment (via insertSmartIntentRecord smoke test)
 *  - Duplicate query auto-deactivation with system comment
 *  - updateSupervisedResponse appends audit comment
 *  - updateAIEnrichedResponse appends audit comment
 *  - toggleSmartIntentActive appends audit comment
 *  - getUnenrichedRecords strict filter (non-anonymous, active, AI=No)
 *  - getUnenrichedRecordsForModel 30-day window
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock state ──────────────────────────────────────────────────────────────
let capturedQueries: Array<{ sql: string; params: unknown[] }> = [];
let mockExistingRow: unknown = null;  // controls duplicate-check return

const mockClient = {
  query: vi.fn(async (sql: string, params?: unknown[]) => {
    capturedQueries.push({ sql, params: params ?? [] });

    // ── Count query ─────────────────────────────────────────────────────
    if (sql.includes('COUNT(*)')) {
      return { rows: [{ count: '3' }] };
    }
    // ── Duplicate-check SELECT ──────────────────────────────────────────
    if (sql.includes('LOWER(TRIM("queryText")) = LOWER')) {
      return { rows: mockExistingRow ? [mockExistingRow] : [] };
    }
    // ── INSERT ─────────────────────────────────────────────────────────
    if (sql.includes('INSERT INTO "SmartIntentEngineResponse"')) {
      const isActive = params?.[5] as boolean;
      const comments = JSON.parse((params?.[6] as string) || '[]');
      return {
        rows: [{
          id: 99,
          userId: params?.[0],
          queryBy: params?.[1],
          queryText: params?.[2],
          initialProductSuggestionText: params?.[3],
          intentEngineResponse: {},
          supervisedResponse: {},
          aiEnrichedResponse: null,
          enhancedByAI: false,
          isActive,
          comments,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }],
      };
    }
    // ── UPDATE supervisedResponse ───────────────────────────────────────
    if (sql.includes('"supervisedResponse"')) {
      const comments = JSON.parse((params?.[2] as string) || '[]');
      return {
        rows: [{
          id: params?.[0],
          supervisedResponse: JSON.parse((params?.[1] as string) || '{}'),
          comments,
          enhancedByAI: false,
          isActive: true,
          updatedAt: new Date().toISOString(),
        }],
      };
    }
    // ── UPDATE aiEnrichedResponse ───────────────────────────────────────
    if (sql.includes('"aiEnrichedResponse"')) {
      const comments = JSON.parse((params?.[2] as string) || '[]');
      return {
        rows: [{
          id: params?.[0],
          aiEnrichedResponse: JSON.parse((params?.[1] as string) || '{}'),
          enhancedByAI: true,
          comments,
          updatedAt: new Date().toISOString(),
        }],
      };
    }
    // ── UPDATE isActive (toggle) ────────────────────────────────────────
    if (sql.includes('"isActive"')) {
      const comments = JSON.parse((params?.[2] as string) || '[]');
      return {
        rows: [{
          id: params?.[0],
          isActive: params?.[1],
          comments,
          updatedAt: new Date().toISOString(),
        }],
      };
    }
    // ── SELECT for getUnenriched* ───────────────────────────────────────
    if (sql.includes('"enhancedByAI"') && sql.includes('LIMIT')) {
      return { rows: [] };
    }
    return { rows: [] };
  }),
  release: vi.fn(),
};

vi.mock('pg', () => ({
  Pool: vi.fn().mockImplementation(() => ({
    connect: vi.fn(async () => mockClient),
    query: mockClient.query,
    on: vi.fn(),
    end: vi.fn(),
  })),
}));

// ── Helpers ─────────────────────────────────────────────────────────────────

function lastInsertParams() {
  const q = capturedQueries.findLast(q => q.sql.includes('INSERT INTO'));
  return q?.params ?? [];
}

function lastUpdateParams(keyword: string) {
  const q = capturedQueries.findLast(q => q.sql.includes(keyword));
  return q?.params ?? [];
}

function getUnenrichedQuery() {
  return capturedQueries.findLast(q =>
    q.sql.includes('"enhancedByAI"') && q.sql.includes('LIMIT')
  );
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('Round 26 — Audit Comments & Duplicate Detection', () => {
  beforeEach(() => {
    capturedQueries = [];
    mockExistingRow = null;
    vi.resetModules();
  });

  // ── 1. INSERT: no duplicate ────────────────────────────────────────────
  it('insertSmartIntentRecord: creates active record with "created" comment when no duplicate', async () => {
    const { insertSmartIntentRecord } = await import('../../lib/db');
    const record = await insertSmartIntentRecord({
      userId: 1,
      queryBy: 'admin@test.com',
      queryText: 'red running shoes size 10',
      initialProductSuggestionText: null,
      intentEngineResponse: { intent: 'product_search' },
    });

    // Record should be active
    expect(record.isActive).toBe(true);
    // Should have 1 comment with action 'created'
    expect(record.comments).toHaveLength(1);
    expect(record.comments[0].action).toBe('created');
    expect(record.comments[0].userId).toBe('system');
    expect(record.comments[0].text).toContain('Record created');
    expect(record.comments[0].timestamp).toBeTruthy();

    // Duplicate-check SELECT must have run first
    const dupCheckQuery = capturedQueries.find(q =>
      q.sql.includes('LOWER(TRIM("queryText")) = LOWER')
    );
    expect(dupCheckQuery).toBeDefined();
  });

  // ── 2. INSERT: duplicate detected ─────────────────────────────────────
  it('insertSmartIntentRecord: auto-deactivates with duplicate_deactivated comment when duplicate found', async () => {
    mockExistingRow = { id: 42 };

    const { insertSmartIntentRecord } = await import('../../lib/db');
    const record = await insertSmartIntentRecord({
      userId: 2,
      queryBy: 'shopper@test.com',
      queryText: 'red running shoes size 10',
      initialProductSuggestionText: null,
      intentEngineResponse: { intent: 'product_search' },
    });

    // Record should be INACTIVE (duplicate)
    expect(record.isActive).toBe(false);

    // Comment must reflect duplicate reason
    expect(record.comments).toHaveLength(1);
    expect(record.comments[0].action).toBe('duplicate_deactivated');
    expect(record.comments[0].text).toContain('duplicate');
    expect(record.comments[0].text).toContain('42');  // original record ID
    expect(record.comments[0].userId).toBe('system');
  });

  // ── 3. updateSupervisedResponse: appends audit comment ────────────────
  it('updateSupervisedResponse: appends supervisor_edited comment with adminEmail', async () => {
    const { updateSupervisedResponse } = await import('../../lib/db');
    const result = await updateSupervisedResponse(
      1,
      { intent: 'product_search', category: 'shoes' },
      'admin@delegatecart.com'
    );

    expect(result).not.toBeNull();
    expect(result!.comments).toHaveLength(1);
    expect(result!.comments[0].action).toBe('supervisor_edited');
    expect(result!.comments[0].userId).toBe('admin@delegatecart.com');
    expect(result!.comments[0].text).toContain('Supervised response updated');

    // SQL must use JSONB concatenation (||)
    const updateQuery = capturedQueries.findLast(q => q.sql.includes('"supervisedResponse"'));
    expect(updateQuery?.sql).toContain('"comments" = "comments" ||');
  });

  // ── 4. updateAIEnrichedResponse: appends ai_enriched comment ──────────
  it('updateAIEnrichedResponse: appends ai_enriched comment', async () => {
    const { updateAIEnrichedResponse } = await import('../../lib/db');
    const result = await updateAIEnrichedResponse(
      2,
      { questions: ['What size?'], category: 'shoes' },
      'batch-process'
    );

    expect(result).not.toBeNull();
    expect(result!.enhancedByAI).toBe(true);
    expect(result!.comments).toHaveLength(1);
    expect(result!.comments[0].action).toBe('ai_enriched');
    expect(result!.comments[0].userId).toBe('batch-process');
    expect(result!.comments[0].text).toContain('AI enrichment');

    const q = capturedQueries.findLast(q => q.sql.includes('"aiEnrichedResponse"'));
    expect(q?.sql).toContain('"enhancedByAI" = true');
    expect(q?.sql).toContain('"comments" = "comments" ||');
  });

  // ── 5. toggleSmartIntentActive: appends toggled_active comment ─────────
  it('toggleSmartIntentActive: appends "Record activated" comment when activating', async () => {
    const { toggleSmartIntentActive } = await import('../../lib/db');
    const result = await toggleSmartIntentActive(5, true, 'moderator@test.com');

    expect(result).not.toBeNull();
    expect(result!.isActive).toBe(true);
    expect(result!.comments).toHaveLength(1);
    expect(result!.comments[0].action).toBe('toggled_active');
    expect(result!.comments[0].text).toContain('activated');
    expect(result!.comments[0].userId).toBe('moderator@test.com');
  });

  it('toggleSmartIntentActive: appends "Record deactivated" comment when deactivating', async () => {
    const { toggleSmartIntentActive } = await import('../../lib/db');
    const result = await toggleSmartIntentActive(6, false, 'admin@test.com');

    expect(result!.isActive).toBe(false);
    expect(result!.comments[0].text).toContain('deactivated');
    expect(result!.comments[0].action).toBe('toggled_active');
  });
});

describe('Round 26 — Batch Enrich Query Filters', () => {
  beforeEach(() => {
    capturedQueries = [];
    vi.resetModules();
  });

  it('getUnenrichedRecords: SQL must filter enhancedByAI=false, isActive=true, exclude anonymous', async () => {
    const { getUnenrichedRecords } = await import('../../lib/db');
    await getUnenrichedRecords(10);

    const q = getUnenrichedQuery();
    expect(q).toBeDefined();
    expect(q!.sql).toContain('"enhancedByAI" = false');
    expect(q!.sql).toContain('"isActive" = true');
    expect(q!.sql).toContain("LOWER(\"queryBy\") != 'anonymous'");
    expect(q!.sql).toContain('"aiEnrichedResponse" IS NULL OR');
    expect(q!.params[0]).toBe(10);
  });

  it('getUnenrichedRecordsForModel: SQL includes 30-day window AND all strict filters', async () => {
    const { getUnenrichedRecordsForModel } = await import('../../lib/db');
    await getUnenrichedRecordsForModel(5, 'claude-opus');

    const q = getUnenrichedQuery();
    expect(q).toBeDefined();
    expect(q!.sql).toContain('"enhancedByAI" = false');
    expect(q!.sql).toContain('"isActive" = true');
    expect(q!.sql).toContain("LOWER(\"queryBy\") != 'anonymous'");
    expect(q!.sql).toContain("INTERVAL '30 days'");
    expect(q!.params[0]).toBe(5);
  });

  it('getUnenrichedRecords: respects batchSize limit', async () => {
    const { getUnenrichedRecords } = await import('../../lib/db');
    await getUnenrichedRecords(3);

    const q = getUnenrichedQuery();
    expect(q!.params[0]).toBe(3);
  });
});

describe('Round 26 — Comment Structure Validation', () => {
  beforeEach(() => {
    capturedQueries = [];
    vi.resetModules();
  });

  it('comment entries have required fields: text, timestamp, userId, action', async () => {
    const { updateSupervisedResponse } = await import('../../lib/db');
    const result = await updateSupervisedResponse(1, { intent: 'test' }, 'test@user.com');

    const comment = result!.comments[0];
    expect(comment).toHaveProperty('text');
    expect(comment).toHaveProperty('timestamp');
    expect(comment).toHaveProperty('userId');
    expect(comment).toHaveProperty('action');

    // Timestamp must be a valid ISO date string
    expect(() => new Date(comment.timestamp)).not.toThrow();
    expect(new Date(comment.timestamp).getTime()).not.toBeNaN();
  });

  it('comment appending uses JSONB || operator (not SELECT+UPDATE)', async () => {
    const { toggleSmartIntentActive } = await import('../../lib/db');
    await toggleSmartIntentActive(10, true, 'admin@test.com');

    const updateQ = capturedQueries.findLast(q => q.sql.includes('"isActive"'));
    // Must append via ||, not overwrite
    expect(updateQ!.sql).toContain('"comments" = "comments" ||');
    // Must NOT SELECT first (single UPDATE only)
    const selectCount = capturedQueries.filter(q =>
      q.sql.startsWith('SELECT') && q.sql.includes('"comments"')
    ).length;
    expect(selectCount).toBe(0);
  });
});
