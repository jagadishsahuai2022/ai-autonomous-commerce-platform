/**
 * Shopping Assistant Hooks
 * Real-time chat, intent analysis, and product ranking integration
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useWebSocket } from '@/lib/hooks/useWebSocket';
import useRealtimeStore from '@/lib/store/realtime.store';
import {
  ChatMessage,
  ChatSession,
  IntentData,
  ClarifyingQuestion,
  RankingResult,
  RankedProduct,
  UseShoppingAssistantOptions,
  UseIntentAnalysisOptions,
  UseProductRankingOptions,
  RankingRequest,
} from '@/types/shopping-assistant';

// ============================================================================
// Main Shopping Assistant Hook
// ============================================================================

export const useShoppingAssistant = (options: UseShoppingAssistantOptions) => {
  const {
    userId,
    initialMessages,
    onMessageReceived,
    onRankingComplete,
    onIntentDetected,
    autoScroll = true,
  } = options;

  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages || []);
  const [session, setSession] = useState<ChatSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typingIndicator, setTypingIndicator] = useState(false);
  const sessionInitializedRef = useRef(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { isConnected } = useWebSocket();

  // Initialize session — skip if already initialized or if initial messages were provided
  useEffect(() => {
    const initSession = async () => {
      if (sessionInitializedRef.current) return;
      sessionInitializedRef.current = true;
      try {
        const newSession: ChatSession = {
          id: `session_${Date.now()}`,
          user_id: userId,
          title: `Chat - ${new Date().toLocaleDateString()}`,
          messages: [],
          created_at: new Date(),
          updated_at: new Date(),
        };
        setSession(newSession);

        // Only add welcome message if no messages were restored from store
        if (!initialMessages || initialMessages.length === 0) {
          const welcomeMessage: ChatMessage = {
            id: `msg_${Date.now()}`,
            role: 'assistant',
            content:
              "Welcome to Smart Shopping Assistant! I'll help you find the perfect products. What are you looking for today?",
            timestamp: new Date(),
            type: 'text',
          };
          setMessages([welcomeMessage]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize session');
      }
    };

    // Init when userId available — isConnected is optional (we also support HTTP fallback)
    if (userId) {
      initSession();
    }
  }, [userId]); // Removed isConnected: init session regardless of WebSocket state

  // Auto-scroll to latest message
  useEffect(() => {
    if (autoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, autoScroll]);

  // Send message to backend
  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return;

      // Add user message
      const userMessage: ChatMessage = {
        id: `msg_${Date.now()}`,
        role: 'user',
        content,
        timestamp: new Date(),
        type: 'text',
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);
      setTypingIndicator(true);

      try {
        // Resolve auth token + email for server-side user resolution
        const authToken = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
        const userEmail = typeof window !== 'undefined' ? localStorage.getItem('userEmail') : null;

        // Send to backend
        const response = await fetch('/api/chat/message', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
            ...(userEmail ? { 'x-user-email': userEmail } : {}),
          },
          body: JSON.stringify({
            user_id: userId,
            session_id: session?.id,
            message: content,
          }),
        });

        if (!response.ok) throw new Error('Failed to send message');

        // Stream response
        const reader = response.body?.getReader();
        if (!reader) throw new Error('Response body not readable');

        let assistantContent = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = new TextDecoder().decode(value);
          assistantContent += chunk;
          setTypingIndicator(false); // Stop typing after first chunk
        }

        // Create assistant message
        const assistantMessage: ChatMessage = {
          id: `msg_${Date.now()}`,
          role: 'assistant',
          content: assistantContent,
          timestamp: new Date(),
          type: 'text',
        };

        setMessages((prev) => [...prev, assistantMessage]);
        onMessageReceived?.(assistantMessage);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to send message';
        setError(errorMsg);

        // Add error message
        const errorMessage: ChatMessage = {
          id: `msg_${Date.now()}`,
          role: 'system',
          content: `Error: ${errorMsg}`,
          timestamp: new Date(),
          type: 'text',
          status: 'error',
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
        setTypingIndicator(false);
      }
    },
    [userId, session?.id, onMessageReceived]
  );

  // Clear history
  const clearHistory = useCallback(() => {
    setMessages([]);
    setSession(null);
    setError(null);
  }, []);

  // Add a message programmatically (used for recommendation / clarifying-question inserts)
  const addMessage = useCallback((message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const full: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date(),
      ...message,
    };
    setMessages((prev) => [...prev, full]);
    return full;
  }, []);

  return {
    messages,
    session,
    isLoading,
    error,
    typingIndicator,
    sendMessage,
    clearHistory,
    addMessage,
    messagesEndRef,
  };
};

// ============================================================================
// Intent Analysis Hook
// ============================================================================

export const useIntentAnalysis = (options: UseIntentAnalysisOptions) => {
  const { userId, onQuestionsReceived, onIntentChanged } = options;

  const [intent, setIntent] = useState<IntentData | null>(null);
  const [questions, setQuestions] = useState<ClarifyingQuestion[]>([]);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { isConnected } = useWebSocket();

  // Analyze user input for intent
  const analyzeIntent = useCallback(
    async (userInput: string) => {
      setIsAnalyzing(true);
      setError(null);

      try {
        const authToken = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
        const userEmail = typeof window !== 'undefined' ? localStorage.getItem('userEmail') : null;
        const allowExternal = typeof window !== 'undefined' ? localStorage.getItem('dc-allow-external-products') !== 'false' : true;
        const response = await fetch('/api/intent/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
            ...(userEmail ? { 'x-user-email': userEmail } : {}),
            ...(!allowExternal ? { 'x-allow-external': 'false' } : {}),
          },
          body: JSON.stringify({
            user_id: userId,
            input: userInput,
            allowExternal,
          }),
        });

        if (!response.ok) throw new Error('Failed to analyze intent');

        const data = await response.json();
        setIntent(data.intent);
        const qs = data.clarifying_questions || [];
        setQuestions(qs);
        setTotalQuestions(qs.length);

        onIntentChanged?.(data.intent);
        onQuestionsReceived?.(qs);

        return data;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to analyze intent';
        setError(errorMsg);
        throw err;
      } finally {
        setIsAnalyzing(false);
      }
    },
    [userId, onIntentChanged, onQuestionsReceived]
  );

  // Answer clarifying question — pass question_category so server routes answer correctly
  const answerQuestion = useCallback(
    async (questionId: string, answer: string | number | boolean, questionCategory?: string) => {
      try {
        const authToken = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
        const userEmail = typeof window !== 'undefined' ? localStorage.getItem('userEmail') : null;
        const response = await fetch('/api/intent/answer-question', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
            ...(userEmail ? { 'x-user-email': userEmail } : {}),
          },
          body: JSON.stringify({
            user_id: userId,
            question_id: questionId,
            question_category: questionCategory,
            total_questions: totalQuestions || undefined,
            answer,
            current_intent: intent,
          }),
        });

        if (!response.ok) throw new Error('Failed to answer question');

        const data = await response.json();

        // Remove answered question
        setQuestions((prev) => prev.filter((q) => q.id !== questionId));

        // Update intent if provided
        if (data.updated_intent) {
          setIntent(data.updated_intent);
          onIntentChanged?.(data.updated_intent);
        }

        return data;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to answer question';
        setError(errorMsg);
        throw err;
      }
    },
    [userId, intent, totalQuestions, onIntentChanged]
  );

  return {
    intent,
    questions,
    totalQuestions,
    isAnalyzing,
    error,
    analyzeIntent,
    answerQuestion,
  };
};

// ============================================================================
// Product Ranking Hook
// ============================================================================

export const useProductRanking = (options: UseProductRankingOptions) => {
  const { userId, autoRank = true, onProgressUpdate, onComplete } = options;

  const [ranking, setRanking] = useState<RankingResult | null>(null);
  const [isRanking, setIsRanking] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Rank products from intent
  const rankProducts = useCallback(
    async (intent: IntentData, products: any[]) => {
      setIsRanking(true);
      setProgress(0);
      setError(null);

      try {
        // Create ranking request
        const rankingRequest: RankingRequest = {
          request_id: `rank_${Date.now()}`,
          user_id: userId,
          products: products.map((p) => ({
            id: p.id,
            name: p.name,
            brand: p.brand,
            price: p.price,
            rating: p.rating || 0,
            review_count: p.review_count || 0,
            delivery_time: p.delivery_time || '5-7 days',
            key_features: p.key_features || [],
            source: p.source || 'internal',
          })),
          budget_min: intent.budget?.min || 0,
          budget_max: intent.budget?.max || 999999,
          preferred_brands: intent.preferences?.brands || [],
          quality_threshold: intent.preferences?.quality_level === 'premium' ? 0.8 : 0.6,
          preferred_delivery_days:
            intent.preferences?.delivery_urgency === 'urgent'
              ? 2
              : intent.preferences?.delivery_urgency === 'flexible'
                ? 7
                : 5,
        };

        // Call ranking service
        const response = await fetch('http://localhost:3004/rank', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(rankingRequest),
        });

        if (!response.ok) throw new Error('Failed to rank products');

        const result: RankingResult = await response.json();

        setRanking(result);
        setProgress(100);

        // Update progress
        onProgressUpdate?.({
          type: 'ranking:progress',
          data: {
            status: 'completed',
            progress: 100,
            products_ranked: result.ranked_products.length,
          },
          timestamp: Date.now(),
        });

        onComplete?.(result);

        return result;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to rank products';
        setError(errorMsg);
        throw err;
      } finally {
        setIsRanking(false);
      }
    },
    [userId, onProgressUpdate, onComplete]
  );

  // Simulate progress
  useEffect(() => {
    if (isRanking && progress < 90) {
      const timer = setTimeout(() => {
        const increment = Math.random() * 30;
        setProgress((prev) => Math.min(prev + increment, 90));

        onProgressUpdate?.({
          type: 'ranking:progress',
          data: {
            status: 'processing',
            progress: Math.min(progress + increment, 90),
            products_ranked: 0,
          },
          timestamp: Date.now(),
        });
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [isRanking, progress, onProgressUpdate]);

  return {
    ranking,
    isRanking,
    progress,
    error,
    rankProducts,
  };
};

// ============================================================================
// Message Streaming Hook
// ============================================================================

export const useMessageStreaming = (userId: string) => {
  const [streamingMessage, setStreamingMessage] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  const streamMessage = useCallback(
    async (userMessage: string, onChunk?: (chunk: string) => void) => {
      setIsStreaming(true);
      setStreamingMessage('');

      try {
        const response = await fetch('/api/chat/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: userId,
            message: userMessage,
          }),
        });

        if (!response.ok) throw new Error('Streaming failed');

        const reader = response.body?.getReader();
        if (!reader) throw new Error('Response body not readable');

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = new TextDecoder().decode(value);
          setStreamingMessage((prev) => prev + chunk);
          onChunk?.(chunk);
        }
      } finally {
        setIsStreaming(false);
      }
    },
    [userId]
  );

  return {
    streamingMessage,
    isStreaming,
    streamMessage,
  };
};

// ============================================================================
// Ranking Progress Hook
// ============================================================================

export const useRankingProgress = (rankingId?: string) => {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'pending' | 'processing' | 'completed'>('pending');
  const [productsRanked, setProductsRanked] = useState(0);

  const { isConnected } = useWebSocket();

  useEffect(() => {
    if (!isConnected || !rankingId) return;

    // Listen for ranking progress events (would come from WebSocket)
    const handleProgressUpdate = (event: any) => {
      if (event.ranking_id === rankingId) {
        setProgress(event.progress);
        setStatus(event.status);
        setProductsRanked(event.products_ranked);
      }
    };

    // Subscribe to progress events
    // This would be connected to your WebSocket system

    return () => {
      // Unsubscribe
    };
  }, [isConnected, rankingId]);

  return {
    progress,
    status,
    productsRanked,
  };
};
