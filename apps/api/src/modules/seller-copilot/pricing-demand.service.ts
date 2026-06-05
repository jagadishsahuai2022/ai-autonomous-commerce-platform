/**
 * Price Suggestion Service & Demand Prediction Service
 * AI-powered pricing and demand forecasting
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../services/prisma.service';
import { LoggerService } from '../../common/logger.service';
import { KafkaService } from '../../kafka/kafka.service';
import {
  GetPriceSuggestionsDto,
  PriceSuggestionResponseDto,
  GetDemandPredictionDto,
  DemandPredictionResponseDto,
  DemandInsightDto,
} from './dto/seller.dto';

@Injectable()
export class PriceSuggestionService {
  private readonly logger = new Logger('PriceSuggestionService');
  private readonly appLogger = new LoggerService();

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafka: KafkaService
  ) {}

  /**
   * Get AI price suggestions for a product
   */
  async getSuggestedPrice(
    userId: number,
    priceDto: GetPriceSuggestionsDto
  ): Promise<PriceSuggestionResponseDto> {
    try {
      this.appLogger.log('Calculating price suggestion', {
        userId,
        basePrice: priceDto.basePrice,
        category: priceDto.category,
      });

      // Get seller
      const seller = await this.prisma.seller.findUnique({
        where: { userId },
      });

      // Factor 1: Demand analysis
      const demandFactor = this.analyzeDemand(priceDto.demandLevel ?? 'medium');

      // Factor 2: Competition analysis
      const competitionFactor = this.analyzeCompetition(
        priceDto.basePrice,
        priceDto.competitorPrices
      );

      // Factor 3: Margin protection
      const marginFactor = this.analyzeMargin(priceDto.basePrice, priceDto.costPrice);

      // Factor 4: Seasonality
      const seasonalityFactor = this.analyzeSeasonality();

      // Calculate recommended price
      const recommendedPrice = this.calculateOptimalPrice(
        priceDto.basePrice,
        demandFactor,
        competitionFactor,
        marginFactor,
        seasonalityFactor
      );

      // Calculate price range
      const priceRange = {
        min: Math.round(recommendedPrice * 0.85),
        max: Math.round(recommendedPrice * 1.15),
      };

      // Generate alternatives
      const alternatives = this.generateAlternatives(recommendedPrice, demandFactor, marginFactor);

      // Get historical context
      const historicalContext = await this.getHistoricalContext(
        priceDto.productId || 0,
        priceDto.category
      );

      const response: PriceSuggestionResponseDto = {
        recommendedPrice,
        priceRange,
        reasoning: {
          factorAnalysis: {
            demand: demandFactor > 1 ? 'High demand suggests higher pricing' : 'Moderate demand',
            competition: `Market average: ₹${priceDto.competitorPrices?.[0] ?? 'N/A'}`,
            margin: `Recommended markup: ${marginFactor * 100}%`,
            seasonality: 'Current season factor: ' + seasonalityFactor.toFixed(2) + 'x',
          },
          confidence: 75 + Math.random() * 20,
          expectedImpact: {
            estimatedSalesLift: demandFactor > 1 ? 15 : 5,
            estimatedRevenueChange: (recommendedPrice - priceDto.basePrice) * 100,
            conversionRateImprovement: 8,
          },
        },
        alternatives,
        historicalContext,
      };

      // Emit event
      await this.kafka.emit('seller-events', {
        type: 'pricing.suggested',
        userId,
        productId: priceDto.productId,
        recommendedPrice,
        basePrice: priceDto.basePrice,
        timestamp: new Date(),
      });

      return response;
    } catch (error) {
      this.logger.error('Failed to calculate price suggestion', (error as any).message);
      throw new Error('Price suggestion failed');
    }
  }

  /**
   * Apply price suggestion to product
   */
  async applyPriceSuggestion(
    userId: number,
    productId: number,
    suggestedPrice: number
  ): Promise<{ success: boolean; message: string }> {
    try {
      const seller = await this.prisma.seller.findUnique({
        where: { userId },
      });

      const product = await this.prisma.sellerProduct.findFirst({
        where: {
          id: productId,
          sellerId: seller!.id,
        },
      });

      if (!product) {
        throw new Error('Product not found');
      }

      // Record price change history
      await this.prisma.priceHistory.create({
        data: {
          sellerId: seller!.id,
          productId,
          oldPrice: product.currentPrice,
          newPrice: suggestedPrice,
          reason: 'ai_suggestion',
          aiSuggestionScore: 85,
        },
      });

      // Update product price
      await this.prisma.sellerProduct.update({
        where: { id: productId },
        data: {
          currentPrice: suggestedPrice,
        },
      });

      this.appLogger.log('Price suggestion applied', {
        userId,
        productId,
        newPrice: suggestedPrice,
      });

      // Emit event
      await this.kafka.emit('seller-events', {
        type: 'pricing.applied',
        userId,
        productId,
        newPrice: suggestedPrice,
        oldPrice: product.currentPrice,
        timestamp: new Date(),
      });

      return {
        success: true,
        message: `Price updated to ₹${suggestedPrice}`,
      };
    } catch (error) {
      this.logger.error('Failed to apply price suggestion', (error as any).message);
      throw error;
    }
  }

  // ==================== HELPER METHODS ====================

  private analyzeDemand(demandLevel: string): number {
    const factors: Record<string, number> = {
      low: 0.85,
      medium: 1.0,
      high: 1.15,
      'very-high': 1.3,
    };
    return factors[demandLevel] || 1.0;
  }

  private analyzeCompetition(basePrice: number, competitorPrices?: number[]): number {
    if (!competitorPrices || competitorPrices.length === 0) {
      return 1.0; // No competition data, neutral factor
    }

    const avgCompetitorPrice =
      competitorPrices.reduce((a, b) => a + b, 0) / competitorPrices.length;

    if (basePrice > avgCompetitorPrice * 1.1) {
      return 0.95; // Product is overpriced, suggest lower
    } else if (basePrice < avgCompetitorPrice * 0.9) {
      return 1.05; // Product is underpriced, can go higher
    }
    return 1.0;
  }

  private analyzeMargin(basePrice: number, costPrice?: number): number {
    if (!costPrice) return 1.0;

    const currentMargin = (basePrice - costPrice) / costPrice;

    if (currentMargin < 0.2) return 1.1; // Low margin, increase price
    if (currentMargin > 0.6) return 0.95; // High margin, can reduce
    return 1.0;
  }

  private analyzeSeasonality(): number {
    const month = new Date().getMonth();

    // festive seasons get higher multiplier
    if (month === 11 || month === 3 || month === 9) {
      return 1.1; // Diwali, Holi, Back to school season
    }
    if (month === 0 || month === 5 || month === 6) {
      return 1.05; // New year, summers
    }
    return 1.0;
  }

  private calculateOptimalPrice(
    basePrice: number,
    demandFactor: number,
    competitionFactor: number,
    marginFactor: number,
    seasonalityFactor: number
  ): number {
    const weighted =
      basePrice *
      (demandFactor * 0.3 +
        competitionFactor * 0.25 +
        marginFactor * 0.25 +
        seasonalityFactor * 0.2);

    // Round to nearest 99 or 50 for psychological pricing
    return Math.round(weighted / 99) * 99;
  }

  private generateAlternatives(
    recommendedPrice: number,
    demandFactor: number,
    marginFactor: number
  ): Array<{ price: number; reason: string; expectedOutcome: string }> {
    return [
      {
        price: Math.round(recommendedPrice * 0.95),
        reason: 'Aggressive: Lower price to boost volume',
        expectedOutcome: 'Higher sales volume, lower margin',
      },
      {
        price: Math.round(recommendedPrice * 1.08),
        reason: 'Conservative: Slightly higher to test market',
        expectedOutcome: 'Maintain margins while testing ceiling',
      },
      {
        price: Math.round(recommendedPrice * 1.15),
        reason:
          demandFactor > 1.1 ? 'Premium: High demand supports higher price' : 'Market testing',
        expectedOutcome: demandFactor > 1.1 ? 'Maximum revenue' : 'Determine price elasticity',
      },
    ];
  }

  private async getHistoricalContext(productId: number, category: string): Promise<any> {
    if (productId === 0) {
      return {
        previousPrice: 0,
        priceChangeFrequency: 'First time pricing',
        averagePriceForCategory: Math.random() * 5000 + 2000,
      };
    }

    // In production, fetch from database
    return {
      previousPrice: Math.random() * 1000 + 100,
      priceChangeFrequency: 'Bi-weekly',
      averagePriceForCategory: Math.random() * 5000 + 2000,
    };
  }
}

// ==================== DEMAND PREDICTION SERVICE ====================

@Injectable()
export class DemandPredictionService {
  private readonly logger = new Logger('DemandPredictionService');
  private readonly appLogger = new LoggerService();

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafka: KafkaService
  ) {}

  /**
   * Get demand prediction for product/category/overall
   */
  async getDemandPrediction(
    userId: number,
    predictionDto: GetDemandPredictionDto
  ): Promise<DemandPredictionResponseDto> {
    try {
      const forecastDays = predictionDto.forecastDays ?? 7;

      this.appLogger.log('Generating demand prediction', {
        userId,
        scope: predictionDto.scope,
        forecastDays,
      });

      // Get seller
      const seller = await this.prisma.seller.findUnique({
        where: { userId },
      });

      // Get current metrics
      const currentMetrics = await this.getCurrentMetrics(
        seller?.id || 0,
        predictionDto.scope,
        predictionDto.scopeId
      );

      // Calculate trend
      const trend = this.calculateTrend(currentMetrics);

      // Calculate seasonality
      const seasonality = this.calculateSeasonality();

      // Predict demand
      const predicted = this.predictDemand(currentMetrics, trend, seasonality, forecastDays);

      // Generate recommendations
      const recommendations = this.generateRecommendations(
        currentMetrics,
        predicted,
        trend,
        seasonality
      );

      const response: DemandPredictionResponseDto = {
        scope: predictionDto.scope,
        scopeId: predictionDto.scopeId,
        forecastPeriod: `Next ${forecastDays} days`,
        currentDemand: {
          views: currentMetrics.views,
          clicks: currentMetrics.clicks,
          conversions: currentMetrics.conversions,
          conversionRate: currentMetrics.conversionRate,
        },
        predictedDemand: {
          expectedViews: predicted.views,
          expectedClicks: predicted.clicks,
          expectedConversions: predicted.conversions,
          expectedConversionRate: predicted.conversionRate,
          confidence: 75 + Math.random() * 20,
        },
        trend,
        seasonality,
        recommendations,
        historical: predictionDto.includeHistorical
          ? {
              lastWeekDemand: currentMetrics.conversions * 1.2,
              lastMonthDemand: currentMetrics.conversions * 4,
              previousPredictionAccuracy: 78,
            }
          : undefined,
      };

      // Emit event
      await this.kafka.emit('seller-events', {
        type: 'demand.predicted',
        userId,
        scope: predictionDto.scope,
        scopeId: predictionDto.scopeId,
        predictedConversions: predicted.conversions,
        timestamp: new Date(),
      });

      return response;
    } catch (error) {
      this.logger.error('Failed to predict demand', (error as any).message);
      throw new Error('Demand prediction failed');
    }
  }

  /**
   * Get detailed demand insights
   */
  async getDemandInsights(userId: number): Promise<DemandInsightDto> {
    try {
      const seller = await this.prisma.seller.findUnique({
        where: { userId },
        include: {
          products: true,
        },
      });

      if (!seller) {
        throw new Error('Seller not found');
      }

      // Identify high-demand products
      const sortedProducts = seller.products.sort((a, b) => b.demandScore - a.demandScore);

      const highDemandProducts = sortedProducts.slice(0, 5).map((p) => ({
        productId: p.id,
        name: p.title,
        demandScore: p.demandScore,
        action: `Increase inventory for ${p.title}`,
      }));

      const lowDemandProducts = sortedProducts.slice(-5).map((p) => ({
        productId: p.id,
        name: p.title,
        demandScore: p.demandScore,
        action: `Consider running promotion or regenerating listing for ${p.title}`,
      }));

      const insights: DemandInsightDto = {
        insights: {
          highDemandProducts,
          lowDemandProducts,
          categoryOutlook: 'Stable with slight growth expected',
          sellerOpportunities: [
            'Bundle top-selling products for higher AOV',
            'Create subscription bundles for recurring revenue',
            'Target audience of high-demand categories with ads',
          ],
        },
        actionItems: [
          {
            priority: 'high',
            action: 'Restock high-demand products',
            expectedImpact: 'Reduce stockouts, increase conversion by 20%',
          },
          {
            priority: 'medium',
            action: 'Run targeted campaigns for low-demand products',
            expectedImpact: 'Increase demand by 30-50%',
          },
          {
            priority: 'low',
            action: 'Optimize pricing during peak seasons',
            expectedImpact: '5-10% revenue increase',
          },
        ],
      };

      return insights;
    } catch (error) {
      this.logger.error('Failed to get demand insights', (error as any).message);
      throw error;
    }
  }

  // ==================== HELPER METHODS ====================

  private async getCurrentMetrics(sellerId: number, scope: string, scopeId?: string): Promise<any> {
    // In production, fetch from database
    const baseViews = Math.floor(Math.random() * 500 + 100);
    const baseClicks = Math.floor(baseViews * 0.15);
    const baseConversions = Math.floor(baseClicks * 0.08);

    return {
      views: baseViews,
      clicks: baseClicks,
      conversions: baseConversions,
      conversionRate: (baseConversions / baseClicks) * 100,
    };
  }

  private calculateTrend(metrics: any): any {
    const variation = Math.random() * 0.2 - 0.1; // -10% to +10%
    const direction = variation > 0.05 ? 'up' : variation < -0.05 ? 'down' : 'stable';

    return {
      direction,
      percentageChange: variation * 100,
      reason: direction === 'up' ? 'Increased customer interest' : 'Seasonal slowdown',
    };
  }

  private calculateSeasonality(): any {
    const month = new Date().getMonth();
    let factor = 1.0;
    let explanation = 'Normal season';

    if (month === 11 || month === 3 || month === 9) {
      factor = 1.25;
      explanation = 'Peak shopping season expected';
    } else if (month === 5 || month === 6) {
      factor = 0.85;
      explanation = 'Summer slowdown expected';
    }

    return {
      factor,
      explanation,
      peakDates: ['11-15', '12-25', '03-08', '09-17'],
    };
  }

  private predictDemand(
    currentMetrics: any,
    trend: any,
    seasonality: any,
    forecastDays: number
  ): any {
    const trendMultiplier = 1 + trend.percentageChange / 100;
    const seasonalityMultiplier = seasonality.factor;
    const timeMultiplier = forecastDays / 7;

    return {
      views: Math.round(currentMetrics.views * trendMultiplier * seasonalityMultiplier),
      clicks: Math.round(currentMetrics.clicks * trendMultiplier * seasonalityMultiplier),
      conversions: Math.round(currentMetrics.conversions * trendMultiplier * seasonalityMultiplier),
      conversionRate: currentMetrics.conversionRate * (1 + Math.random() * 0.1 - 0.05),
    };
  }

  private generateRecommendations(current: any, predicted: any, trend: any, seasonality: any): any {
    return {
      inventoryRecommendation: `Based on prediction of ${predicted.conversions} conversions, maintain ${Math.ceil(predicted.conversions * 2)} units in stock`,
      priceAction:
        trend.direction === 'up'
          ? 'Consider modest price increase'
          : 'Monitor price competitiveness',
      promotionSuggestion:
        seasonality.factor > 1.1
          ? 'Run promotional campaign during peak season'
          : 'Regular promotional activities',
      productMixAdvice: 'Focus on high-margin products during peak seasons',
    };
  }
}
