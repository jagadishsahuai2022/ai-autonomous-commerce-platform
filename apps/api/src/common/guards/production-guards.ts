/**
 * Production Guards & Interceptors
 * Automatic application of security, reliability, and observability patterns
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  NestInterceptor,
  BadRequestException,
  ForbiddenException,
  UseInterceptors,
} from '@nestjs/common';
import { Observable, of, from } from 'rxjs';
import { tap, catchError, switchMap } from 'rxjs/operators';
import type { FastifyRequest, FastifyReply } from 'fastify';

import { SecurityService } from '../services/security.service';
import { CSRFProtectionService } from '../services/csrf-protection.service';
import { ObservabilityService } from '../services/observability.service';
import { IdempotencyKeyService, IdempotencyRequest } from '../services/idempotency-key.service';
import { RateLimitService } from '../middleware/rate-limiting.middleware';

/**
 * Guard: Verify JWT and set security context
 */
@Injectable()
export class JWTAuthGuard implements CanActivate {
  constructor(private security: SecurityService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new ForbiddenException('Missing authorization header');
    }

    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw new ForbiddenException('Invalid authorization header format');
    }

    const validation = this.security.validateJWT(token);

    if (!validation.valid) {
      throw new ForbiddenException(`JWT validation failed: ${validation.error}`);
    }

    request.user = validation.payload;
    return true;
  }
}

/**
 * Guard: CSRF token validation
 */
@Injectable()
export class CSRFGuard implements CanActivate {
  constructor(private csrf: CSRFProtectionService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    // Skip CSRF check for safe methods
    if (!this.csrf.requiresCSRFProtection(request.method)) {
      return true;
    }

    const token = this.csrf.extractCSRFToken(request);
    const origin = request.headers.origin || request.headers.referer;

    if (!token) {
      throw new BadRequestException('CSRF token missing');
    }

    if (!origin) {
      throw new BadRequestException('Origin header missing');
    }

    const validation = this.csrf.validateCSRFToken(token, request.sessionID, origin);

    if (!validation.valid) {
      throw new ForbiddenException(`CSRF validation failed: ${validation.reason}`);
    }

    return true;
  }
}

/**
 * Interceptor: Add observability (correlation IDs, tracing)
 */
@Injectable()
export class ObservabilityInterceptor implements NestInterceptor {
  constructor(private observability: ObservabilityService) {}

  intercept(context: ExecutionContext, next: any): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    const traceContext = this.observability.generateTraceContext();

    // Inject correlation ID
    response.header('X-Correlation-ID', traceContext.correlationId);
    response.header('X-Trace-ID', traceContext.traceId);
    response.header('X-Span-ID', traceContext.spanId);

    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        const latency = Date.now() - startTime;
        this.observability.recordRequestMetrics(
          traceContext.correlationId,
          response.statusCode,
          latency,
          request.method,
          request.url
        );
      }),
      catchError((error) => {
        this.observability.recordRequestMetrics(
          traceContext.correlationId,
          error.status || 500,
          Date.now() - startTime,
          request.method,
          request.url
        );
        throw error;
      })
    );
  }
}

/**
 * Interceptor: Automatic idempotency handling
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private idempotency: IdempotencyKeyService) {}

  intercept(context: ExecutionContext, next: any): Observable<any> {
    const request = context.switchToHttp().getRequest();

    // Only for POST, PATCH, DELETE
    if (!['POST', 'PATCH', 'DELETE'].includes(request.method)) {
      return next.handle();
    }

    const idempotencyKeyHeader = request.headers['idempotency-key'];

    if (!idempotencyKeyHeader) {
      return next.handle();
    }

    const req: IdempotencyRequest = {
      key: idempotencyKeyHeader as string,
      method: request.method,
      path: request.url,
      body: request.body,
      userId: (request as any).user?.id || 0,
      ipAddress: request.ip || '',
    };

    return from(this.idempotency.checkIdempotency(req)).pipe(
      switchMap((result) => {
        if (result.isDuplicate) {
          return of(result.cachedResponse);
        }
        return next.handle().pipe(
          tap((response: any) => {
            this.idempotency.storeResponse(req, 200, response);
          })
        );
      })
    );
  }
}

/**
 * Interceptor: Automatic response sanitization
 */
@Injectable()
export class SanitizationInterceptor implements NestInterceptor {
  constructor(private security: SecurityService) {}

  intercept(context: ExecutionContext, next: any): Observable<any> {
    return next.handle().pipe(
      tap((data) => {
        return this.security.sanitizeResponseData(data);
      })
    );
  }
}

/**
 * Guard: Rate limiting
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private rateLimiting: RateLimitService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Extract user/IP
    const userId = (request as any).user?.sub || null;
    const ipAddress =
      request.ip ||
      request.headers['x-forwarded-for']?.toString().split(',')[0];

    const clientId = userId ? `user_${userId}` : `ip_${ipAddress}`;
    const isAllowed = await this.rateLimiting.checkLimit(clientId, {
      windowSizeSeconds: 60,
      maxRequests: 100,
    });

    if (!isAllowed) {
      response.status(429);
      response.header('Retry-After', '60');
      throw new Error('Rate limit exceeded');
    }

    return true;
  }
}

/**
 * Decorator: Apply multiple guards automatically
 * Usage: @UseProductionGuards() on controller methods
 */
export function UseProductionGuards() {
  return UseInterceptors(ObservabilityInterceptor, IdempotencyInterceptor, SanitizationInterceptor);
}

/**
 * Decorator: Secure endpoint (JWT + CSRF)
 * Usage: @SecureEndpoint() on controller methods
 */
export function SecureEndpoint(options?: { rateLimit?: boolean }) {
  // Would be implemented with @UseGuards()
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    descriptor.value.__secure__ = true;
    descriptor.value.__options__ = options || {};
    return descriptor;
  };
}

/**
 * Decorator: Idempotent operation (auto-handling duplicates)
 * Usage: @Idempotent() on POST/PATCH/DELETE methods
 */
export function Idempotent() {
  return UseInterceptors(IdempotencyInterceptor);
}

/**
 * Decorator: Observable operation (auto-tracing)
 * Usage: @Observable() on methods
 */
export function WithObservability() {
  return UseInterceptors(ObservabilityInterceptor);
}
