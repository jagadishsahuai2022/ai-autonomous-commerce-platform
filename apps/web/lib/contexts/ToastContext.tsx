/**
 * Toast Notification & Error Handling System
 * Global error handling with user-friendly notifications
 * Auto-retry failed requests, resilient UI states
 */

'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

export interface Toast {
  id: string;
  title: string;
  message?: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  clearAll: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

/**
 * Toast Provider - wrap your app with this
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `toast_${Date.now()}_${Math.random()}`;
    const fullToast: Toast = { ...toast, id };

    setToasts((prev) => [...prev, fullToast]);

    // Auto-remove after duration (default 3s for success/error, 5s for warning/info)
    if (toast.duration !== 0) {
      const duration = toast.duration ?? (toast.type === 'success' || toast.type === 'error' ? 3000 : 5000);
      setTimeout(() => removeToast(id), duration);
    }

    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setToasts([]);
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, clearAll }}>
      {children}
    </ToastContext.Provider>
  );
}

/**
 * Hook to use toast notifications
 * 
 * Usage:
 * const { success, error, warning, info } = useToast();
 * success('Item added to cart');
 */
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }

  const { addToast } = context;

  return {
    success: (message: string, title = 'Success') =>
      addToast({ type: 'success', title, message }),
    error: (message: string, title = 'Error') =>
      addToast({ type: 'error', title, message }),
    warning: (message: string, title = 'Warning') =>
      addToast({ type: 'warning', title, message }),
    info: (message: string, title = 'Info') =>
      addToast({ type: 'info', title, message }),
    custom: addToast,
  };
}

/**
 * Toast Display Component
 * Shows notifications as toasts in corner of screen
 * 
 * Usage (in your app layout):
 * <ToastContainer />
 */
export function ToastContainer() {
  const context = useContext(ToastContext);
  if (!context) return null;

  const { toasts, removeToast } = context;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
}

/**
 * Individual Toast Item
 */
function ToastItem({
  toast,
  onClose,
}: {
  toast: Toast;
  onClose: () => void;
}) {
  const bgColor = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    warning: 'bg-amber-500',
    info: 'bg-blue-500',
  };

  const icon = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
  };

  return (
    <div
      className={`${bgColor[toast.type]} text-white px-4 py-3 rounded-lg shadow-lg flex gap-3 items-start max-w-sm pointer-events-auto animate-in slide-in-from-right-4 fade-in duration-300`}
      role="alert"
    >
      <span className="text-xl flex-shrink-0">{icon[toast.type]}</span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold">{toast.title}</p>
        {toast.message && <p className="text-sm opacity-90">{toast.message}</p>}
      </div>
      <div className="flex gap-2 items-center flex-shrink-0">
        {toast.action && (
          <button
            onClick={toast.action.onClick}
            className="text-sm font-semibold underline hover:opacity-80 transition"
          >
            {toast.action.label}
          </button>
        )}
        <button
          onClick={onClose}
          className="text-xl leading-none hover:opacity-80 transition"
          aria-label="Close"
        >
          ×
        </button>
      </div>
    </div>
  );
}

/**
 * Hook: Retry UI with exponential backoff
 * 
 * Usage:
 * const { execute, isLoading, error, retryCount } = useRetry();
 * 
 * const handleClick = async () => {
 *   await execute(async () => {
 *     await fetchData();
 *   });
 * };
 */
export function useRetry(maxAttempts = 3) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const { error: showError } = useToast();

  const execute = useCallback(
    async (fn: () => Promise<any>) => {
      setIsLoading(true);
      setError(null);

      let lastError: Error | null = null;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          await fn();
          setIsLoading(false);
          setRetryCount(0);
          return;
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
          setRetryCount(attempt + 1);

          if (attempt < maxAttempts - 1) {
            const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      }

      setError(lastError);
      setIsLoading(false);
      showError(
        lastError?.message || 'Operation failed after retries',
        'Failed'
      );
    },
    [maxAttempts, showError]
  );

  return { execute, isLoading, error, retryCount };
}

/**
 * Hook: Global error boundary integration
 * 
 * Usage:
 * useErrorHandler((error) => {
 *   console.error('Caught error:', error);
 * });
 */
export function useErrorHandler(onError?: (error: Error) => void) {
  const { error: showError } = useToast();

  return useCallback(
    (error: Error | unknown) => {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('[Error Handler]', err);

      showError(
        err.message || 'An unexpected error occurred',
        'Error'
      );

      onError?.(err);
    },
    [showError, onError]
  );
}

/**
 * Hook: API error resilience
 * Handles common API errors with retry and fallback
 * 
 * Usage:
 * const { apiCall } = useApiResilience();
 * const data = await apiCall(() => fetch('/api/data'));
 */
export function useApiResilience() {
  const { execute, isLoading, error, retryCount } = useRetry();
  const { error: showError } = useToast();

  const apiCall = useCallback(
    async (fn: () => Promise<Response>, options?: { silent?: boolean }) => {
      let result: any = null;

      await execute(async () => {
        const response = await fn();

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const message =
            errorData.message ||
            {
              400: 'Invalid request',
              401: 'Unauthorized',
              403: 'Forbidden',
              404: 'Not found',
              500: 'Server error',
              503: 'Service unavailable',
            }[response.status] ||
            `Error: ${response.status}`;

          throw new Error(message);
        }

        result = await response.json();
      });

      return result;
    },
    [execute, showError]
  );

  return { apiCall, isLoading, error, retryCount };
}
