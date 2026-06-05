/**
 * Unit Tests — User Session & RBAC Logic
 * Covers: role-based feature gating, subscription tier access,
 *         session expiry, token validation, route guard logic.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Types ─────────────────────────────────────────────────────────────────────
type Role = 'admin' | 'analytics' | 'premium' | 'basic' | 'guest';
type Subscription = 'AI_PLUS' | 'PREMIUM' | 'BASIC' | 'FREE';

interface UserSession {
  email: string;
  role: Role;
  subscription: Subscription;
  token: string;
  expiresAt: number; // timestamp ms
}

// ── RBAC logic (mirrors apps/web lib/admin-auth + RBAC middleware) ────────────

const FEATURE_ACCESS: Record<string, (Role | Subscription)[]> = {
  observability_dashboard: ['admin', 'analytics'],
  ai_shopping_assistant:   ['AI_PLUS', 'PREMIUM', 'admin'],
  auto_checkout:           ['AI_PLUS', 'admin'],
  wishlist_scoring:        ['AI_PLUS', 'PREMIUM', 'admin'],
  advanced_filters:        ['AI_PLUS', 'PREMIUM', 'BASIC', 'admin', 'analytics'],
  admin_panel:             ['admin'],
  user_management:         ['admin'],
  analytics_view:          ['admin', 'analytics'],
  smart_intent:            ['AI_PLUS', 'admin'],
};

function hasFeatureAccess(session: UserSession | null, feature: string): boolean {
  if (!session) return false;
  if (isSessionExpired(session)) return false;
  const allowed = FEATURE_ACCESS[feature] ?? [];
  return allowed.includes(session.role) || allowed.includes(session.subscription);
}

function isSessionExpired(session: UserSession): boolean {
  return Date.now() > session.expiresAt;
}

function isValidToken(token: string): boolean {
  if (!token) return false;
  // sess_ tokens are valid, admin- placeholder tokens are not
  if (token.startsWith('admin-')) return false;
  if (token.startsWith('sess_') && token.length > 10) return true;
  // fallback: any token with reasonable length
  return token.length >= 16;
}

function getAccessibleRoutes(session: UserSession | null): string[] {
  if (!session || isSessionExpired(session)) return ['/account', '/products', '/'];

  const base = ['/', '/products', '/account', '/cart', '/orders', '/shopping-list'];

  if (session.role === 'admin') {
    return [...base, '/admin/dashboard', '/admin/users', '/admin/products', '/admin/observability', '/ai-assistant'];
  }
  if (session.role === 'analytics') {
    return [...base, '/admin/observability'];
  }

  const extras: string[] = [];
  if (['AI_PLUS', 'PREMIUM'].includes(session.subscription)) {
    extras.push('/ai-assistant', '/wallet');
  }
  if (session.subscription === 'AI_PLUS') {
    extras.push('/auto-checkout');
  }

  return [...base, ...extras];
}

function parseSessionFromStorage(storage: Record<string, string>): UserSession | null {
  const token = storage['authToken'];
  const email = storage['userEmail'];
  const role = storage['dc-user-role'] as Role;
  const subscription = storage['dc-user-subscription'] as Subscription;

  if (!token || !email) return null;

  return {
    email,
    role: role || 'basic',
    subscription: subscription || 'BASIC',
    token,
    expiresAt: Date.now() + 3600_000, // 1h default
  };
}

// ── Mock sessions ─────────────────────────────────────────────────────────────
const makeSession = (overrides: Partial<UserSession> = {}): UserSession => ({
  email: 'test@delegatecart.com',
  role: 'basic',
  subscription: 'BASIC',
  token: 'sess_abc123xyz456789',
  expiresAt: Date.now() + 3_600_000,
  ...overrides,
});

const ADMIN_SESSION = makeSession({ role: 'admin', subscription: 'AI_PLUS', email: 'admin@delegatecart.com' });
const AI_PLUS_SESSION = makeSession({ role: 'premium', subscription: 'AI_PLUS', email: 'aiplus@delegatecart.com' });
const BASIC_SESSION = makeSession({ role: 'basic', subscription: 'BASIC' });
const EXPIRED_SESSION = makeSession({ expiresAt: Date.now() - 1000 });
const ANALYTICS_SESSION = makeSession({ role: 'analytics', subscription: 'BASIC' });

// ════════════════════════════════════════════════════════════════════════════
// FEATURE ACCESS
// ════════════════════════════════════════════════════════════════════════════
describe('hasFeatureAccess — admin', () => {
  it('admin can access observability dashboard', () => {
    expect(hasFeatureAccess(ADMIN_SESSION, 'observability_dashboard')).toBe(true);
  });

  it('admin can access admin panel', () => {
    expect(hasFeatureAccess(ADMIN_SESSION, 'admin_panel')).toBe(true);
  });

  it('admin can access all features', () => {
    Object.keys(FEATURE_ACCESS).forEach(feature => {
      expect(hasFeatureAccess(ADMIN_SESSION, feature)).toBe(true);
    });
  });
});

describe('hasFeatureAccess — AI+ user', () => {
  it('AI+ user can access ai_shopping_assistant', () => {
    expect(hasFeatureAccess(AI_PLUS_SESSION, 'ai_shopping_assistant')).toBe(true);
  });

  it('AI+ user can access auto_checkout', () => {
    expect(hasFeatureAccess(AI_PLUS_SESSION, 'auto_checkout')).toBe(true);
  });

  it('AI+ user cannot access admin_panel', () => {
    expect(hasFeatureAccess(AI_PLUS_SESSION, 'admin_panel')).toBe(false);
  });

  it('AI+ user cannot access user_management', () => {
    expect(hasFeatureAccess(AI_PLUS_SESSION, 'user_management')).toBe(false);
  });
});

describe('hasFeatureAccess — basic user', () => {
  it('basic user can access advanced_filters', () => {
    expect(hasFeatureAccess(BASIC_SESSION, 'advanced_filters')).toBe(true);
  });

  it('basic user cannot access auto_checkout', () => {
    expect(hasFeatureAccess(BASIC_SESSION, 'auto_checkout')).toBe(false);
  });

  it('basic user cannot access ai_shopping_assistant', () => {
    expect(hasFeatureAccess(BASIC_SESSION, 'ai_shopping_assistant')).toBe(false);
  });

  it('basic user cannot access observability', () => {
    expect(hasFeatureAccess(BASIC_SESSION, 'observability_dashboard')).toBe(false);
  });
});

describe('hasFeatureAccess — analytics role', () => {
  it('analytics can access observability_dashboard', () => {
    expect(hasFeatureAccess(ANALYTICS_SESSION, 'observability_dashboard')).toBe(true);
  });

  it('analytics can access analytics_view', () => {
    expect(hasFeatureAccess(ANALYTICS_SESSION, 'analytics_view')).toBe(true);
  });

  it('analytics cannot access admin_panel', () => {
    expect(hasFeatureAccess(ANALYTICS_SESSION, 'admin_panel')).toBe(false);
  });
});

describe('hasFeatureAccess — expired session', () => {
  it('expired session has no feature access', () => {
    expect(hasFeatureAccess(EXPIRED_SESSION, 'advanced_filters')).toBe(false);
  });

  it('null session has no feature access', () => {
    expect(hasFeatureAccess(null, 'advanced_filters')).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// TOKEN VALIDATION
// ════════════════════════════════════════════════════════════════════════════
describe('isValidToken', () => {
  it('accepts sess_ tokens', () => {
    expect(isValidToken('sess_abc123xyz456789012')).toBe(true);
  });

  it('rejects admin- placeholder tokens', () => {
    expect(isValidToken('admin-1713200000000')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidToken('')).toBe(false);
  });

  it('rejects short tokens', () => {
    expect(isValidToken('abc')).toBe(false);
  });

  it('accepts other long tokens', () => {
    expect(isValidToken('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9')).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// ROUTE ACCESS
// ════════════════════════════════════════════════════════════════════════════
describe('getAccessibleRoutes', () => {
  it('admin can access /admin/dashboard', () => {
    expect(getAccessibleRoutes(ADMIN_SESSION)).toContain('/admin/dashboard');
  });

  it('admin can access /admin/observability', () => {
    expect(getAccessibleRoutes(ADMIN_SESSION)).toContain('/admin/observability');
  });

  it('basic user cannot access /admin/dashboard', () => {
    expect(getAccessibleRoutes(BASIC_SESSION)).not.toContain('/admin/dashboard');
  });

  it('AI+ user can access /ai-assistant', () => {
    expect(getAccessibleRoutes(AI_PLUS_SESSION)).toContain('/ai-assistant');
  });

  it('AI+ user can access /auto-checkout', () => {
    expect(getAccessibleRoutes(AI_PLUS_SESSION)).toContain('/auto-checkout');
  });

  it('basic user cannot access /auto-checkout', () => {
    expect(getAccessibleRoutes(BASIC_SESSION)).not.toContain('/auto-checkout');
  });

  it('null session returns only public routes', () => {
    const routes = getAccessibleRoutes(null);
    expect(routes).toContain('/');
    expect(routes).toContain('/products');
    expect(routes).not.toContain('/admin/dashboard');
  });

  it('expired session treated as unauthenticated', () => {
    const routes = getAccessibleRoutes(EXPIRED_SESSION);
    expect(routes).not.toContain('/admin/dashboard');
  });

  it('analytics can access observability', () => {
    expect(getAccessibleRoutes(ANALYTICS_SESSION)).toContain('/admin/observability');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// SESSION PARSING
// ════════════════════════════════════════════════════════════════════════════
describe('parseSessionFromStorage', () => {
  it('parses valid storage', () => {
    const storage = {
      authToken: 'sess_abc123xyz456789',
      userEmail: 'admin@delegatecart.com',
      'dc-user-role': 'admin',
      'dc-user-subscription': 'AI_PLUS',
    };
    const session = parseSessionFromStorage(storage);
    expect(session).not.toBeNull();
    expect(session!.role).toBe('admin');
    expect(session!.subscription).toBe('AI_PLUS');
  });

  it('returns null for missing token', () => {
    expect(parseSessionFromStorage({ userEmail: 'x@y.com' })).toBeNull();
  });

  it('returns null for missing email', () => {
    expect(parseSessionFromStorage({ authToken: 'sess_abc123' })).toBeNull();
  });

  it('defaults to basic role when missing', () => {
    const session = parseSessionFromStorage({ authToken: 'sess_abc123', userEmail: 'x@y.com' });
    expect(session!.role).toBe('basic');
  });
});
