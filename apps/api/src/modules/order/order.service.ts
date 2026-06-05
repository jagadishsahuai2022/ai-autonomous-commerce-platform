import { Injectable, Logger } from '@nestjs/common';
import { KafkaService } from '../../kafka/kafka.service';
import { LoggerService } from '../../common/logger.service';
import { EventType, KAFKA_TOPICS, EventBuilder } from '../../common/events/domain.event';

@Injectable()
export class OrderService {
  private readonly logger = new Logger('OrderService');
  private readonly appLogger = new LoggerService();
  private orders = [];

  constructor(private readonly kafkaService: KafkaService) {}

  /**
   * Get user's orders
   */
  getUserOrders(userId: number) {
    return {
      orders: (this.orders as any[]).filter((o: any) => o.userId === userId),
    };
  }

  /**
   * Create new order
   * Emits "order.created" event for processing and analytics
   */
  async createOrder(orderData: any) {
    try {
      const order = {
        id: (this.orders as any[]).length + 1,
        ...orderData,
        createdAt: new Date(),
        status: 'pending',
      };

      (this.orders as any[]).push(order);

      this.appLogger.log('Order created', {
        orderId: order.id,
        userId: order.userId,
        total: order.total,
        status: order.status,
      });

      // Emit order created event (non-blocking)
      this.emitOrderCreatedEvent(order).catch((error) => {
        this.logger.warn('Failed to emit order created event', error.message);
      });

      return { success: true, order };
    } catch (error) {
      this.logger.error('Error creating order', (error as any).message);
      throw error;
    }
  }

  /**
   * Update order status
   * Emits status change events for fulfillment tracking
   */
  async updateOrderStatus(orderId: number, newStatus: string) {
    try {
      const order = (this.orders as any[]).find((o: any) => o.id === orderId);
      if (!order) {
        return { success: false, message: 'Order not found' };
      }

      const previousStatus = order.status;
      order.status = newStatus;
      order.updatedAt = new Date();

      this.appLogger.log('Order status updated', {
        orderId,
        previousStatus,
        newStatus,
        userId: order.userId,
      });

      // Emit appropriate status event (non-blocking)
      this.emitOrderStatusEvent(order, newStatus).catch((error) => {
        this.logger.warn('Failed to emit order status event', error.message);
      });

      return { success: true, order };
    } catch (error) {
      this.logger.error('Error updating order status', (error as any).message);
      throw error;
    }
  }

  /**
   * Emit order created event
   */
  private async emitOrderCreatedEvent(order: any): Promise<void> {
    try {
      const event = new EventBuilder()
        .withEventType(EventType.ORDER_CREATED)
        .withUserId(order.userId)
        .withOrderId(order.id)
        .withData({
          orderId: order.id,
          userId: order.userId,
          items: order.items,
          total: order.total,
          shippingAddress: order.shippingAddress,
        })
        .build();

      // Emit to commerce and analytics topics
      await this.kafkaService.emitToMultiple(
        [KAFKA_TOPICS.COMMERCE_EVENTS, KAFKA_TOPICS.ANALYTICS],
        event
      );

      this.appLogger.debug('Order created event emitted', {
        orderId: order.id,
        userId: order.userId,
        eventId: event.eventId,
      });
    } catch (error) {
      this.logger.error('Failed to emit order created event', (error as any).message);
    }
  }

  /**
   * Emit order status change event
   */
  private async emitOrderStatusEvent(order: any, newStatus: string): Promise<void> {
    try {
      let eventType = EventType.ORDER_CREATED;

      // Map status to event type
      const statusEventMap = {
        confirmed: EventType.ORDER_CONFIRMED,
        shipped: EventType.ORDER_SHIPPED,
        completed: EventType.ORDER_COMPLETED,
        cancelled: EventType.ORDER_CANCELLED,
      };

      eventType = (statusEventMap as any)[newStatus] || EventType.ORDER_CREATED;

      const event = new EventBuilder()
        .withEventType(eventType)
        .withUserId(order.userId)
        .withOrderId(order.id)
        .withData({
          orderId: order.id,
          userId: order.userId,
          status: newStatus,
          previousStatus: order.status,
        })
        .build();

      // Emit to commerce and analytics topics
      await this.kafkaService.emitToMultiple(
        [KAFKA_TOPICS.COMMERCE_EVENTS, KAFKA_TOPICS.ANALYTICS],
        event
      );

      this.appLogger.debug('Order status event emitted', {
        orderId: order.id,
        userId: order.userId,
        status: newStatus,
        eventId: event.eventId,
      });
    } catch (error) {
      this.logger.error('Failed to emit order status event', (error as any).message);
    }
  }
}
