/**
 * Autopilot Decision Repository
 * Database operations for autopilot decisions and approvals
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AutopilotDecision, ApprovalRequest } from '../../generated/prisma';

@Injectable()
export class AutopilotDecisionRepository {
  private readonly logger = new Logger(AutopilotDecisionRepository.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Create decision record
   */
  async createDecision(data: {
    userId: string;
    ruleId?: string;
    productId: string;
    shouldProceed: boolean;
    confidence: number;
    confidenceFactors: Record<string, number>;
    reasoning: Record<string, any>;
    requiresApproval: boolean;
    riskLevel: 'low' | 'medium' | 'high';
  }): Promise<AutopilotDecision> {
    try {
      const decision = await this.prisma.autopilotDecision.create({
        data: {
          userId: data.userId,
          ruleId: data.ruleId,
          productId: data.productId,
          shouldProceed: data.shouldProceed,
          confidence: new (BigInt as any)(Math.round(data.confidence * 100)),
          confidenceFactors: data.confidenceFactors,
          reasoning: data.reasoning,
          requiresApproval: data.requiresApproval,
          riskLevel: data.riskLevel,
          status: data.requiresApproval ? 'pending' : 'approved',
        },
        include: { approvalRequest: true },
      });

      this.logger.log(`✓ Decision created: ${decision.id}`);
      return decision;
    } catch (error) {
      this.logger.error('Failed to create decision', error);
      throw error;
    }
  }

  /**
   * Find decision by ID
   */
  async findById(decisionId: string): Promise<AutopilotDecision | null> {
    return this.prisma.autopilotDecision.findUnique({
      where: { id: decisionId },
      include: {
        approvalRequest: true,
        rule: true,
        analytics: true,
      },
    });
  }

  /**
   * Find decisions for user
   */
  async findByUserId(
    userId: string,
    skip: number = 0,
    take: number = 20,
    status?: string
  ): Promise<{ decisions: AutopilotDecision[]; total: number }> {
    const [decisions, total] = await Promise.all([
      this.prisma.autopilotDecision.findMany({
        where: {
          userId,
          ...(status && { status }),
        },
        skip,
        take,
        orderBy: { timestamp: 'desc' },
        include: { rule: true, approvalRequest: true },
      }),
      this.prisma.autopilotDecision.count({
        where: {
          userId,
          ...(status && { status }),
        },
      }),
    ]);

    return { decisions, total };
  }

  /**
   * Update decision status
   */
  async updateStatus(
    decisionId: string,
    status: string,
    orderId?: string
  ): Promise<AutopilotDecision> {
    const decision = await this.findById(decisionId);
    if (!decision) {
      throw new NotFoundException(`Decision ${decisionId} not found`);
    }

    return this.prisma.autopilotDecision.update({
      where: { id: decisionId },
      data: {
        status,
        ...(orderId && { orderId }),
        ...(status === 'executed' && { executedAt: new Date() }),
      },
    });
  }

  /**
   * Approve decision
   */
  async approve(decisionId: string, notes?: string): Promise<AutopilotDecision> {
    const decision = await this.findById(decisionId);
    if (!decision) {
      throw new NotFoundException(`Decision ${decisionId} not found`);
    }

    return this.prisma.autopilotDecision.update({
      where: { id: decisionId },
      data: {
        status: 'approved',
        approvedAt: new Date(),
        approvalRequest: {
          update: {
            where: { id: decision.approvalRequestId || '' },
            data: {
              status: 'approved',
              respondedAt: new Date(),
              responseReason: notes,
            },
          },
        },
      },
    });
  }

  /**
   * Reject decision
   */
  async reject(decisionId: string, reason: string): Promise<AutopilotDecision> {
    const decision = await this.findById(decisionId);
    if (!decision) {
      throw new NotFoundException(`Decision ${decisionId} not found`);
    }

    return this.prisma.autopilotDecision.update({
      where: { id: decisionId },
      data: {
        status: 'rejected',
        approvalRequest: {
          update: {
            where: { id: decision.approvalRequestId || '' },
            data: {
              status: 'rejected',
              respondedAt: new Date(),
              responseReason: reason,
            },
          },
        },
      },
    });
  }

  /**
   * Create approval request
   */
  async createApprovalRequest(data: {
    userId: string;
    decisionId: string;
    reason: string;
  }): Promise<ApprovalRequest> {
    try {
      const approval = await this.prisma.approvalRequest.create({
        data: {
          userId: data.userId,
          decisionId: data.decisionId,
          reason: data.reason,
        },
      });

      // Link approval to decision
      await this.prisma.autopilotDecision.update({
        where: { id: data.decisionId },
        data: { approvalRequestId: approval.id },
      });

      this.logger.log(`✓ Approval request created: ${approval.id}`);
      return approval;
    } catch (error) {
      this.logger.error('Failed to create approval request', error);
      throw error;
    }
  }

  /**
   * Get pending approvals for user
   */
  async getPendingApprovals(userId: string): Promise<ApprovalRequest[]> {
    return this.prisma.approvalRequest.findMany({
      where: {
        userId,
        status: 'pending',
      },
      include: { decision: true },
      orderBy: { requestedAt: 'desc' },
    });
  }

  /**
   * Get decision statistics
   */
  async getStatistics(
    userId: string,
    days: number = 30
  ): Promise<{
    totalDecisions: number;
    approvedCount: number;
    rejectedCount: number;
    executedCount: number;
    pendingCount: number;
    avgConfidence: number;
    riskDistribution: Record<string, number>;
    approvalRate: number;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const decisions = await this.prisma.autopilotDecision.findMany({
      where: {
        userId,
        timestamp: { gte: startDate },
      },
    });

    const totalDecisions = decisions.length;
    const approvedCount = decisions.filter(
      (d: AutopilotDecision) => d.status === 'approved'
    ).length;
    const rejectedCount = decisions.filter(
      (d: AutopilotDecision) => d.status === 'rejected'
    ).length;
    const executedCount = decisions.filter(
      (d: AutopilotDecision) => d.status === 'executed'
    ).length;
    const pendingCount = decisions.filter((d: AutopilotDecision) => d.status === 'pending').length;

    const avgConfidence =
      totalDecisions > 0
        ? decisions.reduce((sum: number, d: AutopilotDecision) => sum + Number(d.confidence), 0) /
          totalDecisions /
          100
        : 0;

    const riskDistribution = {
      low: decisions.filter((d: AutopilotDecision) => d.riskLevel === 'low').length,
      medium: decisions.filter((d: AutopilotDecision) => d.riskLevel === 'medium').length,
      high: decisions.filter((d: AutopilotDecision) => d.riskLevel === 'high').length,
    };

    return {
      totalDecisions,
      approvedCount,
      rejectedCount,
      executedCount,
      pendingCount,
      avgConfidence,
      riskDistribution,
      approvalRate: totalDecisions > 0 ? approvedCount / totalDecisions : 0,
    };
  }

  /**
   * Record analytics for decision
   */
  async recordAnalytics(decisionId: string, analytics: Record<string, any>): Promise<void> {
    try {
      await this.prisma.decisionAnalytic.create({
        data: {
          decisionId,
          userId: analytics.userId,
          ruleId: analytics.ruleId,
          productId: analytics.productId,
          priceConfidence: new (BigInt as any)(Math.round(analytics.priceConfidence * 100)),
          qualityConfidence: new (BigInt as any)(Math.round(analytics.qualityConfidence * 100)),
          historyConfidence: new (BigInt as any)(Math.round(analytics.historyConfidence * 100)),
          marketConfidence: new (BigInt as any)(Math.round(analytics.marketConfidence * 100)),
          rankingConfidence: new (BigInt as any)(Math.round(analytics.rankingConfidence * 100)),
          intentConfidence: new (BigInt as any)(Math.round(analytics.intentConfidence * 100)),
          productPrice: new (BigInt as any)(Math.round(analytics.productPrice * 100)),
          productRating: new (BigInt as any)(Math.round(analytics.productRating * 10)),
          productStock: analytics.productStock || 0,
          userTotalPurchases: analytics.userTotalPurchases || 0,
          userReturnRate: new (BigInt as any)(Math.round(analytics.userReturnRate * 100)),
        },
      });

      this.logger.debug(`✓ Analytics recorded for decision ${decisionId}`);
    } catch (error) {
      this.logger.error('Failed to record analytics', error);
      // Don't throw - analytics recording should not block main flow
    }
  }
}
