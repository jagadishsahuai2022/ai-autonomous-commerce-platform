/**
 * AI Memory System DTOs
 */

// ==================== Common DTOs ====================

export class ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  timestamp: Date;
}

export class PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// ==================== Preference DTOs ====================

export class CreatePreferencesDto {
  preferredCategories?: string[];
  avoidedCategories?: string[];
  priceMin?: number;
  priceMax?: number;
  pricePreference?: 'budget' | 'mid-range' | 'luxury';
  preferredBrands?: string[];
  avoidedBrands?: string[];
  minQualityRating?: number;
  preferredShipping?: 'fastest' | 'cheap' | 'any';
  maxDeliveryDays?: number;
  autoDecisionsEnabled?: boolean;
  autoAddToCart?: boolean;
  autoPurchaseEnabled?: boolean;
  autoPurchaseThreshold?: number;
}

export class UpdatePreferencesDto extends CreatePreferencesDto {}

export class PreferencesDto {
  id: number;
  userId: number;
  preferredCategories: string[];
  avoidedCategories: string[];
  priceMin: number | null;
  priceMax: number | null;
  pricePreference: string | null;
  preferredBrands: string[];
  avoidedBrands: string[];
  minQualityRating: number;
  preferredShipping: string | null;
  maxDeliveryDays: number | null;
  autoDecisionsEnabled: boolean;
  autoAddToCart: boolean;
  autoPurchaseEnabled: boolean;
  discountSensitivity: number;
  lastUpdated: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== Buying Pattern DTOs ====================

export class BuyingPatternDto {
  id: number;
  userId: number;
  avgPurchasesPerMonth: number;
  seasonalBuyingPeak: string | null;
  seasonalBuyingLow: string | null;
  dayOfWeekPreference: number | null;
  timeOfDayPreference: string | null;
  topCategories: string[];
  categoryVariety: number;
  actualSpendPerPurchase: number;
  avgDiscount: number;
  purchaseGap: number;
  averageOrderValue: number;
  clickThroughRate: number;
  cartAbandonmentRate: number;
  spendingTrend: 'increasing' | 'decreasing' | 'stable';
  repeatBrandPurchaseRate: number;
  preferredDevice: string | null;
  preferredPlatform: string | null;
  nextLikelyPurchaseCategory: string | null;
  daysUntilNextPurchase: number | null;
  lastAnalyzed: Date;
}

// ==================== Memory Insight DTOs ====================

export class MemoryInsightDto {
  id: number;
  userId: number;
  topInsights: string[];
  recommendedCategories: string[];
  recommendedBrands: string[];
  likelyhoodToConvert: number;
  purchaseProbability: number;
  churnRisk: number;
  autoDecisionConfidence: number;
  emergingInterests: string[];
  fadingInterests: string[];
  topProductRecommendations: string[];
  personalizationLevel: 'low' | 'medium' | 'high';
  conversionLift: number;
  avgOrderValueLift: number;
  engagementIncrease: number;
  predictionAccuracy: number;
  analysisDate: Date;
}

// ==================== User Memory DTOs ====================

export class UserMemoryDto {
  id: number;
  userId: number;
  currentPreferences: Record<string, any>;
  currentPatterns: Record<string, any>;
  preferencesHistory: Record<string, any>[];
  behaviorHistory: Record<string, any>[];
  lastRecommendations: Record<string, any> | null;
  lastSearchQueries: string[];
  viewedProducts: string[];
  wishlistItems: string[];
  reviewedProducts: string[];
  autoDecisionHistory: Record<string, any>[];
  autoDecisionSuccessRate: number;
  memoryAge: number;
  updateCount: number;
  accuracy: number;
  lastAccessed: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== Ranking Personalization DTOs ====================

export class RankingPersonalizationDto {
  id: number;
  userId: number;
  categoryWeights: Record<string, number>;
  brandWeights: Record<string, number> | null;
  priceWeight: number;
  qualityWeight: number;
  brandWeight: number;
  deliveryWeight: number;
  newProductBoost: number;
  viewHistoryWeight: number;
  purchaseHistoryWeight: number;
  wishlistWeight: number;
  version: number;
  confidenceScore: number;
  conversionRate: number;
  lastCalculated: Date;
  createdAt: Date;
}

// ==================== Auto-Decision DTOs ====================

export class AutoDecisionDto {
  id: number;
  userId: number;
  decisionType: 'product_added_to_cart' | 'auto_purchase' | 'recommendation_delivered';
  confidence: number;
  productId: string;
  triggerEvent: string | null;
  userAccepted: boolean | null;
  transactionValue: number | null;
  userSatisfied: boolean | null;
  timestamp: Date;
  createdAt: Date;
}

export class MakeAutoDecisionDto {
  decisionType: 'product_added_to_cart' | 'auto_purchase' | 'recommendation_delivered';
  productId: string;
  triggerEvent?: string;
}

export class AutoDecisionFeedbackDto {
  autoDecisionId: number;
  accepted: boolean;
  satisfied?: boolean;
}

// ==================== Comprehensive DTOs ====================

export class MemorySummaryDto {
  preferences: PreferencesDto;
  patterns: BuyingPatternDto;
  insights: MemoryInsightDto;
  memory: UserMemoryDto;
  ranking: RankingPersonalizationDto;
  recentAutoDecisions: AutoDecisionDto[];
}

export class PersonalizationBoostsDto {
  categories: Record<string, number>;
  brands: Record<string, number>;
  products: Record<string, number>;
  seasonalFactors: Record<string, number>;
}

export class RecommendationDto {
  productId: string;
  productName: string;
  category: string;
  discrepancyReason: string; // Why this product is recommended
  relevanceScore: number; // 0-100
  matchedPreferences: string[]; // Which preferences match
  estimatedScore: number;
  autoAddToReocommendation?: boolean; // Can be added automatically
}

export class RecommendationsResponseDto {
  recommendations: RecommendationDto[];
  explanation: string;
  personalizationLevel: string;
  generateTime: Date;
}

// ==================== Memory Management DTOs ====================

export class UpdateMemoryDto {
  updateType: 'add_preference' | 'remove_preference' | 'reset_memory' | 'update_auto_decisions';
  data?: Record<string, any>;
}

export class MemoryAnalysisDto {
  summary: string;
  keyFindings: string[];
  recommendations: string[];
  score: number; // 0-100 memory quality
  confidence: number; // How confident in analysis
  lastAnalyzed: Date;
}

// ==================== Push Notification DTOs ====================

export class PersonalizedNotificationDto {
  title: string;
  body: string;
  productId?: string;
  category?: string;
  discount?: number;
  urgency: 'low' | 'medium' | 'high';
  personalizationScore: number; // How personalized (0-100)
  estimatedClickRate: number; // Predicted engagement
}
