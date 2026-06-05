import { Injectable } from '@nestjs/common';

/**
 * PRODUCTION-GRADE RETRY UTILITY
 * Exponential backoff with jitter
 * Prevents thundering herd problem during service recovery
 */

export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterPercentage: number; // 0-100, percentage of delay to randomize
  retryableErrors?: string[]; // Error types to retry
  onRetry?: (attempt: number, error: Error, nextDelayMs: number) => void;
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attempts: number;
  totalTimeMs: number;
}

@Injectable()
export class RetryService {
  /**
   * Retry with exponential backoff and jitter
   */
  async executeWithRetry<T>(
    fn: () => Promise<T>,
    config: Partial<RetryConfig> = {}
  ): Promise<RetryResult<T>> {
    const defaults: RetryConfig = {
      maxAttempts: 3,
      baseDelayMs: 100,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
      jitterPercentage: 25,
      retryableErrors: ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EHOSTUNREACH'],
    };

    const finalConfig = { ...defaults, ...config };
    const startTime = Date.now();
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
      try {
        const result = await fn();
        return {
          success: true,
          result,
          attempts: attempt,
          totalTimeMs: Date.now() - startTime,
        };
      } catch (error) {
        lastError = error;

        // Check if error is retryable
        if (!this.isRetryable(error, finalConfig.retryableErrors)) {
          break;
        }

        // Don't delay on last attempt
        if (attempt < finalConfig.maxAttempts) {
          const delayMs = this.calculateBackoffDelay(
            attempt - 1,
            finalConfig.baseDelayMs,
            finalConfig.maxDelayMs,
            finalConfig.backoffMultiplier,
            finalConfig.jitterPercentage
          );

          if (finalConfig.onRetry) {
            finalConfig.onRetry(attempt, error, delayMs);
          }

          await this.delay(delayMs);
        }
      }
    }

    return {
      success: false,
      error: lastError || new Error('Max retries exceeded'),
      attempts: finalConfig.maxAttempts,
      totalTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Calculate backoff delay with exponential backoff and jitter
   * Formula: delay = min(base * (multiplier ^ attempt) + random(0, jitter_amount), max)
   */
  private calculateBackoffDelay(
    attempt: number,
    baseDelayMs: number,
    maxDelayMs: number,
    backoffMultiplier: number,
    jitterPercentage: number
  ): number {
    // Exponential backoff
    const exponentialDelay = baseDelayMs * Math.pow(backoffMultiplier, attempt);

    // Cap at max
    const cappedDelay = Math.min(exponentialDelay, maxDelayMs);

    // Add jitter
    const jitterAmount = (cappedDelay * jitterPercentage) / 100;
    const randomJitter = Math.random() * jitterAmount;

    return Math.floor(cappedDelay + randomJitter);
  }

  /**
   * Check if error is retryable
   */
  private isRetryable(error: any, retryableErrors?: string[]): boolean {
    if (!retryableErrors || retryableErrors.length === 0) {
      return true;
    }

    const errorCode = error.code || error.message || '';
    return retryableErrors.some((code) => errorCode.includes(code));
  }

  /**
   * Simple delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Retry specific HTTP methods
   */
  async retryHttpCall<T>(
    fn: () => Promise<T>,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    config?: Partial<RetryConfig>
  ): Promise<RetryResult<T>> {
    // POST/PUT/DELETE should only retry on idempotent operations
    const retryableOnNonIdempotent =
      method === 'GET'
        ? ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EHOSTUNREACH', '503', '429', '500']
        : ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EHOSTUNREACH', '503', '429'];

    return this.executeWithRetry(fn, {
      maxAttempts: method === 'GET' ? 3 : 2,
      baseDelayMs: 100,
      maxDelayMs: 10000,
      backoffMultiplier: 2,
      jitterPercentage: 20,
      retryableErrors: retryableOnNonIdempotent,
      ...config,
    });
  }

  /**
   * Retry with linear backoff (simpler, for less critical operations)
   */
  async executeWithLinearRetry<T>(
    fn: () => Promise<T>,
    maxAttempts: number = 3,
    delayMs: number = 500
  ): Promise<RetryResult<T>> {
    const startTime = Date.now();

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await fn();
        return {
          success: true,
          result,
          attempts: attempt,
          totalTimeMs: Date.now() - startTime,
        };
      } catch (error) {
        if (attempt === maxAttempts) {
          return {
            success: false,
            error,
            attempts: maxAttempts,
            totalTimeMs: Date.now() - startTime,
          };
        }
        await this.delay(delayMs);
      }
    }

    throw new Error('Retry exhausted');
  }

  /**
   * Timeout wrapper with retry
   */
  async executeWithTimeoutAndRetry<T>(
    fn: () => Promise<T>,
    timeoutMs: number = 5000,
    retryConfig?: Partial<RetryConfig>
  ): Promise<RetryResult<T>> {
    return this.executeWithRetry(
      async () => {
        return new Promise<T>((resolve, reject) => {
          let timeoutId: NodeJS.Timeout;

          const timeoutPromise = new Promise<never>(
            (_, reject) =>
              (timeoutId = setTimeout(() => reject(new Error('Operation timeout')), timeoutMs))
          );

          Promise.race([fn(), timeoutPromise])
            .then((result) => {
              clearTimeout(timeoutId);
              resolve(result);
            })
            .catch((error) => {
              clearTimeout(timeoutId);
              reject(error);
            });
        });
      },
      {
        maxAttempts: 3,
        baseDelayMs: 200,
        retryableErrors: ['Operation timeout', 'ETIMEDOUT'],
        ...retryConfig,
      }
    );
  }
}
