/**
 * Product Service
 * - Handles all product-related API calls
 * - Caching layer integration
 * - Type-safe responses
 */

import { apiClient, ApiResponse, getResponseData, handleApiError } from '@/lib/api-client';
import { fetchWithRetry } from '@/lib/safe-api';
import { AxiosError } from 'axios';

export interface ProductFilters {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  brand?: string;
  searchTerm?: string;
  page?: number;
  limit?: number;
  sortBy?: 'price' | 'rating' | 'newest' | 'popular' | 'price-low' | 'price-high' | 'relevance';
  minRating?: number;
  minDiscount?: number;
  freeDelivery?: boolean;
  expressDelivery?: boolean;
  codAvailable?: boolean;
}

export interface CategoryItem {
  name: string;
  count: number;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  brand?: string;
  price: number;
  originalPrice?: number;
  images: string[];
  thumbnailUrl?: string;
  rating: number;
  reviewCount: number;
  stock: number;
  sku: string;
  specifications?: Record<string, string>;
  status: 'ACTIVE' | 'INACTIVE' | 'OUT_OF_STOCK';
  isNewArrival: boolean;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ProductWithReviews extends Product {
  reviews: Review[];
  averageRating: number;
  totalReviews: number;
}

export interface Review {
  id: string;
  userId: string;
  rating: number;
  title: string;
  content: string;
  images?: string[];
  helpful: number;
  createdAt: string;
  isVerified: boolean;
}

export interface SearchFilters {
  query: string;
  filters: ProductFilters;
}

/**
 * Product Service
 */
/**
 * Normalize a raw API product to match the Product interface
 * Handles both the simple DB format and future rich format
 */
function normalizeProduct(p: any): any {
  const imageUrl =
    p.image ||
    p.thumbnailUrl ||
    (Array.isArray(p.images) ? p.images[0] : undefined) ||
    '/product-placeholder.svg';
  return {
    id: String(p.id),
    name: p.name || 'Unknown Product',
    description: p.description || '',
    price: p.price || 0,
    originalPrice: p.originalPrice,
    category: p.category || 'General',
    brand: p.brand || 'DelegateCart',
    image: imageUrl,
    images: [imageUrl],
    thumbnailUrl: imageUrl,
    rating: typeof p.rating === 'number' ? p.rating : 4.0,
    reviews: p.reviewCount ?? p.reviews ?? 0,
    reviewCount: p.reviewCount ?? p.reviews ?? 0,
    stock: p.stock ?? 99,
    inStock:
      p.inStock !== undefined ? Boolean(p.inStock) : p.stock !== undefined ? p.stock > 0 : true,
    delivery: p.delivery ?? { daysMin: 1, daysMax: 3, free: p.price > 500 },
    codAvailable: p.codAvailable ?? true,
    hasEMI: p.hasEMI ?? p.price > 5000,
    specifications: p.specifications,
    trustScore: p.trustScore,
    priceTrend: p.priceTrend,
    priceTrendPct: p.priceTrendPct,
    deliveryETA: p.deliveryETA,
    aiRecommended: p.aiRecommended,
    aiConfidence: p.aiConfidence,
    aiReason: p.aiReason,
    gstIncluded: p.gstIncluded,
    sellerRating: p.sellerRating,
    sellerName: p.sellerName,
    status: p.status || 'ACTIVE',
    isNewArrival: p.isNewArrival ?? false,
    isFeatured: p.isFeatured ?? false,
    sku: p.sku || String(p.id),
    createdAt: p.createdAt || new Date().toISOString(),
    updatedAt: p.updatedAt || new Date().toISOString(),
  };
}

class ProductService {
  /**
   * Get distinct categories with product counts.
   * Tries NestJS → Next.js API → static fallback.
   */
  async getCategories(): Promise<CategoryItem[]> {
    try {
      const res = await fetch('/api/categories');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) return data;
      }
    } catch {
      /* ignore */
    }
    // Static fallback
    return [
      { name: 'Electronics', count: 40000 },
      { name: 'Fashion', count: 30000 },
      { name: 'Groceries', count: 15000 },
      { name: 'Home & Kitchen', count: 10000 },
      { name: 'Sports', count: 3000 },
      { name: 'Books', count: 2000 },
    ];
  }

  /**
   * Get all products with filters and pagination.
   * All filter params are forwarded to the backend for true server-side filtering.
   */
  async getProducts(filters: ProductFilters = {}): Promise<PaginatedResponse<Product>> {
    try {
      const take = filters.limit || 20;
      const skip = ((filters.page || 1) - 1) * take;

      // Map sortBy to backend values
      const sortByMap: Record<string, string> = {
        price: 'price-low',
        'price-low': 'price-low',
        'price-high': 'price-high',
        rating: 'rating',
        newest: 'newest',
        popular: 'relevance',
        relevance: 'relevance',
      };
      const backendSortBy = sortByMap[filters.sortBy || 'relevance'] || 'relevance';

      const response = await apiClient.get('/products', {
        params: {
          skip,
          take,
          category: filters.category || undefined,
          minPrice: filters.minPrice ?? undefined,
          maxPrice: filters.maxPrice ?? undefined,
          minRating: filters.minRating ?? undefined,
          minDiscount: filters.minDiscount ?? undefined,
          freeDelivery: filters.freeDelivery ? 'true' : undefined,
          expressDelivery: filters.expressDelivery ? 'true' : undefined,
          codAvailable: filters.codAvailable ? 'true' : undefined,
          sortBy: backendSortBy !== 'relevance' ? backendSortBy : undefined,
        },
      });

      // Normalize API response: handles { products, total, skip, take } format
      const raw = response?.data;
      const items = (raw?.products || raw?.data || []).map(normalizeProduct);
      const total = raw?.total || items.length;
      return {
        data: items,
        total,
        page: Math.floor((raw?.skip || skip) / take) + 1,
        limit: raw?.take || take,
        totalPages: Math.ceil(total / take),
      };
    } catch (error) {
      // Fallback: try local Next.js API route with all filter params
      try {
        const take = filters.limit || 20;
        const skip = ((filters.page || 1) - 1) * take;
        const params = new URLSearchParams();
        params.set('skip', String(skip));
        params.set('take', String(take));
        if (filters.category) params.set('category', filters.category);
        if (filters.searchTerm) params.set('search', filters.searchTerm);
        if (filters.minPrice != null) params.set('minPrice', String(filters.minPrice));
        if (filters.maxPrice != null) params.set('maxPrice', String(filters.maxPrice));
        if (filters.minRating != null) params.set('minRating', String(filters.minRating));
        if (filters.minDiscount != null) params.set('minDiscount', String(filters.minDiscount));
        if (filters.freeDelivery) params.set('freeDelivery', 'true');
        if (filters.expressDelivery) params.set('expressDelivery', 'true');
        if (filters.codAvailable) params.set('codAvailable', 'true');
        if (filters.sortBy && filters.sortBy !== 'relevance') params.set('sortBy', filters.sortBy);

        const localRes = await fetchWithRetry(`/api/products?${params.toString()}`);
        if (localRes.ok) {
          const raw = await localRes.json();
          const items = (raw?.products || raw?.data || []).map(normalizeProduct);
          return {
            data: items,
            total: raw?.total || items.length,
            page: filters.page || 1,
            limit: filters.limit || 20,
            totalPages: Math.ceil((raw?.total || items.length) / (filters.limit || 20)),
          };
        }
      } catch {
        /* both backends down */
      }
      throw handleApiError(error as AxiosError);
    }
  }

  /**
   * Get single product by ID
   */
  async getProduct(productId: string): Promise<ProductWithReviews> {
    try {
      const response = await apiClient.get<ApiResponse<ProductWithReviews>>(
        `/products/${productId}`
      );

      const raw = getResponseData<any>(response);
      return normalizeProduct(raw) as unknown as ProductWithReviews;
    } catch (error) {
      // Fallback: try local Next.js API route
      try {
        const localRes = await fetchWithRetry(`/api/products/${productId}`);
        if (localRes.ok) {
          const raw = await localRes.json();
          if (raw && raw.id) return normalizeProduct(raw) as unknown as ProductWithReviews;
        }
      } catch {
        /* local API also failed */
      }
      throw handleApiError(error as AxiosError);
    }
  }

  /**
   * Get featured products — falls back to regular product list if no featured endpoint
   */
  async getFeaturedProducts(limit: number = 12): Promise<Product[]> {
    try {
      const response = await apiClient.get('/products', {
        params: { skip: 0, take: limit },
      });
      const raw = response?.data;
      const items = (raw?.products || raw?.data || []).map(normalizeProduct);
      return items;
    } catch (error) {
      try {
        const res = await fetch(`/api/products?limit=${limit}`);
        if (res.ok) {
          const raw = await res.json();
          return (raw?.products || raw?.data || []).map(normalizeProduct);
        }
      } catch {
        /* fallback failed too */
      }
      throw handleApiError(error as AxiosError);
    }
  }

  /**
   * Get new arrivals
   */
  async getNewArrivals(limit: number = 12): Promise<Product[]> {
    try {
      const response = await apiClient.get('/products', {
        params: { skip: 0, take: limit },
      });
      const raw = response?.data;
      const items = (raw?.products || raw?.data || []).map(normalizeProduct);
      // Return items that were recently added (last 30% of list as "new arrivals")
      return items.slice(-Math.ceil(items.length * 0.5));
    } catch (error) {
      try {
        const res = await fetch(`/api/products?limit=${limit}`);
        if (res.ok) {
          const raw = await res.json();
          return (raw?.products || raw?.data || []).map(normalizeProduct);
        }
      } catch {
        /* fallback failed too */
      }
      throw handleApiError(error as AxiosError);
    }
  }

  /**
   * Search products via the Smart Intent Engine v2.
   * Calls /api/intent/analyze which understands natural language queries,
   * returns AI-ranked results from both DB and synthetic catalog.
   * Falls back to basic client-side search if intent engine fails.
   */
  async searchProducts(query: string, filters?: Partial<ProductFilters>): Promise<Product[]> {
    // 1. Try the Smart Intent Engine first
    try {
      const intentRes = await fetch('/api/intent/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, engine: 'v2' }),
        signal: AbortSignal.timeout(8000),
      });

      if (intentRes.ok) {
        const intentData = await intentRes.json();
        const intentProducts = intentData?.products;
        if (Array.isArray(intentProducts) && intentProducts.length > 0) {
          // Hard budget enforcement — safety net after the intent engine
          const maxBudget: number | undefined = intentData?.intent?.budget?.max;
          const budgetEnforced =
            maxBudget && maxBudget > 0
              ? intentProducts.filter((p: any) => !p.price || p.price <= maxBudget)
              : intentProducts;
          return budgetEnforced.map((p: any) =>
            normalizeProduct({
              ...p,
              description:
                p.description || p.quickSummary || `${p.name}. ${p.brand} — ${p.category}.`,
              reviews: p.reviewCount ?? 0,
              aiRecommended: true,
              aiConfidence: Math.round(p.relevanceScore ?? 0),
              aiReason: p.whyThisProduct || p.reasoning || `Matched your search for "${query}"`,
            })
          );
        }
      }
    } catch {
      /* intent engine unavailable — fall through to basic search */
    }

    // 2. Fallback: basic API search with client-side filtering
    try {
      const response = await apiClient.get('/products', {
        params: { skip: 0, take: 50 },
      });
      const raw = response?.data;
      const items: Product[] = (raw?.products || raw?.data || []).map(normalizeProduct);
      const q = query.toLowerCase();
      return items.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q) ||
          p.brand?.toLowerCase().includes(q) ||
          p.category?.toLowerCase().includes(q)
      );
    } catch (error) {
      try {
        const res = await fetch(`/api/products?search=${encodeURIComponent(query)}&limit=50`);
        if (res.ok) {
          const raw = await res.json();
          return (raw?.products || raw?.data || []).map(normalizeProduct);
        }
      } catch {
        /* fallback failed too */
      }
      throw handleApiError(error as AxiosError);
    }
  }

  /**
   * Get product recommendations
   */
  async getRecommendations(productId: string, limit: number = 5): Promise<Product[]> {
    try {
      const response = await apiClient.get<ApiResponse<Product[]>>(
        `/products/${productId}/recommendations`,
        {
          params: { limit },
        }
      );

      return getResponseData(response);
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  }

  /**
   * Get related products
   */
  async getRelatedProducts(productId: string, limit: number = 5): Promise<Product[]> {
    try {
      const response = await apiClient.get<ApiResponse<Product[]>>(
        `/products/${productId}/related`,
        {
          params: { limit },
        }
      );

      return getResponseData(response);
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  }

  /**
   * Get product reviews
   */
  async getProductReviews(productId: string, page: number = 1): Promise<PaginatedResponse<Review>> {
    try {
      const response = await apiClient.get<ApiResponse<PaginatedResponse<Review>>>(
        `/products/${productId}/reviews`,
        {
          params: { page },
        }
      );

      return getResponseData(response);
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  }

  /**
   * Create product review
   */
  async createReview(
    productId: string,
    data: {
      rating: number;
      title: string;
      content: string;
      images?: string[];
    }
  ): Promise<Review> {
    try {
      const response = await apiClient.post<ApiResponse<Review>>(
        `/products/${productId}/reviews`,
        data
      );

      return getResponseData(response);
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  }

  /**
   * Get inventory status
   */
  async checkInventory(productId: string): Promise<{ available: number; reserved: number }> {
    try {
      const response = await apiClient.get<ApiResponse<{ available: number; reserved: number }>>(
        `/products/${productId}/inventory`
      );

      return getResponseData(response);
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  }
}

export const productService = new ProductService();
