/**
 * Production-Grade Rate Limiting Middleware
 * Implements per-user and per-IP rate limiting with Redis-backed token bucket
 */

import { Injectable, NestMiddleware, HttpException, HttpStatus } from '@nestjs/common';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { CacheService } from '../services/cache.service';
import { MetricsService } from '../services/metrics.service';
import { Logger } from '@nestjs/common';

export interface RateLimitConfig {
  windowSizeSeconds: number;
  maxRequests: number;
  keyPrefix?: string;
}

@Injectable()
export class RateLimitingMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RateLimitingMiddleware.name);

  // Rate limit presets
  static readonly PRESETS = {
    STRICT: { windowSizeSeconds: 60, maxRequests: 10 }, // 10 req/min
    AUTH: { windowSizeSeconds: 60, maxRequests: 30 }, // 30 req/min
    MODERATE: { windowSizeSeconds: 60, maxRequests: 100 }, // 100 req/min
    RELAXED: { windowSizeSeconds: 60, maxRequests: 500 }, // 500 req/min
  };

  private readonly limits = new Map<string, RateLimitConfig>([
    ['login', RateLimitingMiddleware.PRESETS.STRICT],
    ['register', RateLimitingMiddleware.PRESETS.STRICT],
    ['auth', RateLimitingMiddleware.PRESETS.AUTH],
    ['search', RateLimitingMiddleware.PRESETS.MODERATE],
    ['default', RateLimitingMiddleware.PRESETS.RELAXED],
  ]);

  constructor(
    private cache: CacheService,
    private metrics: MetricsService
  ) {}

  async use(req: FastifyRequest, res: FastifyReply, next: () => void) {
    try {
      const rateLimit = this.getLimit(req);
      const clientId = this.getClientId(req);
      const allowed = await this.checkRateLimit(clientId, rateLimit);

      res.header('X-RateLimit-Limit', String(rateLimit.maxRequests));
      res.header('X-RateLimit-Remaining', String(Math.max(0, allowed.remaining)));
      res.header('X-RateLimit-Reset', String(allowed.resetTime));

      if (!allowed.allowed) {
        this.metrics.increment('rate_limit_exceeded');
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: 'Too many requests',
            retryAfter: allowed.resetTime,
          },
          HttpStatus.TOO_MANY_REQUESTS
        );
      }

      next();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Rate limit check failed: ${error}`);
      next();
    }
  }

  private getLimit(req: FastifyRequest): RateLimitConfig {
    const path = req.url.toLowerCase();
    for (const [key, limit] of this.limits.entries()) {
      if (path.includes(key)) {
        return limit;
      }
    }
    return this.limits.get('default')!;
  }

  private getClientId(req: FastifyRequest): string {
    const user = (req as any).user;
    if (user?.id) {
      return `user:${user.id}`;
    }
    return `ip:${req.ip}`;
  }

  private async checkRateLimit(
    clientId: string,
    config: RateLimitConfig
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const key = `ratelimit:${clientId}`;
    const now = Date.now();
    const windowStart = Math.floor(now / 1000) * 1000;

    try {
      const data = await this.cache.get<{ count: number; window: number }>(key);
      const { count = 0, window = windowStart } = data || {};

      if (window !== windowStart) {
        // New window
        await this.cache.set(key, { count: 1, window: windowStart }, config.windowSizeSeconds);
        return {
          allowed: true,
          remaining: config.maxRequests - 1,
          resetTime: windowStart + config.windowSizeSeconds * 1000,
        };
      }

      const allowed = count < config.maxRequests;
      if (allowed) {
        await this.cache.increment(key);
      }

      return {
        allowed,
        remaining: Math.max(0, config.maxRequests - count - 1),
        resetTime: windowStart + config.windowSizeSeconds * 1000,
      };
    } catch (error) {
      this.logger.warn(`Rate limit cache error: ${error}`);
      // Fail open on cache issues
      return { allowed: true, remaining: config.maxRequests, resetTime: 0 };
    }
  }
}

@Injectable()
export class RateLimitService {
  constructor(private cache: CacheService) {}

  async checkLimit(clientId: string, limit: RateLimitConfig): Promise<boolean> {
    const key = `ratelimit:${clientId}`;
    const current = await this.cache.get<{ count: number }>(key);
    return !current || current.count < limit.maxRequests;
  }

  async resetLimit(clientId: string): Promise<void> {
    const key = `ratelimit:${clientId}`;
    await this.cache.delete(key);
  }
}
