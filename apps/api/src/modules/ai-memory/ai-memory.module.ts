/**
 * AI Memory Module - Integrates all memory services
 */

import { Module } from '@nestjs/common';
import { MemoryService } from './memory.service';
import { RankingService } from './ranking.service';
import { AutoDecisionService } from './auto-decision.service';
import { MemoryController } from './memory.controller';

@Module({
  controllers: [MemoryController],
  providers: [MemoryService, RankingService, AutoDecisionService],
  exports: [MemoryService, RankingService, AutoDecisionService],
})
export class AiMemoryModule {}
