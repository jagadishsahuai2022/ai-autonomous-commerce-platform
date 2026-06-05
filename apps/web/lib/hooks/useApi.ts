/**
 * React Query Hooks
 * Ready-to-use hooks for API operations with automatic loading/error/caching
 * Replaces manual useState for async operations
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queries/queryClient';
import { Product, Order } from '@/lib/types/commerce';

/**
 * Fetch products with filtering
 *
 * Usage:
 * const { data: products, isLoading, error } = useProducts({ category: 'laptops' });
 */
export function useProducts(filters?: Record<string, any>) {
  return useQuery({
    queryKey: queryKeys.products.list(filters),
    queryFn: async () => {
      const params = new URLSearchParams(filters || {});
      const res = await fetch(`/api/products?${params}`, {
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Failed to fetch products');
      return res.json() as Promise<Product[]>;
    },
  });
}

/**
 * Fetch single product details
 */
export function useProduct(id: string) {
  return useQuery({
    queryKey: queryKeys.products.detail(id),
    queryFn: async () => {
      const res = await fetch(`/api/products/${id}`);
      if (!res.ok) throw new Error('Product not found');
      return res.json() as Promise<Product>;
    },
    enabled: !!id,
  });
}

/**
 * Fetch user's orders
 * Auto-refetch every 10 seconds for real-time updates
 */
export function useOrders() {
  return useQuery({
    queryKey: queryKeys.orders.list(),
    queryFn: async () => {
      const res = await fetch('/api/orders');
      if (!res.ok) throw new Error('Failed to fetch orders');
      return res.json() as Promise<Order[]>;
    },
    refetchInterval: 10000, // Poll every 10s
  });
}

/**
 * Fetch order details with real-time status
 */
export function useOrder(id: string) {
  return useQuery({
    queryKey: queryKeys.orders.detail(id),
    queryFn: async () => {
      const res = await fetch(`/api/orders/${id}`);
      if (!res.ok) throw new Error('Order not found');
      return res.json() as Promise<Order>;
    },
    enabled: !!id,
    refetchInterval: 5000, // Poll every 5s for active orders
  });
}

/**
 * Create order mutation
 * Optimistic update + automatic cache invalidation
 *
 * Usage:
 * const { mutate: createOrder, isPending } = useCreateOrder();
 * createOrder({ items: [...] }, {
 *   onSuccess: (order) => console.log('Order created:', order)
 * });
 */
export function useCreateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderData: any) => {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      });
      if (!res.ok) throw new Error('Failed to create order');
      return res.json() as Promise<Order>;
    },
    // Optimistic update
    onMutate: async (newOrder) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.orders.list() });
      const previousOrders = queryClient.getQueryData<Order[]>(queryKeys.orders.list());

      if (previousOrders) {
        queryClient.setQueryData(queryKeys.orders.list(), (old: Order[]) => [
          ...old,
          { ...newOrder, id: 'temp' } as Order,
        ]);
      }

      return { previousOrders };
    },
    // Rollback on error
    onError: (_, __, context) => {
      if (context?.previousOrders) {
        queryClient.setQueryData(queryKeys.orders.list(), context.previousOrders);
      }
    },
    // Invalidate cache on success
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.list() });
      queryClient.setQueryData(queryKeys.orders.detail(order.id), order);
    },
  });
}

/**
 * Update order mutation
 */
export function useUpdateOrder(orderId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updateData: any) => {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });
      if (!res.ok) throw new Error('Failed to update order');
      return res.json() as Promise<Order>;
    },
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(orderId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.list() });
    },
  });
}

/**
 * Fetch AI recommendations
 */
export function useRecommendations(userId?: string) {
  return useQuery({
    queryKey: userId
      ? queryKeys.recommendations.personalized(userId)
      : queryKeys.recommendations.ai(),
    queryFn: async () => {
      const url = userId ? `/api/recommendations?userId=${userId}` : '/api/recommendations';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch recommendations');
      return res.json() as Promise<Product[]>;
    },
    staleTime: 2 * 60 * 1000, // Cache for 2 minutes
  });
}

/**
 * Search products
 */
export function useSearchProducts(query: string) {
  return useQuery({
    queryKey: queryKeys.products.search(query),
    queryFn: async () => {
      const res = await fetch(`/api/products/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error('Search failed');
      return res.json() as Promise<Product[]>;
    },
    enabled: query.length > 2,
    staleTime: 1 * 60 * 1000, // Cache for 1 minute
  });
}

/**
 * Add to cart mutation
 */
export function useAddToCart() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (cartItem: any) => {
      const res = await fetch('/api/cart/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cartItem),
      });
      if (!res.ok) throw new Error('Failed to add to cart');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cart.items() });
      queryClient.invalidateQueries({ queryKey: queryKeys.cart.summary() });
    },
  });
}

/**
 * Remove from cart mutation
 */
export function useRemoveFromCart() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (itemId: string) => {
      const res = await fetch(`/api/cart/items/${itemId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to remove item');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cart.items() });
      queryClient.invalidateQueries({ queryKey: queryKeys.cart.summary() });
    },
  });
}
