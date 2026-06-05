/**
 * Dark Mode Provider
 * Client-side theme management with Next.js support
 * Auto-detects system preference, persists user preference
 */

'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = 'app-theme';

/**
 * Provider component
 * 
 * Usage:
 * <html>
 *   <body>
 *     <ThemeProvider>
 *       <App />
 *     </ThemeProvider>
 *   </body>
 * </html>
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system');
  const [isDark, setIsDark] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Initialize theme on mount
  useEffect(() => {
    // Get stored preference
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    const initialTheme = stored || 'system';
    setThemeState(initialTheme);

    // Determine if dark mode should be active
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDarkMode = initialTheme === 'dark' || (initialTheme === 'system' && prefersDark);
    
    setIsDark(isDarkMode);
    applyTheme(isDarkMode);
    setIsMounted(true);
  }, []);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      if (theme === 'system') {
        setIsDark(e.matches);
        applyTheme(e.matches);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  const applyTheme = (dark: boolean) => {
    if (typeof document === 'undefined') return;
    
    const root = document.documentElement;
    if (dark) {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    }
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);

    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDarkMode = newTheme === 'dark' || (newTheme === 'system' && prefersDark);
    
    setIsDark(isDarkMode);
    applyTheme(isDarkMode);
  };

  const toggleTheme = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  // Don't render until mounted to prevent hydration mismatch
  if (!isMounted) {
    return <>{children}</>;
  }

  return (
    <ThemeContext.Provider value={{ theme, isDark, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Hook to access theme context
 * 
 * Usage:
 * const { isDark, setTheme } = useTheme();
 * 
 * return (
 *   <button onClick={() => setTheme('dark')}>
 *     {isDark ? '🌙' : '☀️'}
 *   </button>
 * );
 */
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}

/**
 * Component for theme toggle button
 */
export function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg transition-colors hover:bg-slate-200 dark:hover:bg-slate-700"
      aria-label="Toggle theme"
    >
      {isDark ? '☀️ Light' : '🌙 Dark'}
    </button>
  );
}

/**
 * Utility: Get color value for current theme
 */
export function getThemeColor(lightColor: string, darkColor: string) {
  if (typeof window === 'undefined') return lightColor;
  return document.documentElement.classList.contains('dark') ? darkColor : lightColor;
}

/**
 * Utility: Apply styles based on theme
 */
export function useThemeStyles() {
  const { isDark } = useTheme();

  return {
    bg: isDark ? 'bg-slate-900' : 'bg-white',
    text: isDark ? 'text-white' : 'text-slate-900',
    border: isDark ? 'border-slate-700' : 'border-slate-300',
    hover: isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100',
    card: isDark ? 'bg-slate-800' : 'bg-white',
    input: isDark ? 'bg-slate-700 text-white' : 'bg-white text-slate-900',
  };
}
