/**
 * Order Service
 * - Order creation, retrieval, tracking
 * - Order lifecycle management
 * - Shipment and return handling
 */

import { apiClient, ApiResponse, getResponseData, handleApiError } from '@/lib/api-client';
import { AxiosError } from 'axios';

export interface OrderItem {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  product: {
    id: string;
    name: string;
    image: string;
  };
}

export interface Order {
  id: string;
  orderNumber: string;
  status: 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  items: OrderItem[];
  subtotal: number;
  tax: number;
  shipping: number;
  discount: number;
  total: number;
  currency: string;
  paymentStatus: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  paymentMethod?: string;
  shippingAddress: Address;
  billingAddress: Address;
  estimatedDelivery?: string;
  deliveredAt?: string;
  cancelledAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Address {
  id: string;
  firstName: string;
  lastName: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  phone: string;
  email: string;
}

export interface Shipment {
  id: string;
  trackingNumber: string;
  carrier: string;
  status: 'PENDING' | 'PICKED' | 'IN_TRANSIT' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'FAILED';
  shippedAt: string;
  estimatedDelivery: string;
  deliveredAt?: string;
  trackingUrl?: string;
}

export interface OrderStatus {
  status: string;
  timestamp: string;
  description: string;
  icon?: string;
}

export interface OrderTimeline {
  steps: OrderStatus[];
  currentStep: number;
}

export interface OrderReturn {
  id: string;
  reason: string;
  status: 'REQUESTED' | 'APPROVED' | 'IN_TRANSIT' | 'RECEIVED' | 'COMPLETED' | 'REJECTED';
  refundAmount?: number;
  requestedAt: string;
  approvedAt?: string;
  returnedAt?: string;
  completedAt?: string;
}

export interface CreateOrderRequest {
  cartId?: string;
  items?: { productId: string; quantity: number }[];
  shippingAddressId: string;
  billingAddressId: string;
  shippingMethodId: string;
  paymentMethodId: string;
  couponCode?: string;
  notes?: string;
}

export interface OrderFilter {
  status?: string;
  page?: number;
  limit?: number;
  sortBy?: 'newest' | 'oldest' | 'total';
}

/**
 * Order Service
 */
class OrderService {
  /**
   * Get all orders for current user
   */
  async getOrders(filters: OrderFilter = {}): Promise<{
    orders: Order[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    try {
      const response = await apiClient.get<
        ApiResponse<{
          orders: Order[];
          total: number;
          page: number;
          totalPages: number;
        }>
      >('/orders', {
        params: {
          status: filters.status,
          page: filters.page || 1,
          limit: filters.limit || 10,
          sortBy: filters.sortBy || 'newest',
        },
      });

      return getResponseData(response);
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  }

  /**
   * Get single order by ID
   */
  async getOrder(orderId: string): Promise<Order> {
    try {
      const response = await apiClient.get<ApiResponse<Order>>(`/orders/${orderId}`);
      return getResponseData(response);
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  }

  /**
   * Create new order
   */
  async createOrder(data: CreateOrderRequest): Promise<Order> {
    try {
      const response = await apiClient.post<ApiResponse<Order>>('/orders', data);
      return getResponseData(response);
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  }

  /**
   * Get order timeline/status history
   */
  async getOrderTimeline(orderId: string): Promise<OrderTimeline> {
    try {
      const response = await apiClient.get<ApiResponse<OrderTimeline>>(
        `/orders/${orderId}/timeline`
      );
      return getResponseData(response);
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  }

  /**
   * Get shipment details
   */
  async getShipment(orderId: string): Promise<Shipment> {
    try {
      const response = await apiClient.get<ApiResponse<Shipment>>(`/orders/${orderId}/shipment`);
      return getResponseData(response);
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  }

  /**
   * Get order invoice
   */
  async getInvoice(orderId: string): Promise<Blob> {
    try {
      const response = await apiClient.get(`/orders/${orderId}/invoice`, {
        responseType: 'blob',
      });
      return response.data;
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  }

  /**
   * Cancel order
   */
  async cancelOrder(orderId: string, reason?: string): Promise<Order> {
    try {
      const response = await apiClient.post<ApiResponse<Order>>(`/orders/${orderId}/cancel`, {
        reason,
      });
      return getResponseData(response);
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  }

  /**
   * Request return
   */
  async requestReturn(
    orderId: string,
    data: { reason: string; description?: string }
  ): Promise<OrderReturn> {
    try {
      const response = await apiClient.post<ApiResponse<OrderReturn>>(
        `/orders/${orderId}/return`,
        data
      );
      return getResponseData(response);
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  }

  /**
   * Get return details
   */
  async getReturn(orderId: string): Promise<OrderReturn> {
    try {
      const response = await apiClient.get<ApiResponse<OrderReturn>>(`/orders/${orderId}/return`);
      return getResponseData(response);
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  }

  /**
   * Track package (external carrier)
   */
  async trackPackage(
    trackingNumber: string,
    carrier: string
  ): Promise<{
    status: string;
    location?: string;
    estimatedDelivery?: string;
  }> {
    try {
      const response = await apiClient.get<
        ApiResponse<{
          status: string;
          location?: string;
          estimatedDelivery?: string;
        }>
      >('/orders/track', {
        params: { trackingNumber, carrier },
      });
      return getResponseData(response);
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  }

  /**
   * Get order summary for dashboard
   */
  async getOrderSummary(): Promise<{
    totalOrders: number;
    totalSpent: number;
    pendingOrders: number;
    recentOrders: Order[];
  }> {
    try {
      const response = await apiClient.get<
        ApiResponse<{
          totalOrders: number;
          totalSpent: number;
          pendingOrders: number;
          recentOrders: Order[];
        }>
      >('/orders/summary');
      return getResponseData(response);
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  }

  /**
   * Validate order before creation
   */
  async validateOrder(data: CreateOrderRequest): Promise<{ isValid: boolean; errors?: string[] }> {
    try {
      const response = await apiClient.post<ApiResponse<{ isValid: boolean; errors?: string[] }>>(
        '/orders/validate',
        data
      );
      return getResponseData(response);
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  }
}

export const orderService = new OrderService();
