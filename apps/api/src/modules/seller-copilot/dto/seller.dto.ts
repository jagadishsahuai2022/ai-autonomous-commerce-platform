/**
 * Seller AI Copilot DTOs
 * Request and response types for seller operations
 */

// ============= Seller Profile =============

export class CreateSellerDto {
  storeName: string;
  storeDescription?: string;
  storeImageUrl?: string;
  category?: string;
  autoGenListings?: boolean;
  usePricingSuggestions?: boolean;
  useDemandPrediction?: boolean;
}

export class UpdateSellerDto {
  storeName?: string;
  storeDescription?: string;
  storeImageUrl?: string;
  category?: string;
  autoGenListings?: boolean;
  usePricingSuggestions?: boolean;
  useDemandPrediction?: boolean;
  vendorTier?: string;
}

export class SellerProfileDto {
  id: number;
  userId: number;
  storeName: string;
  storeDescription?: string;
  storeImageUrl?: string;
  totalSales: number;
  totalSold: number;
  averageRating: number;
  ratingCount: number;
  category?: string;
  vendorTier: string;
  isActive: boolean;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  stats?: {
    activeListings: number;
    totalViews: number;
    conversionRate: number;
  };
}

// ============= Auto Listing Generator =============

export class GenerateListingDto {
  title: string;
  basePrice: number;
  category: string;
  subCategory?: string;
  basicDescription?: string;
  images?: string[];
  templateId?: number;
  quantity: number;
  costPrice?: number;
  keywords?: string[];
}

export class GeneratedListingResponseDto {
  id?: number;
  title: string;
  generatedDescription: string;
  bulletPoints: string[];
  suggestedPrice: number;
  basePrice: number;
  category: string;
  listingScore: number; // 0-100 quality score
  recommendations: {
    titleTip: string;
    descriptionTip: string;
    priceTip: string;
    keywordsTip: string;
  };
  generatedMetadata: {
    keywords: string[];
    tone: string;
    focusAreas: string[];
  };
}

export class ListingTemplateDto {
  id?: number;
  name: string;
  category: string;
  titleTemplate: string;
  descriptionTemplate: string;
  bulletPoints: string[];
  tone?: string;
  focusKeywords?: string[];
  isActive?: boolean;
}

// ============= Price Suggestions =============

export class GetPriceSuggestionsDto {
  productId?: number;
  category?: string;
  basePrice: number;
  costPrice?: number;
  currentInventory: number;
  demandLevel?: 'low' | 'medium' | 'high';
  competitorPrices?: number[];
  lookbackDays?: number; // Historical data to consider
}

export class PriceSuggestionResponseDto {
  recommendedPrice: number;
  priceRange: {
    min: number;
    max: number;
  };
  reasoning: {
    factorAnalysis: {
      demand: string;
      competition: string;
      margin: string;
      seasonality: string;
    };
    confidence: number; // 0-100
    expectedImpact: {
      estimatedSalesLift: number; // percentage
      estimatedRevenueChange: number; // currency
      conversionRateImprovement: number; // percentage
    };
  };
  alternatives: Array<{
    price: number;
    reason: string;
    expectedOutcome: string;
  }>;
  historicalContext: {
    previousPrice: number;
    priceChangeFrequency: string;
    averagePriceForCategory: number;
  };
}

export class ApplyPriceSuggestionDto {
  productId: number;
  suggestedPrice: number;
  reason?: string;
}

// ============= Demand Prediction =============

export class GetDemandPredictionDto {
  scope: 'product' | 'category' | 'overall';
  scopeId?: string; // product or category ID
  forecastDays?: number; // 7, 14, 30 (default: 7)
  includeHistorical?: boolean;
}

export class DemandPredictionResponseDto {
  scope: string;
  scopeId?: string;
  forecastPeriod: string;

  // Current Metrics
  currentDemand: {
    views: number;
    clicks: number;
    conversions: number;
    conversionRate: number;
  };

  // Prediction
  predictedDemand: {
    expectedViews: number;
    expectedClicks: number;
    expectedConversions: number;
    expectedConversionRate: number;
    confidence: number; // 0-100
  };

  // Insights
  trend: {
    direction: 'up' | 'down' | 'stable';
    percentageChange: number;
    reason: string;
  };

  seasonality: {
    factor: number; // 1.0 = normal, >1.0 = peak, <1.0 = low
    explanation: string;
    peakDates?: string[];
  };

  // Recommendations
  recommendations: {
    inventoryRecommendation: string; // e.g., "Increase stock by 50%"
    priceAction?: string; // e.g., "Consider reducing price"
    promotionSuggestion?: string; // e.g., "Run a flash sale"
    productMixAdvice?: string;
  };

  // Historical for context
  historical?: {
    lastWeekDemand: number;
    lastMonthDemand: number;
    previousPredictionAccuracy: number;
  };

  // Product-specific insights
  topProducts?: Array<{
    productId: number;
    name: string;
    predictedDemand: number;
    recommendation: string;
  }>;
}

export class DemandInsightDto {
  insights: {
    highDemandProducts: Array<{
      productId: number;
      name: string;
      demandScore: number;
      action: string;
    }>;
    lowDemandProducts: Array<{
      productId: number;
      name: string;
      demandScore: number;
      action: string;
    }>;
    categoryOutlook: string;
    sellerOpportunities: string[];
  };
  actionItems: Array<{
    priority: 'high' | 'medium' | 'low';
    action: string;
    expectedImpact: string;
  }>;
}

// ============= Dashboard Analytics =============

export class DashboardMetricsDto {
  overview: {
    activeListings: number;
    totalSales: number;
    totalRevenue: number;
    averageRating: number;
    storageUsage: number;
  };

  performanceMetrics: {
    totalViews: number;
    totalClicks: number;
    totalConversions: number;
    overallConversionRate: number;
    weekOverWeekGrowth: number;
  };

  aiInsights: {
    generatedListingsCount: number;
    avgGeneratedListingScore: number;
    priceSuggestionsAccepted: number;
    revenueLiftFromAi: number;
    demandForecastAccuracy: number;
  };

  topPerformers: {
    bestSellingProducts: Array<{
      id: number;
      name: string;
      sales: number;
      revenue: number;
    }>;
    bestPerformingCategories: Array<{
      category: string;
      conversionRate: number;
      revenue: number;
    }>;
  };

  recommendations: Array<{
    type: 'listing' | 'pricing' | 'demand' | 'inventory';
    priority: 'high' | 'medium' | 'low';
    message: string;
    action: string;
    estimatedImpact: string;
  }>;

  trends: {
    demandTrend: 'up' | 'down' | 'stable';
    priceTrend: string;
    inventoryHealth: string;
    customerSatisfaction: number;
  };
}

export class SellerProductDto {
  id?: number;
  title: string;
  description?: string;
  category: string;
  subCategory?: string;
  basePrice: number;
  currentPrice: number;
  costPrice?: number;
  quantity: number;
  images?: string[];
  sku?: string;
  status?: string;
  views?: number;
  clicks?: number;
  conversions?: number;
  conversionRate?: number;
  demandScore?: number;
  listingScore?: number;
  autoGeneratedText?: boolean;
  publishedAt?: Date;
}

export class ProductPerformanceDto {
  productId: number;
  name: string;
  views: number;
  clicks: number;
  conversions: number;
  conversionRate: number;
  revenue: number;
  demandScore: number;
  listingScore: number;
  priceOptimizationOpportunity?: {
    currentPrice: number;
    recommendedPrice: number;
    estimatedRevenueGain: number;
  };
}

export class BulkOperationDto {
  operation: 'bulk_price_update' | 'bulk_generate_listings' | 'bulk_apply_suggestions';
  productIds: number[];
  parameters?: Record<string, any>;
}

// ============= AI Configuration =============

export class ConfigureAiSettingsDto {
  autoGenListings?: boolean;
  usePricingSuggestions?: boolean;
  useDemandPrediction?: boolean;
  aiModel?: string; // gpt-3.5, gpt-4, claude, etc.
  tone?: string; // professional, casual, luxury, etc.
  updateFrequency?: string; // daily, weekly, monthly
  preferences?: Record<string, any>;
}

// ============= Response Wrappers =============

export class ApiResponseDto<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  timestamp: Date;
}

export class PaginatedResponseDto<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
