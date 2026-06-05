/**
 * Database Module
 * Provides database access layer
 */

import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { AutopilotRuleRepository } from './repositories/autopilot-rule.repository';
import { AutopilotDecisionRepository } from './repositories/autopilot-decision.repository';

@Module({
  providers: [PrismaService, AutopilotRuleRepository, AutopilotDecisionRepository],
  exports: [PrismaService, AutopilotRuleRepository, AutopilotDecisionRepository],
})
export class DatabaseModule {}
