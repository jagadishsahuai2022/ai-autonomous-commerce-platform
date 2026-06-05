/**
 * AI Service
 * - Intent parsing (NLP)
 * - Product ranking
 * - Recommendations
 */

import { apiClient, ApiResponse, getResponseData, handleApiError } from '@/lib/api-client';
import { AxiosError } from 'axios';

export interface Entity {
  text: string;
  label: string; // PRODUCT, PRICE, CATEGORY, BRAND, FEATURE, etc.
  confidence: number;
  startPos: number;
  endPos: number;
}

export interface IntentPrediction {
  intent: string; // search, compare, recommend, buy, review, help
  confidence: number;
  secondaryIntent?: string;
}

export interface ParsedQuery {
  originalQuery: string;
  intent: IntentPrediction;
  entities: Entity[];
  keywords: string[];
  filters: Record<string, any>;
  structuredQuery: Record<string, any>;
  timestamp: string;
  modelVersion: string;
}

export interface RankedProduct {
  id: string;
  name: string;
  price: number;
  image: string;
  rating: number;
  reviewCount: number;
  compositeScore: number;
  scoreBreakdown: {
    priceScore: number;
    ratingScore: number;
    relevanceScore: number;
    availabilityScore: number;
    sellerTrust: number;
    aiConfidence: number;
  };
  rankingExplanation: string;
  matchedEntities: string[];
}

export interface RankingRequest {
  productIds: string[];
  userPreferences?: {
    budgetMin?: number;
    budgetMax?: number;
    preferredBrands?: string[];
    excludeBrands?: string[];
  };
  context?: {
    keywords?: string[];
    userHistory?: string[];
  };
}

export interface RecommendationRequest {
  userId?: string;
  productId?: string; // For "similar products"
  topN?: number;
  category?: string;
}

export interface ComparisonRequest {
  productIds: string[];
  criteria?: string[]; // price, specs, durability, etc.
}

export interface ComparisonResult {
  products: Array<{
    id: string;
    name: string;
    specs: Record<string, any>;
  }>;
  comparison: {
    criteria: string;
    winner?: string;
    difference?: string;
  }[];
  recommendation?: string;
}

export interface SearchInsight {
  query: string;
  parsedIntent: ParsedQuery;
  searchType: 'filtered' | 'semantic' | 'keyword';
  resultCount: number;
  avgPrice: number;
  topBrand: string;
  estimatedSearchTime: number;
}

/**
 * AI Service
 */
class AIService {
  /**
   * Parse user intent and extract entities from query
   */
  async parseIntent(query: string, userId?: string): Promise<ParsedQuery> {
    try {
      const response = await apiClient.post<ApiResponse<ParsedQuery>>('/ai/intent/parse', {
        query,
        user_id: userId,
      });

      return getResponseData(response);
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  }

  /**
   * Rank products based on user preferences and query
   */
  async rankProducts(data: RankingRequest): Promise<RankedProduct[]> {
    try {
      const response = await apiClient.post<ApiResponse<RankedProduct[]>>('/ai/ranking/rank', data);

      return getResponseData(response);
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  }

  /**
   * Get product recommendations
   */
  async getRecommendations(data: RecommendationRequest): Promise<RankedProduct[]> {
    try {
      const response = await apiClient.post<ApiResponse<RankedProduct[]>>(
        '/ai/ranking/recommend',
        data
      );

      return getResponseData(response);
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  }

  /**
   * Compare products
   */
  async compareProducts(data: ComparisonRequest): Promise<ComparisonResult> {
    try {
      const response = await apiClient.post<ApiResponse<ComparisonResult>>(
        '/ai/comparison/compare',
        data
      );

      return getResponseData(response);
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  }

  /**
   * Get search insights
   */
  async getSearchInsights(query: string): Promise<SearchInsight> {
    try {
      const response = await apiClient.get<ApiResponse<SearchInsight>>('/ai/search/insights', {
        params: { query },
      });

      return getResponseData(response);
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  }

  /**
   * Get batch predictions (for multiple queries)
   */
  async parseBatch(queries: string[]): Promise<ParsedQuery[]> {
    try {
      const response = await apiClient.post<ApiResponse<ParsedQuery[]>>('/ai/intent/batch-parse', {
        queries,
      });

      return getResponseData(response);
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  }

  /**
   * Get supported intents
   */
  async getSupportedIntents(): Promise<string[]> {
    try {
      const response = await apiClient.get<ApiResponse<string[]>>('/ai/intent/supported');

      return getResponseData(response);
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  }

  /**
   * Get AI service health
   */
  async getServiceHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'down';
    latency: number;
    models: Record<string, string>;
  }> {
    try {
      const response = await apiClient.get<
        ApiResponse<{
          status: 'healthy' | 'degraded' | 'down';
          latency: number;
          models: Record<string, string>;
        }>
      >('/ai/health');

      return getResponseData(response);
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  }

  /**
   * Generate product description using AI
   */
  async generateDescription(productId: string, tone?: string): Promise<{ description: string }> {
    try {
      const response = await apiClient.post<ApiResponse<{ description: string }>>(
        `/ai/generate/description/${productId}`,
        { tone }
      );

      return getResponseData(response);
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  }

  /**
   * Get personalized feed
   */
  async getPersonalizedFeed(limit: number = 20): Promise<RankedProduct[]> {
    try {
      const response = await apiClient.get<ApiResponse<RankedProduct[]>>('/ai/feed/personalized', {
        params: { limit },
      });

      return getResponseData(response);
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  }

  /**
   * Analyze sentiment from review text
   */
  async analyzeSentiment(
    text: string
  ): Promise<{ sentiment: 'positive' | 'neutral' | 'negative'; score: number }> {
    try {
      const response = await apiClient.post<
        ApiResponse<{ sentiment: 'positive' | 'neutral' | 'negative'; score: number }>
      >('/ai/analyze/sentiment', { text });

      return getResponseData(response);
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  }
}

export const aiService = new AIService();
