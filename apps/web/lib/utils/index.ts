/**
 * Utilities Index
 * Aggregated exports for design system and utility functions
 * Premium UI Design System - Stripe + Apple + Linear quality
 */

// ============ DESIGN SYSTEM ============
export {
  colors,
  spacing,
  typography,
  shadows,
  transitions,
  animationVariants,
  zIndex,
  generateGradient,
  generateGlass,
  generateElevation,
  accessibility,
  palettes,
} from './designSystem';

// ============ ANIMATIONS ============
export {
  pageTransitionVariants,
  pageSlideLeftVariants,
  pageSlideRightVariants,
  staggerContainerVariants,
  staggerItemVariants,
  staggerGridVariants,
  staggerGridItemVariants,
  fadeInVariants,
  slideInLeftVariants,
  slideInRightVariants,
  slideInTopVariants,
  slideInBottomVariants,
  scaleInVariants,
  popInVariants,
  hoverLiftVariants,
  hoverScaleVariants,
  hoverGlowVariants,
  pulseVariants,
  shimmerVariants,
  rotateVariants,
  bounceVariants,
  backdropVariants,
  modalVariants,
  drawerSlideVariants,
  typewriterVariants,
  typewriterCharacterVariants,
  timelineItemVariants,
  timelineLineVariants,
  tabPanelVariants,
  accordionContentVariants,
  delayBy,
  springConfig,
  transitionTiming,
} from '../animations/animationVariants';

// ============ RESPONSIVE ============
export {
  breakpoints,
  breakpointKeys,
  responsivePadding,
  responsiveGap,
  responsiveGrid,
  responsiveText,
  responsiveHeight,
  responsiveContainer,
  responsiveFlex,
  responsiveTextAlign,
  responsiveDisplay,
  touchTargetSize,
  responsiveButtonSize,
  responsiveTouchSpacing,
  mediaQueries,
  responsiveCardGrid,
  responsiveImageContainer,
  responsiveModalSize,
  responsiveNavigation,
  aspectRatios,
  containerQueries,
  breakpointHook,
  responsiveLayoutPatterns,
  responsiveTablePattern,
  responsiveFormPattern,
  responsiveCenter,
  responsiveFullWidth,
} from './responsiveUtils';

// ============ ACCESSIBILITY ============
export {
  ariaLabels,
  ariaRoles,
  ariaLive,
  ariaAttributes,
  colorContrast,
  contrastPairs,
  focusStyles,
  focusTrap,
  keyboardShortcuts,
  handleKeyboardEvent,
  srOnly,
  srOnlyClasses,
  skipToMainLink,
  liveRegionAnnouncements,
  semanticHTML,
  wcagChecklist,
  a11yTestingChecklist,
} from './a11yUtils';

// ============ CLASS UTILITIES ============
export { cn, variants, sizes, compose, conditional, guard, dataAttr, states } from './cn';

// ============ THEME UTILITIES ============
export {
  getThemePreference,
  getEffectiveTheme,
  setThemePreference,
  toggleTheme,
  getRoleColors,
  setUserRole,
  getUserRole,
  initializeTheme,
  getRoleColor,
  themeClasses,
  getThemeAttribute,
  componentTheme,
  getRoleGradient,
  getContrastColor,
  getRoleStyles,
  onThemeChange,
  ROLES,
  THEMES,
  DEFAULT_THEME_CONFIG,
  applyTheme,
} from './theme';

export type { Theme, UserRole, ThemeConfig } from './theme';

// ============ TYPE EXPORTS ============
export type { Breakpoint } from './responsiveUtils';

/**
 * Common utility combinations
 */
export const designSystemPresets = {
  // Card shadows at different elevation levels
  cardElevation: {
    flat: 'shadow-xs',
    elevated: 'shadow-md',
    modal: 'shadow-2xl',
  },

  // Button focus states
  buttonFocusStates: {
    default: 'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500',
    alt: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500',
  },

  // Container sizes for layout patterns
  containerSizes: {
    narrow: 'max-w-xs',
    normal: 'max-w-sm',
    wide: 'max-w-2xl',
    full: 'max-w-full',
  },

  // Gradient backgrounds
  gradients: {
    subtle: 'bg-gradient-to-br from-indigo-50 to-blue-50',
    brand: 'bg-gradient-to-r from-indigo-600 to-blue-600',
    dark: 'bg-gradient-to-br from-slate-900 to-slate-800',
    success: 'bg-gradient-to-r from-green-500 to-emerald-600',
    warning: 'bg-gradient-to-r from-amber-500 to-orange-600',
    error: 'bg-gradient-to-r from-red-500 to-rose-600',
  },

  // Typography stacks
  typeScales: {
    hero: 'text-5xl md:text-6xl font-bold',
    display: 'text-4xl md:text-5xl font-bold',
    title: 'text-2xl md:text-3xl font-bold',
    heading: 'text-xl md:text-2xl font-semibold',
    subheading: 'text-lg font-semibold',
    body: 'text-base',
    small: 'text-sm',
    xs: 'text-xs',
  },

  // Spacing stacks
  spacingStacks: {
    tight: 'space-y-2',
    normal: 'space-y-4',
    loose: 'space-y-6',
    relaxed: 'space-y-8',
  },
};

/**
 * Premium animation presets
 */
export const animationPresets = {
  // Quick animations for micro-interactions
  quick: {
    scale: 'transition-transform duration-150 ease-out',
    opacity: 'transition-opacity duration-150 ease-out',
  },

  // Medium animations for UI transitions
  medium: {
    all: 'transition-all duration-300 ease-out',
    transform: 'transition-transform duration-300 ease-out',
  },

  // Smooth animations for page transitions
  smooth: {
    all: 'transition-all duration-500 ease-out',
    opacity: 'transition-opacity duration-500 ease-out',
  },
};

/**
 * Common component utility combinations
 */
export const componentUtilities = {
  // For creating hover lift effect
  hoverLift: 'transition-all duration-300 hover:shadow-lg hover:-translate-y-1',

  // For interactive buttons
  interactiveButton:
    'transition-all duration-200 active:scale-95 focus-visible:ring-2 focus-visible:ring-offset-2',

  // For form inputs
  formInput:
    'px-4 py-2.5 border border-slate-300 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',

  // For card containers
  cardContainer: 'rounded-2xl bg-white shadow-md hover:shadow-lg transition-shadow duration-300',

  // For modal backdrops
  modalBackdrop: 'fixed inset-0 bg-black/50 backdrop-blur-sm',

  // For loading states
  loadingSpinner: 'animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600',

  // For text truncation
  truncateText: 'truncate',
  multilineTruncate: 'line-clamp-2',

  // For screen reader only
  srOnly: 'sr-only',
};

/**
 * Responsive pattern combinations
 */
export const layoutPatterns = {
  // Container with responsive padding
  container: 'w-full px-4 sm:px-6 md:px-8 lg:px-12 mx-auto',

  // Grid with responsive columns
  grid: 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 md:gap-8',

  // Flex with responsive direction
  flexReverse: 'flex flex-col-reverse md:flex-row gap-4 md:gap-8',

  // Hero section
  hero: 'relative min-h-screen flex items-center justify-center px-4 sm:px-6 md:px-8',

  // Two-column layout
  twoColumn: 'grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8',

  // Three-column layout
  threeColumn: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8',

  // Sidebar layout
  sidebar: 'flex flex-col md:flex-row gap-6 md:gap-8',
};
