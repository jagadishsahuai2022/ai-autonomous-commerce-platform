/**
 * Ops Module
 * Bundles the closed-loop autonomous operations components.
 */

import { Module } from '@nestjs/common';
import { AlertWebhookController } from './alert-webhook.controller';
import { PolicyEngineService } from './policy-engine.service';
import { ActionExecutorService } from './action-executor.service';
import { GuardrailsService } from './guardrails.service';
import { IncidentStoreService } from './incident-store.service';
import { VerifierService } from './verifier.service';

@Module({
  controllers: [AlertWebhookController],
  providers: [
    PolicyEngineService,
    ActionExecutorService,
    GuardrailsService,
    IncidentStoreService,
    VerifierService,
  ],
  exports: [IncidentStoreService],
})
export class OpsModule {}
