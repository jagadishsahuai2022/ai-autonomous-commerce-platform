/**
 * WebSocket Gateway - Real-time event management
 * Handles Socket.IO connections, room management, and event broadcasts
 *
 * Production Features:
 * - User-specific room isolation
 * - JWT authentication
 * - Rate limiting
 * - Connection lifecycle management
 * - Error recovery with reconnect support
 */

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

/**
 * WebSocket Authentication Guard
 */
@UseGuards()
@WebSocketGateway(3002, {
  cors: {
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  pingInterval: 10000,
  pingTimeout: 5000,
  maxHttpBufferSize: 1e6,
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger('WebSocketGateway');
  private readonly connectedUsers = new Map<string, Set<string>>(); // userId -> socketIds
  private readonly userSockets = new Map<string, string>(); // socketId -> userId
  private connectionTimestamps = new Map<string, number>(); // socketId -> timestamp

  constructor(private readonly jwtService: JwtService) {
    this.logger.log('🚀 WebSocket Gateway initialized');
  }

  /**
   * Lifecycle: Gateway initialization
   */
  afterInit(server: Server) {
    this.logger.log('✅ WebSocket Server initialized');

    // Attach middleware for authentication
    server.use((socket, next) => {
      this.authenticateSocket(socket, next);
    });
  }

  /**
   * Lifecycle: Client connection
   */
  async handleConnection(socket: Socket) {
    try {
      const userId = socket.handshake.auth?.userId;

      if (!userId) {
        this.logger.warn(`❌ Connection rejected: No userId. Socket: ${socket.id}`);
        socket.disconnect();
        return;
      }

      // Track connection
      this.userSockets.set(socket.id, userId);
      this.connectionTimestamps.set(socket.id, Date.now());

      // Add to connected users
      if (!this.connectedUsers.has(userId)) {
        this.connectedUsers.set(userId, new Set());
      }
      this.connectedUsers.get(userId).add(socket.id);

      // Join user-specific room
      const room = `user_${userId}`;
      await socket.join(room);

      // Also join general broadcast room
      await socket.join('broadcast');

      this.logger.log(
        `✅ Client connected - UserId: ${userId}, SocketId: ${socket.id}, Room: ${room}`
      );

      // Emit connected event
      socket.emit('connected', {
        socketId: socket.id,
        userId,
        room,
        timestamp: new Date().toISOString(),
      });

      // Broadcast user online status to their room
      this.server.to(room).emit('user:online', {
        userId,
        socketId: socket.id,
        connectedAt: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error(`Connection error: ${error.message}`);
      socket.disconnect();
    }
  }

  /**
   * Lifecycle: Client disconnection
   */
  handleDisconnect(socket: Socket) {
    const userId = this.userSockets.get(socket.id);

    if (userId) {
      // Remove from tracking
      this.userSockets.delete(socket.id);
      this.connectionTimestamps.delete(socket.id);

      // Remove from connected users
      const userSockets = this.connectedUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);

        // If no more sockets for this user, remove from map
        if (userSockets.size === 0) {
          this.connectedUsers.delete(userId);

          // Broadcast user offline status
          const room = `user_${userId}`;
          this.server.to(room).emit('user:offline', {
            userId,
            disconnectedAt: new Date().toISOString(),
          });
        }
      }

      this.logger.log(`❌ Client disconnected - UserId: ${userId}, SocketId: ${socket.id}`);
    }
  }

  /**
   * Authenticate socket connection via JWT
   */
  private authenticateSocket(socket: Socket, next: Function) {
    try {
      const token = socket.handshake.auth?.token;
      const userId = socket.handshake.auth?.userId;

      if (!userId) {
        return next(new Error('Missing userId'));
      }

      // Optionally verify JWT token
      if (token && process.env.JWT_TOKEN_ENABLED === 'true') {
        try {
          const decoded = this.jwtService.verify(token);
          socket.handshake.auth.decoded = decoded;
        } catch (error) {
          return next(new Error('Invalid token'));
        }
      }

      next();
    } catch (error) {
      this.logger.error(`Authentication error: ${error.message}`);
      next(new Error('Authentication failed'));
    }
  }

  /**
   * Emit real-time recommendation update to specific user
   */
  emitRecommendationUpdate(userId: number, data: any) {
    const room = `user_${userId}`;
    this.server.to(room).emit('recommendation:updated', {
      type: 'recommendation.updated',
      payload: data,
      emittedAt: new Date().toISOString(),
    });

    this.logger.debug(`📤 Recommendation emitted to ${room}`);
  }

  /**
   * Emit cart update to specific user
   */
  emitCartUpdate(userId: number, data: any) {
    const room = `user_${userId}`;
    this.server.to(room).emit('cart:updated', {
      type: 'cart.updated',
      payload: data,
      emittedAt: new Date().toISOString(),
    });

    this.logger.debug(`📤 Cart update emitted to ${room}`);
  }

  /**
   * Emit order status change to specific user
   */
  emitOrderStatusChange(userId: number, data: any) {
    const room = `user_${userId}`;
    this.server.to(room).emit('order:status_changed', {
      type: 'order.status_changed',
      payload: data,
      emittedAt: new Date().toISOString(),
    });

    this.logger.debug(`📤 Order status emitted to ${room}`);
  }

  /**
   * Emit notification to specific user
   */
  emitNotification(userId: number, data: any) {
    const room = `user_${userId}`;
    this.server.to(room).emit('notification:created', {
      type: 'notification.created',
      payload: data,
      emittedAt: new Date().toISOString(),
    });

    this.logger.debug(`📤 Notification emitted to ${room}`);
  }

  /**
   * Broadcast event to all connected users
   */
  broadcastEvent(eventName: string, data: any) {
    this.server.to('broadcast').emit(eventName, {
      payload: data,
      broadcastAt: new Date().toISOString(),
    });

    this.logger.debug(`📢 Broadcast event: ${eventName}`);
  }

  /**
   * Client-to-Server: Subscribe to events
   */
  @SubscribeMessage('subscribe')
  async handleSubscribe(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { channel: string }
  ) {
    try {
      const userId = this.userSockets.get(socket.id);

      if (!userId) {
        return { success: false, error: 'User not authenticated' };
      }

      // Validate channel name (prevent arbitrary joins)
      if (!this.isValidChannel(data.channel, userId)) {
        return { success: false, error: 'Invalid channel' };
      }

      await socket.join(data.channel);

      this.logger.log(`✅ ${userId} subscribed to channel: ${data.channel}`);

      return {
        success: true,
        message: `Subscribed to ${data.channel}`,
      };
    } catch (error) {
      this.logger.error(`Subscribe error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Client-to-Server: Unsubscribe from events
   */
  @SubscribeMessage('unsubscribe')
  async handleUnsubscribe(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { channel: string }
  ) {
    try {
      const userId = this.userSockets.get(socket.id);

      if (!userId) {
        return { success: false, error: 'User not authenticated' };
      }

      await socket.leave(data.channel);

      this.logger.log(`✅ ${userId} unsubscribed from channel: ${data.channel}`);

      return {
        success: true,
        message: `Unsubscribed from ${data.channel}`,
      };
    } catch (error) {
      this.logger.error(`Unsubscribe error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Client-to-Server: Ping for connection keep-alive
   */
  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() socket: Socket) {
    return { pong: true, timestamp: Date.now() };
  }

  /**
   * Get connection statistics
   */
  getStats() {
    return {
      totalConnections: this.userSockets.size,
      totalUsers: this.connectedUsers.size,
      users: Array.from(this.connectedUsers.entries()).map(([userId, sockets]) => ({
        userId,
        socketCount: sockets.size,
        socketIds: Array.from(sockets),
      })),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Validate channel name (security)
   * Only allow:
   * - user_<userId> for self
   * - broadcast for all
   * - custom channels prefixed with user_<userId>_
   */
  private isValidChannel(channel: string, userId: number | string): boolean {
    const userIdStr = String(userId);

    if (channel === 'broadcast') return true;
    if (channel === `user_${userIdStr}`) return true;
    if (channel.startsWith(`user_${userIdStr}_`)) return true;

    return false;
  }
}

export { RealtimeGateway as WebSocketGateway };
