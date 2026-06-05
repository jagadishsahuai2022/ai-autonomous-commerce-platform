/**
 * Ranking Service - Integrates AI Memory into product ranking
 * Personalizes search results based on user preferences and patterns
 */

import { Injectable } from '@nestjs/common';
import { MemoryService } from './memory.service';
import { RedisService } from '../../services/redis.service';
import { LoggerService } from '../../common/logger.service';

@Injectable()
export class RankingService {
  private readonly logger = new LoggerService();

  constructor(
    private memoryService: MemoryService,
    private redis: RedisService
  ) {}

  /**
   * Apply personalization to ranking weights
   * Called before sending products to ranking engine
   */
  async personalizeRankingWeights(userId: number): Promise<any> {
    this.logger.log(`Personalizing ranking weights for user ${userId}`);

    try {
      const cacheKey = `personalized_weights:${userId}`;
      const cached = await this.redis.get<string>(cacheKey);
      if (cached) return JSON.parse(cached);

      const [weights, boosts] = await Promise.all([
        this.memoryService.getRankingPersonalization(userId),
        this.memoryService.getPersonalizationBoosts(userId),
      ]);

      // Apply personalization on top of default weights
      const personalizedWeights = {
        ...weights,
        categoryBoosts: boosts.categories,
        brandBoosts: boosts.brands,
        seasonalBoosts: boosts.seasonalFactors,
      };

      await this.redis.set(cacheKey, JSON.stringify(personalizedWeights), { ttl: 3600 });
      return personalizedWeights;
    } catch (error) {
      this.logger.error('Failed to personalize weights', (error as any).message);
      // Return default weights on error
      return this.getDefaultWeights();
    }
  }

  /**
   * Score products based on user memory
   * Applies personalization multipliers to base ranking
   */
  async scoreProductsWithMemory(userId: number, products: any[]): Promise<any[]> {
    this.logger.log(`Scoring ${products.length} products for user ${userId}`);

    try {
      const [preferences, patterns, boosts] = await Promise.all([
        this.memoryService.getUserPreferences(userId),
        this.memoryService.analyzeBuyingPatterns(userId),
        this.memoryService.getPersonalizationBoosts(userId),
      ]);

      // Score each product
      const scoredProducts = products.map((product) => {
        let score = product.baseScore || 0;

        // Apply category boost
        if (boosts.categories[product.category]) {
          score *= 1 + boosts.categories[product.category] * 0.2;
        }

        // Apply brand boost
        if (product.brand && boosts.brands[product.brand]) {
          score *= 1 + boosts.brands[product.brand] * 0.15;
        }

        // Apply price preference boost
        if (preferences.priceMin && preferences.priceMax) {
          const inRange =
            product.price >= preferences.priceMin && product.price <= preferences.priceMax;
          score *= inRange ? 1.1 : 0.9;
        }

        // Apply quality preference
        if (product.rating < preferences.minQualityRating) {
          score *= 0.5; // Heavily penalize low-quality products
        }

        // Apply seasonal boost
        if (boosts.seasonalFactors[this.getCurrentSeason()]) {
          score *= 1 + boosts.seasonalFactors[this.getCurrentSeason()] * 0.1;
        }

        // Penalize avoided categories/brands
        if (preferences.avoidedCategories?.includes(product.category)) {
          score *= 0.3;
        }

        if (preferences.avoidedBrands?.includes(product.brand)) {
          score *= 0.2;
        }

        return {
          ...product,
          personalizedScore: Math.round(score * 100) / 100,
          memoryBoost: Math.round((score - product.baseScore) * 100) / 100,
        };
      });

      // Sort by personalized score
      return scoredProducts.sort((a, b) => b.personalizedScore - a.personalizedScore);
    } catch (error) {
      this.logger.error('Failed to score products', (error as any).message);
      return products; // Return unmodified on error
    }
  }

  /**
   * Filter products based on user preferences
   * Pre-filter before sending to ranking engine
   */
  async filterProductsByPreferences(userId: number, products: any[]): Promise<any[]> {
    const preferences = await this.memoryService.getUserPreferences(userId);

    return products.filter((product) => {
      // Filter by category
      if (preferences.preferredCategories?.length) {
        if (!preferences.preferredCategories.includes(product.category)) {
          return false;
        }
      }

      if (preferences.avoidedCategories?.includes(product.category)) {
        return false;
      }

      // Filter by price
      if (preferences.priceMin && product.price < preferences.priceMin) {
        return false;
      }
      if (preferences.priceMax && product.price > preferences.priceMax) {
        return false;
      }

      // Filter by brand
      if (preferences.avoidedBrands?.includes(product.brand)) {
        return false;
      }

      // Filter by quality
      if (product.rating < preferences.minQualityRating) {
        return false;
      }

      return true;
    });
  }

  /**
   * Get ranking boost for specific product
   * Used to boost products that perfectly match user profile
   */
  async getProductMemoryBoost(userId: number, productId: string): Promise<number> {
    try {
      const [preferences, patterns] = await Promise.all([
        this.memoryService.getUserPreferences(userId),
        this.memoryService.analyzeBuyingPatterns(userId),
      ]);

      let boost = 0;

      // Check if recently viewed
      const memory = await this.memoryService.getUserMemory(userId);
      if (memory.viewedProducts?.includes(productId)) {
        boost += 0.05; // Slight boost for recently viewed
      }

      // Check if in wishlist
      if (memory.wishlistItems?.includes(productId)) {
        boost += 0.1; // Higher boost for wishlist
      }

      // Check if in purchased products
      if (memory.reviewedProducts?.includes(productId)) {
        boost += 0.2; // Highest boost for repurchase
      }

      return boost;
    } catch (error) {
      this.logger.warn('Failed to get product boost', (error as any).message);
      return 0;
    }
  }

  /**
   * Get ranking weights formatted for external ranking engine
   * (e.g., Python ranking service)
   */
  async getRankingPayload(userId: number): Promise<Record<string, any>> {
    const weights = await this.personalizeRankingWeights(userId);
    const prefs = await this.memoryService.getUserPreferences(userId);
    const patterns = await this.memoryService.analyzeBuyingPatterns(userId);

    return {
      userId,
      weights: {
        price: weights.priceWeight || 0.25,
        quality: weights.qualityWeight || 0.25,
        brand: weights.brandWeight || 0.2,
        delivery: weights.deliveryWeight || 0.15,
        relevance: 0.15,
      },
      preferences: {
        categoryWeights: weights.categoryBoosts,
        brandWeights: weights.brandBoosts,
        priceRange: {
          min: prefs.priceMin,
          max: prefs.priceMax,
        },
        minQuality: prefs.minQualityRating,
        avoidedCategories: prefs.avoidedCategories,
        avoidedBrands: prefs.avoidedBrands,
      },
      patterns: {
        topCategories: patterns.topCategories,
        avgSpend: patterns.averageOrderValue,
        purchaseFrequency: patterns.avgPurchasesPerMonth,
        repetitionRate: patterns.repeatBrandPurchaseRate,
      },
      boosts: weights.categoryBoosts,
    };
  }

  /**
   * ==================== Helper Methods ====================
   */

  private getCurrentSeason(): string {
    const month = new Date().getMonth();
    if (month >= 11 || month === 0) return 'winter'; // Dec-Jan
    if (month >= 2 && month <= 4) return 'summer'; // Mar-May
    if (month >= 5 && month <= 8) return 'monsoon'; // Jun-Sep
    return 'autumn';
  }

  private getDefaultWeights(): Record<string, number> {
    return {
      priceWeight: 0.25,
      qualityWeight: 0.25,
      brandWeight: 0.2,
      deliveryWeight: 0.15,
      relevanceWeight: 0.15,
    };
  }
}
