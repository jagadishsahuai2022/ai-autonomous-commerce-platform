/**
 * Unit tests for admin-auth utility
 * Tests credential validation, session management, and expiry
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock storage
const sessionStore: Record<string, string> = {};
const localStore: Record<string, string> = {};

const mockSessionStorage = {
  getItem: vi.fn((key: string) => sessionStore[key] || null),
  setItem: vi.fn((key: string, value: string) => {
    sessionStore[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete sessionStore[key];
  }),
  clear: vi.fn(() => {
    Object.keys(sessionStore).forEach((k) => delete sessionStore[k]);
  }),
  length: 0,
  key: vi.fn(() => null),
};

const mockLocalStorage = {
  getItem: vi.fn((key: string) => localStore[key] || null),
  setItem: vi.fn((key: string, value: string) => {
    localStore[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete localStore[key];
  }),
  clear: vi.fn(() => {
    Object.keys(localStore).forEach((k) => delete localStore[k]);
  }),
  length: 0,
  key: vi.fn(() => null),
};

Object.defineProperty(global, 'sessionStorage', { value: mockSessionStorage, writable: true });
Object.defineProperty(global, 'localStorage', { value: mockLocalStorage, writable: true });
Object.defineProperty(global, 'window', {
  value: {
    sessionStorage: mockSessionStorage,
    localStorage: mockLocalStorage,
    dispatchEvent: vi.fn(),
  },
  writable: true,
});

// Fake Event constructor
global.Event = vi.fn() as any;

describe('Admin Auth', () => {
  beforeEach(() => {
    mockSessionStorage.clear();
    mockLocalStorage.clear();
    vi.resetModules();
  });

  it('should export all functions', async () => {
    const mod = await import('../../lib/admin-auth');
    expect(mod.isAdminUser).toBeDefined();
    expect(mod.authenticateAdmin).toBeDefined();
    expect(mod.clearAdminSession).toBeDefined();
    expect(mod.getAdminSession).toBeDefined();
  });

  it('isAdminUser returns false when not logged in', async () => {
    const { isAdminUser } = await import('../../lib/admin-auth');
    expect(isAdminUser()).toBe(false);
  });

  it('authenticateAdmin rejects invalid email', async () => {
    const { authenticateAdmin } = await import('../../lib/admin-auth');
    expect(authenticateAdmin('wrong@example.com', 'Admin@DC2024!')).toBe(false);
  });

  it('authenticateAdmin rejects invalid password', async () => {
    const { authenticateAdmin } = await import('../../lib/admin-auth');
    expect(authenticateAdmin('admin@delegatecart.com', 'wrong')).toBe(false);
  });

  it('authenticateAdmin accepts valid credentials', async () => {
    const { authenticateAdmin } = await import('../../lib/admin-auth');
    const result = authenticateAdmin('admin@delegatecart.com', 'Admin@DC2024!');
    expect(result).toBe(true);
  });

  it('authenticateAdmin accepts alternate admin email', async () => {
    const { authenticateAdmin } = await import('../../lib/admin-auth');
    expect(authenticateAdmin('admin@example.com', 'Admin@DC2024!')).toBe(true);
  });

  it('isAdminUser returns true after successful auth', async () => {
    const { authenticateAdmin, isAdminUser } = await import('../../lib/admin-auth');
    authenticateAdmin('admin@delegatecart.com', 'Admin@DC2024!');
    expect(isAdminUser()).toBe(true);
  });

  it('getAdminSession returns session after auth', async () => {
    const { authenticateAdmin, getAdminSession } = await import('../../lib/admin-auth');
    authenticateAdmin('admin@delegatecart.com', 'Admin@DC2024!');
    const session = getAdminSession();
    expect(session).not.toBeNull();
    expect(session?.email).toBe('admin@delegatecart.com');
    expect(session?.isAdmin).toBe(true);
  });

  it('clearAdminSession removes session', async () => {
    const { authenticateAdmin, clearAdminSession, getAdminSession } =
      await import('../../lib/admin-auth');
    authenticateAdmin('admin@delegatecart.com', 'Admin@DC2024!');
    clearAdminSession();
    expect(getAdminSession()).toBeNull();
  });

  it('session expires after 8 hours', async () => {
    const { authenticateAdmin, getAdminSession } = await import('../../lib/admin-auth');
    authenticateAdmin('admin@delegatecart.com', 'Admin@DC2024!');

    // Simulate expiry by modifying stored session
    const key = 'dc-admin-session';
    const session = JSON.parse(sessionStore[key]);
    session.expiresAt = Date.now() - 1000; // Expired
    sessionStore[key] = JSON.stringify(session);

    expect(getAdminSession()).toBeNull(); // Should be expired
  });

  it('authenticateAdmin is case-insensitive for email', async () => {
    const { authenticateAdmin } = await import('../../lib/admin-auth');
    expect(authenticateAdmin('Admin@DelegateCart.com', 'Admin@DC2024!')).toBe(true);
  });
});

// ── RBAC Tests ──────────────────────────────────────────────────────────────

describe('Admin Auth — RBAC', () => {
  beforeEach(() => {
    mockSessionStorage.clear();
    mockLocalStorage.clear();
    vi.resetModules();
  });

  it('exports getUserRole function', async () => {
    const mod = await import('../../lib/admin-auth');
    expect(mod.getUserRole).toBeDefined();
  });

  it('exports hasPageAccess function', async () => {
    const mod = await import('../../lib/admin-auth');
    expect(mod.hasPageAccess).toBeDefined();
  });

  it('exports isElevatedUser function', async () => {
    const mod = await import('../../lib/admin-auth');
    expect(mod.isElevatedUser).toBeDefined();
  });

  it('getUserRole returns admin for admin emails', async () => {
    const { getUserRole } = await import('../../lib/admin-auth');
    expect(getUserRole('admin@delegatecart.com')).toBe('admin');
    expect(getUserRole('admin@example.com')).toBe('admin');
  });

  it('getUserRole returns learning-support for supervised learning email', async () => {
    const { getUserRole } = await import('../../lib/admin-auth');
    expect(getUserRole('supervisedLearning@delegatecart.com')).toBe('learning-support');
  });

  it('getUserRole returns observability-support for observability email', async () => {
    const { getUserRole } = await import('../../lib/admin-auth');
    expect(getUserRole('observability@delegatecart.com')).toBe('observability-support');
  });

  it('getUserRole returns customer for unknown emails', async () => {
    const { getUserRole } = await import('../../lib/admin-auth');
    expect(getUserRole('random@gmail.com')).toBe('customer');
    expect(getUserRole('test@test.com')).toBe('customer');
  });

  it('authenticateAdmin accepts learning-support user', async () => {
    const { authenticateAdmin } = await import('../../lib/admin-auth');
    expect(authenticateAdmin('supervisedLearning@delegatecart.com', 'Admin@DC2024!')).toBe(true);
  });

  it('authenticateAdmin accepts observability-support user', async () => {
    const { authenticateAdmin } = await import('../../lib/admin-auth');
    expect(authenticateAdmin('observability@delegatecart.com', 'Admin@DC2024!')).toBe(true);
  });

  it('authenticateAdmin stores role in session', async () => {
    const { authenticateAdmin, getAdminSession } = await import('../../lib/admin-auth');
    authenticateAdmin('supervisedLearning@delegatecart.com', 'Admin@DC2024!');
    const session = getAdminSession();
    expect(session).not.toBeNull();
    expect(session?.role).toBe('learning-support');
  });

  it('admin session has isAdmin=true for admin role', async () => {
    const { authenticateAdmin, getAdminSession } = await import('../../lib/admin-auth');
    authenticateAdmin('admin@delegatecart.com', 'Admin@DC2024!');
    const session = getAdminSession();
    expect(session?.isAdmin).toBe(true);
  });

  it('learning-support session has isAdmin=false', async () => {
    const { authenticateAdmin, getAdminSession } = await import('../../lib/admin-auth');
    authenticateAdmin('supervisedLearning@delegatecart.com', 'Admin@DC2024!');
    const session = getAdminSession();
    expect(session?.isAdmin).toBe(false);
  });

  it('hasPageAccess grants admin access to all pages', async () => {
    const { authenticateAdmin, hasPageAccess } = await import('../../lib/admin-auth');
    authenticateAdmin('admin@delegatecart.com', 'Admin@DC2024!');
    expect(hasPageAccess('/admin/learning')).toBe(true);
    expect(hasPageAccess('/observability')).toBe(true);
    expect(hasPageAccess('/admin/anything')).toBe(true);
  });

  it('hasPageAccess grants learning-support access to /admin/learning only', async () => {
    const { authenticateAdmin, hasPageAccess } = await import('../../lib/admin-auth');
    authenticateAdmin('supervisedLearning@delegatecart.com', 'Admin@DC2024!');
    expect(hasPageAccess('/admin/learning')).toBe(true);
    expect(hasPageAccess('/observability')).toBe(false);
  });

  it('hasPageAccess grants observability-support access to learning + observability', async () => {
    const { authenticateAdmin, hasPageAccess } = await import('../../lib/admin-auth');
    authenticateAdmin('observability@delegatecart.com', 'Admin@DC2024!');
    expect(hasPageAccess('/admin/learning')).toBe(true);
    expect(hasPageAccess('/observability')).toBe(true);
  });

  it('hasPageAccess denies customer access to admin pages', async () => {
    const { hasPageAccess } = await import('../../lib/admin-auth');
    // No login → customer role fallback
    localStore['userEmail'] = 'random@gmail.com';
    expect(hasPageAccess('/admin/learning')).toBe(false);
    expect(hasPageAccess('/observability')).toBe(false);
  });

  it('isElevatedUser returns true for elevated users', async () => {
    const { authenticateAdmin, isElevatedUser } = await import('../../lib/admin-auth');
    authenticateAdmin('supervisedLearning@delegatecart.com', 'Admin@DC2024!');
    expect(isElevatedUser()).toBe(true);
  });

  it('isElevatedUser returns false for customers', async () => {
    const { isElevatedUser } = await import('../../lib/admin-auth');
    localStore['userEmail'] = 'customer@test.com';
    expect(isElevatedUser()).toBe(false);
  });
});
