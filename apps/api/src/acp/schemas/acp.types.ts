/**
 * Agentic Commerce Protocol (ACP) Type Definitions
 * Standardized message format for agent-to-merchant communication
 * Part 1 & 3: ACP Core Architecture + Message Schema
 */

// ============================================
// AGENT REQUEST SCHEMA
// ============================================

export interface AgentContext {
  userId: string;
  sessionId: string;
  deviceType: 'mobile' | 'web' | 'voice' | 'api';
  locale: string;
  currency: string;
  timestamp: Date;
}

export interface UserConstraints {
  maxBudget: number;
  minBudget?: number;
  preferredDelivery?: 'express' | 'standard' | 'scheduled';
  acceptableDeliveryDays: number;
  paymentMethods: string[];
  excludedSellers?: string[];
  preferredBrands?: string[];
}

export interface UserPreferences {
  sustainabilityScore?: number; // 0-100
  localPreference?: number; // 0-100
  trustScore?: number; // 0-100
  priceVsFunctionality?: number; // 0-100 (0=price focus, 100=functionality)
  riskTolerance?: 'low' | 'medium' | 'high';
  communicationStyle?: 'verbose' | 'concise' | 'detailed_explanations';
}

export interface SearchIntent {
  query: string;
  category?: string;
  attributes?: Record<string, any>;
  fuzzyMatch?: boolean;
}

export interface AgentRequest {
  // Metadata
  requestId: string;
  correlationId: string;
  timestamp: Date;
  version: string; // ACP version

  // Core data
  intent: SearchIntent | ProductId | CheckoutIntent;
  constraints: UserConstraints;
  userContext: AgentContext;
  preferences: UserPreferences;

  // Optional: previous context
  sessionHistory?: AgentRequest[];
  errorContext?: {
    previousError: string;
    retryCount: number;
  };
}

// ============================================
// AGENT RESPONSE SCHEMA
// ============================================

export interface ProductOption {
  productId: string;
  title: string;
  price: number;
  currency: string;
  seller: SellerInfo;
  availability: 'in_stock' | 'low_stock' | 'out_of_stock' | 'preorder';
  deliveryEstimate: {
    minDays: number;
    maxDays: number;
    type: string;
  };
  ratings: {
    score: number; // 0-5
    count: number;
    trustScore: number; // 0-100 (seller reputation)
  };
  attributes?: Record<string, any>;
  image?: string;
  relevanceScore: number; // 0-100
}

export interface SellerInfo {
  sellerId: string;
  name: string;
  trustScore: number; // 0-100
  responseTime?: number; // minutes
  returnPolicy?: string;
}

export interface AlternativeOption {
  productId: string;
  title: string;
  price: number;
  reason: string; // Why this is better/different
  improvementFactor: string; // e.g., "10% cheaper", "better ratings", "faster delivery"
  relevanceScore: number;
}

export interface AgentResponse {
  // Metadata
  responseId: string;
  requestId: string;
  correlationId: string;
  timestamp: Date;
  processingTimeMs: number;
  version: string;

  // Core data
  options: ProductOption[];
  selectedOption?: ProductOption;
  alternatives: AlternativeOption[];

  // Decision info
  decisionType: 'search' | 'recommendation' | 'auto_selected' | 'awaiting_approval';
  confidenceScore: number; // 0-100
  reasoning: string;
  explainability: {
    primaryFactors: string[];
    secondaryFactors: string[];
    tradeoffs: string[];
  };

  // Warnings/errors
  warnings: string[];
  errors: string[];

  // Next steps
  nextAction?: 'display_options' | 'confirm_selection' | 'require_input' | 'proceed_to_checkout';
  requiresUserApproval: boolean;
}

// ============================================
// CHECKOUT INTENT & PROCESS
// ============================================

export interface ProductId {
  productId: string;
  quantity: number;
}

export interface CheckoutIntent {
  products: ProductId[];
  deliveryAddress?: string;
  preferredDeliveryDate?: Date;
}

export interface CheckoutRequest extends AgentRequest {
  intent: CheckoutIntent;
  paymentToken: string; // Tokenized payment (PART 4)
  idempotencyKey: string;
  acceptTerms: boolean;
}

export interface OrderConfirmation {
  orderId: string;
  status: 'confirmed' | 'pending' | 'processing' | 'failed';
  items: Array<{
    productId: string;
    quantity: number;
    price: number;
    seller: SellerInfo;
  }>;
  totalAmount: number;
  currency: string;
  estimatedDelivery: {
    minDate: Date;
    maxDate: Date;
  };
  paymentStatus: 'completed' | 'pending' | 'failed';
  trackingId?: string;
  nextSteps: string[];
  confirmationUrl: string;
}

export interface CheckoutResponse {
  responseId: string;
  requestId: string;
  correlationId: string;
  timestamp: Date;
  processingTimeMs: number;
  version: string;

  status: 'success' | 'failed' | 'awaiting_payment' | 'awaiting_confirmation';
  confirmation?: OrderConfirmation;
  nextAction: 'display_confirmation' | 'payment_required' | 'approval_required' | 'succeeded';

  errors?: string[];
}

// ============================================
// MERCHANT ADAPTER INTERFACE
// ============================================

export interface MerchantAdapterResponse {
  productId: string;
  available: boolean;
  price: number;
  deliveryDays: number;
  seller: SellerInfo;
  responseMeta: {
    source: string;
    latencyMs: number;
    timestamp: Date;
  };
}

export interface MerchantAdapter {
  name: string;
  supportedOperations: ('search' | 'quote' | 'checkout')[];

  search(query: string, context: AgentContext): Promise<ProductOption[]>;
  quote(productId: string, quantity: number): Promise<MerchantAdapterResponse>;
  checkout(order: CheckoutIntent, paymentToken: string): Promise<OrderConfirmation>;
}

// ============================================
// VERIFICATION RESULT
// ============================================

export interface VerificationResult {
  passed: boolean;
  checks: {
    budgetCompliance: {
      passed: boolean;
      message: string;
      allocatedBudget: number;
      proposedSpend: number;
    };
    productAvailability: {
      passed: boolean;
      message: string;
      unavailableItems: string[];
    };
    sellerTrust: {
      passed: boolean;
      message: string;
      trustScores: Record<string, number>;
      riskFlags: string[];
    };
    deliveryConstraints: {
      passed: boolean;
      message: string;
      deliveryDays: number;
      acceptableDays: number;
    };
  };
  blockingReasons: string[];
  warnings: string[];
  timestamp: Date;
}

// ============================================
// PAYMENT TOKEN (PART 4)
// ============================================

export interface PaymentToken {
  tokenId: string;
  userId: string;
  encryptedData: string;
  authorizationLimit: number;
  currency: string;
  expiresAt: Date;
  lastUsed?: Date;
  issuedAt: Date;
  metadata?: Record<string, any>;
}

// ============================================
// KAFKA EVENT SCHEMAS (PART 7)
// ============================================

export interface AgentRequestCreatedEvent {
  requestId: string;
  correlationId: string;
  userId: string;
  intentType: string;
  timestamp: Date;
  constraints: UserConstraints;
}

export interface AgentResponseGeneratedEvent {
  responseId: string;
  requestId: string;
  correlationId: string;
  userId: string;
  optionsCount: number;
  selectedOptionId?: string;
  confidenceScore: number;
  processingTimeMs: number;
  timestamp: Date;
}

export interface AgentCheckoutInitiatedEvent {
  checkoutId: string;
  correlationId: string;
  userId: string;
  orderId: string;
  productIds: string[];
  totalAmount: number;
  currency: string;
  timestamp: Date;
}

export interface AgentCheckoutCompletedEvent {
  checkoutId: string;
  correlationId: string;
  userId: string;
  orderId: string;
  status: 'success' | 'failed';
  totalAmount: number;
  currency: string;
  failureReason?: string;
  timestamp: Date;
}

// ============================================
// HTTP ERROR RESPONSES
// ============================================

export interface ACPErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
    requestId: string;
    timestamp: Date;
  };
}
