/**
 * AI Memory Service - Core memory management and learning
 * Handles storing, retrieving, analyzing user preferences and buying patterns
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../services/prisma.service';
import { RedisService } from '../../services/redis.service';
import { KafkaService } from '../../kafka/kafka.service';
import { LoggerService } from '../../common/logger.service';
import {
  CreatePreferencesDto,
  PreferencesDto,
  BuyingPatternDto,
  UserMemoryDto,
  MemoryInsightDto,
  MemorySummaryDto,
  MemoryAnalysisDto,
  PersonalizationBoostsDto,
} from './dto/memory.dto';

@Injectable()
export class MemoryService {
  private readonly logger = new LoggerService();
  private readonly MEMORY_CACHE_TTL = 3600; // 1 hour

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private kafka: KafkaService
  ) {}

  /**
   * Initialize user memory from first interaction
   */
  async initializeUserMemory(userId: number): Promise<UserMemoryDto> {
    this.logger.log(`Initializing memory for user ${userId}`);

    try {
      // Create preferences
      const preferences = await this.prisma.userPreferences.create({
        data: { userId },
      });

      // Create buying pattern
      await this.prisma.buyingPattern.create({
        data: { userId },
      });

      // Create user memory with empty history
      const memory = await this.prisma.userMemory.create({
        data: {
          userId,
          currentPreferences: {},
          currentPatterns: {},
        },
      });

      // Create ranking personalization with default weights
      await this.prisma.rankingPersonalization.create({
        data: {
          userId,
          categoryWeights: this.getDefaultCategoryWeights(),
        },
      });

      // Emit event
      await this.kafka.emit('memory.initialized', {
        userId,
        timestamp: new Date(),
      });

      return this.mapMemoryToDto(memory);
    } catch (error) {
      this.logger.error('Failed to initialize memory', (error as any).message);
      throw error;
    }
  }

  /**
   * Get user preferences
   */
  async getUserPreferences(userId: number): Promise<PreferencesDto> {
    const cacheKey = `user_preferences:${userId}`;

    // Try cache first
    const cached = await this.redis.get<string>(cacheKey);
    if (cached) return JSON.parse(cached);

    const preferences = await this.prisma.userPreferences.findUnique({
      where: { userId },
    });

    if (!preferences) {
      return await this.initializeUserMemory(userId).then((m) =>
        this.prisma.userPreferences.findUnique({ where: { userId } })
      );
    }

    const dto = this.mapPreferencesToDto(preferences);
    await this.redis.set(cacheKey, JSON.stringify(dto), { ttl: this.MEMORY_CACHE_TTL });

    return dto;
  }

  /** - Learn from user input
   */
  async updatePreferences(userId: number, dto: CreatePreferencesDto): Promise<PreferencesDto> {
    this.logger.log(`Updating preferences for user ${userId}`);

    try {
      const updated = await this.prisma.userPreferences.update({
        where: { userId },
        data: {
          ...dto,
          lastUpdated: new Date(),
        },
      });

      // Invalidate cache
      await this.redis.delete(`user_preferences:${userId}`);

      // Update memory with new preferences
      await this.updateUserMemory(userId, 'preferences', updated);

      // Emit event
      await this.kafka.emit('preferences.updated', {
        userId,
        preferences: dto,
        timestamp: new Date(),
      });

      return this.mapPreferencesToDto(updated);
    } catch (error) {
      this.logger.error('Failed to update preferences', (error as any).message);
      throw error;
    }
  }

  /**
   * Get buying patterns from order history
   */
  async analyzeBuyingPatterns(userId: number): Promise<BuyingPatternDto> {
    const cacheKey = `buying_pattern:${userId}`;

    // Check cache
    const cached = await this.redis.get<string>(cacheKey);
    if (cached) return JSON.parse(cached);

    this.logger.log(`Analyzing buying patterns for user ${userId}`);

    try {
      // Get all orders for user
      const orders = await this.prisma.order.findMany({
        where: { userId },
        include: { items: { include: { product: true } } },
      });

      if (orders.length === 0) {
        // No orders yet - return empty pattern
        return (
          (await this.prisma.buyingPattern.findUnique({
            where: { userId },
          })) || {} as any
        );
      }

      // Analyze patterns
      const patterns = this.extractBuyingPatterns(orders);

      // Store in database
      const updated = await this.prisma.buyingPattern.update({
        where: { userId },
        data: {
          ...patterns,
          lastAnalyzed: new Date(),
        },
      });

      // Cache result
      const dto = this.mapPatternToDto(updated);
      await this.redis.set(cacheKey, JSON.stringify(dto), { ttl: this.MEMORY_CACHE_TTL });

      return dto;
    } catch (error) {
      this.logger.error('Failed to analyze patterns', (error as any).message);
      throw error;
    }
  }

  /**
   * Get comprehensive memory summary
   */
  async getMemorySummary(userId: number): Promise<MemorySummaryDto> {
    this.logger.log(`Fetching memory summary for user ${userId}`);

    try {
      const [preferences, patterns, memory, ranking, recentDecisions, insight] = await Promise.all([
        this.getUserPreferences(userId),
        this.analyzeBuyingPatterns(userId),
        this.getUserMemory(userId),
        this.getRankingPersonalization(userId),
        this.getRecentAutoDecisions(userId),
        this.getMemoryInsights(userId),
      ]);

      return {
        preferences,
        patterns,
        memory,
        ranking: ranking as any,
        recentAutoDecisions: recentDecisions as any,
        insights: insight,
      };
    } catch (error) {
      this.logger.error('Failed to fetch memory summary', (error as any).message);
      throw error;
    }
  }

  /**
   * Get user memory object
   */
  async getUserMemory(userId: number): Promise<UserMemoryDto> {
    const memory = await this.prisma.userMemory.findUnique({
      where: { userId },
    });

    if (!memory) {
      return await this.initializeUserMemory(userId);
    }

    return this.mapMemoryToDto(memory);
  }

  /**
   * Get memory insights and AI analysis
   */
  async getMemoryInsights(userId: number): Promise<MemoryInsightDto> {
    this.logger.log(`Generating insights for user ${userId}`);

    try {
      const preferences = await this.getUserPreferences(userId);
      const patterns = await this.analyzeBuyingPatterns(userId);

      // Check if existing insights exist and not expired
      const existing = await this.prisma.memoryInsight.findUnique({
        where: { userPreferencesId: preferences.id },
      });

      if (existing && new Date(existing.expiresAt) > new Date()) {
        return this.mapInsightToDto(existing);
      }

      // Generate new insights
      const insights = await this.generateInsights(preferences, patterns, userId);

      return insights;
    } catch (error) {
      this.logger.error('Failed to get insights', (error as any).message);
      throw error;
    }
  }

  /**
   * Get ranking personalization weights
   */
  async getRankingPersonalization(userId: number): Promise<Record<string, any>> {
    const cacheKey = `ranking_weights:${userId}`;

    const cached = await this.redis.get<string>(cacheKey);
    if (cached) return JSON.parse(cached);

    let ranking = await this.prisma.rankingPersonalization.findUnique({
      where: { userId },
    });

    if (!ranking) {
      ranking = await this.prisma.rankingPersonalization.create({
        data: {
          userId,
          categoryWeights: this.getDefaultCategoryWeights(),
        },
      });
    }

    const dto = {
      priceWeight: ranking.priceWeight,
      qualityWeight: ranking.qualityWeight,
      brandWeight: ranking.brandWeight,
      deliveryWeight: ranking.deliveryWeight,
      categoryWeights: ranking.categoryWeights,
      brandWeights: ranking.brandWeights,
      newProductBoost: ranking.newProductBoost,
      version: ranking.version,
      confidenceScore: ranking.confidenceScore,
    };

    await this.redis.set(cacheKey, JSON.stringify(dto), { ttl: this.MEMORY_CACHE_TTL });

    return dto;
  }

  /**
   * Get personalization boosts for ranking
   */
  async getPersonalizationBoosts(userId: number): Promise<PersonalizationBoostsDto> {
    const preferences = await this.getUserPreferences(userId);
    const patterns = await this.analyzeBuyingPatterns(userId);

    const categories: Record<string, number> = {};
    const brands: Record<string, number> = {};

    // Build category boosts from preferences and patterns
    if ((patterns as any).categoryPurchaseFreq) {
      for (const [cat, freq] of Object.entries(
        (patterns as any).categoryPurchaseFreq as Record<string, number>
      )) {
        categories[cat] = freq / (patterns.avgPurchasesPerMonth || 1);
      }
    }

    // Apply preference weights
    if (preferences.preferredCategories?.length) {
      preferences.preferredCategories.forEach((cat) => {
        categories[cat] = (categories[cat] || 0) + 0.2;
      });
    }

    // Apply brand preferences as weight
    if (preferences.preferredBrands?.length) {
      preferences.preferredBrands.forEach((brand) => {
        brands[brand] = 0.15;
      });
    }

    // Seasonal factors
    const seasonalFactors = this.calculateSeasonalFactors(patterns);

    return {
      categories: categories,
      brands: brands,
      products: {}, // Will be populated on demand
      seasonalFactors,
    };
  }

  /**
   * Update memory with new information
   */
  private async updateUserMemory(userId: number, updateType: string, data: any): Promise<void> {
    try {
      const memory = await this.prisma.userMemory.findUnique({
        where: { userId },
      });

      if (!memory) return;

      // Add to history
      const history = memory.preferencesHistory || [];
      history.push({
        [updateType]: data,
        timestamp: new Date().toISOString(),
      } as any);

      // Keep only last 12 snapshots
      if (history.length > 12) {
        history.shift();
      }

      await this.prisma.userMemory.update({
        where: { userId },
        data: {
          preferencesHistory: history,
          updateCount: { increment: 1 },
          lastAccessed: new Date(),
        },
      });

      // Invalidate cache
      await this.redis.delete(`memory:${userId}`);
    } catch (error) {
      this.logger.warn(`Failed to update memory: ${(error as any).message}`);
    }
  }

  /**
   * Get recent auto-decisions
   */
  async getRecentAutoDecisions(userId: number, limit: number = 10) {
    return await this.prisma.autoDecisionLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Record auto-decision
   */
  async recordAutoDecision(userId: number, decision: any): Promise<void> {
    await this.prisma.autoDecisionLog.create({
      data: {
        userId,
        ...decision,
      },
    });

    await this.kafka.emit('auto.decision.recorded', {
      userId,
      decision,
      timestamp: new Date(),
    });
  }

  /**
   * Provide feedback on auto-decisions
   */
  async recordAutoDecisionFeedback(
    userId: number,
    decisionId: number,
    accepted: boolean,
    satisfied?: boolean
  ): Promise<void> {
    await this.prisma.autoDecisionLog.update({
      where: { id: decisionId },
      data: {
        successful: accepted,
      },
    });

    // Update memory success rate
    await this.updateAutoDecisionSuccessRate(userId);

    await this.kafka.emit('auto.decision.feedback', {
      userId,
      decisionId,
      accepted,
      satisfied,
      timestamp: new Date(),
    });
  }

  /**
   * ==================== Helper Methods ====================
   */

  private extractBuyingPatterns(orders: any[]): Record<string, any> {
    const categories: Record<string, number> = {};
    const brands: Record<string, number> = {};
    const dates: Date[] = [];

    orders.forEach((order) => {
      order.items.forEach((item: any) => {
        categories[item.product.category] = (categories[item.product.category] || 0) + 1;

        if (item.product.brand) {
          brands[item.product.brand] = (brands[item.product.brand] || 0) + 1;
        }
      });
      dates.push(new Date(order.createdAt));
    });

    // Calculate metrics
    const avgPurchasesPerMonth = orders.length / (365 / 12);
    const purchaseGap =
      dates.length > 1
        ? Math.floor(
            (dates[0].getTime() - dates[dates.length - 1].getTime()) /
              (1000 * 3600 * 24) /
              (dates.length - 1)
          )
        : 0;
    const totalSpent = orders.reduce((sum, o) => sum + o.total, 0);
    const avgOrderValue = totalSpent / orders.length;

    return {
      avgPurchasesPerMonth: Math.round(avgPurchasesPerMonth * 100) / 100,
      purchaseGap,
      averageOrderValue: Math.round(avgOrderValue * 100) / 100,
      topCategories: Object.entries(categories)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 5)
        .map(([cat]) => cat),
      categoryPurchaseFreq: categories,
      topBrands: Object.entries(brands)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 5)
        .map(([brand]) => brand),
      categoryVariety:
        Object.keys(categories).length > 10 ? 1 : Object.keys(categories).length / 10,
    };
  }

  private async generateInsights(
    preferences: PreferencesDto,
    patterns: BuyingPatternDto,
    userId: number
  ): Promise<MemoryInsightDto> {
    // Create insights based on patterns and preferences
    const insights = await this.prisma.memoryInsight.create({
      data: {
        userPreferencesId: preferences.id,
        userMemoryId: (await this.getUserMemory(userId)).id,
        topInsights: this.generateTopInsights(preferences, patterns),
        recommendedCategories: patterns.topCategories || [],
        likelyhoodToConvert: this.calculateConversionLikelihood(patterns),
        purchaseProbability: this.calculatePurchaseProbability(patterns),
        churnRisk: this.calculateChurnRisk(patterns),
        autoDecisionConfidence: 0.65,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    });

    return this.mapInsightToDto(insights);
  }

  private generateTopInsights(preferences: PreferencesDto, patterns: BuyingPatternDto): string[] {
    const insights: string[] = [];

    if (preferences.preferredCategories?.length) {
      insights.push(`Prefers ${preferences.preferredCategories.slice(0, 2).join(', ')} categories`);
    }

    if (patterns.spendingTrend === 'increasing') {
      insights.push('Spending trend is increasing');
    }

    if (patterns.repeatBrandPurchaseRate > 0.7) {
      insights.push('High brand loyalty - repeats purchases');
    }

    if (patterns.avgPurchasesPerMonth > 2) {
      insights.push('Frequent shopper - buys multiple times per month');
    }

    return insights.slice(0, 5);
  }

  private calculateConversionLikelihood(patterns: BuyingPatternDto): number {
    let score = 0.5;

    if (patterns.clickThroughRate > 0.3) score += 0.2;
    if (patterns.cartAbandonmentRate < 0.5) score += 0.15;
    if (patterns.avgPurchasesPerMonth > 2) score += 0.15;

    return Math.min(score, 1);
  }

  private calculatePurchaseProbability(patterns: BuyingPatternDto): number {
    return Math.min(
      0.5 + patterns.repeatBrandPurchaseRate * 0.3 + (patterns.avgPurchasesPerMonth / 10) * 0.2,
      1
    );
  }

  private calculateChurnRisk(patterns: BuyingPatternDto): number {
    let risk = 0.2;

    if (patterns.spendingTrend === 'decreasing') risk += 0.3;
    if (patterns.avgPurchasesPerMonth < 0.5) risk += 0.2;
    if (patterns.categoryVariety < 0.2) risk += 0.1;

    return Math.min(risk, 1);
  }

  private calculateSeasonalFactors(patterns: BuyingPatternDto): Record<string, number> {
    return {
      summer: patterns.seasonalBuyingLow === 'summer' ? 0.7 : 1.0,
      monsoon: 0.9,
      winter: patterns.seasonalBuyingPeak === 'winter' ? 1.3 : 1.0,
      diwali: 1.4,
      newyear: 1.2,
    };
  }

  private getDefaultCategoryWeights(): Record<string, number> {
    return {
      electronics: 1.0,
      fashion: 1.0,
      books: 0.8,
      home: 0.9,
      sports: 0.7,
    };
  }

  private async updateAutoDecisionSuccessRate(userId: number): Promise<void> {
    const decisions = await this.prisma.autoDecisionLog.findMany({
      where: { userId },
    });

    if (decisions.length === 0) return;

    const successful = decisions.filter((d) => d.successful === true).length;
    const successRate = (successful / decisions.length) * 100;

    await this.prisma.userMemory.update({
      where: { userId },
      data: { autoDecisionSuccessRate: successRate / 100 },
    });
  }

  // ==================== Mapping Methods ====================

  private mapPreferencesToDto(preferences: any): PreferencesDto {
    return {
      id: preferences.id,
      userId: preferences.userId,
      preferredCategories: preferences.preferredCategories || [],
      avoidedCategories: preferences.avoidedCategories || [],
      priceMin: preferences.priceMin,
      priceMax: preferences.priceMax,
      pricePreference: preferences.pricePreference,
      preferredBrands: preferences.preferredBrands || [],
      avoidedBrands: preferences.avoidedBrands || [],
      minQualityRating: preferences.minQualityRating,
      preferredShipping: preferences.preferredShipping,
      maxDeliveryDays: preferences.maxDeliveryDays,
      autoDecisionsEnabled: preferences.autoDecisionsEnabled,
      autoAddToCart: preferences.autoAddToCart,
      autoPurchaseEnabled: preferences.autoPurchaseEnabled,
      discountSensitivity: preferences.discountSensitivity,
      lastUpdated: preferences.lastUpdated,
      createdAt: preferences.createdAt,
      updatedAt: preferences.updatedAt,
    };
  }

  private mapPatternToDto(pattern: any): BuyingPatternDto {
    return {
      id: pattern.id,
      userId: pattern.userId,
      avgPurchasesPerMonth: pattern.avgPurchasesPerMonth,
      seasonalBuyingPeak: pattern.seasonalBuyingPeak,
      seasonalBuyingLow: pattern.seasonalBuyingLow,
      dayOfWeekPreference: pattern.dayOfWeekPreference,
      timeOfDayPreference: pattern.timeOfDayPreference,
      topCategories: pattern.topCategories || [],
      categoryVariety: pattern.categoryVariety,
      actualSpendPerPurchase: pattern.actualSpendPerPurchase,
      avgDiscount: pattern.avgDiscount,
      purchaseGap: pattern.purchaseGap,
      averageOrderValue: pattern.averageOrderValue,
      clickThroughRate: pattern.clickThroughRate,
      cartAbandonmentRate: pattern.cartAbandonmentRate,
      spendingTrend: pattern.spendingTrend,
      repeatBrandPurchaseRate: pattern.repeatBrandPurchaseRate,
      preferredDevice: pattern.preferredDevice,
      preferredPlatform: pattern.preferredPlatform,
      nextLikelyPurchaseCategory: pattern.nextLikelyPurchaseCategory,
      daysUntilNextPurchase: pattern.daysUntilNextPurchase,
      lastAnalyzed: pattern.lastAnalyzed,
    };
  }

  private mapMemoryToDto(memory: any): UserMemoryDto {
    return {
      id: memory.id,
      userId: memory.userId,
      currentPreferences: memory.currentPreferences || {},
      currentPatterns: memory.currentPatterns || {},
      preferencesHistory: memory.preferencesHistory || [],
      behaviorHistory: memory.behaviorHistory || [],
      lastRecommendations: memory.lastRecommendations,
      lastSearchQueries: memory.lastSearchQueries || [],
      viewedProducts: memory.viewedProducts || [],
      wishlistItems: memory.wishlistItems || [],
      reviewedProducts: memory.reviewedProducts || [],
      autoDecisionHistory: memory.autoDecisionHistory || [],
      autoDecisionSuccessRate: memory.autoDecisionSuccessRate,
      memoryAge: memory.memoryAge,
      updateCount: memory.updateCount,
      accuracy: memory.accuracy,
      lastAccessed: memory.lastAccessed,
      createdAt: memory.createdAt,
      updatedAt: memory.updatedAt,
    };
  }

  private mapInsightToDto(insight: any): MemoryInsightDto {
    return {
      id: insight.id,
      userId: insight.userPreferencesId, // Will need to join to get actual userId
      topInsights: insight.topInsights || [],
      recommendedCategories: insight.recommendedCategories || [],
      recommendedBrands: insight.recommendedBrands || [],
      likelyhoodToConvert: insight.likelyhoodToConvert,
      purchaseProbability: insight.purchaseProbability,
      churnRisk: insight.churnRisk,
      autoDecisionConfidence: insight.autoDecisionConfidence,
      emergingInterests: insight.emergingInterests || [],
      fadingInterests: insight.fadingInterests || [],
      topProductRecommendations: insight.topProductRecommendations || [],
      personalizationLevel: insight.personalizationLevel,
      conversionLift: insight.conversionLift,
      avgOrderValueLift: insight.avgOrderValueLift,
      engagementIncrease: insight.engagementIncrease,
      predictionAccuracy: insight.predictionAccuracy,
      analysisDate: insight.analysisDate,
    };
  }
}
