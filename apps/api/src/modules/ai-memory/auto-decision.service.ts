/**
 * Auto-Decision Service - Make intelligent automatic decisions
 * Adds products to cart, makes recommendations, enables auto-purchases
 */

import { Injectable } from '@nestjs/common';
import { MemoryService } from './memory.service';
import { RankingService } from './ranking.service';
import { PrismaService } from '../../services/prisma.service';
import { KafkaService } from '../../kafka/kafka.service';
import { LoggerService } from '../../common/logger.service';

@Injectable()
export class AutoDecisionService {
  private readonly logger = new LoggerService();

  constructor(
    private memoryService: MemoryService,
    private rankingService: RankingService,
    private prisma: PrismaService,
    private kafka: KafkaService
  ) {}

  /**
   * Check if auto-decisions are enabled for user and return confidence
   */
  async isAutoDecisionEnabled(userId: number): Promise<{
    enabled: boolean;
    confidence: number;
  }> {
    const preferences = await this.memoryService.getUserPreferences(userId);
    const insights = await this.memoryService.getMemoryInsights(userId);

    return {
      enabled: preferences.autoDecisionsEnabled,
      confidence: insights.autoDecisionConfidence,
    };
  }

  /**
   * Auto-add product to cart if conditions are met
   */
  async autoAddToCart(userId: number, productId: string): Promise<boolean> {
    this.logger.log(`Attempting auto-add to cart for user ${userId}, product ${productId}`);

    try {
      const prefs = await this.memoryService.getUserPreferences(userId);

      if (!prefs.autoAddToCart) {
        return false; // Feature not enabled
      }

      const insights = await this.memoryService.getMemoryInsights(userId);

      // Only auto-add if high confidence and user has history  of accepting recommendations
      if (
        insights.autoDecisionConfidence < 0.7 ||
        insights.topProductRecommendations.indexOf(productId) === -1
      ) {
        return false;
      }

      // Get product
      const product = await this.prisma.product.findUnique({
        where: { id: parseInt(productId) },
      });

      if (!product) return false;

      // Get or create cart
      let cart = await this.prisma.cart.findFirst({
        where: { userId },
      });

      if (!cart) {
        cart = await this.prisma.cart.create({
          data: { userId },
        });
      }

      // Add to cart
      await this.prisma.cartItem.upsert({
        where: {
          cartId_productId: {
            cartId: cart.id,
            productId: product.id,
          },
        },
        create: {
          cartId: cart.id,
          productId: product.id,
          quantity: 1,
        },
        update: {
          quantity: { increment: 1 },
        },
      });

      // Record decision
      await this.memoryService.recordAutoDecision(userId, {
        decisionType: 'product_added_to_cart',
        confidence: insights.autoDecisionConfidence,
        productId,
        triggerEvent: 'auto_add',
      });

      // Emit event
      await this.kafka.emit('auto.decision.cart_add', {
        userId,
        productId,
        confidence: insights.autoDecisionConfidence,
        timestamp: new Date(),
      });

      this.logger.log(`Successfully auto-added product ${productId} to cart for user ${userId}`);
      return true;
    } catch (error) {
      this.logger.error(`Auto-add failed: ${(error as any).message}`);
      return false;
    }
  }

  /**
   * Generate personalized recommendations
   */
  async generateRecommendations(userId: number, limit: number = 10): Promise<any[]> {
    this.logger.log(`Generating recommendations for user ${userId}`);

    try {
      const [insights, boosts, patterns] = await Promise.all([
        this.memoryService.getMemoryInsights(userId),
        this.memoryService.getPersonalizationBoosts(userId),
        this.memoryService.analyzeBuyingPatterns(userId),
      ]);

      // Get products from recommended categories
      const recommended = await this.prisma.product.findMany({
        where: {
          category: {
            in: insights.recommendedCategories,
          },
        },
        take: limit * 2, // Get more, will filter and score
      });

      // Score and filter
      const scored = await this.rankingService.scoreProductsWithMemory(userId, recommended);
      const filtered = await this.rankingService.filterProductsByPreferences(userId, scored);

      // Add product memory boost
      const boosted = await Promise.all(
        filtered.map(async (p) => ({
          ...p,
          memoryBoost: await this.rankingService.getProductMemoryBoost(userId, p.id.toString()),
        }))
      );

      // Sort and take top N
      return boosted.sort((a, b) => b.personalizedScore - a.personalizedScore).slice(0, limit);
    } catch (error) {
      this.logger.error(`Recommendation generation failed: ${(error as any).message}`);
      return [];
    }
  }

  /**
   * Decide whether to auto-purchase a recommended item
   */
  async evaluateAutoPurchase(
    userId: number,
    productId: string,
    price: number
  ): Promise<{
    recommend: boolean;
    confidence: number;
    reason: string;
  }> {
    this.logger.log(`Evaluating auto-purchase for user ${userId}, product ${productId}`);

    try {
      const [prefs, insights, patterns] = await Promise.all([
        this.memoryService.getUserPreferences(userId),
        this.memoryService.getMemoryInsights(userId),
        this.memoryService.analyzeBuyingPatterns(userId),
      ]);

      if (!prefs.autoPurchaseEnabled) {
        return {
          recommend: false,
          confidence: 0,
          reason: 'Auto-purchase not enabled',
        };
      }

      // Check confidence threshold
      if ((prefs as any).autoPurchaseThreshold) {
        if (insights.autoDecisionConfidence < (prefs as any).autoPurchaseThreshold / 100) {
          return {
            recommend: false,
            confidence: insights.autoDecisionConfidence,
            reason: 'Below confidence threshold',
          };
        }
      }

      // Check budget
      if (prefs.priceMax && price > prefs.priceMax) {
        return {
          recommend: false,
          confidence: 0,
          reason: 'Exceeds price preference',
        };
      }

      // Check if in recommended products
      if (!insights.topProductRecommendations.includes(productId)) {
        return {
          recommend: false,
          confidence: 0,
          reason: 'Not in top recommendations',
        };
      }

      // Check user satisfaction with previous auto-decisions
      const recentDecisions = await this.memoryService.getRecentAutoDecisions(userId, 20);
      const satisfactionRate =
        recentDecisions.filter((d) => d.successful === true).length /
        Math.max(recentDecisions.length, 1);

      if (satisfactionRate < 0.5) {
        return {
          recommend: false,
          confidence: insights.autoDecisionConfidence * satisfactionRate,
          reason: 'Low historical satisfaction with auto-purchases',
        };
      }

      // Calculate final confidence
      const finalConfidence =
        insights.autoDecisionConfidence * satisfactionRate * insights.purchaseProbability;

      return {
        recommend: finalConfidence > 0.7,
        confidence: finalConfidence,
        reason: 'Meets all criteria for auto-purchase',
      };
    } catch (error) {
      this.logger.error(`Auto-purchase evaluation failed: ${(error as any).message}`);
      return {
        recommend: false,
        confidence: 0,
        reason: 'Error evaluating auto-purchase',
      };
    }
  }

  /**
   * Get smart product suggestions based on browsing
   */
  async getSmartSuggestions(userId: number, browsedProductIds?: string[]): Promise<any[]> {
    this.logger.log(`Getting smart suggestions for user ${userId}`);

    try {
      // Get complementary products to browsed items
      let complementary: any[] = [];

      if (browsedProductIds?.length) {
        const browsed = await this.prisma.product.findMany({
          where: {
            id: { in: browsedProductIds.map((id) => parseInt(id)) },
          },
        });

        // Find similar products in same category
        const categories = browsed.map((p) => p.category);
        complementary = await this.prisma.product.findMany({
          where: {
            category: { in: [...new Set(categories)] },
            id: { notIn: browsedProductIds.map((id) => parseInt(id)) },
          },
          take: 20,
        });
      }

      // Filter by preferences
      const filtered = await this.rankingService.filterProductsByPreferences(userId, complementary);

      // Score by memory
      const scored = await this.rankingService.scoreProductsWithMemory(userId, filtered);

      return scored.slice(0, 5);
    } catch (error) {
      this.logger.error(`Smart suggestions failed: ${(error as any).message}`);
      return [];
    }
  }

  /**
   * Record user feedback on auto-decision
   */
  async recordFeedback(
    userId: number,
    decisionId: number,
    feedback: {
      accepted: boolean;
      satisfied?: boolean;
      reason?: string;
    }
  ): Promise<void> {
    this.logger.log(`Recording feedback for user ${userId}, decision ${decisionId}`);

    await this.memoryService.recordAutoDecisionFeedback(
      userId,
      decisionId,
      feedback.accepted,
      feedback.satisfied
    );

    // If user rejects too many decisions, lower confidence
    const recentDecisions = await this.memoryService.getRecentAutoDecisions(userId, 10);
    const rejectionRate = recentDecisions.filter((d) => d.successful === false).length / 10;

    if (rejectionRate > 0.5) {
      // Disable auto-decisions if too many rejections
      await this.prisma.userPreferences.update({
        where: { userId },
        data: { autoDecisionsEnabled: false },
      });

      await this.kafka.emit('auto.decisions.disabled', {
        userId,
        reason: 'High rejection rate',
        rejectionRate,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Get personalized deal alerts
   */
  async getDealAlerts(userId: number, limit: number = 5): Promise<any[]> {
    this.logger.log(`Getting deal alerts for user ${userId}`);

    try {
      const [prefs, insights, boosts] = await Promise.all([
        this.memoryService.getUserPreferences(userId),
        this.memoryService.getMemoryInsights(userId),
        this.memoryService.getPersonalizationBoosts(userId),
      ]);

      // Get on-sale products in user's favorite categories
      const deals = await this.prisma.product.findMany({
        where: {
          category: { in: insights.recommendedCategories },
          // Would need product.discount field in real implementation
        },
        take: limit * 2,
      });

      // Filter and score
      const filtered = await this.rankingService.filterProductsByPreferences(userId, deals);

      return filtered.slice(0, limit);
    } catch (error) {
      this.logger.error(`Deal alerts failed: ${(error as any).message}`);
      return [];
    }
  }

  /**
   * ==================== Helper Methods ====================
   */

  async recordInteraction(userId: number, interactionType: string, data: any): Promise<void> {
    const memory = await this.memoryService.getUserMemory(userId);

    if (interactionType === 'product_viewed') {
      const viewedProducts = memory.viewedProducts || [];
      if (!viewedProducts.includes(data.productId)) {
        viewedProducts.unshift(data.productId);
        // Keep only last 50
        if (viewedProducts.length > 50) viewedProducts.pop();
      }
    }
  }
}
