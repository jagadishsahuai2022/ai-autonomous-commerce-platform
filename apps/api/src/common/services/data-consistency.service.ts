/**
 * Data Consistency Layer
 * Prevents stale reads, ensures consistency across cache and DB
 */

import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from './cache.service';
import { PrismaService } from '../../services/prisma.service';

export interface ConsistencyOptions {
  cacheTTL?: number;
  fallbackToDb?: boolean;
  invalidateRelated?: string[];
}

@Injectable()
export class DataConsistencyService {
  private readonly logger = new Logger(DataConsistencyService.name);

  constructor(
    private cache: CacheService,
    private prisma: PrismaService
  ) {}

  /**
   * Read with consistency check (cache → DB fallback)
   */
  async readConsistent<T>(
    cacheKey: string,
    dbFn: () => Promise<T>,
    options: ConsistencyOptions = {}
  ): Promise<T> {
    try {
      // Try cache first
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return cached as T;
      }
    } catch (error) {
      this.logger.warn(`Cache read failed for ${cacheKey}: ${error}`);
    }

    // Fallback to DB
    try {
      const data = await dbFn();

      // Store in cache for future reads
      if (data && (options.cacheTTL ?? 3600) > 0) {
        try {
          await this.cache.set(cacheKey, data, options.cacheTTL ?? 3600);
        } catch (error) {
          this.logger.warn(`Cache write failed for ${cacheKey}: ${error}`);
        }
      }

      return data;
    } catch (error) {
      this.logger.error(`DB read failed for ${cacheKey}: ${error}`);
      throw error;
    }
  }

  /**
   * Write with cache invalidation
   */
  async writeConsistent<T>(
    dbFn: () => Promise<T>,
    invalidateKeys: string[],
    options: ConsistencyOptions = {}
  ): Promise<T> {
    // Execute DB write first (source of truth)
    const result = await dbFn();

    // Invalidate cache
    for (const key of invalidateKeys) {
      try {
        await this.cache.delete(key);
      } catch (error) {
        this.logger.warn(`Cache invalidation failed for ${key}: ${error}`);
      }
    }

    // Invalidate related cache entries
    if (options.invalidateRelated) {
      for (const pattern of options.invalidateRelated) {
        try {
          await this.cache.deleteByPattern(pattern);
        } catch (error) {
          this.logger.warn(`Pattern invalidation failed for ${pattern}: ${error}`);
        }
      }
    }

    return result;
  }

  /**
   * Invalidate cache entry (used by event handlers)
   */
  async invalidate(cacheKey: string): Promise<void> {
    try {
      await this.cache.delete(cacheKey);
    } catch (error) {
      this.logger.error(`Cache invalidation failed: ${error}`);
      throw error;
    }
  }

  /**
   * Invalidate by pattern (e.g., "user:123:*")
   */
  async invalidateByPattern(pattern: string): Promise<void> {
    try {
      await this.cache.deleteByPattern(pattern);
    } catch (error) {
      this.logger.error(`Pattern invalidation failed: ${error}`);
      throw error;
    }
  }

  /**
   * Event-driven invalidation (called from Kafka handlers)
   */
  async handleCacheInvalidationEvent(event: {
    eventType: string;
    entityId: number;
    entityType: string;
    changes?: Record<string, any>;
  }): Promise<void> {
    const patterns = this.getInvalidationPatterns(
      event.eventType,
      event.entityType,
      event.entityId
    );

    for (const pattern of patterns) {
      try {
        await this.cache.deleteByPattern(pattern);
        this.logger.debug(`Invalidated cache: ${pattern}`);
      } catch (error) {
        this.logger.warn(`Failed to invalidate pattern ${pattern}: ${error}`);
      }
    }
  }

  /**
   * Determine which cache keys to invalidate based on event
   */
  private getInvalidationPatterns(
    eventType: string,
    entityType: string,
    entityId: number
  ): string[] {
    const patterns: string[] = [];

    if (eventType === 'created' || eventType === 'updated') {
      switch (entityType) {
        case 'product':
          patterns.push(`product:${entityId}:*`);
          patterns.push('search:*');
          patterns.push(`category:*:products`);
          break;

        case 'order':
          patterns.push(`order:${entityId}:*`);
          patterns.push(`user:*:orders`);
          patterns.push(`user:*:order_history`);
          break;

        case 'wallet':
          patterns.push(`wallet:${entityId}:*`);
          patterns.push(`user:${entityId}:balance`);
          break;

        case 'seller':
          patterns.push(`seller:${entityId}:*`);
          patterns.push(`seller:${entityId}:products:*`);
          patterns.push('search:*');
          patterns.push('ranking:*');
          break;

        case 'user':
          patterns.push(`user:${entityId}:*`);
          patterns.push(`user:${entityId}:preferences`);
          break;
      }
    } else if (eventType === 'deleted') {
      switch (entityType) {
        case 'product':
          patterns.push(`product:${entityId}:*`);
          patterns.push('search:*');
          patterns.push('ranking:*');
          break;

        case 'seller':
          patterns.push(`seller:${entityId}:*`);
          patterns.push('search:*');
          break;
      }
    }

    return patterns;
  }

  /**
   * Verify consistency (for debugging/monitoring)
   */
  async verifyConsistency(cacheKey: string, dbValue: any): Promise<boolean> {
    try {
      const cachedValue = await this.cache.get(cacheKey);
      if (!cachedValue) {
        this.logger.warn(`Cache miss for ${cacheKey}`);
        return false;
      }

      const match = JSON.stringify(cachedValue) === JSON.stringify(dbValue);
      if (!match) {
        this.logger.warn(`Cache mismatch for ${cacheKey}`);
      }

      return match;
    } catch (error) {
      this.logger.error(`Consistency check failed: ${error}`);
      return false;
    }
  }

  /**
   * Force refresh (clear cache and re-fetch from DB)
   */
  async forceRefresh(cacheKey: string, dbFn: () => Promise<any>): Promise<any> {
    await this.cache.delete(cacheKey);
    const data = await dbFn();
    await this.cache.set(cacheKey, data, 3600);
    return data;
  }
}
