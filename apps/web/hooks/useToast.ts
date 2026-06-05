'use client';

import { useState, useCallback } from 'react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

const toastCallbacks: Set<(toast: ToastMessage) => void> = new Set();

export function useToast() {
  const showToast = useCallback(
    (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
      const id = Math.random().toString(36).substr(2, 9);
      const toast: ToastMessage = { id, type, message };

      toastCallbacks.forEach((cb) => cb(toast));

      // Auto-dismiss after 3 seconds
      setTimeout(() => {
        toastCallbacks.forEach((cb) => cb({ ...toast, message: '' }));
      }, 3000);
    },
    []
  );

  return {
    success: (message: string) => showToast(message, 'success'),
    error: (message: string) => showToast(message, 'error'),
    info: (message: string) => showToast(message, 'info'),
    warning: (message: string) => showToast(message, 'warning'),
  };
}

export function useToastListener(callback: (toast: ToastMessage) => void) {
  useState(() => {
    toastCallbacks.add(callback);
    return () => {
      toastCallbacks.delete(callback);
    };
  });
}

export function toast(message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') {
  const id = Math.random().toString(36).substr(2, 9);
  const toastMsg: ToastMessage = { id, type, message };
  toastCallbacks.forEach((cb) => cb(toastMsg));
}
