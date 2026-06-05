/**
 * India Localization Module
 * Provides India-specific e-commerce features
 */

import { Module } from '@nestjs/common';
import { IndiaLocalizationService } from './india-localization.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [IndiaLocalizationService],
  exports: [IndiaLocalizationService],
})
export class IndiaLocalizationModule {}
