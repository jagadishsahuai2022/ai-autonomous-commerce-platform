/**
 * Wallet Controller
 * Provides REST API endpoints for wallet operations
 * All endpoints require JWT authentication
 */

import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { User } from '../../common/decorators/user.decorator';
import type { AuthenticatedUser } from '../../common/decorators/user.decorator';
import { WalletService } from './wallet.service';
import type {
  AddMoneyDto,
  SetSpendingLimitDto,
  AuthorizeAiDto,
  DebitWalletDto,
  AuthorizeSpendingDto,
  WalletResponseDto,
  WalletTransactionResponseDto,
  DebitResponseDto,
  AuthorizeSpendingResponseDto,
} from './dto/wallet.dto';

@Controller('wallet')
@UseGuards(JwtGuard)
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  /**
   * GET /wallet
   * Get current wallet status and balance
   * Returns: Wallet details including balance, limits, and AI authorization status
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async getWallet(@User() user: AuthenticatedUser): Promise<WalletResponseDto> {
    return this.walletService.getWallet(user.userId);
  }

  /**
   * POST /wallet/add
   * Add money to wallet
   * Supports idempotency via referenceId
   *
   * Request Body:
   * {
   *   "amount": 10000,
   *   "paymentMethodId": "credit_card_4242",
   *   "referenceId": "unique-transaction-id",
   *   "description": "Top-up via credit card"
   * }
   *
   * Response: Transaction details
   */
  @Post('add')
  @HttpCode(HttpStatus.CREATED)
  async addMoney(
    @Body() addMoneyDto: AddMoneyDto,
    @User() user: AuthenticatedUser
  ): Promise<WalletTransactionResponseDto> {
    return this.walletService.addMoney(user.userId, addMoneyDto);
  }

  /**
   * PUT /wallet/limits
   * Set spending limits for the wallet
   * Can set: max per order, daily limit, AI spending limit
   *
   * Request Body:
   * {
   *   "maxPerOrder": 50000,
   *   "dailyLimit": 100000,
   *   "aiSpendingLimit": 10000,
   *   "reason": "Security policy update"
   * }
   *
   * Response: Updated spending limits
   */
  @Put('limits')
  @HttpCode(HttpStatus.OK)
  async setSpendingLimits(
    @Body() limitDto: SetSpendingLimitDto,
    @User() user: AuthenticatedUser
  ): Promise<any> {
    return this.walletService.setSpendingLimits(user.userId, limitDto);
  }

  /**
   * POST /wallet/authorize-ai
   * Enable or disable AI authorization for wallet spending
   * When enabled, AI can automatically spend up to aiSpendingLimit
   *
   * Request Body:
   * {
   *   "authorized": true,
   *   "spendingLimit": 10000,
   *   "reason": "Enabling AI for smart shopping"
   * }
   *
   * Response: Updated wallet with AI status
   */
  @Post('authorize-ai')
  @HttpCode(HttpStatus.OK)
  async authorizeAi(
    @Body() authDto: AuthorizeAiDto,
    @User() user: AuthenticatedUser
  ): Promise<WalletResponseDto> {
    return this.walletService.authorizeAi(user.userId, authDto);
  }

  /**
   * POST /wallet/authorize
   * Create a spending authorization for AI
   * Used when AI needs approval before spending
   * Authorization expires after specified time or must be manually executed
   *
   * Request Body:
   * {
   *   "amount": 25000,
   *   "purpose": "product_purchase",
   *   "proposedProducts": [
   *     { "id": 1, "name": "Laptop", "price": 25000, "quantity": 1 }
   *   ],
   *   "expiresIn": 3600,
   *   "aiRequestId": "ai-request-12345"
   * }
   *
   * Response: Authorization ID, status, expiry time
   */
  @Post('authorize')
  @HttpCode(HttpStatus.CREATED)
  async authorizeSpending(
    @Body() authDto: AuthorizeSpendingDto,
    @User() user: AuthenticatedUser
  ): Promise<AuthorizeSpendingResponseDto> {
    return this.walletService.authorizeSpending(user.userId, authDto);
  }

  /**
   * POST /wallet/debit
   * Debit money from wallet for a purchase
   * Enforces all spending limits (max per order, daily limit, AI limit)
   *
   * Rules enforced:
   * - Max per order limit (if set)
   * - Daily spending limit (if set)
   * - AI spending limit (if AI-authorized transaction)
   * - Wallet must be active and not locked
   *
   * Request Body:
   * {
   *   "amount": 25000,
   *   "type": "purchase",
   *   "orderId": 123,
   *   "reason": "Purchase order #123",
   *   "isAiAuthorized": true,
   *   "aiRequestId": "ai-request-12345",
   *   "metadata": { "orderDetails": "..." }
   * }
   *
   * Response: Success status, transaction details, updated balance
   */
  @Post('debit')
  @HttpCode(HttpStatus.OK)
  async debitWallet(
    @Body() debitDto: DebitWalletDto,
    @User() user: AuthenticatedUser
  ): Promise<DebitResponseDto> {
    return this.walletService.debitWallet(user.userId, debitDto);
  }

  /**
   * GET /wallet/transactions
   * Get transaction history for the wallet
   * Supports pagination
   *
   * Query Parameters:
   * - limit: Maximum number of transactions to return (default: 50)
   * - offset: Number of transactions to skip for pagination (default: 0)
   *
   * Response: Array of transactions, ordered by most recent first
   */
  @Get('transactions')
  @HttpCode(HttpStatus.OK)
  async getTransactionHistory(
    @Query('limit') limit: string = '50',
    @Query('offset') offset: string = '0',
    @User() user: AuthenticatedUser
  ): Promise<WalletTransactionResponseDto[]> {
    return this.walletService.getTransactionHistory(user.userId, parseInt(limit), parseInt(offset));
  }
}
