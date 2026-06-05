import { Injectable, BadRequestException } from '@nestjs/common';
import { RedisService } from '../../services/redis.service';

/**
 * PRODUCTION-GRADE RATE LIMITING
 * Token bucket algorithm with Redis
 * Supports per-user, per-API, and global limits
 */

export interface RateLimitConfig {
  key: string; // Unique identifier (user_id, api_key, etc)
  tokensPerWindow: number; // Max requests per window
  windowSizeMs: number; // Window duration in milliseconds
  labels?: string[]; // For metric tagging
}

export interface RateLimitResult {
  allowed: boolean;
  tokensRemaining: number;
  resetAt: number;
  retryAfter?: number;
}

@Injectable()
export class RateLimitService {
  constructor(private redisService: RedisService) {}

  /**
   * Token bucket rate limiter
   * More fair than sliding window for burst traffic
   */
  async checkLimit(config: RateLimitConfig): Promise<RateLimitResult> {
    const { key, tokensPerWindow, windowSizeMs, labels } = config;
    const redisKey = `rate_limit:${key}`;
    const now = Date.now();

    try {
      // Lua script for atomic operation
      const script = `
        local key = KEYS[1]
        local now = tonumber(ARGV[1])
        local tokensPerWindow = tonumber(ARGV[2])
        local windowSizeMs = tonumber(ARGV[3])
        
        local current = redis.call('HGETALL', key)
        local lastResetTime = tonumber(current[2]) or now
        local tokens = tonumber(current[4]) or tokensPerWindow
        
        -- Reset tokens if window has passed
        if now - lastResetTime >= windowSizeMs then
          lastResetTime = now
          tokens = tokensPerWindow
        end
        
        local allowed = false
        if tokens > 0 then
          allowed = true
          tokens = tokens - 1
        end
        
        -- Store state
        redis.call('HSET', key, 'last_reset', lastResetTime, 'tokens', tokens)
        redis.call('EXPIRE', key, math.ceil(windowSizeMs / 1000) + 1)
        
        local resetAt = lastResetTime + windowSizeMs
        return {
          allowed and 1 or 0,
          tokens,
          resetAt,
          now
        }
      `;

      const [allowed, tokensRemaining, resetAt, requestTime] = await this.redisService.eval(
        script,
        1,
        redisKey,
        now.toString(),
        tokensPerWindow.toString(),
        windowSizeMs.toString()
      );

      return {
        allowed: allowed === 1,
        tokensRemaining: parseInt(tokensRemaining),
        resetAt: parseInt(resetAt),
        retryAfter: !allowed ? Math.ceil((parseInt(resetAt) - now) / 1000) : undefined,
      };
    } catch (error) {
      // Fail open: allow request if Redis is down
      console.warn(`Rate limit check failed for ${key}:`, error);
      return {
        allowed: true,
        tokensRemaining: tokensPerWindow,
        resetAt: now + windowSizeMs,
      };
    }
  }

  /**
   * Distributed rate limit for multi-instance deployment
   * Uses moving window approach
   */
  async checkSlidingWindowLimit(config: RateLimitConfig): Promise<RateLimitResult> {
    const { key, tokensPerWindow, windowSizeMs } = config;
    const redisKey = `rate_limit_sw:${key}`;
    const now = Date.now();
    const windowStart = now - windowSizeMs;

    try {
      // Remove old entries outside window
      await this.redisService.zremrangebyscore(redisKey, 0, windowStart);

      // Count requests in current window
      const count = await this.redisService.zcard(redisKey);
      const allowed = count < tokensPerWindow;

      if (allowed) {
        // Add current request
        await this.redisService.zadd(redisKey, now, `${now}-${Math.random()}`);
      }

      // Set expiry
      await this.redisService.expire(redisKey, Math.ceil(windowSizeMs / 1000) + 1);

      return {
        allowed,
        tokensRemaining: Math.max(0, tokensPerWindow - count - (allowed ? 1 : 0)),
        resetAt: windowStart + windowSizeMs,
        retryAfter: !allowed ? 1 : undefined,
      };
    } catch (error) {
      console.warn(`Sliding window rate limit failed for ${key}:`, error);
      return {
        allowed: true,
        tokensRemaining: tokensPerWindow,
        resetAt: now + windowSizeMs,
      };
    }
  }

  /**
   * Concurrent connection limiter
   */
  async checkConcurrentLimit(key: string, maxConcurrent: number): Promise<boolean> {
    try {
      const redisKey = `concurrent:${key}`;
      const current = await this.redisService.increment(redisKey);
      await this.redisService.expire(redisKey, 60); // 60s timeout per request

      if (current > maxConcurrent) {
        await this.redisService.decrement(redisKey);
        return false;
      }
      return true;
    } catch (error) {
      console.warn(`Concurrent limit check failed:`, error);
      return true;
    }
  }

  async releaseConcurrent(key: string): Promise<void> {
    try {
      const redisKey = `concurrent:${key}`;
      await this.redisService.decrement(redisKey);
    } catch (error) {
      console.warn(`Failed to release concurrent limit:`, error);
    }
  }

  /**
   * Get rate limit status for dashboard
   */
  async getStatus(key: string): Promise<any> {
    try {
      const data = await this.redisService.hgetall(`rate_limit:${key}`);
      return data || { tokens: 'N/A', lastReset: 'N/A' };
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Reset rate limit (admin only)
   */
  async reset(key: string): Promise<void> {
    try {
      await this.redisService.del(`rate_limit:${key}`);
      await this.redisService.del(`rate_limit_sw:${key}`);
    } catch (error) {
      console.error(`Failed to reset rate limit for ${key}:`, error);
    }
  }
}
