/**
 * Shopping Chat Component
 * Main AI shopping assistant chat interface with product recommendations
 */

'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { useShoppingAssistant, useIntentAnalysis, useProductRanking } from '@/hooks/useShoppingAssistant';
import { useWebSocket } from '@/lib/hooks/useWebSocket';
import {
  MessageSquare, ShoppingCart, Sparkles, Loader2, AlertCircle,
  ChevronLeft, ChevronRight, ChevronDown, Package, CheckCircle2,
  Globe, Store,
} from 'lucide-react';
import { ClarifyingQuestionCard } from './ClarifyingQuestionCard';
import { ProductRecommendationCarousel } from './ProductRecommendationCarousel';
import { RankingProgressBar } from './RankingProgressBar';
import { ProductDetailModal } from './ProductDetailModal';
import { useChatStore } from '@/lib/stores/chat-store';
import type { ChatMessage as ChatMessageType, RankedProduct } from '@/types/shopping-assistant';

interface ShoppingChatProps {
  userId: string;
  sessionId?: string;
  onProductSelect?: (product: RankedProduct) => void;
  onProductsFound?: (products: RankedProduct[]) => void;
  onCheckout?: () => void;
  title?: string;
  /** When set, triggers a query as if user typed and sent it */
  pendingQuery?: string | null;
  /** Called after pendingQuery has been consumed */
  onPendingQueryHandled?: () => void;
  /** Called when the user clears history — parent should reset its panel state */
  onClearAll?: () => void;
  /** Called when Compare button clicked in carousel — opens parent comparison modal */
  onOpenCompare?: (products: RankedProduct[]) => void;
  /** Called when user manually expands/focuses a session (accordion click) — parent syncs right panel */
  onActiveSessionChange?: (sessionId: string, query: string, products: RankedProduct[]) => void;
  /** Called whenever sessions list or their products change — parent can build per-session index */
  onSessionsChange?: (sessions: Array<{ id: string; query: string; products: RankedProduct[] }>) => void;
}

export const ShoppingChat: React.FC<ShoppingChatProps> = ({
  userId,
  sessionId,
  onProductSelect,
  onProductsFound,
  onCheckout,
  title = 'Smart Shopping Assistant',
  pendingQuery,
  onPendingQueryHandled,
  onClearAll,
  onOpenCompare,
  onActiveSessionChange,
  onSessionsChange,
}) => {
  const [selectedProduct, setSelectedProduct] = useState<RankedProduct | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  // Product detail modal state
  const [detailModalProduct, setDetailModalProduct] = useState<RankedProduct | null>(null);
  // Track which chat sessions (by first user msg id) are collapsed
  const [collapsedSessionIds, setCollapsedSessionIds] = useState<Set<string>>(new Set());
  const prevSessionCountRef = useRef(0);

  // External products toggle (test/dev envs only — persisted in localStorage)
  const [showExternalProducts, setShowExternalProducts] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('showExternalProducts') === 'true';
    }
    return false;
  });

  const handleToggleExternal = useCallback(() => {
    setShowExternalProducts((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') localStorage.setItem('showExternalProducts', String(next));
      return next;
    });
  }, []);

  // Bottom pinned carousel navigation
  const pinnedCarouselRef = useRef<HTMLDivElement>(null);
  const [pinnedCanScrollLeft, setPinnedCanScrollLeft] = useState(false);
  const [pinnedCanScrollRight, setPinnedCanScrollRight] = useState(false);

  // ── Chat Store: restore messages persisted in sessionStorage ──────────────
  // Use useState lazy initializer (NOT useRef) so we get an actual array.
  // The parent page hydrates the store before this component mounts.
  const [initialMessages] = useState<ChatMessageType[]>(() => {
    const stored = useChatStore.getState().messages;
    if (stored.length === 0) return [];
    return stored.map((m) => ({
      id: m.id,
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
      timestamp: new Date(m.timestamp),
      type: m.type || 'text',
      products: m.products,
      questions: m.questions,
      metadata: m.metadata,
    } as ChatMessageType));
  });

  // Track whether we've passed the initial mount (to avoid re-saving initial messages)
  const syncCountRef = useRef(0);

  // Main hooks — pass restored messages so the hook doesn't reset them
  // autoScroll disabled: the browser's native scrollbar handles all scrolling now.
  // scrollIntoView would scroll the entire PAGE instead of a panel container.
  const { messages, isLoading, error, typingIndicator, sendMessage, clearHistory, addMessage, messagesEndRef } =
    useShoppingAssistant({
      userId,
      initialMessages,
      autoScroll: false,
      onMessageReceived: (msg) => {
        console.log('Message received:', msg);
      },
    });

  // Sync messages to chat store whenever they change (skip first sync = initial restore)
  useEffect(() => {
    syncCountRef.current++;
    if (syncCountRef.current <= 1) return; // Skip first run to avoid re-saving initial state
    useChatStore.getState().setMessages(
      messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp instanceof Date ? m.timestamp.getTime() : Date.now(),
        type: m.type,
        products: (m as any).products,
        questions: (m as any).questions,
        metadata: (m as any).metadata,
      }))
    );
  }, [messages]);

  // Wrap clearHistory to also wipe the chat store and notify parent
  const handleClearHistory = useCallback(() => {
    clearHistory();
    useChatStore.getState().clearAll();
    syncCountRef.current = 1; // Reset so next message triggers save
    onClearAll?.();
  }, [clearHistory, onClearAll]);


  const { intent, questions, totalQuestions, isAnalyzing, analyzeIntent, answerQuestion } = useIntentAnalysis({
    userId,
    onIntentChanged: (newIntent) => {
      console.log('Intent detected:', newIntent);
    },
    onQuestionsReceived: (qs) => {
      console.log('Clarifying questions:', qs);
    },
  });

  const { ranking, isRanking, progress, rankProducts } = useProductRanking({
    userId,
    onComplete: (result) => {
      console.log('Ranking complete:', result);
    },
  });

  // Generate external product suggestions when catalog has no matches
  const generateExternalProducts = useCallback(async (intentText: string, answers: string[]): Promise<RankedProduct[]> => {
    try {
      const resp = await fetch('/api/intent/external-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intentText, answers }),
      });
      if (!resp.ok) return [];
      const data = await resp.json();
      if (!Array.isArray(data.products)) return [];
      return data.products.map((p: any, idx: number) => ({
        rank: idx + 1,
        product: {
          id: `ext-${Date.now()}-${idx}`,
          name: p.name,
          brand: p.brand ?? 'Unknown',
          price: p.price ?? 0,
          original_price: p.price ?? 0,
          discount_percent: 0,
          rating: p.rating ?? 4.0,
          review_count: p.reviewCount ?? 0,
          delivery_time: '5-7 days (external)',
          key_features: p.features ?? [],
          source: 'External',
          imageUrl: '',
          isExternal: true,
        },
        score: Math.max(0.5, 0.85 - idx * 0.08),
        confidence: Math.max(0.4, 0.75 - idx * 0.08),
        explanation: {
          product_id: `ext-${idx}`,
          final_score: Math.max(0.5, 0.85 - idx * 0.08),
          summary: `${p.brand ?? ''} ${p.name} — external suggestion based on your preferences.`,
          key_strengths: p.features?.slice(0, 2) ?? [],
          key_weaknesses: ['Not in catalog — availability unverified'],
          budget_fit_score: { score: 0.8, reason: 'Estimated to fit budget' },
          quality_score: { score: (p.rating ?? 4) / 5, reason: 'Estimated quality' },
          brand_preference_score: { score: 0.7, reason: 'External brand' },
          delivery_speed_score: { score: 0.5, reason: 'External — delivery time varies' },
          ratings_score: { score: (p.rating ?? 4) / 5, reason: 'Estimated rating' },
        },
      } as RankedProduct));
    } catch {
      return [];
    }
  }, []);

  // ── Consume pendingQuery from parent (shortcut chips) ────────────────────
  const pendingQueryRef = useRef<string | null>(null);
  useEffect(() => {
    if (pendingQuery && pendingQuery !== pendingQueryRef.current) {
      pendingQueryRef.current = pendingQuery;
      onPendingQueryHandled?.();
      // Fire and forget — same as user typing and hitting send
      handleSendMessage(pendingQuery);
    }
  }, [pendingQuery]);

  // ── Group messages into collapsible sessions ─────────────────────────────
  // A session starts on every user message; all subsequent assistant messages belong to it.
  const chatSessions = useMemo(() => {
    const sessions: Array<{ id: string; query: string; messages: ChatMessageType[]; productCount: number }> = [];
    let current: ChatMessageType[] = [];
    let sessionId = '';
    for (const msg of messages) {
      if (msg.role === 'user') {
        if (current.length > 0 && sessionId) {
          const prodCount = current.filter(m => m.type === 'product_recommendation').reduce((acc, m) => acc + (m.products?.length ?? 0), 0);
          sessions.push({ id: sessionId, query: current[0].content, messages: current, productCount: prodCount });
        }
        current = [msg];
        sessionId = msg.id;
      } else {
        if (current.length > 0) current.push(msg);
      }
    }
    if (current.length > 0 && sessionId) {
      const prodCount = current.filter(m => m.type === 'product_recommendation').reduce((acc, m) => acc + (m.products?.length ?? 0), 0);
      sessions.push({ id: sessionId, query: current[0].content, messages: current, productCount: prodCount });
    }
    return sessions;
  }, [messages]);

  // Per-session product map — extracted from messages of type 'product_recommendation'
  const sessionProductsMap = useMemo(() => {
    const map = new Map<string, RankedProduct[]>();
    for (const session of chatSessions) {
      const prods = session.messages
        .filter(m => m.type === 'product_recommendation')
        .flatMap(m => m.products ?? []);
      map.set(session.id, prods);
    }
    return map;
  }, [chatSessions]);

  // Aggregated session info for parent right-panel sync and pagination
  const allSessionsInfo = useMemo(
    () => chatSessions.map(s => ({ id: s.id, query: s.query, products: sessionProductsMap.get(s.id) ?? [] })),
    [chatSessions, sessionProductsMap],
  );

  // Stable refs so callbacks never go stale inside memos/effects
  const onSessionsChangeRef = useRef(onSessionsChange);
  useEffect(() => { onSessionsChangeRef.current = onSessionsChange; }, [onSessionsChange]);
  const onActiveSessionChangeRef = useRef(onActiveSessionChange);
  useEffect(() => { onActiveSessionChangeRef.current = onActiveSessionChange; }, [onActiveSessionChange]);
  const collapsedSessionIdsRef = useRef(collapsedSessionIds);
  useEffect(() => { collapsedSessionIdsRef.current = collapsedSessionIds; }, [collapsedSessionIds]);

  // Notify parent whenever session list or products change
  useEffect(() => {
    onSessionsChangeRef.current?.(allSessionsInfo);
  }, [allSessionsInfo]);

  // Auto-collapse all previous sessions when a new one starts
  useEffect(() => {
    const count = chatSessions.length;
    if (count > 1 && count > prevSessionCountRef.current) {
      setCollapsedSessionIds(new Set(chatSessions.slice(0, -1).map(s => s.id)));
    }
    prevSessionCountRef.current = count;
  }, [chatSessions.length]);

  // Accordion toggle: expanding one session collapses all others
  const toggleSession = useCallback((id: string) => {
    const wasCollapsed = collapsedSessionIdsRef.current.has(id);
    if (wasCollapsed) {
      // Expanding → accordion: collapse all others
      setCollapsedSessionIds(new Set(chatSessions.filter(s => s.id !== id).map(s => s.id)));
      // Notify parent so right panel syncs to this session
      const session = chatSessions.find(s => s.id === id);
      if (session) {
        const prods = sessionProductsMap.get(id) ?? [];
        onActiveSessionChangeRef.current?.(id, session.query, prods);
      }
    } else {
      // Collapsing
      setCollapsedSessionIds(prev => { const next = new Set(prev); next.add(id); return next; });
    }
  }, [chatSessions, sessionProductsMap]);

  const toUnitScore = (value: unknown, fallback = 0): number => {
    if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
    if (value > 1) return Math.max(0, Math.min(1, value / 100));
    return Math.max(0, Math.min(1, value));
  };

  const buildRankedProducts = useCallback(
    (
      rawProducts: any[],
      budget?: { min?: number; max?: number },
      fallbackSource = 'DelegateCart'
    ): RankedProduct[] => {
      const maxBudget = typeof budget?.max === 'number' && budget.max > 0 ? budget.max : 0;

      // Hard budget gate for trust: never surface items above user max budget.
      const filtered =
        maxBudget > 0
          ? rawProducts.filter((p) => {
            const price = Number(p?.price ?? 0);
            return Number.isFinite(price) && price > 0 && price <= maxBudget;
          })
          : rawProducts;

      return filtered.map((p, idx) => {
        const price = Number(p?.price ?? 0);
        const rating = Number(p?.rating ?? 4.0);
        const reviewCount = Number(p?.reviewCount ?? 0);
        const originalPrice = Number(p?.originalPrice ?? p?.price ?? 0);
        const discountPct =
          originalPrice > price && originalPrice > 0
            ? Math.round(((originalPrice - price) / originalPrice) * 100)
            : 0;

        const rawScore =
          typeof p?.relevanceScore === 'number'
            ? p.relevanceScore
            : typeof p?.score === 'number'
              ? p.score
              : typeof p?.final_score === 'number'
                ? p.final_score
                : null;
        const score =
          rawScore == null
            ? Math.max(0.35, Math.min(0.95, (rating / 5) * 0.75 + (idx === 0 ? 0.15 : 0)))
            : toUnitScore(rawScore, 0.5);

        const confidence =
          typeof p?.confidence === 'number'
            ? toUnitScore(p.confidence, Math.max(0.5, score))
            : Math.max(0.5, Math.min(0.98, score * 0.92 + 0.06));

        const detail = p?.explanation_details ?? p?.explanation ?? {};

        let budgetFitScore = 0.7;
        let budgetFitReason = 'Budget information not available';
        if (maxBudget > 0 && price > 0) {
          if (price <= maxBudget) {
            const savings = maxBudget - price;
            budgetFitScore = Math.max(0.65, Math.min(1, 0.78 + (savings / maxBudget) * 0.22));
            budgetFitReason =
              savings > 0
                ? `₹${savings.toLocaleString('en-IN')} under your budget`
                : 'At your maximum budget';
          } else {
            budgetFitScore = 0;
            budgetFitReason = `₹${(price - maxBudget).toLocaleString('en-IN')} over your budget`;
          }
        }

        const deliveryTime =
          p?.delivery && typeof p.delivery.daysMin === 'number' && typeof p.delivery.daysMax === 'number'
            ? `${p.delivery.daysMin}-${p.delivery.daysMax} days`
            : (p?.delivery_time ?? '3-5 days');

        return {
          rank: idx + 1,
          product: {
            id: String(p?.id ?? `prod-${Date.now()}-${idx}`),
            name: p?.name ?? 'Unknown Product',
            brand: p?.brand ?? '',
            price,
            original_price: originalPrice || undefined,
            discount_percent: discountPct,
            rating,
            review_count: reviewCount,
            delivery_time: deliveryTime,
            key_features: Array.isArray(p?.key_features) ? p.key_features : [],
            source: p?.isDBProduct ? 'DelegateCart' : (p?.source ?? fallbackSource),
            imageUrl: p?.image ?? p?.imageUrl ?? '',
            isExternal: Boolean(p?.isExternal) || p?.isDBProduct === false,
          },
          score,
          confidence,
          explanation: {
            product_id: String(p?.id ?? idx),
            final_score: score,
            summary:
              p?.aiExplanation ??
              detail?.summary ??
              `${p?.brand ?? ''} ${p?.name ?? ''} — recommended based on your query.`,
            key_strengths: detail?.strengths ?? detail?.key_strengths ?? [],
            key_weaknesses: detail?.weaknesses ?? detail?.key_weaknesses ?? [],
            budget_fit_score: {
              score: toUnitScore(detail?.budget_fit_score?.score, budgetFitScore),
              reason: detail?.budget_fit_score?.reason ?? budgetFitReason,
            },
            quality_score: {
              score: toUnitScore(detail?.quality_score?.score, Math.max(0.4, rating / 5)),
              reason: detail?.quality_score?.reason ?? `${rating.toFixed(1)} star rating`,
            },
            brand_preference_score: {
              score: toUnitScore(detail?.brand_preference_score?.score, 0.75),
              reason: detail?.brand_preference_score?.reason ?? 'Brand relevance from intent',
            },
            delivery_speed_score: {
              score: toUnitScore(detail?.delivery_speed_score?.score, 0.75),
              reason: detail?.delivery_speed_score?.reason ?? deliveryTime,
            },
            ratings_score: {
              score: toUnitScore(detail?.ratings_score?.score, Math.max(0.35, rating / 5)),
              reason: detail?.ratings_score?.reason ?? `${reviewCount} reviews`,
            },
          },
        } as RankedProduct;
      });
    },
    []
  );

  const handleSendMessage = async (text: string) => {
    try {
      // Send message
      await sendMessage(text);

      // Analyze intent
      const intentResult = await analyzeIntent(text);

      // Always extract clarifying questions so we can show them regardless of product results
      const clarifyingQuestions: any[] = intentResult?.clarifying_questions ?? [];

      // If the v2 engine returned products directly, inject them as a recommendation message
      // so the carousel appears immediately (no need to go through the answer-question flow)
      if (intentResult?.products && intentResult.products.length > 0) {
        const budget = intentResult.intent?.budget;
        const rankedProducts = buildRankedProducts(
          intentResult.products as any[],
          budget,
          'DelegateCart'
        );

        if (rankedProducts.length === 0 && budget?.max && budget.max > 0) {
          addMessage({
            role: 'assistant',
            type: 'text',
            content: `I found products, but none were within your budget of ₹${budget.max.toLocaleString('en-IN')}. Try a higher budget or a different brand.`,
          });
          // Still surface clarifying questions so the user can refine
          if (clarifyingQuestions.length > 0) {
            addMessage({
              role: 'assistant',
              type: 'clarifying_question',
              content: 'Let me ask a couple of questions to find better matches:',
              questions: clarifyingQuestions,
            });
          }
          return;
        }

        addMessage({
          role: 'assistant',
          type: 'product_recommendation',
          content: `Here are my top ${rankedProducts.length} recommendations for you:`,
          products: rankedProducts,
        });
        onProductsFound?.(rankedProducts);
        // Also attempt background ranking (fire-and-forget)
        rankProducts(intentResult.intent, intentResult.products).catch(() => { });

        // Show clarifying questions after products so users can refine results further
        if (clarifyingQuestions.length > 0) {
          addMessage({
            role: 'assistant',
            type: 'clarifying_question',
            content: 'Want to narrow down the results?',
            questions: clarifyingQuestions,
          });
        }
      } else if (clarifyingQuestions.length > 0) {
        // No products found yet — ask clarifying questions to gather more context
        addMessage({
          role: 'assistant',
          type: 'clarifying_question',
          content: intentResult?.initial_text || 'To find the best match, I need a few more details:',
          questions: clarifyingQuestions,
        });
      } else {
        // Both products and questions are empty (e.g. API failure or unrecognised category).
        // Show a helpful message so the pipeline doesn't appear silently stuck.
        const cat = intentResult?.intent?.category;
        addMessage({
          role: 'assistant',
          type: 'text',
          content: cat
            ? `I'm searching for the best ${cat} options for you. Could you share more details — like your preferred brand, budget, or a specific use case — so I can find the right match?`
            : `I couldn't quite understand what you're looking for. Could you rephrase or add details like a product name, brand, or budget?`,
        });
      }
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const handleAnswerQuestion = async (
    questionId: string,
    answer: string | number | boolean,
    questionCategory?: string,
    displayLabel?: string,
  ) => {
    // Immediately mark as answered in the store (with label) so it survives navigation
    useChatStore.getState().addAnsweredQuestion(questionId, displayLabel || String(answer));
    try {
      const data = await answerQuestion(questionId, answer, questionCategory);

      if (!data?.ready) {
        // Intermediate answer — show acknowledgment so user knows it was recorded
        const answered = data?.answers_collected ?? 1;
        // Use actual question count from server response or from what was generated
        const total = data?.total_questions ?? totalQuestions ?? 3;
        const remaining = total - answered;
        addMessage({
          role: 'assistant',
          type: 'text',
          content: remaining > 0
            ? `Got it! (${answered}/${total} answered) — just ${remaining} more question${remaining !== 1 ? 's' : ''} to go.`
            : `Got it! Preparing your recommendations...`,
        });
        return;
      }

      // When all questions are answered the API returns products — inject them directly as a recommendation message
      if (Array.isArray(data?.products) && data.products.length > 0) {
        const effectiveBudget =
          (data?.updated_intent?.budget as { min?: number; max?: number } | undefined) ??
          (intent?.budget as { min?: number; max?: number } | undefined);
        const rankedProducts = buildRankedProducts(data.products as any[], effectiveBudget, 'DelegateCart');

        if (rankedProducts.length === 0 && effectiveBudget?.max && effectiveBudget.max > 0) {
          addMessage({
            role: 'assistant',
            type: 'text',
            content: `Thanks for the answers. I could not find options within ₹${effectiveBudget.max.toLocaleString('en-IN')}. You can increase the budget or relax brand constraints.`,
          });
          return;
        }

        addMessage({
          role: 'assistant',
          type: 'product_recommendation',
          content: `Great! Based on your preferences, here are my top ${rankedProducts.length} recommendations:`,
          products: rankedProducts,
        });
        onProductsFound?.(rankedProducts);
      } else {
        // Ready but no products — try external suggestions if toggle is ON
        if (showExternalProducts) {
          const answersContext = Object.values(
            typeof window !== 'undefined'
              ? JSON.parse(sessionStorage.getItem(`answers_${userId}`) || '{}')
              : {}
          ) as string[];
          addMessage({
            role: 'assistant',
            type: 'text',
            content: `No catalog matches found. Searching for external suggestions...`,
          });
          const extProducts = await generateExternalProducts(
            intent?.user_intent || latestUserMessage,
            answersContext,
          );
          if (extProducts.length > 0) {
            addMessage({
              role: 'assistant',
              type: 'product_recommendation',
              content: `Here are ${extProducts.length} external suggestions (not in our catalog):`,
              products: extProducts,
            });
            onProductsFound?.(extProducts);
            return;
          }
        }
        addMessage({
          role: 'assistant',
          type: 'text',
          content: `I couldn't find exact matches right now. Try searching directly (e.g. "laptops under ₹50,000") for the best results.`,
        });
      }
    } catch (err) {
      console.error('Error answering question:', err);
      addMessage({
        role: 'assistant',
        type: 'text',
        content: `Sorry, something went wrong processing your answer. Please try again.`,
      });
    }
  };

  // Get latest product recommendations from messages
  const latestRecommendations = messages
    .filter((msg) => msg.type === 'product_recommendation')
    .reverse()[0]?.products || (ranking?.ranked_products ?? null);

  // Recalculate pinned carousel scroll state whenever recommendations change
  useEffect(() => {
    const el = pinnedCarouselRef.current;
    if (!el) return;
    // Small delay to let layout settle before measuring
    const id = requestAnimationFrame(() => {
      setPinnedCanScrollLeft(el.scrollLeft > 4);
      setPinnedCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    });
    return () => cancelAnimationFrame(id);
  }, [latestRecommendations]);

  // Get latest user message for floating header display
  const latestUserMessage = messages.filter(m => m.role === 'user').reverse()[0]?.content || '';
  const userMessages = messages.filter(m => m.role === 'user');

  return (
    <div className="flex flex-col bg-white">
      {/* Chat Panel Header — sticky below the 61px navbar, like an Excel frozen row */}
      <div className="flex-shrink-0 sticky top-[61px] z-40 border-b border-gray-200 bg-gradient-to-r from-blue-500 to-blue-600 p-4 text-white shadow-md rounded-t-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Sparkles className="w-6 h-6 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold">{title}</h2>
              {latestUserMessage ? (
                <button
                  onClick={() => setShowHistoryModal(true)}
                  className="text-sm text-blue-100 hover:text-white transition-colors truncate block max-w-full text-left"
                  title="Click to see chat history"
                >
                  &ldquo;{latestUserMessage.length > 50 ? latestUserMessage.slice(0, 50) + '...' : latestUserMessage}&rdquo;
                </button>
              ) : (
                <p className="text-sm text-blue-100">{intent ? intent.user_intent : 'Ready to help'}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* External products toggle — off by default; always rendered so testers can enable it */}
            <button
              onClick={handleToggleExternal}
              data-testid="external-toggle"
              title={showExternalProducts ? 'External products ON — click to disable' : 'External products OFF — click to enable'}
              className={`text-xs px-2 py-1 rounded-lg border transition-colors ${showExternalProducts
                ? 'bg-amber-400/30 border-amber-300 text-amber-100 font-semibold'
                : 'bg-white/10 border-white/20 text-blue-200 hover:bg-white/20'
                }`}
            >
              🌐 Ext{showExternalProducts ? ': ON' : ': OFF'}
            </button>
            {userMessages.length > 0 && (
              <button
                onClick={() => setShowHistoryModal(true)}
                className="text-xs bg-white/20 hover:bg-white/30 px-2 py-1 rounded-lg transition-colors"
              >
                History ({userMessages.length})
              </button>
            )}
            <button
              onClick={handleClearHistory}
              className="text-sm text-blue-100 hover:text-white transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Chat History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowHistoryModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[70vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-t-2xl">
              <h3 className="font-semibold flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Your Messages</h3>
              <button onClick={() => setShowHistoryModal(false)} className="hover:bg-white/20 p-1 rounded-lg transition-colors">
                <span className="text-lg">&times;</span>
              </button>
            </div>
            <div className="overflow-y-auto max-h-[55vh] p-4 space-y-3">
              {userMessages.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">No messages yet</p>
              ) : (
                userMessages.map((msg, i) => (
                  <div key={msg.id} className="p-3 bg-blue-50 rounded-xl">
                    <p className="text-sm text-gray-900">{msg.content}</p>
                    <p className="text-[10px] text-gray-400 mt-1">
                      {new Date(msg.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      {msg.metadata?.voice && <span className="ml-2 text-purple-500">🎤 Voice input</span>}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Messages Container — no panel scrollbar; browser scrollbar handles all scroll */}
      <div className="p-4 space-y-3">
        {/* Welcome message (first assistant message before any user query) */}
        {messages.filter(m => m.role === 'assistant' && chatSessions.length === 0).map(msg => (
          <div key={msg.id}>
            <ChatMessage role="assistant" content={msg.content} timestamp={msg.timestamp} />
          </div>
        ))}

        {/* Collapsible chat sessions — one per user query */}
        {chatSessions.map((session, idx) => {
          const isLatest = idx === chatSessions.length - 1;
          const isCollapsed = collapsedSessionIds.has(session.id);
          const hasProducts = session.productCount > 0;

          return (
            <div
              key={session.id}
              data-testid={`chat-session-${idx}`}
              className={`rounded-2xl border overflow-hidden transition-all duration-200 ${isLatest
                ? 'border-blue-200 shadow-sm'
                : 'border-gray-200'
                }`}
            >
              {/* Session header — always visible, click to toggle */}
              <button
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${isLatest
                  ? isCollapsed
                    ? 'bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100'
                    : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white'
                  : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                onClick={() => toggleSession(session.id)}
                aria-expanded={!isCollapsed}
                data-testid={`session-toggle-${idx}`}
              >
                {/* Session index badge */}
                <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${isLatest && !isCollapsed ? 'bg-white/20 text-white' : isLatest ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'
                  }`}>
                  {idx + 1}
                </div>

                {/* Query text */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold truncate ${isLatest && !isCollapsed ? 'text-white' : isLatest ? 'text-blue-900' : 'text-gray-700'
                    }`}>
                    {session.query.length > 80 ? session.query.slice(0, 80) + '…' : session.query}
                  </p>
                  {isCollapsed && (
                    <p className={`text-[11px] mt-0.5 ${isLatest ? 'text-blue-600' : 'text-gray-400'
                      }`}>
                      {hasProducts
                        ? `${session.productCount} product${session.productCount !== 1 ? 's' : ''} found`
                        : 'Click to expand'}
                      {' · '}
                      {session.messages.length} message{session.messages.length !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>

                {/* Status indicators */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {hasProducts && isCollapsed && (
                    <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${isLatest ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                      <CheckCircle2 className="w-3 h-3" />
                      {session.productCount}
                    </span>
                  )}
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isCollapsed ? '' : 'rotate-180'
                    } ${isLatest && !isCollapsed ? 'text-white' : isLatest ? 'text-blue-500' : 'text-gray-400'}`} />
                </div>
              </button>

              {/* Session content — animated expand/collapse */}
              <AnimatePresence initial={false}>
                {!isCollapsed && (
                  <motion.div
                    key="content"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div className={`p-4 space-y-4 ${isLatest ? 'bg-white' : 'bg-gray-50/50'}`}>
                      {session.messages.map((msg) => (
                        <div key={msg.id}>
                          <ChatMessage
                            role={msg.role as 'user' | 'assistant'}
                            content={msg.content}
                            timestamp={msg.timestamp}
                            intent={msg.metadata?.intent_id}
                          />

                          {/* Product Recommendations */}
                          {msg.type === 'product_recommendation' && msg.products && msg.products.length > 0 && (
                            <div className="mt-3 w-full min-w-0 overflow-hidden">
                              <ProductRecommendationCarousel
                                products={msg.products}
                                onSelectProduct={(product) => {
                                  setSelectedProduct(product);
                                  onProductSelect?.(product);
                                }}
                                showComparison={showComparison}
                                onCompareToggle={() => {
                                  setShowComparison(true);
                                  onOpenCompare?.(msg.products!);
                                }}
                              />
                            </div>
                          )}

                          {/* Clarifying Questions */}
                          {msg.type === 'clarifying_question' && msg.questions && msg.questions.length > 0 && (
                            <div className="mt-4 ml-12 space-y-3">
                              {msg.questions.map((question) => (
                                <ClarifyingQuestionCard
                                  key={question.id}
                                  question={question}
                                  onAnswer={(answer, displayLabel) => handleAnswerQuestion(question.id, answer, question.category, displayLabel)}
                                  isLoading={isAnalyzing}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        {/* Ranking Progress */}
        {isRanking && (
          <div className="flex gap-3">
            <div className="flex-1">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">Ranking products...</span>
                </div>
                <RankingProgressBar progress={progress} />
              </div>
            </div>
          </div>
        )}

        {/* Pending Questions */}
        {questions.length > 0 && !isAnalyzing && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-sm font-medium text-amber-900 mb-3">Please answer a few questions:</p>
            <div className="space-y-3">
              {questions.map((question) => (
                <ClarifyingQuestionCard
                  key={question.id}
                  question={question}
                  onAnswer={(answer, displayLabel) => handleAnswerQuestion(question.id, answer, question.category, displayLabel)}
                  isLoading={isAnalyzing}
                />
              ))}
            </div>
          </div>
        )}

        {/* Typing Indicator */}
        {typingIndicator && (
          <div className="flex gap-2">
            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-gray-600 animate-bounce"></div>
                <div className="w-1.5 h-1.5 rounded-full bg-gray-600 animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-1.5 h-1.5 rounded-full bg-gray-600 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        )}

        {/* End reference for auto-scroll */}
        <div ref={messagesEndRef} />
      </div>

      {/* Error Message */}
      {error && (
        <div className="mx-4 mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}

      {/* Recommended Products Display — pinned at bottom, overflow-hidden prevents stretch */}
      {latestRecommendations && latestRecommendations.length > 0 && (
        <div className="border-t border-gray-200 bg-gray-50 p-4 overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2 text-sm">
              <ShoppingCart className="w-4 h-4" />
              Top Recommendations
            </h3>
            <span className="text-xs text-gray-600">
              {latestRecommendations.length} products found
            </span>
          </div>
          {/* Carousel with prev/next arrow navigation */}
          <div className="relative group">
            {/* Left gradient fade + arrow */}
            <div
              className={`absolute left-0 top-0 bottom-[0.5rem] w-10 z-10 pointer-events-none bg-gradient-to-r from-gray-50/90 to-transparent transition-opacity duration-200 ${pinnedCanScrollLeft ? 'opacity-100' : 'opacity-0'
                }`}
            />
            <button
              onClick={() => {
                const el = pinnedCarouselRef.current;
                if (!el) return;
                el.scrollBy({ left: -(176 + 8), behavior: 'smooth' });
              }}
              aria-label="Scroll recommendations left"
              className={`absolute left-0 top-1/2 -translate-y-1/2 z-20 w-7 h-7 bg-white border border-gray-200 rounded-full shadow-md hover:shadow-lg hover:bg-gray-50 flex items-center justify-center transition-all ${pinnedCanScrollLeft
                ? 'opacity-100 pointer-events-auto'
                : 'opacity-0 pointer-events-none group-hover:opacity-40'
                }`}
            >
              <ChevronLeft className="w-3.5 h-3.5 text-gray-600" />
            </button>

            {/* Scroll container */}
            <div
              ref={pinnedCarouselRef}
              className="w-full overflow-x-auto pb-2 hide-scrollbar"
              onScroll={() => {
                const el = pinnedCarouselRef.current;
                if (!el) return;
                setPinnedCanScrollLeft(el.scrollLeft > 4);
                setPinnedCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
              }}
            >
              <div className="flex gap-2 w-max px-1">
                {latestRecommendations.slice(0, 8).map((product) => (
                  <div
                    key={product.product.id}
                    className="flex-shrink-0 w-44 bg-white border border-gray-200 rounded-xl p-3 hover:shadow-md transition-shadow cursor-pointer hover:border-blue-300"
                    onClick={() => {
                      setDetailModalProduct(product);
                      setSelectedProduct(product);
                      onProductSelect?.(product);
                    }}
                  >
                    {/* Thumbnail */}
                    {product.product.imageUrl && (
                      <div className="w-full h-20 bg-gray-50 rounded-lg overflow-hidden flex items-center justify-center mb-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={product.product.imageUrl} alt={product.product.name} className="max-w-full max-h-full object-contain" loading="lazy" />
                      </div>
                    )}
                    <div className="flex items-start justify-between mb-1.5">
                      <span className="text-xs font-bold text-blue-600">#{product.rank}</span>
                      <div className="flex items-center gap-1">
                        {product.product.isExternal ? (
                          <span
                            title="External product — not in DelegateCart catalog"
                            data-testid="external-badge-mini"
                            className="inline-flex items-center gap-0.5 text-[9px] bg-amber-100 text-amber-700 font-bold px-1 py-0.5 rounded-full"
                          >
                            <Globe className="w-2.5 h-2.5" />Ext
                          </span>
                        ) : (
                          <span
                            title="Native product — in DelegateCart catalog"
                            data-testid="native-badge-mini"
                            className="inline-flex items-center gap-0.5 text-[9px] bg-green-100 text-green-700 font-bold px-1 py-0.5 rounded-full"
                          >
                            <Store className="w-2.5 h-2.5" />DC
                          </span>
                        )}
                        <span className="text-[10px] bg-green-100 text-green-700 font-semibold px-1.5 py-0.5 rounded-full">
                          {(product.score * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <p className="text-xs font-semibold text-gray-900 line-clamp-2 leading-tight mb-1">{product.product.name}</p>
                    <p className="text-[10px] text-gray-500 mb-2">{product.product.brand}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-gray-900">₹{product.product.price.toLocaleString()}</span>
                      <span className="text-[10px] text-amber-600">⭐ {product.product.rating}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right gradient fade + arrow */}
            <div
              className={`absolute right-0 top-0 bottom-[0.5rem] w-10 z-10 pointer-events-none bg-gradient-to-l from-gray-50/90 to-transparent transition-opacity duration-200 ${pinnedCanScrollRight ? 'opacity-100' : 'opacity-0'
                }`}
            />
            <button
              onClick={() => {
                const el = pinnedCarouselRef.current;
                if (!el) return;
                el.scrollBy({ left: 176 + 8, behavior: 'smooth' });
              }}
              aria-label="Scroll recommendations right"
              className={`absolute right-0 top-1/2 -translate-y-1/2 z-20 w-7 h-7 bg-white border border-gray-200 rounded-full shadow-md hover:shadow-lg hover:bg-gray-50 flex items-center justify-center transition-all ${pinnedCanScrollRight
                ? 'opacity-100 pointer-events-auto'
                : 'opacity-0 pointer-events-none group-hover:opacity-40'
                }`}
            >
              <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
            </button>
          </div>
        </div>
      )}

      {/* Input Area — sticky at bottom so it's always visible while scrolling */}
      <div className="sticky bottom-0 z-30 border-t border-gray-200 p-4 bg-gray-50 rounded-b-2xl">
        <ChatInput
          onSend={handleSendMessage}
          disabled={isLoading || isAnalyzing || isRanking}
          placeholder="Ask me anything about products..."
          onAttachFile={(file) => {
            console.log('File attached:', file);
          }}
        />
      </div>

      {/* Product Detail Modal */}
      {detailModalProduct && (
        <ProductDetailModal
          productId={detailModalProduct.product.id}
          rankedProduct={detailModalProduct}
          onClose={() => setDetailModalProduct(null)}
        />
      )}
    </div>
  );
};
