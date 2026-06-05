/**
 * React Hooks - useWebSocket
 * Simplified WebSocket integration for React components
 *
 * Usage:
 * const { isConnected, recommendations } = useWebSocket();
 *
 * socket.on('recommendation:updated', (data) => ...);
 */

import { useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import RealtimeClient, { RealTimeEvent } from '../realtime';
import useRealtimeStore, { RealtimeState } from '../store/realtime.store';

interface UseWebSocketOptions {
  enabled?: boolean;
  autoConnect?: boolean;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: string) => void;
}

export const useWebSocket = (options: UseWebSocketOptions = {}) => {
  const { enabled = true, autoConnect = true, onConnect, onDisconnect, onError } = options;

  const { data: session } = useSession();
  const clientRef = useRef<RealtimeClient | null>(null);
  const unsubscribesRef = useRef<Array<() => void>>([]);

  const store = useRealtimeStore();

  /**
   * Initialize WebSocket connection
   */
  useEffect(() => {
    if (!enabled || !autoConnect || !(session?.user as any)?.id) {
      return;
    }

    const initConnection = async () => {
      try {
        // Initialize client
        if (!clientRef.current) {
          clientRef.current = new RealtimeClient({
            url: process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'http://localhost:3002',
          });
        }

        // Connect
        await clientRef.current.connect(
          (session.user as any).id as number,
          (session.user as any).token as string
        );

        store.setConnected(true);
        onConnect?.();

        // Subscribe to events
        setupEventListeners(clientRef.current);
      } catch (error) {
        console.error('Failed to connect WebSocket:', error);
        store.setConnected(false, (error as any)?.message);
        onError?.((error as any)?.message);
      }
    };

    initConnection();

    return () => {
      // Cleanup on unmount
      unsubscribesRef.current.forEach((unsubscribe) => unsubscribe());
      unsubscribesRef.current = [];
    };
  }, [enabled, autoConnect, session, store, onConnect, onError]);

  /**
   * Setup event listeners
   */
  const setupEventListeners = useCallback(
    (client: RealtimeClient) => {
      // Recommendation updates
      unsubscribesRef.current.push(
        client.on('recommendation:updated', (data) => {
          store.setRecommendations(data.payload?.recommendations || []);
        })
      );

      // Cart updates
      unsubscribesRef.current.push(
        client.on('cart:updated', (data) => {
          store.updateCart(data.payload?.items || []);
        })
      );

      // Order status changes
      unsubscribesRef.current.push(
        client.on('order:status_changed', (data) => {
          store.updateOrder({
            id: data.payload?.orderId,
            status: data.payload?.status,
            total: data.payload?.total,
            createdAt: data.payload?.createdAt,
            updatedAt: new Date().toISOString(),
          });
        })
      );

      // Notifications
      unsubscribesRef.current.push(
        client.on('notification:created', (data) => {
          store.addNotification({
            type: data.payload?.type || 'info',
            title: data.payload?.title || 'Notification',
            message: data.payload?.message || '',
            action: data.payload?.action,
            expiresAt: new Date(Date.now() + 5000),
          });
        })
      );

      // Disconnection
      unsubscribesRef.current.push(
        client.on('disconnect', () => {
          store.setConnected(false);
          onDisconnect?.();
        })
      );

      // Errors
      unsubscribesRef.current.push(
        client.on('error', (data) => {
          store.setConnected(false, data.error);
          onError?.(data.error);
        })
      );
    },
    [store, onDisconnect, onError]
  );

  /**
   * Expose socket methods
   */
  const socket = {
    on: (event: string, handler: (data: any) => void) => {
      if (clientRef.current) {
        return clientRef.current.on(event as RealTimeEvent, handler);
      }
      return () => {};
    },

    emit: (event: string, data: any) => {
      if (clientRef.current?.isConnected()) {
        clientRef.current.send(event, data);
      }
    },

    subscribe: (channel: string) => clientRef.current?.subscribe(channel),
    unsubscribe: (channel: string) => clientRef.current?.unsubscribe(channel),
    disconnect: () => clientRef.current?.disconnect(),
    ping: () => clientRef.current?.ping(),
  };

  return {
    socket,
    isConnected: store.isConnected,
    recommendations: store.recommendations,
    cartItems: store.cartItems,
    orders: store.orders,
    notifications: store.notifications,
    unreadCount: store.unreadCount,
    connectionError: store.connectionError,
  };
};

/**
 * Hook to add notification
 */
export const useNotification = () => {
  const store = useRealtimeStore();

  return {
    add: (
      title: string,
      message: string,
      type: 'info' | 'success' | 'warning' | 'error' = 'info',
      action?: any
    ) =>
      store.addNotification({
        type,
        title,
        message,
        action,
        expiresAt: new Date(Date.now() + 5000),
      }),

    dismiss: store.dismissNotification,
    clear: store.clearNotifications,
    markAsRead: store.markNotificationAsRead,
  };
};

/**
 * Hook to listen to specific events
 */
export const useRealtimeEvent = (
  event: string,
  handler: (data: any) => void,
  enabled: boolean = true
) => {
  const { socket } = useWebSocket({ autoConnect: enabled });

  useEffect(() => {
    if (enabled) {
      const unsubscribe = socket.on(event, handler);
      return unsubscribe;
    }
  }, [event, handler, enabled, socket]);
};

/**
 * Hook to track online status
 */
export const useOnlineStatus = () => {
  const { isConnected, connectionError } = useWebSocket();

  return {
    isOnline: isConnected,
    isOffline: !isConnected,
    error: connectionError,
  };
};
