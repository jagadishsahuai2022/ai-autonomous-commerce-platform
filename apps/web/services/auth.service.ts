/**
 * Auth Service
 * - Login, register, logout
 * - JWT token management
 * - Password reset
 * - User profile
 */

import { apiClient, ApiResponse, getResponseData, handleApiError } from '@/lib/api-client';
import { AxiosError } from 'axios';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  avatar?: string;
  role: 'CUSTOMER' | 'SELLER' | 'ADMIN';
  emailVerified: boolean;
  createdAt: string;
  preferences?: {
    notifications: boolean;
    newsletter: boolean;
    theme: 'light' | 'dark' | 'system';
  };
}

export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}

export interface RegisterRequest {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
  phoneNumber?: string;
}

export interface RegisterResponse {
  user: User;
  accessToken: string;
  message: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirmRequest {
  code: string;
  newPassword: string;
  confirmPassword: string;
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatar?: string;
  preferences?: {
    notifications?: boolean;
    newsletter?: boolean;
    theme?: 'light' | 'dark' | 'system';
  };
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface Address {
  id: string;
  type: 'BILLING' | 'SHIPPING';
  firstName: string;
  lastName: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  phone: string;
  isDefault: boolean;
}

/**
 * Auth Service
 */
class AuthService {
  /**
   * Login user
   */
  async login(data: LoginRequest): Promise<LoginResponse> {
    try {
      const response = await apiClient.post<ApiResponse<LoginResponse>>('/auth/login', data);
      const result = getResponseData(response) as LoginResponse;

      // Store token in localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('auth_token', result.accessToken);
        if (result.refreshToken) {
          localStorage.setItem('refresh_token', result.refreshToken);
        }
        localStorage.setItem('user', JSON.stringify(result.user));
      }

      return result;
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  }

  /**
   * Register new user
   */
  async register(data: RegisterRequest): Promise<RegisterResponse> {
    try {
      const response = await apiClient.post<ApiResponse<RegisterResponse>>('/auth/register', data);
      const result = getResponseData(response) as RegisterResponse;

      // Store token in localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('auth_token', result.accessToken);
        localStorage.setItem('user', JSON.stringify(result.user));
      }

      return result;
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    try {
      await apiClient.post('/auth/logout');

      // Clear auth data from localStorage
      if (typeof window !== 'undefined') {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
      }
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(): Promise<string> {
    try {
      const refreshToken =
        typeof window !== 'undefined' ? localStorage.getItem('refresh_token') : null;

      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await apiClient.post<ApiResponse<{ accessToken: string }>>('/auth/refresh', {
        refreshToken,
      });

      const result = getResponseData(response) as { accessToken: string };

      // Update token in localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('auth_token', result.accessToken);
      }

      return result.accessToken;
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  }

  /**
   * Get current user
   */
  async getCurrentUser(): Promise<User> {
    try {
      // Prefer local Next.js auth endpoint to avoid noisy 404s from optional external API
      const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
      const email = typeof window !== 'undefined' ? localStorage.getItem('userEmail') || '' : '';

      const localRes = await fetch('/api/auth/me', {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(email ? { 'X-User-Email': email } : {}),
        },
      });

      if (localRes.ok) {
        const data = await localRes.json();
        const user: User = {
          id: data.id,
          email: data.email,
          firstName: data.firstName || data.name?.split(' ')[0] || '',
          lastName: data.lastName || data.name?.split(' ').slice(1).join(' ') || '',
          role: (data.role as User['role']) || 'CUSTOMER',
          emailVerified: data.emailVerified ?? true,
          createdAt: data.createdAt || new Date().toISOString(),
          avatar: data.avatar || undefined,
        };
        if (typeof window !== 'undefined') {
          localStorage.setItem('user', JSON.stringify(user));
        }
        return user;
      }

      // External API fallback kept for backward compatibility
      const response = await apiClient.get<ApiResponse<User>>('/auth/me');
      const user = getResponseData(response) as User;
      if (typeof window !== 'undefined') {
        localStorage.setItem('user', JSON.stringify(user));
      }
      return user;
    } catch (error) {
      // Try local Next.js profile API as fallback
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
        if (token) {
          const email = typeof window !== 'undefined' ? localStorage.getItem('userEmail') || '' : '';
          const res = await fetch('/api/user/profile', { headers: { Authorization: `Bearer ${token}`, 'X-User-Email': email } });
          if (res.ok) {
            const data = await res.json();
            return { id: data.id, email: data.email, firstName: data.name?.split(' ')[0] || '', lastName: data.name?.split(' ').slice(1).join(' ') || '', role: 'CUSTOMER', emailVerified: true, createdAt: data.createdAt || new Date().toISOString() } as User;
          }
        }
      } catch { /* local API also down */ }
      // Try localStorage cache
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem('user');
        if (cached) { try { return JSON.parse(cached); } catch { /* invalid cache */ } }
      }
      throw handleApiError(error as AxiosError);
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(data: UpdateProfileRequest): Promise<User> {
    try {
      const response = await apiClient.put<ApiResponse<User>>('/auth/profile', data);
      const result = getResponseData(response) as User;

      // Update user in localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('user', JSON.stringify(result));
      }

      return result;
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  }

  /**
   * Change password
   */
  async changePassword(data: ChangePasswordRequest): Promise<{ message: string }> {
    try {
      const response = await apiClient.post<ApiResponse<{ message: string }>>(
        '/auth/change-password',
        data
      );
      return getResponseData(response);
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(data: PasswordResetRequest): Promise<{ message: string }> {
    try {
      const response = await apiClient.post<ApiResponse<{ message: string }>>(
        '/auth/forgot-password',
        data
      );
      return getResponseData(response);
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  }

  /**
   * Confirm password reset with code
   */
  async confirmPasswordReset(data: PasswordResetConfirmRequest): Promise<{ message: string }> {
    try {
      const response = await apiClient.post<ApiResponse<{ message: string }>>(
        '/auth/reset-password',
        data
      );
      return getResponseData(response);
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  }

  /**
   * Verify email
   */
  async verifyEmail(code: string): Promise<{ message: string }> {
    try {
      const response = await apiClient.post<ApiResponse<{ message: string }>>(
        '/auth/verify-email',
        { code }
      );
      return getResponseData(response);
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  }

  /**
   * Resend verification email
   */
  async resendVerificationEmail(): Promise<{ message: string }> {
    try {
      const response = await apiClient.post<ApiResponse<{ message: string }>>(
        '/auth/resend-verification'
      );
      return getResponseData(response);
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  }

  /**
   * Get user addresses
   */
  async getAddresses(): Promise<Address[]> {
    try {
      const response = await apiClient.get<ApiResponse<Address[]>>('/users/addresses');
      return getResponseData(response);
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  }

  /**
   * Add address
   */
  async addAddress(data: Omit<Address, 'id'>): Promise<Address> {
    try {
      const response = await apiClient.post<ApiResponse<Address>>('/users/addresses', data);
      return getResponseData(response);
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  }

  /**
   * Update address
   */
  async updateAddress(addressId: string, data: Partial<Address>): Promise<Address> {
    try {
      const response = await apiClient.put<ApiResponse<Address>>(
        `/users/addresses/${addressId}`,
        data
      );
      return getResponseData(response);
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  }

  /**
   * Delete address
   */
  async deleteAddress(addressId: string): Promise<void> {
    try {
      await apiClient.delete(`/users/addresses/${addressId}`);
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  }

  /**
   * Get user's saved payment methods
   */
  async getPaymentMethods(): Promise<any[]> {
    try {
      const response = await apiClient.get<ApiResponse<any[]>>('/users/payment-methods');
      return getResponseData(response);
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  }

  /**
   * Verify user session
   */
  async verifySession(): Promise<{ isValid: boolean; user?: User }> {
    try {
      const response =
        await apiClient.get<ApiResponse<{ isValid: boolean; user?: User }>>('/auth/verify');
      return getResponseData(response);
    } catch (error) {
      return { isValid: false };
    }
  }
}

export const authService = new AuthService();
