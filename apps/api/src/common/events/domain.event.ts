import { randomUUID } from 'crypto';

/**
 * Domain Event Types
 * Following naming convention: <aggregate>.<action>
 */
export enum EventType {
  // Product events
  PRODUCT_VIEWED = 'product.viewed',
  PRODUCT_CREATED = 'product.created',
  PRODUCT_UPDATED = 'product.updated',

  // Cart events
  CART_ITEM_ADDED = 'cart.item_added',
  CART_ITEM_REMOVED = 'cart.item_removed',
  CART_ABANDONED = 'cart.abandoned',

  // Order events
  ORDER_CREATED = 'order.created',
  ORDER_CONFIRMED = 'order.confirmed',
  ORDER_SHIPPED = 'order.shipped',
  ORDER_COMPLETED = 'order.completed',
  ORDER_CANCELLED = 'order.cancelled',

  // User events
  USER_REGISTERED = 'user.registered',
  USER_UPDATED = 'user.updated',

  // Recommendation events (from AI service)
  RECOMMENDATION_GENERATED = 'recommendation.generated',
}

/**
 * Kafka Topics
 * Topic naming: <domain>.<event_category>
 */
export const KAFKA_TOPICS = {
  // Product topics
  PRODUCT_EVENTS: 'product-events',

  // Commerce topics
  COMMERCE_EVENTS: 'commerce-events',

  // User behavior topics
  USER_BEHAVIOR: 'user-behavior',

  // AI/ML topics
  ML_EVENTS: 'ml-events',
  RECOMMENDATIONS: 'recommendations',

  // Analytics topics
  ANALYTICS: 'analytics',
};

/**
 * Domain Event Interface
 * All events follow this structure
 */
export interface DomainEvent {
  eventId: string; // Unique event ID (UUID)
  eventType: EventType; // Event type enum
  timestamp: string; // ISO 8601 timestamp
  version: number; // Event schema version
  data: {
    userId?: number; // User who triggered the event
    productId?: number; // Product involved
    orderId?: number; // Order involved
    cartId?: number; // Cart involved
    [key: string]: any; // Additional context-specific fields
  };
  metadata?: {
    source: string; // Service that emitted the event
    correlationId?: string; // For tracing related events
    causationId?: string; // ID of the event that caused this one
  };
}

/**
 * Helper class to build domain events with validation
 */
export class EventBuilder {
  private event: DomainEvent = {
    eventId: randomUUID(),
    eventType: EventType.PRODUCT_VIEWED,
    timestamp: new Date().toISOString(),
    version: 1,
    data: {},
    metadata: {
      source: 'api',
    },
  };

  /**
   * Set event type
   */
  withEventType(eventType: EventType): this {
    this.event.eventType = eventType;
    return this;
  }

  /**
   * Set user ID
   */
  withUserId(userId: number): this {
    this.event.data.userId = userId;
    return this;
  }

  /**
   * Set product ID
   */
  withProductId(productId: number): this {
    this.event.data.productId = productId;
    return this;
  }

  /**
   * Set order ID
   */
  withOrderId(orderId: number): this {
    this.event.data.orderId = orderId;
    return this;
  }

  /**
   * Set cart ID
   */
  withCartId(cartId: number): this {
    this.event.data.cartId = cartId;
    return this;
  }

  /**
   * Add custom data field
   */
  withData(data: Record<string, any>): this {
    this.event.data = { ...this.event.data, ...data };
    return this;
  }

  /**
   * Set correlation ID for tracing
   */
  withCorrelationId(correlationId: string): this {
    if (!this.event.metadata) {
      this.event.metadata = { source: 'api' };
    }
    this.event.metadata.correlationId = correlationId;
    return this;
  }

  /**
   * Set causation ID
   */
  withCausationId(causationId: string): this {
    if (!this.event.metadata) {
      this.event.metadata = { source: 'api' };
    }
    this.event.metadata.causationId = causationId;
    return this;
  }

  /**
   * Set source service
   */
  withSource(source: string): this {
    if (!this.event.metadata) {
      this.event.metadata = { source: 'api' };
    }
    this.event.metadata.source = source;
    return this;
  }

  /**
   * Build and validate event
   */
  build(): DomainEvent {
    // Validate required fields
    if (!this.event.data.userId && !this.event.data.productId && !this.event.data.orderId) {
      throw new Error('Event must have at least one of: userId, productId, orderId');
    }

    return {
      ...this.event,
      // Ensure timestamp is fresh
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Create quick event (convenience method)
 */
export function createEvent(eventType: EventType, data: Record<string, any>): DomainEvent {
  return new EventBuilder().withEventType(eventType).withData(data).build();
}
