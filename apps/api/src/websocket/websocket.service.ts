/**
 * WebSocket Service - Bridges Kafka events to real-time WebSocket emissions
 *
 * Responsibilities:
 * - Listen to Kafka events
 * - Transform events to WebSocket format
 * - Emit to appropriate user rooms
 * - Handle event routing logic
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import { WebSocketGateway as Gateway } from './websocket.gateway';
import { EventType, KAFKA_TOPICS, DomainEvent } from '../common/events/domain.event';

@Injectable()
export class WebSocketService {
  private readonly logger = new Logger('WebSocketService');

  constructor(@Inject(Gateway) private readonly gateway: Gateway) {
    this.logger.log('✅ WebSocket Service initialized');
  }

  /**
   * Handle product.viewed event
   * Does not emit directly (can be silent tracking)
   */
  handleProductViewed(event: DomainEvent) {
    this.logger.debug(`Event received: product.viewed for user ${event.data.userId}`);
    // Optionally track for analytics
  }

  /**
   * Handle recommendation.generated event
   * Emit live recommendations to user
   */
  handleRecommendationGenerated(event: DomainEvent, recommendationData: any) {
    try {
      const userId = event.data.userId;
      if (!userId) return;

      this.gateway.emitRecommendationUpdate(userId, {
        eventId: event.eventId,
        type: 'recommendation.generated',
        data: recommendationData,
        generatedAt: event.timestamp,
      });

      this.logger.log(`✅ Recommendation emitted to user ${userId}`);
    } catch (error) {
      this.logger.error(`Error handling recommendation.generated: ${error.message}`);
    }
  }

  /**
   * Handle cart.item_added event
   * Broadcast cart update to user
   */
  handleCartItemAdded(event: DomainEvent) {
    try {
      const userId = event.data.userId;
      if (!userId) return;

      this.gateway.emitCartUpdate(userId, {
        eventId: event.eventId,
        type: 'cart.item_added',
        productId: event.data.productId,
        quantity: event.data.quantity,
        price: event.data.price,
        total: event.data.total,
        addedAt: event.timestamp,
      });

      this.logger.log(`✅ Cart update emitted to user ${userId}`);
    } catch (error) {
      this.logger.error(`Error handling cart.item_added: ${error.message}`);
    }
  }

  /**
   * Handle cart.item_removed event
   */
  handleCartItemRemoved(event: DomainEvent) {
    try {
      const userId = event.data.userId;
      if (!userId) return;

      this.gateway.emitCartUpdate(userId, {
        eventId: event.eventId,
        type: 'cart.item_removed',
        productId: event.data.productId,
        removedAt: event.timestamp,
      });

      this.logger.log(`✅ Cart removal emitted to user ${userId}`);
    } catch (error) {
      this.logger.error(`Error handling cart.item_removed: ${error.message}`);
    }
  }

  /**
   * Handle cart.abandoned event
   */
  handleCartAbandoned(event: DomainEvent) {
    try {
      const userId = event.data.userId;
      if (!userId) return;

      this.gateway.emitNotification(userId, {
        eventId: event.eventId,
        type: 'cart.abandoned',
        title: 'Cart Abandoned',
        message: 'Your cart has items waiting for you!',
        itemsCount: event.data.itemsCount,
        cartTotal: event.data.cartTotal,
        action: {
          type: 'navigate',
          target: '/cart',
        },
        abandonedAt: event.timestamp,
      });

      this.logger.log(`✅ Abandoned cart notification sent to user ${userId}`);
    } catch (error) {
      this.logger.error(`Error handling cart.abandoned: ${error.message}`);
    }
  }

  /**
   * Handle order.created event
   */
  handleOrderCreated(event: DomainEvent) {
    try {
      const userId = event.data.userId;
      if (!userId) return;

      this.gateway.emitOrderStatusChange(userId, {
        eventId: event.eventId,
        type: 'order.created',
        orderId: event.data.orderId,
        status: 'pending',
        total: event.data.total,
        itemsCount: event.data.items?.length || 0,
        createdAt: event.timestamp,
      });

      this.logger.log(`✅ Order created event emitted to user ${userId}`);
    } catch (error) {
      this.logger.error(`Error handling order.created: ${error.message}`);
    }
  }

  /**
   * Handle order status changes
   */
  handleOrderStatusChanged(event: DomainEvent) {
    try {
      const userId = event.data.userId;
      if (!userId) return;

      const statusMessages = {
        confirmed: 'Your order has been confirmed!',
        shipped: 'Your order is on its way!',
        completed: 'Your order has been delivered!',
        cancelled: 'Your order has been cancelled.',
      };

      const status = event.data.status || 'unknown';

      this.gateway.emitOrderStatusChange(userId, {
        eventId: event.eventId,
        type: `order.${status}`,
        orderId: event.data.orderId,
        status: status,
        message: statusMessages[status] || `Order status: ${status}`,
        previousStatus: event.data.previousStatus,
        changedAt: event.timestamp,
      });

      // Also send as notification
      this.gateway.emitNotification(userId, {
        eventId: event.eventId,
        type: `order.${status}`,
        title: `Order ${status}`,
        message: statusMessages[status],
        orderId: event.data.orderId,
        action: {
          type: 'navigate',
          target: `/orders/${event.data.orderId}`,
        },
        notifiedAt: event.timestamp,
      });

      this.logger.log(`✅ Order status change event emitted to user ${userId}`);
    } catch (error) {
      this.logger.error(`Error handling order status change: ${error.message}`);
    }
  }

  /**
   * Generic event router
   * Routes events to appropriate handlers
   */
  routeEvent(event: DomainEvent, context: any = {}) {
    try {
      switch (event.eventType) {
        case EventType.PRODUCT_VIEWED:
          this.handleProductViewed(event);
          break;

        case EventType.RECOMMENDATION_GENERATED:
          this.handleRecommendationGenerated(event, context.recommendationData);
          break;

        case EventType.CART_ITEM_ADDED:
          this.handleCartItemAdded(event);
          break;

        case EventType.CART_ITEM_REMOVED:
          this.handleCartItemRemoved(event);
          break;

        case EventType.CART_ABANDONED:
          this.handleCartAbandoned(event);
          break;

        case EventType.ORDER_CREATED:
          this.handleOrderCreated(event);
          break;

        case EventType.ORDER_CONFIRMED:
        case EventType.ORDER_SHIPPED:
        case EventType.ORDER_COMPLETED:
        case EventType.ORDER_CANCELLED:
          this.handleOrderStatusChanged(event);
          break;

        default:
          this.logger.warn(`No handler for event type: ${event.eventType}`);
      }
    } catch (error) {
      this.logger.error(`Error routing event: ${error.message}`);
    }
  }

  /**
   * Get gateway statistics
   */
  getStats() {
    return this.gateway.getStats();
  }
}
