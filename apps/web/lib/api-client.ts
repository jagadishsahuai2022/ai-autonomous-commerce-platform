/**
 * API Client Configuration
 * - Centralized axios instance with interceptors
 * - JWT token management
 * - Global error handling with retry
 * - Request/response logging
 */

import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosError,
  InternalAxiosRequestConfig,
} from 'axios';

// Use relative URL in production (same-origin — Nginx routes to web container,
// which proxies /api/v1/* to NestJS internally via next.config.js rewrites).
// Use full URL only in local dev when running outside Docker.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api/v1';

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  retryDelay: 1000, // ms
  backoffMultiplier: 2,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
};

/**
 * Create API client with interceptors
 */
export const createApiClient = (): AxiosInstance => {
  const client = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Track retry attempts
  (client as any).retryCount = {};

  // Request interceptor: Add JWT token
  client.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      // Try to get token from NextAuth session storage first, then fallback to localStorage
      const token =
        typeof window !== 'undefined'
          ? localStorage.getItem('authToken') ||
            localStorage.getItem('nextauth.token') ||
            localStorage.getItem('auth_token')
          : null;

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      // Always send x-user-email so API routes can use demo/DB-email fallback
      // when the session token is a placeholder (admin-*) and DB lookup would fail.
      const userEmail = typeof window !== 'undefined' ? localStorage.getItem('userEmail') : null;
      if (userEmail) {
        config.headers['x-user-email'] = userEmail;
      }

      // Add request ID for tracking
      (config as any).requestTimestamp = Date.now();

      // Log requests in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`, {
          headers: config.headers,
        });
      }

      return config;
    },
    (error) => {
      if (process.env.NODE_ENV === 'development') {
        console.error('[API Request Error]', error);
      }
      return Promise.reject(error);
    }
  );

  // Response interceptor: Handle errors & refresh token with retry
  client.interceptors.response.use(
    (response) => {
      const duration = Date.now() - ((response.config as any).requestTimestamp || 0);
      if (process.env.NODE_ENV === 'development') {
        console.log(`[API Response] ${response.status} ${response.config.url} (${duration}ms)`, {
          dataSize: JSON.stringify(response.data).length,
        });
      }
      return response;
    },
    async (error: AxiosError) => {
      const config = error.config as InternalAxiosRequestConfig;
      const status = error.response?.status;
      const url = config?.url || '';

      if (process.env.NODE_ENV === 'development') {
        console.error('[API Error]', {
          status,
          url,
          message: error.message,
          data: error.response?.data,
        });
      }

      // Retry logic for retryable errors
      if (
        RETRY_CONFIG.retryableStatuses.includes(status || 0) &&
        config &&
        status !== 401 && // Don't retry auth errors
        status !== 403 // Don't retry forbidden errors
      ) {
        const retryKey = url;
        const currentRetries = (client as any).retryCount[retryKey] || 0;

        if (currentRetries < RETRY_CONFIG.maxRetries) {
          (client as any).retryCount[retryKey] = currentRetries + 1;
          const delay =
            RETRY_CONFIG.retryDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, currentRetries);

          if (process.env.NODE_ENV === 'development') {
            console.log(
              `[API Retry] Attempt ${currentRetries + 1}/${RETRY_CONFIG.maxRetries} after ${delay}ms`
            );
          }

          await new Promise((resolve) => setTimeout(resolve, delay));
          return client(config);
        }
      }

      // Reset retry count on success or final failure
      (client as any).retryCount = {};

      // Handle 401 - Unauthorized (token expired or invalid)
      if (status === 401) {
        // Clear auth data
        if (typeof window !== 'undefined') {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('user');
          // Dispatch custom event for global listener
          window.dispatchEvent(new CustomEvent('auth:logout'));
        }
        // Redirect to login
        if (typeof window !== 'undefined') {
          // Use nextRouter if available, otherwise use window.location
          const event = new CustomEvent('auth:navigate-to-login');
          window.dispatchEvent(event);
        }
      }

      // Handle 403 - Forbidden
      if (status === 403) {
        // Forbidden - let caller handle
      }

      // Handle 404 - Not Found
      if (status === 404) {
        // Not found - let caller handle
      }

      // Handle 500+ - Server errors
      if (status && status >= 500) {
        // Server error - let caller handle
      }

      // Handle network errors
      if (!error.response) {
        // Network error - let caller handle
        if (process.env.NODE_ENV === 'development') {
          console.error('[Network Error]', error.message);
        }
      }

      return Promise.reject(error);
    }
  );

  return client;
};

// Export singleton instance
export const apiClient = createApiClient();

/**
 * Type-safe API response wrapper
 */
export interface ApiResponse<T> {
  status: number;
  data: T;
  message?: string;
  timestamp: string;
}

/**
 * Helper to extract data from API response
 */
export const getResponseData = <T>(response: any): T => {
  return response?.data?.data || response?.data || response;
};

/**
 * Helper to handle API errors consistently
 */
export const handleApiError = (error: AxiosError) => {
  const statusCode = error.response?.status;
  const errorData = error.response?.data as any;

  return {
    statusCode,
    message: errorData?.message || error.message || 'An error occurred',
    details: errorData?.details || null,
  };
};
