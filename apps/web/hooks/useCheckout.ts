'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useApiErrorHandler } from './useApiErrorHandler';

export interface CartItem {
  productId: string;
  quantity: number;
  price: number;
}

export interface ValidateCheckoutData {
  items: CartItem[];
  addressId: string;
  shippingMethod: 'standard' | 'express' | 'premium';
  appliedCoupons?: string[];
  notes?: string;
}

export interface CheckoutPreview {
  subtotal: number;
  tax: number;
  shippingCost: number;
  discount: number;
  total: number;
  items: CartItem[];
  address: any;
  shippingMethod: string;
  estimatedDelivery: string;
}

export interface CreateOrderData extends ValidateCheckoutData {
  paymentMethod: string;
}

// Validation hook
export function useValidateCheckout() {
  const { handleError } = useApiErrorHandler();

  return useMutation({
    mutationFn: async (data: ValidateCheckoutData) => {
      const response = await apiClient.post('/api/checkout/validate', data);
      return response.data;
    },
    onError: (error) => {
      handleError(error, 'Checkout validation failed');
    },
  });
}

// Preview hook
export function useCheckoutPreview() {
  const { handleError } = useApiErrorHandler();

  return useMutation({
    mutationFn: async (data: ValidateCheckoutData): Promise<CheckoutPreview> => {
      const response = await apiClient.post('/api/checkout/preview', data);
      return response.data;
    },
    onError: (error) => {
      handleError(error, 'Failed to generate checkout preview');
    },
  });
}

// Create order hook
export function useCreateOrder() {
  const { handleError, showSuccess } = useApiErrorHandler();

  return useMutation({
    mutationFn: async (data: CreateOrderData) => {
      const response = await apiClient.post('/api/checkout/complete', data);
      return response.data;
    },
    onSuccess: () => {
      showSuccess('Order created successfully');
    },
    onError: (error) => {
      handleError(error, 'Failed to create order');
    },
  });
}
