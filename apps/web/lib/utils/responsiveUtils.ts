/**
 * Responsive Design Utilities
 * Mobile-first responsive patterns and helpers
 * Stripe + Apple + Linear quality standards
 */

// ============ BREAKPOINTS ============
export const breakpoints = {
  mobile: 0,
  tablet: 768,
  desktop: 1024,
  wide: 1280,
  ultra: 1536,
} as const;

export const breakpointKeys = ['mobile', 'tablet', 'desktop', 'wide', 'ultra'] as const;

export type Breakpoint = keyof typeof breakpoints;

// ============ RESPONSIVE UTILITIES ============

/**
 * Responsive padding - mobile-first
 * Small padding on mobile, increasing on larger screens
 */
export const responsivePadding = {
  tight: 'px-3 sm:px-4 md:px-6 lg:px-8',
  normal: 'px-4 sm:px-6 md:px-8 lg:px-12',
  loose: 'px-6 sm:px-8 md:px-12 lg:px-16',
  page: 'px-4 sm:px-6 md:px-8 xl:px-12',
};

/**
 * Responsive gap - mobile-first
 */
export const responsiveGap = {
  xs: 'gap-2 sm:gap-3 md:gap-4',
  sm: 'gap-3 sm:gap-4 md:gap-6',
  md: 'gap-4 sm:gap-6 md:gap-8',
  lg: 'gap-6 sm:gap-8 md:gap-12',
};

/**
 * Responsive grid layouts
 */
export const responsiveGrid = {
  'cols-1': 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
  'cols-2': 'grid-cols-1 sm:grid-cols-2 md:grid-cols-4',
  'cols-auto': 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  'cols-fill': 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5',
};

/**
 * Responsive typography - mobile-first
 */
export const responsiveText = {
  h1: 'text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold',
  h2: 'text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold',
  h3: 'text-xl sm:text-2xl md:text-3xl font-bold',
  h4: 'text-lg sm:text-xl md:text-2xl font-semibold',
  body: 'text-sm sm:text-base md:text-lg',
  small: 'text-xs sm:text-sm',
};

/**
 * Responsive height
 */
export const responsiveHeight = {
  hero: 'h-96 sm:h-[500px] md:h-screen',
  tall: 'h-80 sm:h-96 md:h-screen',
  medium: 'h-60 sm:h-72 md:h-96',
  short: 'h-40 sm:h-48 md:h-56',
};

/**
 * Responsive width containers
 */
export const responsiveContainer = {
  tight: 'w-full sm:max-w-sm md:max-w-md lg:max-w-lg',
  normal: 'w-full sm:max-w-2xl md:max-w-3xl lg:max-w-4xl',
  wide: 'w-full sm:max-w-3xl md:max-w-5xl lg:max-w-6xl',
  full: 'w-full',
};

/**
 * Responsive flex direction
 */
export const responsiveFlex = {
  colReverse: 'flex-col-reverse md:flex-row',
  col: 'flex-col md:flex-row',
  row: 'flex-col sm:flex-row',
};

/**
 * Responsive text alignment
 */
export const responsiveTextAlign = {
  center: 'text-center md:text-left',
  right: 'text-right md:text-left',
  justify: 'text-center md:text-justify',
};

/**
 * Responsive display
 */
export const responsiveDisplay = {
  hiddenMobile: 'hidden md:block',
  hiddenDesktop: 'md:hidden',
  mobileOnly: 'md:hidden',
  desktopOnly: 'hidden md:block',
};

// ============ MOBILE-FIRST TOUCH TARGETS ============

/**
 * Minimum touch target size (48x48px for mobile)
 */
export const touchTargetSize = 'w-12 h-12'; // 48x48px

/**
 * Responsive button sizes with touch targets
 */
export const responsiveButtonSize = {
  compact: 'px-3 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm',
  normal: 'px-4 py-2.5 text-sm sm:px-6 sm:py-3 sm:text-base',
  large: 'px-6 py-3 text-base sm:px-8 sm:py-4 sm:text-lg',
};

/**
 * Responsive spacing for touch-friendly interactions
 */
export const responsiveTouchSpacing = {
  compact: 'p-2 sm:p-3 md:p-4',
  normal: 'p-3 sm:p-4 md:p-6',
  comfortable: 'p-4 sm:p-6 md:p-8',
};

// ============ RESPONSIVE MEDIA QUERIES (CSS) ============

export const mediaQueries = {
  mobile: '@media (max-width: 767px)',
  tablet: '@media (min-width: 768px) and (max-width: 1023px)',
  desktop: '@media (min-width: 1024px)',
  wide: '@media (min-width: 1280px)',
  ultra: '@media (min-width: 1536px)',
  notMobile: '@media (min-width: 768px)',
  notDesktop: '@media (max-width: 1023px)',
  landscape: '@media (orientation: landscape)',
  portrait: '@media (orientation: portrait)',
  touchDevice: '@media (hover: none) and (pointer: coarse)',
  pointerDevice: '@media (hover: hover) and (pointer: fine)',
};

// ============ RESPONSIVE UTILITIES FOR SPECIFIC COMPONENTS ============

/**
 * Responsive card grid for product listings
 */
export const responsiveCardGrid = {
  '1Col': 'grid-cols-1',
  '2Col': 'grid-cols-1 sm:grid-cols-2',
  '3Col': 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  '4Col': 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
  auto: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5',
};

/**
 * Responsive image container (for proper aspect ratios)
 */
export const responsiveImageContainer = {
  square: 'aspect-square',
  video: 'aspect-video',
  portrait: 'aspect-[3/4]',
  landscape: 'aspect-[16/9]',
};

/**
 * Responsive modal sizes
 */
export const responsiveModalSize = {
  sm: 'w-full max-w-sm mx-4 sm:mx-0',
  md: 'w-full max-w-md mx-4 sm:mx-0',
  lg: 'w-full max-w-lg mx-4 sm:mx-0',
  xl: 'w-full max-w-2xl mx-4 sm:mx-0',
  full: 'w-full h-full',
};

/**
 * Responsive navigation
 */
export const responsiveNavigation = {
  mobile: 'fixed bottom-0 left-0 right-0 md:relative md:bottom-auto',
  sticky: 'sticky top-0 z-30',
  drawer: 'w-full max-w-xs h-full',
};

// ============ RESPONSIVE ASPECT RATIOS ============

export const aspectRatios = {
  '1/1': 'aspect-square',
  '4/3': 'aspect-[4/3]',
  '16/9': 'aspect-video',
  '3/4': 'aspect-[3/4]',
  '2/3': 'aspect-[2/3]',
  '21/9': 'aspect-[21/9]',
};

// ============ CONTAINER QUERIES (For Newer Approach) ============

/**
 * Container query utilities for component-level responsiveness
 * Note: Requires support for @container in Tailwind
 */
export const containerQueries = {
  '@sm': '@container (min-width: 300px)',
  '@md': '@container (min-width: 500px)',
  '@lg': '@container (min-width: 700px)',
  '@xl': '@container (min-width: 900px)',
};

// ============ RESPONSIVE HOOKS (TypeScript) ============

/**
 * Hook to get current breakpoint
 * Usage: const breakpoint = useBreakpoint();
 */
export const breakpointHook = `
import { useEffect, useState } from 'react';

export function useBreakpoint() {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>('mobile');

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      
      if (width < 768) setBreakpoint('mobile');
      else if (width < 1024) setBreakpoint('tablet');
      else if (width < 1280) setBreakpoint('desktop');
      else if (width < 1536) setBreakpoint('wide');
      else setBreakpoint('ultra');
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return breakpoint;
}
`;

// ============ RESPONSIVE COMPONENT PATTERNS ============

/**
 * Pattern for responsive sidebar layout
 */
export const responsiveLayoutPatterns = {
  sidebarLayout: 'flex flex-col md:flex-row gap-4 md:gap-8',
  sidebarNav: 'w-full md:w-48 lg:w-64',
  sidebarContent: 'flex-1 min-w-0',
};

/**
 * Pattern for responsive table layout (cards on mobile)
 */
export const responsiveTablePattern = {
  wrapper: 'w-full overflow-x-auto block sm:table',
  row: 'block sm:table-row',
  cell: 'block sm:table-cell',
};

/**
 * Pattern for responsive form layout
 */
export const responsiveFormPattern = {
  form: 'space-y-4 sm:space-y-6',
  row: 'grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4',
  fullWidth: 'col-span-1 sm:col-span-2',
};

/**
 * Utility for centering on mobile, aligning on desktop
 */
export const responsiveCenter = 'text-center sm:text-left';

/**
 * Utility for full-width on mobile
 */
export const responsiveFullWidth = 'w-full sm:w-auto';
