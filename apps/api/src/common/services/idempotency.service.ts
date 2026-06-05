import { Injectable } from '@nestjs/common';
import { RedisService } from '../../services/redis.service';
import * as crypto from 'crypto';

/**
 * PRODUCTION-GRADE IDEMPOTENCY
 * Ensures requests can be safely retried without duplicate side effects
 * Stores request outcomes keyed by idempotency-key header
 */

export interface IdempotencyKey {
  key: string; // Unique key from header or computed
  userId: number; // User making request
  method: string; // HTTP method
  path: string; // API path
}

export interface IdempotencyResult {
  success: boolean;
  result?: any; // Cached result if duplicate
  statusCode?: number;
  error?: string;
  createdAt?: number;
  expiresAt?: number;
}

@Injectable()
export class IdempotencyService {
  private readonly DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 hours
  private readonly PROCESSING_TIMEOUT = 60 * 1000; // 60 seconds

  constructor(private redisService: RedisService) {}

  /**
   * Generate idempotency key from request parameters
   * Falls back to computing key if not provided
   */
  generateKey(idempotencyKey?: string, userId?: number, method?: string, path?: string): string {
    if (idempotencyKey) {
      return `idempotent:${idempotencyKey}`;
    }

    // Compute from request details
    const baseString = `${userId}:${method}:${path}:${Date.now()}`;
    const hash = crypto.createHash('sha256').update(baseString).digest('hex');
    return `idempotent:computed:${hash}`;
  }

  /**
   * Check if request is duplicate
   * Returns cached result if already processed
   */
  async checkIdempotency(key: string): Promise<IdempotencyResult | null> {
    try {
      const cached = await this.redisService.get<string>(key);
      if (cached) {
        const data = JSON.parse(cached);
        return {
          success: true,
          result: data.result,
          statusCode: data.statusCode,
          createdAt: data.createdAt,
          expiresAt: data.expiresAt,
        };
      }
      return null;
    } catch (error) {
      console.error(`Failed to check idempotency for ${key}:`, error);
      return null;
    }
  }

  /**
   * Mark request as processing
   * Prevents concurrent duplicate execution
   */
  async startProcessing(key: string): Promise<boolean> {
    try {
      const processingKey = `${key}:processing`;
      const lockKey = `${key}:lock`;

      // Try to acquire lock
      const acquired = await this.redisService.setnx(lockKey, 'processing');
      if (!acquired) {
        // Already processing
        await this.redisService.expire(lockKey, Math.ceil(this.PROCESSING_TIMEOUT / 1000));
        return false;
      }

      await this.redisService.setex(
        processingKey,
        Math.ceil(this.PROCESSING_TIMEOUT / 1000),
        'processing'
      );

      return true;
    } catch (error) {
      console.error(`Failed to start processing for ${key}:`, error);
      return true; // Assume success if Redis fails
    }
  }

  /**
   * Store result of idempotent operation
   */
  async storeResult(
    key: string,
    result: any,
    statusCode: number = 200,
    ttlMs = this.DEFAULT_TTL
  ): Promise<void> {
    try {
      const data = {
        result,
        statusCode,
        createdAt: Date.now(),
        expiresAt: Date.now() + ttlMs,
      };

      await this.redisService.setex(key, Math.ceil(ttlMs / 1000), JSON.stringify(data));

      // Remove processing marker
      const processingKey = `${key}:processing`;
      const lockKey = `${key}:lock`;
      await this.redisService.del(processingKey);
      await this.redisService.del(lockKey);
    } catch (error) {
      console.error(`Failed to store idempotent result for ${key}:`, error);
    }
  }

  /**
   * Store error for idempotent operation
   */
  async storeError(
    key: string,
    error: Error,
    statusCode: number = 500,
    ttlMs = this.DEFAULT_TTL
  ): Promise<void> {
    try {
      const data = {
        error: error.message,
        statusCode,
        createdAt: Date.now(),
        expiresAt: Date.now() + ttlMs,
      };

      await this.redisService.setex(key, Math.ceil(ttlMs / 1000), JSON.stringify(data));

      // Remove processing marker
      const processingKey = `${key}:processing`;
      const lockKey = `${key}:lock`;
      await this.redisService.del(processingKey);
      await this.redisService.del(lockKey);
    } catch (error) {
      console.error(`Failed to store idempotent error for ${key}:`, error);
    }
  }

  /**
   * Cleanup idempotency key
   */
  async cleanup(key: string): Promise<void> {
    try {
      await this.redisService.del(key);
      await this.redisService.del(`${key}:processing`);
      await this.redisService.del(`${key}:lock`);
    } catch (error) {
      console.error(`Failed to cleanup idempotency for ${key}:`, error);
    }
  }

  /**
   * Decorator for idempotent operations
   * Usage: @Idempotent() on controller methods
   */
  static async withIdempotency(
    idempotencyService: IdempotencyService,
    key: string,
    operation: () => Promise<any>
  ): Promise<any> {
    // Check if already processed
    const cached = await idempotencyService.checkIdempotency(key);
    if (cached) {
      return cached.result;
    }

    // Check if currently processing
    const canProcess = await idempotencyService.startProcessing(key);
    if (!canProcess) {
      // Wait a bit and try again
      await new Promise((resolve) => setTimeout(resolve, 100));
      const retryResult = await idempotencyService.checkIdempotency(key);
      if (retryResult) {
        return retryResult.result;
      }
      throw new Error('Request processing in progress');
    }

    try {
      const result = await operation();
      await idempotencyService.storeResult(key, result);
      return result;
    } catch (error) {
      await idempotencyService.storeError(key, error);
      throw error;
    }
  }
}
