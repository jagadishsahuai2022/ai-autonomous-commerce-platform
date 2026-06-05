// Phase 2: WebSocket Hook - Real-time Updates
'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import io, { Socket } from 'socket.io-client';

// In production, socket.io connects to the same origin (Nginx proxies
// /socket.io/* → NestJS via the Next.js rewrite or Nginx location).
// In local dev, fall back to localhost:3001.
const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL ||
  (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001');

// Global socket instance
let globalSocket: Socket | null = null;
const listeners = new Map<string, Set<(data: any) => void>>();

/**
 * Initialize WebSocket connection with authentication
 * Phase 2: Called once on app startup
 */
function initializeWebSocket(): Socket {
  if (globalSocket?.connected) {
    return globalSocket;
  }

  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

  const socket = io(WS_URL, {
    auth: {
      token: token || 'anonymous',
    },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
  });

  // Connection lifecycle events
  socket.on('connect', () => {
    console.log('✅ WebSocket connected:', socket.id);
  });

  socket.on('disconnect', () => {
    console.log('❌ WebSocket disconnected');
  });

  socket.on('error', (error: any) => {
    console.error('🔥 WebSocket error:', error);
  });

  socket.on('reconnect_attempt', () => {
    console.log('🔄 Reconnecting WebSocket...');
  });

  globalSocket = socket;
  return socket;
}

/**
 * Phase 2: Subscribe to a Real-time Event
 * Usage:
 *   useWebSocketEvent('order:status_changed', (data) => {
 *     queryClient.invalidateQueries(['order', data.orderId]);
 *   });
 *
 * Events:
 *   - order:status_changed {orderId, status, updatedAt}
 *   - order:shipped {orderId, trackingNumber, carrier}
 *   - order:delivered {orderId}
 *   - cart:updated {cart}
 *   - recommendation:updated {productId, recommendation}
 *   - notification:created {type, message}
 *   - product:stock_changed {productId, inStock}
 */
export function useWebSocketEvent(eventName: string, handler: (data: any) => void): () => void {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    // Initialize socket on first subscription
    if (!globalSocket) {
      initializeWebSocket();
    }

    if (!globalSocket) return;

    // Register handler
    const wrappedHandler = (data: any) => handlerRef.current(data);

    // Add to global listeners map (for debugging)
    if (!listeners.has(eventName)) {
      listeners.set(eventName, new Set());
    }
    listeners.get(eventName)?.add(handlerRef.current);

    // Listen to event
    globalSocket.on(eventName, wrappedHandler);

    // Return cleanup function
    return () => {
      globalSocket?.off(eventName, wrappedHandler);
      listeners.get(eventName)?.delete(handlerRef.current);
    };
  }, [eventName]);

  // Return unsubscribe function
  const unsubscribe = useCallback(() => {
    if (globalSocket) {
      globalSocket.off(eventName, handlerRef.current);
      listeners.get(eventName)?.delete(handlerRef.current);
    }
  }, [eventName]);

  return unsubscribe;
}

/**
 * Phase 2: Emit an Event to Server
 * Usage:
 *   useWebSocketEmit().emit('cart:add_item', { productId, quantity });
 */
export function useWebSocketEmit() {
  useEffect(() => {
    if (!globalSocket?.connected) {
      initializeWebSocket();
    }
  }, []);

  return {
    emit: (eventName: string, data: any) => {
      if (globalSocket?.connected) {
        globalSocket.emit(eventName, data);
      } else {
        console.warn(`Socket not connected, queueing: ${eventName}`);
      }
    },
    isConnected: globalSocket?.connected || false,
  };
}

/**
 * Phase 2: Get Socket Connection Status
 */
export function useWebSocketConnection() {
  const [status, setStatus] = useState<'connected' | 'disconnected'>('disconnected');

  useEffect(() => {
    if (!globalSocket) {
      initializeWebSocket();
    }

    const checkStatus = () => {
      setStatus(globalSocket?.connected ? 'connected' : 'disconnected');
    };

    globalSocket?.on('connect', checkStatus);
    globalSocket?.on('disconnect', checkStatus);

    checkStatus();

    return () => {
      globalSocket?.off('connect', checkStatus);
      globalSocket?.off('disconnect', checkStatus);
    };
  }, []);

  return status;
}

/**
 * Real-time Event Examples
 *
 * ORDER EVENTS:
 *   socket.emit('order:status_changed', { orderId, status, timestamp })
 *   socket.emit('order:shipped', { orderId, trackingNumber, carrier })
 *   socket.emit('order:delivered', { orderId })
 *   socket.emit('order:cancelled', { orderId, reason })
 *
 * CART EVENTS:
 *   socket.emit('cart:updated', { userId, items, total })
 *   socket.emit('cart:synced', { userId, cart })
 *
 * PRODUCT EVENTS:
 *   socket.emit('product:stock_changed', { productId, inStock, quantity })
 *   socket.emit('product:price_changed', { productId, newPrice })
 *
 * RECOMMENDATION EVENTS:
 *   socket.emit('recommendation:updated', { userId, recommendations })
 *
 * NOTIFICATION EVENTS:
 *   socket.emit('notification:created', { type, message, data })
 */

export default useWebSocketEvent;
