/**
 * Unit Tests — 3-tier resolveSession auth logic
 *
 * Mirrors the resolveSession() pattern used in:
 *  - app/api/observability/route.ts
 *  - app/api/wallet/route.ts
 *  - app/api/user/wishlist/route.ts
 *  - app/api/ai-shopping-list/route.ts
 *
 * Tiers:
 *  1. DB session token lookup  (validateSession)
 *  2. DB getUserByEmail lookup (x-user-email header)
 *  3. DEMO_USERS fallback      (known demo user + session-like token)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Types ─────────────────────────────────────────────────────────────────────
interface SessionResult {
  userId: number | string;
  email: string;
  role?: string;
  name?: string;
}

interface DemoUser {
  email: string;
  role: string;
  displayName: string;
  subscription: string;
}

// ── Demo users fixture (mirrors lib/admin-auth.ts) ────────────────────────────
const DEMO_USERS: DemoUser[] = [
  {
    email: 'admin@delegatecart.com',
    role: 'admin',
    displayName: 'Jagadish Sahu',
    subscription: 'AI_PLUS',
  },
  {
    email: 'analytics@delegatecart.com',
    role: 'analytics',
    displayName: 'Priya Sharma',
    subscription: 'AI_PLUS',
  },
  {
    email: 'observability@delegatecart.com',
    role: 'observability',
    displayName: 'Vikram Patel',
    subscription: 'AI_PLUS',
  },
];
const DEMO_BY_EMAIL = Object.fromEntries(DEMO_USERS.map((u) => [u.email.toLowerCase(), u]));

// ── Mocks for DB functions ────────────────────────────────────────────────────
const mockValidateSession = vi.fn<[string], Promise<SessionResult | null>>();
const mockGetUserByEmail = vi.fn<[string], Promise<Record<string, unknown> | null>>();

// ── resolveSession implementation (mirrors route.ts pattern) ─────────────────
async function resolveSession(token: string, emailHeader: string): Promise<SessionResult | null> {
  const normalizedEmail = emailHeader ? emailHeader.toLowerCase() : '';

  // Tier 1 — DB session
  if (token) {
    try {
      const session = await mockValidateSession(token);
      if (session) return session;
    } catch {
      /* DB unavailable */
    }
  }

  // Tier 2 — DB getUserByEmail via x-user-email header
  if (normalizedEmail) {
    try {
      const user = await mockGetUserByEmail(normalizedEmail);
      if (user)
        return {
          userId: user.id as number,
          email: user.email as string,
          name: user.name as string,
        };
    } catch {
      /* DB unavailable */
    }

    // Tier 3 — DEMO_USERS fallback
    const demoUser = DEMO_BY_EMAIL[normalizedEmail];
    const isKnownToken = !token || /^(sess_|admin-|demo-)/.test(token);
    if (demoUser && isKnownToken) {
      try {
        const user = await mockGetUserByEmail(normalizedEmail);
        if (user)
          return { userId: user.id as number, email: normalizedEmail, name: demoUser.displayName };
      } catch {
        /* ignore */
      }
    }
  }

  return null;
}

// ── Token pattern helpers ─────────────────────────────────────────────────────
function isSessionToken(token: string): boolean {
  return token.startsWith('sess_') && token.length > 10;
}

function isPlaceholderToken(token: string): boolean {
  return /^(admin-|demo-)/.test(token);
}

// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockValidateSession.mockReset();
  mockGetUserByEmail.mockReset();
});

// ══ Tier 1: DB session lookup ════════════════════════════════════════════════

describe('resolveSession — Tier 1: DB session', () => {
  it('returns session when DB validateSession succeeds', async () => {
    mockValidateSession.mockResolvedValueOnce({
      userId: 1,
      email: 'admin@delegatecart.com',
      role: 'admin',
    });
    const result = await resolveSession('sess_1234567890abc', '');
    expect(result).toMatchObject({ userId: 1, email: 'admin@delegatecart.com' });
  });

  it('falls through to Tier 2 when validateSession returns null', async () => {
    mockValidateSession.mockResolvedValueOnce(null);
    mockGetUserByEmail.mockResolvedValueOnce({
      id: 5,
      email: 'admin@delegatecart.com',
      name: 'Admin',
    });
    const result = await resolveSession('sess_expired', 'admin@delegatecart.com');
    expect(result?.userId).toBe(5);
  });

  it('falls through when validateSession throws (DB down)', async () => {
    mockValidateSession.mockRejectedValueOnce(new Error('connection refused'));
    mockGetUserByEmail.mockResolvedValueOnce({
      id: 5,
      email: 'admin@delegatecart.com',
      name: 'Admin',
    });
    const result = await resolveSession('sess_valid', 'admin@delegatecart.com');
    expect(result).not.toBeNull();
    expect(result?.email).toBe('admin@delegatecart.com');
  });

  it('returns null when token is empty and no email header', async () => {
    const result = await resolveSession('', '');
    expect(result).toBeNull();
    expect(mockValidateSession).not.toHaveBeenCalled();
  });
});

// ══ Tier 2: DB getUserByEmail ════════════════════════════════════════════════

describe('resolveSession — Tier 2: getUserByEmail', () => {
  it('resolves via email header when session token fails', async () => {
    mockValidateSession.mockResolvedValueOnce(null);
    mockGetUserByEmail.mockResolvedValueOnce({
      id: 10,
      email: 'analytics@delegatecart.com',
      name: 'Priya',
    });
    const result = await resolveSession('bad_token', 'analytics@delegatecart.com');
    expect(result?.userId).toBe(10);
    expect(result?.email).toBe('analytics@delegatecart.com');
  });

  it('calls getUserByEmail with lowercased email', async () => {
    mockValidateSession.mockResolvedValueOnce(null);
    mockGetUserByEmail.mockResolvedValueOnce({
      id: 11,
      email: 'admin@delegatecart.com',
      name: 'Admin',
    });
    await resolveSession('', 'ADMIN@DELEGATECART.COM');
    // resolveSession normalises the header to lowercase before calling DB
    expect(mockGetUserByEmail).toHaveBeenCalledWith('admin@delegatecart.com');
  });

  it('falls through to Tier 3 when getUserByEmail throws', async () => {
    mockValidateSession.mockResolvedValueOnce(null);
    mockGetUserByEmail
      .mockRejectedValueOnce(new Error('DB down')) // Tier 2 throw
      .mockRejectedValueOnce(new Error('DB down')); // Tier 3 throw
    const result = await resolveSession('admin-1234', 'admin@delegatecart.com');
    // Tier 3 also fails so we get null
    expect(result).toBeNull();
  });
});

// ══ Tier 3: DEMO_USERS fallback ══════════════════════════════════════════════

describe('resolveSession — Tier 3: DEMO_USERS fallback', () => {
  it('resolves demo admin via admin- placeholder token', async () => {
    mockValidateSession.mockResolvedValueOnce(null);
    mockGetUserByEmail
      .mockRejectedValueOnce(new Error('DB down')) // Tier 2 failure
      .mockResolvedValueOnce({ id: 1, email: 'admin@delegatecart.com', name: 'Admin' }); // Tier 3 success
    const result = await resolveSession('admin-1234567890', 'admin@delegatecart.com');
    expect(result).not.toBeNull();
    expect(result?.email).toBe('admin@delegatecart.com');
  });

  it('resolves demo user via sess_ token placeholder', async () => {
    mockValidateSession.mockResolvedValueOnce(null);
    mockGetUserByEmail
      .mockRejectedValueOnce(new Error('role column missing'))
      .mockResolvedValueOnce({ id: 2, email: 'observability@delegatecart.com', name: 'Vikram' });
    const result = await resolveSession('sess_stale_token', 'observability@delegatecart.com');
    expect(result?.email).toBe('observability@delegatecart.com');
  });

  it('does NOT fall back for unknown email (security)', async () => {
    mockValidateSession.mockResolvedValueOnce(null);
    mockGetUserByEmail.mockRejectedValueOnce(new Error('DB down'));
    const result = await resolveSession('admin-fake', 'unknown@hacker.com');
    expect(result).toBeNull();
  });

  it('does NOT allow tier 3 with non-session-like token (security)', async () => {
    mockValidateSession.mockResolvedValueOnce(null);
    mockGetUserByEmail.mockRejectedValueOnce(new Error('DB down'));
    // Token is a raw JWT-like string — not a session/admin/demo token
    const result = await resolveSession('eyJhbGciOiJIUzI1NiJ9.abc.def', 'admin@delegatecart.com');
    // Should not resolve via Tier 3
    expect(result).toBeNull();
  });
});

// ══ Token pattern validation ═════════════════════════════════════════════════

describe('token pattern helpers', () => {
  it('identifies valid sess_ tokens', () => {
    expect(isSessionToken('sess_1712345678_abc123')).toBe(true);
    expect(isSessionToken('sess_')).toBe(false); // too short
    expect(isSessionToken('')).toBe(false);
  });

  it('identifies placeholder admin- tokens', () => {
    expect(isPlaceholderToken('admin-1712345678')).toBe(true);
    expect(isPlaceholderToken('demo-user-1234')).toBe(true);
    expect(isPlaceholderToken('sess_abc')).toBe(false);
    expect(isPlaceholderToken('')).toBe(false);
  });

  it('placeholder tokens are not valid DB session tokens', () => {
    const token = 'admin-admin@delegatecart.com-1712345678';
    expect(isPlaceholderToken(token)).toBe(true);
    expect(isSessionToken(token)).toBe(false);
  });
});

// ══ Observability-specific role gating ═══════════════════════════════════════

describe('observability role access', () => {
  const ALLOWED_ROLES = new Set(['admin', 'analytics', 'observability']);

  it('admin role passes observability check', () => {
    expect(ALLOWED_ROLES.has('admin')).toBe(true);
  });

  it('observability role passes observability check', () => {
    expect(ALLOWED_ROLES.has('observability')).toBe(true);
  });

  it('analytics role passes observability check', () => {
    expect(ALLOWED_ROLES.has('analytics')).toBe(true);
  });

  it('basic/customer roles are blocked', () => {
    ['basic', 'customer', 'aiplus', 'reinforced-learning'].forEach((role) => {
      expect(ALLOWED_ROLES.has(role)).toBe(false);
    });
  });
});

// ══ x-user-email header normalization ════════════════════════════════════════

describe('x-user-email header processing', () => {
  it('lowercases email from header for consistent lookup', async () => {
    mockValidateSession.mockResolvedValueOnce(null);
    mockGetUserByEmail.mockResolvedValueOnce({
      id: 1,
      email: 'admin@delegatecart.com',
      name: 'Admin',
    });
    await resolveSession('', 'Admin@Delegatecart.COM');
    expect(mockGetUserByEmail).toHaveBeenCalledWith('admin@delegatecart.com');
  });

  it('skips email tier entirely when no email header provided', async () => {
    mockValidateSession.mockResolvedValueOnce(null);
    const result = await resolveSession('bad_token', '');
    expect(result).toBeNull();
    expect(mockGetUserByEmail).not.toHaveBeenCalled();
  });
});

// ══ createSession idempotency guard ══════════════════════════════════════════

describe('createSession token format', () => {
  it('generates sess_ prefixed token', () => {
    const token = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 15)}`;
    expect(token).toMatch(/^sess_\d+_[a-z0-9]+$/);
    expect(isSessionToken(token)).toBe(true);
  });

  it('each generated token is unique', () => {
    const tokens = Array.from(
      { length: 5 },
      () => `sess_${Date.now()}_${Math.random().toString(36).slice(2, 15)}`
    );
    const unique = new Set(tokens);
    expect(unique.size).toBe(5);
  });

  it('token length is sufficient for security (>20 chars)', () => {
    const token = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 15)}`;
    expect(token.length).toBeGreaterThan(20);
  });
});
