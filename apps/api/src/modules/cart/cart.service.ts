import { Injectable, Logger } from '@nestjs/common';
import { KafkaService } from '../../kafka/kafka.service';
import { LoggerService } from '../../common/logger.service';
import { EventType, KAFKA_TOPICS, EventBuilder } from '../../common/events/domain.event';

@Injectable()
export class CartService {
  private readonly logger = new Logger('CartService');
  private readonly appLogger = new LoggerService();
  private carts = new Map();

  constructor(private readonly kafkaService: KafkaService) {}

  /**
   * Get user's cart
   */
  getCart(userId: number) {
    const cart = this.carts.get(userId) || { items: [], total: 0 };
    return { cart };
  }

  /**
   * Add item to cart
   * Emits "cart.item_added" event for analytics
   */
  async addItem(userId: number, item: any) {
    try {
      let cart = this.carts.get(userId);
      if (!cart) {
        cart = { items: [], total: 0 };
        this.carts.set(userId, cart);
      }

      cart.items.push(item);
      cart.total += item.price * item.quantity;

      this.appLogger.log('Item added to cart', {
        userId,
        productId: item.productId,
        quantity: item.quantity,
        price: item.price,
      });

      // Emit cart item added event (non-blocking)
      this.emitCartItemAddedEvent(userId, item).catch((error) => {
        this.logger.warn('Failed to emit cart item added event', error.message);
      });

      return { success: true, cart };
    } catch (error) {
      this.logger.error('Error adding item to cart', (error as any).message);
      throw error;
    }
  }

  /**
   * Remove item from cart
   */
  async removeItem(userId: number, productId: number) {
    try {
      const cart = this.carts.get(userId);
      if (!cart) {
        return { success: false, message: 'Cart not found' };
      }

      const itemIndex = cart.items.findIndex((i: any) => i.productId === productId);
      if (itemIndex === -1) {
        return { success: false, message: 'Item not found in cart' };
      }

      const removedItem = cart.items[itemIndex];
      cart.total -= removedItem.price * removedItem.quantity;
      cart.items.splice(itemIndex, 1);

      this.appLogger.log('Item removed from cart', {
        userId,
        productId,
      });

      return { success: true, cart };
    } catch (error) {
      this.logger.error('Error removing item from cart', (error as any).message);
      throw error;
    }
  }

  /**
   * Clear cart (e.g., after checkout)
   * Emits "cart.abandoned" event if cart had items
   */
  async clearCart(userId: number, reason: string = 'checkout') {
    try {
      const cart = this.carts.get(userId);

      if (cart && cart.items.length > 0 && reason === 'abandoned') {
        // Emit abandoned cart event
        this.emitCartAbandonedEvent(userId, cart).catch((error) => {
          this.logger.warn('Failed to emit cart abandoned event', error.message);
        });
      }

      this.carts.delete(userId);

      this.appLogger.log('Cart cleared', {
        userId,
        reason,
        itemsCount: cart?.items.length || 0,
      });

      return { success: true };
    } catch (error) {
      this.logger.error('Error clearing cart', (error as any).message);
      throw error;
    }
  }

  /**
   * Emit cart item added event
   */
  private async emitCartItemAddedEvent(userId: number, item: any): Promise<void> {
    try {
      const event = new EventBuilder()
        .withEventType(EventType.CART_ITEM_ADDED)
        .withUserId(userId)
        .withData({
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
          total: item.price * item.quantity,
        })
        .build();

      await this.kafkaService.emit(KAFKA_TOPICS.COMMERCE_EVENTS, event);

      this.appLogger.debug('Cart item added event emitted', {
        userId,
        productId: item.productId,
        eventId: event.eventId,
      });
    } catch (error) {
      this.logger.error('Failed to emit cart item added event', (error as any).message);
    }
  }

  /**
   * Emit cart abandoned event
   */
  private async emitCartAbandonedEvent(userId: number, cart: any): Promise<void> {
    try {
      const event = new EventBuilder()
        .withEventType(EventType.CART_ABANDONED)
        .withUserId(userId)
        .withData({
          itemsCount: cart.items.length,
          cartTotal: cart.total,
          products: cart.items.map((item: any) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
        })
        .build();

      await this.kafkaService.emit(KAFKA_TOPICS.COMMERCE_EVENTS, event);

      this.appLogger.log('Cart abandoned event emitted', {
        userId,
        itemsCount: cart.items.length,
        eventId: event.eventId,
      });
    } catch (error) {
      this.logger.error('Failed to emit cart abandoned event', (error as any).message);
    }
  }
}
