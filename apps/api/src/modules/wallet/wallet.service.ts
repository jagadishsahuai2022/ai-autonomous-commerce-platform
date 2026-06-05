/**
 * Wallet Service
 * Handles wallet operations with spending limits, AI authorization, and audit logging
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../services/prisma.service';
import { LoggerService } from '../../common/logger.service';
import { KafkaService } from '../../kafka/kafka.service';
import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
  ValidationException,
  InternalServerException,
} from '../../common/exceptions/app.exception';
import {
  AddMoneyDto,
  SetSpendingLimitDto,
  AuthorizeAiDto,
  DebitWalletDto,
  AuthorizeSpendingDto,
  WalletResponseDto,
  WalletTransactionResponseDto,
  DebitResponseDto,
  AuthorizeSpendingResponseDto,
  SpendingLimitResponseDto,
} from './dto/wallet.dto';

@Injectable()
export class WalletService {
  private readonly logger = new Logger('WalletService');
  private readonly appLogger = new LoggerService();

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafka: KafkaService
  ) {}

  /**
   * Initialize wallet for a user
   * Called when user first needs a wallet
   */
  async getOrCreateWallet(userId: number): Promise<WalletResponseDto> {
    try {
      // Check if wallet exists
      let wallet = await this.prisma.wallet.findUnique({
        where: { userId },
      });

      // Create if doesn't exist
      if (!wallet) {
        wallet = await this.prisma.wallet.create({
          data: {
            userId,
            balance: 0,
            totalAdded: 0,
            totalSpent: 0,
            isAiAuthorized: false,
          },
        });

        this.appLogger.log('Wallet created', { userId, walletId: wallet.id });

        // Emit event for analytics
        await this.kafka.emit('wallet-events', {
          type: 'wallet.created',
          userId,
          walletId: wallet.id,
          timestamp: new Date(),
        });
      }

      return this.mapWalletToDto(wallet);
    } catch (error) {
      this.logger.error('Failed to get or create wallet', (error as any).message);
      throw new InternalServerException('Failed to initialize wallet');
    }
  }

  /**
   * Add money to wallet
   * Supports multiple payment methods with idempotency
   */
  async addMoney(
    userId: number,
    addMoneyDto: AddMoneyDto,
    ipAddress?: string
  ): Promise<WalletTransactionResponseDto> {
    try {
      const { amount, paymentMethodId, referenceId, description, metadata } = addMoneyDto;

      // Validate amount
      if (amount <= 0) {
        throw new ValidationException('Amount must be greater than zero', { amount });
      }

      // Check for duplicate transaction (idempotency)
      if (referenceId) {
        const existingTxn = await this.prisma.walletTransaction.findFirst({
          where: {
            wallet: { userId },
            referenceId,
            status: 'completed',
          },
        });

        if (existingTxn) {
          this.appLogger.log('Duplicate add money request (idempotent)', {
            userId,
            referenceId,
          });
          return this.mapTransactionToDto(existingTxn);
        }
      }

      // Get or create wallet
      const wallet = await this.getOrCreateWallet(userId);

      // Create transaction
      const transaction = await this.prisma.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'topup',
          amount,
          description: description || `Added via ${paymentMethodId || 'wallet'}`,
          referenceId,
          status: 'completed',
          balanceBefore: wallet.balance,
          balanceAfter: wallet.balance + amount,
          ipAddress,
          metadata: {
            paymentMethodId,
            ...metadata,
          },
        },
      });

      // Update wallet balance
      await this.prisma.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: {
            increment: amount,
          },
          totalAdded: {
            increment: amount,
          },
        },
      });

      // Log audit trail
      await this.logAuditAction(
        wallet.id,
        'balance_updated',
        'user',
        userId,
        {
          type: 'topup',
          amount,
          balanceBefore: wallet.balance,
          balanceAfter: wallet.balance + amount,
        },
        null,
        description,
        ipAddress
      );

      this.appLogger.log('Money added to wallet', {
        userId,
        walletId: wallet.id,
        amount,
      });

      // Emit event for analytics
      await this.kafka.emit('wallet-events', {
        type: 'wallet.money_added',
        userId,
        walletId: wallet.id,
        amount,
        paymentMethod: paymentMethodId,
        timestamp: new Date(),
      });

      return this.mapTransactionToDto(transaction);
    } catch (error) {
      this.logger.error('Failed to add money', (error as any).message);
      if (error instanceof ValidationException) {
        throw error;
      }
      throw new InternalServerException('Failed to add money to wallet');
    }
  }

  /**
   * Set spending limits for wallet
   * Can set max per order, daily limit, and AI spending limit
   */
  async setSpendingLimits(
    userId: number,
    limitDto: SetSpendingLimitDto,
    ipAddress?: string
  ): Promise<SpendingLimitResponseDto> {
    try {
      const { maxPerOrder, dailyLimit, aiSpendingLimit, reason } = limitDto;

      // Validate limits (if set, must be positive)
      if (maxPerOrder !== undefined && maxPerOrder !== null && maxPerOrder <= 0) {
        throw new ValidationException('maxPerOrder must be greater than zero', {
          maxPerOrder,
        });
      }

      if (dailyLimit !== undefined && dailyLimit !== null && dailyLimit <= 0) {
        throw new ValidationException('dailyLimit must be greater than zero', { dailyLimit });
      }

      // Get wallet
      const wallet = await this.prisma.wallet.findUnique({
        where: { userId },
      });

      if (!wallet) {
        throw new NotFoundException('Wallet not found');
      }

      // Capture before state for audit
      const changesBefore = {
        maxPerOrder: wallet.maxPerOrder,
        dailyLimit: wallet.dailyLimit,
        aiSpendingLimit: wallet.aiSpendingLimit,
      };

      // Update wallet
      const updatedWallet = await this.prisma.wallet.update({
        where: { id: wallet.id },
        data: {
          maxPerOrder: maxPerOrder !== undefined ? maxPerOrder : wallet.maxPerOrder,
          dailyLimit: dailyLimit !== undefined ? dailyLimit : wallet.dailyLimit,
          aiSpendingLimit: aiSpendingLimit !== undefined ? aiSpendingLimit : wallet.aiSpendingLimit,
        },
      });

      // Create spending limit record
      await this.prisma.walletSpendingLimit.create({
        data: {
          walletId: wallet.id,
          limitType: 'per_order',
          amount: maxPerOrder || 0,
          isActive: maxPerOrder !== null,
          notes: reason,
        },
      });

      if (dailyLimit !== undefined) {
        await this.prisma.walletSpendingLimit.create({
          data: {
            walletId: wallet.id,
            limitType: 'daily',
            amount: dailyLimit || 0,
            isActive: dailyLimit !== null,
            notes: reason,
          },
        });
      }

      // Log audit trail
      await this.logAuditAction(
        wallet.id,
        'limit_changed',
        'user',
        userId,
        changesBefore,
        {
          maxPerOrder: updatedWallet.maxPerOrder,
          dailyLimit: updatedWallet.dailyLimit,
          aiSpendingLimit: updatedWallet.aiSpendingLimit,
        },
        reason,
        ipAddress
      );

      this.appLogger.log('Spending limits updated', {
        userId,
        walletId: wallet.id,
        maxPerOrder,
        dailyLimit,
      });

      // Emit event
      await this.kafka.emit('wallet-events', {
        type: 'wallet.limits_updated',
        userId,
        walletId: wallet.id,
        limits: { maxPerOrder, dailyLimit, aiSpendingLimit },
        timestamp: new Date(),
      });

      return this.mapSpendingLimitToDto(updatedWallet);
    } catch (error) {
      this.logger.error('Failed to set spending limits', (error as any).message);
      if (error instanceof ValidationException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerException('Failed to update spending limits');
    }
  }

  /**
   * Authorize or revoke AI spending on wallet
   */
  async authorizeAi(
    userId: number,
    authDto: AuthorizeAiDto,
    ipAddress?: string
  ): Promise<WalletResponseDto> {
    try {
      const { authorized, spendingLimit, reason } = authDto;

      // Get wallet
      const wallet = await this.prisma.wallet.findUnique({
        where: { userId },
      });

      if (!wallet) {
        throw new NotFoundException('Wallet not found');
      }

      const changesBefore = {
        isAiAuthorized: wallet.isAiAuthorized,
        aiSpendingLimit: wallet.aiSpendingLimit,
      };

      // Update wallet
      const updatedWallet = await this.prisma.wallet.update({
        where: { id: wallet.id },
        data: {
          isAiAuthorized: authorized,
          aiSpendingLimit: spendingLimit || wallet.aiSpendingLimit,
        },
      });

      // Log audit trail
      await this.logAuditAction(
        wallet.id,
        'ai_auth_toggled',
        'user',
        userId,
        changesBefore,
        {
          isAiAuthorized: updatedWallet.isAiAuthorized,
          aiSpendingLimit: updatedWallet.aiSpendingLimit,
        },
        reason || (authorized ? 'AI authorization enabled' : 'AI authorization disabled'),
        ipAddress
      );

      this.appLogger.log('AI authorization updated', {
        userId,
        walletId: wallet.id,
        authorized,
        spendingLimit,
      });

      // Emit event
      await this.kafka.emit('wallet-events', {
        type: 'wallet.ai_authorization_changed',
        userId,
        walletId: wallet.id,
        authorized,
        spendingLimit,
        timestamp: new Date(),
      });

      return this.mapWalletToDto(updatedWallet);
    } catch (error) {
      this.logger.error('Failed to authorize AI', (error as any).message);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerException('Failed to update AI authorization');
    }
  }

  /**
   * Debit wallet for a purchase
   * Enforces all spending limits (max per order, daily limit, AI limit)
   * Returns authorization for AI purchases
   */
  async debitWallet(
    userId: number,
    debitDto: DebitWalletDto,
    ipAddress?: string
  ): Promise<DebitResponseDto> {
    try {
      const { amount, type, orderId, reason, isAiAuthorized, aiRequestId, metadata } = debitDto;

      // Validate amount
      if (amount <= 0) {
        throw new ValidationException('Amount must be greater than zero', { amount });
      }

      // Get wallet
      const wallet = await this.prisma.wallet.findUnique({
        where: { userId },
      });

      if (!wallet) {
        throw new NotFoundException('Wallet not found');
      }

      // Check if wallet is locked
      if (wallet.isLocked) {
        throw new UnauthorizedException(
          `Wallet is locked: ${wallet.lockReason || 'Suspicious activity detected'}`,
          { reason: wallet.lockReason }
        );
      }

      // Check balance
      if (wallet.balance < amount) {
        throw new ValidationException('Insufficient wallet balance', {
          available: wallet.balance,
          required: amount,
        });
      }

      // Enforce max per order limit
      if (wallet.maxPerOrder && amount > wallet.maxPerOrder) {
        throw new ValidationException('Amount exceeds max per order limit', {
          maxAllowed: wallet.maxPerOrder,
          requested: amount,
        });
      }

      // Enforce daily limit
      if (wallet.dailyLimit) {
        const remainingDaily = wallet.dailyLimit - wallet.dailySpentToday;
        if (amount > remainingDaily) {
          throw new ValidationException('Daily spending limit exceeded', {
            dailyLimit: wallet.dailyLimit,
            alreadySpent: wallet.dailySpentToday,
            remaining: remainingDaily,
            requested: amount,
          });
        }
      }

      // If AI-authorized, check AI spending limit
      if (isAiAuthorized && wallet.aiSpendingLimit && amount > wallet.aiSpendingLimit) {
        throw new ValidationException('Amount exceeds AI spending limit', {
          aiSpendingLimit: wallet.aiSpendingLimit,
          requested: amount,
        });
      }

      // Create transaction
      const transaction = await this.prisma.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type,
          amount,
          description: reason || `${type} - order ${orderId || 'N/A'}`,
          orderId,
          status: 'completed',
          balanceBefore: wallet.balance,
          balanceAfter: wallet.balance - amount,
          ipAddress,
          metadata: {
            isAiAuthorized: isAiAuthorized || false,
            aiRequestId,
            ...metadata,
          },
        },
      });

      // Update wallet
      const updatedWallet = await this.prisma.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: {
            decrement: amount,
          },
          totalSpent: {
            increment: amount,
          },
          dailySpentToday: {
            increment: amount,
          },
        },
      });

      // Log audit trail
      await this.logAuditAction(
        wallet.id,
        'transaction_initiated',
        isAiAuthorized ? 'ai' : 'user',
        isAiAuthorized ? undefined : userId,
        { balanceBefore: wallet.balance },
        { balanceAfter: updatedWallet.balance, transactionId: transaction.id },
        reason || `${type} transaction`,
        ipAddress
      );

      this.appLogger.log('Wallet debited', {
        userId,
        walletId: wallet.id,
        amount,
        type,
        isAiAuthorized,
      });

      // Emit event
      await this.kafka.emit('wallet-events', {
        type: 'wallet.money_spent',
        userId,
        walletId: wallet.id,
        amount,
        orderId,
        isAiAuthorized,
        timestamp: new Date(),
      });

      return {
        success: true,
        message: `Successfully debited ${amount} from wallet`,
        transaction: this.mapTransactionToDto(transaction),
        walletBalance: updatedWallet.balance,
      };
    } catch (error) {
      this.logger.error('Failed to debit wallet', (error as any).message);
      if (
        error instanceof ValidationException ||
        error instanceof UnauthorizedException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerException('Failed to debit wallet');
    }
  }

  /**
   * Authorize AI to spend money on behalf of user
   * Creates an authorization that must be executed within expiry time
   */
  async authorizeSpending(
    userId: number,
    authDto: AuthorizeSpendingDto,
    ipAddress?: string
  ): Promise<AuthorizeSpendingResponseDto> {
    try {
      const {
        amount,
        purpose,
        expiresIn = 3600,
        aiRequestId,
        proposedProducts,
        metadata,
      } = authDto;

      // Validate amount
      if (amount <= 0) {
        throw new ValidationException('Amount must be greater than zero', { amount });
      }

      // Get wallet
      const wallet = await this.prisma.wallet.findUnique({
        where: { userId },
      });

      if (!wallet) {
        throw new NotFoundException('Wallet not found');
      }

      // Check if AI is authorized on this wallet
      if (!wallet.isAiAuthorized) {
        throw new UnauthorizedException('AI is not authorized for this wallet');
      }

      // Check if enough balance (funds must exist or be in process)
      if (wallet.balance < amount) {
        throw new ValidationException('Insufficient wallet balance', {
          available: wallet.balance,
          required: amount,
        });
      }

      // Enforce max per order limit
      if (wallet.maxPerOrder && amount > wallet.maxPerOrder) {
        throw new ValidationException('Amount exceeds max per order limit', {
          maxAllowed: wallet.maxPerOrder,
          requested: amount,
        });
      }

      // Enforce AI spending limit if set
      if (wallet.aiSpendingLimit && amount > wallet.aiSpendingLimit) {
        throw new ValidationException('Amount exceeds AI spending limit', {
          aiSpendingLimit: wallet.aiSpendingLimit,
          requested: amount,
        });
      }

      // Create authorization
      const expiryDate = new Date(Date.now() + expiresIn * 1000);
      const authorization = await this.prisma.walletAuthorization.create({
        data: {
          walletId: wallet.id,
          amount,
          purpose,
          aiRequestId,
          status: 'pending',
          proposedProducts: proposedProducts || [],
          expiresAt: expiryDate,
          metadata,
        },
      });

      // Log audit trail
      await this.logAuditAction(
        wallet.id,
        'ai_authorization_created',
        'ai',
        undefined,
        null,
        {
          authorizationId: authorization.id,
          amount,
          purpose,
          expiresAt: expiryDate,
        },
        `AI authorization for ${purpose}`,
        ipAddress
      );

      this.appLogger.log('AI spending authorization created', {
        userId,
        walletId: wallet.id,
        authorizationId: authorization.id,
        amount,
      });

      // Emit event
      await this.kafka.emit('wallet-events', {
        type: 'wallet.ai_authorization_created',
        userId,
        walletId: wallet.id,
        authorizationId: authorization.id,
        amount,
        purpose,
        expiresAt: expiryDate,
        timestamp: new Date(),
      });

      return {
        success: true,
        authorizationId: authorization.id,
        amount,
        status: authorization.status,
        expiresAt: expiryDate,
        message: `Authorization created for ${amount}. Valid until ${expiryDate.toISOString()}`,
      };
    } catch (error) {
      this.logger.error('Failed to authorize spending', (error as any).message);
      if (
        error instanceof ValidationException ||
        error instanceof UnauthorizedException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerException('Failed to create spending authorization');
    }
  }

  /**
   * Get wallet details
   */
  async getWallet(userId: number): Promise<WalletResponseDto> {
    try {
      const walletRecord = await this.prisma.wallet.findUnique({
        where: { userId },
      });

      if (!walletRecord) {
        throw new NotFoundException('Wallet not found');
      }

      // Reset daily limit if needed
      const wallet = await this.resetDailyLimitIfNeeded(walletRecord);

      return this.mapWalletToDto(wallet);
    } catch (error) {
      this.logger.error('Failed to get wallet', (error as any).message);
      throw new InternalServerException('Failed to retrieve wallet information');
    }
  }

  /**
   * Get wallet transaction history
   */
  async getTransactionHistory(
    userId: number,
    limit: number = 50,
    offset: number = 0
  ): Promise<WalletTransactionResponseDto[]> {
    try {
      const wallet = await this.prisma.wallet.findUnique({
        where: { userId },
      });

      if (!wallet) {
        throw new NotFoundException('Wallet not found');
      }

      const transactions = await this.prisma.walletTransaction.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      });

      return transactions.map((txn) => this.mapTransactionToDto(txn));
    } catch (error) {
      this.logger.error('Failed to get transaction history', (error as any).message);
      throw new InternalServerException('Failed to retrieve transaction history');
    }
  }

  // =========================================================================
  // Private Helper Methods
  // =========================================================================

  private async resetDailyLimitIfNeeded(wallet: any) {
    const now = new Date();
    const lastReset = new Date(wallet.lastResetDate);

    // Check if it's a new day
    if (now.toDateString() !== lastReset.toDateString()) {
      const updatedWallet = await this.prisma.wallet.update({
        where: { id: wallet.id },
        data: {
          dailySpentToday: 0,
          lastResetDate: now,
        },
      });
      return updatedWallet;
    }

    return wallet;
  }

  private async logAuditAction(
    walletId: number,
    action: string,
    performer: string,
    performerId: number | undefined,
    changesBefore: any,
    changesAfter: any,
    reason: string | undefined,
    ipAddress: string | undefined
  ) {
    try {
      await this.prisma.walletAuditLog.create({
        data: {
          walletId,
          action,
          performer,
          performerId,
          changesBefore,
          changesAfter,
          reason,
          ipAddress,
        },
      });
    } catch (error) {
      // Don't fail the main operation if audit logging fails
      this.logger.error('Failed to log audit action', (error as any).message);
    }
  }

  private mapWalletToDto(wallet: any): WalletResponseDto {
    return {
      id: wallet.id,
      userId: wallet.userId,
      balance: wallet.balance,
      totalAdded: wallet.totalAdded,
      totalSpent: wallet.totalSpent,
      maxPerOrder: wallet.maxPerOrder,
      dailyLimit: wallet.dailyLimit,
      dailySpentToday: wallet.dailySpentToday,
      isAiAuthorized: wallet.isAiAuthorized,
      aiSpendingLimit: wallet.aiSpendingLimit,
      isActive: wallet.isActive,
      isLocked: wallet.isLocked,
      lockReason: wallet.lockReason,
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
    };
  }

  private mapTransactionToDto(txn: any): WalletTransactionResponseDto {
    return {
      id: txn.id,
      walletId: txn.walletId,
      type: txn.type,
      amount: txn.amount,
      description: txn.description,
      orderId: txn.orderId,
      referenceId: txn.referenceId,
      status: txn.status,
      reason: txn.reason,
      balanceBefore: txn.balanceBefore,
      balanceAfter: txn.balanceAfter,
      ipAddress: txn.ipAddress,
      createdAt: txn.createdAt,
      updatedAt: txn.updatedAt,
    };
  }

  private mapSpendingLimitToDto(wallet: any): SpendingLimitResponseDto {
    const remainingDaily =
      wallet.dailyLimit !== null ? wallet.dailyLimit - wallet.dailySpentToday : null;

    return {
      maxPerOrder: wallet.maxPerOrder,
      dailyLimit: wallet.dailyLimit,
      aiSpendingLimit: wallet.aiSpendingLimit,
      dailySpentToday: wallet.dailySpentToday,
      remainingDaily,
      lastUpdated: wallet.updatedAt,
    };
  }
}
