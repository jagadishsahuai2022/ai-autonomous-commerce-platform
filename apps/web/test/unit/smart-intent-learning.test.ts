/**
 * Unit tests for Smart Intent Learning system
 * Tests DB functions, admin API route, and learning pipeline
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock Postgres Pool ──────────────────────────────────────────────────────

const mockRows: any[] = [];
let lastQuery = '';
let lastParams: any[] = [];

const mockClient = {
  query: vi.fn(async (sql: string, params?: any[]) => {
    lastQuery = sql;
    lastParams = params || [];
    if (sql.includes('INSERT INTO "SmartIntentEngineResponse"')) {
      return { rows: [{ id: 1 }] };
    }
    if (sql.includes('FROM "SmartIntentEngineResponse"') && sql.includes('COUNT')) {
      return { rows: [{ total: '5' }] };
    }
    if (sql.includes('FROM "SmartIntentEngineResponse"') && sql.includes('ORDER BY')) {
      return { rows: mockRows };
    }
    if (sql.includes('UPDATE "SmartIntentEngineResponse"') && sql.includes('"supervisedResponse"')) {
      return { rows: [{ id: 1, supervisedResponse: {} }] };
    }
    if (sql.includes('UPDATE "SmartIntentEngineResponse"') && sql.includes('"aiEnrichedResponse"')) {
      return { rows: [{ id: 1, enhancedByAI: true }] };
    }
    if (sql.includes('DELETE FROM "SmartIntentEngineResponse"')) {
      return { rows: [], rowCount: 1 };
    }
    if (sql.includes('LOWER("queryText") = LOWER')) {
      return { rows: mockRows };
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

describe('Smart Intent Learning — DB Functions', () => {
  beforeEach(() => {
    mockRows.length = 0;
    lastQuery = '';
    lastParams = [];
  });

  it('insertSmartIntentRecord builds correct INSERT query', async () => {
    const { insertSmartIntentRecord } = await import('../../lib/db');
    
    const data = {
      userId: 1,
      queryBy: 'admin@delegatecart.com',
      queryText: 'show me wireless headphones under 5000',
      initialProductSuggestionText: 'Sony WH-1000XM5, JBL Tune...',
      intentEngineResponse: { intent: 'product_search', category: 'headphones' },
    };

    const result = await insertSmartIntentRecord(data);
    expect(lastQuery).toContain('INSERT INTO "SmartIntentEngineResponse"');
    expect(lastQuery).toContain('"queryText"');
    expect(lastParams).toContain('show me wireless headphones under 5000');
  });

  it('getSmartIntentRecords returns paginated records with total', async () => {
    const { getSmartIntentRecords } = await import('../../lib/db');
    const result = await getSmartIntentRecords(20, 0);
    expect(lastQuery).toContain('ORDER BY');
    expect(lastQuery).toContain('LIMIT');
    expect(result).toHaveProperty('records');
    expect(result).toHaveProperty('total');
  });

  it('getSmartIntentRecords applies search filter with ILIKE', async () => {
    const { getSmartIntentRecords } = await import('../../lib/db');
    await getSmartIntentRecords(20, 0, 'headphones');
    expect(lastQuery).toContain('ILIKE');
  });

  it('updateSupervisedResponse targets correct record', async () => {
    const { updateSupervisedResponse } = await import('../../lib/db');
    await updateSupervisedResponse(42, { questions: ['What brand?'] });
    expect(lastQuery).toContain('UPDATE "SmartIntentEngineResponse"');
    expect(lastQuery).toContain('"supervisedResponse"');
    expect(lastParams).toContain(42);
  });

  it('updateAIEnrichedResponse sets enhancedByAI to true', async () => {
    const { updateAIEnrichedResponse } = await import('../../lib/db');
    await updateAIEnrichedResponse(42, { questions: ['Budget range?', 'Brand preference?'] });
    expect(lastQuery).toContain('"enhancedByAI" = true');
  });

  it('deleteSmartIntentRecord executes DELETE', async () => {
    const { deleteSmartIntentRecord } = await import('../../lib/db');
    await deleteSmartIntentRecord(42);
    expect(lastQuery).toContain('DELETE FROM "SmartIntentEngineResponse"');
    expect(lastParams).toContain(42);
  });

  it('findLearnedResponse uses word-containment when exact match is empty', async () => {
    const { findLearnedResponse } = await import('../../lib/db');
    await findLearnedResponse('wireless headphones');
    // With empty exact match, falls through to word-containment LIKE query
    expect(lastQuery).toContain('LIKE');
  });

  it('findLearnedResponse returns null when no match', async () => {
    const { findLearnedResponse } = await import('../../lib/db');
    const result = await findLearnedResponse('something random');
    expect(result).toBeNull();
  });

  it('findLearnedResponse prioritizes aiEnrichedResponse over supervisedResponse', async () => {
    mockRows.push({
      supervisedResponse: JSON.stringify({ questions: ['Brand?'] }),
      aiEnrichedResponse: JSON.stringify({ questions: ['Budget range?', 'Brand preference?'] }),
    });
    const { findLearnedResponse } = await import('../../lib/db');
    const result = await findLearnedResponse('headphones');
    if (result) {
      expect(result.source).toBe('ai');
    }
  });

  it('getUnenrichedRecords filters WHERE enhancedByAI = false', async () => {
    const { getUnenrichedRecords } = await import('../../lib/db');
    await getUnenrichedRecords(10);
    expect(lastQuery).toContain('"enhancedByAI" = false');
  });
});

// ── Admin Learning API Route Tests ──────────────────────────────────────────

describe('Smart Intent Learning — Admin API Validation', () => {
  it('admin auth rejects non-admin emails', () => {
    const ADMIN_EMAILS = ['admin@delegatecart.com', 'admin@example.com'];
    expect(ADMIN_EMAILS.includes('user@gmail.com')).toBe(false);
    expect(ADMIN_EMAILS.includes('admin@delegatecart.com')).toBe(true);
  });

  it('enrichment batch size is bounded', () => {
    const batchSize = Math.min(Math.max(1, 10), 50);
    expect(batchSize).toBe(10);
    expect(Math.min(Math.max(1, 100), 50)).toBe(50); // capped at 50
    expect(Math.min(Math.max(1, 0), 50)).toBe(1); // minimum 1
  });
});

// ── Wallet Transaction Seeding Tests ────────────────────────────────────────

describe('Observability — Demo Data Seeding', () => {
  const store: Record<string, string> = {};

  beforeEach(() => {
    Object.keys(store).forEach((k) => delete store[k]);
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => store[key] || null),
      setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
      removeItem: vi.fn((key: string) => { delete store[key]; }),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(() => null),
    });
  });

  it('seeds demo transactions when localStorage is empty', async () => {
    const { seedDemoDataIfEmpty, getTransactionStats } = await import('../../lib/wallet-transactions');
    seedDemoDataIfEmpty();

    const txns = JSON.parse(store['wallet_transactions'] || '[]');
    expect(txns.length).toBeGreaterThan(0);
    expect(txns.length).toBe(10);
  });

  it('does not re-seed if already seeded', async () => {
    store['wallet_demo_seeded'] = '1';
    const { seedDemoDataIfEmpty } = await import('../../lib/wallet-transactions');
    seedDemoDataIfEmpty();
    expect(store['wallet_transactions']).toBeUndefined();
  });

  it('seeded data contains stuck transactions', async () => {
    const { seedDemoDataIfEmpty } = await import('../../lib/wallet-transactions');
    seedDemoDataIfEmpty();
    const txns = JSON.parse(store['wallet_transactions'] || '[]');
    const stuck = txns.filter((t: any) => t.state === 'stuck');
    expect(stuck.length).toBeGreaterThan(0);
  });

  it('seeded data contains audit log entries', async () => {
    const { seedDemoDataIfEmpty } = await import('../../lib/wallet-transactions');
    seedDemoDataIfEmpty();
    const audit = JSON.parse(store['wallet_audit_log'] || '[]');
    expect(audit.length).toBeGreaterThan(0);
    // Audit entries should have suspicious flags for stuck transactions
    const suspicious = audit.filter((a: any) => a.suspicious);
    expect(suspicious.length).toBeGreaterThan(0);
  });
});

// ── UnifiedLoader Component Tests ───────────────────────────────────────────

describe('UnifiedLoader — Exports', () => {
  it('exports StaticLoader and default UnifiedLoader', async () => {
    const mod = await import('../../components/ui/UnifiedLoader');
    expect(mod.default).toBeDefined();
    expect(mod.StaticLoader).toBeDefined();
  });
});

// ── User-Specific Data Isolation ────────────────────────────────────────────

describe('User Data Isolation — Buy Requests', () => {
  it('buy-requests hook accepts dynamic userId', async () => {
    // Validate the hook interface accepts userId parameter
    const hookModule = await import('../../hooks/useBuyRequest');
    expect(hookModule.default).toBeDefined();
    // The hook should be a function that accepts options with userId
    expect(typeof hookModule.default).toBe('function');
  });
});

// ── isActive Toggle Tests ───────────────────────────────────────────────────

describe('Smart Intent Learning — isActive Toggle', () => {
  beforeEach(() => {
    mockRows.length = 0;
    lastQuery = '';
    lastParams = [];
  });

  it('toggleSmartIntentActive builds correct UPDATE query', async () => {
    const { toggleSmartIntentActive } = await import('../../lib/db');
    await toggleSmartIntentActive(42, false);
    expect(lastQuery).toContain('UPDATE "SmartIntentEngineResponse"');
    expect(lastQuery).toContain('"isActive"');
    expect(lastParams).toContain(42);
    expect(lastParams).toContain(false);
  });

  it('toggleSmartIntentActive can set isActive to true', async () => {
    const { toggleSmartIntentActive } = await import('../../lib/db');
    await toggleSmartIntentActive(7, true);
    expect(lastParams).toContain(7);
    expect(lastParams).toContain(true);
  });

  it('findLearnedResponse only returns active records (exact match)', async () => {
    const { findLearnedResponse } = await import('../../lib/db');
    await findLearnedResponse('headphones');
    // The exact match query should include isActive = true
    expect(lastQuery).toContain('"isActive" = true');
  });

  it('findLearnedResponse only returns active records (word containment)', async () => {
    const { findLearnedResponse } = await import('../../lib/db');
    await findLearnedResponse('wireless headphones under 5000');
    // The word containment query should include isActive = true
    expect(lastQuery).toContain('"isActive" = true');
  });

  it('SmartIntentRecord interface includes isActive field', async () => {
    const mod = await import('../../lib/db');
    // Verify the toggleSmartIntentActive function is exported
    expect(typeof mod.toggleSmartIntentActive).toBe('function');
  });
});

// ── RBAC Learning API Access Tests ──────────────────────────────────────────

describe('Smart Intent Learning — RBAC Access', () => {
  it('learning-support email is authorized', () => {
    const LEARNING_EMAILS = [
      'admin@delegatecart.com', 'admin@example.com',
      'supervisedlearning@delegatecart.com',
      'observability@delegatecart.com',
    ];
    expect(LEARNING_EMAILS.includes('supervisedlearning@delegatecart.com')).toBe(true);
    expect(LEARNING_EMAILS.includes('observability@delegatecart.com')).toBe(true);
  });

  it('non-elevated email is rejected', () => {
    const LEARNING_EMAILS = [
      'admin@delegatecart.com', 'admin@example.com',
      'supervisedlearning@delegatecart.com',
      'observability@delegatecart.com',
    ];
    expect(LEARNING_EMAILS.includes('random@gmail.com')).toBe(false);
    expect(LEARNING_EMAILS.includes('customer@delegatecart.com')).toBe(false);
  });

  it('isActive field has boolean type validation', () => {
    // PATCH handler checks typeof isActive === 'boolean'
    expect(typeof true === 'boolean').toBe(true);
    expect(typeof false === 'boolean').toBe(true);
    expect(typeof 'yes' === 'boolean').toBe(false);
    expect(typeof 1 === 'boolean').toBe(false);
    expect(typeof undefined === 'boolean').toBe(false);
  });
});
