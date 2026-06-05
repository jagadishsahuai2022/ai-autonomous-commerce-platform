'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { Toast, ToastType } from '@/components/ui/error-toast';

interface ErrorContextType {
  toasts: Toast[];
  showError: (message: string, duration?: number, action?: Toast['action']) => void;
  showSuccess: (message: string, duration?: number) => void;
  showWarning: (message: string, duration?: number) => void;
  showInfo: (message: string, duration?: number) => void;
  removeToast: (id: string) => void;
  clearAll: () => void;
}

const ErrorContext = createContext<ErrorContextType | undefined>(undefined);

export function ErrorProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const generateId = useCallback(() => {
    return `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  const addToast = useCallback(
    (message: string, type: ToastType, duration?: number, action?: Toast['action']) => {
      const id = generateId();
      const toast: Toast = {
        id,
        message,
        type,
        duration: duration ?? (type === 'error' ? 8000 : 5000),
        action,
      };

      setToasts((prev) => [...prev, toast]);

      // Auto-remove if duration is set
      if (duration !== 0) {
        setTimeout(() => {
          removeToast(id);
        }, toast.duration);
      }

      return id;
    },
    [generateId]
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setToasts([]);
  }, []);

  const showError = useCallback(
    (message: string, duration?: number, action?: Toast['action']) =>
      addToast(message, 'error', duration, action),
    [addToast]
  );

  const showSuccess = useCallback(
    (message: string, duration?: number) => addToast(message, 'success', duration),
    [addToast]
  );

  const showWarning = useCallback(
    (message: string, duration?: number) => addToast(message, 'warning', duration),
    [addToast]
  );

  const showInfo = useCallback(
    (message: string, duration?: number) => addToast(message, 'info', duration),
    [addToast]
  );

  const value: ErrorContextType = {
    toasts,
    showError,
    showSuccess,
    showWarning,
    showInfo,
    removeToast,
    clearAll,
  };

  return <ErrorContext.Provider value={value}>{children}</ErrorContext.Provider>;
}

export function useError() {
  const context = useContext(ErrorContext);
  if (!context) {
    throw new Error('useError must be used within ErrorProvider');
  }
  return context;
}
