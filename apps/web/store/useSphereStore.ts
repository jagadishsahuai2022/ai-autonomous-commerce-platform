/**
 * useSphereStore — Zustand store for the 3D Category Sphere.
 *
 * Performance rules:
 *  - NEVER duplicate state locally in components
 *  - NEVER trigger multiple state updates per frame
 *  - Use shallow comparison to prevent unnecessary re-renders
 *
 * Persistence: selectedCategory, isSphereExpanded, isSphereDocked saved to
 * sessionStorage so they survive same-tab page navigations and hard reloads.
 */

import { create } from 'zustand';

export interface SphereCategory {
  name: string;
  count: number;
}

const BATCH_SIZE = 20;
const SPHERE_SESSION_KEY = 'dc-sphere-v1';

// ── SessionStorage helpers ────────────────────────────────────────────────────

interface PersistedSphereState {
  selectedCategory: string | null;
  isSphereExpanded: boolean;
  isSphereDocked: boolean;
}

function saveSphereSession(s: PersistedSphereState) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(SPHERE_SESSION_KEY, JSON.stringify(s));
  } catch {
    /* quota — ignore */
  }
}

function loadSphereSession(): PersistedSphereState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(SPHERE_SESSION_KEY);
    return raw ? (JSON.parse(raw) as PersistedSphereState) : null;
  } catch {
    return null;
  }
}

// ── Store interface ──────────────────────────────────────────────────────────

interface SphereState {
  selectedCategory: string | null;
  isSphereExpanded: boolean;
  isSphereDocked: boolean;
  visibleCategories: SphereCategory[];
  batchIndex: number;
  allCategories: SphereCategory[];
  /** True once hydrate() has been called — used to avoid re-initialising sphere */
  hasHydrated: boolean;
}

interface SphereActions {
  setSelectedCategory: (cat: string | null) => void;
  expand: () => void;
  dock: () => void;
  nextBatch: () => void;
  setAllCategories: (cats: SphereCategory[]) => void;
  reset: () => void;
  /** Restore persisted state from sessionStorage */
  hydrate: () => void;
  /** Reset hydration flag on route change for re-initialization */
  resetHydrationFlag: () => void;
}

const INITIAL_STATE: SphereState = {
  selectedCategory: null,
  isSphereExpanded: true,
  isSphereDocked: false,
  visibleCategories: [],
  batchIndex: 0,
  allCategories: [],
  hasHydrated: false,
};

export const useSphereStore = create<SphereState & SphereActions>((set, get) => ({
  ...INITIAL_STATE,

  setSelectedCategory: (cat) => {
    set({ selectedCategory: cat });
    const s = get();
    saveSphereSession({
      selectedCategory: cat,
      isSphereExpanded: s.isSphereExpanded,
      isSphereDocked: s.isSphereDocked,
    });
  },

  expand: () => {
    // Do NOT persist isSphereExpanded/isSphereDocked — these are intra-page UI state.
    // Persisting them caused the sphere to stay docked after a scroll-dismiss when
    // navigating back to the products page (root cause of "sphere not loading" bug).
    set({ isSphereExpanded: true, isSphereDocked: false });
    // Only persist the selected category (the actual filter value).
    const s = get();
    saveSphereSession({
      selectedCategory: s.selectedCategory,
      isSphereExpanded: true,  // reset to open for next visit
      isSphereDocked: false,   // always start undocked on next visit
    });
  },

  dock: () => {
    // Update in-memory state only; do NOT write isSphereDocked=true to sessionStorage
    // so navigating back to products always re-opens the sphere.
    set({ isSphereExpanded: false, isSphereDocked: true });
    // Persist selectedCategory + reset expanded=true so next page load re-opens sphere.
    const s = get();
    saveSphereSession({
      selectedCategory: s.selectedCategory,
      isSphereExpanded: true,  // always expand on next page load
      isSphereDocked: false,   // never persist docked state across navigations
    });
  },

  nextBatch: () => {
    const { allCategories, batchIndex } = get();
    if (allCategories.length === 0) return;
    const total = allCategories.length;
    // No batch needed if all categories fit in one batch
    if (total <= BATCH_SIZE) return;
    const nextIdx = (batchIndex + BATCH_SIZE) % total;
    const slice = allCategories.slice(nextIdx, nextIdx + BATCH_SIZE);
    // Wrap around if needed
    const visible =
      slice.length < BATCH_SIZE
        ? [...slice, ...allCategories.slice(0, BATCH_SIZE - slice.length)]
        : slice;
    set({ batchIndex: nextIdx, visibleCategories: visible });
  },

  setAllCategories: (cats) => {
    const visible = cats.slice(0, BATCH_SIZE);
    set({ allCategories: cats, visibleCategories: visible, batchIndex: 0 });
  },

  hydrate: () => {
    try {
      const saved = loadSphereSession();
      if (saved) {
        // Only restore selectedCategory — expanded/docked state is NOT persisted
        // across navigations (sphere always opens fresh on each page visit).
        const selectedCat = typeof saved.selectedCategory === 'string'
          ? saved.selectedCategory
          : null;

        set({
          selectedCategory: selectedCat,
          isSphereExpanded: true,   // always start expanded
          isSphereDocked: false,    // never start docked
          hasHydrated: true,
        });
      } else {
        set({ hasHydrated: true });
      }
    } catch (err) {
      console.warn('Failed to hydrate sphere store:', err);
      set({ hasHydrated: true });
    }
  },

  // Reset hydration flag on route change to allow re-initialization
  resetHydrationFlag: () => {
    set({ hasHydrated: false });
  },

  reset: () => {
    set(INITIAL_STATE);
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem(SPHERE_SESSION_KEY);
      } catch {}
    }
  },
}));

// ─── Note on selectors ──────────────────────────────────────────────────────
// Always use individual primitive-returning selectors:
//   const foo = useSphereStore(s => s.foo);
// Avoid object-returning selectors (they break Object.is equality and cause
// "Maximum update depth exceeded" render loops).
