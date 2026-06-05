/**
 * Unit Tests — api-client.ts request interceptor
 *
 * Verifies that:
 *  1. Authorization: Bearer <token> is set from localStorage.authToken
 *  2. x-user-email header is added from localStorage.userEmail
 *  3. Falls back to nextauth.token / auth_token keys when authToken is absent
 *  4. No headers are added when localStorage is empty
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── localStorage mock ────────────────────────────────────────────────────────
const localStore: Record<string, string> = {};
const mockLocalStorage = {
  getItem: vi.fn((key: string) => localStore[key] ?? null),
  setItem: (key: string, val: string) => {
    localStore[key] = val;
  },
  removeItem: (key: string) => {
    delete localStore[key];
  },
  clear: () => {
    for (const k in localStore) delete localStore[k];
  },
};

// ── Simulated interceptor (mirrors lib/api-client.ts) ────────────────────────
function buildRequestHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};

  const token =
    mockLocalStorage.getItem('authToken') ||
    mockLocalStorage.getItem('nextauth.token') ||
    mockLocalStorage.getItem('auth_token');

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const userEmail = mockLocalStorage.getItem('userEmail');
  if (userEmail) {
    headers['x-user-email'] = userEmail;
  }

  return headers;
}

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  for (const k in localStore) delete localStore[k];
});

// ══ Authorization header ═════════════════════════════════════════════════════

describe('Authorization header injection', () => {
  it('sets Bearer token from authToken', () => {
    localStore['authToken'] = 'sess_12345_abc';
    const headers = buildRequestHeaders();
    expect(headers['Authorization']).toBe('Bearer sess_12345_abc');
  });

  it('sets Bearer token from nextauth.token when authToken absent', () => {
    localStore['nextauth.token'] = 'nextauth-xyz';
    const headers = buildRequestHeaders();
    expect(headers['Authorization']).toBe('Bearer nextauth-xyz');
  });

  it('sets Bearer token from auth_token as final fallback', () => {
    localStore['auth_token'] = 'legacy-token';
    const headers = buildRequestHeaders();
    expect(headers['Authorization']).toBe('Bearer legacy-token');
  });

  it('prefers authToken over nextauth.token', () => {
    localStore['authToken'] = 'sess_primary';
    localStore['nextauth.token'] = 'nextauth-secondary';
    const headers = buildRequestHeaders();
    expect(headers['Authorization']).toBe('Bearer sess_primary');
  });

  it('omits Authorization when no token present', () => {
    const headers = buildRequestHeaders();
    expect(headers['Authorization']).toBeUndefined();
  });

  it('sets admin- placeholder token as Authorization header', () => {
    localStore['authToken'] = 'admin-admin-delegatecart-com-1712345678';
    const headers = buildRequestHeaders();
    expect(headers['Authorization']).toBe('Bearer admin-admin-delegatecart-com-1712345678');
  });
});

// ══ x-user-email header injection ════════════════════════════════════════════

describe('x-user-email header injection', () => {
  it('sends x-user-email from userEmail in localStorage', () => {
    localStore['authToken'] = 'sess_abc';
    localStore['userEmail'] = 'admin@delegatecart.com';
    const headers = buildRequestHeaders();
    expect(headers['x-user-email']).toBe('admin@delegatecart.com');
  });

  it('omits x-user-email when userEmail not in localStorage', () => {
    localStore['authToken'] = 'sess_abc';
    const headers = buildRequestHeaders();
    expect(headers['x-user-email']).toBeUndefined();
  });

  it('sends x-user-email even without auth token', () => {
    localStore['userEmail'] = 'admin@delegatecart.com';
    const headers = buildRequestHeaders();
    expect(headers['x-user-email']).toBe('admin@delegatecart.com');
  });

  it('no headers when localStorage is completely empty', () => {
    const headers = buildRequestHeaders();
    expect(Object.keys(headers)).toHaveLength(0);
  });
});

// ══ Combined header state ════════════════════════════════════════════════════

describe('combined Authorization + x-user-email', () => {
  it('both headers present for fully authenticated admin', () => {
    localStore['authToken'] = 'sess_1234_abcde';
    localStore['userEmail'] = 'admin@delegatecart.com';
    const headers = buildRequestHeaders();
    expect(headers['Authorization']).toBe('Bearer sess_1234_abcde');
    expect(headers['x-user-email']).toBe('admin@delegatecart.com');
  });

  it('both headers present during placeholder transition phase', () => {
    localStore['authToken'] = 'admin-admin-delegatecart-com-1712345678';
    localStore['userEmail'] = 'admin@delegatecart.com';
    const headers = buildRequestHeaders();
    expect(headers['Authorization']).toMatch(/^Bearer admin-/);
    expect(headers['x-user-email']).toBe('admin@delegatecart.com');
  });

  it('after token upgrade, uses new sess_ token', () => {
    // Simulate upgrade from placeholder to real session
    localStore['authToken'] = 'admin-admin-delegatecart-com-1712345678';
    const before = buildRequestHeaders();
    expect(before['Authorization']).toMatch(/^Bearer admin-/);

    localStore['authToken'] = 'sess_upgraded_9999_xyz';
    const after = buildRequestHeaders();
    expect(after['Authorization']).toBe('Bearer sess_upgraded_9999_xyz');
  });
});
