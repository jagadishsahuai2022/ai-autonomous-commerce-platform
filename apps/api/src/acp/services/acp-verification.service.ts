/**
 * ACP Verification Layer
 * Part 6: Mandatory verification before checkout
 * Validates budget, availability, seller trust, delivery constraints
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  VerificationResult,
  CheckoutRequest,
  UserConstraints,
  ProductOption,
} from '../schemas/acp.types';
import { DecisionGuardrailEngine } from '../../common/services/decision-guardrail-engine.service';

@Injectable()
export class ACPVerificationService {
  private readonly logger = new Logger(ACPVerificationService.name);

  constructor(private guardrails: DecisionGuardrailEngine) {}

  /**
   * Comprehensive verification before checkout
   */
  async verifyCheckoutReadiness(
    request: CheckoutRequest,
    selectedProducts: ProductOption[]
  ): Promise<VerificationResult> {
    const timestamp = new Date();
    const blockingReasons: string[] = [];
    const warnings: string[] = [];

    try {
      // Step 1: Budget compliance
      const budgetCheck = await this.verifyBudgetCompliance(request.constraints, selectedProducts);

      if (!budgetCheck.passed) {
        blockingReasons.push(budgetCheck.message);
      } else if (budgetCheck.message) {
        warnings.push(budgetCheck.message);
      }

      // Step 2: Product availability
      const availabilityCheck = this.verifyProductAvailability(selectedProducts);

      if (!availabilityCheck.passed) {
        blockingReasons.push(availabilityCheck.message);
      } else if (availabilityCheck.message) {
        warnings.push(availabilityCheck.message);
      }

      // Step 3: Seller trust scores
      const sellerCheck = this.verifySellerTrust(selectedProducts, request.constraints);

      if (!sellerCheck.passed) {
        blockingReasons.push(sellerCheck.message);
      } else if (sellerCheck.riskFlags instanceof Array && sellerCheck.riskFlags.length > 0) {
        warnings.push(...sellerCheck.riskFlags);
      }

      // Step 4: Delivery constraints
      const deliveryCheck = this.verifyDeliveryConstraints(selectedProducts, request.constraints);

      if (!deliveryCheck.passed) {
        blockingReasons.push(deliveryCheck.message);
      } else if (deliveryCheck.message) {
        warnings.push(deliveryCheck.message);
      }

      return {
        passed: blockingReasons.length === 0,
        checks: {
          budgetCompliance: budgetCheck,
          productAvailability: availabilityCheck,
          sellerTrust: sellerCheck,
          deliveryConstraints: deliveryCheck,
        },
        blockingReasons,
        warnings,
        timestamp,
      };
    } catch (error) {
      this.logger.error(`Verification failed: ${error}`);
      return {
        passed: false,
        checks: {
          budgetCompliance: {
            passed: false,
            message: 'Budget verification error',
            allocatedBudget: 0,
            proposedSpend: 0,
          },
          productAvailability: {
            passed: false,
            message: 'Availability verification error',
            unavailableItems: [],
          },
          sellerTrust: {
            passed: false,
            message: 'Seller verification error',
            trustScores: {},
            riskFlags: [],
          },
          deliveryConstraints: {
            passed: false,
            message: 'Delivery verification error',
            deliveryDays: 0,
            acceptableDays: 0,
          },
        },
        blockingReasons: ['System verification error'],
        warnings: [],
        timestamp,
      };
    }
  }

  /**
   * Verify budget compliance
   */
  private async verifyBudgetCompliance(
    constraints: UserConstraints,
    products: ProductOption[]
  ): Promise<{
    passed: boolean;
    message: string;
    allocatedBudget: number;
    proposedSpend: number;
  }> {
    // Calculate total spend
    const proposedSpend = products.reduce((sum, p) => sum + p.price, 0);
    const allocatedBudget = constraints.maxBudget;

    // Check hard limit
    if (proposedSpend > allocatedBudget) {
      return {
        passed: false,
        message: `Total cost (₹${proposedSpend}) exceeds budget (₹${allocatedBudget})`,
        allocatedBudget,
        proposedSpend,
      };
    }

    // Check acceptable buffer (80-95%)
    const utilizationRatio = proposedSpend / allocatedBudget;

    if (utilizationRatio < 0.6) {
      return {
        passed: true,
        message: `Budget utilization low (${(utilizationRatio * 100).toFixed(0)}%). Consider premium options.`,
        allocatedBudget,
        proposedSpend,
      };
    }

    if (utilizationRatio > 0.95) {
      return {
        passed: true,
        message: `Approaching budget limit (${(utilizationRatio * 100).toFixed(0)}%). Limited flexibility for changes.`,
        allocatedBudget,
        proposedSpend,
      };
    }

    return {
      passed: true,
      message: `Budget allocation optimal (${(utilizationRatio * 100).toFixed(0)}%)`,
      allocatedBudget,
      proposedSpend,
    };
  }

  /**
   * Verify product availability
   */
  private verifyProductAvailability(products: ProductOption[]): {
    passed: boolean;
    message: string;
    unavailableItems: string[];
  } {
    const unavailable = products.filter((p) => p.availability === 'out_of_stock');

    if (unavailable.length > 0) {
      return {
        passed: false,
        message: `${unavailable.length} item(s) unavailable for purchase`,
        unavailableItems: unavailable.map((p) => p.productId),
      };
    }

    const lowStock = products.filter((p) => p.availability === 'low_stock');

    if (lowStock.length > 0) {
      return {
        passed: true,
        message: `${lowStock.length} item(s) have limited stock`,
        unavailableItems: [],
      };
    }

    return {
      passed: true,
      message: 'All items available in stock',
      unavailableItems: [],
    };
  }

  /**
   * Verify seller trust scores
   */
  private verifySellerTrust(
    products: ProductOption[],
    constraints: UserConstraints
  ): {
    passed: boolean;
    message: string;
    trustScores: Record<string, number>;
    riskFlags: string[];
  } {
    const trustScores: Record<string, number> = {};
    const riskFlags: string[] = [];
    const minTrustThreshold = 60;

    products.forEach((p) => {
      trustScores[p.seller.sellerId] = p.ratings.trustScore;

      if (p.ratings.trustScore < minTrustThreshold) {
        riskFlags.push(`Seller "${p.seller.name}" has low trust score (${p.ratings.trustScore}%)`);
      }

      if (constraints.excludedSellers?.includes(p.seller.sellerId)) {
        riskFlags.push(`Product from excluded seller: ${p.seller.name}`);
      }
    });

    const lowTrustSellers = Object.entries(trustScores).filter(
      ([_, score]) => score < minTrustThreshold
    );

    if (lowTrustSellers.length > 0) {
      return {
        passed: false,
        message: `${lowTrustSellers.length} products from low-trust sellers`,
        trustScores,
        riskFlags,
      };
    }

    return {
      passed: true,
      message: 'All sellers meet trust requirements',
      trustScores,
      riskFlags,
    };
  }

  /**
   * Verify delivery constraints
   */
  private verifyDeliveryConstraints(
    products: ProductOption[],
    constraints: UserConstraints
  ): {
    passed: boolean;
    message: string;
    deliveryDays: number;
    acceptableDays: number;
  } {
    // Get maximum delivery days (worst case)
    const maxDeliveryDays = Math.max(...products.map((p) => p.deliveryEstimate.maxDays));
    const acceptableDays = constraints.acceptableDeliveryDays;

    if (maxDeliveryDays > acceptableDays) {
      return {
        passed: false,
        message: `Delivery time (${maxDeliveryDays} days) exceeds constraint (${acceptableDays} days)`,
        deliveryDays: maxDeliveryDays,
        acceptableDays,
      };
    }

    if (maxDeliveryDays === acceptableDays) {
      return {
        passed: true,
        message: `Delivery within acceptable window (${maxDeliveryDays} days)`,
        deliveryDays: maxDeliveryDays,
        acceptableDays,
      };
    }

    return {
      passed: true,
      message: `Delivery faster than required (${maxDeliveryDays}/${acceptableDays} days)`,
      deliveryDays: maxDeliveryDays,
      acceptableDays,
    };
  }

  /**
   * Get verification summary for display
   */
  getVerificationSummary(result: VerificationResult): string {
    if (result.passed) {
      return 'All checks passed. Ready for checkout.';
    }

    const summary = [
      'Verification issues found:',
      ...result.blockingReasons,
      ...(result.warnings.length > 0 ? ['Warnings:', ...result.warnings] : []),
    ];

    return summary.join('\n');
  }
}
