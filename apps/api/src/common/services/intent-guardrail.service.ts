/*
 * Intent Guardrail Engine
 * Ensures AI recommendations are safe, aligned with budget, and provide real value.
 * Guards against overkill recommendations, overspending, and misaligned suggestions.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../services/prisma.service';
import { MetricsService } from './metrics.service';
import { StructuredLoggerService } from './structured-logger.service';

export interface IntentGuardrailConfig {
  userId: string;
  recommendations: RecommendedProduct[];
  userBudget: number;
  userPreferences: UserPreferenceData;
  correlationId: string;
}

export interface RecommendedProduct {
  productId: string;
  price: number;
  category: string;
  brand: string;
  quality: 'economy' | 'mid' | 'premium';
  explanation: string;
  confidence: number;
  isMustHave: boolean;
}

export interface UserPreferenceData {
  budgetSensitivity: 'high' | 'medium' | 'low'; // How sensitive user is to price
  qualityPreference: 'high' | 'medium' | 'low'; // How much they value quality
  categories: string[];
  brands: string[];
  maxPricePerItem: number;
  averageSpend: number;
  recentPurchaseFrequency: number;
}

export interface GuardrailResult {
  passed: boolean;
  violations: GuardrailViolation[];
  safeRecommendations: RecommendedProduct[];
  flaggedRecommendations: RecommendedProduct[]; // Needs review
  valueScore: number; // 0-100: how well recommendations match budget
  budgetAlignment: number; // 0-100: how well recommendations fit budget
  overkillScore: number; // 0-100: risk of excessive recommendations
  reasoning: string;
  alternatives: RecommendedProduct[];
  requiresApproval: boolean; // True if overkill or high-risk
}

export interface GuardrailViolation {
  type:
    | 'OVERKILL'
    | 'BUDGET_MISMATCH'
    | 'QUALITY_MISMATCH'
    | 'CATEGORY_MISALIGNMENT'
    | 'CONFIDENCE_LOW'
    | 'PRICE_ANOMALY';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  recommendation: string;
  affectedProducts: string[];
}

@Injectable()
export class IntentGuardrailService {
  private logger = new Logger(IntentGuardrailService.name);

  constructor(
    private prisma: PrismaService,
    private metrics: MetricsService,
    private loggerService: StructuredLoggerService
  ) {}

  /**
   * Evaluate AI recommendations against guardrails
   * Ensures safety, budget alignment, and value for money
   */
  async evaluateRecommendations(config: IntentGuardrailConfig): Promise<GuardrailResult> {
    const startTime = Date.now();

    try {
      // 1. Detect overkill patterns
      const overkillViolations = this.detectOverkill(
        config.recommendations,
        config.userBudget,
        config.userPreferences
      );

      // 2. Check budget alignment
      const budgetViolations = this.checkBudgetAlignment(
        config.recommendations,
        config.userBudget,
        config.userPreferences
      );

      // 3. Calculate value-for-money scores
      const valueAnalysis = this.analyzeValueForMoney(
        config.recommendations,
        config.userPreferences
      );

      // 4. Check quality and category alignment
      const alignmentViolations = this.checkAlignmentWithPreferences(
        config.recommendations,
        config.userPreferences
      );

      // 5. Separate safe vs flagged recommendations
      const { safe, flagged } = this.categorizeRecommendations(config.recommendations, [
        ...overkillViolations,
        ...budgetViolations,
        ...alignmentViolations,
      ]);

      // 6. Generate alternatives to flagged items
      const alternatives = await this.generateAlternatives(
        flagged,
        config.userPreferences,
        config.userBudget
      );

      // 7. Determine if approval is needed
      const requiresApproval =
        overkillViolations.some((v) => v.severity === 'critical') || flagged.length > 0;

      const result: GuardrailResult = {
        passed:
          overkillViolations.length === 0 &&
          budgetViolations.length === 0 &&
          alignmentViolations.length === 0,
        violations: [...overkillViolations, ...budgetViolations, ...alignmentViolations],
        safeRecommendations: safe,
        flaggedRecommendations: flagged,
        valueScore: valueAnalysis.overallValueScore,
        budgetAlignment: this.calculateBudgetAlignment(config.recommendations, config.userBudget),
        overkillScore: this.calculateOverkillScore(config.recommendations, config.userBudget),
        reasoning: this.generateReasoning(overkillViolations, budgetViolations),
        alternatives,
        requiresApproval,
      };

      // Log guardrail evaluation
      this.loggerService.logBusinessEvent('guardrail_evaluation_complete', {
        userId: config.userId,
        correlationId: config.correlationId,
        recommendationCount: config.recommendations.length,
        passedGuardrails: result.passed,
        violationCount: result.violations.length,
        valueScore: result.valueScore,
        budgetAlignment: result.budgetAlignment,
        overkillScore: result.overkillScore,
        requiresApproval: result.requiresApproval,
        duration: Date.now() - startTime,
      });

      // Record metrics
      this.metrics.recordGaugeMetric('guardrail_value_score', result.valueScore, {
        userId: config.userId,
      });
      this.metrics.recordGaugeMetric('guardrail_budget_alignment', result.budgetAlignment, {
        userId: config.userId,
      });
      this.metrics.recordGaugeMetric('guardrail_overkill_score', result.overkillScore, {
        userId: config.userId,
      });

      return result;
    } catch (error) {
      this.logger.error(`Guardrail evaluation failed: ${error.message}`, error.stack);
      this.loggerService.logSecurityEvent('guardrail_evaluation_error', {
        userId: config.userId,
        error: error.message,
        correlationId: config.correlationId,
      });
      throw error;
    }
  }

  /**
   * Detect overkill patterns in recommendations
   * Flag excessive quantity, premium items, or luxury recommendations
   */
  private detectOverkill(
    recommendations: RecommendedProduct[],
    userBudget: number,
    preferences: UserPreferenceData
  ): GuardrailViolation[] {
    const violations: GuardrailViolation[] = [];

    // Count items and spending
    const totalSpend = recommendations.reduce((sum, r) => sum + r.price, 0);
    const premiumCount = recommendations.filter((r) => r.quality === 'premium').length;
    const averagePrice = totalSpend / (recommendations.length || 1);

    // Check 1: Excessive total spend relative to budget
    if (totalSpend > userBudget * 1.5) {
      violations.push({
        type: 'OVERKILL',
        severity: 'critical',
        message: `Total spend (₹${totalSpend}) exceeds budget (₹${userBudget}) by 50%+`,
        recommendation: 'Remove premium items or reduce quantity',
        affectedProducts: recommendations
          .filter((r) => r.quality === 'premium')
          .map((r) => r.productId),
      });
    }

    // Check 2: Too many premium items
    if (premiumCount > recommendations.length * 0.3) {
      violations.push({
        type: 'OVERKILL',
        severity: 'high',
        message: `${premiumCount}/${recommendations.length} items are premium (${(
          (premiumCount / recommendations.length) *
          100
        ).toFixed(1)}%) - potential overkill`,
        recommendation: 'Mix in mid-range alternatives for better value',
        affectedProducts: recommendations
          .filter((r) => r.quality === 'premium')
          .map((r) => r.productId),
      });
    }

    // Check 3: Price anomaly - some items way above average
    const priceAnomalies = recommendations.filter((r) => r.price > averagePrice * 2.5);
    if (priceAnomalies.length > 0 && preferences.budgetSensitivity === 'high') {
      violations.push({
        type: 'PRICE_ANOMALY',
        severity: 'medium',
        message: `${priceAnomalies.length} items are 2.5x+ above average price`,
        recommendation: 'Consider more budget-friendly alternatives',
        affectedProducts: priceAnomalies.map((r) => r.productId),
      });
    }

    // Check 4: Low confidence recommendations with high price
    const lowConfidenceExpensive = recommendations.filter(
      (r) => r.confidence < 0.6 && r.price > averagePrice * 1.5
    );
    if (lowConfidenceExpensive.length > 0) {
      violations.push({
        type: 'CONFIDENCE_LOW',
        severity: 'medium',
        message: `${lowConfidenceExpensive.length} expensive items have low confidence (<60%)`,
        recommendation: 'Either trust expensive items or downgrade to alternatives',
        affectedProducts: lowConfidenceExpensive.map((r) => r.productId),
      });
    }

    // Check 5: Non-essential items above budget limit
    const nonEssentialExpensive = recommendations.filter(
      (r) => !r.isMustHave && r.price > preferences.maxPricePerItem && r.quality === 'premium'
    );
    if (nonEssentialExpensive.length > 0) {
      violations.push({
        type: 'OVERKILL',
        severity: 'high',
        message: `${nonEssentialExpensive.length} non-essential items exceed max price per item (₹${preferences.maxPricePerItem})`,
        recommendation: 'Remove or downgrade to essential items only',
        affectedProducts: nonEssentialExpensive.map((r) => r.productId),
      });
    }

    return violations;
  }

  /**
   * Check budget alignment of recommendations
   */
  private checkBudgetAlignment(
    recommendations: RecommendedProduct[],
    userBudget: number,
    preferences: UserPreferenceData
  ): GuardrailViolation[] {
    const violations: GuardrailViolation[] = [];
    const totalSpend = recommendations.reduce((sum, r) => sum + r.price, 0);
    const spendPercentage = (totalSpend / userBudget) * 100;

    // Check if recommendations are under-utilizing budget (strategy: add more value)
    if (spendPercentage < 50 && preferences.budgetSensitivity === 'low') {
      violations.push({
        type: 'BUDGET_MISMATCH',
        severity: 'low',
        message: `Only using ${spendPercentage.toFixed(1)}% of budget - leaving money on the table`,
        recommendation: 'Consider upgrading to premium options or expanding basket',
        affectedProducts: [],
      });
    }

    // Check if exceeding budget (critical issue)
    if (totalSpend > userBudget) {
      violations.push({
        type: 'BUDGET_MISMATCH',
        severity: 'critical',
        message: `Total spend (₹${totalSpend}) exceeds budget (₹${userBudget})`,
        recommendation: 'Remove items or select cheaper alternatives',
        affectedProducts: recommendations
          .sort((a, b) => b.price - a.price)
          .slice(0, 3)
          .map((r) => r.productId),
      });
    }

    return violations;
  }

  /**
   * Calculate value-for-money scores for each recommendation
   */
  private analyzeValueForMoney(
    recommendations: RecommendedProduct[],
    preferences: UserPreferenceData
  ): { overallValueScore: number; perProduct: Record<string, number> } {
    const perProduct: Record<string, number> = {};
    let totalValue = 0;

    recommendations.forEach((product) => {
      let value = 50; // Base value

      // Quality adds value
      const qualityMultiplier = {
        economy: 0.7,
        mid: 1.0,
        premium: 1.4,
      }[product.quality];
      value *= qualityMultiplier;

      // Price efficiency (lower relative price = higher value)
      const priceEfficiency = Math.max(0, 100 - (product.price / 100000) * 100) / 100;
      value += priceEfficiency * 30;

      // Confidence boosts value
      value *= 0.5 + product.confidence * 0.5;

      // Category preference boost
      if (preferences.categories.includes(product.category)) {
        value += 10;
      }

      // Brand preference boost
      if (preferences.brands.includes(product.brand)) {
        value += 8;
      }

      // Must-have items get quality bump
      if (product.isMustHave) {
        value += 15;
      }

      // Cap at 100
      value = Math.min(100, value);
      perProduct[product.productId] = value;
      totalValue += value;
    });

    const overallValueScore = Math.round(totalValue / (recommendations.length || 1));

    return { overallValueScore, perProduct };
  }

  /**
   * Check alignment with user preferences
   */
  private checkAlignmentWithPreferences(
    recommendations: RecommendedProduct[],
    preferences: UserPreferenceData
  ): GuardrailViolation[] {
    const violations: GuardrailViolation[] = [];

    // Check category alignment
    const recommendedCategories = new Set(recommendations.map((r) => r.category));
    const categoryMismatches = Array.from(recommendedCategories).filter(
      (cat) => !preferences.categories.includes(cat)
    );

    if (categoryMismatches.length > 0) {
      violations.push({
        type: 'CATEGORY_MISALIGNMENT',
        severity: 'medium',
        message: `Recommendations include ${categoryMismatches.join(', ')} - not in user preferences`,
        recommendation: 'Review if categories match actual needs',
        affectedProducts: recommendations
          .filter((r) => categoryMismatches.includes(r.category))
          .map((r) => r.productId),
      });
    }

    // Check quality alignment
    const avgQuality = this.calculateAverageQuality(recommendations);
    if (preferences.qualityPreference === 'medium' && avgQuality === 'premium') {
      violations.push({
        type: 'QUALITY_MISMATCH',
        severity: 'low',
        message: 'Skewing toward premium when medium preference stated',
        recommendation: 'Consider mid-range alternatives',
        affectedProducts: recommendations
          .filter((r) => r.quality === 'premium')
          .map((r) => r.productId),
      });
    }

    if (preferences.qualityPreference === 'low' && avgQuality === 'premium') {
      violations.push({
        type: 'QUALITY_MISMATCH',
        severity: 'medium',
        message: 'Recommending premium when budget-conscious preference stated',
        recommendation: 'Stick to economy/mid-range options',
        affectedProducts: recommendations
          .filter((r) => r.quality === 'premium')
          .map((r) => r.productId),
      });
    }

    return violations;
  }

  /**
   * Separate safe recommendations from flagged ones
   */
  private categorizeRecommendations(
    recommendations: RecommendedProduct[],
    violations: GuardrailViolation[]
  ): { safe: RecommendedProduct[]; flagged: RecommendedProduct[] } {
    const flaggedProductIds = new Set<string>();

    violations.forEach((v) => {
      v.affectedProducts.forEach((pid) => flaggedProductIds.add(pid));
    });

    return {
      safe: recommendations.filter((r) => !flaggedProductIds.has(r.productId)),
      flagged: recommendations.filter((r) => flaggedProductIds.has(r.productId)),
    };
  }

  /**
   * Generate safer alternatives to flagged items
   */
  private async generateAlternatives(
    flaggedProducts: RecommendedProduct[],
    preferences: UserPreferenceData,
    budget: number
  ): Promise<RecommendedProduct[]> {
    // In production, this would query the database for alternatives
    // For now, return mock alternatives
    return flaggedProducts.map((product) => ({
      ...product,
      productId: `${product.productId}-alt`,
      price: Math.max(product.price * 0.7, 1000), // 30% cheaper alternative
      quality: product.quality === 'premium' ? 'mid' : 'economy',
      explanation: 'Budget-friendly alternative with similar features',
    }));
  }

  /**
   * Calculate budget alignment score (0-100)
   */
  private calculateBudgetAlignment(
    recommendations: RecommendedProduct[],
    userBudget: number
  ): number {
    const totalSpend = recommendations.reduce((sum, r) => sum + r.price, 0);
    const spendPercentage = (totalSpend / userBudget) * 100;

    // Optimal is 80-95% of budget
    if (spendPercentage >= 80 && spendPercentage <= 95) {
      return 100;
    }
    if (spendPercentage > 95 && spendPercentage <= 105) {
      return 90 - (spendPercentage - 95) * 2;
    }
    if (spendPercentage < 80 && spendPercentage >= 60) {
      return 90 - (80 - spendPercentage) * 2;
    }
    // Penalize heavily if over budget
    if (spendPercentage > 105) {
      return Math.max(0, 70 - (spendPercentage - 105) * 2);
    }
    // Penalize under-utilization significantly
    return Math.max(10, 60 - (80 - spendPercentage));
  }

  /**
   * Calculate overkill score (0-100, higher = more overkill)
   */
  private calculateOverkillScore(
    recommendations: RecommendedProduct[],
    userBudget: number
  ): number {
    const totalSpend = recommendations.reduce((sum, r) => sum + r.price, 0);
    const premiumCount = recommendations.filter((r) => r.quality === 'premium').length;
    const mustHaveCount = recommendations.filter((r) => r.isMustHave).length;
    const nonMustHaveExpensive = recommendations.filter(
      (r) => !r.isMustHave && r.quality === 'premium'
    ).length;

    let overkillScore = 0;

    // Factor 1: Spending over budget
    if (totalSpend > userBudget) {
      overkillScore += Math.min(50, (totalSpend - userBudget) / 1000);
    }

    // Factor 2: Premium items ratio
    const premiumRatio = (premiumCount / recommendations.length) * 100;
    if (premiumRatio > 40) {
      overkillScore += Math.min(30, (premiumRatio - 40) / 2);
    }

    // Factor 3: Non-essential premium items
    if (nonMustHaveExpensive > 0) {
      overkillScore += nonMustHaveExpensive * 5;
    }

    // Factor 4: Low confidence items
    recommendations.forEach((r) => {
      if (r.confidence < 0.6) {
        overkillScore += 5;
      }
    });

    return Math.min(100, overkillScore);
  }

  /**
   * Generate human-readable reasoning
   */
  private generateReasoning(
    overkillViolations: GuardrailViolation[],
    budgetViolations: GuardrailViolation[]
  ): string {
    if (overkillViolations.length === 0 && budgetViolations.length === 0) {
      return 'Recommendations align with budget and preferences. Safe to proceed.';
    }

    const issues: string[] = [];

    const criticalOverkill = overkillViolations.find((v) => v.severity === 'critical');
    if (criticalOverkill) {
      issues.push(`⚠️ ${criticalOverkill.message}`);
    }

    const criticalBudget = budgetViolations.find((v) => v.severity === 'critical');
    if (criticalBudget) {
      issues.push(`⚠️ ${criticalBudget.message}`);
    }

    const mediumIssues = [...overkillViolations, ...budgetViolations].filter(
      (v) => v.severity === 'medium'
    );

    if (mediumIssues.length > 0) {
      issues.push(`⚠️ ${mediumIssues.length} medium-severity issues detected`);
    }

    return issues.join(' | ') + ' | Review alternatives before proceeding with expensive items.';
  }

  /**
   * Calculate average quality level
   */
  private calculateAverageQuality(
    recommendations: RecommendedProduct[]
  ): 'economy' | 'mid' | 'premium' {
    const scores = {
      economy: 1,
      mid: 2,
      premium: 3,
    };

    const avg =
      recommendations.reduce((sum, r) => sum + scores[r.quality], 0) / recommendations.length;

    if (avg < 1.5) return 'economy';
    if (avg < 2.5) return 'mid';
    return 'premium';
  }
}
