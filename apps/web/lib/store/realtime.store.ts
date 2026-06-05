/**
 * Zustand Store - Real-time State Management
 * Manages all real-time UI state (recommendations, cart, orders, notifications)
 *
 * Features:
 * - Centralized real-time state
 * - Automatic UI updates on events
 * - Notification management with auto-dismiss
 * - Connection state tracking
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

// Only expose state in Redux DevTools in development — prevents production leak
const applyDevtools = (process.env.NODE_ENV !== 'production'
  ? devtools
  : <T>(fn: T) => fn) as typeof devtools;

export interface Recommendation {
  id: string;
  productId: number;
  productName: string;
  price: number;
  image: string;
  score: number;
}

export interface CartItem {
  productId: number;
  productName: string;
  quantity: number;
  price: number;
  image: string;
}

export interface Order {
  id: number;
  status: 'pending' | 'confirmed' | 'shipped' | 'completed' | 'cancelled';
  total: number;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  action?: {
    type: 'navigate' | 'dismiss';
    target?: string;
  };
  createdAt: Date;
  expiresAt?: Date;
  read: boolean;
}

export interface RealtimeState {
  // Connection state
  isConnected: boolean;
  connectionError?: string;
  lastConnectedAt?: Date;

  // Recommendations
  recommendations: Recommendation[];
  recommendationsLoading: boolean;
  recommendationsUpdatedAt?: Date;

  // Cart
  cartItems: CartItem[];
  cartUpdatedAt?: Date;

  // Orders
  orders: Order[];
  orderUpdatedAt?: Date;

  // Notifications
  notifications: Notification[];
  unreadCount: number;

  // Actions
  setConnected: (connected: boolean, error?: string) => void;
  setRecommendations: (recommendations: Recommendation[]) => void;
  updateCart: (items: CartItem[]) => void;
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt' | 'read'>) => void;
  dismissNotification: (id: string) => void;
  markNotificationAsRead: (id: string) => void;
  clearNotifications: () => void;
  updateOrder: (order: Order) => void;
  reset: () => void;
}

const initialState = {
  isConnected: false,
  recommendations: [],
  recommendationsLoading: false,
  cartItems: [],
  orders: [],
  notifications: [],
  unreadCount: 0,
};

export const useRealtimeStore = create<RealtimeState>()(
  applyDevtools(
    persist(
      (set, get) => ({
        ...initialState,

        /**
         * Update connection state
         */
        setConnected: (connected: boolean, error?: string) =>
          set((state) => ({
            isConnected: connected,
            connectionError: error,
            lastConnectedAt: connected ? new Date() : state.lastConnectedAt,
          })),

        /**
         * Update recommendations with loading state
         */
        setRecommendations: (recommendations: Recommendation[]) =>
          set({
            recommendations,
            recommendationsLoading: false,
            recommendationsUpdatedAt: new Date(),
          }),

        /**
         * Update cart items
         */
        updateCart: (items: CartItem[]) =>
          set({
            cartItems: items,
            cartUpdatedAt: new Date(),
          }),

        /**
         * Add notification with auto-dismiss
         */
        addNotification: (notification: Omit<Notification, 'id' | 'createdAt' | 'read'>) => {
          const id = `notif_${Date.now()}_${Math.random()}`;
          const newNotification: Notification = {
            ...notification,
            id,
            createdAt: new Date(),
            read: false,
            expiresAt: notification.expiresAt || new Date(Date.now() + 5000), // Auto-dismiss after 5s
          };

          set((state) => ({
            notifications: [newNotification, ...state.notifications],
            unreadCount: state.unreadCount + 1,
          }));

          // Auto-dismiss notification
          if (newNotification.expiresAt) {
            const timeout = newNotification.expiresAt.getTime() - Date.now();
            setTimeout(
              () => {
                get().dismissNotification(id);
              },
              Math.max(timeout, 0)
            );
          }

          return id;
        },

        /**
         * Dismiss notification
         */
        dismissNotification: (id: string) =>
          set((state) => ({
            notifications: state.notifications.filter((n) => n.id !== id),
          })),

        /**
         * Mark notification as read
         */
        markNotificationAsRead: (id: string) =>
          set((state) => {
            const notification = state.notifications.find((n) => n.id === id);
            if (!notification || notification.read) return state;

            return {
              notifications: state.notifications.map((n) =>
                n.id === id ? { ...n, read: true } : n
              ),
              unreadCount: Math.max(0, state.unreadCount - 1),
            };
          }),

        /**
         * Clear all notifications
         */
        clearNotifications: () =>
          set({
            notifications: [],
            unreadCount: 0,
          }),

        /**
         * Update order status
         */
        updateOrder: (order: Order) =>
          set((state) => {
            const existingIndex = state.orders.findIndex((o) => o.id === order.id);
            const updatedOrders =
              existingIndex >= 0
                ? [
                    ...state.orders.slice(0, existingIndex),
                    order,
                    ...state.orders.slice(existingIndex + 1),
                  ]
                : [order, ...state.orders];

            return {
              orders: updatedOrders,
              orderUpdatedAt: new Date(),
            };
          }),

        /**
         * Reset to initial state
         */
        reset: () => set(initialState),
      }),
      {
        name: 'realtime-store', // Name for localStorage
        partialize: (state) => ({
          // Only persist recommendations and orders
          recommendations: state.recommendations,
          orders: state.orders,
        }),
      }
    )
  )
);

export default useRealtimeStore;
