'use client';

import { create } from 'zustand';

export interface ScoringDimension {
  id: number;
  key: string;
  label: string;
  weightage: number;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  // R59: New fields
  group?: string;
  scorerKey?: string;
  isNegative?: boolean;
  minWeightage?: number;
  maxWeightage?: number;
}

// Default fallback dimensions (used before DB fetch completes)
const DEFAULT_DIMENSIONS: ScoringDimension[] = [
  { id: 0, key: 'budget_fit', label: 'Budget Fit', weightage: 0.10, description: 'How well the product price fits the user budget', isActive: true, sortOrder: 1 },
  { id: 0, key: 'spec_match', label: 'Spec Match', weightage: 0.10, description: 'Feature specification match against user requirements', isActive: true, sortOrder: 2 },
  { id: 0, key: 'warranty_coverage', label: 'Warranty Coverage', weightage: 0.10, description: 'Product warranty and protection plan coverage', isActive: true, sortOrder: 3 },
  { id: 0, key: 'manufacturer_profile', label: 'Manufacturer Profile', weightage: 0.10, description: 'Manufacturer brand tier, R&D strength, and reputation', isActive: true, sortOrder: 4 },
  { id: 0, key: 'brand_trust', label: 'Brand Trust', weightage: 0.10, description: 'Brand alignment with user preferences and trust level', isActive: true, sortOrder: 5 },
  { id: 0, key: 'delivery_performance', label: 'Delivery Performance', weightage: 0.10, description: 'Delivery speed and on-time performance history', isActive: true, sortOrder: 6 },
  { id: 0, key: 'verified_ratings', label: 'Verified Ratings', weightage: 0.10, description: 'OTP-verified review ratings and review volume', isActive: true, sortOrder: 7 },
  { id: 0, key: 'eligible_for_return', label: 'Eligible For Return', weightage: 0.10, description: 'Product return eligibility flag', isActive: true, sortOrder: 8 },
  { id: 0, key: 'eligible_for_replacement', label: 'Eligible For Replacement', weightage: 0.20, description: 'Product replacement eligibility flag', isActive: true, sortOrder: 9 },
];

interface ScoringDimensionState {
  dimensions: ScoringDimension[];
  loaded: boolean;
  loading: boolean;
  error: string | null;

  fetchDimensions: () => Promise<void>;
  updateDimensions: (dimensions: ScoringDimension[]) => Promise<{ success: boolean; error?: string }>;
  getWeight: (key: string) => number;
  getDimensionMap: () => Record<string, number>;
}

export const useScoringDimensionStore = create<ScoringDimensionState>((set, get) => ({
  dimensions: DEFAULT_DIMENSIONS,
  loaded: false,
  loading: false,
  error: null,

  fetchDimensions: async () => {
    if (get().loading) return;
    set({ loading: true, error: null });
    try {
      const res = await fetch('/api/admin/scoring-dimensions');
      if (!res.ok) { set({ loading: false }); return; }
      const data = await res.json();
      if (data.dimensions && data.dimensions.length > 0) {
        set({ dimensions: data.dimensions, loaded: true, loading: false });
      } else {
        set({ loaded: true, loading: false });
      }
    } catch {
      set({ loading: false });
    }
  },

  updateDimensions: async (dims: ScoringDimension[]) => {
    set({ loading: true, error: null });
    try {
      const token = document.cookie.split(';').find(c => c.trim().startsWith('authToken='))?.split('=')[1]?.trim()
        || localStorage.getItem('authToken') || '';
      const res = await fetch('/api/admin/scoring-dimensions', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ dimensions: dims }),
      });
      const data = await res.json();
      if (res.ok && data.dimensions) {
        set({ dimensions: data.dimensions, loading: false });
        return { success: true };
      }
      set({ loading: false, error: data.error || 'Failed to update' });
      return { success: false, error: data.error };
    } catch (err: any) {
      set({ loading: false, error: err.message });
      return { success: false, error: err.message };
    }
  },

  getWeight: (key: string) => {
    const dim = get().dimensions.find(d => d.key === key);
    return dim?.weightage ?? 0.10;
  },

  getDimensionMap: () => {
    const map: Record<string, number> = {};
    for (const d of get().dimensions) {
      map[d.key] = d.weightage;
    }
    return map;
  },
}));
