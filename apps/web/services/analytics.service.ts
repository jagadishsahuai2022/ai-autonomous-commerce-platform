/**
 * Analytics & Insights Service
 * - AI-driven insights
 * - Demand forecasting
 * - Pricing recommendations
 * - Trending products
 */

import { apiClient, getResponseData, handleApiError } from '@/lib/api-client';
import { AxiosError } from 'axios';

export interface PricingInsight {
  productId: string;
  currentPrice: number;
  suggestedPrice: number;
  priceOptimization: number; // percentage
  confidence: number;
  reasoning: string;
}

export interface DemandTrend {
  category: string;
  trend: 'up' | 'down' | 'stable';
  percentageChange: number;
  forecastedDemand: number;
  products: string[];
}

export interface UserInsight {
  browsingBehavior: string;
  purchasePattern: string;
  recommendedProducts: string[];
  bestTimeToNotify: string;
}

export interface InsightsDashboard {
  pricingInsights: PricingInsight[];
  demandTrends: DemandTrend[];
  topRecommendations: string[];
  marketOpportunities: string[];
  competitorAnalysis: Record<string, any>;
}

class AnalyticsService {
  async getInsights(): Promise<InsightsDashboard> {
    try {
      const response = await apiClient.get<InsightsDashboard>('/analytics/insights');
      return getResponseData(response);
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  }

  async getPricingRecommendations(): Promise<PricingInsight[]> {
    try {
      const response = await apiClient.get<PricingInsight[]>('/analytics/pricing-recommendations');
      return getResponseData(response);
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  }

  async getDemandTrends(): Promise<DemandTrend[]> {
    try {
      const response = await apiClient.get<DemandTrend[]>('/analytics/demand-trends');
      return getResponseData(response);
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  }

  async getUserInsights(userId: string): Promise<UserInsight> {
    try {
      const response = await apiClient.get<UserInsight>(`/analytics/user/${userId}/insights`);
      return getResponseData(response);
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  }

  async getCompetitorAnalysis(category: string): Promise<Record<string, any>> {
    try {
      const response = await apiClient.get('/analytics/competitor-analysis', {
        params: { category },
      });
      return getResponseData(response);
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  }
}

export const analyticsService = new AnalyticsService();
