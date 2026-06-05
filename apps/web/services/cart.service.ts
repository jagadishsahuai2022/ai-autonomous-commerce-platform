/**
 * Cart Service
 * - Manage shopping cart operations
 * - Track items, quantities, totals
 * - Calculate taxes, shipping, discounts
 */

import { apiClient, ApiResponse, getResponseData, handleApiError } from '@/lib/api-client';
import { AxiosError } from 'axios';

export interface CartItem {
  id: string;
  productId: string;
  quantity: number;
  price: number;
  totalPrice: number;
  product?: {
    id: string;
    name: string;
    image: string;
    brand?: string;
  };
  selectedOptions?: Record<string, string>;
  addedAt: string;
}

export interface Cart {
  id: string;
  items: CartItem[];
  subtotal: number;
  tax: number;
  shipping: number;
  discount: number;
  total: number;
  currency: string;
  couponCode?: string;
  estimatedDelivery?: string;
  updatedAt: string;
}

export interface AddToCartRequest {
  productId: string;
  quantity: number;
  selectedOptions?: Record<string, string>;
}

export interface UpdateCartItemRequest {
  quantity: number;
}

export interface ApplyCouponRequest {
  couponCode: string;
}

export interface ShippingEstimate {
  method: string;
  cost: number;
  estimatedDays: number;
}

/**
 * Cart Service
 */
class CartService {
  /**
   * Get current cart
   */
  async getCart(): Promise<Cart> {
    try {
      const response = await apiClient.get<ApiResponse<Cart>>('/cart');
      return getResponseData(response);
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  }

  /**
   * Add item to cart
   */
  async addToCart(data: AddToCartRequest): Promise<CartItem> {
    try {
      const response = await apiClient.post<ApiResponse<CartItem>>('/cart/items', data);
      return getResponseData(response);
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  }

  /**
   * Update cart item
   */
  async updateCartItem(itemId: string, data: UpdateCartItemRequest): Promise<CartItem> {
    try {
      const response = await apiClient.put<ApiResponse<CartItem>>(`/cart/items/${itemId}`, data);
      return getResponseData(response);
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  }

  /**
   * Remove item from cart
   */
  async removeFromCart(itemId: string): Promise<void> {
    try {
      await apiClient.delete(`/cart/items/${itemId}`);
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  }

  /**
   * Clear entire cart
   */
  async clearCart(): Promise<void> {
    try {
      await apiClient.delete('/cart');
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  }

  /**
   * Apply coupon code
   */
  async applyCoupon(couponCode: string): Promise<Cart> {
    try {
      const response = await apiClient.post<ApiResponse<Cart>>('/cart/coupon', {
        couponCode,
      });
      return getResponseData(response);
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  }

  /**
   * Remove coupon code
   */
  async removeCoupon(): Promise<Cart> {
    try {
      const response = await apiClient.delete<ApiResponse<Cart>>('/cart/coupon');
      return getResponseData(response);
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  }

  /**
   * Get shipping estimates
   */
  async getShippingEstimates(addressId?: string): Promise<ShippingEstimate[]> {
    try {
      const response = await apiClient.get<ApiResponse<ShippingEstimate[]>>('/cart/shipping', {
        params: { addressId },
      });
      return getResponseData(response);
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  }

  /**
   * Calculate totals (for preview)
   */
  async calculateTotals(data: {
    shippingMethodId?: string;
    addressId?: string;
  }): Promise<{ tax: number; shipping: number; total: number }> {
    try {
      const response = await apiClient.post<
        ApiResponse<{ tax: number; shipping: number; total: number }>
      >('/cart/calculate', data);
      return getResponseData(response);
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  }

  /**
   * Get cart count (quick endpoint)
   */
  async getCartCount(): Promise<number> {
    try {
      const response = await apiClient.get<ApiResponse<{ count: number }>>('/cart/count');
      const data = getResponseData(response) as { count: number } | undefined;
      return data?.count || 0;
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  }

  /**
   * Validate cart before checkout
   */
  async validateCart(): Promise<{ isValid: boolean; errors?: string[] }> {
    try {
      const response =
        await apiClient.post<ApiResponse<{ isValid: boolean; errors?: string[] }>>(
          '/cart/validate'
        );
      return getResponseData(response);
    } catch (error) {
      throw handleApiError(error as AxiosError);
    }
  }
}

export const cartService = new CartService();
