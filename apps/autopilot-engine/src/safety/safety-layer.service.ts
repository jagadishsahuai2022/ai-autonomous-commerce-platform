/**
 * Safety Layer Service
 * Handles anomaly detection and approval workflows
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class SafetyLayerService {
  private readonly logger = new Logger(SafetyLayerService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Check for spending anomalies
   */
  async checkSpendingAnomaly(
    userId: string,
    proposedAmount: number,
    monthlyLimit: number
  ): Promise<{
    isAnomaly: boolean;
    severity: 'low' | 'medium' | 'high' | 'critical';
    reason: string;
  }> {
    // Get user's spending in current month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const decisions = await this.prisma.autopilotDecision.findMany({
      where: {
        userId,
        status: 'executed',
        timestamp: { gte: startOfMonth },
      },
      include: { analytics: true },
    });

    const currentSpent = decisions.reduce(
      (sum, d) => sum + (Number(d.analytics?.orderValue) || 0),
      0
    );
    const projectedSpend = currentSpent + proposedAmount;
    const percentageOfLimit = (projectedSpend / monthlyLimit) * 100;

    // Determine anomaly level
    if (percentageOfLimit > 150) {
      return {
        isAnomaly: true,
        severity: 'critical',
        reason: `Spending would exceed limit by ${percentageOfLimit - 100}%`,
      };
    } else if (percentageOfLimit > 120) {
      return {
        isAnomaly: true,
        severity: 'high',
        reason: `Spending would reach ${percentageOfLimit}% of monthly limit`,
      };
    } else if (percentageOfLimit > 100) {
      return {
        isAnomaly: true,
        severity: 'medium',
        reason: `Spending would exceed monthly limit`,
      };
    } else if (percentageOfLimit > 85) {
      return {
        isAnomaly: true,
        severity: 'low',
        reason: `Spending approaching limit (${percentageOfLimit}%)`,
      };
    }

    return {
      isAnomaly: false,
      severity: 'low',
      reason: 'No spending anomaly detected',
    };
  }

  /**
   * Check for purchase pattern anomalies
   */
  async checkPurchasePatternAnomaly(userId: string): Promise<{
    isAnomaly: boolean;
    severity: 'low' | 'medium' | 'high';
    reason: string;
  }> {
    // Get recent decisions (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentDecisions = await this.prisma.autopilotDecision.findMany({
      where: {
        userId,
        status: 'executed',
        timestamp: { gte: sevenDaysAgo },
      },
    });

    // Get historical average (last 30 days before the 7-day window)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const historicalDecisions = await this.prisma.autopilotDecision.findMany({
      where: {
        userId,
        status: 'executed',
        timestamp: {
          gte: thirtyDaysAgo,
          lte: sevenDaysAgo,
        },
      },
    });

    const recentCount = recentDecisions.length;
    const historicalAvg = historicalDecisions.length > 0 ? historicalDecisions.length / 4.3 : 0; // 4.3 weeks

    // Check for unusual activity
    if (recentCount > historicalAvg * 2) {
      return {
        isAnomaly: true,
        severity: 'high',
        reason: `Purchase frequency doubled (${recentCount} vs avg ${historicalAvg.toFixed(1)})`,
      };
    } else if (recentCount > historicalAvg * 1.5) {
      return {
        isAnomaly: true,
        severity: 'medium',
        reason: `Purchase frequency increased (${recentCount} vs avg ${historicalAvg.toFixed(1)})`,
      };
    }

    return {
      isAnomaly: false,
      severity: 'low',
      reason: 'No pattern anomaly detected',
    };
  }

  /**
   * Detect potential fraud signals
   */
  async checkFraudSignals(
    userId: string,
    productId: string,
    amount: number
  ): Promise<{
    hasFraudSignals: boolean;
    signals: string[];
    riskScore: number; // 0-100
  }> {
    const signals: string[] = [];
    let riskScore = 0;

    // Check 1: Rapid successive purchases
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    const recentPurchases = await this.prisma.autopilotDecision.findMany({
      where: {
        userId,
        status: 'executed',
        timestamp: { gte: oneHourAgo },
      },
    });

    if (recentPurchases.length > 5) {
      signals.push('Rapid successive purchases detected');
      riskScore += 25;
    }

    // Check 2: Unusually high amount
    const avgOrderValue = await this.getAverageOrderValue(userId);
    if (amount > avgOrderValue * 3) {
      signals.push('Amount significantly higher than average');
      riskScore += 20;
    }

    // Check 3: Same product multiple times (same SKU)
    const sameProdCountToday = await this.prisma.autopilotDecision.findMany({
      where: {
        userId,
        productId,
        status: 'executed',
        timestamp: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    });

    if (sameProdCountToday.length > 2) {
      signals.push('Multiple purchases of same product today');
      riskScore += 20;
    }

    // Check 4: Different location/payment method (requires additional context)
    // This would need IP/payment data from external sources

    return {
      hasFraudSignals: signals.length > 0,
      signals,
      riskScore: Math.min(100, riskScore),
    };
  }

  /**
   * Determine if approval is required
   */
  async shouldRequireApproval(
    userId: string,
    decision: {
      confidence: number;
      riskLevel: 'low' | 'medium' | 'high';
      amount: number;
      monthlyLimit: number;
    },
    userPreferences: {
      approvalRequired: boolean;
      autoApproveThreshold: number;
      minConfidenceThreshold: number;
    }
  ): Promise<{
    requiresApproval: boolean;
    reasons: string[];
  }> {
    const reasons: string[] = [];

    // Check 1: User preference
    if (userPreferences.approvalRequired) {
      reasons.push('User requires approval for all purchases');
    }

    // Check 2: Confidence too low
    if (decision.confidence < userPreferences.autoApproveThreshold) {
      reasons.push(
        `Confidence (${(decision.confidence * 100).toFixed(1)}%) below auto-approve threshold`
      );
    }

    // Check 3: High-risk decision
    if (decision.riskLevel === 'high') {
      reasons.push('High-risk decision detected');
    }

    // Check 4: Spending limit concerns
    const spendingCheck = await this.checkSpendingAnomaly(
      userId,
      decision.amount,
      decision.monthlyLimit
    );
    if (spendingCheck.isAnomaly && spendingCheck.severity !== 'low') {
      reasons.push(`Spending anomaly: ${spendingCheck.reason}`);
    }

    // Check 5: Fraud signals
    if (decision.amount > decision.monthlyLimit / 2) {
      // Only check fraud for high-value transactions
      const fraudCheck = await this.checkFraudSignals(userId, '', decision.amount);
      if (fraudCheck.hasFraudSignals && fraudCheck.riskScore > 30) {
        reasons.push(`Fraud signals detected (risk score: ${fraudCheck.riskScore})`);
      }
    }

    return {
      requiresApproval: reasons.length > 0,
      reasons,
    };
  }

  /**
   * Record anomaly detection
   */
  async recordAnomaly(
    userId: string,
    type: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    description: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      await this.prisma.anomalyDetection.create({
        data: {
          userId,
          detectionType: type,
          severity,
          description,
          metadata: metadata || {},
        },
      });

      this.logger.log(`✓ Anomaly recorded: ${type} (${severity}) for user ${userId}`);
    } catch (error) {
      this.logger.error('Failed to record anomaly', error);
    }
  }

  /**
   * Get user's average order value
   */
  private async getAverageOrderValue(userId: string): Promise<number> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const decisions = await this.prisma.autopilotDecision.findMany({
      where: {
        userId,
        status: 'executed',
        timestamp: { gte: thirtyDaysAgo },
      },
      include: { analytics: true },
    });

    if (decisions.length === 0) return 0;

    const totalSpent = decisions.reduce(
      (sum, d) => sum + (Number(d.analytics?.orderValue) || 0),
      0
    );
    return totalSpent / decisions.length;
  }

  /**
   * Check spending limit status
   */
  async getSpendingStatus(
    userId: string,
    monthlyLimit: number
  ): Promise<{
    currentSpent: number;
    remaining: number;
    percentageUsed: number;
  }> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const decisions = await this.prisma.autopilotDecision.findMany({
      where: {
        userId,
        status: 'executed',
        timestamp: { gte: startOfMonth },
      },
      include: { analytics: true },
    });

    const currentSpent = decisions.reduce(
      (sum, d) => sum + (Number(d.analytics?.orderValue) || 0),
      0
    );

    return {
      currentSpent,
      remaining: Math.max(0, monthlyLimit - currentSpent),
      percentageUsed: (currentSpent / monthlyLimit) * 100,
    };
  }
}
