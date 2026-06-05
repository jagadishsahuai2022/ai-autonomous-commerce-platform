/**
 * Zustand Cart Store with DB write-through
 *
 * - Initializes from localStorage for instant display (no loading flicker)
 * - Syncs with database in background when authenticated
 * - Every mutation writes to localStorage immediately + fires async DB save
 * - Dispatches 'cartUpdated' event for cross-component reactivity
 */

import { create } from 'zustand';

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  stock: number;
  url?: string;
  source?: 'INTERNAL' | 'EXTERNAL' | 'CATALOG';
}

interface CartState {
  items: CartItem[];
  dbSynced: boolean;

  // Actions
  setItems: (items: CartItem[]) => void;
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  syncFromDB: () => Promise<void>;
  /** Re-read items from localStorage into the in-memory store. Called when external code
   *  (smart-delegate, shopping-assistant) writes to localStorage and fires 'cartUpdated'. */
  reloadFromLocal: () => void;
  getCount: () => number;
  getTotal: () => number;
}

function readLocalCart(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem('cart');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function persistLocal(items: CartItem[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('cart', JSON.stringify(items));
  window.dispatchEvent(new Event('cartUpdated'));
}

async function persistDB(items: CartItem[]) {
  if (typeof window === 'undefined') return;
  const token = localStorage.getItem('authToken');
  if (!token) return;
  try {
    await fetch('/api/cart', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ items }),
    });
  } catch {
    // Silently fail DB writes - localStorage is the source of truth for immediate UX
  }
}

function persist(items: CartItem[]) {
  persistLocal(items);
  persistDB(items);
}

export const useCartStore = create<CartState>((set, get) => ({
  items: readLocalCart(),
  dbSynced: false,

  setItems: (items) => {
    set({ items });
    persist(items);
  },

  addItem: (item) => {
    const current = get().items;
    const existing = current.find((i) => i.id === item.id || i.productId === item.productId);
    let updated: CartItem[];
    if (existing) {
      updated = current.map((i) =>
        i.id === item.id || i.productId === item.productId
          ? { ...i, quantity: i.quantity + (item.quantity || 1) }
          : i
      );
    } else {
      updated = [...current, { ...item, quantity: item.quantity || 1 }];
    }
    set({ items: updated });
    persist(updated);
  },

  removeItem: (id) => {
    const updated = get().items.filter((i) => i.id !== id && i.productId !== id);
    set({ items: updated });
    persist(updated);
  },

  updateQuantity: (id, quantity) => {
    if (quantity < 1) {
      get().removeItem(id);
      return;
    }
    const updated = get().items.map((i) =>
      i.id === id || i.productId === id ? { ...i, quantity } : i
    );
    set({ items: updated });
    persist(updated);
  },

  clearCart: () => {
    set({ items: [] });
    persist([]);
  },

  reloadFromLocal: () => {
    const items = readLocalCart();
    set({ items });
  },

  syncFromDB: async () => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('authToken');
    if (!token) return;
    try {
      const res = await fetch('/api/cart', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const dbItems = Array.isArray(data.items) ? data.items : [];
        const localItems = readLocalCart();
        // If DB has items and local is empty, use DB. If both have items, merge.
        if (dbItems.length > 0 && localItems.length === 0) {
          set({ items: dbItems, dbSynced: true });
          persistLocal(dbItems);
        } else if (localItems.length > 0) {
          // Local takes priority - push to DB
          set({ dbSynced: true });
          persistDB(localItems);
        } else {
          set({ dbSynced: true });
        }
      }
    } catch {
      // DB not available - continue with localStorage
    }
  },

  getCount: () => get().items.reduce((sum, i) => sum + (i.quantity || 1), 0),
  getTotal: () => get().items.reduce((sum, i) => sum + i.price * (i.quantity || 1), 0),
}));
