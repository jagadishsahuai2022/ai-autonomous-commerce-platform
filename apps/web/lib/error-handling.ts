/**
 * Error handling utilities for React Query
 * Provides standardized error handling across all API queries
 */

import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import toast from 'react-hot-toast';

interface ApiErrorResponse {
  statusCode: number;
  message: string;
  details?: any;
}

export const isApiError = (error: unknown): error is ApiErrorResponse => {
  return typeof error === 'object' && error !== null && 'statusCode' in error && 'message' in error;
};

export const getErrorMessage = (error: unknown): string => {
  if (isApiError(error)) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'An unexpected error occurred';
};

export const useApiErrorHandler = () => {
  const queryClient = useQueryClient();

  const handleError = useCallback(
    (error: unknown, context?: { message?: string; showToast?: boolean }) => {
      const errorMessage = context?.message || getErrorMessage(error);
      const showToast_ = context?.showToast !== false;

      // Log error in development
      if (process.env.NODE_ENV === 'development') {
        console.error('[API Error Handler]', {
          error,
          message: errorMessage,
        });
      }

      // Show toast notification if requested
      if (showToast_) {
        toast.error(errorMessage, {
          duration: 5000,
          position: 'bottom-right',
        });
      }

      // Handle specific status codes
      if (isApiError(error)) {
        switch (error.statusCode) {
          case 401:
            // Unauthorized - clear auth and redirect handled by API client
            queryClient.clear();
            break;
          case 403:
            // Forbidden - don't retry
            break;
          case 429:
            // Rate limited
            toast("You're sending requests too quickly. Please wait a moment.", {
              icon: '⏱️',
            });
            break;
          case 500:
          case 502:
          case 503:
          case 504:
            // Server errors
            toast('Server error. Our team has been notified.', { icon: '🔧' });
            break;
        }
      }

      return errorMessage;
    },
    [queryClient]
  );

  const handleRetry = useCallback((error: unknown, retryCount: number) => {
    // Don't retry on certain errors
    if (isApiError(error)) {
      if ([401, 403, 404].includes(error.statusCode)) {
        return false;
      }
    }

    // Exponential backoff: don't retry if already attempted 3 times
    return retryCount < 2;
  }, []);

  return { handleError, handleRetry, getErrorMessage };
};

/**
 * Higher order hook to wrap React Query hooks with error handling
 */
export const withErrorHandling = <T>(
  queryFn: () => Promise<T>,
  onError?: (error: unknown) => void
): (() => Promise<T>) => {
  return async () => {
    try {
      return await queryFn();
    } catch (error) {
      onError?.(error);
      throw error;
    }
  };
};

// ============ Additional exports used by tests ============

export type ErrorCode =
  | 'NETWORK_ERROR'
  | 'VALIDATION_FAILED'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'SERVER_ERROR'
  | 'VALIDATION_ERROR'
  | 'INTERNAL_SERVER_ERROR'
  | 'UNKNOWN'
  | 'UNKNOWN_ERROR'
  | string;

// Const object to allow ErrorCode.UNKNOWN usage in tests
export const ErrorCode = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMITED: 'RATE_LIMITED',
  SERVER_ERROR: 'SERVER_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  UNKNOWN: 'UNKNOWN',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export interface ErrorContext {
  [key: string]: any;
}

export interface ErrorRecoveryStrategy {
  type: 'retry' | 'redirect' | 'refresh' | 'notify' | 'ignore' | 'reload' | 'contact';
  action?: () => void;
  url?: string;
  message?: string;
  label?: string;
  delayMs?: number;
  target?: string;
  email?: string;
}

export interface ErrorResponse {
  code: string;
  message: string;
  statusCode: number;
  timestamp: Date;
  context: ErrorContext;
  userMessage: string;
  recoveryAction?: ErrorRecoveryStrategy;
}

export const handleApiError = (error: unknown): string => {
  if (error && typeof error === 'object' && 'name' in error) {
    const err = error as { name: string };
    if (err.name === 'NetworkError' || err.name === 'AbortError') {
      return 'Network connection error. Please check your internet connection.';
    }
  }

  if (error && typeof error === 'object' && 'response' in error) {
    const err = error as { response: { status: number; data?: { message?: string } } };
    switch (err.response.status) {
      case 401:
        return 'Please log in to continue.';
      case 403:
        return 'You do not have permission to perform this action.';
      case 404:
        return 'The requested resource was not found.';
      case 429:
        return 'Too many requests. Please wait a moment and try again.';
      case 500:
      case 502:
      case 503:
      case 504:
        return 'Server error. Please try again later.';
      default:
        return err.response.data?.message || 'An unexpected error occurred.';
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'An unexpected error occurred.';
};

export const normalizeError = (error: unknown): ErrorResponse => {
  if (error && typeof error === 'object' && 'code' in error && 'statusCode' in error) {
    return error as ErrorResponse;
  }

  const message = handleApiError(error);
  return {
    code: 'UNKNOWN_ERROR',
    message,
    statusCode: 500,
    timestamp: new Date(),
    context: {},
    userMessage: message,
  };
};

export const isNetworkError = (error: unknown): boolean => {
  if (error && typeof error === 'object' && 'name' in error) {
    const err = error as { name: string };
    return err.name === 'NetworkError' || err.name === 'AbortError';
  }
  return false;
};

export const isAuthError = (error: unknown): boolean => {
  if (error && typeof error === 'object' && 'response' in error) {
    const err = error as { response: { status: number } };
    return err.response.status === 401;
  }
  return false;
};
