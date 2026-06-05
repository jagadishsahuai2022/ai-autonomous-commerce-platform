/**
 * Enterprise Observability Service
 * Correlation IDs, distributed tracing, metrics aggregation
 */

import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'crypto';
import { MetricsService } from './metrics.service';
import { StructuredLoggerService } from './structured-logger.service';

export interface TraceContext {
  correlationId: string;
  traceId: string;
  spanId: string;
  userId?: number;
  requestPath?: string;
  requestMethod?: string;
  timestamp: Date;
}

export interface DecisionTrace {
  correlationId: string;
  decisionType:
    | 'RANKING'
    | 'RECOMMENDATION'
    | 'AUTO_EXECUTE'
    | 'APPROVAL_NEEDED'
    | 'GUARDRAIL_BLOCKED';
  input: Record<string, any>;
  output: Record<string, any>;
  confidence: number;
  latencyMs: number;
  status: 'success' | 'failed' | 'blocked';
  reasoning?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class ObservabilityService {
  private readonly logger = new Logger(ObservabilityService.name);
  private traceContextMap = new Map<string, TraceContext>();

  constructor(
    private metrics: MetricsService,
    private structuredLogger: StructuredLoggerService
  ) {}

  /**
   * Generate new trace context
   */
  generateTraceContext(
    userId?: number,
    requestPath?: string,
    requestMethod?: string
  ): TraceContext {
    return {
      correlationId: `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      traceId: randomUUID(),
      spanId: randomUUID(),
      userId,
      requestPath,
      requestMethod,
      timestamp: new Date(),
    };
  }

  /**
   * Store trace context in async local storage (thread-local equivalent)
   */
  setTraceContext(context: TraceContext): void {
    this.traceContextMap.set(context.correlationId, context);
  }

  /**
   * Get current trace context
   */
  getTraceContext(correlationId: string): TraceContext | undefined {
    return this.traceContextMap.get(correlationId);
  }

  /**
   * Log structured event with trace context
   */
  logEvent(
    correlationId: string,
    eventType: string,
    data: Record<string, any>,
    level: 'info' | 'warn' | 'error' = 'info'
  ): void {
    const context = this.getTraceContext(correlationId);

    const logData = {
      correlationId,
      traceId: context?.traceId,
      spanId: context?.spanId,
      eventType,
      userId: context?.userId,
      requestPath: context?.requestPath,
      timestamp: new Date().toISOString(),
      ...data,
    };

    this.structuredLogger.log(level, JSON.stringify(logData));

    if (level === 'error') {
      this.metrics.increment('observability_errors');
    }
  }

  /**
   * Trace AI decision with full context
   */
  traceDecision(correlationId: string, decision: DecisionTrace): void {
    const context = this.getTraceContext(correlationId);

    this.structuredLogger.logBusinessEvent('ai_decision_traced', {
      correlationId,
      traceId: context?.traceId,
      spanId: context?.spanId,
      decisionType: decision.decisionType,
      confidence: decision.confidence,
      latencyMs: decision.latencyMs,
      status: decision.status,
      userId: context?.userId,
      reasoning: decision.reasoning,
    });

    // Record metrics
    this.metrics.recordMetric(`decision_latency_${decision.decisionType}`, decision.latencyMs);
    this.metrics.recordMetric(`decision_confidence_${decision.decisionType}`, decision.confidence);

    if (decision.status === 'success') {
      this.metrics.increment(`decision_success_${decision.decisionType}`);
    } else if (decision.status === 'blocked') {
      this.metrics.increment(`decision_blocked_${decision.decisionType}`);
    } else {
      this.metrics.increment(`decision_failed_${decision.decisionType}`);
    }
  }

  /**
   * Record request metrics
   */
  recordRequestMetrics(
    correlationId: string,
    statusCode: number,
    latencyMs: number,
    method: string,
    path: string
  ): void {
    this.metrics.recordMetric('http_request_latency', latencyMs);
    this.metrics.increment(`http_status_${statusCode}`);
    this.metrics.increment(`http_method_${method}`);

    // Record percentiles for latency
    if (latencyMs > 5000) {
      this.metrics.increment('http_request_slow');
    }
  }

  /**
   * Clean up old trace contexts (for memory management)
   */
  cleanupStaleContexts(maxAgeSec: number = 3600): number {
    const now = Date.now();
    let cleared = 0;

    for (const [correlationId, context] of this.traceContextMap.entries()) {
      if (now - context.timestamp.getTime() > maxAgeSec * 1000) {
        this.traceContextMap.delete(correlationId);
        cleared++;
      }
    }

    if (cleared > 0) {
      this.logger.debug(`Cleaned up ${cleared} stale trace contexts`);
    }

    return cleared;
  }

  /**
   * Get all active traces
   */
  getActiveTraces(): Map<string, TraceContext> {
    return new Map(this.traceContextMap);
  }

  /**
   * Get observability stats
   */
  getStats(): {
    activeTraces: number;
    totalTraces: number;
  } {
    return {
      activeTraces: this.traceContextMap.size,
      totalTraces: this.traceContextMap.size, // Would be tracked separately in production
    };
  }
}

/**
 * Middleware to inject trace context into requests
 */
@Injectable()
export class TraceContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TraceContextMiddleware.name);

  constructor(private observability: ObservabilityService) {}

  use(req: FastifyRequest, res: FastifyReply, next: () => void) {
    const userId = (req as any).user?.id;
    const context = this.observability.generateTraceContext(userId, req.url, req.method);

    this.observability.setTraceContext(context);

    // Add to response headers
    res.header('X-Correlation-ID', context.correlationId);
    res.header('X-Trace-ID', context.traceId);
    res.header('X-Span-ID', context.spanId);

    // Store in request for later access
    (req as any).traceContext = context;

    // Measure response time
    const startTime = Date.now();
    res.raw.on('finish', () => {
      const latencyMs = Date.now() - startTime;
      this.observability.recordRequestMetrics(
        context.correlationId,
        res.raw.statusCode,
        latencyMs,
        req.method,
        req.url
      );
    });

    next();
  }
}
