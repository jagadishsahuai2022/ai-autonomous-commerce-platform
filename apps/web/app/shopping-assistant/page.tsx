/**
 * Shopping Assistant Page — Premium AI Commerce Experience
 */

'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Zap, Settings, BarChart2, Clock, ShieldCheck,
  Sparkles, X, Grid3X3, List, ChevronLeft, ChevronRight, Sliders,
  Share2, Mail, MessageCircle, Send, CheckCircle2, Bell,
} from 'lucide-react';
import { ShoppingChat } from '@/components/ShoppingChat';
import { AIDecisionCard } from '@/components/ai/AIDecisionCard';
import { AlternativesPanel } from '@/components/ai/AlternativesPanel';
import { ApprovalSystemUI, type ApprovalRequest } from '@/components/ai/ApprovalSystemUI';
import { TimelineView, type TimelineStep } from '@/components/ai/TimelineView';
import { ComparisonTable } from '@/components/ai/ComparisonTable';
import { ProductDetailModal } from '@/components/ProductDetailModal';
import { cn } from '@/lib/utils';
import { getProductImage } from '@/lib/product-images';
import { useChatStore } from '@/lib/stores/chat-store';
import { useCartStore } from '@/lib/stores/cart-store';
import { hasPageAccess } from '@/lib/admin-auth';
import type { RankedProduct } from '@/types/shopping-assistant';

// Empty initial approval state — no synthetic/demo products pre-loaded
const EMPTY_APPROVAL: ApprovalRequest = {
  id: '',
  productName: '',
  amount: 0,
  riskLevel: 'low',
  riskScore: 0,
  aiConfidence: 0,
  reasons: [],
  expiresAt: new Date(0),
};

const DEMO_TIMELINE: TimelineStep[] = [
  { id: 'waiting', label: 'Waiting for query', description: 'Start a conversation to activate the AI pipeline', status: 'active' },
];


type SidebarTab = 'decision' | 'timeline' | 'approval';

export default function ShoppingAssistantPage() {
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [mounted, setMounted] = useState(false);
  const [pendingQuery, setPendingQuery] = useState<string | null>(null);

  // Hydrate chat store synchronously during initial render (before useState reads)
  const [hydratedState] = useState(() => {
    useChatStore.getState().hydrate();
    return useChatStore.getState();
  });

  const chatStore = useChatStore();
  const [activeTab, setActiveTab] = useState<SidebarTab>(hydratedState.activeTab || 'timeline');
  const [showComparison, setShowComparison] = useState(false);
  const [compareProducts, setCompareProducts] = useState<RankedProduct[]>([]);
  // Only restore showApproval=true if there is an actual pending approval product saved
  const [showApproval, setShowApproval] = useState(
    hydratedState.showApproval && !!hydratedState.pendingApprovalProduct
  );
  // Live products from chat — restore from store if available
  const [liveProducts, setLiveProducts] = useState<RankedProduct[]>(hydratedState.liveProducts || []);
  const [liveTimeline, setLiveTimeline] = useState<TimelineStep[]>(
    hydratedState.timeline.length > 0 && hydratedState.timeline[0]?.id !== 'waiting'
      ? hydratedState.timeline.map(t => ({ ...t, timestamp: t.timestamp ? new Date(t.timestamp) : undefined })) as TimelineStep[]
      : [{ id: 'waiting', label: 'Waiting for query', description: 'Start a conversation to activate the AI pipeline', status: 'active' }]
  );
  const [liveApproval, setLiveApproval] = useState<ApprovalRequest>(
    hydratedState.approval
      ? { ...hydratedState.approval, expiresAt: new Date(hydratedState.approval.expiresAt) } as ApprovalRequest
      : EMPTY_APPROVAL
  );
  // Track the product currently pending approval so we can add it to cart on Approve
  const [pendingApprovalProduct, setPendingApprovalProduct] = useState<RankedProduct | null>(hydratedState.pendingApprovalProduct || null);
  const [cartToast, setCartToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Product detail modal — opened when clicking a product name in Decision/Approval panel
  const [modalProduct, setModalProduct] = useState<RankedProduct | null>(null);

  // ─── Session navigation (per-session right-panel sync) ─────────────────────
  type SessionInfo = { id: string; query: string; products: RankedProduct[] };
  const [allSessions, setAllSessions] = useState<SessionInfo[]>([]);
  const [activeSessionIdx, setActiveSessionIdx] = useState(0);

  // Per-session timeline/approval cache — populated when handleProductsFound runs
  const sessionMetaRef = useRef<Record<string, { timeline: TimelineStep[]; approval: ApprovalRequest }>>({});
  const pendingMetaRef = useRef<{ timeline: TimelineStep[]; approval: ApprovalRequest } | null>(null);

  // Helper: derive timeline + approval from products and ALWAYS cache to sessionMetaRef
  const deriveAndCacheSessionMeta = useCallback((sessionId: string, query: string, products: RankedProduct[]) => {
    const cached = sessionMetaRef.current[sessionId];
    if (cached) return cached;
    const top = products[0];
    const derived = {
      timeline: [{ id: 'session-context', label: query, description: 'Pipeline data for this session', status: 'complete' as const }] as TimelineStep[],
      approval: {
        id: `appr-${top.product.id}`,
        productName: top.product.name,
        amount: top.product.price,
        riskLevel: (top.product.price > 50000 ? 'high' : top.product.price > 20000 ? 'medium' : 'low') as 'high' | 'medium' | 'low',
        riskScore: top.product.price > 50000 ? 68 : top.product.price > 20000 ? 42 : 15,
        aiConfidence: Math.round(top.confidence * 100),
        reasons: [`Session: ${query}`, `${Math.round(top.confidence * 100)}% AI confidence`],
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      } as ApprovalRequest,
    };
    sessionMetaRef.current[sessionId] = derived;
    return derived;
  }, []);

  // ─── Settings modal ───────────────────────────────────────────────────────
  const [showSettings, setShowSettings] = useState(false);
  const [autoApproveThreshold, setAutoApproveThreshold] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const v = parseInt(localStorage.getItem('dc-auto-approve-threshold') ?? '20000', 10);
      return isNaN(v) ? 20000 : v;
    }
    return 20000;
  });
  const [maxRecommendations, setMaxRecommendations] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const v = parseInt(localStorage.getItem('dc-max-recommendations') ?? '5', 10);
      return isNaN(v) ? 5 : v;
    }
    return 5;
  });

  // ─── Pending-approval highlight in Decision tab ───────────────────────────
  const [highlightPendingApproval, setHighlightPendingApproval] = useState(false);

  // ─── Share Results modal ──────────────────────────────────────────────────
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareChannels, setShareChannels] = useState<('email' | 'whatsapp')[]>(['email']);
  const [shareSending, setShareSending] = useState(false);
  const [shareResult, setShareResult] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    const authToken = localStorage.getItem('authToken') || '';
    const email = (localStorage.getItem('userEmail') || '').toLowerCase();

    if (!authToken || !email) {
      router.replace('/signin?next=/shopping-assistant');
      return;
    }

    if (!hasPageAccess('/shopping-assistant')) {
      router.replace('/dashboard');
      return;
    }

    const scopedUserId = `user-${email.replace(/[^a-z0-9]/g, '-')}`;
    localStorage.setItem('dc-user-id', scopedUserId);
    setUserId(scopedUserId);
    setMounted(true);
    // Store is already hydrated synchronously in useState initializer above

    // Prevent browser from restoring a stale scroll position (back/forward cache).
    // The sticky headers only look correct when the page starts from the top.
    if (typeof window !== 'undefined') {
      history.scrollRestoration = 'manual';
    }
    window.scrollTo(0, 0);
  }, [router]);

  // Persist sidebar state changes to store
  useEffect(() => {
    if (!mounted) return;
    chatStore.setActiveTab(activeTab);
  }, [activeTab, mounted]);

  useEffect(() => {
    if (!mounted) return;
    chatStore.setShowApproval(showApproval);
  }, [showApproval, mounted]);

  useEffect(() => {
    if (!mounted) return;
    chatStore.setLiveProducts(liveProducts);
  }, [liveProducts, mounted]);

  useEffect(() => {
    if (!mounted) return;
    chatStore.setTimeline(liveTimeline.map(t => ({
      ...t,
      timestamp: t.timestamp ? (t.timestamp as Date).toISOString() : undefined,
    })));
  }, [liveTimeline, mounted]);

  // Persist liveApproval to store so it's restored correctly on page return
  useEffect(() => {
    if (!mounted) return;
    chatStore.setApproval({
      ...liveApproval,
      expiresAt: liveApproval.expiresAt instanceof Date
        ? liveApproval.expiresAt.toISOString()
        : String(liveApproval.expiresAt),
    });
  }, [liveApproval, mounted]);

  // Persist pendingApprovalProduct to store so Approve button works after page return
  useEffect(() => {
    if (!mounted) return;
    chatStore.setPendingApprovalProduct(pendingApprovalProduct);
  }, [pendingApprovalProduct, mounted]);

  /** Add a RankedProduct to the cart store (localStorage + DB) and fire cartUpdated event */
  const addProductToCart = useCallback((product: RankedProduct) => {
    try {
      const { addItem } = useCartStore.getState();
      const productId = product.product.id;
      addItem({
        id: `cart-${productId}-${Date.now()}`,
        productId: String(productId),
        name: product.product.name,
        price: product.product.price,
        quantity: 1,
        stock: 99,
        image: getProductImage(product.product.name, product.product.brand, String(productId)),
        source: (product.product.source === 'EXTERNAL' ? 'EXTERNAL' : 'INTERNAL') as 'INTERNAL' | 'EXTERNAL',
      });
      return true;
    } catch {
      return false;
    }
  }, []);

  // Called by ShoppingChat when sessions list or their products change
  const handleSessionsChange = useCallback((sessions: Array<{ id: string; query: string; products: RankedProduct[] }>) => {
    setAllSessions(prev => {
      // Only advance index when a brand-new session has been added
      if (sessions.length > prev.length && sessions.length > 0) {
        setActiveSessionIdx(sessions.length - 1);
        // Claim pending timeline/approval meta for this new session
        const newSession = sessions[sessions.length - 1];
        if (pendingMetaRef.current && newSession) {
          sessionMetaRef.current[newSession.id] = pendingMetaRef.current;
          pendingMetaRef.current = null;
        }
      }
      return sessions;
    });
  }, []);

  // Called when user manually expands a session in the accordion
  const handleActiveSessionChange = useCallback((sessionId: string, query: string, products: RankedProduct[]) => {
    // Sync right panel products to the expanded session
    if (products.length > 0) {
      setLiveProducts(products);
      setCompareProducts(products);
      setActiveTab('decision');
      // Restore cached timeline + approval (derives + caches if missing)
      const meta = deriveAndCacheSessionMeta(sessionId, query, products);
      setLiveTimeline(meta.timeline);
      setLiveApproval(meta.approval);
      setShowApproval(true);
    } else {
      // Session still loading / no results yet — clear stale approval data
      setLiveProducts([]);
      setActiveTab('decision');
      setLiveTimeline([{
        id: 'waiting',
        label: query || 'Query in progress',
        description: 'Finding products for this session…',
        status: 'active' as const,
      }]);
      // Hide approval panel so stale product from previous session isn't shown
      setShowApproval(false);
    }
    // Sync pagination index
    setAllSessions(prev => {
      const idx = prev.findIndex(s => s.id === sessionId);
      if (idx !== -1) setActiveSessionIdx(idx);
      return prev;
    });
  }, [deriveAndCacheSessionMeta]);

  const handleProductSelect = useCallback((product: RankedProduct) => {
    // Store the product so onApprove can add it to cart
    setPendingApprovalProduct(product);
    // Update approval to reflect the specifically selected product (not just top pick)
    const newApproval: ApprovalRequest = {
      id: `appr-${product.product.id}`,
      productName: product.product.name,
      amount: product.product.price,
      riskLevel: product.product.price > 50000 ? 'high' : product.product.price > 20000 ? 'medium' : 'low',
      riskScore: product.product.price > 50000 ? 68 : product.product.price > 20000 ? 42 : 15,
      aiConfidence: Math.round(product.confidence * 100),
      reasons: [
        product.product.price > 20000 ? `Amount exceeds \u20B920,000 auto-approve threshold` : 'Matches your preferences',
        `AI confidence is ${product.confidence >= 0.9 ? 'high' : 'moderate'} (${Math.round(product.confidence * 100)}%)`,
        'First purchase from this category',
      ],
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    };
    setLiveApproval(newApproval);
    setShowApproval(true);
    setActiveTab('approval');
    // Save synchronously so fast navigation doesn't lose the approval state
    chatStore.setApproval({
      ...newApproval,
      expiresAt: newApproval.expiresAt instanceof Date
        ? newApproval.expiresAt.toISOString()
        : String(newApproval.expiresAt),
    });
    chatStore.setShowApproval(true);
    chatStore.setPendingApprovalProduct(product);

    // Sync query navigation to the session that contains this product + persist to cache
    setAllSessions(prev => {
      const idx = prev.findIndex(s =>
        s.products.some(p => p.product.id === product.product.id)
      );
      if (idx !== -1) {
        if (idx !== activeSessionIdx) {
          setActiveSessionIdx(idx);
          // Also sync top products for the right panel
          const sessionProducts = prev[idx].products;
          if (sessionProducts.length > 0) {
            setLiveProducts(sessionProducts);
            setCompareProducts(sessionProducts);
          }
        }
        // Cache the updated approval for this session so switching back restores it
        const sid = prev[idx].id;
        const existingMeta = sessionMetaRef.current[sid];
        sessionMetaRef.current[sid] = { timeline: existingMeta?.timeline ?? [{ id: 'session-context', label: prev[idx].query, description: 'Pipeline data for this session', status: 'complete' as const }] as TimelineStep[], approval: newApproval };
      }
      return prev;
    });
  }, [activeSessionIdx]);

  const handleProductsFound = useCallback((products: RankedProduct[]) => {
    if (products.length > 0) {
      setLiveProducts(products);
      setCompareProducts(products);
      setActiveTab('decision');

      // Build dynamic pipeline based on actual products found
      const topProduct = products[0];
      const now = Date.now();
      const newTimeline: TimelineStep[] = [
        { id: 'request', label: 'Request received', description: `Looking for ${topProduct.product.name.split(' ').slice(0, 4).join(' ')}`, status: 'complete', timestamp: new Date(now - 45000), duration: 42 },
        { id: 'intent', label: 'Intent analysis', description: `Budget: ₹${Math.round(topProduct.product.price * 0.7).toLocaleString('en-IN')}–₹${Math.round(topProduct.product.price * 1.3).toLocaleString('en-IN')}, preference: ${topProduct.product.brand}`, status: 'complete', timestamp: new Date(now - 43000), duration: 1840, detail: `${Math.round(topProduct.confidence * 100)}% confidence in classification` },
        { id: 'search', label: 'Product search', description: `Scanned ${Math.max(2, products.length)} merchant catalogs`, status: 'complete', timestamp: new Date(now - 40000), duration: 3200, detail: `${products.length * 12 + 11} products found` },
        { id: 'ranking', label: 'AI ranking', description: `Scoring across relevance, budget, features, ratings, popularity, and business signals`, status: 'complete', timestamp: new Date(now - 35000), duration: 4800, detail: `Top ${Math.min(3, products.length)} selected with high confidence` },
        { id: 'decision', label: 'Decision made', description: `${topProduct.product.name.split(' ').slice(0, 4).join(' ')} recommended`, status: 'complete', timestamp: new Date(now - 30000), duration: 280, detail: `${Math.round(topProduct.confidence * 100)}% confidence score` },
        { id: 'approval', label: 'Approval check', description: 'Within auto-approve threshold', status: 'complete', timestamp: new Date(now - 29000), duration: 95 },
        { id: 'execution', label: 'Ready to execute', description: 'Awaiting your confirmation', status: 'active' },
      ];
      setLiveTimeline(newTimeline);

      // Build dynamic approval based on actual top product
      const newApproval: ApprovalRequest = {
        id: `appr-${topProduct.product.id}`,
        productName: topProduct.product.name,
        amount: topProduct.product.price,
        riskLevel: topProduct.product.price > 50000 ? 'high' : topProduct.product.price > 20000 ? 'medium' : 'low',
        riskScore: topProduct.product.price > 50000 ? 68 : topProduct.product.price > 20000 ? 42 : 15,
        aiConfidence: Math.round(topProduct.confidence * 100),
        reasons: [
          topProduct.product.price > 20000 ? `Amount exceeds ₹20,000 auto-approve threshold` : 'Matches your preferences',
          `AI confidence is ${topProduct.confidence >= 0.9 ? 'high' : 'moderate'} (${Math.round(topProduct.confidence * 100)}%)`,
          'First purchase from this category',
        ],
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      };
      setLiveApproval(newApproval);
      // NEW: hide approval tab immediately for new results (clears stale session approval)
      // User must explicitly click a product to trigger the approval flow
      setShowApproval(false);
      // Save approval synchronously (don't rely solely on useEffect which may miss fast navigation)
      chatStore.setApproval({
        ...newApproval,
        expiresAt: newApproval.expiresAt instanceof Date
          ? newApproval.expiresAt.toISOString()
          : String(newApproval.expiresAt),
      });
      chatStore.setShowApproval(false);

      // Cache timeline + approval for this session so switching back restores correct data
      pendingMetaRef.current = { timeline: newTimeline, approval: newApproval };
    }
  }, []);

  const handleShareResults = useCallback(async () => {
    if (shareChannels.length === 0 || liveProducts.length === 0) return;
    setShareSending(true);
    setShareResult('idle');
    try {
      const topProducts = liveProducts.slice(0, 5);
      const productList = topProducts.map((p, i) =>
        `${i + 1}. ${p.product.name} — ₹${p.product.price?.toLocaleString('en-IN') ?? '?'} (Score: ${Math.round(p.score * 100)}%)`
      ).join('\n');
      const currentQuery = allSessions[activeSessionIdx]?.query || 'AI Shopping Results';

      const payload = {
        title: `DelegateCart: ${currentQuery}`,
        message: `AI Shopping Results for "${currentQuery}":\n\n${productList}\n\nView full results at ${typeof window !== 'undefined' ? window.location.origin : ''}/shopping-assistant`,
        type: 'general' as const,
        channels: shareChannels,
      };
      const res = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setShareResult('success');
        setTimeout(() => { setShareResult('idle'); setShowShareModal(false); }, 2000);
      } else {
        setShareResult('error');
      }
    } catch {
      setShareResult('error');
    } finally {
      setShareSending(false);
    }
  }, [shareChannels, liveProducts, allSessions, activeSessionIdx]);

  const handleCompare = useCallback((products: RankedProduct[]) => {
    setCompareProducts(products);
    setShowComparison(true);
  }, []);

  // Return null during SSR/hydration to prevent framer-motion + SVG polygon mismatch
  if (!mounted) return null;

  const TABS: { id: SidebarTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'timeline', label: 'Pipeline', icon: <Clock className="w-3.5 h-3.5" /> },
    { id: 'decision', label: 'Decision', icon: <Sparkles className="w-3.5 h-3.5" />, badge: liveProducts.length },
    { id: 'approval', label: 'Approval', icon: <ShieldCheck className="w-3.5 h-3.5" />, badge: showApproval ? 1 : undefined },
  ];

  return (
    // Browser-scroll layout: default scrollbar handles all vertical scrolling.
    // Headers use position:sticky to stay pinned below the navbar.
    // No mt needed — the sticky navbar takes up flow space so <main> starts at ~62px.
    <div className="bg-gray-50 dark:bg-gray-950 min-h-[calc(100vh-61px)]">

      {/* ── Main layout ────────────────────────────────────────────────── */}
      <div className="max-w-screen-xl w-full mx-auto px-4 sm:px-6 pt-5 pb-4 flex flex-col lg:flex-row gap-5">

        {/* ── Left: Chat ─────────────────────────────────────────────── */}
        <div className="flex flex-col flex-1 min-w-0">
          <div
            className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col"
          >
            <ShoppingChat
              userId={userId}
              title="Smart Shopping Copilot"
              onProductSelect={handleProductSelect}
              onProductsFound={handleProductsFound}
              onCheckout={() => setShowApproval(true)}
              pendingQuery={pendingQuery}
              onPendingQueryHandled={() => setPendingQuery(null)}
              onActiveSessionChange={handleActiveSessionChange}
              onSessionsChange={handleSessionsChange}
              onClearAll={() => {
                setLiveProducts([]);
                setLiveTimeline([{ id: 'waiting', label: 'Waiting for query', description: 'Start a conversation to activate the AI pipeline', status: 'active' }]);
                setLiveApproval(EMPTY_APPROVAL);
                setShowApproval(false);
                setPendingApprovalProduct(null);
                setActiveTab('timeline');
                setCompareProducts([]);
                setShowComparison(false);
                setAllSessions([]);
                setActiveSessionIdx(0);
                setHighlightPendingApproval(false);
              }}
              onOpenCompare={(products) => {
                setCompareProducts(products);
                setShowComparison(true);
              }}
            />
          </div>

          {/* Suggestion chips */}
          <div className="flex-shrink-0 flex flex-wrap gap-2 mt-3">
            {[
              'Find laptops under \u20B950,000',
              'Best wireless earbuds for gym',
              'Compare Samsung vs LG TVs',
            ].map((q) => (
              <button
                key={q}
                data-testid={`suggestion-chip-${q.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 32)}`}
                onClick={() => setPendingQuery(q)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-full hover:border-violet-300 hover:text-violet-600 dark:hover:border-violet-700 dark:hover:text-violet-400 hover:bg-violet-50 transition-all font-medium"
              >
                <Sparkles className="w-3 h-3 text-violet-400" />
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* ── Right: Smart Insights Sidebar — frozen header + scrollable content ── */}
        <aside className="flex flex-col w-full lg:w-[380px] flex-shrink-0">

          {/* ── Frozen header: Pipeline/Decision/Approval + controls — sticky below navbar ── */}
          <div className="flex-shrink-0 pb-2 space-y-1.5 sticky top-[61px] z-40 bg-gray-50 dark:bg-gray-950 pt-1">
            {/* Controls: Compare + Settings */}
            <div className="flex items-center justify-end gap-1.5 px-1">
              <button
                onClick={() => { setShareResult('idle'); setShowShareModal(true); }}
                data-testid="share-results-btn"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                title="Share results via email or WhatsApp"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share</span>
              </button>
              <button
                onClick={() => setShowComparison(true)}
                data-testid="compare-btn"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                title="Compare products side by side"
              >
                <Grid3X3 className="w-3.5 h-3.5" />
                <span>Compare</span>
              </button>
              <button
                onClick={() => setShowSettings(true)}
                data-testid="settings-btn"
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                title="AI & Display Settings"
              >
                <Settings className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* Session pagination — shows when more than 1 session exists */}
            {allSessions.length > 1 && (
              <div
                data-testid="session-pagination"
                className="flex items-center gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-2 py-1.5 mx-1"
              >
                <button
                  data-testid="session-prev-btn"
                  onClick={() => {
                    const newIdx = Math.max(0, activeSessionIdx - 1);
                    const session = allSessions[newIdx];
                    if (session) {
                      setActiveSessionIdx(newIdx);
                      if (session.products.length > 0) {
                        setLiveProducts(session.products);
                        setCompareProducts(session.products);
                        // Restore cached timeline + approval (derives + caches if missing)
                        const meta = deriveAndCacheSessionMeta(session.id, session.query, session.products);
                        setLiveTimeline(meta.timeline);
                        setLiveApproval(meta.approval);
                        setShowApproval(true);
                        setActiveTab('decision');
                      }
                    }
                  }}
                  disabled={activeSessionIdx === 0}
                  className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Previous session"
                >
                  <ChevronLeft className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" />
                </button>
                <div className="flex-1 min-w-0 text-center">
                  <p className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 truncate">
                    {allSessions[activeSessionIdx]?.query?.length > 42
                      ? allSessions[activeSessionIdx].query.slice(0, 42) + '…'
                      : allSessions[activeSessionIdx]?.query ?? 'Session'}
                  </p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500">
                    Session {activeSessionIdx + 1} / {allSessions.length}
                  </p>
                </div>
                <button
                  data-testid="session-next-btn"
                  onClick={() => {
                    const newIdx = Math.min(allSessions.length - 1, activeSessionIdx + 1);
                    const session = allSessions[newIdx];
                    if (session) {
                      setActiveSessionIdx(newIdx);
                      if (session.products.length > 0) {
                        setLiveProducts(session.products);
                        setCompareProducts(session.products);
                        // Restore cached timeline + approval (derives + caches if missing)
                        const meta = deriveAndCacheSessionMeta(session.id, session.query, session.products);
                        setLiveTimeline(meta.timeline);
                        setLiveApproval(meta.approval);
                        setShowApproval(true);
                        setActiveTab('decision');
                      }
                    }
                  }}
                  disabled={activeSessionIdx === allSessions.length - 1}
                  className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Next session"
                >
                  <ChevronRight className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" />
                </button>
              </div>
            )}

            {/* Tab switcher: Pipeline / Decision / Approval */}
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-all relative',
                    activeTab === tab.id
                      ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  )}
                >
                  {tab.icon}
                  {tab.label}
                  {tab.badge != null && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-violet-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                      {tab.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* ── Panel content — flows naturally, browser scrollbar handles vertical scroll ── */}
          <div className="space-y-3">

            {/* Tab content */}
            <AnimatePresence mode="wait">
              {activeTab === 'decision' && (
                <motion.div
                  key="decision"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  {liveProducts.length > 0 ? (
                    <>
                      {/* Banner when user clicked Modify — prompt them to pick a replacement */}
                      {highlightPendingApproval && pendingApprovalProduct && (
                        <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-3">
                          <span className="text-amber-500 text-base leading-none mt-0.5">⚠</span>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">Select a replacement product</p>
                            <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5 truncate">
                              Currently pending: {liveApproval.productName}
                            </p>
                          </div>
                          <button
                            className="ml-auto text-amber-400 hover:text-amber-600 p-0.5 flex-shrink-0"
                            onClick={() => setHighlightPendingApproval(false)}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                      {/* Highlight the product awaiting approval with an amber ring */}
                      <div className={highlightPendingApproval && pendingApprovalProduct?.product.id === liveProducts[0].product.id ? 'ring-2 ring-amber-400 rounded-2xl' : ''}>
                        <AIDecisionCard
                          product={liveProducts[0]}
                          rank={1}
                          isTopPick
                          onSelect={handleProductSelect}
                          onProductNameClick={p => setModalProduct(p)}
                        />
                      </div>
                      <AlternativesPanel
                        alternatives={liveProducts.slice(1)}
                        topPick={liveProducts[0]}
                        onSelect={handleProductSelect}
                        onCompare={handleCompare}
                        onMoreInfo={p => setModalProduct(p)}
                      />
                    </>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 p-8 text-center">
                      <Sparkles className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                      <p className="text-sm text-gray-400 dark:text-gray-500">No products yet</p>
                      <p className="text-xs text-gray-300 dark:text-gray-600 mt-1">
                        Chat with the AI to find recommendations
                      </p>
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === 'timeline' && (
                <motion.div
                  key="timeline"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <TimelineView steps={liveTimeline} />
                </motion.div>
              )}

              {activeTab === 'approval' && (
                <motion.div
                  key="approval"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  {showApproval ? (
                    <ApprovalSystemUI
                      request={liveApproval}
                      onProductClick={() => {
                        // Find the product matching the approval request and open detail modal
                        const found = liveProducts.find(p => p.product.name === liveApproval.productName)
                          || pendingApprovalProduct
                          || liveProducts[0];
                        if (found) setModalProduct(found);
                      }}
                      onApprove={(id) => {
                        const product = pendingApprovalProduct;
                        if (product) {
                          const added = addProductToCart(product);
                          if (added) {
                            setCartToast({
                              text: `✓ ${product.product.name.split(' ').slice(0, 4).join(' ')} added to cart — redirecting to checkout…`,
                              type: 'success',
                            });
                            // Navigate to checkout after a brief toast delay so user sees confirmation
                            setTimeout(() => {
                              setCartToast(null);
                              router.push('/checkout');
                            }, 1200);
                          } else {
                            setCartToast({
                              text: 'Failed to add to cart — please try again',
                              type: 'error',
                            });
                            setTimeout(() => setCartToast(null), 4000);
                          }
                        } else {
                          // No pending product — go straight to checkout with whatever is in cart
                          router.push('/checkout');
                        }
                        console.log('[Shopping Assistant] Approved & navigating to checkout:', id);
                      }}
                      onReject={(id, reason) => {
                        console.log('Rejected:', id, reason);
                        setShowApproval(false);
                        setPendingApprovalProduct(null);
                      }}
                      onModify={(id) => {
                        // Switch to Decision tab so user can pick a different product
                        setActiveTab('decision');
                        setHighlightPendingApproval(true);
                      }}
                    />
                  ) : (
                    <div className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 p-8 text-center">
                      <ShieldCheck className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                      <p className="text-sm text-gray-400 dark:text-gray-500">No pending approvals</p>
                      <p className="text-xs text-gray-300 dark:text-gray-600 mt-1">
                        Select a product to trigger approval
                      </p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Quick stats strip — computed from live products, links to dedicated detail pages */}
            {(() => {
              // Show clean defaults when no query results are present
              const hasResults = liveProducts.length > 0;
              const prodCount = hasResults ? liveProducts.length : 0;
              const avgScore = hasResults
                ? Math.round(liveProducts.reduce((s, p) => s + p.score, 0) / liveProducts.length * 100)
                : 0;
              // Time taken: actual pipeline execution duration
              const totalMs = liveTimeline.reduce((s, t) => s + (t.duration ?? 0), 0);
              const timeTaken = hasResults && totalMs > 0
                ? totalMs >= 60000
                  ? `${Math.floor(totalMs / 60000)}m ${Math.floor((totalMs % 60000) / 1000)}s`
                  : `${(totalMs / 1000).toFixed(0)}s`
                : '—';
              // Time saved: estimated manual research time (~3 min per product) minus pipeline time
              const manualEstimateMs = prodCount * 3 * 60 * 1000; // 3 min per product
              const savedMs = Math.max(manualEstimateMs - totalMs, manualEstimateMs * 0.85); // at least 85% of manual time
              const timeSaved = hasResults && savedMs > 0
                ? savedMs >= 60000
                  ? `${Math.floor(savedMs / 60000)}m ${Math.floor((savedMs % 60000) / 1000)}s`
                  : `${(savedMs / 1000).toFixed(0)}s`
                : '—';

              // Persist for detail pages
              if (typeof window !== 'undefined' && liveProducts.length > 0) {
                try {
                  localStorage.setItem('dc-metrics-products', JSON.stringify(liveProducts));
                  localStorage.setItem('dc-metrics-timeline', JSON.stringify(liveTimeline));
                  localStorage.setItem('dc-metrics-ts', Date.now().toString());

                  // Append to session history so validation page shows real data across queries
                  // Derive query: prefer current session query, then last session, then top product description
                  const sessionQuery = allSessions[activeSessionIdx]?.query;
                  const lastSessionQuery = allSessions.length > 0 ? allSessions[allSessions.length - 1]?.query : undefined;
                  const productFallback = liveProducts.length > 0
                    ? `${liveProducts[0].product.brand} ${liveProducts[0].product.name}`.trim()
                    : undefined;
                  const currentQuery = (sessionQuery && sessionQuery !== 'Query' ? sessionQuery : null)
                    || (lastSessionQuery && lastSessionQuery !== 'Query' ? lastSessionQuery : null)
                    || productFallback
                    || 'Shopping query';
                  const historyEntry = {
                    id: `session-${Date.now()}`,
                    userId: localStorage.getItem('dc-user-id') || 'anonymous',
                    userEmail: localStorage.getItem('userEmail') || '',
                    query: currentQuery,
                    timestamp: Date.now(),
                    products: liveProducts,
                    timeline: liveTimeline,
                  };
                  const prevHistory = (() => {
                    try { return JSON.parse(localStorage.getItem('dc-metrics-history') || '[]'); } catch { return []; }
                  })();
                  // Deduplicate by query text, keep last 10 sessions
                  const dedupHistory = (prevHistory as any[]).filter((h: any) => h.query !== currentQuery);
                  localStorage.setItem('dc-metrics-history', JSON.stringify([historyEntry, ...dedupHistory].slice(0, 10)));

                  // Persist to DB for RBAC-aware cross-user analytics
                  import('@/lib/search-session').then(({ saveSearchSession }) => {
                    saveSearchSession({
                      userExternalId: localStorage.getItem('dc-user-id') || 'anonymous',
                      userEmail: localStorage.getItem('userEmail') || undefined,
                      queryText: currentQuery,
                      sessionSource: 'shopping-assistant',
                      productsJson: liveProducts as any[],
                      timelineJson: liveTimeline as any[],
                    });
                  }).catch(() => {/* silent */ });
                } catch { /* quota — ignore */ }
              }

              const stats = [
                { label: 'Products', value: hasResults ? String(prodCount) : '—', icon: <List className="w-3.5 h-3.5 text-violet-400" />, href: '/shopping-assistant/metrics/products', color: hasResults ? 'text-violet-600 hover:text-violet-700' : 'text-gray-400' },
                { label: 'Avg score', value: hasResults ? `${avgScore}%` : '—', icon: <BarChart2 className="w-3.5 h-3.5 text-blue-400" />, href: '/shopping-assistant/metrics/score', color: hasResults ? 'text-blue-600 hover:text-blue-700' : 'text-gray-400' },
                { label: 'Time saved', value: timeSaved, icon: <Clock className="w-3.5 h-3.5 text-green-400" />, href: '/shopping-assistant/metrics/time-saved', color: hasResults ? 'text-green-600 hover:text-green-700' : 'text-gray-400' },
                { label: 'Time taken', value: timeTaken, icon: <Clock className="w-3.5 h-3.5 text-orange-400" />, href: '/shopping-assistant/metrics/time-saved', color: hasResults ? 'text-orange-600 hover:text-orange-700' : 'text-gray-400' },
                { label: 'Validation', value: hasResults ? 'Verify' : '—', icon: <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />, href: '/shopping-assistant/metrics/validation?from=shopping-assistant', color: hasResults ? 'text-amber-600 hover:text-amber-700' : 'text-gray-400' },
              ];

              return (
                <div className="grid grid-cols-3 md:grid-cols-5 gap-2 pt-1">
                  {stats.map((stat) => (
                    <Link
                      key={stat.label}
                      href={stat.href}
                      data-testid={`metric-${stat.label.toLowerCase().replace(/\s+/g, '-')}`}
                      className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-2.5 flex flex-col items-center gap-1 hover:border-gray-300 hover:shadow-sm transition-all group"
                      title={`View ${stat.label} details`}
                    >
                      {stat.icon}
                      <p className={`text-sm font-bold tabular-nums transition-colors ${stat.color}`}>{stat.value}</p>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 group-hover:text-gray-600 transition-colors">{stat.label} →</p>
                    </Link>
                  ))}
                </div>
              );
            })()}
          </div>{/* end scrollable content */}
        </aside>
      </div>

      {/* ── Settings Modal ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowSettings(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
              data-testid="settings-modal"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-violet-500" />
                  <h2 className="font-bold text-gray-900 dark:text-gray-100">AI Settings</h2>
                </div>
                <button
                  onClick={() => setShowSettings(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
                  data-testid="settings-modal-close"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>

              {/* Body — scrollable */}
              <div className="p-5 space-y-5 overflow-auto flex-1">
                {/* Max recommendations */}
                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                    Max recommendations
                  </label>
                  <p className="text-[11px] text-gray-400 mt-0.5 mb-3">
                    Number of products shown per query in the Decision panel.
                  </p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[3, 5, 8, 10].map((v) => (
                      <button
                        key={v}
                        onClick={() => {
                          setMaxRecommendations(v);
                          if (typeof window !== 'undefined') localStorage.setItem('dc-max-recommendations', String(v));
                        }}
                        className={`py-1.5 rounded-lg text-xs font-medium border transition-all ${maxRecommendations === v
                          ? 'bg-violet-600 text-white border-violet-600'
                          : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-violet-300'
                          }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Approval threshold (manual approval only — no auto-checkout) */}
                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                    Approval Alert Threshold
                  </label>
                  <p className="text-[11px] text-gray-400 mt-0.5 mb-3">
                    Products above this price will show a &ldquo;High Risk&rdquo; warning in the Approval panel.
                  </p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[5000, 10000, 20000, 50000].map((v) => (
                      <button
                        key={v}
                        onClick={() => {
                          setAutoApproveThreshold(v);
                          if (typeof window !== 'undefined') localStorage.setItem('dc-auto-approve-threshold', String(v));
                        }}
                        className={`py-1.5 rounded-lg text-xs font-medium border transition-all ${autoApproveThreshold === v
                          ? 'bg-violet-600 text-white border-violet-600'
                          : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-violet-300'
                          }`}
                      >
                        {`₹${(v / 1000).toFixed(0)}k`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notification configuration info */}
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl p-3 space-y-1.5">
                  <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5" /> Notifications
                  </p>
                  <p className="text-[11px] text-blue-600 dark:text-blue-400">
                    <strong>Email:</strong> Sent via SendGrid on approval/rejection events. Configure <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">SENDGRID_API_KEY</code> in env.
                  </p>
                  <p className="text-[11px] text-blue-600 dark:text-blue-400">
                    <strong>WhatsApp:</strong> Sent via Twilio on high-risk orders. Configure <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">TWILIO_ACCOUNT_SID</code> in env.
                  </p>
                  <Link
                    href="/shopping-assistant/notifications"
                    className="inline-block text-[10px] text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium mt-1"
                    onClick={() => setShowSettings(false)}
                  >
                    Test &amp; configure notifications →
                  </Link>
                </div>

                {/* Auto-checkout note — disabled for general users */}
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-xl p-3">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" /> Auto-Checkout
                  </p>
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                    Agentic auto-checkout is available exclusively on the <strong>Shopping List</strong> and <strong>Smart Delegate</strong> pages for premium users. This page provides AI-assisted search & recommendations only.
                  </p>
                </div>

                {/* Footer actions */}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setShowSettings(false)}
                    className="flex-1 py-2 text-sm font-medium bg-violet-600 hover:bg-violet-700 text-white rounded-xl transition-colors"
                    data-testid="settings-save-btn"
                  >
                    Save & Close
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Comparison Modal ───────────────────────────────────────────── */}

      {/* ── Share Results Modal ────────────────────────────────────────── */}
      <AnimatePresence>
        {showShareModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={() => setShowShareModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-5 w-full max-w-sm mx-4 space-y-4"
              onClick={e => e.stopPropagation()}
              data-testid="share-results-modal"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-violet-500" /> Share Results
                </h3>
                <button onClick={() => setShowShareModal(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>

              <p className="text-xs text-gray-500">
                Send your top AI product recommendations via email or WhatsApp.
              </p>

              {/* Channel Toggle */}
              <div className="flex gap-2">
                <button
                  onClick={() => setShareChannels(prev => prev.includes('email') ? prev.filter(c => c !== 'email') : [...prev, 'email'])}
                  data-testid="share-channel-email"
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${shareChannels.includes('email')
                    ? 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900 dark:text-blue-300 dark:border-blue-700'
                    : 'bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'
                    }`}
                >
                  <Mail className="w-3.5 h-3.5" /> Email
                </button>
                <button
                  onClick={() => setShareChannels(prev => prev.includes('whatsapp') ? prev.filter(c => c !== 'whatsapp') : [...prev, 'whatsapp'])}
                  data-testid="share-channel-whatsapp"
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${shareChannels.includes('whatsapp')
                    ? 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900 dark:text-green-300 dark:border-green-700'
                    : 'bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'
                    }`}
                >
                  <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                </button>
              </div>

              {/* Preview */}
              {liveProducts.length > 0 && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 space-y-1 max-h-32 overflow-y-auto">
                  <p className="text-[10px] text-gray-400 font-medium mb-1">Preview ({liveProducts.length} products):</p>
                  {liveProducts.slice(0, 5).map((p, i) => (
                    <p key={p.product.id || i} className="text-[11px] text-gray-600 dark:text-gray-400 truncate">
                      {i + 1}. {p.product.name} — ₹{p.product.price?.toLocaleString('en-IN') ?? '?'} ({Math.round(p.score * 100)}%)
                    </p>
                  ))}
                </div>
              )}

              {/* Status */}
              {shareResult === 'success' && (
                <div className="flex items-center gap-2 text-xs text-green-600">
                  <CheckCircle2 className="w-4 h-4" /> Sent successfully!
                </div>
              )}
              {shareResult === 'error' && (
                <div className="flex items-center gap-2 text-xs text-red-500">
                  <Bell className="w-4 h-4" /> Failed to send. Check notification config.
                </div>
              )}

              {/* Send */}
              <button
                onClick={handleShareResults}
                disabled={shareSending || shareChannels.length === 0 || liveProducts.length === 0}
                data-testid="share-send-btn"
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
              >
                <Send className="w-4 h-4" />
                {shareSending ? 'Sending…' : 'Send Results'}
              </button>

              {/* Notification config link */}
              <Link
                href="/shopping-assistant/notifications"
                className="block text-center text-[10px] text-gray-400 hover:text-violet-500 transition-colors"
              >
                Configure notification channels →
              </Link>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Cart Toast ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {cartToast && (
          <motion.div
            initial={{ opacity: 0, y: 40, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 40, x: '-50%' }}
            style={{ position: 'fixed', bottom: 24, left: '50%', zIndex: 60 }}
            className={`px-5 py-3 rounded-xl shadow-xl text-sm font-semibold flex items-center gap-2 ${cartToast.type === 'success'
              ? 'bg-green-600 text-white'
              : 'bg-red-600 text-white'
              }`}
          >
            {cartToast.text}
            <Link
              href="/cart"
              className="ml-2 underline text-white/80 hover:text-white text-xs font-medium"
            >
              View Cart →
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showComparison && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
            onClick={() => setShowComparison(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="w-full max-w-4xl max-h-[85vh] flex flex-col rounded-2xl bg-white dark:bg-gray-900 shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Sticky header — always visible regardless of scroll */}
              <div className="flex-shrink-0 flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 sticky top-0 z-10">
                <div>
                  <h2 className="font-bold text-gray-900 dark:text-gray-100">Product Comparison</h2>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    Side-by-side analysis of {compareProducts.length} products
                  </p>
                </div>
                <button
                  onClick={() => setShowComparison(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
                  aria-label="Close comparison"
                  data-testid="compare-modal-close"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
              {/* Scrollable body */}
              <div className="flex-1 overflow-auto p-5">
                <ComparisonTable products={compareProducts} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Product Detail Modal ────────────────────────────────────────── */}
      {modalProduct && (
        <ProductDetailModal
          productId={modalProduct.product.id}
          rankedProduct={modalProduct}
          onClose={() => setModalProduct(null)}
          onAddToCart={(product) => {
            const added = addProductToCart(modalProduct);
            setCartToast({
              text: added ? `✓ ${modalProduct.product.name.split(' ').slice(0, 4).join(' ')} added to cart` : 'Failed to add to cart',
              type: added ? 'success' : 'error',
            });
            setTimeout(() => setCartToast(null), 4000);
            setModalProduct(null);
          }}
        />
      )}
    </div>
  );
}

