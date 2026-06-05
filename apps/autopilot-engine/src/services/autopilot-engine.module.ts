/**
 * Autopilot Engine Module
 * Core NestJS module for autopilot services
 */

import { Module } from '@nestjs/common';
import { RuleEngine } from './rule-engine.service';
import { DecisionEngine } from './decision-engine.service';

@Module({
  providers: [RuleEngine, DecisionEngine],
  exports: [RuleEngine, DecisionEngine],
})
export class AutopilotEngineModule {}
