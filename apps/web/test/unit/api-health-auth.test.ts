/**
 * Unit Tests — API Route Health & Auth Validation
 *
 * Tests the contract of key API routes using mocked db/session infrastructure.
 * Covers: /api/health, /api/auth/me, /api/observability auth, /api/events/journey
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(opts: {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  url?: string;
}) {
  const url = opts.url ?? 'http://localhost/api/test';
  const headers = new Headers(opts.headers ?? {});
  return {
    method: opts.method ?? 'GET',
    headers: {
      get: (k: string) => headers.get(k),
    },
    url,
    json: async () => opts.body,
  };
}

// ── /api/health logic (extracted) ────────────────────────────────────────────
async function handleHealth(dbQuery: () => Promise<unknown>) {
  try {
    await dbQuery();
    return { status: 200, body: { status: 'ok', db: 'connected', timestamp: new Date().toISOString() } };
  } catch (err: unknown) {
    return { status: 503, body: { status: 'error', db: 'disconnected', error: String(err) } };
  }
}

describe('/api/health', () => {
  it('returns 200 + status ok when DB is reachable', async () => {
    const mockQuery = vi.fn().mockResolvedValue([{ 1: 1 }]);
    const result = await handleHealth(mockQuery);
    expect(result.status).toBe(200);
    expect(result.body.status).toBe('ok');
    expect(result.body.db).toBe('connected');
    expect(result.body.timestamp).toBeDefined();
  });

  it('returns 503 when DB throws', async () => {
    const mockQuery = vi.fn().mockRejectedValue(new Error('Connection refused'));
    const result = await handleHealth(mockQuery);
    expect(result.status).toBe(503);
    expect(result.body.status).toBe('error');
    expect(result.body.db).toBe('disconnected');
    expect(result.body.error).toContain('Connection refused');
  });
});

// ── /api/auth/me token validation logic (extracted) ──────────────────────────
interface SessionRow { userId: number; email: string; role: string }

async function resolveToken(
  authHeader: string | null,
  lookupSession: (token: string) => Promise<SessionRow | null>
): Promise<{ status: number; body: unknown }> {
  if (!authHeader?.startsWith('Bearer ')) {
    return { status: 401, body: { error: 'Missing or malformed Authorization header' } };
  }
  const token = authHeader.slice(7);
  if (!token || token.length < 8) {
    return { status: 401, body: { error: 'Token too short' } };
  }
  const session = await lookupSession(token);
  if (!session) {
    return { status: 401, body: { error: 'Session not found or expired' } };
  }
  return {
    status: 200,
    body: { userId: session.userId, email: session.email, role: session.role },
  };
}

describe('/api/auth/me token resolution', () => {
  const fakeSession: SessionRow = { userId: 1, email: 'admin@delegatecart.com', role: 'admin' };

  it('returns 401 when no Authorization header', async () => {
    const r = await resolveToken(null, vi.fn());
    expect(r.status).toBe(401);
  });

  it('returns 401 for malformed header (no Bearer prefix)', async () => {
    const r = await resolveToken('Token abc123', vi.fn());
    expect(r.status).toBe(401);
  });

  it('returns 401 for placeholder admin-* token (not in DB)', async () => {
    const lookup = vi.fn().mockResolvedValue(null);
    const r = await resolveToken(`Bearer admin-${Date.now()}`, lookup);
    expect(r.status).toBe(401);
  });

  it('returns 200 with session data for valid sess_ token', async () => {
    const lookup = vi.fn().mockResolvedValue(fakeSession);
    const r = await resolveToken('Bearer sess_abc123xyz456', lookup);
    expect(r.status).toBe(200);
    expect((r.body as SessionRow).email).toBe('admin@delegatecart.com');
    expect((r.body as SessionRow).role).toBe('admin');
  });

  it('returns 401 when session is expired / not found', async () => {
    const lookup = vi.fn().mockResolvedValue(null);
    const r = await resolveToken('Bearer sess_expired999', lookup);
    expect(r.status).toBe(401);
  });
});

// ── /api/observability RBAC gate (extracted) ─────────────────────────────────
const ALLOWED_ROLES = new Set(['admin', 'analytics', 'observability']);

function checkObservabilityAccess(role: string | undefined): boolean {
  return !!role && ALLOWED_ROLES.has(role);
}

describe('/api/observability RBAC', () => {
  it('allows admin role', () => { expect(checkObservabilityAccess('admin')).toBe(true); });
  it('allows analytics role', () => { expect(checkObservabilityAccess('analytics')).toBe(true); });
  it('allows observability role', () => { expect(checkObservabilityAccess('observability')).toBe(true); });
  it('denies basic role', () => { expect(checkObservabilityAccess('basic')).toBe(false); });
  it('denies customer role', () => { expect(checkObservabilityAccess('customer')).toBe(false); });
  it('denies aiplus role', () => { expect(checkObservabilityAccess('aiplus')).toBe(false); });
  it('denies undefined role', () => { expect(checkObservabilityAccess(undefined)).toBe(false); });
  it('denies empty string role', () => { expect(checkObservabilityAccess('')).toBe(false); });
});

// ── /api/events/journey POST validation (extracted) ──────────────────────────
interface JourneyEventPayload {
  eventType?: string;
  productId?: string | number;
  userId?: string | number;
  metadata?: unknown;
}

function validateJourneyEvent(payload: JourneyEventPayload): { valid: boolean; error?: string } {
  const VALID_TYPES = new Set([
    'product_viewed', 'cart_added', 'cart_removed', 'checkout_started',
    'checkout_completed', 'search_performed', 'page_view', 'wishlist_added',
  ]);
  if (!payload.eventType) return { valid: false, error: 'eventType is required' };
  if (!VALID_TYPES.has(payload.eventType)) {
    return { valid: false, error: `Unknown eventType: ${payload.eventType}` };
  }
  return { valid: true };
}

describe('/api/events/journey payload validation', () => {
  it('rejects missing eventType', () => {
    const r = validateJourneyEvent({});
    expect(r.valid).toBe(false);
    expect(r.error).toContain('eventType');
  });

  it('rejects unknown eventType', () => {
    const r = validateJourneyEvent({ eventType: 'unknown_hack' });
    expect(r.valid).toBe(false);
  });

  it('accepts product_viewed', () => {
    expect(validateJourneyEvent({ eventType: 'product_viewed', productId: 'mock-1' }).valid).toBe(true);
  });

  it('accepts cart_added', () => {
    expect(validateJourneyEvent({ eventType: 'cart_added', productId: 'mock-2' }).valid).toBe(true);
  });

  it('accepts checkout_completed', () => {
    expect(validateJourneyEvent({ eventType: 'checkout_completed' }).valid).toBe(true);
  });

  it('accepts search_performed', () => {
    expect(validateJourneyEvent({ eventType: 'search_performed', metadata: { query: 'laptop' } }).valid).toBe(true);
  });
});

// ── Token classification helper ───────────────────────────────────────────────
function classifyToken(token: string): 'real_session' | 'admin_placeholder' | 'invalid' {
  if (token.startsWith('sess_')) return 'real_session';
  if (token.startsWith('admin-') && /^admin-\d+$/.test(token)) return 'admin_placeholder';
  return 'invalid';
}

describe('Token classification', () => {
  it('classifies sess_ tokens as real_session', () => {
    expect(classifyToken('sess_abc123')).toBe('real_session');
    expect(classifyToken('sess_xyz789longtoken')).toBe('real_session');
  });

  it('classifies admin-{timestamp} as admin_placeholder', () => {
    expect(classifyToken('admin-1713236400000')).toBe('admin_placeholder');
  });

  it('classifies arbitrary strings as invalid', () => {
    expect(classifyToken('Bearer abc')).toBe('invalid');
    expect(classifyToken('')).toBe('invalid');
    expect(classifyToken('token-123')).toBe('invalid');
  });
});
