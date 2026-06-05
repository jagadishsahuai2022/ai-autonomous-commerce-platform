/**
 * Accessibility Utilities
 * WCAG 2.1 Level AA compliance utilities
 * Aria labels, keyboard navigation, focus management
 */

// ============ ARIA ATTRIBUTES ============

export const ariaLabels = {
  close: 'Close',
  menu: 'Toggle menu',
  search: 'Search',
  submit: 'Submit',
  login: 'Login',
  logout: 'Logout',
  profile: 'User profile',
  settings: 'Settings',
  back: 'Go back',
  next: 'Next',
  previous: 'Previous',
};

/**
 * Common ARIA roles
 */
export const ariaRoles = {
  button: 'button',
  link: 'link',
  dialog: 'dialog',
  alert: 'alert',
  status: 'status',
  progressbar: 'progressbar',
  tab: 'tab',
  tablist: 'tablist',
  tabpanel: 'tabpanel',
  navigation: 'navigation',
  main: 'main',
  contentinfo: 'contentinfo',
  complementary: 'complementary',
  region: 'region',
  img: 'img',
  presentation: 'presentation',
};

/**
 * ARIA live regions
 */
export const ariaLive = {
  polite: 'polite', // Announces updates when user is idle
  assertive: 'assertive', // Interrupts user immediately
  off: 'off',
};

/**
 * Common ARIA attributes for components
 */
export const ariaAttributes = {
  // For buttons
  buttonLabel: (label: string) => ({
    'aria-label': label,
    role: 'button',
  }),

  // For links
  linkLabel: (label: string) => ({
    'aria-label': label,
    role: 'link',
  }),

  // For modals
  modal: (labelledBy: string, describedBy?: string) => ({
    role: 'dialog',
    'aria-modal': true,
    'aria-labelledby': labelledBy,
    ...(describedBy && { 'aria-describedby': describedBy }),
  }),

  // For forms
  formField: (label: string, required: boolean = false) => ({
    'aria-label': label,
    ...(required && { 'aria-required': true, required: true }),
  }),

  // For status messages
  status: (message: string) => ({
    role: 'status',
    'aria-live': 'polite',
    'aria-atomic': true,
  }),

  // For loading states
  loading: () => ({
    role: 'status',
    'aria-live': 'polite',
    'aria-busy': true,
  }),

  // For disabled elements
  disabled: (reason?: string) => ({
    'aria-disabled': true,
    ...(reason && { 'aria-label': reason }),
  }),

  // For expandable sections
  expandable: (isExpanded: boolean, controlId: string) => ({
    'aria-expanded': isExpanded,
    'aria-controls': controlId,
  }),

  // For tabs
  tab: (isSelected: boolean, panelId: string) => ({
    role: 'tab',
    'aria-selected': isSelected,
    'aria-controls': panelId,
  }),

  // For images
  image: (alt: string) => ({
    role: 'img',
    alt,
  }),

  // For decorative images
  decorativeImage: () => ({
    role: 'presentation',
    alt: '',
    'aria-hidden': true,
  }),
};

// ============ COLOR CONTRAST UTILITIES ============

/**
 * WCAG 2.1 color contrast ratios
 * AA: 4.5:1 for normal text, 3:1 for large text
 * AAA: 7:1 for normal text, 4.5:1 for large text
 */
export const colorContrast = {
  // Primary text on white
  primaryOnWhite: 'text-slate-900', // High contrast
  secondaryOnWhite: 'text-slate-700', // AA compliant
  tertiaryOnWhite: 'text-slate-600', // AA compliant

  // White text on primary
  whiteOnPrimary: 'text-white',
  whiteOnDark: 'text-white',

  // Link colors
  link: 'text-blue-600 hover:text-blue-800', // AA compliant
  visitedLink: 'text-purple-600',

  // Success, warning, error colors
  success: 'text-green-700', // AA compliant
  warning: 'text-amber-700', // AA compliant
  error: 'text-red-700', // AA compliant
  info: 'text-blue-700', // AA compliant
};

/**
 * Background/foreground contrast pairs (WCAG AA)
 */
export const contrastPairs = {
  primary: {
    bg: 'bg-indigo-600',
    text: 'text-white',
    link: 'text-blue-100 hover:text-white underline',
  },
  secondary: {
    bg: 'bg-slate-100',
    text: 'text-slate-900',
    link: 'text-blue-600 hover:text-blue-800 underline',
  },
  success: {
    bg: 'bg-green-100',
    text: 'text-green-900',
    link: 'text-green-700 hover:text-green-900 underline',
  },
  error: {
    bg: 'bg-red-100',
    text: 'text-red-900',
    link: 'text-red-700 hover:text-red-900 underline',
  },
};

// ============ FOCUS MANAGEMENT ============

export const focusStyles = {
  // Standard focus ring (WCAG recommendation)
  ring: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500',

  // Alternative focus ring colors
  ringPrimary:
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-600',
  ringError:
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-red-600',

  // Button focus styles
  buttonFocus:
    'focus-visible:outline-none focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-blue-500',

  // Visible focus indicator (always visible)
  visibleFocus: 'outline-2 outline-offset-2 outline-blue-500',
};

/**
 * Focus trap utilities
 */
export const focusTrap = {
  // Attribute to mark element as part of focus trap
  root: 'data-focus-trap="root"',

  // Get focusable elements within container
  focusCaptureElements: `
    a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), 
    textarea:not([disabled]), [tabindex]:not([tabindex="-1"])
  `,

  // Hook implementation
  useFocusTrap: `
    import { useEffect, useRef } from 'react';

    export function useFocusTrap() {
      const containerRef = useRef<HTMLDivElement>(null);

      useEffect(() => {
        if (!containerRef.current) return;

        const handleKeyDown = (e: KeyboardEvent) => {
          if (e.key !== 'Tab') return;

          const focusableElements = containerRef.current?.querySelectorAll(
            'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
          );

          if (!focusableElements?.length) return;

          const firstElement = focusableElements[0] as HTMLElement;
          const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

          if (e.shiftKey) {
            if (document.activeElement === firstElement) {
              e.preventDefault();
              lastElement.focus();
            }
          } else {
            if (document.activeElement === lastElement) {
              e.preventDefault();
              firstElement.focus();
            }
          }
        };

        containerRef.current?.addEventListener('keydown', handleKeyDown);
        return () => containerRef.current?.removeEventListener('keydown', handleKeyDown);
      }, []);

      return containerRef;
    }
  `,
};

// ============ KEYBOARD NAVIGATION ============

export const keyboardShortcuts = {
  escape: {
    key: 'Escape',
    description: 'Close dialog or menu',
  },
  enter: {
    key: 'Enter',
    description: 'Confirm action',
  },
  space: {
    key: ' ',
    description: 'Toggle or activate',
  },
  tab: {
    key: 'Tab',
    description: 'Move to next element',
  },
  shiftTab: {
    key: 'Shift+Tab',
    description: 'Move to previous element',
  },
  arrowUp: {
    key: 'ArrowUp',
    description: 'Move up',
  },
  arrowDown: {
    key: 'ArrowDown',
    description: 'Move down',
  },
  arrowLeft: {
    key: 'ArrowLeft',
    description: 'Move left',
  },
  arrowRight: {
    key: 'ArrowRight',
    description: 'Move right',
  },
  home: {
    key: 'Home',
    description: 'Go to start',
  },
  end: {
    key: 'End',
    description: 'Go to end',
  },
};

/**
 * Handle common keyboard events
 */
export const handleKeyboardEvent = {
  isEscape: (key: string) => key === 'Escape',
  isEnter: (key: string) => key === 'Enter',
  isSpace: (key: string) => key === ' ',
  isTab: (key: string) => key === 'Tab',
  isArrow: (key: string) => ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key),
  isArrowUp: (key: string) => key === 'ArrowUp',
  isArrowDown: (key: string) => key === 'ArrowDown',
  isArrowLeft: (key: string) => key === 'ArrowLeft',
  isArrowRight: (key: string) => key === 'ArrowRight',
};

// ============ SCREEN READER UTILITIES ============

/**
 * Screen reader only text (Sr-only)
 */
export const srOnly = 'sr-only';

export const srOnlyClasses = {
  wrapper: 'absolute -inset-0.5 -z-10 opacity-0 w-0 h-0 overflow-hidden',
  inline: 'sr-only',
};

/**
 * Skip to main content link
 */
export const skipToMainLink = `
<a href="#main-content" className="sr-only focus:not-sr-only">
  Skip to main content
</a>
`;

/**
 * Live region announcements
 */
export const liveRegionAnnouncements = {
  loading: 'Loading content...',
  success: 'Action completed successfully',
  error: 'An error occurred. Please try again.',
  formError: 'Please fix the errors below',
  itemAdded: 'Item added to cart',
  itemRemoved: 'Item removed from cart',
  copied: 'Copied to clipboard',
  saved: 'Changes saved',
};

// ============ SEMANTIC HTML ============

/**
 * Semantic HTML elements for better accessibility
 */
export const semanticHTML = {
  // Use <button> instead of <div onclick>
  button: '<button type="button">Action</button>',

  // Use <a> with proper href
  link: '<a href="/path">Link</a>',

  // Use <label> for form inputs
  formField: '<label htmlFor="input-id">Label</label><input id="input-id" />',

  // Use heading hierarchy (h1 > h2 > h3)
  headingHierarchy: '<h1>Page Title</h1><h2>Section</h2><h3>Subsection</h3>',

  // Use <main> for main content
  mainContent: '<main id="main-content">...</main>',

  // Use <nav> for navigation
  navigation: '<nav aria-label="Main navigation">...</nav>',

  // Use <section> with proper heading
  section: '<section><h2>Section Title</h2>...</section>',

  // Use <article> for independent content
  article: '<article>...</article>',

  // Use <aside> for related content
  aside: '<aside aria-label="Related information">...</aside>',

  // Use <footer> for page footer
  footer: '<footer>...</footer>',

  // Use <form> for forms
  form: '<form onSubmit={handleSubmit}>...</form>',

  // Use <ul> for lists
  unorderedList: '<ul><li>Item 1</li><li>Item 2</li></ul>',

  // Use <ol> for ordered lists
  orderedList: '<ol><li>First</li><li>Second</li></ol>',

  // Use <table> with proper structure
  table: '<table><thead><tr><th>Header</th></tr></thead><tbody>...</tbody></table>',
};

// ============ WCAG 2.1 CHECKLIST ============

export const wcagChecklist = {
  perception: [
    'Provide text alternatives for images (alt text)',
    'Provide captions for videos',
    'Use sufficient color contrast (4.5:1 for normal, 3:1 for large)',
    'Allow text resizing without loss of functionality',
  ],
  operation: [
    'Make all functionality keyboard accessible',
    'Allow users 3 attempts for time-limited content',
    'Avoid content that flashes more than 3 times per second',
    'Provide skip links for repeated content',
  ],
  understandable: [
    'Use clear and simple language',
    'Use heading hierarchy properly',
    'Label all form inputs',
    'Provide error messages and suggestions for correction',
  ],
  robust: [
    'Use valid HTML and ARIA',
    'Support assistive technologies',
    'Use semantic HTML elements',
    'Test with screen readers',
  ],
};

// ============ TESTING UTILITIES ============

/**
 * Quick checklist for accessibility testing
 */
export const a11yTestingChecklist = [
  'Tab through all interactive elements in order',
  'Verify focus is visible',
  'Test with keyboard only (no mouse)',
  'Check color contrast with tool (WebAIM, WAVE)',
  'Test with screen reader (NVDA, JAWS, VoiceOver)',
  'Verify alert/status messages are announced',
  'Check image alt text',
  'Verify form labels and error messages',
  'Test modal focus trap',
  'Check for skip links',
  'Verify heading hierarchy',
  'Test responsive text resizing',
];
