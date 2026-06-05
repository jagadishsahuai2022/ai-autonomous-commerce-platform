/*
 * Agentic Checkout Engine Module
 * Registers all services for AI-assisted shopping with trust, safety, and observability
 * Services: Intent Guardrails, HITL Approval, Verification, Observability, Zero-party Data, Cache Events
 */

import { Module } from '@nestjs/common';
import { AgentController } from './agent.controller';

// Agentic Checkout Services
import { IntentGuardrailService } from '../../common/services/intent-guardrail.service';
import { HITLApprovalService } from '../../common/services/hitl-approval.service';
import { VerificationLayerService } from '../../common/services/verification-layer.service';
import { OpenTelemetryService } from '../../common/services/opentelemetry-ai.service';
import { ZeroPartyDataService } from '../../common/services/zero-party-data.service';
import { RedisCacheEventService } from '../../common/services/redis-cache-events.service';

// Core Infrastructure Services (already available)
import { CacheService } from '../../common/services/cache.service';
import { StructuredLoggerService } from '../../common/services/structured-logger.service';
import { MetricsService } from '../../common/services/metrics.service';
import { PrismaService } from '../../services/prisma.service';

@Module({
  controllers: [AgentController],
  providers: [
    // Agentic Checkout Services
    IntentGuardrailService,
    HITLApprovalService,
    VerificationLayerService,
    OpenTelemetryService,
    ZeroPartyDataService,
    RedisCacheEventService,

    // Core Infrastructure (injected as dependencies)
    CacheService,
    StructuredLoggerService,
    MetricsService,
    PrismaService,
  ],
  exports: [
    // Export services for use in other modules
    IntentGuardrailService,
    HITLApprovalService,
    VerificationLayerService,
    OpenTelemetryService,
    ZeroPartyDataService,
    RedisCacheEventService,
  ],
})
export class AgentModule {}
