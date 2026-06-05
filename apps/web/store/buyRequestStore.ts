/**
 * Buy Request Store - Zustand
 * Global state management for buy request operations
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

export interface BuyRequest {
  id: number;
  userId: number;
  productName: string;
  description?: string;
  budgetMin: number;
  budgetMax: number;
  qualityScore: number;
  preferredBrands?: string[];
  deliveryDate: string;
  autoExecute: boolean;
  notifyChannels?: string[];
  status: string;
  matchedProducts?: any;
  createdAt: string;
  updatedAt: string;
}

interface BuyRequestStore {
  // State
  buyRequests: BuyRequest[];
  selectedRequest: BuyRequest | null;
  loading: boolean;
  error: string | null;
  total: number;
  currentPage: number;

  // Sync Actions
  setBuyRequests: (requests: BuyRequest[]) => void;
  setSelectedRequest: (request: BuyRequest | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setTotal: (total: number) => void;
  setCurrentPage: (page: number) => void;
  addBuyRequest: (request: BuyRequest) => void;
  updateBuyRequestInList: (request: BuyRequest) => void;
  removeBuyRequest: (id: number) => void;

  // Async Actions
  createBuyRequest: (userId: number, data: any) => Promise<void>;
  fetchBuyRequests: (userId: number, filters?: any) => Promise<void>;
  fetchBuyRequest: (userId: number, id: number) => Promise<void>;
  updateBuyRequest: (userId: number, id: number, data: any) => Promise<void>;
  cancelBuyRequest: (userId: number, id: number) => Promise<void>;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const useBuyRequestStore = create<BuyRequestStore>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        buyRequests: [],
        selectedRequest: null,
        loading: false,
        error: null,
        total: 0,
        currentPage: 1,

        // Sync actions
        setBuyRequests: (requests) => set({ buyRequests: requests }),
        setSelectedRequest: (request) => set({ selectedRequest: request }),
        setLoading: (loading) => set({ loading }),
        setError: (error) => set({ error }),
        setTotal: (total) => set({ total }),
        setCurrentPage: (page) => set({ currentPage: page }),

        addBuyRequest: (request) => {
          set((state) => ({
            buyRequests: [request, ...state.buyRequests],
            total: state.total + 1,
          }));
        },

        updateBuyRequestInList: (request) => {
          set((state) => ({
            buyRequests: state.buyRequests.map((br) => (br.id === request.id ? request : br)),
            selectedRequest:
              state.selectedRequest?.id === request.id ? request : state.selectedRequest,
          }));
        },

        removeBuyRequest: (id) => {
          set((state) => ({
            buyRequests: state.buyRequests.filter((br) => br.id !== id),
            total: state.total - 1,
            selectedRequest: state.selectedRequest?.id === id ? null : state.selectedRequest,
          }));
        },

        // Create buy request
        createBuyRequest: async (userId: number, data: any) => {
          try {
            set({ loading: true, error: null });

            const response = await fetch(`${API_URL}/buy-request`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                userId: userId.toString(),
              },
              body: JSON.stringify(data),
            });

            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || 'Failed to create buy request');
            }

            const result = await response.json();
            if (result.data) {
              get().addBuyRequest(result.data);
            }

            set({ loading: false });
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : 'Failed to create buy request';
            set({ error: errorMessage, loading: false });
            throw error;
          }
        },

        // Fetch all buy requests
        fetchBuyRequests: async (userId: number, filters?: any) => {
          try {
            set({ loading: true, error: null });

            const params = new URLSearchParams();
            if (filters?.status) params.append('status', filters.status);
            if (filters?.skip) params.append('skip', filters.skip.toString());
            if (filters?.take) params.append('take', filters.take.toString());

            const queryString = params.toString();
            const url = queryString
              ? `${API_URL}/buy-request?${queryString}`
              : `${API_URL}/buy-request`;

            const response = await fetch(url, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                userId: userId.toString(),
              },
            });

            if (!response.ok) {
              throw new Error('Failed to fetch buy requests');
            }

            const result = await response.json();
            set({
              buyRequests: result.data || [],
              total: result.count || 0,
              loading: false,
            });
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : 'Failed to fetch buy requests';
            set({ error: errorMessage, loading: false });
            throw error;
          }
        },

        // Fetch single buy request
        fetchBuyRequest: async (userId: number, id: number) => {
          try {
            set({ loading: true, error: null });

            const response = await fetch(`${API_URL}/buy-request/${id}`, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                userId: userId.toString(),
              },
            });

            if (!response.ok) {
              throw new Error('Failed to fetch buy request');
            }

            const result = await response.json();
            set({
              selectedRequest: result.data || null,
              loading: false,
            });
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : 'Failed to fetch buy request';
            set({ error: errorMessage, loading: false });
            throw error;
          }
        },

        // Update buy request
        updateBuyRequest: async (userId: number, id: number, data: any) => {
          try {
            set({ loading: true, error: null });

            const response = await fetch(`${API_URL}/buy-request/${id}`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                userId: userId.toString(),
              },
              body: JSON.stringify(data),
            });

            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || 'Failed to update buy request');
            }

            const result = await response.json();
            if (result.data) {
              get().updateBuyRequestInList(result.data);
            }

            set({ loading: false });
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : 'Failed to update buy request';
            set({ error: errorMessage, loading: false });
            throw error;
          }
        },

        // Cancel buy request
        cancelBuyRequest: async (userId: number, id: number) => {
          try {
            set({ loading: true, error: null });

            const response = await fetch(`${API_URL}/buy-request/${id}`, {
              method: 'DELETE',
              headers: {
                'Content-Type': 'application/json',
                userId: userId.toString(),
              },
            });

            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || 'Failed to cancel buy request');
            }

            get().removeBuyRequest(id);
            set({ loading: false });
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : 'Failed to cancel buy request';
            set({ error: errorMessage, loading: false });
            throw error;
          }
        },
      }),
      {
        name: 'buy-request-store',
        partialize: (state) => ({
          currentPage: state.currentPage,
          // Don't persist requests list to keep fresh data
        }),
      }
    )
  )
);

export default useBuyRequestStore;
