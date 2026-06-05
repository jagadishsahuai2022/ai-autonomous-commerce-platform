import { Injectable } from '@nestjs/common';
import { RedisService } from '../../services/redis.service';

/**
 * PRODUCTION-GRADE CACHING LAYER
 * Multi-level caching with intelligent invalidation
 */

export interface CacheConfig {
  key: string;
  ttlSeconds: number;
  tags?: string[]; // For group invalidation
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  evictions: number;
}

@Injectable()
export class CacheService {
  private stats = new Map<string, CacheStats>();

  constructor(private redisService: RedisService) {}

  /**
   * Get from cache or execute function and cache result
   * (Cache-aside pattern)
   */
  async getOrSet<T>(
    key: string,
    fn: () => Promise<T>,
    ttlSeconds: number = 3600,
    tags?: string[]
  ): Promise<T> {
    try {
      // Try to get from cache
      const cached = await this.redisService.get<string>(key);
      if (cached) {
        this.recordHit(key);
        return JSON.parse(cached);
      }
    } catch (error) {
      console.warn(`Cache get failed for ${key}:`, error);
    }

    this.recordMiss(key);

    // Execute function
    const result = await fn();

    // Store in cache
    try {
      const ttlSec = Math.ceil(ttlSeconds);
      await this.redisService.setex(key, ttlSec, JSON.stringify(result));

      // Store tags for later invalidation
      if (tags && tags.length > 0) {
        for (const tag of tags) {
          const tagKey = `cache:tag:${tag}`;
          await this.redisService.sadd(tagKey, key);
          await this.redisService.expire(tagKey, ttlSec + 3600); // Extend tag TTL
        }
      }
    } catch (error) {
      console.warn(`Cache set failed for ${key}:`, error);
    }

    return result;
  }

  /**
   * Write-through cache:
   * Update cache immediately after write operation
   */
  async set<T>(key: string, value: T, ttlSeconds: number = 3600, tags?: string[]): Promise<void> {
    try {
      await this.redisService.setex(key, ttlSeconds, JSON.stringify(value));

      if (tags && tags.length > 0) {
        for (const tag of tags) {
          const tagKey = `cache:tag:${tag}`;
          await this.redisService.sadd(tagKey, key);
          await this.redisService.expire(tagKey, ttlSeconds + 3600);
        }
      }
    } catch (error) {
      console.error(`Failed to set cache for ${key}:`, error);
    }
  }

  /**
   * Get from cache only
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await this.redisService.get<string>(key);
      if (cached) {
        this.recordHit(key);
        return JSON.parse(cached);
      }
      this.recordMiss(key);
      return null;
    } catch (error) {
      console.warn(`Cache get failed for ${key}:`, error);
      return null;
    }
  }

  /**
   * Invalidate single key
   */
  async invalidate(key: string): Promise<void> {
    try {
      await this.redisService.del(key);
    } catch (error) {
      console.warn(`Failed to invalidate cache for ${key}:`, error);
    }
  }

  /**
   * Invalidate by tag (group invalidation)
   * Useful for invalidating all related caches
   */
  async invalidateByTag(tag: string): Promise<void> {
    try {
      const tagKey = `cache:tag:${tag}`;
      const keys = await this.redisService.smembers(tagKey);

      if (keys && keys.length > 0) {
        await Promise.all(keys.map((key) => this.redisService.del(key)));
      }

      await this.redisService.del(tagKey);
    } catch (error) {
      console.warn(`Failed to invalidate by tag ${tag}:`, error);
    }
  }

  /**
   * Pattern-based invalidation
   * Invalidate all keys matching pattern
   */
  async invalidateByPattern(pattern: string): Promise<void> {
    try {
      const keys = await this.redisService.keys(pattern);
      if (keys && keys.length > 0) {
        await Promise.all(keys.map((key) => this.redisService.del(key)));
      }
    } catch (error) {
      console.warn(`Failed to invalidate pattern ${pattern}:`, error);
    }
  }

  /**
   * Cache list results with pagination handling
   */
  async getCachedList<T>(
    key: string,
    page: number,
    pageSize: number,
    fn: () => Promise<T[]>,
    ttlSeconds: number = 1800
  ): Promise<T[]> {
    const cacheKey = `${key}:page:${page}:size:${pageSize}`;
    return this.getOrSet(cacheKey, fn, ttlSeconds, [key, `page_${page}`]);
  }

  /**
   * Batch cache gets
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    try {
      const values = await this.redisService.mget(keys);
      return values.map((v) => {
        if (v) {
          this.recordHit('batch');
          return JSON.parse(v);
        }
        this.recordMiss('batch');
        return null;
      });
    } catch (error) {
      console.warn('Batch cache get failed:', error);
      return keys.map(() => null);
    }
  }

  /**
   * Batch cache sets
   */
  async mset<T>(items: [string, T, number?][]): Promise<void> {
    try {
      const pipe = this.redisService.pipeline();
      for (const [key, value, ttl] of items) {
        const ttlSec = ttl || 3600;
        if (ttlSec > 0) {
          pipe.setex(key, ttlSec, JSON.stringify(value));
        }
      }
      await pipe.exec();
    } catch (error) {
      console.warn('Batch cache set failed:', error);
    }
  }

  /**
   * Cache counter/counter operations
   */
  async increment(key: string, ttlSeconds?: number): Promise<number> {
    try {
      const result = await this.redisService.increment(key);
      if (ttlSeconds) {
        await this.redisService.expire(key, ttlSeconds);
      }
      return result;
    } catch (error) {
      console.warn(`Failed to increment counter ${key}:`, error);
      return 0;
    }
  }

  /**
   * Get stats for monitoring
   */
  getStats(key?: string): Record<string, CacheStats> | CacheStats | null {
    if (key) {
      return this.stats.get(key) || null;
    }
    const result: Record<string, CacheStats> = {};
    for (const [k, v] of this.stats) {
      result[k] = v;
    }
    return result;
  }

  /**
   * Cache strategies
   */

  // Cache products with 30-minute TTL
  async cacheProduct<T>(productId: number, fn: () => Promise<T>): Promise<T> {
    return this.getOrSet(`product:${productId}`, fn, 1800, ['products', `product:${productId}`]);
  }

  // Cache search results with 5-minute TTL
  async cacheSearch<T>(query: string, filters: any, fn: () => Promise<T>): Promise<T> {
    const filterStr = JSON.stringify(filters);
    const key = `search:${query}:${Buffer.from(filterStr).toString('base64')}`;
    return this.getOrSet(key, fn, 300, ['search', `query:${query}`]);
  }

  // Cache rankings with 10-minute TTL
  async cacheRanking<T>(requestId: string, fn: () => Promise<T>): Promise<T> {
    return this.getOrSet(`ranking:${requestId}`, fn, 600, ['rankings']);
  }

  // Cache user preferences with 24-hour TTL
  async cacheUserPreferences<T>(userId: number, fn: () => Promise<T>): Promise<T> {
    return this.getOrSet(`user:${userId}:preferences`, fn, 86400, [`user:${userId}`]);
  }

  // ========== Private Methods ==========

  private recordHit(key: string) {
    const stats = this.stats.get(key) || { hits: 0, misses: 0, hitRate: 0, evictions: 0 };
    stats.hits++;
    stats.hitRate = stats.hits / (stats.hits + stats.misses);
    this.stats.set(key, stats);
  }

  private recordMiss(key: string) {
    const stats = this.stats.get(key) || { hits: 0, misses: 0, hitRate: 0, evictions: 0 };
    stats.misses++;
    stats.hitRate = stats.hits / (stats.hits + stats.misses);
    this.stats.set(key, stats);
  }

  /** Delete a single cache key */
  async delete(key: string): Promise<void> {
    await this.redisService.del(key);
  }

  /** Delete all keys matching a glob pattern */
  async deleteByPattern(pattern: string): Promise<void> {
    const keys = await this.redisService.keys(pattern);
    if (keys.length > 0) {
      await Promise.all(keys.map((k) => this.redisService.del(k)));
    }
  }
}
