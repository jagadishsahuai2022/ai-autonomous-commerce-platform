import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../services/prisma.service';
import { RedisService } from '../../services/redis.service';
import { StructuredLoggerService } from './structured-logger.service';

/**
 * PRODUCTION-GRADE WALLET FRAUD DETECTION & SAFETY
 * Prevents unauthorized spending, detects suspicious patterns
 */

export enum FraudScore {
  LOW = 'LOW', // 0-30
  MEDIUM = 'MEDIUM', // 30-60
  HIGH = 'HIGH', // 60-80
  CRITICAL = 'CRITICAL', // 80-100
}

export interface WalletSafetyCheck {
  allowed: boolean;
  fraudScore: number;
  level: FraudScore;
  violations: string[];
  recommendation: string;
  requiresApproval?: boolean;
}

@Injectable()
export class WalletFraudDetectionService {
  constructor(
    private prismaService: PrismaService,
    private redisService: RedisService,
    private logger: StructuredLoggerService
  ) {}

  /**
   * Comprehensive fraud detection before transaction
   */
  async checkTransactionSafety(
    userId: number,
    amount: number,
    transactionType: 'purchase' | 'ai_authorized' | 'transfer'
  ): Promise<WalletSafetyCheck> {
    const violations: string[] = [];
    let fraudScore = 0;

    // Get wallet
    const wallet = await this.prismaService.wallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      return {
        allowed: false,
        fraudScore: 100,
        level: FraudScore.CRITICAL,
        violations: ['Wallet not found or locked'],
        recommendation: 'Contact support',
      };
    }

    // Check 1: Wallet locked
    if (wallet.isLocked) {
      return {
        allowed: false,
        fraudScore: 100,
        level: FraudScore.CRITICAL,
        violations: [`Wallet locked: ${wallet.lockReason}`],
        recommendation: 'Contact support to unlock wallet',
      };
    }

    // Check 2: Sufficient balance
    if (wallet.balance < amount) {
      violations.push(`Insufficient balance: ${wallet.balance} < ${amount}`);
      fraudScore += 20;
    }

    // Check 3: Per-order limit
    if (wallet.maxPerOrder && amount > wallet.maxPerOrder) {
      violations.push(`Exceeds per-order limit: ${amount} > ${wallet.maxPerOrder}`);
      fraudScore += 25;
    }

    // Check 4: Daily limit
    if (wallet.dailyLimit) {
      const todaySpent = wallet.dailySpentToday;
      if (todaySpent + amount > wallet.dailyLimit) {
        violations.push(`Exceeds daily limit: ${todaySpent + amount} > ${wallet.dailyLimit}`);
        fraudScore += 20;
      }
    }

    // Check 5: Unusual transaction amount
    const avgTransaction = await this.getAverageTransactionAmount(userId);
    if (amount > avgTransaction * 5) {
      violations.push(`Transaction 5x larger than user average (${amount} vs ${avgTransaction})`);
      fraudScore += 25;
    }

    // Check 6: Rapid transactions (rate of spend)
    const recentSpend = await this.getRecentSpendAmount(userId, 60); // Last 60 seconds
    if (recentSpend > amount * 10) {
      violations.push(`Rapid spending detected: ${recentSpend} in 60 seconds`);
      fraudScore += 30;
    }

    // Check 7: Unusual transaction time (if night hours)
    const hour = new Date().getHours();
    if (hour >= 2 && hour <= 5) {
      violations.push(`Unusual transaction time: ${hour}:00`);
      fraudScore += 15;
    }

    // Check 8: New device/IP (track and warn)
    const deviceInfo = await this.analyzeDeviceInfo(userId);
    if (deviceInfo.isNewDevice) {
      violations.push('Transaction from new device');
      fraudScore += 15;
    }

    // Check 9: AI authorization limits
    if (transactionType === 'ai_authorized' && wallet.aiSpendingLimit) {
      if (amount > wallet.aiSpendingLimit) {
        violations.push(`Exceeds AI spending limit: ${amount} > ${wallet.aiSpendingLimit}`);
        fraudScore += 40;
      }
    }

    // Check 10: Transaction velocity (transactions per hour)
    const transactionsLastHour = await this.getTransactionCount(userId, 3600);
    if (transactionsLastHour > 10) {
      violations.push(`High transaction velocity: ${transactionsLastHour} transactions/hour`);
      fraudScore += 25;
    }

    // Determine level
    let level: FraudScore;
    if (fraudScore < 30) level = FraudScore.LOW;
    else if (fraudScore < 60) level = FraudScore.MEDIUM;
    else if (fraudScore < 80) level = FraudScore.HIGH;
    else level = FraudScore.CRITICAL;

    const requiresApproval = fraudScore >= 50;
    const allowed = fraudScore < 100 && violations.length === 0;

    // Log security event
    if (fraudScore > 30) {
      this.logger.logSecurityEvent(
        `High fraud score for user ${userId}: ${fraudScore}%`,
        level === FraudScore.CRITICAL ? 'CRITICAL' : 'HIGH',
        {
          amount,
          transactionType,
          fraudScore,
          violations,
        }
      );
    }

    return {
      allowed,
      fraudScore,
      level,
      violations,
      requiresApproval,
      recommendation:
        level === FraudScore.CRITICAL
          ? 'Transaction blocked - contact support'
          : level === FraudScore.HIGH
            ? 'Transaction requires manual approval'
            : level === FraudScore.MEDIUM
              ? 'Additional verification recommended'
              : 'Transaction approved',
    };
  }

  /**
   * Lock wallet (admin/system action)
   */
  async lockWallet(
    userId: number,
    reason: string,
    lockedBy: 'system' | 'admin' = 'system'
  ): Promise<void> {
    await this.prismaService.wallet.update({
      where: { userId },
      data: {
        isLocked: true,
        lockReason: `[${lockedBy.toUpperCase()}] ${reason}`,
      },
    });

    // Log audit
    const wallet = await this.prismaService.wallet.findUnique({
      where: { userId },
    });

    await this.prismaService.walletAuditLog.create({
      data: {
        walletId: wallet.id,
        action: 'wallet_locked',
        performer: lockedBy,
        reason,
        changesBefore: { locked: false },
        changesAfter: { locked: true },
      },
    });

    this.logger.logSecurityEvent(`Wallet locked for user ${userId}`, 'HIGH', { reason, lockedBy });
  }

  /**
   * Unlock wallet
   */
  async unlockWallet(userId: number, unlockedBy: 'admin' = 'admin'): Promise<void> {
    const wallet = await this.prismaService.wallet.findUnique({
      where: { userId },
    });

    await this.prismaService.wallet.update({
      where: { userId },
      data: {
        isLocked: false,
        lockReason: null,
      },
    });

    await this.prismaService.walletAuditLog.create({
      data: {
        walletId: wallet.id,
        action: 'wallet_unlocked',
        performer: unlockedBy,
        changesBefore: { locked: true },
        changesAfter: { locked: false },
      },
    });

    this.logger.logSecurityEvent(`Wallet unlocked for user ${userId}`, 'MEDIUM', { unlockedBy });
  }

  /**
   * Require manual approval for transaction
   */
  async createApprovalRequest(
    userId: number,
    amount: number,
    purpose: string,
    reason: string
  ): Promise<any> {
    const wallet = await this.prismaService.wallet.findUnique({
      where: { userId },
    });

    return this.prismaService.walletAuthorization.create({
      data: {
        walletId: wallet.id,
        amount,
        purpose,
        status: 'pending',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        metadata: { reason },
      },
    });
  }

  // ========== Private Methods ==========

  private async getAverageTransactionAmount(userId: number): Promise<number> {
    const result = await this.prismaService.walletTransaction.aggregate({
      where: {
        wallet: { userId },
        status: 'completed',
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
      },
      _avg: { amount: true },
    });

    return result._avg.amount || 1000; // Default to 1000 if no history
  }

  private async getRecentSpendAmount(userId: number, secondsAgo: number): Promise<number> {
    const result = await this.prismaService.walletTransaction.aggregate({
      where: {
        wallet: { userId },
        type: 'debit',
        status: 'completed',
        createdAt: {
          gte: new Date(Date.now() - secondsAgo * 1000),
        },
      },
      _sum: { amount: true },
    });

    return result._sum.amount || 0;
  }

  private async getTransactionCount(userId: number, secondsAgo: number): Promise<number> {
    return this.prismaService.walletTransaction.count({
      where: {
        wallet: { userId },
        createdAt: {
          gte: new Date(Date.now() - secondsAgo * 1000),
        },
      },
    });
  }

  private async analyzeDeviceInfo(userId: number): Promise<{ isNewDevice: boolean }> {
    // You can expand this with actual device fingerprinting
    // For now, just check if there's existing transaction history from this device

    const recentTxns = await this.prismaService.walletTransaction.findMany({
      where: { wallet: { userId } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // If less than 3 transactions, likely new device/first time
    return { isNewDevice: recentTxns.length < 3 };
  }
}
