import { Injectable, NestMiddleware, BadRequestException } from '@nestjs/common';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { RateLimitService } from '../services/rate-limit.service';
import { IdempotencyService } from '../services/idempotency.service';

/**
 * Rate limiting middleware
 * Applies per-user and per-API rate limits
 */
@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  constructor(private rateLimitService: RateLimitService) {}

  async use(req: FastifyRequest, res: FastifyReply, next: () => void) {
    const userId = (req as any).user?.id || req.ip;
    const key = `${req.method}:${req.url}:${userId}`;

    // Define rate limits per endpoint
    let tokensPerWindow = 100;
    let windowSizeMs = 60000; // 1 minute default

    // Stricter limits for expensive operations
    if (req.method === 'POST' && req.url.includes('/purchase')) {
      tokensPerWindow = 10;
      windowSizeMs = 60000; // 10 requests/min
    } else if (req.method === 'POST' && req.url.includes('/chat')) {
      tokensPerWindow = 20;
      windowSizeMs = 60000; // 20 requests/min
    }

    const result = await this.rateLimitService.checkLimit({
      key,
      tokensPerWindow,
      windowSizeMs,
      labels: [(req as any).user?.id, req.method, req.url],
    });

    // Add headers
    res.header('X-RateLimit-Limit', tokensPerWindow);
    res.header('X-RateLimit-Remaining', Math.max(0, result.tokensRemaining));
    res.header('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000));

    if (!result.allowed) {
      res.header('Retry-After', result.retryAfter);
      return res.status(429).send({
        statusCode: 429,
        message: 'Too many requests',
        retryAfter: result.retryAfter,
      });
    }

    next();
  }
}

/**
 * Timeout middleware
 * Ensures requests don't hang indefinitely
 */
@Injectable()
export class TimeoutMiddleware implements NestMiddleware {
  private readonly defaultTimeoutMs = 30000; // 30 seconds

  use(req: FastifyRequest, res: FastifyReply, next: () => void) {
    // Define custom timeouts per endpoint
    let timeoutMs = this.defaultTimeoutMs;

    if (req.url.includes('/search')) {
      timeoutMs = 15000; // 15s for search
    } else if (req.url.includes('/ranking')) {
      timeoutMs = 20000; // 20s for ranking
    } else if (req.url.includes('/purchase')) {
      timeoutMs = 45000; // 45s for purchase
    }

    // Set timeout
    const timeoutId = setTimeout(() => {
      if (!res.raw.headersSent) {
        res.status(408).send({
          statusCode: 408,
          message: 'Request timeout',
          path: req.url,
        });
      }
    }, timeoutMs);

    // Clear timeout on response
    res.raw.on('finish', () => clearTimeout(timeoutId));
    res.raw.on('close', () => clearTimeout(timeoutId));

    next();
  }
}

/**
 * Idempotency middleware
 * Ensures POST/PUT/DELETE requests can be safely retried
 */
@Injectable()
export class IdempotencyMiddleware implements NestMiddleware {
  constructor(private idempotencyService: IdempotencyService) {}

  async use(req: FastifyRequest, res: FastifyReply, next: () => void) {
    // Only apply to mutations
    if (!['POST', 'PUT', 'DELETE'].includes(req.method)) {
      return next();
    }

    // Only apply to specific endpoints
    const isApplicable = ['/orders', '/payments', '/purchases', '/transfers'].some((path) =>
      req.url.includes(path)
    );

    if (!isApplicable) {
      return next();
    }

    const idempotencyKey = req.headers['idempotency-key'] as string;
    if (!idempotencyKey) {
      return res.status(400).send({
        statusCode: 400,
        message: 'Idempotency-Key header required for this endpoint',
      });
    }

    const key = `${idempotencyKey}:${(req as any).user?.id || req.ip}`;

    // Check for cached result
    const cached = await this.idempotencyService.checkIdempotency(key);
    if (cached) {
      res.header('X-Idempotent-Replay', 'true');
      return res.status(cached.statusCode || 200).send(cached.result);
    }

    // Check if already processing
    const canProcess = await this.idempotencyService.startProcessing(key);
    if (!canProcess) {
      return res.status(409).send({
        statusCode: 409,
        message: 'Request with same idempotency key is already being processed',
      });
    }

    // Capture service reference for use inside closure
    const idempotencyService = this.idempotencyService;
    // Intercept response
    const originalJson = res.send.bind(res);
    res.send = function (body: any) {
      // Store result async (don't wait)
      if (res.raw.statusCode >= 200 && res.raw.statusCode < 300) {
        idempotencyService.storeResult(key, body, res.raw.statusCode);
      } else if (res.raw.statusCode >= 400) {
        idempotencyService.storeError(
          key,
          new Error(body.message || 'Request failed'),
          res.raw.statusCode
        );
      }
      return originalJson(body);
    };

    next();
  }
}

/**
 * Request ID/correlation ID middleware
 * For distributed tracing
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: FastifyRequest, res: FastifyReply, next: () => void) {
    // Get or generate correlation ID
    let correlationId = req.headers['x-correlation-id'] as string;
    if (!correlationId) {
      correlationId = req.headers['x-request-id'] as string;
    }
    if (!correlationId) {
      correlationId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
    }

    // Attach to request and response
    (req as any).correlationId = correlationId;
    res.header('X-Correlation-ID', correlationId);
    res.header('X-Request-ID', correlationId);

    next();
  }
}
