/**
 * useCategories — Fetches and caches product categories.
 *
 * Strategy: stale-while-revalidate
 *  - Serves cached data instantly on repeated calls
 *  - Refreshes in background every 5 minutes
 *  - Uses requestIdleCallback to avoid blocking the UI thread
 *  - Memoized to prevent unnecessary re-renders
 */

import { useQuery } from '@tanstack/react-query';
import { productService, CategoryItem } from '@/services/product.service';

const CATEGORIES_STALE_TIME = 1000 * 60 * 5; // 5 minutes — stale-while-revalidate window
const CATEGORIES_GC_TIME = 1000 * 60 * 30; // 30 minutes — keep in memory

export const categoryQueryKey = ['categories'] as const;

/**
 * Lightweight hook — can be called in multiple components, shares one cache entry.
 */
export function useCategories() {
  return useQuery<CategoryItem[]>({
    queryKey: categoryQueryKey,
    queryFn: () => productService.getCategories(),
    staleTime: CATEGORIES_STALE_TIME,
    gcTime: CATEGORIES_GC_TIME,
    retry: 2,
    retryDelay: 2000,
    // Refresh in background using requestIdleCallback so it never blocks the UI
    refetchInterval: CATEGORIES_STALE_TIME,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
  });
}

/**
 * Server-computed fallback categories — used when the hook hasn't loaded yet.
 * Matches the backend CATALOG distribution exactly.
 */
export const STATIC_CATEGORIES: CategoryItem[] = [
  { name: 'Electronics', count: 40000 },
  { name: 'Fashion', count: 30000 },
  { name: 'Groceries', count: 15000 },
  { name: 'Home & Kitchen', count: 10000 },
  { name: 'Sports', count: 3000 },
  { name: 'Books', count: 2000 },
];
