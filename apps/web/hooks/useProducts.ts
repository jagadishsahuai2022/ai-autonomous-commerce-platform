/**
 * useProducts Hook
 * - React Query integration for product queries
 * - Caching, pagination, filters
 * - Error handling with retry capability
 */

import {
  useQuery,
  useQueryClient,
  UseQueryResult,
  keepPreviousData,
  useInfiniteQuery,
} from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useApiErrorHandler } from '@/lib/error-handling';
import {
  productService,
  type ProductFilters,
  type Product,
  type PaginatedResponse,
  type ProductWithReviews,
  type Review,
} from '@/services/product.service';

/**
 * Query keys for products
 */
export const productQueryKeys = {
  all: ['products'] as const,
  lists: () => [...productQueryKeys.all, 'list'] as const,
  list: (filters: ProductFilters) => [...productQueryKeys.lists(), { ...filters }] as const,
  details: () => [...productQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...productQueryKeys.details(), id] as const,
  featured: () => [...productQueryKeys.all, 'featured'] as const,
  newArrivals: () => [...productQueryKeys.all, 'new-arrivals'] as const,
  search: (query: string) => [...productQueryKeys.all, 'search', query] as const,
  recommendations: (productId: string) =>
    [...productQueryKeys.all, 'recommendations', productId] as const,
  related: (productId: string) => [...productQueryKeys.all, 'related', productId] as const,
  reviews: (productId: string) => [...productQueryKeys.all, 'reviews', productId] as const,
};

/**
 * useProducts - Get paginated products with filters
 */
export const useProducts = (
  filters: ProductFilters = {}
): UseQueryResult<PaginatedResponse<Product>> & {
  retry: () => void;
} => {
  const { handleError } = useApiErrorHandler();
  const queryResult = useQuery({
    queryKey: productQueryKeys.list(filters),
    queryFn: () => productService.getProducts(filters),
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes (was cacheTime)
    placeholderData: keepPreviousData, // smooth pagination — show old data while new loads
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  return {
    ...queryResult,
    retry: () => queryResult.refetch(),
  };
};

/**
 * useProduct - Get single product by ID
 */
export const useProduct = (
  productId: string | null
): UseQueryResult<Product> & {
  retry: () => void;
} => {
  const queryResult = useQuery({
    queryKey: productId ? productQueryKeys.detail(productId) : ['product-no-id'],
    queryFn: () => productService.getProduct(productId!),
    enabled: !!productId,
    staleTime: 1000 * 60 * 10, // 10 minutes
    gcTime: 1000 * 60 * 60, // 1 hour
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  return {
    ...queryResult,
    retry: () => queryResult.refetch(),
  };
};

/**
 * useFeaturedProducts - Get featured products
 */
export const useFeaturedProducts = (
  limit: number = 12
): UseQueryResult<Product[]> & {
  retry: () => void;
} => {
  const queryResult = useQuery({
    queryKey: productQueryKeys.featured(),
    queryFn: () => productService.getFeaturedProducts(limit),
    staleTime: 1000 * 60 * 10, // 10 minutes
    gcTime: 1000 * 60 * 60, // 1 hour
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  return {
    ...queryResult,
    retry: () => queryResult.refetch(),
  };
};

/**
 * useNewArrivals - Get new arrival products
 */
export const useNewArrivals = (
  limit: number = 12
): UseQueryResult<Product[]> & {
  retry: () => void;
} => {
  const queryResult = useQuery({
    queryKey: productQueryKeys.newArrivals(),
    queryFn: () => productService.getNewArrivals(limit),
    staleTime: 1000 * 60 * 10, // 10 minutes
    gcTime: 1000 * 60 * 60, // 1 hour
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  return {
    ...queryResult,
    retry: () => queryResult.refetch(),
  };
};

/**
 * useSearchProducts - Search for products
 */
export const useSearchProducts = (
  query: string,
  enabled: boolean = true
): UseQueryResult<Product[]> & {
  retry: () => void;
} => {
  const queryResult = useQuery({
    queryKey: productQueryKeys.search(query),
    queryFn: () => productService.searchProducts(query),
    enabled: enabled && !!query.trim(),
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  return {
    ...queryResult,
    retry: () => queryResult.refetch(),
  };
};

/**
 * useProductRecommendations - Get recommended products
 */
export const useProductRecommendations = (
  productId: string | null,
  limit: number = 5
): UseQueryResult<Product[]> & {
  retry: () => void;
} => {
  const queryResult = useQuery({
    queryKey: productId ? productQueryKeys.recommendations(productId) : ['recommendations-no-id'],
    queryFn: () => productService.getRecommendations(productId!, limit),
    enabled: !!productId,
    staleTime: 1000 * 60 * 10, // 10 minutes
    gcTime: 1000 * 60 * 60, // 1 hour
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  return {
    ...queryResult,
    retry: () => queryResult.refetch(),
  };
};

/**
 * useRelatedProducts - Get related products
 */
export const useRelatedProducts = (
  productId: string | null,
  limit: number = 5
): UseQueryResult<Product[]> & {
  retry: () => void;
} => {
  const queryResult = useQuery({
    queryKey: productId ? productQueryKeys.related(productId) : ['related-no-id'],
    queryFn: () => productService.getRelatedProducts(productId!, limit),
    enabled: !!productId,
    staleTime: 1000 * 60 * 10, // 10 minutes
    gcTime: 1000 * 60 * 60, // 1 hour
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  return {
    ...queryResult,
    retry: () => queryResult.refetch(),
  };
};

/**
 * useProductReviews - Get reviews for a product
 */
export const useProductReviews = (
  productId: string,
  page: number = 1
): UseQueryResult<PaginatedResponse<Review>> & {
  retry: () => void;
} => {
  const queryResult = useQuery({
    queryKey: productQueryKeys.reviews(productId),
    queryFn: () => productService.getProductReviews(productId, page),
    enabled: !!productId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  return {
    ...queryResult,
    retry: () => queryResult.refetch(),
  };
};

/**
 * Prefetch products (useful for landing page or hovering over links)
 */
export const usePrefetchProduct = () => {
  const queryClient = useQueryClient();

  return (productId: string) => {
    queryClient.prefetchQuery({
      queryKey: productQueryKeys.detail(productId),
      queryFn: () => productService.getProduct(productId),
    });
  };
};

/**
 * Prefetch featured products
 */
export const usePrefetchFeaturedProducts = () => {
  const queryClient = useQueryClient();

  return (limit: number = 12) => {
    queryClient.prefetchQuery({
      queryKey: productQueryKeys.featured(),
      queryFn: () => productService.getFeaturedProducts(limit),
    });
  };
};

/**
 * useInfiniteProducts - Infinite scroll pagination for products page.
 * All filter params are forwarded to the backend for true server-side filtering.
 * When any filter changes the query key changes → cache busts → fresh server response.
 */
export const useInfiniteProducts = (
  filters: Omit<ProductFilters, 'page'> = {},
  pageSize: number = 20,
  enabled: boolean = true
) => {
  return useInfiniteQuery({
    queryKey: [...productQueryKeys.lists(), 'infinite', { ...filters, pageSize }],
    queryFn: ({ pageParam }: { pageParam: number }) =>
      productService.getProducts({ ...filters, page: pageParam, limit: pageSize }),
    initialPageParam: 1,
    getNextPageParam: (lastPage: PaginatedResponse<Product>) => {
      const { page, totalPages } = lastPage;
      return page < totalPages ? page + 1 : undefined;
    },
    // No maxPages cap: removing the limit prevents React Query from evicting old
    // pages when crossing the boundary (which caused virtualizer position jumps /
    // "flickering" of product names at ~1,000 products).
    staleTime: 1000 * 60 * 2, // 2 min — matches NestJS PRODUCT_LIST_CACHE_TTL
    gcTime: 1000 * 60 * 30,
    enabled,
  });
};
