import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'crypto';

interface RequestInfo {
  method: string;
  path: string;
  query?: Record<string, any>;
  userId?: string;
  correlationId: string;
  timestamp: string;
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest<FastifyRequest>();
    const res = context.switchToHttp().getResponse<FastifyReply>();

    const correlationId = (req.headers['x-correlation-id'] as string) || `corr_${randomUUID()}`;

    // Attach to request for downstream use
    (req as any).correlationId = correlationId;
    res.header('X-Correlation-ID', correlationId);

    const requestInfo: RequestInfo = {
      method: req.method,
      path: req.url,
      query: Object.keys(req.query as Record<string, any> || {}).length > 0 ? req.query as Record<string, any> : undefined,
      userId: (req as any).user?.id,
      correlationId,
      timestamp: new Date().toISOString(),
    };

    const startTime = Date.now();

    this.logger.debug(
      `Incoming Request: ${requestInfo.method} ${requestInfo.path}`,
      JSON.stringify(requestInfo)
    );

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const statusCode = res.statusCode;

          this.logger.log(
            `Completed: ${requestInfo.method} ${requestInfo.path} - Status: ${statusCode} - ${duration}ms [${correlationId}]`
          );
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          const statusCode = error.status || 500;

          this.logger.error(
            `Error: ${requestInfo.method} ${requestInfo.path} - Status: ${statusCode} - ${duration}ms [${correlationId}]`,
            JSON.stringify({
              ...requestInfo,
              error: error.message,
              duration,
            })
          );
        },
      })
    );
  }
}
