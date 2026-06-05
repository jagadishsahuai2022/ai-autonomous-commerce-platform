/\*\*

- DESIGN SYSTEM TOKEN REFERENCE
- Complete guide to all available design tokens and utilities
-
- Generated: DelegateCart v1.0
- Tech Stack: Next.js, Tailwind CSS, TypeScript
  \*/

// ============================================================================
// COLORS - CSS VARIABLE TOKENS
// ============================================================================

/\*\*

- PRIMARY COLORS (Indigo AI Theme)
-
- Light Mode:
- - primary-50: #EEF2FF (very light indigo)
- - primary-100: #E0E7FF (light indigo)
- - primary-500: #6366F1 (medium indigo)
- - primary-600: #4F46E5 (indigo - DEFAULT)
- - primary-700: #4338CA (dark indigo)
- - primary-900: #1E1B4B (very dark indigo)
    \*/

// Usage:
// <div className="bg-primary-600 text-primary-50">Primary button</div>
// <div style={{ color: 'hsl(var(--color-primary-600))' }}>Dynamic color</div>

/\*\*

- SECONDARY COLORS (Grays)
-
- - secondary-50: Very light gray (#f9fafb)
- - secondary-100: Light gray (#f3f4f6)
- - secondary-500: Medium gray (#6b7280)
- - secondary-600: Dark gray (#4b5563)
    \*/

// Usage:
// <div className="bg-secondary-50">Light background</div>

/\*\*

- ACCENT COLORS (Cyan/Turquoise)
-
- - accent-50: Very light cyan
- - accent-500: Cyan (#06B6D4)
    \*/

// Usage:
// <div className="text-accent-500">Accent text</div>

/\*\*

- SEMANTIC COLORS
-
- - success: #10B981 (green)
- - warning: #F59E0B (amber)
- - error: #EF4444 (red)
- - info: #3B82F6 (blue)
    \*/

// Usage:
// <div className="bg-success/10 text-success">Success message</div>
// <div className="bg-error/10 text-error">Error message</div>

/\*\*

- SEMANTIC BACKGROUNDS
-
- - background: Main page background
- - foreground: Text on background
- - card: Card background
- - card-foreground: Text on card
- - muted: Neutral accent color
- - muted-foreground: Muted text
- - border: Border color
- - glass: Glass morphism background
- - elevated: Elevated card background
    \*/

// Use semantic colors for better accessibility:
// <div className="bg-background text-foreground">Semantic</div>

// ============================================================================
// GRADIENTS (BACKGROUND-IMAGE)
// ============================================================================

/\*\*

- PRE-BUILT GRADIENTS
  \*/

// AI Gradient (brand gradient - indigo to cyan)
// <div className="bg-ai-gradient">AI feature</div>

// AI Gradient Dark (darker variant for dark mode)
// <div className="bg-ai-gradient-dark dark:visible">Dark mode</div>

// Success Gradient (green)
// <div className="bg-success-gradient">Success state</div>

// Warning Gradient (amber)
// <div className="bg-warning-gradient">Warning state</div>

// Error Gradient (red)
// <div className="bg-error-gradient">Error state</div>

// Glass Gradient (subtle translucent)
// <div className="bg-glass-gradient rounded-lg">Glass card</div>

// ============================================================================
// SHADOWS (BOX-SHADOW)
// ============================================================================

/\*\*

- SHADOW TOKENS
  \*/

// Glass shadow (subtle with inset highlight)
// <div className="shadow-glass">Glass card</div>

// Glass shadow dark (for dark mode)
// <div className="dark:shadow-glass-dark">Dark glass</div>

// Elevated shadow (prominent card shadow)
// <div className="shadow-elevated">Elevated card</div>

// Elevated shadow dark
// <div className="dark:shadow-elevated-dark">Dark elevated</div>

// AI Glow (brand-specific glow effect)
// <div className="shadow-ai-glow">Glowing element</div>

// AI Glow dark
// <div className="dark:shadow-ai-glow-dark">Dark glow</div>

// Soft shadow (minimal, subtle)
// <div className="shadow-soft">Soft shadow</div>

// Soft shadow dark
// <div className="dark:shadow-soft-dark">Dark soft</div>

// ============================================================================
// BORDER RADIUS
// ============================================================================

/\*\*

- ROUNDED CORNERS
-
- - rounded-lg: 16px (default cards)
- - rounded-xl: 20px (prominent cards)
- - rounded-2xl: 24px (hero sections)
- - rounded-3xl: 32px (large elements)
    \*/

// Usage:
// <div className="rounded-lg">Card with 16px radius</div>
// <div className="rounded-xl">Prominent card</div>

// ============================================================================
// ANIMATIONS
// ============================================================================

/\*\*

- ANIMATION TOKENS
  \*/

// Fade in (opacity transition)
// - Duration: 300ms
// - Easing: ease-in-out
// <div className="animate-fade-in">Fade in</div>

// Slide up (vertical enter)
// - Duration: 300ms
// - Easing: ease-out
// <div className="animate-slide-up">Slide up</div>

// Slide down (vertical exit)
// - Duration: 300ms
// - Easing: ease-out
// <div className="animate-slide-down">Slide down</div>

// Pulse soft (gentle pulsing - AI thinking indicator)
// - Duration: 2s
// - Infinite loop
// <div className="animate-pulse-soft">AI thinking...</div>

// Shimmer (skeleton loading animation)
// - Duration: 2s
// - Infinite loop
// <div className="skeleton-shimmer h-32 w-full">Loading...</div>

// Glow (breathing glow effect)
// - Duration: 2s
// - Infinite loop
// <div className="animate-glow">Glowing effect</div>

// ============================================================================
// BACKDROP BLUR
// ============================================================================

/\*\*

- BLUR EFFECTS
  \*/

// Glass blur (20px - heavy blur for glass morphism)
// <div className="backdrop-blur-glass">Glass container</div>

// Small blur (4px - subtle blur)
// <div className="backdrop-blur-sm">Subtle blur</div>

// ============================================================================
// BASE COMPONENT CLASSES (@layer components)
// ============================================================================

/\*\*

- BUTTONS
  \*/

// AI Primary Button (gradient, shadow, hover effects)
// <button className="btn-ai">Click me</button>
// - Background: Gradient from primary to accent
// - Hover: Scale up 105%, enhanced shadow
// - Active: Scale down to 95%
// - Disabled: 50% opacity

// Secondary Button (outlined style)
// <button className="btn-secondary">Secondary</button>
// - Background: White (light mode), gray-800 (dark mode)
// - Border: Gray-300 (light), gray-600 (dark)
// - Hover: Lighter background

// Ghost Button (minimal, text only)
// <button className="btn-ghost">Ghost</button>
// - No background
// - Hover: Subtle background
// - Padding: px-4 py-2

/\*\*

- CARDS
  \*/

// Glass Card (glassmorphism style)
// <div className="glass-card">Glass card</div>
// - Background: white/5 or white/10
// - Border: white/10 or white/20
// - Blur: 20px backdrop blur
// - Shadow: Inset + outer shadows

// Glass Card Hover (interactive glass)
// <div className="glass-card glass-card-hover">Interactive</div>
// - Hover: Brighter background, stronger border

// AI Card (gradient border effect)
// <div className="ai-card">AI Feature</div>
// - Background: Gradient overlay
// - Border: Transparent (uses gradient)
// - Suitable for AI features

// AI Card Hover
// <div className="ai-card ai-card-hover">Hover AI</div>
// - Hover: AI glow shadow

/\*\*

- CHIPS & BADGES
  \*/

// Chip (small tag/label)
// <span className="chip">New Feature</span>
// - Background: primary-50 (light), primary-500/10 (dark)
// - Rounded: full (pill shape)
// - Padding: px-3 py-1

// Chip Success
// <span className="chip chip-success">Live</span>

// Chip Warning
// <span className="chip chip-warning">Pending</span>

// Chip Error
// <span className="chip chip-error">Failed</span>

// Badge (larger tag)
// <span className="badge">Default Badge</span>

// Badge AI
// <span className="badge badge-ai">Feature</span>

// Badge Pulse (animated badge with pulsing dot)
// <span className="badge-pulse">Online</span>

/\*\*

- INPUTS
  \*/

// Input AI (standard glass-style input)
// <input className="input-ai" placeholder="Type here..." />
// - Background: white (light), gray-900 (dark)
// - Border: gray-200 (light), gray-700 (dark)
// - Focus: primary-500 ring with 10% opacity
// - Rounded: lg (16px)

// Input AI Glass (translucent input for glass sections)
// <input className="input-ai-glass" placeholder="Glass input" />
// - Background: white/10 with blur
// - Border: white/20
// - Focus: white/40 border, white/20 ring

/\*\*

- SKELETON (LOADING)
  \*/

// Skeleton Shimmer (loading placeholder)
// <div className="skeleton-shimmer h-12 w-full">Loading...</div>
// - Background: Gradient shimmer animation
// - Duration: 2s infinite

// ============================================================================
// LAYOUT & FLEXBOX UTILITIES
// ============================================================================

/\*\*

- FLEX UTILITIES
  \*/

// Flex Center (center content both axes)
// <div className="flex-center">Centered</div>

// Flex Between (space between)
// <div className="flex-between">Left | Right</div>

// Flex Start
// <div className="flex-start">Left aligned</div>

// Flex End
// <div className="flex-end">Right aligned</div>

// Grid Center (grid-based center)
// <div className="grid-center">Centered</div>

/\*\*

- AUTO GRID SYSTEMS
  \*/

// Auto Grid (auto-fit, min 250px)
// <div className="auto-grid">
// <div>Item 1</div>
// <div>Item 2</div>
// </div>

// Auto Grid Small (auto-fit, min 150px)
// <div className="auto-grid-sm">Small items</div>

// Auto Grid Large (auto-fit, min 350px)
// <div className="auto-grid-lg">Large items</div>

// ============================================================================
// TEXT & TYPOGRAPHY UTILITIES
// ============================================================================

/\*\*

- TEXT UTILITIES
  \*/

// Text Gradient (light/dark gradient text)
// <h1 className="text-gradient">Gradient Text</h1>

// Text Gradient Dark
// <h1 className="text-gradient-dark">Dark Gradient</h1>

// Text Gradient AI (3-color AI gradient)
// <h1 className="text-gradient-ai">AI Gradient</h1>

/\*\*

- LINE CLAMPING
  \*/

// Truncate Line (single line with ellipsis)
// <p className="truncate-line">Very long text...</p>

// Truncate Lines 2 (2 lines max)
// <p className="truncate-lines-2">Text...</p>

// Truncate Lines 3 (3 lines max)
// <p className="truncate-lines-3">Text...</p>

// Or use Tailwind's line-clamp:
// <p className="line-clamp-2">Text...</p>

// ============================================================================
// INTERACTIVE & STATE UTILITIES
// ============================================================================

/\*\*

- FOCUS RINGS
  \*/

// Focus Ring (outside ring)
// <button className="focus-ring">Focusable</button>

// Focus Ring Inset (inside ring)
// <input className="focus-ring-inset" />

/\*\*

- OPACITY & VISIBILITY
  \*/

// Opacity Glass
// <div className="opacity-glass">8% opacity</div>

// Opacity Glass Hover (12% opacity)
// <div className="opacity-glass-hover">Hover state</div>

// Opacity Disabled
// <div className="opacity-disabled">Disabled state</div>

/\*\*

- DIVIDERS
  \*/

// Divider
// <div className="divider">
// <span className="divider-text">OR</span>
// </div>

// ============================================================================
// TRANSITION & ANIMATION UTILITIES
// ============================================================================

/\*\*

- TRANSITION DURATIONS
  \*/

// Fast transition (150ms)
// <div className="transition-fast">Fast transition</div>

// Base transition (250ms)
// <div className="transition-base">Standard transition</div>

// Slow transition (350ms)
// <div className="transition-slow">Slow transition</div>

// No transition
// <div className="transition-none">No animation</div>

/\*\*

- TRANSFORM UTILITIES
  \*/

// Scale In (enable will-change for performance)
// <div className="scale-in hover:scale-105">Scale on hover</div>

// Scale Out
// <div className="scale-out">Scale out animation</div>

// ============================================================================
// DARK MODE PATTERNS
// ============================================================================

/\*\*

- USING DARK MODE
  \*/

// Tailwind dark: prefix (recommended)
// <div className="bg-white dark:bg-gray-900">
// Light/dark background
// </div>

// Explicit semantic tokens
// <div className="bg-background text-foreground">
// Uses theme variables
// </div>

// Conditional classes with themeClasses()
// import { themeClasses } from '@/lib/utils/theme';
// <div className={themeClasses('bg-white', 'bg-gray-900')}>
// Semantic
// </div>

// ============================================================================
// ROLE-BASED THEMING PATTERNS
// ============================================================================

/\*\*

- APPLYING ROLES
  \*/

// import { setUserRole } from '@/lib/utils/theme';

// Set role on component
// <div data-role="seller" className="text-primary-600">
// Seller view (different primary color)
// </div>

// Available roles:
// - customer: Indigo theme (warm, inviting)
// - seller: Blue + Amber theme (professional)
// - admin: Purple + Pink theme (authoritative)

// Role colors automatically adjust:
// <div className="bg-primary-600">
// Color changes based on data-role attribute
// </div>

// ============================================================================
// JAVASCRIPT/TYPESCRIPT UTILITIES
// ============================================================================

/\*\*

- CN - CLASS MERGER
-
- import { cn } from '@/lib/utils/cn';
  \*/

// Merge classes
// cn('px-2', 'px-4') // Returns: 'px-4' (px-4 wins)
// cn('btn', isSmall && 'text-sm')
// cn('bg-blue-600', condition ? 'opacity-100' : 'opacity-50')

/\*\*

- RESPONSIVE - RESPONSIVE BUILDER
-
- import { responsive } from '@/lib/utils/cn';
  \*/

// Build responsive classes
// responsive({
// base: 'px-4',
// md: 'px-8',
// lg: 'px-12'
// })
// Returns: 'px-4 md:px-8 lg:px-12'

/\*\*

- VARIANTS - VARIANT BUILDER
-
- import { variants } from '@/lib/utils/cn';
  \*/

// Build variant classes
// variants('primary', {
// primary: 'bg-blue-600',
// secondary: 'bg-gray-600'
// })
// Returns: 'bg-blue-600'

/\*\*

- SIZES - SIZE BUILDER
-
- import { sizes } from '@/lib/utils/cn';
  \*/

// Build size classes
// sizes('lg', {
// sm: 'px-2',
// md: 'px-4',
// lg: 'px-6'
// })
// Returns: 'px-6'

/\*\*

- THEME UTILITIES
-
- import {
- setThemePreference,
- getThemePreference,
- initializeTheme,
- getRoleColors,
- getRoleGradient
- } from '@/lib/utils/theme';
  \*/

// Set theme
// setThemePreference('dark') // 'light' | 'dark' | 'system'
// setUserRole('seller') // 'customer' | 'seller' | 'admin'

// Get role colors
// getRoleColors('seller', false) // { primary, accent }

// Get role gradient
// getRoleGradient('supplier')

// ============================================================================
// COMMON COMPONENT PATTERNS
// ============================================================================

/\*\*

- BUTTON VARIATIONS
  \*/

// Primary Button
// <button className="btn-ai">Click</button>

// Primary Disabled
// <button className="btn-ai disabled:opacity-50">Click</button>

// Large Button
// <button className="btn-ai px-8 py-3">Large</button>

// Small Button
// <button className="btn-ai px-3 py-1 text-sm">Small</button>

// With Icon
// <button className="btn-ai flex items-center gap-2">
// <IconComponent />
// Click
// </button>

/\*\*

- CARD PATTERNS
  \*/

// Simple Card
// <div className="ai-card">
// <h3>Title</h3>
// <p>Content</p>
// </div>

// Card with Hover
// <div className="ai-card ai-card-hover">
// <h3>Interactive</h3>
// </div>

// Card with Image
// <div className="ai-card overflow-hidden">
// <img src="..." alt="..." className="w-full h-48 object-cover" />
// <div className="p-4">Content</div>
// </div>

/\*\*

- FORM PATTERNS
  \*/

// Simple Form
// <form className="space-y-4">
// <input className="input-ai" placeholder="Name" />
// <input className="input-ai" type="email" placeholder="Email" />
// <button className="btn-ai w-full">Submit</button>
// </form>

// Stacked Form (vertical)
// <form className="flex flex-col gap-4">
// ...
// </form>

// Inline Form (horizontal)
// <form className="flex gap-2">
// <input className="input-ai flex-1" />
// <button className="btn-ai">Search</button>
// </form>

/\*\*

- LOADING PATTERNS
  \*/

// Skeleton Loader
// <div className="skeleton-shimmer h-12 w-full rounded-lg"></div>

// Multiple Skeletons
// <div className="space-y-3">
// <div className="skeleton-shimmer h-8 w-full"></div>
// <div className="skeleton-shimmer h-8 w-3/4"></div>
// </div>

// Loading Spinner
// <div className="loading-spinner w-8 h-8"></div>

// Loading Dots
// <div className="loading-dots">
// <span></span>
// <span></span>
// <span></span>
// </div>

/\*\*

- EMPTY STATE PATTERNS
  \*/

// Empty State
// <div className="empty-state">
// <div className="empty-state-icon">📦</div>
// <h3 className="empty-state-title">No items</h3>
// <p className="empty-state-description">
// Create one to get started
// </p>
// <button className="btn-ai mt-4">Create</button>
// </div>

// ============================================================================
// QUICK COPY-PASTE SNIPPETS
// ============================================================================

/\*\*

- HERO SECTION
  \*/
  // <div className="bg-ai-gradient rounded-2xl p-12 text-white">
  // <h1 className="text-5xl font-bold mb-4">Welcome</h1>
  // <p className="text-lg opacity-90">Subtitle</p>
  // <button className="btn-ai mt-6">Get Started</button>
  // </div>

/\*\*

- CARD GRID
  \*/
  // <div className="auto-grid">
  // {items.map(item => (
  // <div key={item.id} className="ai-card ai-card-hover">
  // <h3>{item.title}</h3>
  // <p className="text-muted-foreground">{item.description}</p>
  // </div>
  // ))}
  // </div>

/\*\*

- NAVBAR
  \*/
  // <header className="sticky top-0 z-50 bg-background border-b border-border">
  // <nav className="flex-between px-4 py-3">
  // <div>Logo</div>
  // <div className="flex gap-4">
  // <a href="/">Home</a>
  // <button className="btn-ai">Sign In</button>
  // </div>
  // </nav>
  // </header>

/\*\*

- FOOTER
  _/
  // <footer className="bg-elevated text-foreground py-12 border-t border-border">
  // <div className="container-max grid-cols-4 gap-8 mb-8">
  // {/_ footer content \*/}
  // </div>
  // </footer>

// ============================================================================
// PERFORMANCE TIPS
// ============================================================================

/\*\*

- 1.  Use will-animate for complex animations
- 2.  Use backface-hidden for 3D transforms
- 3.  Batch state changes
- 4.  Use CSS variables for theming (faster than JS)
- 5.  Prefer position: fixed over sticky for overlays
- 6.  Use contain: layout for isolated components
      \*/

// ============================================================================
// ACCESSIBILITY CHECKLIST
// ============================================================================

/\*\*

- 1.  Focus visible on all interactive elements ✓ (auto)
- 2.  Color contrast ratios ✓ (verified in tokens)
- 3.  semanticRole attributes
- 4.  aria-labels where needed
- 5.  Keyboard navigation support
- 6.  Reduced motion support ✓ (auto)
- 7.  High contrast mode ✓ (auto)
      \*/

// ============================================================================
// SUPPORT & RESOURCES
// ============================================================================

/\*\*

- Documentation:
- - DESIGN_SYSTEM.md - Full design system guide
- - tailwind.config.ts - Token definitions
- - app/globals.css - CSS variables & utilities
-
- Files:
- - /lib/utils/cn.ts - Class utilities
- - /lib/utils/theme.ts - Theme utilities
- - /components.json - shadcn/ui config
    \*/
