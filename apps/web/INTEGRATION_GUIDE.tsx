/**
 * Production-Grade Real-Time Experience Integration Guide
 * 
 * This file shows how to adopt the new systems (React Query, Feature Flags, Dark Mode, 
 * Logging, Error Handling) into existing components with minimal refactoring.
 * 
 * ============================================================================
 * TABLE OF CONTENTS
 * ============================================================================
 * 1. App Setup (providers, providers)
 * 2. React Query Integration Examples
 * 3. Feature Flags Usage Patterns
 * 4. Dark Mode Implementation
 * 5. Logging & Error Tracking
 * 6. Error Boundary & Retry UI
 * 7. Toast Notifications
 * 8. Complete Component Refactor Example
 * 9. Performance Optimization Patterns
 * 10. API Endpoints Required
 * 
 * ============================================================================
 * 1. APP SETUP - Wrap your app with providers
 * ============================================================================
 * 
 * File: apps/web/app/layout.tsx
 * 
 */

// BEFORE: Basic layout
const LayoutBefore = `
import type { Metadata } from "next";
import { SessionProvider } from "next-auth/react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Delegate Cart",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
`;

// AFTER: With all providers
const LayoutAfter = `
'use client';

import type { Metadata } from "next";
import { SessionProvider } from "next-auth/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queries/queryClient";
import { ThemeProvider } from "@/lib/contexts/ThemeContext";
import { FeatureFlagsProvider } from "@/lib/contexts/FeatureFlagsContext";
import { ToastProvider, ToastContainer } from "@/lib/contexts/ToastContext";
import { ErrorBoundary, AsyncErrorHandler } from "@/components/error/ErrorBoundary";
import "./globals.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ErrorBoundary level="page">
          <AsyncErrorHandler>
            <SessionProvider>
              <QueryClientProvider client={queryClient}>
                <ThemeProvider>
                  <FeatureFlagsProvider>
                    <ToastProvider>
                      {children}
                      <ToastContainer />
                    </ToastProvider>
                  </FeatureFlagsProvider>
                </ThemeProvider>
              </QueryClientProvider>
            </SessionProvider>
          </AsyncErrorHandler>
        </ErrorBoundary>
      </body>
    </html>
  );
}
`;

/**
 * ============================================================================
 * 2. REACT QUERY INTEGRATION - Replace manual useState/useEffect
 * ============================================================================
 */

// BEFORE: Manual state management
const ComponentBefore = `
'use client';

import { useState, useEffect } from 'react';
import { ProductCard } from '@/components/product/ProductCard';

export function ProductList() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/products?category=laptop');
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        setProducts(data);
        setError(null);
      } catch (err) {
        setError(err.message);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []); // Missing dependency management!

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="grid grid-cols-3 gap-4">
      {products.map((p) => <ProductCard key={p.id} product={p} />)}
    </div>
  );
}
`;

// AFTER: With React Query
const ComponentAfter = `
'use client';

import { useProducts } from '@/lib/hooks/useApi';
import { useLogger } from '@/lib/hooks/useLogging';
import { ProductCard } from '@/components/product/ProductCard';

export function ProductList() {
  // 1. Use React Query hook - handles loading, error, caching, retries
  const { data: products, isLoading, error } = useProducts({ category: 'laptop' });
  
  // 2. Optional: Log performance
  const { log } = useLogger('ProductList');

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  log('info', {
    message: 'Products loaded',
    productCount: products?.length,
  });

  return (
    <div className="grid grid-cols-3 gap-4">
      {products?.map((p) => <ProductCard key={p.id} product={p} />)}
    </div>
  );
}
`;

/**
 * ============================================================================
 * 3. FEATURE FLAGS - Control features without redeployment
 * ============================================================================
 */

// Example 1: Simple feature gate
const FeatureFlagExample1 = `
import { FeatureGate, useFeatureFlags } from '@/lib/contexts/FeatureFlagsContext';

export function Dashboard() {
  const { isFeatureEnabled } = useFeatureFlags();

  return (
    <div>
      {/* Show new dashboard for 50% of users */}
      <FeatureGate name="new-dashboard" fallback={<OldDashboard />}>
        <NewDashboard />
      </FeatureGate>

      {/* Or use hook directly */}
      {isFeatureEnabled('ai-copilot-v2') && (
        <AIAssistant />
      )}
    </div>
  );
}
`;

// Example 2: Variant testing (A/B testing)
const FeatureFlagExample2 = `
import { useFeatureFlags } from '@/lib/contexts/FeatureFlagsContext';

export function ProductCard({ product }: Props) {
  const { getFeatureVariant } = useFeatureFlags();
  
  // Get variant for A/B test (returns 'control' or 'treatment')
  const buttonVariant = getFeatureVariant('button-style-ab-test');

  return (
    <div className="product-card">
      <button 
        className={buttonVariant === 'treatment' ? 'btn-gradient' : 'btn-outline'}
      >
        {buttonVariant === 'treatment' ? 'Click Me Now' : 'Add to Cart'}
      </button>
    </div>
  );
}
`;

/**
 * ============================================================================
 * 4. DARK MODE - System-aware theme with persistence
 * ============================================================================
 */

// Example 1: Use in component
const DarkModeExample1 = `
import { useTheme, ThemeToggle } from '@/lib/contexts/ThemeContext';

export function Header() {
  const { isDark, theme } = useTheme();

  return (
    <header className={isDark ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}>
      <nav className="flex justify-between items-center">
        <logo />
        <ThemeToggle /> {/* Ready-to-use toggle button */}
      </nav>
    </header>
  );
}
`;

// Example 2: Conditional styling with theme
const DarkModeExample2 = `
import { useThemeStyles } from '@/lib/contexts/ThemeContext';

export function Card({ children }: Props) {
  const { getThemeColor } = useThemeStyles();
  
  // Gets light/dark color based on current theme
  const bgColor = getThemeColor('bg-gray-100', 'bg-gray-800');
  const textColor = getThemeColor('text-gray-900', 'text-white');

  return (
    <div className={\`\${bgColor} \${textColor} p-4 rounded\`}>
      {children}
    </div>
  );
}
`;

// Note: Tailwind dark: prefix also works
const DarkModeExample3 = `
<div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
  Your content here
</div>
`;

/**
 * ============================================================================
 * 5. LOGGING & ERROR TRACKING - Observability layer
 * ============================================================================
 */

// Example 1: Basic logging
const LoggingExample1 = `
import { useLogger } from '@/lib/hooks/useLogging';

export function SearchForm() {
  const { log, error } = useLogger('SearchForm');

  const handleSearch = async (query: string) => {
    log('info', { message: 'Search started', query });
    
    try {
      const results = await fetchSearchResults(query);
      log('info', { 
        message: 'Search completed', 
        resultCount: results.length 
      });
    } catch (err) {
      error('Search failed', { error: err.message });
    }
  };

  return <form onSubmit={handleSearch}>...</form>;
}
`;

// Example 2: Performance tracking
const LoggingExample2 = `
import { usePerformanceTracking } from '@/lib/hooks/useLogging';

export function ProductList() {
  const { trackOperationTime } = usePerformanceTracking('ProductList');

  useEffect(() => {
    const timer = trackOperationTime('mount');
    return () => timer(); // Logs mount time automatically
  }, []);

  const handleSort = async () => {
    const endTimer = trackOperationTime('sort');
    await sortProducts();
    endTimer(); // Logs sort duration
  };

  return <div>...</div>;
}
`;

// Example 3: Interaction tracking
const LoggingExample3 = `
import { useInteractionTracking } from '@/lib/hooks/useLogging';

export function ProductCard({ product }: Props) {
  const { trackClick, trackApiCall } = useInteractionTracking('ProductCard');

  const handleAddToCart = async () => {
    trackClick('add-to-cart-button'); // Logs click event
    
    const endApiCall = trackApiCall('add_to_cart', 'POST');
    try {
      await fetch('/api/cart', { method: 'POST', body: JSON.stringify(product) });
      endApiCall({ status: 'success' }); // Logs API call with success
    } catch (err) {
      endApiCall({ status: 'error', error: err.message });
    }
  };

  return <button onClick={handleAddToCart}>Add</button>;
}
`;

// Example 4: Error tracking
const LoggingExample4 = `
import { useErrorTracking } from '@/lib/hooks/useLogging';

export function CheckoutForm() {
  const { trackError } = useErrorTracking('CheckoutForm');

  const handleSubmit = async (data: any) => {
    try {
      await submitOrder(data);
    } catch (err) {
      // Log error with context
      trackError(err, {
        step: 'payment_processing',
        items: data.items.length,
      });
    }
  };

  return <form onSubmit={handleSubmit}>...</form>;
}
`;

/**
 * ============================================================================
 * 6. TOAST NOTIFICATIONS - User feedback
 * ============================================================================
 */

const ToastExample = `
import { useToast } from '@/lib/contexts/ToastContext';

export function CheckoutButton() {
  const { success, error, warning, info } = useToast();

  const handleCheckout = async () => {
    try {
      const result = await processOrder();
      success('Order placed successfully!', 'Order Complete');
      
    } catch (err) {
      if (err.code === 'INSUFFICIENT_STOCK') {
        warning('Some items are out of stock', 'Availability');
      } else if (err.code === 'PAYMENT_FAILED') {
        error('Payment failed. Please try again', 'Payment');
      }
    }
  };

  return (
    <button onClick={handleCheckout}>
      Checkout
    </button>
  );
}
`;

/**
 * ============================================================================
 * 7. ERROR BOUNDARY & RETRY UI - Resilient error handling
 * ============================================================================
 */

// Example 1: Wrap component with error boundary
const ErrorBoundaryExample1 = `
import { ErrorBoundary } from '@/components/error/ErrorBoundary';

export function Page() {
  return (
    <ErrorBoundary level="section">
      <ProductList /> {/* If ProductList crashes, shows retry UI, doesn't break page */}
    </ErrorBoundary>
  );
}
`;

// Example 2: Higher-order component pattern
const ErrorBoundaryExample2 = `
import { withErrorBoundary } from '@/components/error/ErrorBoundary';

function MyComponent() {
  return <div>Component content</div>;
}

// Automatically wrapped with error boundary
export default withErrorBoundary(MyComponent, { 
  level: 'component' 
});
`;

// Example 3: Async error handling
const ErrorBoundaryExample3 = `
import { ErrorBoundary, AsyncErrorHandler, useErrorBoundaryHandler } from '@/components/error/ErrorBoundary';

export function Dashboard() {
  const handleError = useErrorBoundaryHandler();

  const fetchData = async () => {
    try {
      return await fetch('/api/dashboard').then(r => r.json());
    } catch (err) {
      handleError(err); // Will be caught by ErrorBoundary above
    }
  };

  return <div>Dashboard content</div>;
}

// Wrap in error boundary
export default function Page() {
  return (
    <ErrorBoundary>
      <AsyncErrorHandler>
        <Dashboard />
      </AsyncErrorHandler>
    </ErrorBoundary>
  );
}
`;

/**
 * ============================================================================
 * 8. COMPLETE COMPONENT REFACTOR EXAMPLE
 * 
 * Shows how to adopt ALL systems in one component
 * ============================================================================
 */

const CompleteRefactorBefore = `
'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

export function OrderHistory() {
  const { data: session } = useSession();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!session?.user?.id) return;

    const fetchOrders = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/orders');
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();
        setOrders(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
    const interval = setInterval(fetchOrders, 10000);
    return () => clearInterval(interval);
  }, [session]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h1>My Orders</h1>
      {orders.map(order => (
        <div key={order.id} className="border p-4">
          <h3>{order.id}</h3>
          <p>{order.total}</p>
        </div>
      ))}
    </div>
  );
}
`;

const CompleteRefactorAfter = `
'use client';

import { useOrders } from '@/lib/hooks/useApi';
import { useLogger, useInteractionTracking } from '@/lib/hooks/useLogging';
import { useFeatureFlags } from '@/lib/contexts/FeatureFlagsContext';
import { useToast } from '@/lib/contexts/ToastContext';
import { useTheme } from '@/lib/contexts/ThemeContext';
import { ErrorBoundary, withErrorBoundary } from '@/components/error/ErrorBoundary';

function OrderHistoryContent() {
  // 1. Data management: React Query (auto-caches, refetches every 10s)
  const { data: orders, isLoading, error } = useOrders();

  // 2. Logging: Track performance and interactions
  const { log } = useLogger('OrderHistory');
  const { trackClick } = useInteractionTracking('OrderHistory');

  // 3. Feature flags: Control UI features
  const { isFeatureEnabled } = useFeatureFlags();

  // 4. Notifications
  const { success, error: showError } = useToast();

  // 5. Theme
  const { isDark } = useTheme();

  useEffect(() => {
    log('info', { message: 'Orders loaded', count: orders?.length });
  }, [orders, log]);

  const handleOrderClick = (orderId: string) => {
    trackClick('order-item', { orderId });
  };

  const handleRetry = async () => {
    trackClick('retry-button');
    try {
      // React Query's useOrders handles retry automatically
      success('Retrying...', 'Refreshing');
    } catch (err) {
      showError(err.message);
    }
  };

  if (isLoading) return <div>Loading...</div>;
  if (error) {
    return (
      <div className="p-4 bg-red-50 rounded">
        <p>Error: {error.message}</p>
        <button onClick={handleRetry} className="btn btn-primary mt-2">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={isDark ? 'bg-gray-900 text-white' : 'bg-white'}>
      <h1 className="text-2xl font-bold">
        {isFeatureEnabled('new-dashboard') ? 'Order History' : 'My Orders'}
      </h1>
      
      {orders?.map(order => (
        <div 
          key={order.id} 
          className="border p-4 cursor-pointer hover:bg-gray-100"
          onClick={() => handleOrderClick(order.id)}
        >
          <h3 className="font-semibold">{order.id}</h3>
          <p className="text-sm">Total: \${order.total}</p>
          {isFeatureEnabled('real-time-tracking') && (
            <p className="text-xs text-blue-600">📍 Tracking available</p>
          )}
        </div>
      ))}
    </div>
  );
}

// Wrap with error boundary for resilient rendering
export default withErrorBoundary(OrderHistoryContent, { level: 'section' });
`;

/**
 * ============================================================================
 * 9. PERFORMANCE OPTIMIZATION PATTERNS
 * ============================================================================
 */

// Pattern 1: Code splitting with dynamic imports
const CodeSplittingExample = `
import dynamic from 'next/dynamic';
import { Suspense } from 'react';

// Load ChatWindow only when needed
const ChatWindow = dynamic(() => import('@/components/chat/ChatWindow'), {
  loading: () => <div>Loading chat...</div>,
});

export function Dashboard() {
  const [showChat, setShowChat] = useState(false);

  return (
    <div>
      <button onClick={() => setShowChat(true)}>Open Chat</button>
      {showChat && (
        <Suspense fallback={<div>Loading...</div>}>
          <ChatWindow />
        </Suspense>
      )}
    </div>
  );
}
`;

// Pattern 2: Image lazy loading
const LazyImageExample = `
import Image from 'next/image';

export function ProductCard({ product }: Props) {
  return (
    <div>
      {/* Next.js Image automatically lazy loads below fold */}
      <Image
        src={product.image}
        alt={product.name}
        width={300}
        height={300}
        loading="lazy"
      />
    </div>
  );
}
`;

// Pattern 3: React Query pagination
const PaginationExample = `
import { useProducts } from '@/lib/hooks/useApi';

export function ProductList() {
  const [page, setPage] = useState(1);
  
  // Only fetch current page, cache is per-page
  const { data: products, isLoading } = useProducts({ 
    page, 
    limit: 20
  });

  return (
    <div>
      {products?.map(p => <ProductCard key={p.id} product={p} />)}
      <div className="flex gap-2">
        <button onClick={() => setPage(p => p - 1)}>Previous</button>
        <span>Page {page}</span>
        <button onClick={() => setPage(p => p + 1)}>Next</button>
      </div>
    </div>
  );
}
`;

/**
 * ============================================================================
 * 10. API ENDPOINTS REQUIRED
 * ============================================================================
 * 
 * Your backend needs these endpoints for all systems to work:
 * 
 * GET  /api/products?category=X&page=Y - Product listing
 * GET  /api/products/:id - Product detail
 * GET  /api/orders - User's orders (auto-refetch 10s)
 * GET  /api/orders/:id - Order detail (auto-refetch 5s)
 * POST /api/orders - Create order
 * PUT  /api/orders/:id - Update order
 * GET  /api/recommendations?userId=X - AI recommendations
 * GET  /api/search?q=X - Product search (debounced min 3 chars)
 * POST /api/cart/items - Add to cart
 * DELETE /api/cart/items/:id - Remove from cart
 * GET  /api/feature-flags - Feature flag definitions (refresh every 30s)
 * POST /api/logs - Log events batch (receives array of log entries)
 * 
 * Request format for POST /api/logs:
 * {
 *   logs: [
 *     {
 *       timestamp: ISO string,
 *       level: 'debug' | 'info' | 'warn' | 'error',
 *       message: string,
 *       context: object,
 *       userId: string,
 *       sessionId: string,
 *       url: string,
 *       userAgent: string
 *     }
 *   ]
 * }
 * 
 * ============================================================================
 * ADOPTION CHECKLIST
 * ============================================================================
 * 
 * [ ] 1. Add providers to app/layout.tsx (see section 1)
 * [ ] 2. Create /api/logs endpoint for logging
 * [ ] 3. Create /api/feature-flags endpoint
 * [ ] 4. Replace useState/useEffect with React Query hooks in 1-2 components
 * [ ] 5. Add ToastContainer to layout
 * [ ] 6. Verify WebSocket reconnection working with new React Query system
 * [ ] 7. Add feature flag check to new dashboard feature
 * [ ] 8. Add useLogger to PageView component for observability
 * [ ] 9. Wrap critical sections with <ErrorBoundary>
 * [ ] 10. Test dark mode toggle
 * [ ] 11. Test toast notifications
 * [ ] 12. Monitor /api/logs for incoming events
 * [ ] 13. Gradual rollout: enable features for 10%, then 50%, then 100%
 * [ ] 14. Add performance dashboard to track metrics
 * 
 * ============================================================================
 * MIGRATION PATH (Recommended)
 * ============================================================================
 * 
 * Phase 1 (This Week):
 * - Add providers to layout
 * - Convert ProductList component to React Query
 * - Set up logging in key flows
 * 
 * Phase 2 (Next Week):
 * - Convert OrderHistory and OrderDetail pages
 * - Add error boundaries to critical sections
 * - Feature flag first new dashboard feature at 10%
 * 
 * Phase 3 (Following Week):
 * - Full dark mode support rollout
 * - Code-split heavy components (Chat, Timeline)
 * - Rollout new dashboard to 100%
 * - Performance optimization based on /api/logs data
 * 
 * ============================================================================
 * TROUBLESHOOTING
 * ============================================================================
 * 
 * Q: Components not updating with new data from React Query?
 * A: Make sure useProducts/useApi is called in component. React Query will
 *    auto-update. Check that your API endpoint returns correct data format.
 * 
 * Q: Hydration mismatch error with dark mode?
 * A: The ThemeContext already prevents this, but make sure suppressHydrationWarning
 *    is on <html> element in layout.tsx.
 * 
 * Q: Logging not showing up?
 * A: Check that /api/logs endpoint exists. Logs are batched and sent every 5s
 *    or when 10 events accumulate. Check network tab in DevTools.
 * 
 * Q: Feature flags not updating?
 * A: They refresh from /api/feature-flags every 30s. Check that endpoint is
 *    returning valid flag definitions with correct structure.
 * 
 * Q: Error boundaries not catching async errors?
 * A: Wrap with <AsyncErrorHandler> AND use useErrorBoundaryHandler hook
 *    for async errors. Regular render errors caught automatically.
 */
