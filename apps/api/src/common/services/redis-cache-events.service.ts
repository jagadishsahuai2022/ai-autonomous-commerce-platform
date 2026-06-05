/*
 * Redis Event-Driven Cache Invalidation
 * Real-time cache consistency through Kafka event streams
 * Events: order.created, inventory.updated, price.changed, seller.rating.updated
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Consumer, Kafka, Producer } from 'kafkajs';
import { CacheService } from './cache.service';
import { StructuredLoggerService } from './structured-logger.service';

export interface CacheInvalidationEvent {
  eventType: string;
  entityType: 'product' | 'order' | 'seller' | 'user' | 'inventory';
  entityId: string;
  relatedIds?: string[];
  timestamp: number;
  correlationId: string;
}

@Injectable()
export class RedisCacheEventService implements OnModuleInit {
  private logger = new Logger(RedisCacheEventService.name);
  private kafka: Kafka;
  private consumer: Consumer;
  private producer: Producer;
  private isRunning = false;

  constructor(
    private cacheService: CacheService,
    private loggerService: StructuredLoggerService,
    private configService: ConfigService
  ) {
    this.kafka = new Kafka({
      clientId: 'cache-invalidation-service',
      brokers: (this.configService.get('KAFKA_BROKERS') || 'localhost:9092').split(','),
    });

    this.consumer = this.kafka.consumer({
      groupId: 'cache-invalidation-group',
    });

    this.producer = this.kafka.producer({
      retry: { retries: 0 },
    });
  }

  /**
   * Initialize Kafka consumer on module startup
   */
  async onModuleInit(): Promise<void> {
    try {
      await this.producer.connect();
      await this.consumer.connect();

      // Subscribe to relevant topics
      await this.consumer.subscribe({
        topics: [
          'order.events',
          'inventory.events',
          'price.events',
          'seller.events',
          'product.events',
        ],
        fromBeginning: false,
      });

      // Start consuming
      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          await this.handleCacheInvalidationEvent(topic, message);
        },
      });

      this.isRunning = true;
      this.logger.log('Redis cache invalidation service started');
    } catch (error) {
      this.logger.error(`Failed to initialize cache service: ${error.message}`);
      throw error;
    }
  }

  /**
   * Handle cache invalidation events from Kafka
   */
  private async handleCacheInvalidationEvent(topic: string, message: any): Promise<void> {
    try {
      const event = JSON.parse(message.value.toString()) as CacheInvalidationEvent;

      this.loggerService.logBusinessEvent('cache_invalidation_event', {
        topic,
        eventType: event.eventType,
        entityType: event.entityType,
        entityId: event.entityId,
        correlationId: event.correlationId,
      });

      // Route to appropriate cache invalidator
      switch (topic) {
        case 'order.events':
          await this.handleOrderEvent(event);
          break;

        case 'inventory.events':
          await this.handleInventoryEvent(event);
          break;

        case 'price.events':
          await this.handlePriceEvent(event);
          break;

        case 'seller.events':
          await this.handleSellerEvent(event);
          break;

        case 'product.events':
          await this.handleProductEvent(event);
          break;

        default:
          this.logger.warn(`Unknown topic: ${topic}`);
      }
    } catch (error) {
      this.logger.error(`Failed to handle cache event: ${error.message}`, error.stack);
    }
  }

  /**
   * Handle order-related cache invalidations
   */
  private async handleOrderEvent(event: CacheInvalidationEvent): Promise<void> {
    switch (event.eventType) {
      case 'order.created':
        // Invalidate user's order history
        await this.cacheService.invalidateByPattern(`user:${event.relatedIds?.[0]}:orders`);
        // Invalidate inventory cache for products in order
        for (const productId of event.relatedIds || []) {
          await this.cacheService.invalidateByTag(`product:${productId}:inventory`);
        }
        break;

      case 'order.status_changed':
        // Invalidate order detail cache
        await this.cacheService.invalidateByTag(`order:${event.entityId}`);
        break;

      case 'order.cancelled':
        // Restore inventory caches
        for (const productId of event.relatedIds || []) {
          await this.cacheService.invalidateByTag(`product:${productId}:inventory`);
        }
        break;
    }
  }

  /**
   * Handle inventory-related cache invalidations
   */
  private async handleInventoryEvent(event: CacheInvalidationEvent): Promise<void> {
    switch (event.eventType) {
      case 'inventory.updated':
        // Invalidate product cache
        await this.cacheService.invalidateByTag(`product:${event.entityId}`);
        await this.cacheService.invalidateByTag(`product:${event.entityId}:inventory`);
        // Invalidate search cache (inventory affects ranking)
        await this.cacheService.invalidateByPattern('search:*');
        break;

      case 'inventory.low':
        // Mark product as low stock in cache
        const productKey = `product:${event.entityId}:stock_status`;
        await this.cacheService.set(
          productKey,
          { status: 'low', timestamp: event.timestamp },
          3600 // 1 hour
        );
        break;

      case 'inventory.out_of_stock':
        // Invalidate product from rankings
        await this.cacheService.invalidateByTag(`product:${event.entityId}:ranking`);
        break;
    }
  }

  /**
   * Handle price-related cache invalidations
   */
  private async handlePriceEvent(event: CacheInvalidationEvent): Promise<void> {
    switch (event.eventType) {
      case 'price.changed':
        // Invalidate product cache
        await this.cacheService.invalidateByTag(`product:${event.entityId}`);
        // Invalidate all search results (prices affect ranking)
        await this.cacheService.invalidateByPattern('search:*');
        // Invalidate ranking cache
        await this.cacheService.invalidateByTag(`product:${event.entityId}:ranking`);
        break;

      case 'price.promotion':
        // Update product promotion cache
        const key = `product:${event.entityId}:promotion`;
        await this.cacheService.set(key, { isPromoted: true, timestamp: event.timestamp }, 3600);
        // Invalidate search to show new promotions
        await this.cacheService.invalidateByPattern('search:*');
        break;
    }
  }

  /**
   * Handle seller-related cache invalidations
   */
  private async handleSellerEvent(event: CacheInvalidationEvent): Promise<void> {
    switch (event.eventType) {
      case 'seller.rating_updated':
        // Invalidate seller cache
        await this.cacheService.invalidateByTag(`seller:${event.entityId}`);
        // Invalidate all products from this seller
        await this.cacheService.invalidateByPattern(`seller:${event.entityId}:products`);
        // Invalidate search results (seller rating affects ranking)
        await this.cacheService.invalidateByPattern('search:*');
        break;

      case 'seller.verification_status_changed':
        // Invalidate seller cache
        await this.cacheService.invalidateByTag(`seller:${event.entityId}`);
        // Invalidate products if seller became unverified
        await this.cacheService.invalidateByPattern(`seller:${event.entityId}:products`);
        break;

      case 'seller.suspended':
        // Remove seller from active caches
        await this.cacheService.invalidateByTag(`seller:${event.entityId}`);
        await this.cacheService.invalidateByPattern(`seller:${event.entityId}:products`);
        break;
    }
  }

  /**
   * Handle product-related cache invalidations
   */
  private async handleProductEvent(event: CacheInvalidationEvent): Promise<void> {
    switch (event.eventType) {
      case 'product.updated':
        // Invalidate product cache
        await this.cacheService.invalidateByTag(`product:${event.entityId}`);
        // Invalidate search cache
        await this.cacheService.invalidateByPattern('search:*');
        break;

      case 'product.created':
        // Invalidate category cache
        if (event.relatedIds?.[0]) {
          await this.cacheService.invalidateByPattern(`category:${event.relatedIds[0]}:products`);
        }
        // Invalidate search cache
        await this.cacheService.invalidateByPattern('search:*');
        break;

      case 'product.deleted':
        // Remove product from cache
        await this.cacheService.invalidateByTag(`product:${event.entityId}`);
        // Invalidate search cache
        await this.cacheService.invalidateByPattern('search:*');
        break;

      case 'product.recommendation_updated':
        // Invalidate personalization cache
        if (event.relatedIds?.[0]) {
          await this.cacheService.invalidateByTag(`user:${event.relatedIds[0]}:recommendations`);
        }
        break;
    }
  }

  /**
   * Publish cache invalidation event
   * Called by other services when they make changes
   */
  async publishInvalidationEvent(event: CacheInvalidationEvent): Promise<void> {
    if (!this.isRunning) {
      this.logger.warn('Cache service not running, skipping event publish');
      return;
    }

    try {
      const topic = this.getTopicForEntity(event.entityType);

      await this.producer.send({
        topic,
        messages: [
          {
            key: `${event.entityType}:${event.entityId}`,
            value: JSON.stringify(event),
            timestamp: event.timestamp.toString(),
          },
        ],
      });

      this.loggerService.logBusinessEvent('cache_invalidation_published', {
        eventType: event.eventType,
        entityType: event.entityType,
        entityId: event.entityId,
        topic,
      });
    } catch (error) {
      this.logger.error(`Failed to publish cache event: ${error.message}`, error.stack);
    }
  }

  /**
   * Trigger manual cache refresh
   * Useful for batch operations or data corrections
   */
  async invalidateEntityCache(
    entityType: 'product' | 'order' | 'seller' | 'user' | 'inventory',
    entityId: string,
    reason: string
  ): Promise<void> {
    try {
      // Clear all related caches based on entity type
      switch (entityType) {
        case 'product':
          await this.cacheService.invalidateByTag(`product:${entityId}`);
          await this.cacheService.invalidateByTag(`product:${entityId}:*`);
          await this.cacheService.invalidateByPattern('search:*');
          break;

        case 'seller':
          await this.cacheService.invalidateByTag(`seller:${entityId}`);
          await this.cacheService.invalidateByPattern(`seller:${entityId}:*`);
          break;

        case 'user':
          await this.cacheService.invalidateByPattern(`user:${entityId}:*`);
          break;

        case 'order':
          await this.cacheService.invalidateByTag(`order:${entityId}`);
          break;

        case 'inventory':
          await this.cacheService.invalidateByTag(`inventory:${entityId}`);
          await this.cacheService.invalidateByPattern('search:*');
          break;
      }

      this.loggerService.logBusinessEvent('cache_invalidation_manual', {
        entityType,
        entityId,
        reason,
      });
    } catch (error) {
      this.logger.error(`Failed to invalidate entity cache: ${error.message}`);
    }
  }

  /**
   * Get cache status and metrics
   */
  async getCacheStatus(): Promise<{
    isRunning: boolean;
    connectedTopics: string[];
    lastEventTimestamp?: number;
  }> {
    return {
      isRunning: this.isRunning,
      connectedTopics: [
        'order.events',
        'inventory.events',
        'price.events',
        'seller.events',
        'product.events',
      ],
      lastEventTimestamp: Date.now(),
    };
  }

  /**
   * Helper: Get Kafka topic for entity type
   */
  private getTopicForEntity(entityType: string): string {
    const topicMap: Record<string, string> = {
      product: 'product.events',
      order: 'order.events',
      seller: 'seller.events',
      user: 'user.events',
      inventory: 'inventory.events',
    };
    return topicMap[entityType] || 'events.unknown';
  }
}
