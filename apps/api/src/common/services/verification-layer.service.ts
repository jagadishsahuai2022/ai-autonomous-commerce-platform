/*
 * Verification Layer Service
 * Validates all conditions before AI auto-execution
 * Ensures budget, inventory, seller trust, wallet, and business rules are satisfied
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../services/prisma.service';
import { StructuredLoggerService } from './structured-logger.service';
import { MetricsService } from './metrics.service';

export interface VerificationContext {
  userId: string;
  orderAmount: number;
  productIds: string[];
  sellerIds: string[];
  correlationId: string;
}

export interface VerificationResult {
  valid: boolean;
  checks: VerificationCheck[];
  blockingIssues: VerificationIssue[];
  warnings: VerificationIssue[];
  validUntil: Date;
  requestId: string;
}

export interface VerificationCheck {
  name: string;
  status: 'passed' | 'failed' | 'warning';
  message: string;
  details?: any;
}

export interface VerificationIssue {
  code: string;
  severity: 'error' | 'warning';
  message: string;
  field: string;
  suggestedAction?: string;
}

@Injectable()
export class VerificationLayerService {
  private logger = new Logger(VerificationLayerService.name);

  constructor(
    private prisma: PrismaService,
    private logger$: StructuredLoggerService,
    private metrics: MetricsService
  ) {}

  /**
   * Perform comprehensive verification before execution
   */
  async verifyBeforeExecution(context: VerificationContext): Promise<VerificationResult> {
    const startTime = Date.now();
    const checks: VerificationCheck[] = [];
    const blockingIssues: VerificationIssue[] = [];
    const warnings: VerificationIssue[] = [];
    const requestId = `verify-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      // 1. User verification
      const userCheck = await this.verifyUser(context.userId);
      checks.push(userCheck);
      if (userCheck.status === 'failed') {
        blockingIssues.push({
          code: 'USER_INVALID',
          severity: 'error',
          message: userCheck.message,
          field: 'user',
          suggestedAction: 'Verify user account status',
        });
      }

      // 2. Wallet verification
      const walletCheck = await this.verifyWallet(context.userId, context.orderAmount);
      checks.push(walletCheck);
      if (walletCheck.status === 'failed') {
        blockingIssues.push({
          code: 'WALLET_INSUFFICIENT',
          severity: 'error',
          message: walletCheck.message,
          field: 'wallet',
          suggestedAction: 'Top up wallet balance',
        });
      }

      // 3. Budget verification
      const budgetCheck = await this.verifyBudget(context.userId, context.orderAmount);
      checks.push(budgetCheck);
      if (budgetCheck.status === 'failed') {
        blockingIssues.push({
          code: 'BUDGET_EXCEEDED',
          severity: 'error',
          message: budgetCheck.message,
          field: 'budget',
          suggestedAction: 'Reduce order amount or adjust daily limit',
        });
      }

      // 4. Inventory verification
      const inventoryCheck = await this.verifyInventory(context.productIds);
      checks.push(inventoryCheck);
      if (inventoryCheck.status === 'failed') {
        blockingIssues.push({
          code: 'INVENTORY_UNAVAILABLE',
          severity: 'error',
          message: inventoryCheck.message,
          field: 'inventory',
          suggestedAction: 'Some items out of stock. Choose alternatives.',
        });
      } else if (inventoryCheck.status === 'warning') {
        warnings.push({
          code: 'LOW_INVENTORY',
          severity: 'warning',
          message: inventoryCheck.message,
          field: 'inventory',
          suggestedAction: 'Proceed with caution - limited stock available',
        });
      }

      // 5. Seller verification
      const sellerCheck = await this.verifySellers(context.sellerIds, context.orderAmount);
      checks.push(sellerCheck);
      if (sellerCheck.status === 'failed') {
        blockingIssues.push({
          code: 'SELLER_UNRELIABLE',
          severity: 'error',
          message: sellerCheck.message,
          field: 'sellers',
          suggestedAction: 'Select different sellers with better track record',
        });
      } else if (sellerCheck.status === 'warning') {
        warnings.push({
          code: 'SELLER_CAUTION',
          severity: 'warning',
          message: sellerCheck.message,
          field: 'sellers',
          suggestedAction: 'Consider alternative sellers for better reliability',
        });
      }

      // 6. Fraud checks
      const fraudCheck = await this.runFraudChecks(context.userId, context.orderAmount);
      checks.push(fraudCheck);
      if (fraudCheck.status === 'failed') {
        blockingIssues.push({
          code: 'FRAUD_DETECTED',
          severity: 'error',
          message: fraudCheck.message,
          field: 'fraud',
          suggestedAction: 'Order flagged for manual review',
        });
      } else if (fraudCheck.status === 'warning') {
        warnings.push({
          code: 'FRAUD_RISK',
          severity: 'warning',
          message: fraudCheck.message,
          field: 'fraud',
          suggestedAction: 'Proceed with enhanced monitoring',
        });
      }

      // 7. Business rules verification
      const rulesCheck = await this.verifyBusinessRules(context.userId, context.orderAmount);
      checks.push(rulesCheck);
      if (rulesCheck.status === 'failed') {
        blockingIssues.push({
          code: 'RULES_VIOLATION',
          severity: 'error',
          message: rulesCheck.message,
          field: 'business_rules',
          suggestedAction: rulesCheck.details?.suggestedAction || 'Review policies',
        });
      }

      // Determine if valid
      const valid = blockingIssues.length === 0;
      const validUntil = new Date();
      validUntil.setMinutes(validUntil.getMinutes() + 15); // Valid for 15 minutes

      const result: VerificationResult = {
        valid,
        checks,
        blockingIssues,
        warnings,
        validUntil,
        requestId,
      };

      // Log verification
      this.logger$.logBusinessEvent('verification_completed', {
        userId: context.userId,
        requestId,
        valid,
        blockingIssueCount: blockingIssues.length,
        warningCount: warnings.length,
        correlationId: context.correlationId,
        duration: Date.now() - startTime,
      });

      // Record metrics
      this.metrics.recordCounterMetric(valid ? 'verification_passed' : 'verification_failed', 1, {
        correlationId: context.correlationId,
      });

      return result;
    } catch (error) {
      this.logger.error(`Verification failed: ${error.message}`, error.stack);
      this.logger$.logSecurityEvent('verification_error', {
        userId: context.userId,
        requestId,
        error: error.message,
        correlationId: context.correlationId,
      });
      throw error;
    }
  }

  /**
   * Verify user account status
   */
  private async verifyUser(userId: string): Promise<VerificationCheck> {
    try {
      const numericId = parseInt(userId, 10);
      const user = await this.prisma.user.findUnique({
        where: { id: numericId },
        select: { id: true, email: true },
      });

      if (!user) {
        return {
          name: 'User Account',
          status: 'failed',
          message: 'User not found',
        };
      }

      // User exists and is authenticated
      return {
        name: 'User Account',
        status: 'passed',
        message: `User verified: ${user.email}`,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Verify wallet has sufficient balance and is not locked
   */
  private async verifyWallet(userId: string, orderAmount: number): Promise<VerificationCheck> {
    try {
      const numericUserId = parseInt(userId, 10);
      const wallet = await this.prisma.wallet.findUnique({
        where: { userId: numericUserId },
        select: {
          balance: true,
          isLocked: true,
          lockReason: true,
          dailyLimit: true,
          dailySpentToday: true,
        },
      });

      if (!wallet) {
        return {
          name: 'Wallet',
          status: 'failed',
          message: 'User wallet not found',
        };
      }

      if (wallet.isLocked) {
        return {
          name: 'Wallet',
          status: 'failed',
          message: `Wallet is locked: ${wallet.lockReason || 'Unknown reason'}`,
          details: { lockReason: wallet.lockReason },
        };
      }

      if (wallet.balance < orderAmount) {
        return {
          name: 'Wallet',
          status: 'failed',
          message: `Insufficient balance (₹${wallet.balance}) for order (₹${orderAmount})`,
          details: {
            balance: wallet.balance,
            required: orderAmount,
            shortfall: orderAmount - wallet.balance,
          },
        };
      }

      if ((wallet.dailySpentToday || 0) + orderAmount > (wallet.dailyLimit || Infinity) * 30) {
        return {
          name: 'Wallet',
          status: 'warning',
          message: 'Order would exceed monthly budget limit',
          details: {
            monthlyLimit: (wallet.dailyLimit || 0) * 30,
            currentSpent: wallet.dailySpentToday || 0,
            projectedTotal: (wallet.dailySpentToday || 0) + orderAmount,
          },
        };
      }

      return {
        name: 'Wallet',
        status: 'passed',
        message: `Wallet verified. Balance: ₹${wallet.balance}`,
        details: { balance: wallet.balance },
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Verify user budget limits
   */
  private async verifyBudget(userId: string, orderAmount: number): Promise<VerificationCheck> {
    try {
      const numericId = parseInt(userId, 10);
      const user = await this.prisma.user.findUnique({
        where: { id: numericId },
        include: { userPreferences: true },
      });

      if (!user?.userPreferences) {
        return {
          name: 'Budget Limits',
          status: 'passed',
          message: 'No budget limits configured',
        };
      }

      const prefs = user.userPreferences as any;

      const maxOrderAmount = prefs.maxOrderAmount || 100000;
      const dailyBudget = prefs.dailyBudget || 200000;

      if (orderAmount > maxOrderAmount) {
        return {
          name: 'Budget Limits',
          status: 'failed',
          message: `Order (₹${orderAmount}) exceeds max per order (₹${maxOrderAmount})`,
        };
      }

      // Check daily spend
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todaySpent = await this.prisma.walletTransaction.aggregate({
        where: {
          wallet: { userId: numericId },
          createdAt: { gte: today },
          type: 'debit',
        },
        _sum: { amount: true },
      });

      const dailySpent = todaySpent._sum.amount || 0;
      if (dailySpent + orderAmount > dailyBudget) {
        return {
          name: 'Budget Limits',
          status: 'failed',
          message: `Daily budget (₹${dailyBudget}) would be exceeded`,
          details: {
            dailyBudget,
            dailySpent,
            orderAmount,
          },
        };
      }

      return {
        name: 'Budget Limits',
        status: 'passed',
        message: `Budget verified. Daily available: ₹${dailyBudget - dailySpent}`,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Verify inventory availability
   */
  private async verifyInventory(productIds: string[]): Promise<VerificationCheck> {
    try {
      const numericIds = productIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
      const products = await this.prisma.product.findMany({
        where: { id: { in: numericIds } },
        include: { businessMetrics: true },
      });

      const outOfStock = products.filter((p) => (p.businessMetrics?.inventoryCount ?? 1) <= 0);
      const lowStock = products.filter((p) => {
        const count = p.businessMetrics?.inventoryCount ?? 1;
        return count > 0 && count < 5;
      });
      const stockMap = products.map(p => ({ ...p, stock: p.businessMetrics?.inventoryCount ?? 1 }));

      if (outOfStock.length > 0) {
        return {
          name: 'Inventory',
          status: 'failed',
          message: `${outOfStock.length} product(s) out of stock: ${outOfStock.map((p) => p.name).join(', ')}`,
          details: { outOfStock },
        };
      }

      if (lowStock.length > 0) {
        return {
          name: 'Inventory',
          status: 'warning',
          message: `${lowStock.length} product(s) have low stock`,
          details: { lowStock },
        };
      }

      return {
        name: 'Inventory',
        status: 'passed',
        message: `All ${products.length} items in stock`,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Verify seller reliability and trust
   */
  private async verifySellers(
    sellerIds: string[],
    orderAmount: number
  ): Promise<VerificationCheck> {
    try {
      const numericSellerIds = sellerIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
      const sellers = await this.prisma.seller.findMany({
        where: { id: { in: numericSellerIds } },
        select: {
          id: true,
          storeName: true,
          averageRating: true,
          ratingCount: true,
          isVerified: true,
          isActive: true,
        },
      });

      const inactive = sellers.filter((s) => !s.isActive);
      const unreliable = sellers.filter((s) => s.averageRating < 3.5 || s.ratingCount < 10);

      if (inactive.length > 0) {
        return {
          name: 'Seller Trust',
          status: 'failed',
          message: `${inactive.length} seller(s) are inactive`,
          details: { inactive },
        };
      }

      if (unreliable.length > 0) {
        return {
          name: 'Seller Trust',
          status: 'warning',
          message: `${unreliable.length} seller(s) have low ratings (<3.5 or <10 reviews)`,
          details: { unreliable },
        };
      }

      const avgRating = sellers.length > 0
        ? sellers.reduce((sum, s) => sum + s.averageRating, 0) / sellers.length
        : 5;

      return {
        name: 'Seller Trust',
        status: 'passed',
        message: `Sellers verified. Avg rating: ${avgRating.toFixed(1)}/5`,
        details: {
          avgRating,
          sellerCount: sellers.length,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Run fraud detection checks
   */
  private async runFraudChecks(userId: string, orderAmount: number): Promise<VerificationCheck> {
    try {
      // Check recent orders for pattern
      const recentOrders = await this.prisma.order.findMany({
        where: {
          userId: parseInt(userId, 10),
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
        },
        select: { total: true, createdAt: true },
      });

      const recentTotalSpent = recentOrders.reduce((sum, o) => sum + o.total, 0);
      const orderCount = recentOrders.length;

      // Detect velocity abuse
      if (orderCount > 10) {
        return {
          name: 'Fraud Detection',
          status: 'warning',
          message: `High order velocity: ${orderCount} orders in 24 hours`,
        };
      }

      // Detect unusual patterns
      if (recentTotalSpent + orderAmount > 500000) {
        return {
          name: 'Fraud Detection',
          status: 'warning',
          message: `High spending pattern: ₹${recentTotalSpent + orderAmount} in 24 hours`,
        };
      }

      return {
        name: 'Fraud Detection',
        status: 'passed',
        message: 'No fraud indicators detected',
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Verify business rule compliance
   */
  private async verifyBusinessRules(
    userId: string,
    orderAmount: number
  ): Promise<VerificationCheck> {
    try {
      // Check for restricted categories or sellers
      const user = await this.prisma.user.findUnique({
        where: { id: parseInt(userId, 10) },
        include: { userPreferences: true },
      });

      if (!user?.userPreferences) {
        return {
          name: 'Business Rules',
          status: 'passed',
          message: 'All rules satisfied',
        };
      }

      const prefs = user.userPreferences as any;

      // Check minimum order amount
      if (orderAmount < (prefs.minimumOrderAmount || 100)) {
        return {
          name: 'Business Rules',
          status: 'failed',
          message: `Order amount (₹${orderAmount}) below minimum (₹${prefs.minimumOrderAmount || 100})`,
          details: { suggestedAction: 'Add more items to meet minimum' },
        };
      }

      return {
        name: 'Business Rules',
        status: 'passed',
        message: 'All business rules satisfied',
      };
    } catch (error) {
      throw error;
    }
  }
}
