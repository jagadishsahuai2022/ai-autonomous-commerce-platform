/**
 * ACP Gateway Service
 * Part 1: Core ACP architecture - translates internal decisions to ACP format
 * Orchestrates agent-to-merchant communication
 */

import { Injectable, Logger } from '@nestjs/common';
import { ACPPaymentTokenService } from './acp-payment-token.service';
import {
  AgentRequest,
  AgentResponse,
  CheckoutRequest,
  CheckoutResponse,
  ProductOption,
  AlternativeOption,
  SearchIntent,
  CheckoutIntent,
  ProductId,
} from '../schemas/acp.types';
import { ObservabilityService } from '../../common/services/observability.service';
import { DecisionGuardrailEngine } from '../../common/services/decision-guardrail-engine.service';

@Injectable()
export class ACPGatewayService {
  private readonly logger = new Logger(ACPGatewayService.name);

  constructor(
    private paymentTokenService: ACPPaymentTokenService,
    private observability: ObservabilityService,
    private guardrails: DecisionGuardrailEngine
  ) {}

  /**
   * Convert internal AI decision to ACP format
   */
  async translateToACP(
    internalDecision: any,
    userId: string,
    correlationId: string
  ): Promise<AgentResponse> {
    const traceContext = this.observability.generateTraceContext();
    const startTime = Date.now();

    try {
      // Step 1: Extract products from internal decision
      const acpOptions = this.convertProductsToACPFormat(internalDecision.products || []);

      // Step 2: Determine selected option (if auto-selected)
      const selectedOption = this.selectRecommendedOption(acpOptions, internalDecision);

      // Step 3: Generate alternatives
      const alternatives = this.generateAlternatives(acpOptions, selectedOption);

      // Step 4: Calculate confidence
      const confidence = this.calculateConfidenceScore(internalDecision);

      // Step 5: Build ACP response
      const response: AgentResponse = {
        responseId: `acp_resp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        requestId: internalDecision.requestId || 'unknown',
        correlationId,
        timestamp: new Date(),
        processingTimeMs: Date.now() - startTime,
        version: '1.0.0',

        options: acpOptions,
        selectedOption,
        alternatives,

        decisionType: internalDecision.autoSelect ? 'auto_selected' : 'recommendation',
        confidenceScore: confidence,
        reasoning: this.generateReasoning(internalDecision, selectedOption),

        explainability: {
          primaryFactors: this.extractPrimaryFactors(internalDecision),
          secondaryFactors: this.extractSecondaryFactors(internalDecision),
          tradeoffs: this.identifyTradeoffs(acpOptions),
        },

        warnings: internalDecision.warnings || [],
        errors: internalDecision.errors || [],

        nextAction: this.determineNextAction(internalDecision),
        requiresUserApproval: this.requiresApproval(internalDecision),
      };

      // Step 6: Log decision
      this.observability.traceDecision(correlationId, {
        correlationId,
        decisionType: 'RECOMMENDATION',
        input: { query: internalDecision.query },
        output: { optionsCount: acpOptions.length, selectedId: selectedOption?.productId },
        confidence,
        latencyMs: response.processingTimeMs,
        status: 'success',
        reasoning: response.reasoning,
      });

      return response;
    } catch (error) {
      this.logger.error(`ACP translation failed: ${error}`);
      throw error;
    }
  }

  /**
   * Convert internal product format to ACP ProductOption
   */
  private convertProductsToACPFormat(products: any[]): ProductOption[] {
    return products.map((p) => ({
      productId: p.id,
      title: p.name,
      price: p.price,
      currency: p.currency || 'INR',
      seller: {
        sellerId: p.sellerId,
        name: p.sellerName,
        trustScore: p.sellerTrustScore || 75,
        responseTime: p.sellerResponseTime,
        returnPolicy: p.returnPolicy,
      },
      availability: p.availability || 'in_stock',
      deliveryEstimate: {
        minDays: p.deliveryMinDays || 1,
        maxDays: p.deliveryMaxDays || 3,
        type: p.deliveryType || 'standard',
      },
      ratings: {
        score: p.rating || 4.0,
        count: p.ratingCount || 100,
        trustScore: p.sellerTrustScore || 75,
      },
      attributes: p.attributes || {},
      image: p.imageUrl,
      relevanceScore: p.relevanceScore || 85,
    }));
  }

  /**
   * Select best recommendation from options
   */
  private selectRecommendedOption(
    options: ProductOption[],
    decision: any
  ): ProductOption | undefined {
    if (!decision.autoSelect || options.length === 0) {
      return undefined;
    }

    // Sort by relevance and trust score
    return options.sort(
      (a, b) =>
        b.relevanceScore * (b.ratings.trustScore / 100) -
        a.relevanceScore * (a.ratings.trustScore / 100)
    )[0];
  }

  /**
   * Generate alternative options
   */
  private generateAlternatives(
    options: ProductOption[],
    selected?: ProductOption
  ): AlternativeOption[] {
    if (options.length <= 1) {
      return [];
    }

    return options
      .filter((o) => !selected || o.productId !== selected.productId)
      .slice(0, 3)
      .map((o) => ({
        productId: o.productId,
        title: o.title,
        price: o.price,
        reason: this.generateAlternativeReason(o, selected),
        improvementFactor: this.calculateImprovement(o, selected),
        relevanceScore: o.relevanceScore,
      }));
  }

  /**
   * Calculate decision confidence score
   */
  private calculateConfidenceScore(decision: any): number {
    // Factors: data quality, consistency, seller trust, availability
    const factors = {
      dataQuality: decision.dataQuality || 0.7,
      sellerTrust: decision.sellerTrust || 0.8,
      availability: decision.availability ? 1.0 : 0.5,
      consistency: decision.consistency || 0.75,
    };

    const weights = {
      dataQuality: 0.25,
      sellerTrust: 0.35,
      availability: 0.25,
      consistency: 0.15,
    };

    const confidence =
      Object.entries(factors).reduce(
        (sum, [key, value]) => sum + value * (weights[key as keyof typeof weights] || 0),
        0
      ) * 100;

    return Math.min(100, Math.max(0, confidence));
  }

  /**
   * Generate human-readable reasoning
   */
  private generateReasoning(decision: any, selected?: ProductOption): string {
    if (!selected) {
      return 'Multiple options found. Please review and select.';
    }

    const parts = [
      `Selected "${selected.title}" based on:`,
      `- Price: ${selected.price} ${selected.currency}`,
      `- Seller trust: ${selected.ratings.trustScore}%`,
      `- Delivery: ${selected.deliveryEstimate.minDays}-${selected.deliveryEstimate.maxDays} days`,
      decision.reasoning || '',
    ];

    return parts.filter((p) => p).join('\n');
  }

  /**
   * Extract primary decision factors
   */
  private extractPrimaryFactors(decision: any): string[] {
    return [
      'Price competitiveness',
      'Seller reliability',
      'Delivery speed',
      'Product availability',
      decision.primaryFactor || 'User preferences',
    ];
  }

  /**
   * Extract secondary factors
   */
  private extractSecondaryFactors(decision: any): string[] {
    return [
      'Return policy',
      'Product reviews',
      'Shipping options',
      'Payment methods',
      decision.secondaryFactor || 'Sustainability',
    ];
  }

  /**
   * Identify tradeoffs
   */
  private identifyTradeoffs(options: ProductOption[]): string[] {
    const tradeoffs = [];

    if (options.length < 2) {
      return tradeoffs;
    }

    const cheapest = options.reduce((a, b) => (a.price < b.price ? a : b));
    const bestRated = options.reduce((a, b) => (a.ratings.score > b.ratings.score ? a : b));
    const fastest = options.reduce((a, b) =>
      a.deliveryEstimate.maxDays < b.deliveryEstimate.maxDays ? a : b
    );

    if (cheapest.productId !== bestRated.productId) {
      tradeoffs.push(
        `Cheapest option (${cheapest.price}) is not the highest-rated (${bestRated.ratings.score}★)`
      );
    }

    if (fastest.productId !== bestRated.productId) {
      tradeoffs.push(
        `Fastest delivery is not from highest-rated seller (${bestRated.ratings.score}★)`
      );
    }

    return tradeoffs;
  }

  /**
   * Generate reason for alternative
   */
  private generateAlternativeReason(option: ProductOption, selected?: ProductOption): string {
    if (!selected) {
      return 'Alternative option';
    }

    if (option.price < selected.price) {
      return `${((1 - option.price / selected.price) * 100).toFixed(0)}% cheaper`;
    }

    if (option.ratings.score > selected.ratings.score) {
      return `Higher rated (${option.ratings.score}★ vs ${selected.ratings.score}★)`;
    }

    if (option.deliveryEstimate.maxDays < selected.deliveryEstimate.maxDays) {
      return `Faster delivery`;
    }

    return 'Better value proposition';
  }

  /**
   * Calculate improvement factor
   */
  private calculateImprovement(option: ProductOption, selected?: ProductOption): string {
    if (!selected) {
      return 'Similar option';
    }

    const priceDiff = ((selected.price - option.price) / selected.price) * 100;
    const ratingDiff = option.ratings.score - selected.ratings.score;

    if (priceDiff > 10) {
      return `${priceDiff.toFixed(0)}% cheaper`;
    }

    if (ratingDiff > 0.5) {
      return `${ratingDiff.toFixed(1)} points higher rating`;
    }

    return 'Comparable option';
  }

  /**
   * Determine next action for client
   */
  private determineNextAction(
    decision: any
  ): 'display_options' | 'confirm_selection' | 'require_input' | 'proceed_to_checkout' {
    if (decision.autoSelect) {
      return 'confirm_selection';
    }

    if (decision.products?.length === 1) {
      return 'confirm_selection';
    }

    if (decision.products?.length === 0) {
      return 'require_input';
    }

    return 'display_options';
  }

  /**
   * Check if user approval required
   */
  private requiresApproval(decision: any): boolean {
    return decision.highValue || decision.lowConfidence || decision.requiresApproval || false;
  }

  /**
   * Transform checkout to ACP format
   */
  async transformCheckoutRequest(
    checkout: any,
    userId: string,
    paymentToken: string
  ): Promise<CheckoutRequest> {
    const correlationId = this.observability.generateTraceContext().correlationId;

    return {
      requestId: checkout.requestId,
      correlationId,
      timestamp: new Date(),
      version: '1.0.0',

      intent: {
        products: (checkout.items || []).map((item: any) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
        deliveryAddress: checkout.deliveryAddress,
        preferredDeliveryDate: checkout.deliveryDate,
      },

      constraints: {
        maxBudget: checkout.maxBudget || 100000,
        preferredDelivery: checkout.deliveryType,
        acceptableDeliveryDays: checkout.acceptableDays || 7,
        paymentMethods: checkout.paymentMethods || ['card', 'wallet'],
      },

      userContext: {
        userId,
        sessionId: checkout.sessionId,
        deviceType: checkout.deviceType || 'web',
        locale: checkout.locale || 'en-IN',
        currency: checkout.currency || 'INR',
        timestamp: new Date(),
      },

      preferences: {
        riskTolerance: 'medium',
        communicationStyle: 'concise',
      },

      paymentToken,
      idempotencyKey: checkout.idempotencyKey,
      acceptTerms: checkout.acceptTerms,
    };
  }
}
