/**
 * Wallet DTOs
 * Type-safe request/response models for wallet operations
 */

// ============================================================================
// Request DTOs
// ============================================================================

export class AddMoneyDto {
  /**
   * Amount to add to wallet (in cents for precision, e.g., 1000 = $10.00)
   */
  amount: number;

  /**
   * Optional payment method reference
   * e.g., "credit_card_4242", "stripe_payment_12345"
   */
  paymentMethodId?: string;

  /**
   * Optional external transaction ID for idempotency
   * If provided, duplicate requests with same ID will be ignored
   */
  referenceId?: string;

  /**
   * Optional description of the top-up
   */
  description?: string;

  /**
   * Optional metadata
   */
  metadata?: Record<string, any>;
}

export class SetSpendingLimitDto {
  /**
   * Maximum amount per single transaction
   * Set to null to remove limit
   */
  maxPerOrder?: number;

  /**
   * Maximum daily spending limit
   * Set to null to remove limit
   */
  dailyLimit?: number;

  /**
   * AI spending limit per transaction
   * Separate from user limit for additional security
   */
  aiSpendingLimit?: number;

  /**
   * Optional reason for setting this limit
   */
  reason?: string;
}

export class AuthorizeAiDto {
  /**
   * Enable or disable AI authorization
   */
  authorized: boolean;

  /**
   * Maximum amount AI can spend per transaction
   * If not set, uses wallet's maxPerOrder limit
   */
  spendingLimit?: number;

  /**
   * Optional reason for authorizing/revoking
   */
  reason?: string;
}

export class DebitWalletDto {
  /**
   * Amount to debit from wallet
   */
  amount: number;

  /**
   * Type of debit: "purchase", "refund_reversal", "manual"
   */
  type: 'purchase' | 'refund_reversal' | 'manual';

  /**
   * Optional order ID associated with this debit
   */
  orderId?: number;

  /**
   * Optional reason/description
   */
  reason?: string;

  /**
   * Whether this is AI-authorized spending
   */
  isAiAuthorized?: boolean;

  /**
   * Optional authorization request ID
   */
  aiRequestId?: string;

  /**
   * Metadata including order details
   */
  metadata?: Record<string, any>;
}

export class AuthorizeSpendingDto {
  /**
   * Amount to authorize AI to spend
   */
  amount: number;

  /**
   * Products AI proposes to purchase
   */
  proposedProducts?: Array<{
    id: number;
    name: string;
    price: number;
    quantity: number;
  }>;

  /**
   * Purpose of authorization
   */
  purpose: string;

  /**
   * How long this authorization is valid (in seconds)
   * Default: 3600 (1 hour)
   */
  expiresIn?: number;

  /**
   * Unique AI request ID for idempotency
   */
  aiRequestId?: string;

  /**
   * Metadata
   */
  metadata?: Record<string, any>;
}

// ============================================================================
// Response DTOs
// ============================================================================

export class WalletResponseDto {
  id: number;
  userId: number;
  balance: number;
  totalAdded: number;
  totalSpent: number;
  maxPerOrder: number | null;
  dailyLimit: number | null;
  dailySpentToday: number;
  isAiAuthorized: boolean;
  aiSpendingLimit: number | null;
  isActive: boolean;
  isLocked: boolean;
  lockReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class WalletTransactionResponseDto {
  id: number;
  walletId: number;
  type: string;
  amount: number;
  description?: string;
  orderId?: number;
  referenceId?: string;
  status: string;
  reason?: string;
  balanceBefore: number;
  balanceAfter: number;
  ipAddress?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class WalletAuthorizationResponseDto {
  id: number;
  walletId: number;
  amount: number;
  purpose: string;
  status: string;
  approvedAt?: Date;
  executedAt?: Date;
  expiresAt: Date;
  createdAt: Date;
}

export class DebitResponseDto {
  success: boolean;
  message: string;
  transaction: WalletTransactionResponseDto;
  walletBalance: number;
}

export class AuthorizeSpendingResponseDto {
  success: boolean;
  authorizationId: number;
  amount: number;
  status: string;
  expiresAt: Date;
  message: string;
}

export class WalletStatusDto {
  userId: number;
  balance: number;
  isActive: boolean;
  isAiAuthorized: boolean;
  dailyStatus: {
    limit: number | null;
    spent: number;
    remaining: number;
  };
  maxPerOrderLimit: number | null;
  transactionHistory: WalletTransactionResponseDto[];
  lastTransaction?: WalletTransactionResponseDto;
  metadata?: Record<string, any>;
}

export class SpendingLimitResponseDto {
  maxPerOrder: number | null;
  dailyLimit: number | null;
  aiSpendingLimit: number | null;
  dailySpentToday: number;
  remainingDaily: number | null;
  lastUpdated: Date;
}
