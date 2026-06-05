/**
 * Theme & Styling Utilities
 * Supports light/dark mode, role-based theming, responsive helpers
 */

export type Theme = 'light' | 'dark' | 'system';
export type UserRole = 'customer' | 'seller' | 'admin';

/**
 * Theme Configuration Interface
 */
export interface ThemeConfig {
  primaryColor: string;
  accentColor: string;
  role: UserRole;
  isDark: boolean;
}

/**
 * Get current theme preference
 * Follows: localStorage > system preference > default
 */
export function getThemePreference(): Theme {
  if (typeof window === 'undefined') return 'system';

  const stored = localStorage.getItem('theme-preference');
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored;
  }

  return 'system';
}

/**
 * Get effective theme (resolves system preference)
 */
export function getEffectiveTheme(preference: Theme = 'system'): 'light' | 'dark' {
  if (preference === 'light') return 'light';
  if (preference === 'dark') return 'dark';

  if (typeof window === 'undefined') return 'light';

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Set theme preference
 */
export function setThemePreference(theme: Theme): void {
  if (typeof document === 'undefined') return;

  localStorage.setItem('theme-preference', theme);

  const html = document.documentElement;
  const effectiveTheme = getEffectiveTheme(theme);

  if (effectiveTheme === 'dark') {
    html.classList.add('dark');
  } else {
    html.classList.remove('dark');
  }

  // Emit custom event
  window.dispatchEvent(new CustomEvent('themechange', { detail: { theme, effectiveTheme } }));
}

/**
 * Toggle between light and dark mode
 */
export function toggleTheme(): void {
  const current = getThemePreference();
  const next: Theme = current === 'light' ? 'dark' : current === 'dark' ? 'system' : 'light';
  setThemePreference(next);
}

/**
 * Get role-specific color scheme
 */
export function getRoleColors(role: UserRole, isDark: boolean = false) {
  const colors = {
    customer: isDark
      ? { primary: '#263BFF', accent: '#06B6D4' } // Bright indigo
      : { primary: '#6366f1', accent: '#0ea5e9' }, // Softer indigo
    seller: isDark
      ? { primary: '#3B82F6', accent: '#F59E0B' } // Blue + Amber
      : { primary: '#2563eb', accent: '#f59e0b' },
    admin: isDark
      ? { primary: '#A855F7', accent: '#EC4899' } // Purple + Pink
      : { primary: '#9333ea', accent: '#ec4899' },
  };

  return colors[role];
}

/**
 * Set user role for role-based theming
 */
export function setUserRole(role: UserRole): void {
  if (typeof document === 'undefined') return;

  const html = document.documentElement;
  html.setAttribute('data-role', role);
  localStorage.setItem('user-role', role);

  window.dispatchEvent(new CustomEvent('rolechange', { detail: { role } }));
}

/**
 * Get current user role
 */
export function getUserRole(): UserRole {
  if (typeof window === 'undefined') return 'customer';

  const stored = localStorage.getItem('user-role');
  return (stored as UserRole) || 'customer';
}

/**
 * Initialize theme on page load
 * Call this in your root layout or _app component
 */
export function initializeTheme(): void {
  if (typeof document === 'undefined') return;

  const preference = getThemePreference();
  const effectiveTheme = getEffectiveTheme(preference);
  const role = getUserRole();

  const html = document.documentElement;

  // Apply theme
  if (effectiveTheme === 'dark') {
    html.classList.add('dark');
  } else {
    html.classList.remove('dark');
  }

  // Apply role
  html.setAttribute('data-role', role);

  // Watch system theme changes
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', (e) => {
    if (getThemePreference() === 'system') {
      e.matches ? html.classList.add('dark') : html.classList.remove('dark');
    }
  });
}

/**
 * Get color for a role (as CSS variable or direct value)
 */
export function getRoleColor(role: UserRole, colorKey: 'primary' | 'accent'): string {
  const isDark =
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const colors = getRoleColors(role, isDark);
  return colors[colorKey];
}

/**
 * Theme helper for components
 * Provides conditional classes based on theme
 */
export function themeClasses(lightClass: string, darkClass: string, isDark?: boolean): string {
  if (isDark === undefined && typeof document !== 'undefined') {
    isDark = document.documentElement.classList.contains('dark');
  }

  return isDark ? darkClass : lightClass;
}

/**
 * Safe theme attribute getter
 * Prevent FOUC (Flash of Unstyled Content)
 */
export function getThemeAttribute(): Theme {
  if (typeof window === 'undefined') return 'system';

  const root = document.documentElement;
  const isDark = root.classList.contains('dark');

  return isDark ? 'dark' : 'light';
}

/**
 * Component theme props generator
 *
 * @example
 * const { bgClass, textClass } = componentTheme('light', 'dark');
 */
export function componentTheme(
  lightBg: string,
  darkBg: string,
  lightText?: string,
  darkText?: string
) {
  const isDark =
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

  return {
    bgClass: isDark ? darkBg : lightBg,
    textClass: isDark ? darkText || 'text-gray-200' : lightText || 'text-gray-900',
    isDark,
  };
}

/**
 * Generate role-aware gradient
 */
export function getRoleGradient(role: UserRole, isDark?: boolean): string {
  if (isDark === undefined && typeof document !== 'undefined') {
    isDark = document.documentElement.classList.contains('dark');
  }

  const gradients = {
    customer: isDark
      ? 'linear-gradient(135deg, #6366F1, #8B5CF6, #06B6D4)'
      : 'linear-gradient(135deg, #6366F1, #8B5CF6, #06B6D4)',
    seller: isDark
      ? 'linear-gradient(135deg, #3B82F6, #F59E0B)'
      : 'linear-gradient(135deg, #2563eb, #f59e0b)',
    admin: isDark
      ? 'linear-gradient(135deg, #A855F7, #EC4899)'
      : 'linear-gradient(135deg, #9333ea, #ec4899)',
  };

  return gradients[role];
}

/**
 * Accessibility: Get contrast color for readable text
 */
export function getContrastColor(bgColor: string, isDark?: boolean): 'light' | 'dark' {
  // Simple luminance calculation
  const rgb = bgColor.match(/\d+/g);
  if (!rgb || rgb.length < 3) return isDark ? 'light' : 'dark';

  const luminance =
    (0.299 * parseInt(rgb[0]) + 0.587 * parseInt(rgb[1]) + 0.114 * parseInt(rgb[2])) / 255;

  return luminance > 0.5 ? 'dark' : 'light';
}

/**
 * Get role-specific styles (for CSS-in-JS)
 */
export function getRoleStyles(role: UserRole) {
  const colors = getRoleColors(role, false);

  return {
    '--color-role-primary': colors.primary,
    '--color-role-accent': colors.accent,
  } as const;
}

/**
 * Theme observer hook alternative (for non-React contexts)
 */
export function onThemeChange(callback: (theme: 'light' | 'dark') => void): () => void {
  const handler = (e: CustomEvent) => {
    callback(e.detail.effectiveTheme);
  };

  window.addEventListener('themechange', handler as EventListener);

  return () => {
    window.removeEventListener('themechange', handler as EventListener);
  };
}

/**
 * Get all available roles
 */
export const ROLES: UserRole[] = ['customer', 'seller', 'admin'];

/**
 * Get all available themes
 */
export const THEMES: Theme[] = ['light', 'dark', 'system'];

/**
 * Default theme configuration
 */
export const DEFAULT_THEME_CONFIG: ThemeConfig = {
  primaryColor: '#6366F1',
  accentColor: '#06B6D4',
  role: 'customer',
  isDark: false,
};

/**
 * Deprecated: Use setThemePreference instead
 * @deprecated
 */
export function applyTheme(theme: 'light' | 'dark'): void {
  setThemePreference(theme);
}
