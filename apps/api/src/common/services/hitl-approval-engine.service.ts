/**
 * Human-in-the-Loop (HITL) Approval System
 * Rules: <₹1k auto, ₹1k-₹10k optional, >₹10k mandatory approval
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../services/prisma.service';
import { StructuredLoggerService } from './structured-logger.service';
import { MetricsService } from './metrics.service';

export interface ApprovalRequestInput {
  userId: number;
  productIds: number[];
  quantities: number[];
  totalAmount: number;
  reason: ApprovalReason;
  aiReasoning: AIReasoning;
  alternatives: AlternativeProduct[];
  riskScore: number;
  correlationId: string;
}

export enum ApprovalReason {
  HIGH_VALUE = 'HIGH_VALUE',
  LOW_CONFIDENCE = 'LOW_CONFIDENCE',
  OVERKILL_DETECTED = 'OVERKILL_DETECTED',
  BUDGET_RISK = 'BUDGET_RISK',
  FRAUD_RISK = 'FRAUD_RISK',
  AI_DECISION = 'AI_DECISION',
  SELLER_TRUST = 'SELLER_TRUST',
}

export interface AIReasoning {
  decision: string;
  confidence: number; // 0-100
  reasoning: string[];
  strengths: string[];
  weaknesses: string[];
  assumptions: string[];
  fallbackOptions: string[];
}

export interface AlternativeProduct {
  productId: number;
  name: string;
  price: number;
  reason: string;
}

export interface ApprovalResponse {
  approvalId: string;
  status: ApprovalStatus;
  totalAmount: number;
  reason: ApprovalReason;
  expiresAt: Date;
  createdAt: Date;
  respondedAt?: Date;
  responseReason?: string;
}

export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
}

@Injectable()
export class HITLApprovalService {
  private readonly logger = new Logger(HITLApprovalService.name);

  // Constants
  private readonly AUTO_THRESHOLD = 1000; // <₹1k auto execute
  private readonly OPTIONAL_THRESHOLD = 10000; // ₹1k-₹10k optional
  private readonly MANDATORY_THRESHOLD = 10000; // >₹10k mandatory
  private readonly APPROVAL_WINDOW_HOURS = 24;

  constructor(
    private prisma: PrismaService,
    private logger_service: StructuredLoggerService,
    private metrics: MetricsService
  ) {}

  /**
   * Determine if approval is required
   */
  shouldRequireApproval(totalAmount: number): boolean {
    return totalAmount >= this.OPTIONAL_THRESHOLD;
  }

  /**
   * Create approval request
   */
  async createApprovalRequest(input: ApprovalRequestInput): Promise<ApprovalResponse> {
    const approvalId = `appr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + this.APPROVAL_WINDOW_HOURS);

    try {
      // Store in database (would be ApprovalRequest model in Prisma)
      // For now, storing as JSON structure for demo
      const approvalData = {
        approvalId,
        userId: input.userId,
        productIds: input.productIds,
        quantities: input.quantities,
        totalAmount: input.totalAmount,
        reason: input.reason,
        aiReasoning: input.aiReasoning,
        alternatives: input.alternatives,
        riskScore: input.riskScore,
        status: ApprovalStatus.PENDING,
        expiresAt,
        createdAt: new Date(),
        correlationId: input.correlationId,
      };

      this.logger_service.logBusinessEvent('approval_request_created', {
        approvalId,
        userId: input.userId,
        totalAmount: input.totalAmount,
        reason: input.reason,
        correlationId: input.correlationId,
      });

      this.metrics.increment('approval_request_created');

      return {
        approvalId,
        status: ApprovalStatus.PENDING,
        totalAmount: input.totalAmount,
        reason: input.reason,
        expiresAt,
        createdAt: new Date(),
      };
    } catch (error) {
      this.logger.error(
        `Failed to create approval request: ${error instanceof Error ? error.message : String(error)}`
      );
      this.metrics.increment('approval_request_failed');
      throw error;
    }
  }

  /**
   * Get pending approvals for user
   */
  async getPendingApprovals(userId: number): Promise<ApprovalResponse[]> {
    // Query approvals where status = pending and not expired
    // This would query from ApprovalRequest model
    const now = new Date();

    // Mock implementation - in production this queries DB
    const approvals: ApprovalResponse[] = [];

    return approvals;
  }

  /**
   * User approves an order
   */
  async approveOrder(approvalId: string, userId: number): Promise<{ orderId: number }> {
    try {
      this.logger_service.logBusinessEvent('approval_approved', {
        approvalId,
        userId,
      });

      this.metrics.increment('approval_approved');

      // In production, this would:
      // 1. Update approval status to 'approved'
      // 2. Execute order creation
      // 3. Return orderId

      return { orderId: 0 }; // Placeholder
    } catch (error) {
      this.logger.error(
        `Failed to approve order: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * User rejects an order
   */
  async rejectOrder(approvalId: string, userId: number, reason: string): Promise<void> {
    try {
      this.logger_service.logBusinessEvent('approval_rejected', {
        approvalId,
        userId,
        reason,
      });

      this.metrics.increment('approval_rejected');

      // Update approval status to 'rejected'
    } catch (error) {
      this.logger.error(
        `Failed to reject order: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Get approval statistics
   */
  async getApprovalStats(userId: number): Promise<{
    pending: number;
    approved: number;
    rejected: number;
    expired: number;
    avgResponseTimeSec: number;
  }> {
    // Query stats from ApprovalRequest model
    return {
      pending: 0,
      approved: 0,
      rejected: 0,
      expired: 0,
      avgResponseTimeSec: 0,
    };
  }

  /**
   * Clean up expired approvals
   */
  async cleanupExpiredApprovals(): Promise<number> {
    const now = new Date();

    // Query and delete all expired approvals
    // In production: await this.prisma.approvalRequest.deleteMany(...)

    const count = 0;
    this.metrics.increment('approval_expired');

    return count;
  }

  /**
   * Get approval reasons  matrix (for mapping)
   */
  static getApprovalReasonMatrix() {
    return {
      [ApprovalReason.HIGH_VALUE]: {
        threshold: 10000,
        description: 'Order exceeds ₹10,000',
        priority: 'HIGH',
      },
      [ApprovalReason.LOW_CONFIDENCE]: {
        threshold: 0,
        description: 'AI confidence below 60%',
        priority: 'MEDIUM',
      },
      [ApprovalReason.OVERKILL_DETECTED]: {
        threshold: 0,
        description: 'Products detected as overkill',
        priority: 'HIGH',
      },
      [ApprovalReason.BUDGET_RISK]: {
        threshold: 0,
        description: 'Budget allocation risk detected',
        priority: 'MEDIUM',
      },
      [ApprovalReason.FRAUD_RISK]: {
        threshold: 0,
        description: 'Potential fraud pattern detected',
        priority: 'CRITICAL',
      },
      [ApprovalReason.AI_DECISION]: {
        threshold: 5000,
        description: 'Standard AI-assisted decision',
        priority: 'LOW',
      },
      [ApprovalReason.SELLER_TRUST]: {
        threshold: 0,
        description: 'Seller trust concern',
        priority: 'MEDIUM',
      },
    };
  }
}
