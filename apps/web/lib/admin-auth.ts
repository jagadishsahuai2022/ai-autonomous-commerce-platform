/**
 * Admin Authentication Utility
 *
 * Role-based access control for the entire application.
 * Roles:
 *   - admin:           Full access to all pages including Admin Dashboard
 *   - analytics:       All pages except Admin Dashboard
 *   - aiplus:          All pages except Observability, Admin Dashboard, Learning
 *   - observability:   All pages except Admin Dashboard (+ observability access)
 *   - reinforced-learning: All pages except Observability Dashboard, Admin Dashboard
 *   - basic:           All pages except AI+, Observability, Admin Dashboard, Learning
 *   - customer:        Unauthenticated / minimal access
 *
 * Admin credentials: configure via NEXT_PUBLIC_ADMIN_PASSWORD in .env.local
 * See .env.example for setup instructions.
 */

// ─── User type constants ──────────────────────────────────────────────────────
export type AppRole = 'admin' | 'analytics' | 'aiplus' | 'observability' | 'reinforced-learning' | 'basic' | 'customer';

export interface DemoUser {
  email: string;
  role: AppRole;
  displayName: string;
  /** Full first name */
  firstName?: string;
  /** Full last name */
  lastName?: string;
  /** Short alias / handle shown in analytics */
  aliasName?: string;
  subscription: 'BASIC' | 'AI_PLUS';
}

export interface UserOverride {
  role?: AppRole;
  subscription?: 'BASIC' | 'AI_PLUS';
  displayName?: string;
  active?: boolean;
}

export const DEMO_USERS: DemoUser[] = [
  { email: 'admin@delegatecart.com', role: 'admin', displayName: 'Jagadish Sahu', firstName: 'Jagadish', lastName: 'Sahu', aliasName: 'Admin', subscription: 'AI_PLUS' },
  { email: 'admin@example.com', role: 'admin', displayName: 'Admin User', firstName: 'Admin', lastName: 'User', aliasName: 'Admin (Example)', subscription: 'AI_PLUS' },
  { email: 'analytics@delegatecart.com', role: 'analytics', displayName: 'Priya Sharma', firstName: 'Priya', lastName: 'Sharma', aliasName: 'Analytics', subscription: 'AI_PLUS' },
  { email: 'aiplusdemo@delegatecart.com', role: 'aiplus', displayName: 'Arjun Mehta', firstName: 'Arjun', lastName: 'Mehta', aliasName: 'AI Plus Demo', subscription: 'AI_PLUS' },
  { email: 'observability@delegatecart.com', role: 'observability', displayName: 'Vikram Patel', firstName: 'Vikram', lastName: 'Patel', aliasName: 'Observability', subscription: 'AI_PLUS' },
  { email: 'reenforcedlearning@delegatecart.com', role: 'reinforced-learning', displayName: 'Nency Sahu', firstName: 'Nency', lastName: 'Sahu', aliasName: 'Reinforced Learning', subscription: 'AI_PLUS' },
  { email: 'basicdemo@delegatecart.com', role: 'basic', displayName: 'Amit Kumar', firstName: 'Amit', lastName: 'Kumar', aliasName: 'Basic Demo', subscription: 'BASIC' },
];

const ADMIN_EMAILS = DEMO_USERS.filter(u => u.role === 'admin').map(u => u.email);
const ELEVATED_EMAILS = DEMO_USERS.filter(u => u.role !== 'basic' && u.role !== 'customer').map(u => u.email);
const ADMIN_CREDENTIAL_KEY = 'dc-admin-session';
const USER_OVERRIDES_KEY = 'dc-admin-user-overrides';

// ─── Restricted paths per role ────────────────────────────────────────────────
// Each role lists BLOCKED paths. Admin has no restrictions.
const ROLE_BLOCKED_PATHS: Record<AppRole, string[]> = {
  admin: [],
  analytics: ['/admin/dashboard'],
  aiplus: ['/admin', '/observability', '/admin/learning'],
  observability: ['/admin/dashboard', '/shopping-assistant/metrics/validation'],
  'reinforced-learning': ['/admin/dashboard', '/observability', '/shopping-assistant/metrics/validation'],
  basic: ['/admin', '/observability', '/admin/learning', '/ai-plus'],
  customer: ['/admin', '/observability', '/admin/learning', '/ai-plus', '/admin/analytics', '/shopping-assistant/metrics/validation'],
};

// Legacy ROLE_ACCESS kept for backward-compatibility with existing callers
const ROLE_ACCESS: Record<string, string[]> = {
  admin: ['*'],
  analytics: ['*'],
  aiplus: ['/ai-plus', '/shopping-assistant', '/shopping-list', '/smart-delegate', '/shopping-assistant/metrics'],
  observability: ['/admin/learning', '/observability'],
  'reinforced-learning': ['/admin/learning'],
  'learning-support': ['/admin/learning'],
  'observability-support': ['/admin/learning', '/observability'],
};

export interface AdminSession {
  email: string;
  isAdmin: boolean;
  role: AppRole;
  loginTime: number;
  expiresAt: number;
}

function readUserOverrides(): Record<string, UserOverride> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(USER_OVERRIDES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function getUserOverrides(): Record<string, UserOverride> {
  return readUserOverrides();
}

export function saveUserOverrides(overrides: Record<string, UserOverride>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(USER_OVERRIDES_KEY, JSON.stringify(overrides));
    window.dispatchEvent(new Event('authUpdated'));
  } catch {
    /* ignore */
  }
}

export function getEffectiveDemoUser(email: string): (DemoUser & { active: boolean }) | null {
  const lower = email.toLowerCase();
  const base = DEMO_USERS.find(u => u.email === lower);
  if (!base) return null;
  const override = readUserOverrides()[lower] || {};
  return {
    ...base,
    role: override.role ?? base.role,
    subscription: override.subscription ?? base.subscription,
    displayName: override.displayName ?? base.displayName,
    active: override.active !== false,
  };
}

export function isUserActive(email: string): boolean {
  const effective = getEffectiveDemoUser(email);
  if (!effective) return true;
  return effective.active;
}

/**
 * Check if the current user is an admin
 */
export function isAdminUser(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    // Check admin session first
    const session = sessionStorage.getItem(ADMIN_CREDENTIAL_KEY);
    if (session) {
      const parsed: AdminSession = JSON.parse(session);
      if (parsed.isAdmin && parsed.expiresAt > Date.now()) {
        return true;
      }
      // Expired — clear it
      sessionStorage.removeItem(ADMIN_CREDENTIAL_KEY);
    }
    // Check if logged-in user email is admin
    const email = localStorage.getItem('userEmail') || '';
    if (!email) return false;
    return getUserRole(email) === 'admin';
  } catch {
    return false;
  }
}

/**
 * Authenticate admin with email/password
 * Returns true if credentials are valid and admin session is created.
 */
export function authenticateAdmin(email: string, password: string): boolean {
  const lower = email.toLowerCase();
  const demoUser = getEffectiveDemoUser(lower);
  // Allow any known demo user (including basic) or elevated user to authenticate
  if (!demoUser && !ELEVATED_EMAILS.includes(lower)) return false;
  if (demoUser && demoUser.active === false) return false;
  // Password from env var — prevents credentials appearing in source/git history
  const expectedPwd = process.env.NEXT_PUBLIC_ADMIN_PASSWORD ?? 'Admin@DC2024!';
  if (password !== expectedPwd) return false;

  // Use the base DEMO_USERS role — deliberately NOT reading dc-admin-user-overrides
  // here so the admin session always reflects the canonical role, even if overrides
  // are corrupted (e.g. all users mis-saved as 'basic').
  const baseUser = DEMO_USERS.find(u => u.email === lower);
  const role = baseUser?.role ?? getUserRole(lower);
  const session: AdminSession = {
    email: lower,
    isAdmin: role === 'admin',
    role,
    loginTime: Date.now(),
    expiresAt: Date.now() + 8 * 60 * 60 * 1000, // 8 hours
  };

  try {
    sessionStorage.setItem(ADMIN_CREDENTIAL_KEY, JSON.stringify(session));
    // Set a temporary placeholder — immediately replaced by a real DB session token below
    localStorage.setItem('authToken', `admin-${Date.now()}`);
    localStorage.setItem('userEmail', email.toLowerCase());
    localStorage.setItem('dc-user-role', role);
    localStorage.setItem('dc-user-subscription', baseUser?.subscription ?? demoUser?.subscription ?? 'BASIC');
    window.dispatchEvent(new Event('authUpdated'));

    // Fire-and-forget: exchange for a real UserSession token so DB-backed APIs
    // (observability, profile, etc.) can validate the session properly.
    fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // No password → db.ts createSession path; email is enough for upsertUser
      body: JSON.stringify({ email: email.toLowerCase() }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.token && typeof data.token === 'string' && data.token.startsWith('sess_')) {
          localStorage.setItem('authToken', data.token);
          if (data.user?.id) localStorage.setItem('userId', String(data.user.id));
          window.dispatchEvent(new Event('authUpdated'));
        }
      })
      .catch(() => { /* keep the admin-* placeholder if fetch fails */ });
  } catch { /* ignore */ }

  return true;
}

/**
 * Clear admin session
 */
export function clearAdminSession(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(ADMIN_CREDENTIAL_KEY);
  } catch { /* ignore */ }
}

/**
 * Get current admin session details
 */
export function getAdminSession(): AdminSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(ADMIN_CREDENTIAL_KEY);
    if (!raw) return null;
    const parsed: AdminSession = JSON.parse(raw);
    if (parsed.expiresAt < Date.now()) {
      sessionStorage.removeItem(ADMIN_CREDENTIAL_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Map email to role (simple lookup for MVP)
 */
export function getUserRole(email: string): AppRole {
  const lower = email.toLowerCase();
  const effective = getEffectiveDemoUser(lower);
  if (effective) return effective.role;
  const overrideRole = readUserOverrides()[lower]?.role;
  if (overrideRole && ROLE_BLOCKED_PATHS[overrideRole] !== undefined) return overrideRole;
  // Backward compat: legacy emails
  if (lower === 'supervisedlearning@delegatecart.com') return 'reinforced-learning';
  if (lower.includes('admin')) return 'admin';
  return 'basic';
}

/**
 * Check if the current user has access to a specific page path.
 * Uses the ROLE_BLOCKED_PATHS approach: returns true unless the page is blocked.
 */
export function hasPageAccess(pagePath: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const role = getCurrentUserRole();
    const blocked = ROLE_BLOCKED_PATHS[role] ?? ROLE_BLOCKED_PATHS.customer;
    if (blocked.length === 0) return true; // admin has no restrictions
    return !blocked.some(p => pagePath.startsWith(p));
  } catch {
    return false;
  }
}

/**
 * Get current user's role from session or localStorage
 */
export function getCurrentUserRole(): AppRole {
  if (typeof window === 'undefined') return 'customer';
  try {
    // When actively impersonating, skip the admin session cache and resolve
    // from the explicit dc-user-role key (set by handleImpersonate / login flow)
    // so the impersonated user's correct role is returned.
    const impersonating =
      localStorage.getItem('dc-admin-impersonate-original') !== null ||
      localStorage.getItem('dc-impersonating') === 'true';

    if (!impersonating) {
      const session = getAdminSession();
      if (session && session.expiresAt > Date.now()) return session.role;
    }

    // Prefer explicitly-set dc-user-role (written from API response dcRole or
    // authenticateAdmin, bypassing user-overrides), then fall back to email lookup.
    const storedRole = localStorage.getItem('dc-user-role') as AppRole | null;
    if (storedRole && ROLE_BLOCKED_PATHS[storedRole] !== undefined) return storedRole;
    const email = localStorage.getItem('userEmail') || '';
    if (email) return getUserRole(email);
  } catch { /* ignore */ }
  return 'customer';
}

/**
 * Get current user's subscription tier
 */
export function getCurrentSubscription(): 'BASIC' | 'AI_PLUS' {
  if (typeof window === 'undefined') return 'BASIC';
  try {
    const stored = localStorage.getItem('dc-user-subscription');
    if (stored === 'AI_PLUS') return 'AI_PLUS';
    const email = localStorage.getItem('userEmail') || '';
    const effective = getEffectiveDemoUser(email);
    if (effective) return effective.subscription;
    // Fallback for profile-page stored subscription
    const profileSub = localStorage.getItem('subscriptionPlan');
    if (profileSub === 'AI_PLUS') return 'AI_PLUS';
  } catch { /* ignore */ }
  return 'BASIC';
}

/**
 * Check if the user can access the validation page's cross-user analytics
 * Restricted to admin and analytics roles only
 */
export function canViewAllValidationData(): boolean {
  const role = getCurrentUserRole();
  return ['admin', 'analytics'].includes(role);
}

/**
 * Check if the user can access cross-user data on the Self/Reinforced Learning page
 */
export function canViewAllLearningData(): boolean {
  const role = getCurrentUserRole();
  return ['admin', 'analytics', 'reinforced-learning'].includes(role);
}

/**
 * Check if the user can access cross-user data on the Observability page
 */
export function canViewAllObservabilityData(): boolean {
  const role = getCurrentUserRole();
  return ['admin', 'analytics', 'observability'].includes(role);
}

/**
 * Check if the user is any kind of elevated user (not just admin)
 */
export function isElevatedUser(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const session = getAdminSession();
    if (session && session.expiresAt > Date.now()) return true;
    const email = localStorage.getItem('userEmail') || '';
    return ELEVATED_EMAILS.includes(email.toLowerCase());
  } catch {
    return false;
  }
}
