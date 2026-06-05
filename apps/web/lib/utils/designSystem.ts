/**
 * Premium UI Design System
 * Inspired by Stripe, Apple, and Linear
 * Provides consistent design tokens and utilities
 */

// ============ COLORS ============
export const colors = {
  // Primary Gradient
  primary: {
    light: '#EEF2FF', // indigo-50
    DEFAULT: '#6366f1', // indigo-600
    dark: '#4f46e5', // indigo-700
    darker: '#4338ca', // indigo-800
  },
  // Accent / Blue
  accent: {
    light: '#F0F9FF', // blue-50
    DEFAULT: '#0ea5e9', // cyan-500
    dark: '#06b6d4', // cyan-600
  },
  // Secondary / Gray
  secondary: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },
  // States
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  // Surfaces
  bg: {
    primary: '#ffffff',
    secondary: '#f9fafb',
    tertiary: '#f3f4f6',
  },
};

// ============ SPACING ============
export const spacing = {
  xs: '0.25rem', // 4px
  sm: '0.5rem', // 8px
  md: '1rem', // 16px
  lg: '1.5rem', // 24px
  xl: '2rem', // 32px
  '2xl': '2.5rem', // 40px
  '3xl': '3rem', // 48px
  '4xl': '3.5rem', // 56px
  '5xl': '4rem', // 64px
};

// ============ TYPOGRAPHY ============
export const typography = {
  // Font Families
  fontFamily: {
    sans: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
  },
  // Font Sizes
  size: {
    xs: { size: '0.75rem', lineHeight: '1rem' }, // 12px
    sm: { size: '0.875rem', lineHeight: '1.25rem' }, // 14px
    base: { size: '1rem', lineHeight: '1.5rem' }, // 16px
    lg: { size: '1.125rem', lineHeight: '1.75rem' }, // 18px
    xl: { size: '1.25rem', lineHeight: '1.75rem' }, // 20px
    '2xl': { size: '1.5rem', lineHeight: '2rem' }, // 24px
    '3xl': { size: '1.875rem', lineHeight: '2.25rem' }, // 30px
    '4xl': { size: '2.25rem', lineHeight: '2.5rem' }, // 36px
    '5xl': { size: '3rem', lineHeight: '1.2' }, // 48px
  },
  // Font Weights
  weight: {
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },
};

// ============ SHADOWS ============
export const shadows = {
  none: 'none',
  xs: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  sm: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
  base: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  md: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  lg: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  xl: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  '2xl': 'inset 0 2px 4px 0 rgba(255, 255, 255, 0.05)',
  // Interactive
  hover: '0 10px 20px rgba(0, 0, 0, 0.08)',
  focus: '0 0 0 3px rgba(99, 102, 241, 0.1)',
};

// ============ TRANSITIONS ============
export const transitions = {
  fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
  normal: '200ms cubic-bezier(0.4, 0, 0.2, 1)',
  slow: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
  verySlow: '500ms cubic-bezier(0.4, 0, 0.2, 1)',
};

// ============ FRAMER MOTION VARIANTS ============
export const animationVariants = {
  // Container animations
  container: {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  },

  // Item animations
  item: {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: 'easeOut' },
    },
  },

  // Fade in
  fadeIn: {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.3 } },
  },

  // Scale in
  scaleIn: {
    hidden: { opacity: 0, scale: 0.95 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { duration: 0.3, ease: 'easeOut' },
    },
  },

  // Slide in from left
  slideInLeft: {
    hidden: { opacity: 0, x: -20 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.3, ease: 'easeOut' },
    },
  },

  // Slide in from right
  slideInRight: {
    hidden: { opacity: 0, x: 20 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.3, ease: 'easeOut' },
    },
  },

  // Slide in from bottom
  slideInBottom: {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.3, ease: 'easeOut' },
    },
  },

  // Hover effects
  hoverScale: {
    rest: { scale: 1 },
    hover: { scale: 1.02 },
  },

  hoverLift: {
    rest: { y: 0, boxShadow: 'none' },
    hover: { y: -4, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' },
  },

  // Tap effects
  tap: {
    tap: { scale: 0.98 },
  },

  // Loading pulse
  pulse: {
    scale: [1, 1.02, 1],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },

  // Shimmer effect for skeletons
  shimmer: {
    backgroundPosition: ['0% 0%', '100% 0%', '0% 0%'],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

// ============ RESPONSIVE BREAKPOINTS ============
export const breakpoints = {
  mobile: '0px',
  tablet: '768px',
  desktop: '1024px',
  wide: '1280px',
  ultra: '1536px',
};

// ============ Z-INDEX HIERARCHY ============
export const zIndex = {
  hide: -1,
  auto: 'auto',
  base: 0,
  dropdown: 1000,
  sticky: 1020,
  fixed: 1030,
  backdrop: 1040,
  modal: 1060,
  popover: 1070,
  tooltip: 1080,
};

// ============ UTILITY FUNCTIONS ============

export function generateGradient(color1: string, color2: string, angle = '135deg') {
  return `linear-gradient(${angle}, ${color1}, ${color2})`;
}

export function generateGlass(opacity = 0.8) {
  return `
    backdrop-filter: blur(10px);
    background: rgba(255, 255, 255, ${opacity});
    border: 1px solid rgba(255, 255, 255, 0.2);
  `;
}

export function generateElevation(level: number) {
  const shadowMap: { [key: number]: string } = {
    0: 'none',
    1: shadows.xs,
    2: shadows.sm,
    3: shadows.base,
    4: shadows.md,
    5: shadows.lg,
  };
  return shadowMap[Math.min(level, 5)] || shadows.xl;
}

// ============ RESPONSIVE UTILITIES ============
export const responsive = {
  // Responsive padding
  paddingResponsive: 'px-4 sm:px-6 md:px-8 lg:px-12',

  // Responsive grid
  gridResponsive: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4',

  // Responsive gap
  gapResponsive: 'gap-4 sm:gap-6 md:gap-8',

  // Responsive text
  headingResponsive: 'text-2xl sm:text-3xl md:text-4xl lg:text-5xl',
};

// ============ ACCESSIBILITY ============
export const accessibility = {
  focusRing: 'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500',
  srOnly: 'sr-only',
  ariaLabel: 'aria-label',
  role: 'role',
};

// ============ PREMIUM COLOR PALETTES ============
export const palettes = {
  primary: {
    bg: 'bg-gradient-to-br from-indigo-50 to-blue-50',
    border: 'border-indigo-200',
    text: 'text-indigo-900',
    icon: 'text-indigo-600',
  },
  success: {
    bg: 'bg-gradient-to-br from-green-50 to-emerald-50',
    border: 'border-green-200',
    text: 'text-green-900',
    icon: 'text-green-600',
  },
  warning: {
    bg: 'bg-gradient-to-br from-amber-50 to-orange-50',
    border: 'border-amber-200',
    text: 'text-amber-900',
    icon: 'text-amber-600',
  },
  error: {
    bg: 'bg-gradient-to-br from-red-50 to-rose-50',
    border: 'border-red-200',
    text: 'text-red-900',
    icon: 'text-red-600',
  },
};
