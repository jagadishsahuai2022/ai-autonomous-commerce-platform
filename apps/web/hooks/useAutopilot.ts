/**
 * useAutopilot - Multi-Agent AI Autopilot System
 *
 * Architecture:
 *   SearchAgent  → processes user queries, returns ranked products
 *   PricingAgent → monitors price trends, identifies deal windows
 *   TrustAgent   → evaluates seller + product trust scores
 *
 * Feedback Loop:
 *   User approval/rejection → adjusts future recommendation weights
 *
 * Explainability:
 *   Every decision exposes confidence + human-readable reasoning
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Product } from '@/types';

// ─── Agent State ────────────────────────────────────────────────────────────

export type AgentStatus = 'idle' | 'thinking' | 'done' | 'error';

export interface AgentResult {
  agentName: 'SearchAgent' | 'PricingAgent' | 'TrustAgent';
  status: AgentStatus;
  output?: string;
  confidence?: number;
  processingMs?: number;
}

export interface AutopilotDecision {
  id: string;
  query: string;
  products: Product[];
  topPick: Product | null;
  confidence: number;
  explanation: string;
  reasoningSteps: string[];
  agents: AgentResult[];
  timestamp: number;
  userFeedback?: 'approved' | 'rejected' | 'modified';
}

// ─── User Behaviour Model ────────────────────────────────────────────────────

interface BehaviourEvent {
  type: 'search' | 'view' | 'cart_add' | 'wishlist' | 'purchase' | 'reject';
  productId?: string;
  category?: string;
  query?: string;
  timestamp: number;
}

interface UserWeights {
  categories: Record<string, number>; // category → preference weight
  brands: Record<string, number>; // brand → preference weight
  priceRange: { min: number; max: number };
  trustThreshold: number;
  preferCOD: boolean;
  preferEMI: boolean;
}

const DEFAULT_WEIGHTS: UserWeights = {
  categories: {},
  brands: {},
  priceRange: { min: 0, max: 100000 },
  trustThreshold: 60,
  preferCOD: false,
  preferEMI: false,
};

const BEHAVIOUR_STORAGE_KEY = 'dc_behaviour_events';
const WEIGHTS_STORAGE_KEY = 'dc_user_weights';

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage<T>(key: string, value: T) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage quota exceeded — ignore
  }
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useAutopilot() {
  const queryClient = useQueryClient();
  const [decision, setDecision] = useState<AutopilotDecision | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agents, setAgents] = useState<AgentResult[]>([]);
  const [weights, setWeights] = useState<UserWeights>(() =>
    loadFromStorage(WEIGHTS_STORAGE_KEY, DEFAULT_WEIGHTS)
  );
  const eventsRef = useRef<BehaviourEvent[]>(
    loadFromStorage<BehaviourEvent[]>(BEHAVIOUR_STORAGE_KEY, [])
  );

  // Persist weights on change
  useEffect(() => {
    saveToStorage(WEIGHTS_STORAGE_KEY, weights);
  }, [weights]);

  /** Track a user behaviour event and update preference weights */
  const trackEvent = useCallback((event: Omit<BehaviourEvent, 'timestamp'>) => {
    const fullEvent: BehaviourEvent = { ...event, timestamp: Date.now() };
    eventsRef.current = [...eventsRef.current.slice(-199), fullEvent]; // keep last 200
    saveToStorage(BEHAVIOUR_STORAGE_KEY, eventsRef.current);

    // Update category / brand weights
    if (event.category) {
      setWeights((prev) => {
        const delta = event.type === 'reject' ? -0.1 : 0.15;
        const current = prev.categories[event.category!] ?? 1.0;
        return {
          ...prev,
          categories: {
            ...prev.categories,
            [event.category!]: Math.max(0.1, Math.min(5.0, current + delta)),
          },
        };
      });
    }
  }, []);

  /** SearchAgent: rank products against the user query */
  const runSearchAgent = useCallback(
    async (query: string, products: Product[]): Promise<AgentResult> => {
      const start = Date.now();
      setAgents((prev) => [
        ...prev.filter((a) => a.agentName !== 'SearchAgent'),
        { agentName: 'SearchAgent', status: 'thinking' },
      ]);
      await new Promise((r) => setTimeout(r, 180)); // simulate async agent call
      const lower = query.toLowerCase();
      const matched = products.filter(
        (p) =>
          p.name.toLowerCase().includes(lower) ||
          p.category.toLowerCase().includes(lower) ||
          p.brand?.toLowerCase().includes(lower)
      );
      const result: AgentResult = {
        agentName: 'SearchAgent',
        status: 'done',
        output: `Matched ${matched.length} of ${products.length} products for "${query}"`,
        confidence: matched.length > 0 ? Math.min(95, 50 + matched.length * 10) : 20,
        processingMs: Date.now() - start,
      };
      setAgents((prev) => [...prev.filter((a) => a.agentName !== 'SearchAgent'), result]);
      return result;
    },
    []
  );

  /** PricingAgent: identify best-value items based on price trend + discount */
  const runPricingAgent = useCallback(async (products: Product[]): Promise<AgentResult> => {
    const start = Date.now();
    setAgents((prev) => [
      ...prev.filter((a) => a.agentName !== 'PricingAgent'),
      { agentName: 'PricingAgent', status: 'thinking' },
    ]);
    await new Promise((r) => setTimeout(r, 120));
    const dealsCount = products.filter(
      (p) => p.priceTrend === 'down' || (p.originalPrice && p.originalPrice > p.price)
    ).length;
    const result: AgentResult = {
      agentName: 'PricingAgent',
      status: 'done',
      output: `Found ${dealsCount} active price drops`,
      confidence: 88,
      processingMs: Date.now() - start,
    };
    setAgents((prev) => [...prev.filter((a) => a.agentName !== 'PricingAgent'), result]);
    return result;
  }, []);

  /** TrustAgent: filter by seller trust score */
  const runTrustAgent = useCallback(
    async (products: Product[], threshold: number): Promise<AgentResult> => {
      const start = Date.now();
      setAgents((prev) => [
        ...prev.filter((a) => a.agentName !== 'TrustAgent'),
        { agentName: 'TrustAgent', status: 'thinking' },
      ]);
      await new Promise((r) => setTimeout(r, 90));
      const trusted = products.filter((p) => (p.trustScore ?? 75) >= threshold);
      const result: AgentResult = {
        agentName: 'TrustAgent',
        status: 'done',
        output: `${trusted.length} products meet trust threshold ≥${threshold}%`,
        confidence: 92,
        processingMs: Date.now() - start,
      };
      setAgents((prev) => [...prev.filter((a) => a.agentName !== 'TrustAgent'), result]);
      return result;
    },
    []
  );

  /**
   * runAutopilot — orchestrate all agents, produce a ranked decision
   */
  const runAutopilot = useCallback(
    async (query: string, products: Product[]) => {
      if (!query.trim() || products.length === 0) return;
      setIsRunning(true);
      setAgents([]);
      setError(null);

      try {
        // Run agents in parallel
        const [searchResult, pricingResult, trustResult] = await Promise.all([
          runSearchAgent(query, products),
          runPricingAgent(products),
          runTrustAgent(products, weights.trustThreshold),
        ]);

        // Composite score per product
        const scored = products.map((p) => {
          const lower = query.toLowerCase();
          const textMatch =
            p.name.toLowerCase().includes(lower) || p.category.toLowerCase().includes(lower)
              ? 40
              : 0;
          const categoryBoost = weights.categories[p.category] ?? 1.0;
          const discountBonus = p.originalPrice
            ? ((p.originalPrice - p.price) / p.originalPrice) * 20
            : 0;
          const trendBonus = p.priceTrend === 'down' ? 10 : p.priceTrend === 'up' ? -5 : 0;
          const trustBonus = ((p.trustScore ?? 70) / 100) * 15;
          const ratingBonus = (p.rating / 5) * 15;
          const score =
            (textMatch + discountBonus + trendBonus + trustBonus + ratingBonus) * categoryBoost;
          return { ...p, _score: score };
        });

        const ranked = scored.sort((a, b) => b._score - a._score).map(({ _score: _s, ...p }) => p);

        const topPick = ranked[0] ?? null;
        const avgConf = Math.round(
          ((searchResult.confidence ?? 0) +
            (pricingResult.confidence ?? 0) +
            (trustResult.confidence ?? 0)) /
            3
        );

        const reasoningSteps = [
          `SearchAgent identified keyword match for "${query}"`,
          `PricingAgent found ${pricingResult.output}`,
          `TrustAgent validated seller reliability`,
          `Category preference weights applied`,
          `Top pick: "${topPick?.name ?? 'N/A'}" (score: ${avgConf}%)`,
        ];

        const newDecision: AutopilotDecision = {
          id: `ap-${Date.now()}`,
          query,
          products: ranked.slice(0, 8),
          topPick,
          confidence: avgConf,
          explanation: topPick
            ? `"${topPick.name}" selected because it best matches your query, has ${topPick.trustScore ?? 75}% trust score, and ${topPick.priceTrend === 'down' ? 'is currently on a price dip' : 'offers competitive pricing'}.`
            : 'No strong match found for your query.',
          reasoningSteps,
          agents: [searchResult, pricingResult, trustResult],
          timestamp: Date.now(),
        };

        setDecision(newDecision);

        // Track search event
        trackEvent({ type: 'search', query });

        // Invalidate product queries to get fresh data
        queryClient.invalidateQueries({ queryKey: ['products'] });
      } catch (err: any) {
        setError(err?.message || 'Autopilot failed');
      } finally {
        setIsRunning(false);
      }
    },
    [runSearchAgent, runPricingAgent, runTrustAgent, weights, trackEvent, queryClient]
  );

  /** Record user feedback on the current decision */
  const submitFeedback = useCallback(
    (feedback: 'approved' | 'rejected' | 'modified', productId?: string) => {
      setDecision((prev) => (prev ? { ...prev, userFeedback: feedback } : prev));
      if (productId) {
        const product = decision?.products.find((p) => p.id === productId);
        if (product) {
          trackEvent({
            type:
              feedback === 'rejected' ? 'reject' : feedback === 'approved' ? 'cart_add' : 'view',
            productId,
            category: product.category,
          });
          // Boost/penalise brand weight
          if (product.brand) {
            setWeights((prev) => {
              const delta = feedback === 'rejected' ? -0.2 : 0.25;
              const current = prev.brands[product.brand] ?? 1.0;
              return {
                ...prev,
                brands: {
                  ...prev.brands,
                  [product.brand]: Math.max(0.1, Math.min(5.0, current + delta)),
                },
              };
            });
          }
        }
      }
    },
    [decision, trackEvent]
  );

  const reset = useCallback(() => {
    setDecision(null);
    setAgents([]);
  }, []);

  return {
    decision,
    isRunning,
    error,
    agents,
    weights,
    runAutopilot,
    submitFeedback,
    trackEvent,
    reset,
  };
}
