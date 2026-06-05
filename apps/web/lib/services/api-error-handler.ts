import axios, { AxiosError, AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';

/**
 * Global API Error Handler
 * Handles errors, retries, token refresh, and user feedback
 */

export interface ApiErrorResponse {
  statusCode: number;
  message: string;
  error?: string;
  details?: Record<string, any>;
  timestamp?: string;
  path?: string;
}

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const setupApiInterceptors = (instance: AxiosInstance) => {
  let retryCount = 0;
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 1000;

  // Request interceptor: Add authorization token
  instance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      // Get token from localStorage (from NextAuth session)
      const token = typeof window !== 'undefined' ? localStorage.getItem('nextauth.token') : null;

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      // Add request ID for tracing
      config.headers['X-Request-ID'] = generateRequestId();
      config.headers['X-Request-Time'] = new Date().toISOString();

      return config;
    },
    (error) => Promise.reject(error)
  );

  // Response interceptor: Handle errors and retries
  instance.interceptors.response.use(
    (response: AxiosResponse) => {
      retryCount = 0;
      return response;
    },
    async (error: AxiosError) => {
      const config = error.config as InternalAxiosRequestConfig & { _retry?: number };

      if (!config) {
        return Promise.reject(error);
      }

      // Increment retry count
      config._retry = (config._retry || 0) + 1;

      // Don't retry if already retried too many times
      if (config._retry > MAX_RETRIES) {
        return Promise.reject(formatApiError(error));
      }

      // Retry on specific status codes
      const shouldRetry =
        error.response?.status === 408 || // Request timeout
        error.response?.status === 429 || // Too many requests
        error.response?.status >= 500; // Server errors

      if (!shouldRetry) {
        return Promise.reject(formatApiError(error));
      }

      // Wait before retrying with exponential backoff
      await delay(RETRY_DELAY * Math.pow(2, config._retry - 1));

      // Retry the request
      console.warn(
        `[API Retry] Retrying ${config.method?.toUpperCase()} ${config.url} - Attempt ${config._retry}/${MAX_RETRIES}`
      );

      return instance(config);
    }
  );

  return instance;
};

/**
 * Format API error to consistent error object
 */
export const formatApiError = (error: AxiosError): ApiError => {
  if (error.response) {
    const data = error.response.data as ApiErrorResponse;

    // Token expired - redirect to login
    if (error.response.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('nextauth.token');
        // Trigger sign out via NextAuth
        signOut({ redirect: true, callbackUrl: '/signin' });
      }
      return new ApiError(401, 'Session expired. Please log in again.');
    }

    // Forbidden - user doesn't have permission
    if (error.response.status === 403) {
      return new ApiError(403, 'You do not have permission to perform this action.');
    }

    // Not found
    if (error.response.status === 404) {
      return new ApiError(
        404,
        data?.message || 'Resource not found. Please check the URL and try again.'
      );
    }

    // Validation error
    if (error.response.status === 400) {
      return new ApiError(
        400,
        data?.message || 'Invalid request. Please check your input.',
        data?.details
      );
    }

    // Server error
    if (error.response.status >= 500) {
      return new ApiError(error.response.status, 'Server error. Please try again later.', {
        originalError: data?.message,
      });
    }

    return new ApiError(
      error.response.status,
      data?.message || 'An error occurred. Please try again.'
    );
  }

  // Network error
  if (error.request) {
    return new ApiError(0, 'Network error. Please check your connection and try again.', {
      originalError: error.message,
    });
  }

  // Request setup error
  return new ApiError(0, 'An unexpected error occurred. Please try again.', {
    originalError: error.message,
  });
};

/**
 * Handle API errors with user-friendly messages
 */
export const handleApiError = (error: unknown): string => {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof AxiosError) {
    const apiError = formatApiError(error);
    return apiError.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'An unexpected error occurred. Please try again.';
};

/**
 * Generate unique request ID for tracing
 */
const generateRequestId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Delay utility for retry logic
 */
const delay = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Retry a request with exponential backoff
 */
export async function retryRequest<T>(
  fn: () => Promise<T>,
  options = { maxRetries: 3, delayMs: 1000 }
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < options.maxRetries) {
        const delayTime = options.delayMs * Math.pow(2, attempt);
        console.warn(`Retry attempt ${attempt + 1}/${options.maxRetries} after ${delayTime}ms`);
        await delay(delayTime);
      }
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

/**
 * Create typed API error hook for React components
 */
export const useApiError = () => {
  const router = useRouter();

  const handleError = (error: unknown) => {
    const message = handleApiError(error);

    // Log error for debugging
    console.error('[API Error]', {
      message,
      error,
      timestamp: new Date().toISOString(),
    });

    return message;
  };

  return { handleError };
};

export default setupApiInterceptors;
