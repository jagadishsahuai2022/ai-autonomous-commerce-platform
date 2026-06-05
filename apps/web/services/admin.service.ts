/**
 * Admin Service
 * - User management
 * - Product moderation
 * - Order monitoring
 * - System health
 */

import { apiClient, getResponseData, handleApiError } from '@/lib/api-client';
import { AxiosError } from 'axios';
import { User } from '@/services/auth.service';

export interface AdminUser extends User {
  totalOrders: number;
  totalSpent: number;
  joinedDate: string;
  status: 'active' | 'suspended' | 'banned';
}

export interface AdminProduct {
  id: string;
  name: string;
  seller: {
    id: string;
    name: string;
  };
  price: number;
  status: 'active' | 'pending' | 'rejected' | 'flagged';
  views: number;
  sales: number;
  reportedCount: number;
  createdAt: string;
}

export interface AdminStats {
  totalUsers: number;
  totalSellers: number;
  totalProducts: number;
  totalRevenue: number;
  activeOrders: number;
  pendingApprovals: number;
  reportedProducts: number;
  bannedUsers: number;
}

class AdminService {
  async getStats(): Promise<AdminStats> {
    try {
      const response = await apiClient.get<AdminStats>('/admin/stats');
      return getResponseData(response);
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  }

  async getUsers(skip: number = 0, take: number = 10): Promise<any> {
    try {
      const response = await apiClient.get('/admin/users', {
        params: { skip, take },
      });
      return getResponseData(response);
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  }

  async getProducts(skip: number = 0, take: number = 10, status?: string): Promise<any> {
    try {
      const response = await apiClient.get('/admin/products', {
        params: { skip, take, status },
      });
      return getResponseData(response);
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  }

  async suspendUser(userId: string, reason: string): Promise<void> {
    try {
      await apiClient.post(`/admin/users/${userId}/suspend`, { reason });
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  }

  async approveProduct(productId: string): Promise<void> {
    try {
      await apiClient.post(`/admin/products/${productId}/approve`);
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  }

  async rejectProduct(productId: string, reason: string): Promise<void> {
    try {
      await apiClient.post(`/admin/products/${productId}/reject`, { reason });
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  }
}

export const adminService = new AdminService();
