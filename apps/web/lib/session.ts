/**
 * Session isolation utility.
 * Call clearUserSession() on BOTH login and logout to prevent
 * cross-user data contamination in localStorage/sessionStorage.
 */

// All user-specific keys that must NOT survive a user switch.
// Auth keys (authToken, userEmail) are intentionally excluded so callers
// can remove them separately and control the redirect timing.
const USER_SESSION_KEYS = [
  // identity
  'dc-user-id',
  'dc-user-role',
  'dc-user-subscription',
  'userId',
  // metrics / search history
  'dc-metrics-products',
  'dc-metrics-timeline',
  'dc-metrics-ts',
  'dc-metrics-history',
  'dc-intent-feedback',
  // shopping data
  'cart',
  'orders',
  'failedCheckouts',
  'shoppingListResults',
  'cartFromAI',
  'wishlist',
  'addresses',
  // per-user settings
  'dc-auto-approve-threshold',
  'dc-max-recommendations',
  'dc-notif-test-logs',
  'autoPurchaseEnabled',
  'profileTermsAccepted',
  'shoppingListTermsAccepted',
  'showExternalProducts',
  'whatsappNumber',
  'notificationEmail',
  'notificationPrefs',
  // admin impersonation state (should not carry over between real users)
  'dc-impersonating',
  'dc-admin-original-email',
  'dc-admin-original-token',
  'dc-admin-original-role',
  'dc-admin-original-subscription',
  'dc-admin-impersonate-original',
];

const COOKIE_EXACT_KEYS = [
  'authToken',
  'userEmail',
  'next-auth.session-token',
  '__Secure-next-auth.session-token',
  'next-auth.csrf-token',
  '__Host-next-auth.csrf-token',
];

function clearSessionCookies(): void {
  if (typeof document === 'undefined') return;

  const cookieNames = new Set<string>(COOKIE_EXACT_KEYS);
  const raw = document.cookie;

  if (raw) {
    raw.split(';').forEach(entry => {
      const [nameRaw] = entry.split('=');
      const name = nameRaw?.trim();
      if (!name) return;
      if (name.startsWith('dc-')) cookieNames.add(name);
    });
  }

  cookieNames.forEach(name => {
    // Clear cookie with common path/samesite variants.
    document.cookie = `${name}=; Max-Age=0; path=/`;
    document.cookie = `${name}=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
  });
}

export function clearUserSession(): void {
  if (typeof window === 'undefined') return;
  USER_SESSION_KEYS.forEach(key => localStorage.removeItem(key));
  // Clear Zustand-persisted sessionStorage stores
  sessionStorage.removeItem('dc-chat-store');
  sessionStorage.removeItem('dc-product-page-store');
  // Clear stale admin session so it cannot pollute the next user's role
  sessionStorage.removeItem('dc-admin-session');
  clearSessionCookies();
}
