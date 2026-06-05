/**
 * Seller Service
 * - Seller dashboard metrics
 * - Revenue, orders, conversion rate
 * - Analytics and insights
 */

import { apiClient, ApiResponse, getResponseData, handleApiError } from '@/lib/api-client';
import { AxiosError } from 'axios';

export interface SellerMetrics {
  totalRevenue: number;
  totalOrders: number;
  conversionRate: number;
  averageOrderValue: number;
  topProductsCount: number;
  pendingOrders: number;
  returnRate: number;
  customerSatisfaction: number;
}

export interface RevenueChart {
  date: string;
  revenue: number;
  orders: number;
}

export interface TopProduct {
  id: string;
  name: string;
  sold: number;
  revenue: number;
  rating: number;
}

export interface SellerAnalytics {
  metrics: SellerMetrics;
  revenueChart: RevenueChart[];
  topProducts: TopProduct[];
  recentOrders: any[];
}

class SellerService {
  async getMetrics(): Promise<SellerMetrics> {
    try {
      const response = await apiClient.get<SellerMetrics>('/seller/metrics');
      return getResponseData(response);
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  }

  async getAnalytics(period: 'week' | 'month' | 'year' = 'month'): Promise<SellerAnalytics> {
    try {
      const response = await apiClient.get<SellerAnalytics>('/seller/analytics', {
        params: { period },
      });
      return getResponseData(response);
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  }

  async getRevenueChart(period: 'week' | 'month' | 'year' = 'month'): Promise<RevenueChart[]> {
    try {
      const response = await apiClient.get<RevenueChart[]>('/seller/revenue-chart', {
        params: { period },
      });
      return getResponseData(response);
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  }

  async getTopProducts(limit: number = 5): Promise<TopProduct[]> {
    try {
      const response = await apiClient.get<TopProduct[]>('/seller/top-products', {
        params: { limit },
      });
      return getResponseData(response);
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  }
}

export const sellerService = new SellerService();
