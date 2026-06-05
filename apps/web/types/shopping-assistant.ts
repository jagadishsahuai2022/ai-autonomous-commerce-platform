/**
 * Shopping Assistant Types
 * Shared TypeScript types for chat, recommendations, and intent
 */

// ============================================================================
// Chat Message Types
// ============================================================================

export interface RankedProduct {
  rank: number;
  product: {
    id: string;
    name: string;
    brand: string;
    price: number;
    original_price?: number;
    discount_percent?: number;
    rating: number;
    review_count: number;
    delivery_time: string;
    key_features: string[];
    source: string;
    imageUrl?: string;
    image?: string;
    isExternal?: boolean;
  };
  score: number;
  confidence: number;
  explanation: {
    product_id: string;
    final_score: number;
    summary: string;
    key_strengths: string[];
    key_weaknesses: string[];
    budget_fit_score: {
      score: number;
      reason: string;
    };
    quality_score: {
      score: number;
      reason: string;
    };
    brand_preference_score: {
      score: number;
      reason: string;
    };
    delivery_speed_score: {
      score: number;
      reason: string;
    };
    ratings_score: {
      score: number;
      reason: string;
    };
  };
}

export interface RankingResult {
  request_id: string;
  user_id: string;
  total_products: number;
  ranked_products: RankedProduct[];
  best_product: RankedProduct | null;
  average_confidence: number;
}

export interface ClarifyingQuestion {
  id: string;
  question: string;
  type: 'multiple_choice' | 'open_ended' | 'range' | 'boolean';
  options?: {
    value: string;
    label: string;
  }[];
  category: 'budget' | 'brand' | 'features' | 'delivery' | 'quality';
  required: boolean;
  defaultValue?: string | number | boolean;
}

export interface IntentData {
  request_id: string;
  user_intent: string;
  confidence: number;
  category: string;
  budget?: {
    min: number;
    max: number;
  };
  preferences?: {
    brands: string[];
    features: string[];
    delivery_urgency: 'urgent' | 'flexible' | 'standard';
    quality_level: 'budget' | 'mid-range' | 'premium';
  };
  clarifying_questions: ClarifyingQuestion[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  type: 'text' | 'product_recommendation' | 'clarifying_question' | 'status';
  metadata?: {
    intent_id?: string;
    ranking_id?: string;
    correlation_id?: string;
    voice?: boolean;
  };
  products?: RankedProduct[];
  questions?: ClarifyingQuestion[];
  status?: 'pending' | 'success' | 'error';
}

export interface ChatSession {
  id: string;
  user_id: string;
  title: string;
  messages: ChatMessage[];
  intent?: IntentData;
  ranking_results?: RankingResult;
  created_at: Date;
  updated_at: Date;
}

// ============================================================================
// Assistant Response Types
// ============================================================================

export interface AssistantResponse {
  id: string;
  message: string;
  action: 'respond' | 'ask_question' | 'show_recommendations' | 'refine' | 'complete';
  suggestions?: string[];
}

export interface RankingRequest {
  request_id: string;
  user_id: string;
  products: Array<{
    id: string;
    name: string;
    brand: string;
    price: number;
    rating: number;
    review_count: number;
    delivery_time: string;
    key_features: string[];
    source: string;
  }>;
  budget_min: number;
  budget_max: number;
  preferred_brands: string[];
  quality_threshold: number;
  preferred_delivery_days: number;
}

// ============================================================================
// WebSocket Events
// ============================================================================

export interface WebSocketEvent<T = any> {
  type: string;
  data: T;
  timestamp: number;
}

export interface MessageStreamEvent extends WebSocketEvent<{
  chunk: string;
  done: boolean;
}> {
  type: 'message:stream';
}

export interface RankingProgressEvent extends WebSocketEvent<{
  status: 'processing' | 'completed';
  progress: number;
  products_ranked: number;
}> {
  type: 'ranking:progress';
}

export interface QuestionEvent extends WebSocketEvent<ClarifyingQuestion> {
  type: 'question:new';
}

// ============================================================================
// Store State Types
// ============================================================================

export interface ShoppingAssistantState {
  // Chat state
  messages: ChatMessage[];
  currentSession: ChatSession | null;
  isLoading: boolean;
  error: string | null;

  // Intent state
  currentIntent: IntentData | null;
  intents: IntentData[];

  // Ranking state
  currentRanking: RankingResult | null;
  rankings: RankingResult[];
  rankingProgress: number;

  // UI state
  selectedProductId: string | null;
  expandedMessages: Set<string>;
  showTypingIndicator: boolean;
}

// ============================================================================
// Hook Types
// ============================================================================

export interface UseShoppingAssistantOptions {
  userId: string;
  /** Pre-populate messages (e.g. restored from session store) */
  initialMessages?: ChatMessage[];
  onMessageReceived?: (message: ChatMessage) => void;
  onRankingComplete?: (ranking: RankingResult) => void;
  onIntentDetected?: (intent: IntentData) => void;
  autoScroll?: boolean;
}

export interface UseIntentAnalysisOptions {
  userId: string;
  onQuestionsReceived?: (questions: ClarifyingQuestion[]) => void;
  onIntentChanged?: (intent: IntentData) => void;
}

export interface UseProductRankingOptions {
  userId: string;
  autoRank?: boolean;
  onProgressUpdate?: (progress: RankingProgressEvent) => void;
  onComplete?: (result: RankingResult) => void;
}

// ============================================================================
// UI Component Props Types
// ============================================================================

export interface ProductRecommendationCardProps {
  product: RankedProduct;
  rank: number;
  onSelect?: (product: RankedProduct) => void;
  showExplanation?: boolean;
  showComparison?: boolean;
  isSelected?: boolean;
}

export interface ClarifyingQuestionProps {
  question: ClarifyingQuestion;
  onAnswer: (answer: string | number | boolean) => void;
  isLoading?: boolean;
}

export interface ShoppingChatProps {
  userId: string;
  sessionId?: string;
  onProductSelect?: (product: RankedProduct) => void;
  onCheckout?: () => void;
}

export interface RankingComparisonProps {
  ranking: RankingResult;
  onCompare?: (productIds: string[]) => void;
  showDetails?: boolean;
}
