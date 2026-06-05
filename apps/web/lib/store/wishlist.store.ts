'use client';

import { create } from 'zustand';

// ── Types ────────────────────────────────────────────────────────────────────
export interface WishlistItemData {
  id: number;
  productId: string;
  productName: string;
  price: number | null;
  imageUrl: string | null;
  url: string | null;
  addedAt: string;
  collectionId: number | null;
}

export interface WishlistCollectionData {
  id: number;
  name: string;
  isDefault: boolean;
  createdAt: string;
}

interface WishlistState {
  collections: WishlistCollectionData[];
  items: WishlistItemData[];
  loaded: boolean;
  loading: boolean;

  // Actions
  fetchWishlists: () => Promise<void>;
  checkWishlisted: (
    productId: string
  ) => Promise<{ wishlisted: boolean; collectionId: number | null; collectionName: string | null }>;
  addItem: (
    product: { id: string; name: string; price?: number; imageUrl?: string },
    collectionId?: number
  ) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
  removeItemById: (itemId: number) => Promise<void>;
  moveItem: (itemId: number, targetCollectionId: number) => Promise<void>;
  createCollection: (name: string) => Promise<WishlistCollectionData | null>;
  renameCollection: (collectionId: number, name: string) => Promise<void>;
  deleteCollection: (collectionId: number) => Promise<void>;

  // Helpers
  isProductWishlisted: (productId: string) => boolean;
  getCollectionItems: (collectionId: number) => WishlistItemData[];
}

function getAuthHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const cookieToken = document.cookie
    .split(';')
    .find((c) => c.trim().startsWith('authToken='))
    ?.split('=')[1]
    ?.trim();
  const token = cookieToken || localStorage.getItem('authToken') || '';
  const email = localStorage.getItem('userEmail') || '';
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (email) headers['x-user-email'] = email.toLowerCase();
  return headers;
}

export const useWishlistStore = create<WishlistState>((set, get) => ({
  collections: [],
  items: [],
  loaded: false,
  loading: false,

  fetchWishlists: async () => {
    if (get().loading) return;
    set({ loading: true });
    try {
      const res = await fetch('/api/user/wishlist', { headers: getAuthHeaders() });
      if (!res.ok) {
        set({ loading: false });
        return;
      }
      const data = await res.json();
      set({
        collections: data.collections || [],
        items: data.items || [],
        loaded: true,
        loading: false,
      });
    } catch {
      set({ loading: false });
    }
  },

  checkWishlisted: async (productId: string) => {
    try {
      const res = await fetch(
        `/api/user/wishlist?action=check&productId=${encodeURIComponent(productId)}`,
        { headers: getAuthHeaders() }
      );
      if (!res.ok) return { wishlisted: false, collectionId: null, collectionName: null };
      return await res.json();
    } catch {
      return { wishlisted: false, collectionId: null, collectionName: null };
    }
  },

  addItem: async (product, collectionId) => {
    try {
      const res = await fetch('/api/user/wishlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          productId: String(product.id),
          productName: product.name,
          price: product.price,
          imageUrl: product.imageUrl,
          collectionId,
        }),
      });
      if (res.ok) {
        await get().fetchWishlists();
        window.dispatchEvent(new Event('wishlistUpdated'));
      }
    } catch {
      /* ignore */
    }
  },

  removeItem: async (productId: string) => {
    try {
      const res = await fetch(`/api/user/wishlist?productId=${encodeURIComponent(productId)}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        set((state) => ({ items: state.items.filter((i) => i.productId !== productId) }));
        window.dispatchEvent(new Event('wishlistUpdated'));
      }
    } catch {
      /* ignore */
    }
  },

  removeItemById: async (itemId: number) => {
    try {
      const res = await fetch(`/api/user/wishlist?itemId=${itemId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        set((state) => ({ items: state.items.filter((i) => i.id !== itemId) }));
        window.dispatchEvent(new Event('wishlistUpdated'));
      }
    } catch {
      /* ignore */
    }
  },

  moveItem: async (itemId: number, targetCollectionId: number) => {
    try {
      const res = await fetch('/api/user/wishlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ action: 'move_item', itemId, targetCollectionId }),
      });
      if (res.ok) {
        set((state) => ({
          items: state.items.map((i) =>
            i.id === itemId ? { ...i, collectionId: targetCollectionId } : i
          ),
        }));
      }
    } catch {
      /* ignore */
    }
  },

  createCollection: async (name: string) => {
    try {
      const res = await fetch('/api/user/wishlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ action: 'create_collection', name }),
      });
      if (res.ok) {
        const data = await res.json();
        const col = data.collection;
        if (col) {
          set((state) => ({ collections: [...state.collections, col] }));
          return col;
        }
      }
      return null;
    } catch {
      return null;
    }
  },

  renameCollection: async (collectionId: number, name: string) => {
    try {
      const res = await fetch('/api/user/wishlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ action: 'rename_collection', collectionId, name }),
      });
      if (res.ok) {
        set((state) => ({
          collections: state.collections.map((c) => (c.id === collectionId ? { ...c, name } : c)),
        }));
      }
    } catch {
      /* ignore */
    }
  },

  deleteCollection: async (collectionId: number) => {
    try {
      const res = await fetch('/api/user/wishlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ action: 'delete_collection', collectionId }),
      });
      if (res.ok) {
        set((state) => ({
          collections: state.collections.filter((c) => c.id !== collectionId),
          items: state.items.filter((i) => i.collectionId !== collectionId),
        }));
      }
    } catch {
      /* ignore */
    }
  },

  isProductWishlisted: (productId: string) => {
    return get().items.some((i) => String(i.productId) === String(productId));
  },

  getCollectionItems: (collectionId: number) => {
    return get().items.filter((i) => i.collectionId === collectionId);
  },
}));
