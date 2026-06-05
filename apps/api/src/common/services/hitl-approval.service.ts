/*
 * Human-in-the-Loop (HITL) Approval System
 * Manages approval workflows for high-value orders and AI-assisted decisions
 * Ensures user can review, understand, and control autonomous decisions
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../services/prisma.service';
import { StructuredLoggerService } from './structured-logger.service';
import { MetricsService } from './metrics.service';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';
export type ApprovalReason =
  | 'high_value'
  | 'low_confidence'
  | 'overkill_detected'
  | 'budget_risk'
  | 'fraud_risk'
  | 'ai_decision'
  | 'seller_trust';

export interface ApprovalRequest {
  id: string;
  userId: string;
  orderId?: string;
  reason: ApprovalReason;
  status: ApprovalStatus;
  orderAmount: number;
  recommendations: ApprovedProductDetail[];
  aiReasoning: AIDecisionExplanation;
  alternatives: ApprovedProductDetail[];
  riskScore: number; // 0-100
  expiresAt: Date;
  createdAt: Date;
  respondedAt?: Date;
  responseReason?: string;
  correlationId: string;
}

export interface ApprovedProductDetail {
  productId: string;
  name: string;
  price: number;
  quality: string;
  sellerId: string;
  sellerRating: number;
  relevanceScore: number;
}

export interface AIDecisionExplanation {
  decision: string; // "Recommended by AI Shopping Assistant"
  confidence: number; // 0-100
  reasoning: string[];
  strengths: string[];
  weaknesses: string[];
  assumption: string; // What the AI believes about user needs
  fallbackOptions: string[];
}

@Injectable()
export class HITLApprovalService {
  private logger = new Logger(HITLApprovalService.name);

  constructor(
    private prisma: PrismaService,
    private logger$: StructuredLoggerService,
    private metrics: MetricsService
  ) {}

  /**
   * Create approval request for high-value or risky orders
   */
  async createApprovalRequest(
    userId: string,
    reason: ApprovalReason,
    orderAmount: number,
    recommendations: ApprovedProductDetail[],
    aiReasoning: AIDecisionExplanation,
    alternatives: ApprovedProductDetail[],
    riskScore: number,
    correlationId: string
  ): Promise<ApprovalRequest> {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24-hour window

    try {
      // Create approval request record
      const approval = await this.prisma.approvalRequest.create({
        data: {
          userId: parseInt(userId, 10),
          reason,
          orderAmount,
          status: 'pending',
          recommendations: JSON.stringify(recommendations),
          aiReasoning: JSON.stringify(aiReasoning),
          alternatives: JSON.stringify(alternatives),
          riskScore,
          expiresAt,
          correlationId,
        },
      });

      // Log approval creation
      this.logger$.logBusinessEvent('approval_request_created', {
        userId,
        reason,
        orderAmount,
        riskScore,
        correlationId,
        expiresAt: expiresAt.toISOString(),
      });

      // Record metric
      this.metrics.recordCounterMetric('approval_requests_created', 1, {
        reason,
        riskLevel: riskScore > 70 ? 'high' : 'medium',
      });

      return this.mapApprovalRecord(approval);
    } catch (error) {
      this.logger.error(`Failed to create approval request: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get pending approvals for user
   */
  async getPendingApprovals(userId: string): Promise<ApprovalRequest[]> {
    const approvals = await this.prisma.approvalRequest.findMany({
      where: {
        userId: parseInt(userId, 10),
        status: 'pending',
        expiresAt: {
          gt: new Date(), // Not expired
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return approvals.map((a) => this.mapApprovalRecord(a));
  }

  /**
   * Approve an order request
   */
  async approveOrder(
    approvalRequestId: string,
    userId: string,
    responseReason?: string,
    correlationId?: string
  ): Promise<ApprovalRequest> {
    try {
      const approval = await this.prisma.approvalRequest.findUnique({
        where: { id: approvalRequestId },
      });

      if (!approval || approval.userId !== parseInt(userId, 10)) {
        throw new Error('Approval request not found or unauthorized');
      }

      if (approval.status !== 'pending') {
        throw new Error(`Cannot approve: current status is ${approval.status}`);
      }

      if (approval.expiresAt < new Date()) {
        throw new Error('Approval request has expired');
      }

      // Update approval
      const updated = await this.prisma.approvalRequest.update({
        where: { id: approvalRequestId },
        data: {
          status: 'approved',
          respondedAt: new Date(),
          responseReason,
        },
      });

      // Log approval
      this.logger$.logBusinessEvent('approval_request_approved', {
        userId,
        approvalId: approvalRequestId,
        orderAmount: approval.orderAmount,
        responseReason,
        correlationId,
      });

      this.metrics.recordCounterMetric('approval_requests_approved', 1, {
        reason: approval.reason,
      });

      return this.mapApprovalRecord(updated);
    } catch (error) {
      this.logger.error(`Failed to approve request: ${error.message}`);
      throw error;
    }
  }

  /**
   * Reject an order request with explanation
   */
  async rejectOrder(
    approvalRequestId: string,
    userId: string,
    reasonForRejection: string,
    correlationId?: string
  ): Promise<ApprovalRequest> {
    try {
      const approval = await this.prisma.approvalRequest.findUnique({
        where: { id: approvalRequestId },
      });

      if (!approval || approval.userId !== parseInt(userId, 10)) {
        throw new Error('Approval request not found or unauthorized');
      }

      if (approval.status !== 'pending') {
        throw new Error(`Cannot reject: current status is ${approval.status}`);
      }

      // Update approval
      const updated = await this.prisma.approvalRequest.update({
        where: { id: approvalRequestId },
        data: {
          status: 'rejected',
          respondedAt: new Date(),
          responseReason: reasonForRejection,
        },
      });

      // Log rejection
      this.logger$.logBusinessEvent('approval_request_rejected', {
        userId,
        approvalId: approvalRequestId,
        orderAmount: approval.orderAmount,
        rejectionReason: reasonForRejection,
        correlationId,
      });

      this.metrics.recordCounterMetric('approval_requests_rejected', 1, {
        reason: approval.reason,
      });

      return this.mapApprovalRecord(updated);
    } catch (error) {
      this.logger.error(`Failed to reject request: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get approval request details
   */
  async getApprovalDetails(
    approvalRequestId: string,
    userId: string
  ): Promise<ApprovalRequest | null> {
    const approval = await this.prisma.approvalRequest.findUnique({
      where: { id: approvalRequestId },
    });

    if (!approval || approval.userId !== parseInt(userId, 10)) {
      return null;
    }

    return this.mapApprovalRecord(approval);
  }

  /**
   * Check if new order requires approval
   */
  async shouldRequireApproval(
    userId: string,
    orderAmount: number,
    riskScore: number,
    reason?: ApprovalReason
  ): Promise<boolean> {
    // High-value orders always need approval
    if (orderAmount > 50000) {
      return true;
    }

    // High-risk orders need approval
    if (riskScore > 70) {
      return true;
    }

    // AI-assisted decisions need approval if over ₹25k
    if (reason === 'ai_decision' && orderAmount > 25000) {
      return true;
    }

    // Check user's approval preference
    const user = await this.prisma.user.findUnique({
      where: { id: parseInt(userId, 10) },
      include: { userPreferences: true },
    });

    if (user?.userPreferences) {
      const prefs = user.userPreferences;
      return (prefs as any).requiresApprovalForAll || false;
    }

    return false;
  }

  /**
   * Auto-expire expired approval requests
   */
  async cleanupExpiredApprovals(): Promise<number> {
    const result = await this.prisma.approvalRequest.updateMany({
      where: {
        status: 'pending',
        expiresAt: {
          lt: new Date(),
        },
      },
      data: {
        status: 'expired',
      },
    });

    if (result.count > 0) {
      this.logger$.logBusinessEvent('approvals_expired', {
        count: result.count,
      });
    }

    return result.count;
  }

  /**
   * Get approval stats for user
   */
  async getApprovalStats(userId: string): Promise<{
    pending: number;
    approved: number;
    rejected: number;
    avgResponseTime: number;
  }> {
    const numericUserId = parseInt(userId, 10);
    const [pending, approved, rejected, allStats] = await Promise.all([
      this.prisma.approvalRequest.count({
        where: { userId: numericUserId, status: 'pending' },
      }),
      this.prisma.approvalRequest.count({
        where: { userId: numericUserId, status: 'approved' },
      }),
      this.prisma.approvalRequest.count({
        where: { userId: numericUserId, status: 'rejected' },
      }),
      this.prisma.approvalRequest.findMany({
        where: {
          userId: numericUserId,
          respondedAt: { not: null },
        },
        select: { createdAt: true, respondedAt: true },
      }),
    ]);

    let avgResponseTime = 0;
    if (allStats.length > 0) {
      const totalTime = allStats.reduce((sum, stat) => {
        return sum + (stat.respondedAt!.getTime() - stat.createdAt.getTime());
      }, 0);
      avgResponseTime = totalTime / allStats.length; // in milliseconds
    }

    return {
      pending,
      approved,
      rejected,
      avgResponseTime: Math.round(avgResponseTime / 1000), // convert to seconds
    };
  }

  /**
   * Map database record to approval request object
   */
  private mapApprovalRecord(record: any): ApprovalRequest {
    return {
      id: record.id,
      userId: record.userId,
      orderId: record.orderId,
      reason: record.reason,
      status: record.status,
      orderAmount: record.orderAmount,
      recommendations: JSON.parse(record.recommendations || '[]'),
      aiReasoning: JSON.parse(record.aiReasoning || '{}'),
      alternatives: JSON.parse(record.alternatives || '[]'),
      riskScore: record.riskScore,
      expiresAt: record.expiresAt,
      createdAt: record.createdAt,
      respondedAt: record.respondedAt,
      responseReason: record.responseReason,
      correlationId: record.correlationId,
    };
  }
}
