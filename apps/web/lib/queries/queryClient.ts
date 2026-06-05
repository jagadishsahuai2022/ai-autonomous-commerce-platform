/**
 * React Query Configuration
 * Server state management with caching and sync
 * Replaces manual loading/error states with automatic handling
 */

import { QueryClient, QueryClientConfig } from '@tanstack/react-query';

// Default query client config
const queryConfig: QueryClientConfig = {
  defaultOptions: {
    queries: {
      // Cache successful queries for 5 minutes
      staleTime: 5 * 60 * 1000,
      // Keep unused data in cache for 10 minutes
      gcTime: 10 * 60 * 1000,
      // Always refetch on window focus
      refetchOnWindowFocus: true,
      // Refetch on mount if stale
      refetchOnMount: true,
      // Retry failed requests 3 times with exponential backoff
      retry: (failureCount, error: any) => {
        if (failureCount > 3) return false;
        // Don't retry 4xx errors
        if (error?.status >= 400 && error?.status < 500) return false;
        return true;
      },
      retryDelay: (attemptIndex) => Math.min(500 * 2 ** attemptIndex, 10000),
      // Refetch interval for real-time data (e.g., order status)
      refetchInterval: false,
    },
    mutations: {
      retry: 1,
      retryDelay: 1000,
    },
  },
};

export const queryClient = new QueryClient(queryConfig);

/**
 * Query keys factory for type-safe cache management
 */
export const queryKeys = {
  // Products
  products: {
    all: ['products'] as const,
    list: (filters?: Record<string, any>) => ['products', 'list', filters] as const,
    detail: (id: string) => ['products', 'detail', id] as const,
    search: (query: string) => ['products', 'search', query] as const,
  },

  // Orders
  orders: {
    all: ['orders'] as const,
    list: () => ['orders', 'list'] as const,
    detail: (id: string) => ['orders', 'detail', id] as const,
    status: (id: string) => ['orders', 'status', id] as const,
  },

  // Cart
  cart: {
    all: ['cart'] as const,
    items: () => ['cart', 'items'] as const,
    summary: () => ['cart', 'summary'] as const,
  },

  // Recommendations
  recommendations: {
    all: ['recommendations'] as const,
    list: (filters?: Record<string, any>) => ['recommendations', 'list', filters] as const,
    ai: () => ['recommendations', 'ai'] as const,
    personalized: (userId: string) => ['recommendations', 'personalized', userId] as const,
  },

  // User
  user: {
    all: ['user'] as const,
    profile: () => ['user', 'profile'] as const,
    preferences: () => ['user', 'preferences'] as const,
  },
};
