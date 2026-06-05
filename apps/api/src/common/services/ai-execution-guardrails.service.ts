import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../services/prisma.service';
import { StructuredLoggerService } from './structured-logger.service';

/**
 * PRODUCTION-GRADE AI EXECUTION GUARDRAILS
 * Controls AI spending, category restrictions, approval workflows
 */

export interface AIExecutionGuardrails {
  maxSpendPerTransaction: number;
  maxDailySpend: number;
  allowedCategories: string[];
  requiresApprovalAbove: number;
  allowAutoApproval: boolean;
  enforceWalletLimit: boolean;
}

export interface AIExecutionRequest {
  userId: number;
  proposedAmount: number;
  category: string;
  productName: string;
  confidenceScore: number;
}

export interface AIExecutionDecision {
  allowed: boolean;
  reason: string;
  requiresApproval: boolean;
  suggestedActions?: string[];
}

@Injectable()
export class AIExecutionGuardrailsService {
  // Default guardrails (can be overridden per user)
  private defaultGuardrails: AIExecutionGuardrails = {
    maxSpendPerTransaction: 50000, // ₹50k per transaction
    maxDailySpend: 100000, // ₹100k per day
    allowedCategories: ['Electronics', 'Groceries', 'Fashion', 'Home & Kitchen'],
    requiresApprovalAbove: 25000,
    allowAutoApproval: false, // Require explicit user approval first time
    enforceWalletLimit: true,
  };

  constructor(
    private prismaService: PrismaService,
    private logger: StructuredLoggerService
  ) {}

  /**
   * Get guardrails for user
   */
  async getGuardrails(userId: number): Promise<AIExecutionGuardrails> {
    const userPrefs = await this.prismaService.userPreferences.findUnique({
      where: { userId },
    });

    if (!userPrefs?.autoDecisionsEnabled) {
      return { ...this.defaultGuardrails, allowAutoApproval: false };
    }

    // Return user-specific guardrails (from metadata or settings)
    return (userPrefs.metadata as any) || this.defaultGuardrails;
  }

  /**
   * Validate AI execution request against guardrails
   */
  async validateExecution(request: AIExecutionRequest): Promise<AIExecutionDecision> {
    const guardrails = await this.getGuardrails(request.userId);
    const violations: string[] = [];
    const suggestedActions: string[] = [];

    // Check 1: Category allowed
    if (!guardrails.allowedCategories.includes(request.category)) {
      violations.push(`Category not allowed: ${request.category}`);
      suggestedActions.push('Change category to an allowed one');
    }

    // Check 2: Per-transaction limit
    if (request.proposedAmount > guardrails.maxSpendPerTransaction) {
      violations.push(
        `Exceeds per-transaction limit: ₹${request.proposedAmount} > ₹${guardrails.maxSpendPerTransaction}`
      );
      suggestedActions.push(`Reduce purchase amount to ₹${guardrails.maxSpendPerTransaction}`);
    }

    // Check 3: Daily limit
    const dailySpent = await this.getDailyAISpend(request.userId);
    if (dailySpent + request.proposedAmount > guardrails.maxDailySpend) {
      violations.push(
        `Exceeds daily limit: ₹${dailySpent + request.proposedAmount} > ₹${guardrails.maxDailySpend}`
      );
      suggestedActions.push(`Already spent ₹${dailySpent} today`);
    }

    // Check 4: Confidence score
    if (request.confidenceScore < 0.7) {
      violations.push(`Confidence score too low: ${(request.confidenceScore * 100).toFixed(1)}%`);
      suggestedActions.push('Request more specific details for better recommendations');
    }

    // Check 5: Wallet authorization
    if (guardrails.enforceWalletLimit) {
      const wallet = await this.prismaService.wallet.findUnique({
        where: { userId: request.userId },
      });

      if (!wallet?.isAiAuthorized) {
        violations.push('AI spending not authorized on wallet');
        suggestedActions.push('Enable AI authorization in wallet settings');
      }

      if (wallet?.balance < request.proposedAmount) {
        violations.push(
          `Insufficient wallet balance: ₹${wallet.balance} < ₹${request.proposedAmount}`
        );
        suggestedActions.push('Add funds to wallet');
      }
    }

    // Check 6: User preferences violated
    const userPrefs = await this.prismaService.userPreferences.findUnique({
      where: { userId: request.userId },
    });

    if (userPrefs?.minQualityRating && request.confidenceScore < userPrefs.minQualityRating / 5) {
      violations.push(
        `Below user minimum quality requirement: ${request.confidenceScore} < ${userPrefs.minQualityRating / 5}`
      );
    }

    // Decision
    const allowed = violations.length === 0;
    const requiresApproval =
      !allowed ||
      request.proposedAmount > guardrails.requiresApprovalAbove ||
      !guardrails.allowAutoApproval;

    const decision: AIExecutionDecision = {
      allowed,
      reason: allowed ? 'All checks passed' : `Blocked: ${violations.join('; ')}`,
      requiresApproval,
      suggestedActions: suggestedActions.length > 0 ? suggestedActions : undefined,
    };

    // Log decision
    this.logger.logBusinessEvent('ai_execution_decision', 'guardrails', {
      userId: request.userId,
      amount: request.proposedAmount,
      category: request.category,
      allowed,
      requiresApproval,
      violations,
    });

    return decision;
  }

  /**
   * Create approval request
   */
  async requestApproval(
    userId: number,
    amount: number,
    category: string,
    productName: string,
    reason: string
  ): Promise<any> {
    const wallet = await this.prismaService.wallet.findUnique({
      where: { userId },
    });

    const auth = await this.prismaService.walletAuthorization.create({
      data: {
        walletId: wallet.id,
        amount,
        purpose: `AI Purchase: ${productName}`,
        status: 'pending',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        proposedProducts: [{ productName, category }],
        metadata: { reason },
      },
    });

    this.logger.logBusinessEvent('approval_requested', 'ai_execution', {
      userId,
      authorizationId: auth.id,
      amount,
      productName,
    });

    return auth;
  }

  /**
   * Get pending approvals for user
   */
  async getPendingApprovals(userId: number): Promise<any[]> {
    const wallet = await this.prismaService.wallet.findUnique({
      where: { userId },
    });

    return this.prismaService.walletAuthorization.findMany({
      where: {
        walletId: wallet.id,
        status: 'pending',
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Approve execution
   */
  async approveExecution(authorizationId: number, approvedBy: number): Promise<void> {
    const auth = await this.prismaService.walletAuthorization.update({
      where: { id: authorizationId },
      data: {
        status: 'approved',
        approvedBy,
        approvedAt: new Date(),
      },
    });

    this.logger.logSecurityEvent(`AI execution approved: ${auth.purpose}`, 'MEDIUM', {
      authorizationId,
      approvedBy,
      amount: auth.amount,
    });
  }

  /**
   * Deny execution
   */
  async denyExecution(authorizationId: number, reason: string): Promise<void> {
    const auth = await this.prismaService.walletAuthorization.update({
      where: { id: authorizationId },
      data: {
        status: 'rejected',
        metadata: { denialReason: reason },
      },
    });

    this.logger.logBusinessEvent('ai_execution_denied', 'guardrails', {
      authorizationId,
      reason,
      amount: auth.amount,
    });
  }

  /**
   * Update user guardrails
   */
  async updateGuardrails(
    userId: number,
    guardrails: Partial<AIExecutionGuardrails>
  ): Promise<void> {
    const userPrefs = await this.prismaService.userPreferences.findUnique({
      where: { userId },
    });

    const updated = {
      ...this.defaultGuardrails,
      ...((userPrefs?.metadata as Record<string, unknown>) || {}),
      ...guardrails,
    };

    await this.prismaService.userPreferences.update({
      where: { userId },
      data: {
        metadata: updated,
      },
    });

    this.logger.logSecurityEvent(`AI guardrails updated for user ${userId}`, 'MEDIUM', {
      guardrails,
    });
  }

  /**
   * Get AI execution history
   */
  async getExecutionHistory(userId: number, limit: number = 50): Promise<any[]> {
    return this.prismaService.walletAuthorization.findMany({
      where: {
        wallet: { userId },
        status: { in: ['executed', 'approved', 'rejected'] },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  // ========== Private Methods ==========

  private async getDailyAISpend(userId: number): Promise<number> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const result = await this.prismaService.walletTransaction.aggregate({
      where: {
        wallet: { userId },
        metadata: { path: ['aiAuthorized'], equals: true },
        status: 'completed',
        createdAt: { gte: todayStart },
      },
      _sum: { amount: true },
    });

    return result._sum.amount || 0;
  }
}
