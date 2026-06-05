import type { Config } from 'tailwindcss';
import defaultTheme from 'tailwindcss/defaultTheme';

const config: Config = {
  darkMode: ['class'],
  content: [
    './components/**/*.{js,ts,jsx,tsx}',
    './app/**/*.{js,ts,jsx,tsx}',
    './lib/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', ...defaultTheme.fontFamily.sans],
        mono: ['var(--font-mono)', ...defaultTheme.fontFamily.mono],
      },
      // ============ COLORS ============
      colors: {
        // Semantic colors using CSS variables
        background: 'hsl(var(--color-background) / <alpha-value>)',
        foreground: 'hsl(var(--color-foreground) / <alpha-value>)',
        card: 'hsl(var(--color-card) / <alpha-value>)',
        'card-foreground': 'hsl(var(--color-card-foreground) / <alpha-value>)',
        muted: 'hsl(var(--color-muted) / <alpha-value>)',
        'muted-foreground': 'hsl(var(--color-muted-foreground) / <alpha-value>)',

        // Primary (Indigo AI Theme)
        primary: {
          50: 'hsl(var(--color-primary-50) / <alpha-value>)',
          100: 'hsl(var(--color-primary-100) / <alpha-value>)',
          500: 'hsl(var(--color-primary-500) / <alpha-value>)',
          600: 'hsl(var(--color-primary-600) / <alpha-value>)',
          700: 'hsl(var(--color-primary-700) / <alpha-value>)',
          900: 'hsl(var(--color-primary-900) / <alpha-value>)',
          DEFAULT: 'hsl(var(--color-primary-600) / <alpha-value>)',
        },

        // Secondary
        secondary: {
          50: 'hsl(var(--color-secondary-50) / <alpha-value>)',
          100: 'hsl(var(--color-secondary-100) / <alpha-value>)',
          500: 'hsl(var(--color-secondary-500) / <alpha-value>)',
          600: 'hsl(var(--color-secondary-600) / <alpha-value>)',
          DEFAULT: 'hsl(var(--color-secondary-600) / <alpha-value>)',
        },

        // Accent
        accent: {
          50: 'hsl(var(--color-accent-50) / <alpha-value>)',
          500: 'hsl(var(--color-accent-500) / <alpha-value>)',
          DEFAULT: 'hsl(var(--color-accent-500) / <alpha-value>)',
        },

        // Semantic States
        success: 'hsl(var(--color-success) / <alpha-value>)',
        warning: 'hsl(var(--color-warning) / <alpha-value>)',
        error: 'hsl(var(--color-error) / <alpha-value>)',
        info: 'hsl(var(--color-info) / <alpha-value>)',

        // Glass & Elevated
        glass: 'hsl(var(--color-glass) / <alpha-value>)',
        elevated: 'hsl(var(--color-elevated) / <alpha-value>)',

        // Border
        border: 'hsl(var(--color-border) / <alpha-value>)',
      },

      // ============ GRADIENTS ============
      backgroundImage: {
        'ai-gradient': 'linear-gradient(135deg, #6366F1, #8B5CF6, #06B6D4)',
        'ai-gradient-dark': 'linear-gradient(135deg, #4F46E5, #7C3AED, #06B6D4)',
        'success-gradient': 'linear-gradient(135deg, #10B981, #34D399)',
        'warning-gradient': 'linear-gradient(135deg, #F59E0B, #FBBF24)',
        'error-gradient': 'linear-gradient(135deg, #EF4444, #F87171)',
        'glass-gradient': 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))',
      },

      // ============ BORDER RADIUS ============
      borderRadius: {
        sm: '4px',
        base: '6px',
        lg: '8px',
        xl: '12px',
        '2xl': '16px',
        '3xl': '20px',
      },

      // ============ SHADOWS ============
      boxShadow: {
        // Minimal shadows for density
        xs: '0 1px 2px rgba(0, 0, 0, 0.05)',
        sm: '0 1px 2px rgba(0, 0, 0, 0.08)',
        base: '0 2px 4px rgba(0, 0, 0, 0.08)',
        md: '0 4px 6px rgba(0, 0, 0, 0.08)',
        // Glass card shadow (reduced)
        glass: '0 2px 8px rgba(31, 41, 55, 0.08), inset 0 1px 1px rgba(255, 255, 255, 0.2)',
        'glass-dark': '0 2px 8px rgba(0, 0, 0, 0.15), inset 0 1px 1px rgba(255, 255, 255, 0.1)',
        // Elevated card (reduced)
        elevated: '0 4px 12px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.03)',
        'elevated-dark': '0 4px 12px rgba(0, 0, 0, 0.2), 0 1px 2px rgba(0, 0, 0, 0.08)',
        // Soft shadow
        soft: '0 1px 2px rgba(0, 0, 0, 0.05)',
        'soft-dark': '0 1px 2px rgba(0, 0, 0, 0.15)',
      },

      // ============ BACKDROP BLUR ============
      backdropBlur: {
        glass: '20px',
        sm: '4px',
      },

      // ============ ANIMATIONS ============
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'slide-down': {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
        glow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(99, 102, 241, 0.25)' },
          '50%': { boxShadow: '0 0 30px rgba(99, 102, 241, 0.4)' },
        },
        // ============ ADVANCED ANIMATIONS ============
        'gradient-shift': {
          '0%': { backgroundPosition: '0% center' },
          '50%': { backgroundPosition: '100% center' },
          '100%': { backgroundPosition: '0% center' },
        },
        'neon-glow': {
          '0%, 100%': {
            textShadow: '0 0 10px rgba(99, 102, 241, 0.5), 0 0 20px rgba(139, 92, 246, 0.3)',
          },
          '50%': {
            textShadow: '0 0 20px rgba(99, 102, 241, 0.8), 0 0 40px rgba(139, 92, 246, 0.6)',
          },
        },
        'box-glow': {
          '0%, 100%': {
            boxShadow: '0 0 10px rgba(99, 102, 241, 0.3), inset 0 0 10px rgba(99, 102, 241, 0.1)',
          },
          '50%': {
            boxShadow: '0 0 30px rgba(99, 102, 241, 0.6), inset 0 0 20px rgba(99, 102, 241, 0.2)',
          },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'bounce-subtle': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
        'spin-slow': {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
        flip: {
          '0%': { transform: 'rotateY(0deg)' },
          '100%': { transform: 'rotateY(360deg)' },
        },
      },

      animation: {
        'fade-in': 'fade-in 0.3s ease-in-out',
        'slide-up': 'slide-up 0.3s ease-out',
        'slide-down': 'slide-down 0.3s ease-out',
        'pulse-soft': 'pulse-soft 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        shimmer: 'shimmer 2s infinite',
        glow: 'glow 2s ease-in-out infinite',
        'gradient-shift': 'gradient-shift 8s ease infinite',
        'neon-glow': 'neon-glow 2s ease-in-out infinite',
        'box-glow': 'box-glow 3s ease-in-out infinite',
        float: 'float 6s ease-in-out infinite',
        'bounce-subtle': 'bounce-subtle 2s ease-in-out infinite',
        'spin-slow': 'spin-slow 20s linear infinite',
        flip: 'flip 3s linear infinite',
      },

      // ============ TRANSITIONS & MOTION ============
      transitionTimingFunction: {
        'ai-ease': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
        'smooth-in': 'cubic-bezier(0.42, 0, 1, 1)',
        'smooth-out': 'cubic-bezier(0, 0, 0.58, 1)',
      },

      transitionDuration: {
        '200': '200ms',
        '300': '300ms',
        '400': '400ms',
        '500': '500ms',
      },

      // ============ SPACING ============
      spacing: {
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
        // Compact spacing for high-density layouts
        'dense-xs': '2px',
        'dense-sm': '4px',
        'dense-md': '6px',
        'dense-lg': '8px',
      },

      // ============ FONT SIZES ============
      fontSize: {
        xs: ['12px', { lineHeight: '16px' }],
        sm: ['13px', { lineHeight: '18px' }],
        base: ['14px', { lineHeight: '20px' }],
        lg: ['16px', { lineHeight: '24px' }],
        xl: ['18px', { lineHeight: '26px' }],
        '2xl': ['20px', { lineHeight: '28px' }],
        '3xl': ['24px', { lineHeight: '32px' }],
        '4xl': ['28px', { lineHeight: '36px' }],
        '5xl': ['32px', { lineHeight: '40px' }],
      },

      // ============ OPACITY ============
      opacity: {
        glass: '0.08',
        'glass-hover': '0.12',
      },
    },
  },

  plugins: [
    // Glass morphism plugin
    function ({ addComponents }: any) {
      addComponents({
        '.glass-card': {
          '@apply backdrop-blur-glass rounded-xl border border-white/10 bg-white/5 shadow-glass transition-all duration-300':
            {},
          '@apply dark:shadow-glass-dark dark:bg-white/[0.03]': {},
        },
        '.glass-card-hover': {
          '@apply hover:bg-white/10 hover:shadow-lg hover:border-white/20 dark:hover:bg-white/[0.08]':
            {},
        },
        '.ai-card': {
          '@apply relative rounded-xl border border-transparent bg-gradient-to-br from-primary-500/10 to-accent-500/10 p-6 shadow-soft transition-all duration-300':
            {},
          'background-clip': 'padding-box',
          'border-image': 'linear-gradient(135deg, #6366F1, #8B5CF6, #06B6D4) 1',
          '@apply dark:from-primary-500/5 dark:to-accent-500/5 dark:shadow-soft-dark': {},
        },
        '.ai-card-hover': {
          '@apply hover:shadow-ai-glow hover:dark:shadow-ai-glow-dark': {},
        },
        '.btn-ai': {
          '@apply relative inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-primary-600 to-accent-500 px-6 py-2.5 font-semibold text-white shadow-lg transition-all duration-200 hover:shadow-ai-glow hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed dark:from-primary-500 dark:to-accent-400':
            {},
        },
        '.btn-secondary': {
          '@apply inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 font-medium text-gray-900 transition-all duration-200 hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:hover:bg-gray-800':
            {},
        },
        '.btn-ghost': {
          '@apply inline-flex items-center justify-center rounded-lg px-4 py-2 font-medium text-gray-700 transition-all duration-200 hover:bg-gray-100 active:bg-gray-200 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-800':
            {},
        },
        '.chip': {
          '@apply inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700 dark:bg-primary-500/10 dark:text-primary-300':
            {},
        },
        '.chip-success': {
          '@apply bg-success/10 text-success dark:bg-success/20': {},
        },
        '.chip-warning': {
          '@apply bg-warning/10 text-warning dark:bg-warning/20': {},
        },
        '.chip-error': {
          '@apply bg-error/10 text-error dark:bg-error/20': {},
        },
        '.input-ai': {
          '@apply w-full rounded-lg border border-gray-200 bg-white px-4 py-2 font-medium text-gray-900 placeholder-gray-400 transition-all duration-200 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder-gray-500 dark:focus:border-primary-400':
            {},
        },
        '.input-ai-glass': {
          '@apply backdrop-blur-glass rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-white placeholder-white/50 transition-all duration-200 focus:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/20':
            {},
        },
        '.badge': {
          '@apply inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-300':
            {},
        },
        '.badge-ai': {
          '@apply bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300': {},
        },
        '.skeleton-shimmer': {
          'background-size': '1000px 100%',
          '@apply animate-shimmer rounded bg-gradient-to-r from-gray-200 via-white to-gray-200 dark:from-gray-700 dark:via-gray-800 dark:to-gray-700':
            {},
        },
      });
    },
  ],
};

export default config;
