'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useApiErrorHandler } from './useApiErrorHandler';

export interface Payment {
  id: string;
  orderId: string;
  method: string;
  amount: number;
  transactionId: string;
  status: string;
  failureReason?: string;
  refundedAmount: number;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface RazorpayInitResponse {
  razorpay_order_id: string;
  razorpay_key_id: string;
  amount: number;
  currency: string;
  prefill: {
    name: string;
    email: string;
    contact: string;
  };
}

// Initiate payment hook
export function useInitiatePayment() {
  const { handleError } = useApiErrorHandler();

  return useMutation({
    mutationFn: async (data: { orderId: string; method: string; returnUrl?: string }) => {
      const response = await apiClient.post('/api/payments/initiate', data);
      return response.data;
    },
    onError: (error) => {
      handleError(error, 'Failed to initiate payment');
    },
  });
}

// Verify payment hook
export function useVerifyPayment() {
  const queryClient = useQueryClient();
  const { handleError, showSuccess } = useApiErrorHandler();

  return useMutation({
    mutationFn: async (data: { orderId: string; transactionId: string; response?: any }) => {
      const response = await apiClient.post('/api/payments/verify', data);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['payment'] });
      showSuccess('Payment verified successfully');
      return data;
    },
    onError: (error) => {
      handleError(error, 'Payment verification failed');
    },
  });
}

// Get payment by order ID
export function usePaymentByOrderId(orderId: string) {
  return useQuery({
    queryKey: ['payment', orderId],
    queryFn: async (): Promise<Payment> => {
      const response = await apiClient.get(`/api/payments/order/${orderId}`);
      return response.data;
    },
    enabled: !!orderId,
  });
}

// Get payment by ID
export function usePaymentById(id: string) {
  return useQuery({
    queryKey: ['payment', id],
    queryFn: async (): Promise<Payment> => {
      const response = await apiClient.get(`/api/payments/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
}

// Get user's payment history
export function usePaymentHistory(limit: number = 10, offset: number = 0) {
  return useQuery({
    queryKey: ['payments', 'history', limit, offset],
    queryFn: async (): Promise<Payment[]> => {
      const response = await apiClient.get('/api/payments', {
        params: { limit, offset },
      });
      return response.data;
    },
  });
}
