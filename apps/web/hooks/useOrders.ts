'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useApiErrorHandler } from './useApiErrorHandler';

export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  status: string;
  totalAmount: number;
  subtotal: number;
  tax: number;
  shippingCost: number;
  discount: number;
  shippingMethod: string;
  paymentMethod: string;
  addressId: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  estimatedDelivery?: string;
  items: OrderItem[];
  address?: any;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  quantity: number;
  price: number;
}

export interface CreateOrderData {
  items: Array<{ productId: string; quantity: number; price: number }>;
  addressId: string;
  shippingMethod: string;
  paymentMethod: string;
  totalAmount: number;
  subtotal: number;
  tax: number;
  shippingCost: number;
  discount?: number;
  notes?: string;
}

// Get all orders for user
export function useOrders(options?: { limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ['orders', options?.limit, options?.offset],
    queryFn: async () => {
      try {
        const response = await apiClient.get('/orders', {
          params: { limit: options?.limit || 10, offset: options?.offset || 0 },
        });
        return response.data;
      } catch {
        // Return empty orders list on API failure (e.g. auth/backend not available)
        return { orders: [], total: 0 };
      }
    },
    staleTime: 5 * 60 * 1000,
  });
}

// Get single order details
export function useOrder(orderId: string) {
  return useQuery({
    queryKey: ['order', orderId],
    queryFn: async (): Promise<Order> => {
      const response = await apiClient.get(`/orders/${orderId}`);
      return response.data;
    },
    enabled: !!orderId,
    staleTime: 5 * 60 * 1000,
  });
}

// Create order
export function useCreateOrder() {
  const { handleError, showSuccess } = useApiErrorHandler();

  return useMutation({
    mutationFn: async (data: CreateOrderData) => {
      const response = await apiClient.post('/api/orders', data);
      return response.data;
    },
    onSuccess: (data) => {
      showSuccess('Order created successfully');
      return data;
    },
    onError: (error) => {
      handleError(error, 'Failed to create order');
    },
  });
}

// Cancel order
export function useCancelOrder(orderId: string) {
  const { handleError, showSuccess } = useApiErrorHandler();

  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.patch(`/api/orders/${orderId}/cancel`);
      return response.data;
    },
    onSuccess: () => {
      showSuccess('Order cancelled successfully');
    },
    onError: (error) => {
      handleError(error, 'Failed to cancel order');
    },
  });
}

// Get order tracking
export function useOrderTracking(orderId: string) {
  return useQuery({
    queryKey: ['order-tracking', orderId],
    queryFn: async () => {
      const response = await apiClient.get(`/api/orders/${orderId}/tracking`);
      return response.data;
    },
    enabled: !!orderId,
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
  });
}
