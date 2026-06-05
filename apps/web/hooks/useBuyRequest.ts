/**
 * useBuyRequest Hook
 * Custom hook for managing buy request operations
 */

import { useCallback, useEffect, useState } from 'react';
import { useBuyRequestStore, type BuyRequest } from '@/store/buyRequestStore';

interface UseBuyRequestOptions {
  autoFetch?: boolean;
  userId?: number;
}

export const useBuyRequest = (options: UseBuyRequestOptions = {}) => {
  const { autoFetch = false, userId = 1 } = options;
  const [isSubmitting, setIsSubmitting] = useState(false);

  const store = useBuyRequestStore();

  // Auto-fetch on mount if enabled
  useEffect(() => {
    if (autoFetch && userId) {
      store.fetchBuyRequests(userId);
    }
  }, [autoFetch, userId, store]);

  // Memoized create
  const create = useCallback(
    async (data: any) => {
      setIsSubmitting(true);
      try {
        await store.createBuyRequest(userId, data);
        return true;
      } catch (error) {
        console.error('Failed to create buy request:', error);
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [userId, store]
  );

  // Memoized fetch all
  const fetchAll = useCallback(
    async (filters?: any) => {
      try {
        await store.fetchBuyRequests(userId, filters);
      } catch (error) {
        console.error('Failed to fetch buy requests:', error);
      }
    },
    [userId, store]
  );

  // Memoized fetch single
  const fetchOne = useCallback(
    async (id: number) => {
      try {
        await store.fetchBuyRequest(userId, id);
      } catch (error) {
        console.error('Failed to fetch buy request:', error);
      }
    },
    [userId, store]
  );

  // Memoized update
  const update = useCallback(
    async (id: number, data: any) => {
      setIsSubmitting(true);
      try {
        await store.updateBuyRequest(userId, id, data);
        return true;
      } catch (error) {
        console.error('Failed to update buy request:', error);
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [userId, store]
  );

  // Memoized cancel
  const cancel = useCallback(
    async (id: number) => {
      setIsSubmitting(true);
      try {
        await store.cancelBuyRequest(userId, id);
        return true;
      } catch (error) {
        console.error('Failed to cancel buy request:', error);
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [userId, store]
  );

  return {
    // State
    buyRequests: store.buyRequests,
    selectedRequest: store.selectedRequest,
    loading: store.loading || isSubmitting,
    error: store.error,
    total: store.total,
    currentPage: store.currentPage,

    // Actions
    create,
    fetchAll,
    fetchOne,
    update,
    cancel,
    setCurrentPage: store.setCurrentPage,
    clearError: () => store.setError(null),
  };
};

export default useBuyRequest;
