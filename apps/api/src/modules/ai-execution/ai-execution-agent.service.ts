/**
 * AI Execution Agent Service
 * Handles automated order placement with 3 execution modes
 * - Suggestion: Recommend product, don't purchase
 * - Approval: Recommend and wait for user approval
 * - Autonomous: Auto-purchase if conditions met
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../services/prisma.service';
import { LoggerService } from '../../common/logger.service';
import { KafkaService } from '../../kafka/kafka.service';
import { WalletService } from '../wallet/wallet.service';
import { ShoppingAssistantService } from '../../shopping/shopping-assistant.service';
import {
  ValidationException,
  NotFoundException,
  UnauthorizedException,
  InternalServerException,
} from '../../common/exceptions/app.exception';
import {
  ExecuteOrderDto,
  ValidateExecutionDto,
  ApproveOrderDto,
  ExecutionRequestResponseDto,
  ProductSelectionResponseDto,
  ValidationResultDto,
  ExecutionSuggestionResponseDto,
  ApprovalResponseDto,
  ExecutionStatsDto,
} from './dto/execution.dto';

interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

interface ExecutionRequest {
  id: string;
  userId: number;
  productId: number;
  amount: number;
  mode: 'suggestion' | 'approval' | 'autonomous';
  status: 'pending' | 'approved' | 'executing' | 'completed' | 'failed';
  orderId?: number;
  error?: string;
  retryCount: number;
  createdAt: Date;
  expiresAt?: Date;
}

@Injectable()
export class AiExecutionAgentService {
  private readonly logger = new Logger('AiExecutionAgentService');
  private readonly appLogger = new LoggerService();

  // In-memory store for execution requests (use Redis for production)
  private executionRequests = new Map<string, ExecutionRequest>();

  private readonly retryConfig: RetryConfig = {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly shoppingAssistant: ShoppingAssistantService,
    private readonly kafka: KafkaService
  ) {}

  /**
   * Execute order with specified mode
   * Modes:
   * - suggestion: Recommend product, don't charge
   * - approval: Create request, wait for user approval before charging
   * - autonomous: Auto-purchase if conditions met
   */
  async executeOrder(
    userId: number,
    executeDto: ExecuteOrderDto
  ): Promise<ExecutionRequestResponseDto> {
    try {
      const { productIds, intent, mode, maxProducts = 1, metadata } = executeDto;

      // Validate inputs
      if (!productIds || productIds.length === 0) {
        throw new ValidationException('No products provided for execution');
      }

      this.appLogger.log(`AI Execution Agent starting in ${mode} mode`, {
        userId,
        productCount: productIds.length,
      });

      // Step 1: Select best product from candidates
      const selectedProduct = await this.selectBestProduct(productIds, intent);
      if (!selectedProduct) {
        throw new NotFoundException('No suitable products found for execution');
      }

      // Step 2: Validate wallet and spending limits
      const validation = await this.validateExecution(userId, selectedProduct.id, {
        productId: selectedProduct.id,
        amount: selectedProduct.price,
        isAiAuthorized: true,
      });

      if (!validation.isValid) {
        throw new ValidationException('Execution validation failed', {
          errors: validation.errors,
          warnings: validation.warnings,
        });
      }

      // Step 3: Execute based on mode
      let result: ExecutionRequestResponseDto;

      switch (mode) {
        case 'suggestion':
          result = await this.modesuggestion(userId, selectedProduct, intent, validation, metadata);
          break;

        case 'approval':
          result = await this.modeApproval(userId, selectedProduct, intent, validation, metadata);
          break;

        case 'autonomous':
          result = await this.modeAutonomous(userId, selectedProduct, intent, validation, metadata);
          break;

        default:
          throw new ValidationException('Invalid execution mode', { mode });
      }

      return result;
    } catch (error) {
      this.logger.error('Order execution failed', (error as any).message);
      throw error;
    }
  }

  /**
   * Mode: Suggestion
   * Just recommend product without charging
   */
  private async modesuggestion(
    userId: number,
    product: any,
    intent: any,
    validation: ValidationResultDto,
    metadata?: Record<string, any>
  ): Promise<ExecutionRequestResponseDto> {
    try {
      const requestId = this.generateRequestId();

      this.appLogger.log('AI Suggestion mode - recommending product', {
        userId,
        productId: product.id,
        requestId,
      });

      // Create execution request (for tracking)
      const request: ExecutionRequest = {
        id: requestId,
        userId,
        productId: product.id,
        amount: product.price,
        mode: 'suggestion',
        status: 'completed',
        retryCount: 0,
        createdAt: new Date(),
      };

      this.executionRequests.set(requestId, request);

      // Emit event
      await this.kafka.emit('ai-execution-events', {
        type: 'execution.suggestion',
        userId,
        requestId,
        productId: product.id,
        productName: product.name,
        price: product.price,
        timestamp: new Date(),
      });

      return {
        id: requestId,
        userId,
        mode: 'suggestion',
        status: 'completed',
        selectedProduct: {
          id: product.id,
          name: product.name,
          price: product.price,
          rank: product.rank,
          score: product.score,
        },
        amount: product.price,
        message: `Product ${product.name} recommended. No purchase executed. Review and approve if interested.`,
        createdAt: new Date(),
      };
    } catch (error) {
      this.logger.error('Suggestion mode failed', (error as any).message);
      throw new InternalServerException('Failed to generate suggestion');
    }
  }

  /**
   * Mode: Approval
   * Recommend product and create time-limited approval request
   */
  private async modeApproval(
    userId: number,
    product: any,
    intent: any,
    validation: ValidationResultDto,
    metadata?: Record<string, any>
  ): Promise<ExecutionRequestResponseDto> {
    try {
      const requestId = this.generateRequestId();
      const expiresAt = new Date(Date.now() + 3600000); // 1 hour

      this.appLogger.log('AI Approval mode - requesting user approval', {
        userId,
        productId: product.id,
        requestId,
        expiresAt,
      });

      // Create execution request
      const request: ExecutionRequest = {
        id: requestId,
        userId,
        productId: product.id,
        amount: product.price,
        mode: 'approval',
        status: 'pending',
        retryCount: 0,
        createdAt: new Date(),
        expiresAt,
      };

      this.executionRequests.set(requestId, request);

      // Create wallet authorization for this purchase
      await this.wallet.authorizeSpending(userId, {
        amount: product.price,
        purpose: 'ai_product_purchase',
        expiresIn: 3600,
        proposedProducts: [
          {
            id: product.id,
            name: product.name,
            price: product.price,
            quantity: 1,
          },
        ],
        aiRequestId: requestId,
      });

      // Emit event for UI to show approval prompt
      await this.kafka.emit('ai-execution-events', {
        type: 'execution.approval_requested',
        userId,
        requestId,
        productId: product.id,
        productName: product.name,
        price: product.price,
        expiresAt,
        timestamp: new Date(),
      });

      return {
        id: requestId,
        userId,
        mode: 'approval',
        status: 'pending',
        selectedProduct: {
          id: product.id,
          name: product.name,
          price: product.price,
          rank: product.rank,
          score: product.score,
        },
        amount: product.price,
        message: `Approval needed for purchase of ${product.name} for ₹${product.price}. Request expires in 1 hour.`,
        createdAt: new Date(),
        expiresAt,
      };
    } catch (error) {
      this.logger.error('Approval mode failed', (error as any).message);
      throw new InternalServerException('Failed to create approval request');
    }
  }

  /**
   * Mode: Autonomous
   * Auto-execute purchase if all conditions met
   * Includes retry logic for transient failures
   */
  private async modeAutonomous(
    userId: number,
    product: any,
    intent: any,
    validation: ValidationResultDto,
    metadata?: Record<string, any>
  ): Promise<ExecutionRequestResponseDto> {
    const requestId = this.generateRequestId();
    const request: ExecutionRequest = {
      id: requestId,
      userId,
      productId: product.id,
      amount: product.price,
      mode: 'autonomous',
      status: 'executing',
      retryCount: 0,
      createdAt: new Date(),
    };

    this.executionRequests.set(requestId, request);

    try {
      this.appLogger.log('AI Autonomous mode - executing purchase', {
        userId,
        productId: product.id,
        requestId,
        amount: product.price,
      });

      // Execute with retry logic
      const order = await this.executeWithRetry(
        () => this.createOrder(userId, product, requestId, metadata),
        'order_creation'
      );

      // Update request
      request.status = 'completed';
      request.orderId = order.id;
      this.executionRequests.set(requestId, request);

      this.appLogger.log('AI Autonomous purchase completed', {
        userId,
        orderId: order.id,
        requestId,
        amount: product.price,
      });

      // Emit event
      await this.kafka.emit('ai-execution-events', {
        type: 'execution.autonomous_completed',
        userId,
        requestId,
        orderId: order.id,
        productId: product.id,
        productName: product.name,
        price: product.price,
        timestamp: new Date(),
      });

      return {
        id: requestId,
        userId,
        mode: 'autonomous',
        status: 'completed',
        selectedProduct: {
          id: product.id,
          name: product.name,
          price: product.price,
          rank: product.rank,
          score: product.score,
        },
        amount: product.price,
        message: `Order #${order.id} placed successfully for ${product.name}`,
        createdAt: new Date(),
        order: {
          id: order.id,
          status: order.status,
        },
      };
    } catch (error) {
      this.logger.error('Autonomous execution failed', (error as any).message);

      // Update request with failure
      request.status = 'failed';
      request.error = (error as any).message;
      this.executionRequests.set(requestId, request);

      // Emit failure event
      await this.kafka.emit('ai-execution-events', {
        type: 'execution.autonomous_failed',
        userId,
        requestId,
        productId: product.id,
        error: (error as any).message,
        retries: request.retryCount,
        timestamp: new Date(),
      });

      throw new InternalServerException('Autonomous execution failed', {
        requestId,
        error: (error as any).message,
        retryCount: request.retryCount,
      });
    }
  }

  /**
   * Approve a pending execution request
   * Used in approval mode when user approves
   */
  async approveExecution(
    userId: number,
    approveDto: ApproveOrderDto
  ): Promise<ApprovalResponseDto> {
    try {
      const { executionRequestId, approved, rejectionReason } = approveDto;

      // Get execution request
      const request = this.executionRequests.get(executionRequestId);
      if (!request) {
        throw new NotFoundException('Execution request not found', {
          requestId: executionRequestId,
        });
      }

      // Verify ownership
      if (request.userId !== userId) {
        throw new UnauthorizedException('You do not own this execution request');
      }

      // Check if expired
      if (request.expiresAt && new Date() > request.expiresAt) {
        throw new ValidationException('Approval request has expired', {
          requestId: executionRequestId,
        });
      }

      if (!approved) {
        // User rejected
        request.status = 'failed';
        this.executionRequests.set(executionRequestId, request);

        this.appLogger.log('Execution request rejected by user', {
          userId,
          requestId: executionRequestId,
          reason: rejectionReason,
        });

        await this.kafka.emit('ai-execution-events', {
          type: 'execution.approval_rejected',
          userId,
          requestId: executionRequestId,
          productId: request.productId,
          reason: rejectionReason,
          timestamp: new Date(),
        });

        return {
          executionRequestId,
          approved: false,
          message: `Request rejected: ${rejectionReason || 'No reason provided'}`,
        };
      }

      // User approved - execute purchase
      try {
        request.status = 'executing';

        // Get product details
        const product = await this.getProductDetails(request.productId);

        // Execute order with retry
        const order = await this.executeWithRetry(
          () => this.createOrder(userId, product, executionRequestId),
          'approval_order_creation'
        );

        request.status = 'completed';
        request.orderId = order.id;
        this.executionRequests.set(executionRequestId, request);

        this.appLogger.log('Approved execution completed', {
          userId,
          orderId: order.id,
          executionRequestId,
        });

        await this.kafka.emit('ai-execution-events', {
          type: 'execution.approval_executed',
          userId,
          requestId: executionRequestId,
          orderId: order.id,
          timestamp: new Date(),
        });

        return {
          executionRequestId,
          approved: true,
          message: `Order #${order.id} placed successfully`,
          orderId: order.id,
        };
      } catch (error) {
        request.status = 'failed';
        request.error = (error as any).message;
        this.executionRequests.set(executionRequestId, request);

        this.appLogger.error('Approved execution failed', undefined, {
          userId,
          executionRequestId,
          error: (error as any).message,
        });

        return {
          executionRequestId,
          approved: false,
          message: `Execution failed: ${(error as any).message}`,
          error: (error as any).message,
        };
      }
    } catch (error) {
      this.logger.error('Failed to process approval', (error as any).message);
      if (error instanceof ValidationException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerException('Failed to process approval');
    }
  }

  /**
   * Select best product from list based on ranking
   */
  private async selectBestProduct(productIds: number[], intent: any): Promise<any> {
    try {
      // Fetch products
      const products = await this.prisma.product.findMany({
        where: {
          id: { in: productIds },
        },
      });

      if (products.length === 0) {
        return null;
      }

      // If single product, use it
      if (products.length === 1) {
        return {
          ...products[0],
          rank: 1,
          score: 85,
          confidence: 0.9,
        };
      }

      // Mock ranking - in production would call ranking engine
      // For now, return lowest price within budget
      let best = products[0];
      for (const product of products) {
        if (
          intent?.budget?.max &&
          product.price <= intent.budget.max &&
          product.price < best.price
        ) {
          best = product;
        }
      }

      return {
        ...best,
        rank: 1,
        score: Math.floor(Math.random() * 20 + 80), // 80-100
        confidence: Math.random() * 0.15 + 0.85, // 0.85-1.0
      };
    } catch (error) {
      this.logger.error('Product selection failed', (error as any).message);
      return null;
    }
  }

  /**
   * Validate if execution is allowed
   */
  async validateExecution(
    userId: number,
    productId: number,
    validation: ValidateExecutionDto
  ): Promise<ValidationResultDto> {
    try {
      const errors: string[] = [];
      const warnings: string[] = [];

      // Get wallet
      const wallet = await this.wallet.getWallet(userId);

      // Check AI authorization
      if (!wallet.isAiAuthorized) {
        errors.push('AI spending not authorized on this wallet');
      }

      // Check if wallet locked
      if (wallet.isLocked) {
        errors.push(`Wallet is locked: ${wallet.lockReason || 'Suspicious activity'}`);
      }

      // Check balance
      if (wallet.balance < validation.amount) {
        errors.push(
          `Insufficient balance. Available: ₹${wallet.balance}, Required: ₹${validation.amount}`
        );
      }

      // Check max per order limit
      if (wallet.maxPerOrder && validation.amount > wallet.maxPerOrder) {
        errors.push(
          `Exceeds max per order limit. Max: ₹${wallet.maxPerOrder}, Amount: ₹${validation.amount}`
        );
      }

      // Check daily limit
      if (wallet.dailyLimit) {
        const dailyRemaining = wallet.dailyLimit - wallet.dailySpentToday;
        if (validation.amount > dailyRemaining) {
          errors.push(
            `Would exceed daily limit. Daily Limit: ₹${wallet.dailyLimit}, Already spent: ₹${wallet.dailySpentToday}, Remaining: ₹${dailyRemaining}`
          );
        }
      }

      // Check AI spending limit
      if (validation.isAiAuthorized && wallet.aiSpendingLimit) {
        if (validation.amount > wallet.aiSpendingLimit) {
          errors.push(
            `Exceeds AI spending limit. Max: ₹${wallet.aiSpendingLimit}, Amount: ₹${validation.amount}`
          );
        }
      }

      // Warnings
      if (wallet.balance - validation.amount < 1000) {
        warnings.push('Low wallet balance after transaction');
      }

      const isValid = errors.length === 0;

      return {
        isValid,
        canExecute: isValid,
        walletStatus: {
          balance: wallet.balance,
          maxPerOrder: wallet.maxPerOrder,
          dailyLimit: wallet.dailyLimit,
          dailySpentToday: wallet.dailySpentToday,
          isAiAuthorized: wallet.isAiAuthorized,
          aiSpendingLimit: wallet.aiSpendingLimit,
        },
        errors,
        warnings,
        recommendation: isValid
          ? 'All checks passed. Ready to execute.'
          : `Cannot execute: ${errors.join('; ')}`,
      };
    } catch (error) {
      this.logger.error('Validation failed', (error as any).message);
      throw new InternalServerException('Validation check failed');
    }
  }

  /**
   * Execute with exponential backoff retry logic
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 1; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        this.appLogger.log(`${operationName}: Attempt ${attempt}/${this.retryConfig.maxRetries}`);
        return await operation();
      } catch (error) {
        lastError = error;
        this.logger.warn(`${operationName} attempt ${attempt} failed: ${(error as any).message}`);

        // Don't retry on validation/auth errors
        if (
          (error as any).statusCode === 400 ||
          (error as any).statusCode === 401 ||
          (error as any).statusCode === 404
        ) {
          throw error;
        }

        // Calculate backoff delay
        if (attempt < this.retryConfig.maxRetries) {
          const delay = Math.min(
            this.retryConfig.initialDelayMs *
              Math.pow(this.retryConfig.backoffMultiplier, attempt - 1),
            this.retryConfig.maxDelayMs
          );

          this.appLogger.log(
            `${operationName}: Retrying in ${delay}ms (Attempt ${attempt + 1}/${this.retryConfig.maxRetries})`
          );

          await this.sleep(delay);
        }
      }
    }

    throw new InternalServerException(
      `${operationName} failed after ${this.retryConfig.maxRetries} retries`,
      {
        lastError: (lastError as any).message,
      }
    );
  }

  /**
   * Create order and debit wallet
   */
  private async createOrder(
    userId: number,
    product: any,
    executionRequestId: string,
    metadata?: Record<string, any>
  ): Promise<any> {
    try {
      // Debit wallet
      const debitResult = await this.wallet.debitWallet(userId, {
        amount: product.price,
        type: 'purchase',
        isAiAuthorized: true,
        aiRequestId: executionRequestId,
        reason: `AI auto-purchase: ${product.name}`,
        metadata: {
          ...metadata,
          productId: product.id,
          executionRequestId,
        },
      });

      // Create mock order (in production, integrate with Order service)
      const order = {
        id: Math.floor(Math.random() * 100000),
        userId,
        status: 'pending',
        total: product.price,
        createdAt: new Date(),
        items: [
          {
            productId: product.id,
            productName: product.name,
            price: product.price,
            quantity: 1,
          },
        ],
      };

      this.appLogger.log('Order created', {
        orderId: order.id,
        userId,
        amount: product.price,
      });

      return order;
    } catch (error) {
      this.logger.error('Order creation failed', (error as any).message);
      throw error;
    }
  }

  /**
   * Get product details
   */
  private async getProductDetails(productId: number): Promise<any> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found', { productId });
    }

    return product;
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get execution stats for user
   */
  async getExecutionStats(userId: number): Promise<ExecutionStatsDto> {
    try {
      const userRequests = Array.from(this.executionRequests.values()).filter(
        (r) => r.userId === userId
      );

      const completed = userRequests.filter((r) => r.status === 'completed');
      const failed = userRequests.filter((r) => r.status === 'failed');

      const totalSpent = completed.reduce((sum, r) => sum + r.amount, 0);
      const successRate =
        userRequests.length > 0 ? (completed.length / userRequests.length) * 100 : 0;
      const avgRetries =
        userRequests.length > 0
          ? userRequests.reduce((sum, r) => sum + r.retryCount, 0) / userRequests.length
          : 0;

      return {
        totalRequests: userRequests.length,
        successfulPurchases: completed.length,
        failedAttempts: failed.length,
        suggestionsProvided: userRequests.filter((r) => r.mode === 'suggestion').length,
        totalSpent,
        averageOrderValue: completed.length > 0 ? totalSpent / completed.length : 0,
        successRate: Math.round(successRate),
        averageRetries: Math.round(avgRetries * 100) / 100,
      };
    } catch (error) {
      this.logger.error('Failed to get execution stats', (error as any).message);
      throw new InternalServerException('Failed to retrieve execution statistics');
    }
  }
}
