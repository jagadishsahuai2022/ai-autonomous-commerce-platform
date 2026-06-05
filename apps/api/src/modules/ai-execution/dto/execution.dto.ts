/**
 * AI Execution Agent DTOs
 * Type-safe request/response models for AI purchase operations
 */

// ============================================================================
// Request DTOs
// ============================================================================

export class ExecuteOrderDto {
  /**
   * List of product IDs to consider for purchase
   * AI will select best match based on ranking
   */
  productIds: number[];

  /**
   * User's shopping intent from analysis
   * Contains budget, preferences, quality requirements
   */
  intent: {
    user_intent: string;
    confidence: number;
    budget?: { min: number; max: number };
    preferences?: string[];
  };

  /**
   * Execution mode
   */
  mode: 'suggestion' | 'approval' | 'autonomous';

  /**
   * Maximum products AI will suggest
   * (default: 1 for purchase, can be higher for suggestions)
   */
  maxProducts?: number;

  /**
   * Metadata for tracking
   */
  metadata?: Record<string, any>;
}

export class ValidateExecutionDto {
  /**
   * Product ID to validate for purchase
   */
  productId: number;

  /**
   * Amount to spend
   */
  amount: number;

  /**
   * Is this for AI authorization
   */
  isAiAuthorized: boolean;
}

export class ApproveOrderDto {
  /**
   * Execution request ID
   */
  executionRequestId: string;

  /**
   * Approved or rejected
   */
  approved: boolean;

  /**
   * Optional reason for rejection
   */
  rejectionReason?: string;
}

// ============================================================================
// Response DTOs
// ============================================================================

export class ExecutionRequestResponseDto {
  id: string; // Unique execution request ID
  userId: number;
  mode: string;
  status: 'pending' | 'approved' | 'executing' | 'completed' | 'failed';
  selectedProduct: {
    id: number;
    name: string;
    price: number;
    rank: number;
    score: number;
    explanation?: string;
  };
  amount: number;
  message: string;
  createdAt: Date;
  expiresAt?: Date; // For approval mode
  order?: {
    id: number;
    status: string;
  };
  error?: string;
}

export class ProductSelectionResponseDto {
  productId: number;
  productName: string;
  price: number;
  rank: number;
  score: number; // 0-100
  confidence: number; // 0-1
  explanation: {
    quality_score: number;
    price_score: number;
    rating_score: number;
    delivery_score: number;
    brand_score: number;
    summary: string;
    strengths: string[];
    weaknesses?: string[];
  };
  selected: boolean;
  reason: string;
}

export class ValidationResultDto {
  isValid: boolean;
  canExecute: boolean;
  walletStatus: {
    balance: number;
    maxPerOrder: number | null;
    dailyLimit: number | null;
    dailySpentToday: number;
    isAiAuthorized: boolean;
    aiSpendingLimit: number | null;
  };
  errors: string[];
  warnings: string[];
  recommendation: string;
}

export class ExecutionSuggestionResponseDto {
  productId: number;
  productName: string;
  price: number;
  rank: number;
  score: number;
  summary: string;
  strengths: string[];
  action: 'purchase_recommended' | 'needs_approval' | 'awaiting_funds';
  nextStep: string;
  estimatedDelivery?: string;
}

export class ApprovalResponseDto {
  executionRequestId: string;
  approved: boolean;
  message: string;
  orderId?: number;
  error?: string;
}

export class ExecutionStatsDto {
  totalRequests: number;
  successfulPurchases: number;
  failedAttempts: number;
  suggestionsProvided: number;
  totalSpent: number;
  averageOrderValue: number;
  successRate: number;
  averageRetries: number;
}
