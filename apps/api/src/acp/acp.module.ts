/**
 * ACP Module
 * Part 10: Backward compatibility - brings all ACP services together
 * Non-breaking changes to existing system
 */

import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

// Core services
import { ACPGatewayService } from './services/acp-gateway.service';
import { ACPPaymentTokenService } from './services/acp-payment-token.service';
import { ACPVerificationService } from './services/acp-verification.service';
import { ACPKafkaProducerService } from './services/acp-kafka-producer.service';

// Adapters
import {
  AmazonMerchantAdapter,
  FlipkartMerchantAdapter,
  InternalSellerAdapter,
} from './adapters/merchant-adapters';

// Controller
import { ACPAgentController } from './controllers/acp-agent.controller';

// Dependencies
import { RetryUtilityService } from '../common/services/retry-utility.service';
import { CircuitBreakerService } from '../common/services/circuit-breaker.service';
import { ObservabilityService } from '../common/services/observability.service';
import { DecisionGuardrailEngine } from '../common/services/decision-guardrail-engine.service';
import { IdempotencyKeyService } from '../common/services/idempotency-key.service';

/**
 * ACP Module
 * Encapsulates all Agentic Commerce Protocol functionality
 *
 * Features:
 * - Part 1: ACP Core Architecture (Gateway)
 * - Part 2: Standardized Agent APIs (REST endpoints)
 * - Part 3: ACP Message Schema (Types)
 * - Part 4: Payment Tokenization (Secure token service)
 * - Part 5: Merchant Adapter Layer (Amazon, Flipkart, Internal)
 * - Part 6: Verification Layer (Budget, availability, trust, delivery)
 * - Part 7: Event Integration (Kafka events)
 * - Part 8: Security (Signed requests, token auth, idempotency)
 * - Part 9: Observability (Correlation IDs, logging)
 * - Part 10: Backward Compatibility (Non-breaking, additive layer)
 */
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET') || 'default-secret',
        signOptions: { expiresIn: '15m' },
      }),
    }),
  ],
  providers: [
    // Core ACP Services
    ACPGatewayService,
    ACPPaymentTokenService,
    ACPVerificationService,
    ACPKafkaProducerService,

    // Merchant Adapters
    AmazonMerchantAdapter,
    FlipkartMerchantAdapter,
    InternalSellerAdapter,

    // Existing dependencies (imported from common)
    RetryUtilityService,
    CircuitBreakerService,
    ObservabilityService,
    DecisionGuardrailEngine,
    IdempotencyKeyService,
  ],
  controllers: [ACPAgentController],
  exports: [
    ACPGatewayService,
    ACPPaymentTokenService,
    ACPVerificationService,
    ACPKafkaProducerService,
    AmazonMerchantAdapter,
    FlipkartMerchantAdapter,
    InternalSellerAdapter,
  ],
})
export class ACPModule implements OnModuleInit {
  private readonly logger = new Logger(ACPModule.name);

  constructor(
    private kafka: ACPKafkaProducerService,
    private breaker: CircuitBreakerService
  ) {}

  /**
   * Initialize ACP Module
   * Connect to Kafka and register circuit breakers
   */
  async onModuleInit() {
    try {
      // Register circuit breakers for all merchant adapters
      this.registerCircuitBreakers();

      // Connect to Kafka
      await this.kafka.connect();
      this.logger.log('ACP Module initialized successfully');
      this.logImplementationStatus();
    } catch (error) {
      this.logger.error(`ACP Module initialization failed: ${error}`);
      // Don't throw - system can run without Kafka
    }
  }

  /**
   * Register circuit breakers for merchant adapters
   */
  private registerCircuitBreakers() {
    // Amazon adapter circuits
    this.breaker.register({
      name: 'amazon_search',
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 30000,
      requestVolumeThreshold: 10,
    });

    this.breaker.register({
      name: 'amazon_quote',
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 20000,
      requestVolumeThreshold: 10,
    });

    this.breaker.register({
      name: 'amazon_checkout',
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 60000,
      requestVolumeThreshold: 5,
    });

    // Flipkart adapter circuits
    this.breaker.register({
      name: 'flipkart_search',
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 30000,
      requestVolumeThreshold: 10,
    });

    this.breaker.register({
      name: 'flipkart_quote',
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 20000,
      requestVolumeThreshold: 10,
    });

    this.breaker.register({
      name: 'flipkart_checkout',
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 60000,
      requestVolumeThreshold: 5,
    });

    // Internal adapter circuits
    this.breaker.register({
      name: 'internal_search',
      failureThreshold: 10,
      successThreshold: 3,
      timeout: 15000,
      requestVolumeThreshold: 20,
    });

    this.breaker.register({
      name: 'internal_quote',
      failureThreshold: 10,
      successThreshold: 3,
      timeout: 10000,
      requestVolumeThreshold: 20,
    });

    this.breaker.register({
      name: 'internal_checkout',
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 30000,
      requestVolumeThreshold: 10,
    });

    this.logger.debug('✅ Circuit breakers registered for all merchant adapters');
  }

  /**
   * Log implementation status for debugging
   */
  private logImplementationStatus() {
    /* eslint-disable no-console */
    console.log('\n✅ ACP IMPLEMENTATION STATUS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('PART 1 ✅ ACP Core Architecture - ACPGatewayService');
    console.log('  └─ Translates internal decisions to ACP format');
    console.log('  └─ Manages agent-to-merchant communication');
    console.log('');
    console.log('PART 2 ✅ Standardized Agent APIs');
    console.log('  └─ POST /agent/search - Product search');
    console.log('  └─ POST /agent/quote - Pricing & availability');
    console.log('  └─ POST /agent/checkout - Order execution');
    console.log('  └─ GET /agent/status/:correlationId - Status tracking');
    console.log('');
    console.log('PART 3 ✅ ACP Message Schema - acp.types.ts');
    console.log('  └─ AgentRequest: intent, constraints, user_context');
    console.log('  └─ AgentResponse: options, selected, alternatives, confidence');
    console.log('  └─ CheckoutRequest/Response: standardized format');
    console.log('');
    console.log('PART 4 ✅ Payment Tokenization - ACPPaymentTokenService');
    console.log('  └─ Secure token generation (24h expiry)');
    console.log('  └─ Authorization limit enforcement');
    console.log('  └─ No raw payment data exposure');
    console.log('');
    console.log('PART 5 ✅ Merchant Adapter Layer');
    console.log('  └─ AmazonMerchantAdapter (mock)');
    console.log('  └─ FlipkartMerchantAdapter (mock)');
    console.log('  └─ InternalSellerAdapter (production)');
    console.log('  └─ Each supports: search, quote, checkout');
    console.log('');
    console.log('PART 6 ✅ Verification Layer - ACPVerificationService');
    console.log('  └─ Budget compliance (mandatory)');
    console.log('  └─ Product availability (mandatory)');
    console.log('  └─ Seller trust scores (mandatory)');
    console.log('  └─ Delivery constraints (mandatory)');
    console.log('');
    console.log('PART 7 ✅ Kafka Event Integration - ACPKafkaProducerService');
    console.log('  └─ agent.request.created');
    console.log('  └─ agent.response.generated');
    console.log('  └─ agent.checkout.initiated');
    console.log('  └─ agent.checkout.completed');
    console.log('');
    console.log('PART 8 ✅ Security');
    console.log('  └─ JWT authentication via JWTAuthGuard');
    console.log('  └─ Idempotency keys for checkout safety');
    console.log('  └─ Token-based payment authorization');
    console.log('  └─ HMAC request signing (ready)');
    console.log('');
    console.log('PART 9 ✅ Observability');
    console.log('  └─ Correlation IDs (format: corr_${timestamp}_${random})');
    console.log('  └─ Distributed tracing via X-Correlation-ID headers');
    console.log('  └─ Decision logging with confidence scores');
    console.log('  └─ Status tracking by correlation ID');
    console.log('');
    console.log('PART 10 ✅ Backward Compatibility');
    console.log('  └─ ACP layer is additive (not breaking)');
    console.log('  └─ Existing APIs continue to work');
    console.log('  └─ New /api/v1/agent/* endpoints for ACP');
    console.log('  └─ Payment token service separate from wallet');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    /* eslint-enable no-console */
  }
}

/**
 * Integration Instructions for AppModule
 *
 * 1. Add to imports in app.module.ts:
 *
 *    import { ACPModule } from './acp/acp.module';
 *
 *    @Module({
 *      imports: [
 *        // ... existing imports
 *        ACPModule,
 *      ],
 *    })
 *    export class AppModule {}
 *
 * 2. Environment variables needed:
 *
 *    KAFKA_BROKERS=localhost:9092
 *    PAYMENT_TOKEN_SECRET=your-secret-key
 *    JWT_SECRET=your-jwt-secret
 *
 * 3. Test endpoints:
 *
 *    - POST /api/v1/agent/search
 *      Body: { intent: { query: "laptop" }, ... }
 *
 *    - POST /api/v1/agent/quote
 *      Body: { productId: "...", quantity: 1 }
 *
 *    - POST /api/v1/agent/checkout
 *      Headers: { "Idempotency-Key": "..." }
 *      Body: { intent: { products: [...] }, paymentToken: "..." }
 *
 * 4. Verify Kafka integration:
 *
 *    - Check topics: agent.request.created, agent.response.generated, etc.
 *    - All events include correlation ID for request tracing
 *
 * 5. Monitor security:
 *
 *    - All endpoints require JWT authentication
 *    - Payment tokens expire after 24 hours
 *    - All requests include correlation IDs
 *    - Idempotency keys prevent duplicate checkouts
 */
