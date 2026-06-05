/*
 * OpenTelemetry Observability & AI Decision Logs
 * Provides distributed tracing, correlation IDs, and decisions logging for AI actions
 */

import { Injectable, Logger } from '@nestjs/common';
import { trace, context, SpanStatusCode } from '@opentelemetry/api';
import { PrismaService } from '../../services/prisma.service';

export interface AIDecisionLog {
  traceId: string;
  spanId: string;
  correlationId: string;
  userId: string;
  decisionType:
    | 'RANKING'
    | 'RECOMMENDATION'
    | 'AUTO_EXECUTE'
    | 'APPROVAL_NEEDED'
    | 'GUARDRAIL_BLOCKED';
  input: any;
  output: any;
  confidence: number;
  duration: number; // milliseconds
  status: 'success' | 'blocked' | 'error';
  reasoning: string;
  metadata: Record<string, any>;
  timestamp: Date;
}

@Injectable()
export class OpenTelemetryService {
  private logger = new Logger(OpenTelemetryService.name);
  private tracer = trace.getTracer('delegatecart-agentic-checkout');

  constructor(private prisma: PrismaService) {}

  /**
   * Create a span for AI decision-making
   * Automatically captures trace and span IDs
   */
  async traceAIDecision<T>(
    decisionType: AIDecisionLog['decisionType'],
    correlationId: string,
    userId: string,
    executeDecision: (span: any) => Promise<T>
  ): Promise<T> {
    const span = this.tracer.startSpan(`ai.${decisionType.toLowerCase()}`, {
      attributes: {
        'ai.decision.type': decisionType,
        'correlation.id': correlationId,
        'user.id': userId,
        hasActiveContext: !!context.active(),
        component: 'agentic-checkout',
      },
    });

    const startTime = Date.now();
    let result: T;

    try {
      result = await context.with(trace.setSpan(context.active(), span), () =>
        executeDecision(span)
      );

      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      throw error;
    } finally {
      const duration = Date.now() - startTime;
      span.setAttributes({
        'ai.decision.duration': duration,
      });
      span.end();
    }
  }

  /**
   * Log an AI decision with all context
   */
  async logAIDecision(
    decisionType: AIDecisionLog['decisionType'],
    correlationId: string,
    userId: string,
    input: any,
    output: any,
    confidence: number,
    status: 'success' | 'blocked' | 'error',
    reasoning: string,
    duration: number,
    metadata?: Record<string, any>
  ): Promise<AIDecisionLog> {
    const span = this.tracer.startSpan('ai.decision.log', {
      attributes: {
        'ai.decision.type': decisionType,
        'ai.confidence': confidence,
        'ai.status': status,
        'ai.duration': duration,
      },
    });

    try {
      // Create decision log record
      const log = await this.prisma.aiDecisionLog.create({
        data: {
          traceId: span.spanContext().traceId,
          spanId: span.spanContext().spanId,
          correlationId,
          userId: parseInt(userId, 10),
          decisionType,
          input: JSON.stringify(input),
          output: JSON.stringify(output),
          confidence,
          duration,
          status,
          reasoning,
          metadata: JSON.stringify(metadata || {}),
        },
      });

      span.addEvent('decision_logged', {
        'decision.log.id': log.id,
        'decision.type': decisionType,
        'decision.status': status,
      });

      span.setStatus({ code: SpanStatusCode.OK });

      return this.mapDecisionLog(log);
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Add context attribute to current span
   */
  addContextAttribute(key: string, value: any): void {
    const activeSpan = trace.getActiveSpan();
    if (activeSpan) {
      activeSpan.setAttributes({
        [key]: this.serializeValue(value),
      });
    }
  }

  /**
   * Record a guardrail blocking decision
   */
  async logGuardrailBlock(
    correlationId: string,
    userId: string,
    reason: string,
    recommendations: any,
    violations: any,
    metadata?: Record<string, any>
  ): Promise<void> {
    const span = this.tracer.startSpan('guardrail.block', {
      attributes: {
        'guardrail.reason': reason,
        'correlation.id': correlationId,
      },
    });

    try {
      await this.logAIDecision(
        'GUARDRAIL_BLOCKED',
        correlationId,
        userId,
        { recommendations }, // input (what was recommended)
        { blocked: true }, // output (blocked)
        0, // confidence is 0 (blocked)
        'blocked',
        reason,
        0,
        {
          ...metadata,
          violationCount: Array.isArray(violations) ? violations.length : 0,
          violations,
        }
      );

      span.addEvent('guardrail_enforced', {
        'guardrail.severity': 'high',
        'guardrail.reason': reason,
      });
    } finally {
      span.end();
    }
  }

  /**
   * Record an approval decision
   */
  async logApprovalDecision(
    correlationId: string,
    userId: string,
    orderAmount: number,
    reason: string,
    riskScore: number,
    aiReasoning: any
  ): Promise<void> {
    const span = this.tracer.startSpan('approval.required', {
      attributes: {
        'approval.reason': reason,
        'approval.risk': riskScore,
        'approval.amount': orderAmount,
      },
    });

    try {
      await this.logAIDecision(
        'APPROVAL_NEEDED',
        correlationId,
        userId,
        { orderAmount, reason },
        { requiresApproval: true, reason },
        100 - riskScore, // confidence is inverse of risk
        'success',
        `Approval required: ${reason}`,
        0,
        {
          riskScore,
          aiReasoning,
          orderAmount,
        }
      );

      span.addEvent('approval_flow_initiated', {
        'approval.initiator': 'guardrail_engine',
      });
    } finally {
      span.end();
    }
  }

  /**
   * Record a successful auto-execution decision
   */
  async logAutoExecution(
    correlationId: string,
    userId: string,
    orderId: string,
    orderAmount: number,
    recommendations: any,
    confidence: number,
    reasoning: string
  ): Promise<void> {
    const span = this.tracer.startSpan('auto_execution.success', {
      attributes: {
        'execution.confidence': confidence,
        'execution.order.amount': orderAmount,
        'execution.order.id': orderId,
      },
    });

    try {
      await this.logAIDecision(
        'AUTO_EXECUTE',
        correlationId,
        userId,
        { recommendations },
        { executed: true, orderId },
        confidence,
        'success',
        reasoning,
        0,
        {
          orderId,
          orderAmount,
          recommendations,
        }
      );

      span.addEvent('order_auto_executed', {
        'order.id': orderId,
        'order.amount': orderAmount,
      });
    } finally {
      span.end();
    }
  }

  /**
   * Get decision history for user
   */
  async getDecisionHistory(userId: string, limit: number = 100): Promise<AIDecisionLog[]> {
    const span = this.tracer.startSpan('decision.history.fetch', {
      attributes: {
        'user.id': userId,
        'history.limit': limit,
      },
    });

    try {
      const logs = await this.prisma.aiDecisionLog.findMany({
        where: { userId: parseInt(userId, 10) },
        orderBy: { timestamp: 'desc' },
        take: limit,
      });

      span.addEvent('decision_history_retrieved', {
        'history.count': logs.length,
      });

      return logs.map((log) => this.mapDecisionLog(log));
    } finally {
      span.end();
    }
  }

  /**
   * Get decision metrics for analysis
   */
  async getDecisionMetrics(
    userId: string,
    timeRange: 'day' | 'week' | 'month' = 'week'
  ): Promise<{
    totalDecisions: number;
    approvedCount: number;
    blockedCount: number;
    executedCount: number;
    avgConfidence: number;
    successRate: number;
    averageDecisionTime: number;
    decisionsByType: Record<string, number>;
  }> {
    const span = this.tracer.startSpan('decision.metrics.calculate', {
      attributes: {
        'metrics.user.id': userId,
        'metrics.timerange': timeRange,
      },
    });

    try {
      const since = this.getDateRangeStart(timeRange);

      const logs = await this.prisma.aiDecisionLog.findMany({
        where: { userId: parseInt(userId, 10),
          timestamp: { gte: since },
        },
      });

      const metrics = {
        totalDecisions: logs.length,
        approvedCount: logs.filter((l) => l.status === 'success').length,
        blockedCount: logs.filter((l) => l.status === 'blocked').length,
        executedCount: logs.filter(
          (l) => l.decisionType === 'AUTO_EXECUTE' && l.status === 'success'
        ).length,
        avgConfidence: logs.reduce((sum, l) => sum + l.confidence, 0) / logs.length || 0,
        successRate: (logs.filter((l) => l.status === 'success').length / logs.length) * 100 || 0,
        averageDecisionTime: logs.reduce((sum, l) => sum + l.duration, 0) / logs.length || 0,
        decisionsByType: this.groupByType(logs),
      };

      span.addEvent('metrics_calculated', {
        'metrics.total': metrics.totalDecisions,
        'metrics.success_rate': metrics.successRate,
      });

      return metrics;
    } finally {
      span.end();
    }
  }

  /**
   * Map decision log record to object
   */
  private mapDecisionLog(record: any): AIDecisionLog {
    return {
      traceId: record.traceId,
      spanId: record.spanId,
      correlationId: record.correlationId,
      userId: record.userId,
      decisionType: record.decisionType,
      input: JSON.parse(record.input || '{}'),
      output: JSON.parse(record.output || '{}'),
      confidence: record.confidence,
      duration: record.duration,
      status: record.status,
      reasoning: record.reasoning,
      metadata: JSON.parse(record.metadata || '{}'),
      timestamp: record.timestamp,
    };
  }

  /**
   * Serialize value for OpenTelemetry attribute
   */
  private serializeValue(value: any): string | number | boolean {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }
    return JSON.stringify(value);
  }

  /**
   * Get date range start
   */
  private getDateRangeStart(timeRange: 'day' | 'week' | 'month'): Date {
    const now = new Date();
    switch (timeRange) {
      case 'day':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case 'week':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case 'month':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
  }

  /**
   * Group logs by decision type
   */
  private groupByType(logs: any[]): Record<string, number> {
    return logs.reduce(
      (acc, log) => {
        acc[log.decisionType] = (acc[log.decisionType] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
  }
}
