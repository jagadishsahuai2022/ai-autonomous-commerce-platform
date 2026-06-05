/**
 * Production-Grade Idempotency Key Service
 * Ensures safe retries for POST/PATCH/DELETE requests
 * Stores request fingerprint and response for replay
 */

import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from './cache.service';
import { MetricsService } from './metrics.service';
import crypto from 'crypto';

export interface IdempotencyRequest {
  key: string; // Client-provided idempotency key
  method: string;
  path: string;
  body?: any;
  userId: number;
  ipAddress: string;
}

export interface IdempotencyResponse {
  idempotencyKey: string;
  requestFingerprint: string;
  statusCode: number;
  response: any;
  timestamp: Date;
  cached: boolean;
}

@Injectable()
export class IdempotencyKeyService {
  private readonly logger = new Logger(IdempotencyKeyService.name);
  private readonly TTL_SECONDS = 86400; // 24 hours

  constructor(
    private cache: CacheService,
    private metrics: MetricsService
  ) {}

  /**
   * Generate fingerprint for request deduplication
   */
  generateFingerprint(req: IdempotencyRequest): string {
    const data = JSON.stringify({
      method: req.method,
      path: req.path,
      body: req.body,
      userId: req.userId,
    });

    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Check if request is idempotent duplicate
   */
  async checkIdempotency(
    req: IdempotencyRequest
  ): Promise<{ isDuplicate: boolean; cachedResponse?: any }> {
    if (!req.key) {
      return { isDuplicate: false };
    }

    const cacheKey = `idempotency:${req.userId}:${req.key}`;
    const fingerprint = this.generateFingerprint(req);

    try {
      const cached = await this.cache.get<{ fingerprint: string; response: any }>(cacheKey);

      if (cached) {
        if (cached.fingerprint === fingerprint) {
          // Exact duplicate - return cached
          this.metrics.increment('idempotency_cache_hit');
          return {
            isDuplicate: true,
            cachedResponse: cached.response,
          };
        } else {
          // Different request with same key - potential issue
          this.logger.warn(`Idempotency key reused with different request: ${req.key}`);
          this.metrics.increment('idempotency_key_collision');
        }
      }

      return { isDuplicate: false };
    } catch (error) {
      this.logger.error(`Idempotency check failed: ${error}`);
      // Fail open - allow request to proceed
      return { isDuplicate: false };
    }
  }

  /**
   * Store idempotent response for future replays
   */
  async storeResponse(req: IdempotencyRequest, statusCode: number, response: any): Promise<void> {
    if (!req.key) {
      return;
    }

    const cacheKey = `idempotency:${req.userId}:${req.key}`;
    const fingerprint = this.generateFingerprint(req);

    try {
      const data = {
        fingerprint,
        statusCode,
        response,
        timestamp: new Date(),
      };

      await this.cache.set(cacheKey, data, this.TTL_SECONDS);
      this.metrics.increment('idempotency_response_stored');
    } catch (error) {
      this.logger.error(`Failed to store idempotent response: ${error}`);
      // Don't fail the request if caching fails
    }
  }

  /**
   * Use in middleware to wrap request-response
   */
  async wrapRequestResponse(
    req: IdempotencyRequest,
    handler: () => Promise<{ statusCode: number; data: any }>
  ): Promise<{ statusCode: number; data: any; fromCache: boolean }> {
    const { isDuplicate, cachedResponse } = await this.checkIdempotency(req);

    if (isDuplicate) {
      return {
        statusCode: cachedResponse.statusCode,
        data: cachedResponse.response,
        fromCache: true,
      };
    }

    const result = await handler();
    await this.storeResponse(req, result.statusCode, result.data);

    return {
      statusCode: result.statusCode,
      data: result.data,
      fromCache: false,
    };
  }

  /**
   * Clear idempotency key
   */
  async clearKey(userId: number, key: string): Promise<void> {
    const cacheKey = `idempotency:${userId}:${key}`;
    await this.cache.delete(cacheKey);
  }

  /**
   * Validate idempotency key format
   */
  static validateKey(key: string): boolean {
    // Key should be UUID or similar format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return key.length > 0 && key.length <= 256 && uuidRegex.test(key);
  }
}
