/**
 * Production-Grade Retry Utility Service
 * Implements exponential backoff with jitter, max retries, and timeout
 */

import { Injectable, Logger } from '@nestjs/common';

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  jitterFactor?: number;
  timeoutMs?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
  totalTimeMs: number;
}

@Injectable()
export class RetryUtilityService {
  private readonly logger = new Logger(RetryUtilityService.name);

  private readonly defaultOptions: RetryOptions = {
    maxRetries: 3,
    initialDelayMs: 100,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    jitterFactor: 0.1,
    timeoutMs: 30000,
  };

  /**
   * Execute async function with retry logic
   */
  async executeWithRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {},
    operationName: string = 'Operation'
  ): Promise<RetryResult<T>> {
    const opts = { ...this.defaultOptions, ...options };
    const startTime = Date.now();
    let lastError: Error | null = null;
    let attempt = 0;

    while (attempt < (opts.maxRetries || 0) + 1) {
      attempt++;
      try {
        this.logger.debug(`[${operationName}] Attempt ${attempt}/${(opts.maxRetries || 0) + 1}`);

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout after ${opts.timeoutMs}ms`)), opts.timeoutMs)
        );

        const result = await Promise.race([fn(), timeoutPromise]);

        const totalTimeMs = Date.now() - startTime;
        this.logger.debug(
          `[${operationName}] Success in ${totalTimeMs}ms after ${attempt} attempt(s)`
        );

        return {
          success: true,
          data: result,
          attempts: attempt,
          totalTimeMs,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.logger.warn(`[${operationName}] Attempt ${attempt} failed: ${lastError.message}`);

        if (opts.onRetry) {
          opts.onRetry(attempt, lastError);
        }

        // Don't retry on last attempt
        if (attempt >= (opts.maxRetries || 0) + 1) {
          break;
        }

        // Calculate delay with exponential backoff and jitter
        const delay = this.calculateBackoffDelay(
          attempt,
          opts.initialDelayMs || 100,
          opts.maxDelayMs || 30000,
          opts.backoffMultiplier || 2,
          opts.jitterFactor || 0.1
        );

        this.logger.debug(`[${operationName}] Waiting ${delay}ms before retry`);
        await this.sleep(delay);
      }
    }

    const totalTimeMs = Date.now() - startTime;
    this.logger.error(
      `[${operationName}] Failed after ${attempt} attempts in ${totalTimeMs}ms: ${lastError?.message}`
    );

    return {
      success: false,
      error: lastError || new Error('Unknown error'),
      attempts: attempt,
      totalTimeMs,
    };
  }

  /**
   * Synchronous retry wrapper
   */
  async executeWithRetrySync<T>(
    fn: () => T,
    options: RetryOptions = {},
    operationName: string = 'Operation'
  ): Promise<RetryResult<T>> {
    return this.executeWithRetry(async () => fn(), options, operationName);
  }

  /**
   * Race multiple promises with retry
   */
  async raceWithRetry<T>(
    promises: Promise<T>[],
    options: RetryOptions = {},
    operationName: string = 'RaceOperation'
  ): Promise<RetryResult<T>> {
    return this.executeWithRetry(() => Promise.race(promises), options, operationName);
  }

  /**
   * All promises with retry
   */
  async allWithRetry<T>(
    promises: Promise<T>[],
    options: RetryOptions = {},
    operationName: string = 'AllOperation'
  ): Promise<RetryResult<T[]>> {
    return this.executeWithRetry(() => Promise.all(promises), options, operationName);
  }

  /**
   * Calculate exponential backoff delay with jitter
   */
  private calculateBackoffDelay(
    attempt: number,
    initialDelayMs: number,
    maxDelayMs: number,
    multiplier: number,
    jitterFactor: number
  ): number {
    // Exponential: initialDelay * multiplier^(attempt-1)
    let delay = initialDelayMs * Math.pow(multiplier, attempt - 1);

    // Cap at max
    delay = Math.min(delay, maxDelayMs);

    // Add jitter: ±(jitterFactor * delay)
    const jitter = delay * jitterFactor * (Math.random() * 2 - 1);
    delay = Math.max(1, delay + jitter);

    return Math.round(delay);
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get default options
   */
  getDefaultOptions(): RetryOptions {
    return { ...this.defaultOptions };
  }

  /**
   * Create presets for common scenarios
   */
  static readonly PRESETS = {
    AGGRESSIVE: {
      maxRetries: 5,
      initialDelayMs: 50,
      maxDelayMs: 10000,
      backoffMultiplier: 1.5,
      jitterFactor: 0.1,
      timeoutMs: 10000,
    },
    MODERATE: {
      maxRetries: 3,
      initialDelayMs: 100,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
      jitterFactor: 0.1,
      timeoutMs: 30000,
    },
    CONSERVATIVE: {
      maxRetries: 2,
      initialDelayMs: 500,
      maxDelayMs: 60000,
      backoffMultiplier: 3,
      jitterFactor: 0.2,
      timeoutMs: 60000,
    },
    QUICK: {
      maxRetries: 1,
      initialDelayMs: 50,
      maxDelayMs: 5000,
      backoffMultiplier: 2,
      jitterFactor: 0.1,
      timeoutMs: 5000,
    },
  };
}
