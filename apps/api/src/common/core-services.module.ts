/**
 * Core Services Integration Module
 * Centralized service registration and orchestration
 */

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

// Import all services
import { RetryUtilityService } from './services/retry-utility.service';
import { CircuitBreakerService } from './services/circuit-breaker.service';
import { DecisionGuardrailEngine } from './services/decision-guardrail-engine.service';
import { HITLApprovalService, ApprovalReason } from './services/hitl-approval-engine.service';
import { RateLimitingMiddleware } from './middleware/rate-limiting.middleware';
import { IdempotencyKeyService } from './services/idempotency-key.service';
import { ObservabilityService } from './services/observability.service';
import { DataConsistencyService } from './services/data-consistency.service';
import { SecurityService } from './services/security.service';
import { WalletSecurityService } from './services/wallet-security.service';
import { CSRFProtectionService } from './services/csrf-protection.service';
import { PerformanceOptimizationService } from './services/performance-optimization.service';
import { ErrorHandlerService } from './services/error-handler.service';
import { StructuredLoggerService } from './services/structured-logger.service';
import { MetricsService } from './services/metrics.service';
import { CacheService } from './services/cache.service';
import { RedisService } from '../services/redis.service';
import { PrismaService } from '@/services/prisma.service';

/**
 * Facade for all core services
 * Provides simple API to access production services
 */
export class CoreServicesFacade {
  private readonly logger = new Logger(CoreServicesFacade.name);

  constructor(
    private retryUtility: RetryUtilityService,
    private circuitBreaker: CircuitBreakerService,
    private guardrails: DecisionGuardrailEngine,
    private hitlApproval: HITLApprovalService,
    private idempotency: IdempotencyKeyService,
    private observability: ObservabilityService,
    private consistency: DataConsistencyService,
    private security: SecurityService,
    private walletSecurity: WalletSecurityService,
    private csrf: CSRFProtectionService,
    private performance: PerformanceOptimizationService,
    private errorHandler: ErrorHandlerService
  ) {}

  // Retry operations
  retry() {
    return this.retryUtility;
  }

  // Circuit breaker
  breaker() {
    return this.circuitBreaker;
  }

  // Decision validation
  guardrail() {
    return this.guardrails;
  }

  // Approval workflow
  approval() {
    return this.hitlApproval;
  }

  // Idempotency
  idempotent() {
    return this.idempotency;
  }

  // Observability & tracing
  trace() {
    return this.observability;
  }

  // Data consistency
  consistency_layer() {
    return this.consistency;
  }

  // Security
  protect() {
    return this.security;
  }

  // Wallet security
  wallet() {
    return this.walletSecurity;
  }

  // CSRF protection
  xsrf() {
    return this.csrf;
  }

  // Performance
  optimize() {
    return this.performance;
  }

  /**
   * Execute with full reliability & observability pipeline
   */
  async executeReliable<T>(
    operation: () => Promise<T>,
    options?: {
      operationName?: string;
      retryStrategy?: 'AGGRESSIVE' | 'MODERATE' | 'CONSERVATIVE' | 'QUICK';
      timeout?: number;
      correlationId?: string;
    }
  ): Promise<T> {
    const correlationId =
      options?.correlationId || this.observability.generateTraceContext().correlationId;

    try {
      const result = await this.retryUtility.executeWithRetry(operation, {
        maxRetries: 3,
        initialDelayMs: 100,
        maxDelayMs: 5000,
        timeoutMs: options?.timeout || 10000,
      });

      if (!result.success) {
        throw result.error || new Error('Operation failed');
      }

      return result.data as T;
    } catch (error) {
      this.logger.error(`Reliable operation failed: ${error}`);
      throw error;
    }
  }

  /**
   * Execute decision with validation & approval
   */
  async executeDecision<T>(
    userId: number,
    decision: any,
    executeFn: () => Promise<T>,
    options?: {
      amount?: number;
      products?: any[];
      correlationId?: string;
    }
  ): Promise<T> {
    // 1. Validate decision
    const validation = await this.guardrails.validateDecision(decision);

    if (!validation.approved) {
      const reason = validation.violations?.join(', ') || 'Decision validation failed';
      throw new Error(`Decision blocked: ${reason}`);
    }

    // 2. Check if approval needed
    const needsApproval = this.hitlApproval.shouldRequireApproval(options?.amount || 0);

    if (needsApproval) {
      await this.hitlApproval.createApprovalRequest({
        userId,
        productIds: [],
        quantities: [],
        totalAmount: options?.amount || 0,
        reason: ApprovalReason.AI_DECISION,
        aiReasoning: {
          decision: '',
          confidence: 0,
          reasoning: [],
          strengths: [],
          weaknesses: [],
          assumptions: [],
          fallbackOptions: [],
        },
        alternatives: validation.alternatives || [],
        riskScore: 0,
        correlationId: options?.correlationId || '',
      });

      throw new Error('Approval required for this decision');
    }

    // 3. Execute with reliability
    return this.executeReliable(executeFn, {
      operationName: 'decision_execution',
      correlationId: options?.correlationId,
    });
  }

  /**
   * Get operational health status
   */
  async getHealthStatus(): Promise<{
    circuitBreakerHealth: Record<string, any>;
    cacheHealth: { hits: number; misses: number };
    timestamp: Date;
  }> {
    return {
      circuitBreakerHealth: this.circuitBreaker.getAllStatus(),
      cacheHealth: {
        hits: 0, // Would be tracked by actual cache
        misses: 0,
      },
      timestamp: new Date(),
    };
  }
}

/**
 * Core Services Module
 * Registers all production services for dependency injection
 */

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET') || 'default-secret-key',
        signOptions: { expiresIn: '15m' },
      }),
    }),
  ],
  providers: [
    // Database service (needed by other services)
    PrismaService,
    RedisService,
    // Critical logging & metrics services (dependencies for other services)
    StructuredLoggerService,
    MetricsService,
    CacheService,
    // All core services
    RetryUtilityService,
    CircuitBreakerService,
    DecisionGuardrailEngine,
    HITLApprovalService,
    RateLimitingMiddleware,
    IdempotencyKeyService,
    ObservabilityService,
    DataConsistencyService,
    SecurityService,
    WalletSecurityService,
    CSRFProtectionService,
    PerformanceOptimizationService,
    ErrorHandlerService,
    // Facade
    CoreServicesFacade,
  ],
  exports: [
    // Export database service
    PrismaService,
    RedisService,
    // Export critical services
    StructuredLoggerService,
    MetricsService,
    CacheService,
    // Export all services individually
    RetryUtilityService,
    CircuitBreakerService,
    DecisionGuardrailEngine,
    HITLApprovalService,
    RateLimitingMiddleware,
    IdempotencyKeyService,
    ObservabilityService,
    DataConsistencyService,
    SecurityService,
    WalletSecurityService,
    CSRFProtectionService,
    PerformanceOptimizationService,
    ErrorHandlerService,
    // Export facade
    CoreServicesFacade,
  ],
})
export class CoreServicesModule {}
