# DelegateCart Design System

Enterprise-grade design token system with Tailwind CSS + shadcn/ui. Supports light/dark mode, AI-first aesthetics, and multi-role theming (customer, seller, admin).

---

## 🎨 Quick Start

### 1. **Import Utilities**

```tsx
import { cn } from '@/lib/utils/cn';
import { setThemePreference, setUserRole, initializeTheme } from '@/lib/utils/theme';
```

### 2. **Initialize in Root Layout**

```tsx
'use client';

import { useEffect } from 'react';
import { initializeTheme } from '@/lib/utils/theme';

export function RootLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initializeTheme();
  }, []);

  return (
    <html suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
```

### 3. **Use Design Tokens**

```tsx
// Colors via CSS variables
<div className="bg-primary-600 text-white">Primary</div>

// With cn for merging
<button className={cn('btn-ai', 'px-6', isDisabled && 'opacity-50')}>
  Click me
</button>

// Role-based theming
<div data-role="seller" className="text-primary-600">
  Seller view (different primary color)
</div>
```

---

## 🎯 Color System

### CSS Variables

All colors use CSS variables for dynamic theming. Update in `app/globals.css`:

```css
:root {
  /* Base Colors */
  --color-background: 0 0% 100%;
  --color-foreground: 219 14% 10%;
  --color-card: 210 40% 96%;

  /* Primary (Indigo AI Theme) */
  --color-primary-600: 263 80% 61%;
  --color-accent-500: 188 95% 50%;
}

html.dark {
  --color-background: 220 13% 9%;
  --color-foreground: 210 40% 98%;
}
```

### Color Values

| Variable  | Light      | Dark       | Use Case                |
| --------- | ---------- | ---------- | ----------------------- |
| `primary` | Indigo-600 | Indigo-500 | Main brand color        |
| `accent`  | Cyan-500   | Cyan-400   | Highlights, interactive |
| `success` | Green-500  | Green-400  | Success states          |
| `warning` | Amber-500  | Amber-400  | Warnings, alerts        |
| `error`   | Red-500    | Red-400    | Errors, destructive     |
| `glass`   | white/10   | white/5    | Glass morphism          |

### Usage

```tsx
// Direct class
<div className="bg-primary-600 text-white">Primary button</div>

// With dark mode
<div className="bg-white dark:bg-gray-900">Light/Dark BG</div>

// Via CSS variables (React components)
<div style={{ backgroundColor: 'hsl(var(--color-primary-600))' }}>
  Dynamic color
</div>
```

---

## 🌈 Gradients

Pre-built gradient utilities:

```tsx
// AI Gradient (primary brand gradient)
<div className="bg-ai-gradient">AI-first hero</div>

// Role-inspired gradients
<div className="bg-success-gradient">Success state</div>
<div className="bg-warning-gradient">Warning state</div>
<div className="bg-error-gradient">Error state</div>

// Text gradient
<h1 className="text-gradient">Gradient text</h1>
<h1 className="text-gradient-ai">AI gradient text</h1>
```

---

## 🎭 Glass Morphism

Glassmorphic components with backdrop blur:

```tsx
// Card
<div className="glass-card">
  <p>Glassmorphic card</p>
</div>

// Interactive
<div className="glass-card glass-card-hover">
  <p>Hover me</p>
</div>

// Input
<input className="input-ai-glass" placeholder="Type here..." />

// Components
<div className="glass-bg glass-border backdrop-blur-glass rounded-xl">
  Blurred background content
</div>
```

---

## 🧱 Base Components

Pre-built utility classes using `@layer components`:

### Buttons

```tsx
// AI Primary Button (gradient)
<button className="btn-ai">Click me</button>

// Secondary Button
<button className="btn-secondary">Secondary</button>

// Ghost Button (minimal)
<button className="btn-ghost">Ghost</button>
```

### Cards

```tsx
// AI Card (gradient border effect)
<div className="ai-card">
  <h3>AI Feature</h3>
</div>

// With hover effect
<div className="ai-card ai-card-hover">
  Hover for glow
</div>
```

### Chips

```tsx
// Primary chip
<span className="chip">New</span>

// Color variants
<span className="chip chip-success">Live</span>
<span className="chip chip-warning">Pending</span>
<span className="chip chip-error">Failed</span>
```

### Inputs

```tsx
// Standard
<input className="input-ai" placeholder="Standard input" />

// Glass style
<input className="input-ai-glass" placeholder="Glass input" />
```

### Badges

```tsx
// Badge
<span className="badge">Default</span>

// AI Badge
<span className="badge badge-ai">Feature</span>

// Pulsing badge
<span className="badge-pulse">Online</span>
```

---

## 🎬 Animations

Built-in animations ready to use:

```tsx
// Fade in
<div className="animate-fade-in">Fade in effect</div>

// Slide up
<div className="animate-slide-up">Slide up</div>

// Pulse soft (AI thinking indicator)
<div className="animate-pulse-soft">Loading...</div>

// Shimmer (skeleton loading)
<div className="skeleton-shimmer">Loading...</div>

// Glow effect
<div className="animate-glow rounded-lg bg-primary-600">Glowing</div>
```

Custom keyframes available:

- `fade-in` - Opacity transition
- `slide-up` / `slide-down` - Vertical movement
- `pulse-soft` - Gentle pulsing
- `shimmer` - Loading animation
- `glow` - Breathing glow effect

---

## 🌓 Dark Mode

Automatic dark mode support:

```tsx
// Tailwind dark: prefix
<div className="bg-white dark:bg-gray-900">
  Light/Dark background
</div>

// CSS variable approach (recommended)
<div className="bg-background text-foreground">
  Uses theme variables
</div>

// Manual toggle
import { setThemePreference } from '@/lib/utils/theme';

<button onClick={() => setThemePreference('dark')}>
  Toggle Dark
</button>
```

**Setup:**

- Add `suppressHydrationWarning` to `<html>` tag
- Call `initializeTheme()` in root layout
- Theme preference saved to localStorage

---

## 👥 Role-Based Theming

Multi-role UI support (customer, seller, admin):

### Apply Role

```tsx
import { setUserRole } from '@/lib/utils/theme';

// Set role on login
<button onClick={() => setUserRole('seller')}>Switch to Seller</button>;
```

### Use Role-Specific Styles

```tsx
// Attribute-based styling
<div data-role="seller" className="text-primary-600">
  Seller-specific color
</div>

// Role colors change:
// - customer: Indigo (warm, inviting)
// - seller: Blue + Amber (professional, data-focused)
// - admin: Purple + Pink (authoritative, systematic)
```

### Role Gradient

```tsx
import { getRoleGradient } from '@/lib/utils/theme';

<div style={{ background: getRoleGradient('seller') }}>Seller gradient</div>;
```

---

## 🔧 Utility Functions

### `cn()` - Class Merger

```tsx
import { cn } from '@/lib/utils/cn';

// Merge classes with smart override
<button
  className={cn(
    'btn-ai',
    'px-4',
    isSmall && 'px-2', // Overrides px-4
    isDisabled && 'opacity-50'
  )}
>
  Button
</button>;
```

### `responsive()` - Responsive Builder

```tsx
import { responsive } from '@/lib/utils/cn';

<div
  className={responsive({
    base: 'px-4',
    md: 'px-8',
    lg: 'px-12',
  })}
>
  Responsive padding
</div>;
```

### `variants()` - Variant Builder

```tsx
import { variants } from '@/lib/utils/cn';

<button
  className={cn(
    'btn',
    variants(buttonVariant, {
      primary: 'btn-ai',
      secondary: 'btn-secondary',
      ghost: 'btn-ghost',
    })
  )}
>
  Variant Button
</button>;
```

### `themeClasses()` - Theme Conditional

```tsx
import { themeClasses } from '@/lib/utils/theme';

<div
  className={themeClasses(
    'bg-white text-gray-900', // Light
    'bg-gray-900 text-white' // Dark
  )}
>
  Theme-aware content
</div>;
```

---

## 📐 Responsive Utilities

### Auto Grid

```tsx
// Auto-fit grid (250px minimum)
<div className="auto-grid">
  <div>Item 1</div>
  <div>Item 2</div>
</div>

// Small items
<div className="auto-grid-sm">Small items</div>

// Large items
<div className="auto-grid-lg">Large items</div>
```

### Flexbox Shortcuts

```tsx
// Center content
<div className="flex-center">Centered</div>

// Space between
<div className="flex-between">Left | Right</div>

// Justify start/end
<div className="flex-start">Start</div>
<div className="flex-end">End</div>
```

### Hide/Show

```tsx
// Hide on mobile
<div className="hide-mobile">Desktop only</div>

// Show on mobile
<div className="show-mobile">Mobile only</div>

// Or use Tailwind
<div className="hidden md:block">MD and up</div>
```

---

## 🎨 Shadows

Pre-built shadow utilities:

```tsx
// Glass shadow (subtle)
<div className="shadow-glass">Glass card</div>

// Elevated shadow (prominent)
<div className="shadow-elevated">Elevated card</div>

// AI Glow (brand-specific)
<div className="shadow-ai-glow">Glowing element</div>

// Soft shadow (minimal)
<div className="shadow-soft">Soft shadow</div>
```

---

## 📝 Typography

### Headings

```tsx
// Automatic sizing + spacing
<h1>Main heading</h1>      {/* 36px, scroll margin */}
<h2>Section heading</h2>   {/* 30px */}
<h3>Subsection</h3>        {/* 24px */}
<h4>Title</h4>             {/* 20px */}
```

### Text Utilities

```tsx
// Text gradient
<p className="text-gradient">Gradient text</p>

// Line clamping
<p className="line-clamp-1">Single line...</p>
<p className="line-clamp-2">Two lines max...</p>
<p className="line-clamp-3">Three lines max...</p>

// Truncate
<p className="truncate">Very long text...</p>
```

---

## 🔐 Accessibility

### Focus Rings

```tsx
// Visible focus ring
<button className="focus-ring">Focusable button</button>

// Inset ring
<input className="focus-ring-inset" />

// Auto applied to interactive elements
<a href="/">Link (auto focus ring)</a>
```

### Reduced Motion

Automatically respects `prefers-reduced-motion`:

```tsx
// Reduced motion: durations become 0.01ms
<div className="animate-fade-in">Auto-reduced on preference</div>
```

### High Contrast

Automatically adjusts for `prefers-contrast: more`:

```tsx
/* CSS automatically adjusts borders and font weights */
```

---

## 🚀 Advanced Usage

### Custom Component with Design Tokens

```tsx
'use client';

import { cn } from '@/lib/utils/cn';
import { variants, sizes } from '@/lib/utils/cn';

interface CardProps {
  variant?: 'default' | 'ai' | 'glass';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export function Card({ variant = 'default', size = 'md', children }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-lg p-4 transition-all',
        variants(variant, {
          default: 'bg-card shadow-soft',
          ai: 'ai-card ai-card-hover',
          glass: 'glass-card glass-card-hover',
        }),
        sizes(size, {
          sm: 'p-2',
          md: 'p-4',
          lg: 'p-6',
        })
      )}
    >
      {children}
    </div>
  );
}
```

### Role-Aware Component

```tsx
'use client';

import { getRoleGradient } from '@/lib/utils/theme';

interface RoleCardProps {
  role: 'customer' | 'seller' | 'admin';
  children: React.ReactNode;
}

export function RoleCard({ role, children }: RoleCardProps) {
  return (
    <div
      style={{
        background: getRoleGradient(role),
        backgroundAttachment: 'fixed',
      }}
      className="rounded-lg p-6 text-white"
    >
      {children}
    </div>
  );
}
```

---

## 📊 Component Examples

### Button Group

```tsx
<div className="flex gap-2">
  <button className="btn-ai">Primary</button>
  <button className="btn-secondary">Secondary</button>
  <button className="btn-ghost">Ghost</button>
</div>
```

### Card Grid

```tsx
<div className="auto-grid">
  <div className="ai-card ai-card-hover">
    <h3>Feature 1</h3>
    <p>Description</p>
  </div>
  {/* More cards */}
</div>
```

### Form

```tsx
<form className="space-y-4">
  <input className="input-ai" placeholder="Name" />
  <input className="input-ai" type="email" placeholder="Email" />
  <button className="btn-ai w-full">Submit</button>
</form>
```

### Badge Row

```tsx
<div className="flex gap-2 flex-wrap">
  <span className="chip">New</span>
  <span className="chip chip-success">Active</span>
  <span className="badge-pulse">Online</span>
</div>
```

---

## 🔄 Extending the Design System

### Add Custom Color

Edit `tailwind.config.ts`:

```tsx
colors: {
  myColor: {
    500: 'hsl(var(--color-my) / <alpha-value>)',
  }
}
```

Then in `app/globals.css`:

```css
:root {
  --color-my: 200 100% 50%;
}

html.dark {
  --color-my: 200 100% 60%;
}
```

### Add Custom Animation

Edit `tailwind.config.ts`:

```tsx
keyframes: {
  myAnimation: {
    '0%': { opacity: '0' },
    '100%': { opacity: '1' },
  }
},
animation: {
  myAnimation: 'myAnimation 0.3s ease-in-out',
}
```

Then use: `<div className="animate-myAnimation">Animated</div>`

---

## 🎓 Best Practices

1. **Use CSS variables** for dynamic theming
2. **Prefer `cn()` over template strings** for class merging
3. **Keep component variants DRY** with `variants()` helper
4. **Test dark mode** with `prefers-color-scheme` dev tools
5. **Use semantic colors** (success, error, warning) over hard colors
6. **Respect reduced motion** preferences
7. **Maintain accessible focus rings**
8. **Use role-based theming** for multi-tenant features

---

## 📚 File Structure

```
apps/web/
├── app/
│   ├── globals.css           # CSS variables, @layer components
│   └── layout.tsx            # Initialize theme
├── components.json           # shadcn/ui config
├── tailwind.config.ts        # Tailwind tokens & plugins
└── lib/utils/
    ├── cn.ts                 # Class merger utilities
    └── theme.ts              # Theme & role helpers
```

---

## 🐛 Common Issues

### Hydration Mismatch

Add `suppressHydrationWarning` to `<html>`:

```tsx
<html suppressHydrationWarning>
```

### Colors Not Applying

Make sure CSS variables are defined in `globals.css` for both `:root` and `html.dark`.

### Dark Mode Not Working

1. Call `initializeTheme()` in root layout
2. Ensure Tailwind config has `darkMode: ['class']`
3. Check localStorage for 'theme-preference'

---

## 🎯 Next Steps

1. Install shadcn/ui components: `npx shadcn-ui@latest init`
2. Add buttons, cards: `npx shadcn-ui@latest add button card`
3. Use design tokens in new components
4. Test in light/dark modes
5. Implement role-based UI
6. Deploy and monitor

---

**All design tokens are production-ready and follow enterprise best practices.**
