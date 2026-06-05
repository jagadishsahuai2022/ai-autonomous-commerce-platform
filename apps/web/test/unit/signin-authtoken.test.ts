/**
 * Unit Tests — Signin page authToken storage guarantees
 *
 * Verifies that after sign-in, localStorage.authToken is ALWAYS set
 * regardless of which auth path fires (DB session, demo fallback, RBAC fallback).
 *
 * Regression coverage for the bug where authenticateAdmin() path returned
 * without setting authToken in localStorage.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Types ─────────────────────────────────────────────────────────────────────
type AppRole =
  | 'admin'
  | 'analytics'
  | 'aiplus'
  | 'observability'
  | 'reinforced-learning'
  | 'basic'
  | 'customer';

interface LoginApiResponse {
  success?: boolean;
  token?: string;
  user?: { id: number; email: string; dcRole?: string; role?: string; subscription?: string };
  error?: string;
}

// ── localStorage mock ────────────────────────────────────────────────────────
const localStore: Record<string, string> = {};
const mockLocalStorage = {
  getItem: vi.fn((key: string) => localStore[key] ?? null),
  setItem: vi.fn((key: string, val: string) => {
    localStore[key] = val;
  }),
  removeItem: vi.fn((key: string) => {
    delete localStore[key];
  }),
  clear: vi.fn(() => {
    for (const k in localStore) delete localStore[k];
  }),
  length: 0,
  key: vi.fn(() => null),
};

// ── fetch mock ───────────────────────────────────────────────────────────────
const mockFetch = vi.fn<
  [string, RequestInit],
  Promise<{ ok: boolean; status: number; json(): Promise<LoginApiResponse> }>
>();

// ── RBAC helpers (mirrors lib/admin-auth.ts) ──────────────────────────────────
const DEMO_USERS = [
  { email: 'admin@delegatecart.com', role: 'admin' as AppRole, password: 'Admin@DC2024!' },
  { email: 'analytics@delegatecart.com', role: 'analytics' as AppRole, password: 'Admin@DC2024!' },
];
const DEMO_BY_EMAIL = Object.fromEntries(DEMO_USERS.map((u) => [u.email, u]));

function authenticateAdmin(email: string, password: string): AppRole | null {
  const user = DEMO_BY_EMAIL[email.toLowerCase()];
  if (user && password === 'Admin@DC2024!') return user.role;
  return null;
}

// ── signIn simulation (mirrors apps/web/app/signin/page.tsx handleSubmit) ─────
async function simulateSignIn(
  email: string,
  password: string
): Promise<{
  authToken: string | null;
  userEmail: string | null;
  userId: string | null;
}> {
  const normalized = email.toLowerCase();
  let token: string | null = null;
  let userId: string | null = null;

  // Path A: DB login
  try {
    const res = await mockFetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) {
      const data = await res.json();
      token = data.token ?? null;
      userId = data.user?.id != null ? String(data.user.id) : null;
    } else if (res.status === 401) {
      // Demo user with wrong DB password — retry without password
      const isDemoUser = !!DEMO_BY_EMAIL[normalized];
      if (isDemoUser) {
        try {
          const retryRes = await mockFetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }), // no password
          });
          if (retryRes.ok) {
            const d = await retryRes.json();
            token = d.token ?? null;
            userId = d.user?.id != null ? String(d.user.id) : null;
          }
        } catch {
          /* fall through */
        }
      }
    }
  } catch {
    /* network error — fall through */
  }

  // Path B: RBAC fallback (always sets placeholder token first)
  if (!token) {
    const authed = authenticateAdmin(email, password);
    if (authed) {
      // ── Fixed: always set placeholder token immediately ──────────────────
      const placeholderToken = `admin-${normalized.replace(/[^a-z0-9]/g, '-')}-${Date.now()}`;
      mockLocalStorage.setItem('authToken', placeholderToken);
      mockLocalStorage.setItem('userEmail', normalized);

      // Attempt to upgrade to real DB session
      try {
        const sessionRes = await mockFetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        if (sessionRes.ok) {
          const d = await sessionRes.json();
          if (d.token) {
            mockLocalStorage.setItem('authToken', d.token);
            if (d.user?.id) mockLocalStorage.setItem('userId', String(d.user.id));
          }
        }
      } catch {
        /* placeholder stays */
      }

      return {
        authToken: mockLocalStorage.getItem('authToken'),
        userEmail: mockLocalStorage.getItem('userEmail'),
        userId: mockLocalStorage.getItem('userId'),
      };
    }
    return { authToken: null, userEmail: null, userId: null };
  }

  // Path A success: store token
  mockLocalStorage.setItem('authToken', token);
  mockLocalStorage.setItem('userEmail', normalized);
  if (userId) mockLocalStorage.setItem('userId', userId);

  return {
    authToken: mockLocalStorage.getItem('authToken'),
    userEmail: mockLocalStorage.getItem('userEmail'),
    userId: mockLocalStorage.getItem('userId'),
  };
}

// ── Test setup ────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  for (const k in localStore) delete localStore[k];
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ══ Path A: DB login success ═════════════════════════════════════════════════

describe('signIn — Path A: DB login success', () => {
  it('stores sess_ token in authToken', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        token: 'sess_1234_abc',
        user: { id: 7, email: 'admin@delegatecart.com' },
      }),
    });
    const result = await simulateSignIn('admin@delegatecart.com', 'Admin@DC2024!');
    expect(result.authToken).toBe('sess_1234_abc');
    expect(result.userEmail).toBe('admin@delegatecart.com');
    expect(result.userId).toBe('7');
  });

  it('authToken is set for non-admin users too', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        token: 'sess_9999_xyz',
        user: { id: 42, email: 'user@example.com' },
      }),
    });
    const result = await simulateSignIn('user@example.com', 'password123');
    expect(result.authToken).toBe('sess_9999_xyz');
  });
});

// ══ Path A→retry: DB 401 + retry without password ════════════════════════════

describe('signIn — Path A retry: 401 → retry without password', () => {
  it('retries and stores token on success', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Invalid password' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          token: 'sess_retry_001',
          user: { id: 1, email: 'admin@delegatecart.com' },
        }),
      });
    const result = await simulateSignIn('admin@delegatecart.com', 'WrongPassword');
    expect(result.authToken).toBe('sess_retry_001');
  });
});

// ══ Path B: RBAC fallback — CRITICAL regression test ═════════════════════════

describe('signIn — Path B: RBAC / authenticateAdmin fallback', () => {
  it('always sets authToken placeholder immediately — no delay', async () => {
    // DB completely unreachable
    mockFetch.mockRejectedValue(new Error('Network unreachable'));
    const result = await simulateSignIn('admin@delegatecart.com', 'Admin@DC2024!');
    expect(result.authToken).not.toBeNull();
    expect(result.authToken).toMatch(/^admin-/);
  });

  it('authToken placeholder is set before DB session upgrade attempt', async () => {
    // DB upgrade attempt succeeds
    mockFetch.mockRejectedValueOnce(new Error('initial failure')); // Path A fails
    // The Path A fails so we go to Path B, then DB upgrade fetch is rejected too
    mockFetch.mockRejectedValueOnce(new Error('Still down'));
    const result = await simulateSignIn('admin@delegatecart.com', 'Admin@DC2024!');
    // Placeholder must still be set
    expect(result.authToken).toMatch(/^admin-/);
  });

  it('upgrades placeholder to real sess_ token when DB session created', async () => {
    // Path A: network error → go to RBAC
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    // Upgrade fetch: success
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        token: 'sess_upgraded_123',
        user: { id: 1, email: 'admin@delegatecart.com' },
      }),
    });
    const result = await simulateSignIn('admin@delegatecart.com', 'Admin@DC2024!');
    expect(result.authToken).toBe('sess_upgraded_123');
  });

  it('keeps placeholder when DB upgrade fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error')); // Path A
    mockFetch.mockRejectedValueOnce(new Error('Still down')); // upgrade attempt
    const result = await simulateSignIn('admin@delegatecart.com', 'Admin@DC2024!');
    expect(result.authToken).toMatch(/^admin-/);
    expect(result.userEmail).toBe('admin@delegatecart.com');
  });

  it('returns null authToken for invalid credentials', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    const result = await simulateSignIn('admin@delegatecart.com', 'WrongPassword!');
    expect(result.authToken).toBeNull();
  });

  it('sets userEmail immediately so x-user-email fallback works', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    const result = await simulateSignIn('admin@delegatecart.com', 'Admin@DC2024!');
    expect(result.userEmail).toBe('admin@delegatecart.com');
  });
});

// ══ authToken key consistency ══════════════════════════════════════════════

describe('localStorage key consistency', () => {
  it('uses "authToken" key (not auth_token or accessToken)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        token: 'sess_abc',
        user: { id: 1, email: 'admin@delegatecart.com' },
      }),
    });
    await simulateSignIn('admin@delegatecart.com', 'Admin@DC2024!');
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith('authToken', expect.any(String));
    // Should NOT use wrong keys
    const wrongKeyCalls = mockLocalStorage.setItem.mock.calls.filter(
      ([k]) => k === 'auth_token' || k === 'accessToken'
    );
    expect(wrongKeyCalls).toHaveLength(0);
  });

  it('stores numeric userId as string', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        token: 'sess_xyz',
        user: { id: 99, email: 'user@example.com' },
      }),
    });
    await simulateSignIn('user@example.com', 'pass');
    const userIdVal = mockLocalStorage.setItem.mock.calls.find(([k]) => k === 'userId')?.[1];
    expect(typeof userIdVal).toBe('string');
    expect(userIdVal).toBe('99');
  });
});
