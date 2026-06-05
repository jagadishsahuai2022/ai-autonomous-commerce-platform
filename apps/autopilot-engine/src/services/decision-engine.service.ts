/**
 * Decision Engine Service
 * Evaluates autopilot decisions with confidence scoring
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  AutopilotDecision,
  DecisionContext,
  ConfidenceScore,
  DecisionReasoning,
  ProductData,
  UserPurchaseHistory,
} from '../types';

@Injectable()
export class DecisionEngine {
  private readonly logger = new Logger(DecisionEngine.name);

  /**
   * Make autonomous decision with confidence scoring
   */
  async makeDecision(context: DecisionContext): Promise<AutopilotDecision> {
    this.logger.debug(
      `Evaluating decision for user: ${context.userId}, product: ${context.product.id}`
    );

    const confidence = this.calculateConfidenceScore(context);
    const reasoning = this.generateReasoning(context, confidence);

    const decision: AutopilotDecision = {
      id: this.generateDecisionId(),
      userId: context.userId,
      productId: context.product.id,
      timestamp: new Date(),
      shouldProceed: confidence.overall >= context.minimumConfidenceThreshold,
      confidence,
      reasoning,
      requiresApproval: confidence.overall < 0.8,
      riskLevel: this.calculateRiskLevel(confidence),
      status: confidence.overall < 0.8 ? 'pending' : 'approved',
    };

    this.logger.log(
      `Decision made: ${decision.id} - Proceed: ${decision.shouldProceed} - Confidence: ${confidence.overall.toFixed(2)}`
    );

    return decision;
  }

  /**
   * Calculate comprehensive confidence score
   */
  private calculateConfidenceScore(context: DecisionContext): ConfidenceScore {
    const factors: Record<string, number> = {};

    // Price confidence (0-1)
    factors.priceConfidence = this.scorePriceRelevance(context.product, context.userHistory);

    // Product quality confidence (0-1)
    factors.qualityConfidence = this.scoreProductQuality(context.product);

    // Purchase history confidence (0-1)
    factors.historyConfidence = this.scoreUserHistory(context.userHistory, context.product);

    // Market context confidence (0-1)
    factors.marketConfidence = this.scoreMarketContext(context.marketContext);

    // Ranking confidence (0-1)
    factors.rankingConfidence = context.rankingScore ? context.rankingScore / 100 : 0.5;

    // Intent confidence (0-1)
    factors.intentConfidence = context.intentScore ? context.intentScore / 100 : 0.5;

    // Combine factors with weighted average
    const weights = {
      priceConfidence: 0.2,
      qualityConfidence: 0.2,
      historyConfidence: 0.25,
      marketConfidence: 0.1,
      rankingConfidence: 0.15,
      intentConfidence: 0.1,
    };

    const overall = Object.entries(factors).reduce((sum, [factor, score]) => {
      return sum + score * (weights[factor as keyof typeof weights] || 0);
    }, 0);

    return {
      overall: Math.min(1, Math.max(0, overall)),
      factors,
      breakdown: this.breakdownConfidenceFactors(factors, weights),
    };
  }

  /**
   * Score price relevance
   */
  private scorePriceRelevance(product: ProductData, history: UserPurchaseHistory): number {
    const avgPrice = this.calculateAveragePrice(history);
    const priceDifference = Math.abs(product.price - avgPrice) / avgPrice;

    // Price within 30% of average = high confidence
    if (priceDifference < 0.3) return 0.95;
    if (priceDifference < 0.5) return 0.75;
    if (priceDifference < 1.0) return 0.5;
    return 0.3;
  }

  /**
   * Score product quality
   */
  private scoreProductQuality(product: ProductData): number {
    let score = 0;

    // Rating: 0-1 scale
    if (product.rating) {
      score += (product.rating / 5) * 0.6;
    }

    // Stock confidence
    if (product.stock > 10) score += 0.3;
    else if (product.stock > 0) score += 0.15;

    // Brand confidence (assuming higher ratings = trusted brands)
    if (product.rating >= 4.5) score += 0.1;

    return Math.min(1, score);
  }

  /**
   * Score user purchase history
   */
  private scoreUserHistory(history: UserPurchaseHistory, product: ProductData): number {
    let score = 0.5; // Base confidence

    if (history.totalPurchases === 0) return 0.4; // New user = lower confidence

    // Repeat purchaser bonus
    if (history.totalPurchases > 10) score += 0.15;
    else if (history.totalPurchases > 5) score += 0.1;

    // Category familiarity
    const categoryPurchases = history.purchasesByCategory?.[product.category] || 0;
    if (categoryPurchases > 0) score += (Math.min(categoryPurchases, 5) / 5) * 0.15;

    // Return rate (lower = good)
    if (history.returnRate < 0.05) score += 0.1;
    else if (history.returnRate < 0.15) score += 0.05;

    return Math.min(1, score);
  }

  /**
   * Score market context
   */
  private scoreMarketContext(marketContext?: any): number {
    if (!marketContext) return 0.5; // Default if no market context

    let score = 0.5;

    // Trending products
    if (marketContext.trend === 'rising') score += 0.2;
    else if (marketContext.trend === 'declining') score -= 0.15;

    // Competitor pricing
    if (marketContext.priceRank === 1) score += 0.15;
    else if (marketContext.priceRank <= 3) score += 0.1;

    // Availability (limited stock = urgency)
    if (marketContext.stockLevel === 'low') score += 0.1;

    return Math.min(1, Math.max(0, score));
  }

  /**
   * Calculate risk level based on confidence
   */
  private calculateRiskLevel(confidence: ConfidenceScore): 'low' | 'medium' | 'high' {
    if (confidence.overall >= 0.85) return 'low';
    if (confidence.overall >= 0.65) return 'medium';
    return 'high';
  }

  /**
   * Generate human-readable reasoning
   */
  private generateReasoning(
    context: DecisionContext,
    confidence: ConfidenceScore
  ): DecisionReasoning {
    const reasoning: DecisionReasoning = {
      positiveFactors: [],
      negativeFactors: [],
      summary: '',
    };

    // Analyze each factor
    if (confidence.factors.qualityConfidence > 0.75) {
      reasoning.positiveFactors.push(`High product quality (rating: ${context.product.rating}/5)`);
    } else if (confidence.factors.qualityConfidence < 0.4) {
      reasoning.negativeFactors.push('Low product quality or ratings');
    }

    if (confidence.factors.priceConfidence > 0.8) {
      reasoning.positiveFactors.push('Price aligns with your purchase history');
    } else if (confidence.factors.priceConfidence < 0.5) {
      reasoning.negativeFactors.push('Price significantly differs from typical purchases');
    }

    if (confidence.factors.historyConfidence > 0.75) {
      reasoning.positiveFactors.push('Strong category affinity');
    } else if (confidence.factors.historyConfidence < 0.5) {
      reasoning.negativeFactors.push('Limited purchase history in this category');
    }

    if (context.product.stock <= 3) {
      reasoning.positiveFactors.push('Limited stock - action recommended');
    }

    // Generate summary
    if (confidence.overall >= 0.85) {
      reasoning.summary = 'Excellent match. Safe to proceed automatically.';
    } else if (confidence.overall >= 0.65) {
      reasoning.summary = 'Good match. May need user confirmation.';
    } else {
      reasoning.summary = 'Uncertain match. Recommend user review before purchase.';
    }

    return reasoning;
  }

  /**
   * Break down confidence factors
   */
  private breakdownConfidenceFactors(
    factors: Record<string, number>,
    weights: Record<string, number>
  ): Array<{ factor: string; score: number; weight: number; contribution: number }> {
    return Object.entries(factors).map(([factor, score]) => ({
      factor,
      score: Math.round(score * 100) / 100,
      weight: weights[factor as keyof typeof weights] || 0,
      contribution: Math.round(score * (weights[factor as keyof typeof weights] || 0) * 100) / 100,
    }));
  }

  /**
   * Calculate average purchase price from history
   */
  private calculateAveragePrice(history: UserPurchaseHistory): number {
    if (history.totalPurchases === 0) return 5000; // Default average in INR

    const totalSpent = history.totalSpent || 0;
    return totalSpent / history.totalPurchases;
  }

  /**
   * Generate unique decision ID
   */
  private generateDecisionId(): string {
    return `decision_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Simulate user feedback loop for confidence improvement
   */
  async recordDecisionOutcome(
    decisionId: string,
    approved: boolean,
    completed: boolean
  ): Promise<void> {
    this.logger.log(
      `Decision outcome recorded: ${decisionId} - Approved: ${approved}, Completed: ${completed}`
    );
    // This would update model confidence weights based on outcomes
  }
}
