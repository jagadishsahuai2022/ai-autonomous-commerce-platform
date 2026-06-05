/**
 * Product interface
 */
export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  category: string;
  image?: string;
  rating?: number;
  reviewCount?: number;

  // India-specific fields
  codAvailable?: boolean;
  hasEMI?: boolean;
  gstRate?: number;
  deliveryDays?: number;
  pincodeCheckRequired?: boolean;

  // Additional e-commerce fields
  stock?: number;
  sku?: string;
  tags?: string[];
  createdAt?: Date;
}

/**
 * User interface
 */
export interface User {
  id: number;
  email: string;
  name: string;
  createdAt: Date;
}

/**
 * Cart item interface
 */
export interface CartItem {
  productId: number;
  quantity: number;
  price: number;
}

/**
 * Order interface
 */
export interface Order {
  id: number;
  userId: number;
  items: CartItem[];
  total: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered';
  createdAt: Date;
}

/**
 * Recommendation interface
 */
export interface Recommendation {
  id: number;
  name: string;
  description: string;
  price: number;
  rating?: number;
}

/**
 * API Response interface
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
}
