'use client';

import { useCallback } from 'react';
import { AxiosError } from 'axios';
import { useToast } from '@/lib/contexts/ToastContext';

/**
 * Format API error message for user display
 */
function formatApiError(error: any): string {
  if (!error) return 'An unknown error occurred';

  if (typeof error === 'string') return error;

  if (error.response?.data?.message) {
    return error.response.data.message;
  }

  if (error.message) {
    return error.message;
  }

  if (error.status === 401) return 'Please sign in again';
  if (error.status === 403) return 'You do not have permission for this action';
  if (error.status === 404) return 'Resource not found';
  if (error.status === 500) return 'Server error - please try again later';

  return 'An error occurred. Please try again.';
}

/**
 * Handle API errors with default behavior
 */
function handleApiError(error: any, context?: string): string {
  const message = formatApiError(error);
  console.error('[API Error]', context || 'Unknown error:', error);
  return message;
}

/**
 * Hook to handle API errors with automatic toast notifications
 *
 * Usage:
 * const { handleError, showError } = useApiErrorHandler();
 *
 * try {
 *   await api.get('/products');
 * } catch (error) {
 *   handleError(error); // Auto shows toast with user-friendly message
 * }
 */
export function useApiErrorHandler() {
  const toast = useToast();

  const handleError = useCallback(
    (error: unknown, customMessage?: string) => {
      const userMessage = customMessage || handleApiError(error);

      if (error instanceof AxiosError) {
        const apiErrorMessage = formatApiError(error);

        // Show error with appropriate metadata
        toast.error(apiErrorMessage, 'API Error');

        // Log for debugging
        console.error('[API Error Handled]', {
          statusCode: error.response?.status,
          message: apiErrorMessage,
          details: error.response?.data,
        });

        return {
          message: apiErrorMessage,
          status: error.response?.status,
        };
      }

      // Generic error
      toast.error(userMessage, 'Error');
      console.error('[Error Handled]', error);

      return {
        message: userMessage,
        statusCode: 0,
      };
    },
    [toast]
  );

  const showError = useCallback(
    (message: string, title = 'Error') => {
      toast.error(message, title);
    },
    [toast]
  );

  const showSuccess = useCallback(
    (message: string, title = 'Success') => {
      toast.success(message, title);
    },
    [toast]
  );

  const showWarning = useCallback(
    (message: string, title = 'Warning') => {
      toast.warning(message, title);
    },
    [toast]
  );

  const showInfo = useCallback(
    (message: string, title = 'Info') => {
      toast.info(message, title);
    },
    [toast]
  );

  return {
    handleError,
    showError,
    showSuccess,
    showWarning,
    showInfo,
  };
}
