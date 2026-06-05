/**
 * useAuth Hook
 * - React Query + Zustand integration for auth
 * - Login, register, session management
 * - Comprehensive error handling
 */

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useApiErrorHandler } from '@/lib/error-handling';
import {
  authService,
  type User,
  type LoginRequest,
  type RegisterRequest,
  type UpdateProfileRequest,
  type ChangePasswordRequest,
  type Address,
} from '@/services/auth.service';
import { useUserStore } from '@/store/useUserStore';

/**
 * Query keys for auth
 */
export const authQueryKeys = {
  all: ['auth'] as const,
  me: () => [...authQueryKeys.all, 'me'] as const,
  addresses: () => [...authQueryKeys.all, 'addresses'] as const,
  paymentMethods: () => [...authQueryKeys.all, 'payment-methods'] as const,
};

/**
 * useCurrentUser - Get current authenticated user
 */
export const useCurrentUser = (enabled: boolean = true) => {
  const { setUser } = useUserStore();

  const query = useQuery({
    queryKey: authQueryKeys.me(),
    queryFn: () => authService.getCurrentUser(),
    enabled,
    staleTime: 1000 * 60 * 10, // 10 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
    retry: (failureCount, error) => {
      // Don't retry on auth errors — avoids 401/403 retry storm
      const msg = (error as any)?.message || '';
      if (msg.includes('401') || msg.includes('Unauthorized') || msg.includes('403')) return false;
      return failureCount < 2;
    },
  });

  // Handle user data update when query succeeds
  useEffect(() => {
    if (query.data) {
      setUser(query.data);
    }
  }, [query.data, setUser]);

  return query;
};

/**
 * useLogin - Login mutation
 */
export const useLogin = () => {
  const queryClient = useQueryClient();
  const { setUser } = useUserStore();
  const { handleError } = useApiErrorHandler();

  return useMutation({
    mutationFn: (credentials: LoginRequest) => authService.login(credentials),
    onSuccess: (response) => {
      // Cache user data
      queryClient.setQueryData(authQueryKeys.me(), response.user);
      setUser(response.user);

      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: authQueryKeys.all });

      toast.success('Logged in successfully');
    },
    onError: (error) => {
      const message = handleError(error);
      toast.error(message);
    },
  });
};

/**
 * useRegister - Registration mutation
 */
export const useRegister = () => {
  const queryClient = useQueryClient();
  const { setUser } = useUserStore();
  const { handleError } = useApiErrorHandler();

  return useMutation({
    mutationFn: (data: RegisterRequest) => authService.register(data),
    onSuccess: (response) => {
      queryClient.setQueryData(authQueryKeys.me(), response.user);
      setUser(response.user);
      queryClient.invalidateQueries({ queryKey: authQueryKeys.all });
      toast.success('Account created successfully');
    },
    onError: (error) => {
      const message = handleError(error);
      toast.error(message);
    },
  });
};

/**
 * useLogout - Logout mutation
 */
export const useLogout = () => {
  const queryClient = useQueryClient();
  const { clearUser } = useUserStore();

  return useMutation({
    mutationFn: () => authService.logout(),
    onSuccess: () => {
      // Clear cached data
      queryClient.removeQueries({ queryKey: authQueryKeys.all });
      queryClient.clear();

      // Clear user store
      clearUser();

      toast.success('Logged out successfully');
    },
  });
};

/**
 * useUpdateProfile - Update user profile mutation
 */
export const useUpdateProfile = () => {
  const queryClient = useQueryClient();
  const { setUser } = useUserStore();

  return useMutation({
    mutationFn: (data: UpdateProfileRequest) => authService.updateProfile(data),
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(authQueryKeys.me(), updatedUser);
      setUser(updatedUser);
      toast.success('Profile updated successfully');
    },
    onError: () => {
      toast.error('Failed to update profile');
    },
  });
};

/**
 * useChangePassword - Change password mutation
 */
export const useChangePassword = () => {
  return useMutation({
    mutationFn: (data: ChangePasswordRequest) => authService.changePassword(data),
    onSuccess: () => {
      toast.success('Password changed successfully');
    },
    onError: () => {
      toast.error('Failed to change password');
    },
  });
};

/**
 * useRequestPasswordReset - Request password reset
 */
export const useRequestPasswordReset = () => {
  return useMutation({
    mutationFn: (email: string) => authService.requestPasswordReset({ email }),
    onSuccess: () => {
      toast.success('Password reset instructions sent to your email');
    },
    onError: () => {
      toast.error('Failed to request password reset');
    },
  });
};

/**
 * useConfirmPasswordReset - Confirm password reset with code
 */
export const useConfirmPasswordReset = () => {
  return useMutation({
    mutationFn: (data: { code: string; newPassword: string; confirmPassword: string }) =>
      authService.confirmPasswordReset(data),
    onSuccess: () => {
      toast.success('Password reset successfully');
    },
    onError: () => {
      toast.error('Failed to reset password');
    },
  });
};

/**
 * useVerifyEmail - Verify email mutation
 */
export const useVerifyEmail = () => {
  return useMutation({
    mutationFn: (code: string) => authService.verifyEmail(code),
    onSuccess: () => {
      toast.success('Email verified successfully');
    },
    onError: () => {
      toast.error('Failed to verify email');
    },
  });
};

/**
 * useGetAddresses - Get user addresses
 */
export const useGetAddresses = (enabled: boolean = true) => {
  return useQuery({
    queryKey: authQueryKeys.addresses(),
    queryFn: () => authService.getAddresses(),
    enabled,
    staleTime: 1000 * 60 * 10, // 10 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
  });
};

/**
 * useAddAddress - Add new address mutation
 */
export const useAddAddress = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Omit<Address, 'id'>) => authService.addAddress(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authQueryKeys.addresses() });
      toast.success('Address added successfully');
    },
    onError: () => {
      toast.error('Failed to add address');
    },
  });
};

/**
 * useUpdateAddress - Update address mutation
 */
export const useUpdateAddress = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ addressId, data }: { addressId: string; data: Partial<Address> }) =>
      authService.updateAddress(addressId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authQueryKeys.addresses() });
      toast.success('Address updated successfully');
    },
    onError: () => {
      toast.error('Failed to update address');
    },
  });
};

/**
 * useDeleteAddress - Delete address mutation
 */
export const useDeleteAddress = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (addressId: string) => authService.deleteAddress(addressId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authQueryKeys.addresses() });
      toast.success('Address deleted successfully');
    },
    onError: () => {
      toast.error('Failed to delete address');
    },
  });
};

/**
 * useGetPaymentMethods - Get saved payment methods
 */
export const useGetPaymentMethods = (enabled: boolean = true) => {
  return useQuery({
    queryKey: authQueryKeys.paymentMethods(),
    queryFn: () => authService.getPaymentMethods(),
    enabled,
    staleTime: 1000 * 60 * 10, // 10 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
  });
};

/**
 * useVerifySession - Verify current session
 */
export const useVerifySession = () => {
  return useMutation({
    mutationFn: () => authService.verifySession(),
  });
};
