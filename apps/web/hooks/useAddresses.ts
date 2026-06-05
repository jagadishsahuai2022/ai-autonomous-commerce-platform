'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useApiErrorHandler } from './useApiErrorHandler';

// Types
export interface Address {
  id: string;
  label: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAddressData {
  label: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
  isDefault?: boolean;
}

// Query hooks
export function useAddresses() {
  return useQuery({
    queryKey: ['addresses'],
    queryFn: async () => {
      const response = await apiClient.get('/api/addresses');
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useAddress(id: string) {
  return useQuery({
    queryKey: ['address', id],
    queryFn: async () => {
      const response = await apiClient.get(`/api/addresses/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
}

export function useDefaultAddress() {
  return useQuery({
    queryKey: ['address', 'default'],
    queryFn: async () => {
      const response = await apiClient.get('/api/addresses/default/current');
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

// Mutation hooks
export function useCreateAddress() {
  const queryClient = useQueryClient();
  const { handleError, showSuccess } = useApiErrorHandler();

  return useMutation({
    mutationFn: async (data: CreateAddressData) => {
      const response = await apiClient.post('/api/addresses', data);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
      showSuccess('Address added successfully');
      return data;
    },
    onError: (error) => {
      handleError(error, 'Failed to add address');
    },
  });
}

export function useUpdateAddress(id: string) {
  const queryClient = useQueryClient();
  const { handleError, showSuccess } = useApiErrorHandler();

  return useMutation({
    mutationFn: async (data: CreateAddressData) => {
      const response = await apiClient.patch(`/api/addresses/${id}`, data);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['address', id] });
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
      showSuccess('Address updated successfully');
      return data;
    },
    onError: (error) => {
      handleError(error, 'Failed to update address');
    },
  });
}

export function useDeleteAddress(id: string) {
  const queryClient = useQueryClient();
  const { handleError, showSuccess } = useApiErrorHandler();

  return useMutation({
    mutationFn: async () => {
      await apiClient.delete(`/api/addresses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
      queryClient.invalidateQueries({ queryKey: ['address', 'default'] });
      showSuccess('Address deleted successfully');
    },
    onError: (error) => {
      handleError(error, 'Failed to delete address');
    },
  });
}

export function useSetDefaultAddress(id: string) {
  const queryClient = useQueryClient();
  const { handleError, showSuccess } = useApiErrorHandler();

  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.post(`/api/addresses/${id}/set-default`);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
      queryClient.invalidateQueries({ queryKey: ['address', 'default'] });
      showSuccess('Default address updated');
      return data;
    },
    onError: (error) => {
      handleError(error, 'Failed to set default address');
    },
  });
}
