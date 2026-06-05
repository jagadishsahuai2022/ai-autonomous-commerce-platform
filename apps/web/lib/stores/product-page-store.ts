/**
 * Zustand Product Page Store — Session-persistent filter & scroll state
 *
 * Preserves search query, selected filters, sort order, scroll position,
 * and category sphere selection across page navigations.
 * Uses sessionStorage for session-scoped persistence.
 */

import { create } from 'zustand';

// Store filter state as a generic record to avoid coupling with FilterState type
type StoredFilterState = Record<string, any>;

interface ProductPageState {
  searchQuery: string;
  sortBy: string;
  filterState: StoredFilterState | null;
  scrollY: number;
  sphereCategory: string;
  hasHydrated: boolean;

  // Actions
  setSearchQuery: (q: string) => void;
  setSortBy: (sort: string) => void;
  setFilterState: (f: StoredFilterState) => void;
  setScrollY: (y: number) => void;
  setSphereCategory: (cat: string) => void;
  resetAll: () => void;
  hydrate: () => void;
}

const STORAGE_KEY = 'dc-product-page-store';

function saveToSession(state: Partial<ProductPageState>) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      searchQuery: state.searchQuery,
      sortBy: state.sortBy,
      filterState: state.filterState,
      scrollY: state.scrollY,
      sphereCategory: state.sphereCategory,
    }));
  } catch { /* quota — ignore */ }
}

function loadFromSession(): Partial<ProductPageState> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export const useProductPageStore = create<ProductPageState>((set, get) => ({
  searchQuery: '',
  sortBy: 'relevance',
  filterState: null,
  scrollY: 0,
  sphereCategory: '',
  hasHydrated: false,

  setSearchQuery: (searchQuery) => {
    set({ searchQuery });
    saveToSession(get());
  },

  setSortBy: (sortBy) => {
    set({ sortBy });
    saveToSession(get());
  },

  setFilterState: (filterState) => {
    set({ filterState });
    saveToSession(get());
  },

  setScrollY: (scrollY) => {
    set({ scrollY });
    saveToSession(get());
  },

  setSphereCategory: (sphereCategory) => {
    set({ sphereCategory });
    saveToSession(get());
  },

  resetAll: () => {
    set({
      searchQuery: '',
      sortBy: 'relevance',
      filterState: null,
      scrollY: 0,
      sphereCategory: '',
    });
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  },

  hydrate: () => {
    const saved = loadFromSession();
    if (saved) {
      set({
        searchQuery: saved.searchQuery || '',
        sortBy: saved.sortBy || 'relevance',
        filterState: saved.filterState || null,
        scrollY: saved.scrollY || 0,
        sphereCategory: saved.sphereCategory || '',
        hasHydrated: true,
      });
    } else {
      set({ hasHydrated: true });
    }
  },
}));
