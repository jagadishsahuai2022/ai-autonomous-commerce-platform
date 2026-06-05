/**
 * Socket.IO Client Configuration & Setup
 * Production-grade real-time connection for Next.js frontend
 *
 * Features:
 * - Auto-reconnection with exponential backoff
 * - Event subscription/unsubscription
 * - Authentication via JWT
 * - Connection state management
 * - Type-safe event typing
 */

import { io, Socket, ManagerOptions, SocketOptions } from 'socket.io-client';

export interface SocketConfig extends Partial<ManagerOptions & SocketOptions> {
  url?: string;
  userId?: number;
  token?: string;
}

export type RealTimeEvent =
  | 'recommendation:updated'
  | 'cart:updated'
  | 'order:status_changed'
  | 'notification:created'
  | 'user:online'
  | 'user:offline'
  | 'connected'
  | 'disconnect'
  | 'error';

interface EventPayload {
  [key: string]: any;
}

interface ConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  userId?: number;
  socketId?: string;
  error?: string;
  lastMessageAt?: Date;
}

class RealtimeClient {
  private socket: Socket | null = null;
  private config: SocketConfig & { url: string; userId: number; token: string; forceNew: boolean };
  private connectionState: ConnectionState = {
    isConnected: false,
    isConnecting: false,
  };
  private eventHandlers: Map<RealTimeEvent, Set<(data: any) => void>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;

  constructor(config: SocketConfig = {}) {
    this.config = {
      forceNew: false,
      url:
        config.url ||
        `http://${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}:3002`,
      userId: config.userId || 0,
      token: config.token || '',
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10,
      transports: ['websocket', 'polling'],
      ...config,
    };
  }

  /**
   * Initialize and connect to WebSocket server
   */
  connect(userId: number, token?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        resolve();
        return;
      }

      this.connectionState.isConnecting = true;
      this.config.userId = userId;

      if (token) {
        this.config.token = token;
      }

      try {
        this.socket = io(this.config.url, {
          auth: {
            userId: this.config.userId,
            token: this.config.token,
          },
          reconnection: true,
          reconnectionDelay: this.config.reconnectionDelay,
          reconnectionDelayMax: this.config.reconnectionDelayMax,
          reconnectionAttempts: this.config.reconnectionAttempts,
          transports: this.config.transports,
        });

        // Connection event listeners
        this.socket.on('connect', () => this.handleConnect(resolve));
        this.socket.on('disconnect', () => this.handleDisconnect());
        this.socket.on('connect_error', (error) => this.handleError(error, reject));
        this.socket.on('error', (error) => this.handleError(error));

        // Default event listeners
        this.socket.on('connected', (data) => this.emit('connected', data));
        this.socket.on('user:online', (data) => this.emit('user:online', data));
        this.socket.on('user:offline', (data) => this.emit('user:offline', data));

        // Real-time event listeners
        this.socket.on('recommendation:updated', (data) =>
          this.emit('recommendation:updated', data)
        );
        this.socket.on('cart:updated', (data) => this.emit('cart:updated', data));
        this.socket.on('order:status_changed', (data) => this.emit('order:status_changed', data));
        this.socket.on('notification:created', (data) => this.emit('notification:created', data));

        // Timeout if connection takes too long
        setTimeout(() => {
          if (this.connectionState.isConnecting) {
            reject(new Error('Connection timeout'));
          }
        }, 10000);
      } catch (error) {
        this.handleError(error, reject);
      }
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connectionState.isConnected = false;
      this.connectionState.isConnecting = false;
      console.log('🔌 Disconnected from WebSocket server');
    }
  }

  /**
   * Subscribe to real-time events
   */
  on(event: RealTimeEvent, handler: (data: any) => void): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }

    this.eventHandlers.get(event)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.eventHandlers.get(event)?.delete(handler);
    };
  }

  /**
   * Subscribe to event once
   */
  once(event: RealTimeEvent, handler: (data: any) => void): void {
    const wrappedHandler = (data: any) => {
      handler(data);
      this.eventHandlers.get(event)?.delete(wrappedHandler);
    };

    this.on(event, wrappedHandler);
  }

  /**
   * Emit internal event to all listeners
   */
  private emit(event: RealTimeEvent, data?: any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
          this.connectionState.lastMessageAt = new Date();
        } catch (error) {
          console.error(`Error in ${event} handler:`, error);
        }
      });
    }
  }

  /**
   * Subscribe to channel
   */
  async subscribe(channel: string): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.socket?.connected) {
        resolve(false);
        return;
      }

      this.socket.emit('subscribe', { channel }, (response) => {
        resolve(response?.success || false);
      });
    });
  }

  /**
   * Unsubscribe from channel
   */
  async unsubscribe(channel: string): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.socket?.connected) {
        resolve(false);
        return;
      }

      this.socket.emit('unsubscribe', { channel }, (response) => {
        resolve(response?.success || false);
      });
    });
  }

  /**
   * Get connection state
   */
  getState(): ConnectionState {
    return { ...this.connectionState };
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connectionState.isConnected && !!this.socket?.connected;
  }

  /**
   * Handle successful connection
   */
  private handleConnect(resolve: () => void): void {
    this.connectionState.isConnected = true;
    this.connectionState.isConnecting = false;
    this.connectionState.socketId = this.socket?.id;
    this.connectionState.error = undefined;
    this.reconnectAttempts = 0;

    console.log('✅ Connected to WebSocket server', {
      socketId: this.socket?.id,
      userId: this.config.userId,
    });

    resolve();
  }

  /**
   * Handle disconnection
   */
  private handleDisconnect(): void {
    this.connectionState.isConnected = false;
    this.emit('disconnect', { socketId: this.socket?.id });

    console.warn('❌ Disconnected from WebSocket server');
  }

  /**
   * Handle connection errors
   */
  private handleError(error: any, reject?: (error: any) => void): void {
    this.connectionState.error = error?.message || 'Unknown error';
    this.connectionState.isConnecting = false;

    console.error('⚠️ WebSocket error:', this.connectionState.error);

    this.emit('error', { error: this.connectionState.error });

    if (reject && this.reconnectAttempts === 0) {
      reject(error);
    }

    this.reconnectAttempts++;
  }

  /**
   * Send custom message (client-to-server)
   */
  send(event: string, data: any, callback?: (response: any) => void): void {
    if (!this.socket?.connected) {
      console.warn('Not connected to WebSocket');
      return;
    }

    this.socket.emit(event, data, callback);
  }

  /**
   * Ping server to keep connection alive
   */
  ping(): Promise<number> {
    return new Promise((resolve) => {
      if (!this.socket?.connected) {
        resolve(-1);
        return;
      }

      const start = Date.now();
      this.socket.emit('ping', {}, (response) => {
        const latency = Date.now() - start;
        resolve(latency);
      });
    });
  }
}

// Export singleton instance
export const realtimeClient = new RealtimeClient();

export default RealtimeClient;
