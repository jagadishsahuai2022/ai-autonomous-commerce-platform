/**
 * Autopilot Engine - Core Type Definitions
 * Defines all types for rule engine, decision engine, and automations
 */

export interface AutopilotRule {
  id: string;
  userId: string;
  name: string;
  description?: string;
  status: 'active' | 'inactive' | 'paused';
  type?: 'price_trigger' | 'scheduled' | 'category' | 'brand' | 'hybrid';

  // Conditions
  conditions: RuleCondition[];

  // Execution
  action: AutopilotAction;

  // Safety limits
  maxSpendPerMonth: number;
  maxOrderValue: number;
  maxOrdersPerMonth?: number;
  requiresApproval?: boolean;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  nextEvaluationTime?: Date;
  lastTriggeredAt?: Date;
  triggerCount: number;
  successCount: number;
  failureCount: number;
}

export interface RuleCondition {
  field: 'price' | 'category' | 'brand' | 'rating' | 'stock' | 'date' | 'time';
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains';
  value: any;
  weight?: number; // For confidence scoring
}

export interface AutopilotAction {
  type: 'auto_buy' | 'notify' | 'add_to_cart' | 'wait_for_approval';
  quantity?: number;
  parameters?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface DecisionContext {
  userId: string;
  ruleId?: string;
  rule?: AutopilotRule;
  product: ProductData;
  userHistory: UserPurchaseHistory;
  marketContext?: MarketContext;
  minimumConfidenceThreshold: number;
  rankingScore?: number;
  intentScore?: number;
}

export interface ProductData {
  id: string;
  name: string;
  price: number;
  previousPrice?: number;
  priceHistory?: PricePoint[];
  rating: number;
  reviews?: number;
  availability?: boolean;
  imageUrl?: string;
  category: string;
  brand: string;
  stock: number;
  india?: IndiaLocalizationData;
}

export interface PricePoint {
  price: number;
  timestamp: Date;
  source: string;
}

export interface UserPurchaseHistory {
  totalSpentThisMonth?: number;
  totalSpent?: number;
  totalPurchases: number;
  purchaseCount?: number;
  averageOrderValue?: number;
  preferredCategories?: string[];
  brandPreferences?: Record<string, number>;
  pricePointPreference?: number;
  nextMaxAllowedPurchase?: number;
  purchasesByCategory?: Record<string, number>;
  returnRate: number;
  userId?: string;
  averageRating?: number;
  lastPurchaseDate?: Date;
}

export interface MarketContext {
  priceChange: number; // percentage
  trend: 'rising' | 'falling' | 'stable';
  seasonality: number; // -1 to 1
  competitorCount: number;
  demandIndex: number; // 0-100
}

export interface ConfidenceScore {
  overall: number; // 0-1
  factors: Record<string, number>;
  breakdown:
    | ScoreBreakdown
    | Array<{ factor: string; score: number; weight: number; contribution: number }>;
}

export interface ScoreBreakdown {
  factors: ScoreFactor[];
  rationale: string;
  confidence: number;
  recommendations: string[];
}

export interface ScoreFactor {
  name: string;
  score: number;
  weight: number;
  rationale: string;
}

export interface AutopilotDecision {
  id: string;
  ruleId?: string;
  userId: string;
  productId: string;
  timestamp: Date;
  shouldProceed: boolean;
  confidence: ConfidenceScore;
  reasoning: DecisionReasoning;
  requiresApproval: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  status: 'pending' | 'approved' | 'executed' | 'failed' | 'cancelled' | 'rejected';
}

export interface DecisionReasoning {
  positiveFactors: string[];
  negativeFactors: string[];
  summary: string;
  whyProduct?: string;
  whyNow?: string;
  alternatives?: AlternativeProduct[];
  risks?: string[];
  savingsOpportunity?: number;
}

export interface AlternativeProduct {
  productId: string;
  name: string;
  price: number;
  score: number;
  reason: string;
}

export interface IndiaLocalizationData {
  codAvailable: boolean;
  emiOptions?: EMIOption[];
  deliveryETA?: DeliveryETA;
  localBrand?: boolean;
  hsn?: string;
  gst?: number;
  pincodeCoverage?: string[];
}

export interface EMIOption {
  tenor: number; // months
  rate: number;
  monthlyAmount: number;
  totalAmount: number;
  provider: string;
}

export interface DeliveryETA {
  minDays: number;
  maxDays: number;
  eta?: Date;
  pincode: string;
  carrier?: string;
}

export interface AutopilotEvent {
  id: string;
  type:
    | 'RULE_CREATED'
    | 'RULE_UPDATED'
    | 'RULE_DELETED'
    | 'RULE_TRIGGERED'
    | 'DECISION_MADE'
    | 'PURCHASE_EXECUTED'
    | 'PURCHASE_FAILED'
    | 'APPROVAL_REQUESTED'
    | 'APPROVAL_GRANTED'
    | 'APPROVAL_DENIED'
    | 'PRICE_ALERT'
    | 'ANOMALY_DETECTED';
  userId: string;
  ruleId?: string;
  productId?: string;
  payload?: Record<string, any>;
  metadata?: Record<string, any>;
  timestamp: Date;
  severity?: 'info' | 'warning' | 'error' | 'critical';
  correlationId?: string;
}

export interface AnomalyDetection {
  isAnomaly: boolean;
  type?: 'unusual_frequency' | 'high_value' | 'category_mismatch' | 'budget_violation';
  score: number;
  reason: string;
  requiresReview: boolean;
}

export interface AutopilotAnalytics {
  userId: string;
  period: string;
  totalSavings: number;
  transactionsAutomated: number;
  conversionRate: number;
  averageDecisionAccuracy: number;
  rulePerformance: RulePerformanceMetric[];
}

export interface RulePerformanceMetric {
  ruleId: string;
  ruleName: string;
  successRate: number;
  savingsGenerated: number;
  timeSaved: number;
  engagement: number;
}

export interface ApprovalRequest {
  id: string;
  userId: string;
  ruleId: string;
  decision: AutopilotDecision;
  requestedAt: Date;
  expiresAt: Date;
  status: 'pending' | 'approved' | 'denied';
  approvedBy?: string;
  approvedAt?: Date;
  denialReason?: string;
}
