// ============ Chat Types ============
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  type?: 'suggestion' | 'warning' | 'info' | 'confirmation';
  productCards?: RankedProduct[];
}

// ============ Product Types ============
export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  rating: number;
  reviews: number;
  reviewCount?: number;
  image: string;
  category: string;
  delivery: {
    daysMin: number;
    daysMax: number;
    free: boolean;
  };
  brand: string;
  inStock: boolean;
  specifications?: Record<string, string>;
  codAvailable?: boolean;
  hasEMI?: boolean;
  // AI-enhanced fields
  trustScore?: number; // 0-100, AI-computed seller+product trust
  priceTrend?: 'up' | 'down' | 'stable'; // price movement direction
  priceTrendPct?: number; // % change over last 30 days (positive = up)
  deliveryETA?: string; // human-readable ETA: "Tomorrow", "2-3 days"
  aiRecommended?: boolean; // flagged by AI for current user
  aiConfidence?: number; // 0-100, AI recommendation confidence
  aiReason?: string; // brief explanation: "Matches your budget"
  // India-specific
  gstIncluded?: boolean;
  sellerRating?: number; // seller reputation 0-5
  sellerName?: string;
}

export interface RankedProduct extends Product {
  rank: number;
  confidence: number;
  score: number;
  reasoning: string;
  pros: string[];
  cons: string[];
  compareMetrics: CompareMetric[];
}

export interface CompareMetric {
  label: string;
  value: number | string;
  unit?: string;
}

// ============ Decision Types ============
export interface Decision {
  id: string;
  recommendedProduct: RankedProduct;
  alternatives: RankedProduct[];
  reasoning: string;
  confidence: number;
  timestamp: Date;
  userQuery: string;
}

// ============ Order Types ============
export interface OrderStep {
  id: string;
  label: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  timestamp?: Date;
  detail?: string;
}

export interface Order {
  id: string;
  productId: string;
  quantity: number;
  totalPrice: number;
  status: 'processing' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  steps: OrderStep[];
  createdAt: Date;
  estimatedDelivery?: Date;
  trackingNumber?: string;
}

// ============ Approval Types ============
export interface ApprovalRequest {
  id: string;
  product: RankedProduct;
  decision: Decision;
  status: 'pending' | 'approved' | 'rejected' | 'modified';
  riskLevel: 'low' | 'medium' | 'high';
  walletBalance: number;
  createdAt: Date;
}
