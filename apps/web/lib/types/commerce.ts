// Product & Commerce Types
export interface Product {
  id: string;
  name: string;
  brand: string;
  price: number;
  originalPrice?: number;
  image: string;
  rating: number;
  reviewCount: number;
  delivery_days: number;
  key_features: string[];
  source: 'amazon' | 'flipkart' | 'direct';
  inStock: boolean;
  sku?: string;
}

export interface RankedProduct extends Product {
  rank: number;
  score: number;
  confidence: number;
  reasoning: string;
  pros: string[];
  cons: string[];
}

// AI Decision Types
export interface AIDecision {
  id: string;
  userId: string;
  userQuery: string;
  intent: string;
  confidence: number;
  recommendedProduct: RankedProduct;
  alternatives: RankedProduct[];
  explanation: string;
  searchDuration: number;
  rankingDuration: number;
  timestamp: Date;
  status: 'pending' | 'approved' | 'rejected' | 'executing' | 'completed';
}

// Timeline Types
export interface TimelineStep {
  id: string;
  label: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  timestamp?: Date;
  duration?: number;
  details?: string;
}

// Order Types
export interface Order {
  id: string;
  userId: string;
  decisionId: string;
  product: Product;
  totalPrice: number;
  quantity: number;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  paymentMethod: string;
  deliveryAddress: string;
  estimatedDelivery: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Chat Types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  type?: 'suggestion' | 'warning' | 'info' | 'confirmation';
  products?: Product[];
  isStreaming?: boolean;
}

// Approval Types
export interface ApprovalRequest {
  id: string;
  decisionId: string;
  product: Product;
  totalPrice: number;
  riskLevel: 'low' | 'medium' | 'high';
  riskScore: number;
  aiConfidence: number;
  reasons: string[];
  expiresAt: Date;
  requiresManualApproval: boolean;
}

// WebSocket Message Types
export type WebSocketMessageType =
  | 'INTENT_ANALYSIS'
  | 'PRODUCT_SEARCH'
  | 'RANKING'
  | 'DECISION_READY'
  | 'ORDER_PLACED'
  | 'ORDER_STATUS_UPDATE'
  | 'ERROR';

export interface WebSocketMessage {
  type: WebSocketMessageType;
  payload: any;
  timestamp: Date;
}

// Auto Mode Types
export interface AutoBuyRule {
  id: string;
  userId: string;
  condition: string; // e.g., "price < 70000 AND rating > 4.5"
  isActive: boolean;
  createdAt: Date;
}

// User Preferences
export interface UserPreferences {
  budget: {
    min: number;
    max: number;
  };
  brands: string[];
  excludedBrands: string[];
  preferredSources: string[];
  deliveryPreference: 'fastest' | 'cheapest' | 'balanced';
  autoApprovalThreshold: number;
}
