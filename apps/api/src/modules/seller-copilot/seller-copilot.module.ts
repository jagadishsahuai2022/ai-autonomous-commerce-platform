/**
 * Seller AI Copilot Module
 * Integrates all seller AI features: auto listing generation, pricing, demand prediction
 */

import { Module } from '@nestjs/common';
import { SellerCopilotController } from './seller-copilot.controller';
import { SellerService } from './seller.service';
import { ListingGeneratorService } from './listing-generator.service';
import { PriceSuggestionService, DemandPredictionService } from './pricing-demand.service';

@Module({
  controllers: [SellerCopilotController],
  providers: [
    SellerService,
    ListingGeneratorService,
    PriceSuggestionService,
    DemandPredictionService,
  ],
  exports: [
    SellerService,
    ListingGeneratorService,
    PriceSuggestionService,
    DemandPredictionService,
  ],
})
export class SellerCopilotModule {}
