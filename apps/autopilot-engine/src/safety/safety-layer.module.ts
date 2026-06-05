/**
 * Safety Layer Module
 * Provides anomaly detection and approval workflows
 */

import { Module } from '@nestjs/common';
import { SafetyLayerService } from './safety-layer.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [SafetyLayerService],
  exports: [SafetyLayerService],
})
export class SafetyLayerModule {}
