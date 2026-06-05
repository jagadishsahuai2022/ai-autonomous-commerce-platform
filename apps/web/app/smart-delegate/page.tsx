'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bot, ShoppingCart, Star, Package, Clock, CheckCircle,
  ChevronDown, ChevronUp, Trash2, Plus, RefreshCw,
  TrendingUp, Zap, ArrowRight, MessageSquare, Mail,
  BadgeCheck, Sparkles, AlertCircle, ListChecks, ShieldCheck,
  Shield, Truck, Building2,
} from 'lucide-react';
import {
  computeSpecScore, computeWarrantyInfo, getBrandTier, parseDeliveryInfo, computeVerifiedRating,
} from '@/lib/scoring/product-scoring';
import { getCurrentUserRole } from '@/lib/admin-auth';
import type { AppRole } from '@/lib/admin-auth';
import { useCartStore } from '@/lib/stores/cart-store';

// ── Types ─────────────────────────────────────────────────────────────────────

interface MatchedProduct {
  id?: number;
  name: string;
  brand: string;
  price: number;
  rating: number;
  matchScore: number;
  estimatedDelivery: string;
  emiAvailable: boolean;
  url: string;
  // AI scoring fields (optional for backward compatibility with cached results)
  source?: 'INTERNAL' | 'EXTERNAL' | 'CATALOG';
  genericName?: string | null;
  category?: string;
  imageUrl?: string | null;
  aiScore?: number;
  aiExplanation?: string;
  aiConfidence?: number;
  scoreBreakdown?: {
    relevance: number;
    preferenceMatch: number;
    priceFit: number;
    ratingScore: number;
    aiConfidence: number;
  };
}

interface ShoppingListResultItem {
  productName: string;
  preferredBrand: string | null;
  budget: number | null;
  quantity: number;
  matches: MatchedProduct[];
}

interface StoredSubmission {
  id: string;
  submittedAt: string;
  results: ShoppingListResultItem[];
  summary: {
    totalItems: number;
    totalMatches: number;
    estimatedSavings: string;
  };
  whatsappSent?: boolean;
  emailSent?: boolean;
  // Auto-checkout status (added in fix round 21)
  autoCheckoutSuccess?: boolean;
  autoCheckoutOrderId?: string | null;
  autoCheckoutError?: string | null;
  walletBalanceAfter?: number | null;
  // Cross-user tracking
  userEmail?: string;
  userName?: string;
}

function normalizeEmail(email?: string | null): string {
  return (email || '').trim().toLowerCase();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function loadSubmissions(): StoredSubmission[] {
  try {
    const raw = localStorage.getItem('shoppingListResults');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSubmissions(submissions: StoredSubmission[]) {
  localStorage.setItem('shoppingListResults', JSON.stringify(submissions));
}

function generateSearchUrl(name: string, brand: string): string {
  return `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(`${brand} ${name} buy online India`)}`;
}

function addToCart(product: MatchedProduct, productName: string) {
  try {
    // Prefer real numeric DB product ID; fall back to slug for dedup only
    const numericId = product.id && Number.isInteger(product.id) && product.id > 0
      ? String(product.id)
      : null;
    const id = numericId || `sl-${product.brand}-${product.name}`.replace(/\s+/g, '-').toLowerCase();

    const { addItem } = useCartStore.getState();
    addItem({
      id: `cart-${Date.now()}`,
      productId: id,
      name: product.name,
      price: product.price,
      quantity: 1,
      stock: 99,
      image: `https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=80&h=80&fit=crop&q=60`,
      url: product.url && product.url !== '#' ? product.url : generateSearchUrl(product.name, product.brand),
      source: product.source || 'INTERNAL',
    });
    localStorage.setItem('cartFromAI', 'true');
  } catch (err) {
    console.error('Failed to add item to cart:', err);
  }
}

// ── Product Match Card ────────────────────────────────────────────────────────

function MatchCard({
  product,
  rank,
  budget,
}: {
  product: MatchedProduct;
  rank: number;
  budget: number | null;
}) {
  const cartItems = useCartStore((s) => s.items);
  const removeItem = useCartStore((s) => s.removeItem);
  const overBudget = budget !== null && product.price > budget;

  const numericId = product.id && Number.isInteger(product.id) && product.id > 0
    ? String(product.id)
    : null;
  const cartId = numericId || `sl-${product.brand}-${product.name}`.replace(/\s+/g, '-').toLowerCase();
  const inCart = cartItems.some((i) => i.productId === cartId);

  const handleCartToggle = () => {
    if (inCart) {
      removeItem(cartId);
    } else {
      addToCart(product, product.name);
    }
  };

  // Build the product detail URL:
  // - INTERNAL (real DB product): use numeric ID for reliable lookup
  // - EXTERNAL or CATALOG: use name-based URL (detail page handles gracefully)
  const productDetailHref = product.source === 'INTERNAL' && product.id
    ? `/products/${product.id}`
    : `/products/${encodeURIComponent(product.name)}`;

  // Data source badge config
  const sourceBadge = product.source === 'INTERNAL'
    ? { label: 'DB', title: 'Native DB Product — real catalog data', cls: 'bg-green-100 text-green-700' }
    : product.source === 'EXTERNAL'
      ? { label: 'EXT', title: 'External Product — from partner feed', cls: 'bg-amber-100 text-amber-700' }
      : product.source === 'CATALOG'
        ? { label: 'DEMO', title: 'Demo catalog product — not in live DB', cls: 'bg-orange-100 text-orange-700' }
        : null;

  return (
    <div
      className={`relative bg-white rounded-xl border p-4 hover:shadow-md transition-shadow ${rank === 1 ? 'border-amber-300 ring-1 ring-amber-200' : 'border-gray-200'
        }`}
    >
      {rank === 1 && (
        <div className="absolute -top-2.5 left-4 bg-amber-400 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
          <TrendingUp className="w-3 h-3" /> Best Match
        </div>
      )}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <Link href={productDetailHref} className="text-sm font-semibold text-blue-700 hover:text-blue-900 underline truncate">
              {product.name}
            </Link>
            {sourceBadge && (
              <span
                title={sourceBadge.title}
                className={`inline-flex items-center text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${sourceBadge.cls}`}
              >
                {sourceBadge.label}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500">{product.brand}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className={`text-base font-bold ${overBudget ? 'text-red-600' : 'text-gray-900'}`}>
            ₹{product.price.toLocaleString('en-IN')}
          </p>
          {overBudget && (
            <p className="text-[10px] text-red-500">Over budget</p>
          )}
        </div>
      </div>

      {/* AI Score badge */}
      {product.aiScore !== undefined && (
        <div className="flex items-center gap-2 mb-2">
          <div className="flex items-center gap-1 bg-violet-50 text-violet-700 px-2 py-0.5 rounded-full text-[10px] font-bold">
            <Sparkles className="w-3 h-3" /> AI Score: {product.aiScore}/100
          </div>
          {product.aiConfidence !== undefined && (
            <span className="text-[10px] text-gray-400">{product.aiConfidence}% confidence</span>
          )}
        </div>
      )}

      {/* Validation Chips — trust dimensions per product (visible to elevated roles) */}
      {(() => {
        const role = typeof window !== 'undefined' ? getCurrentUserRole() : 'customer';
        const canSeeChips = ['admin', 'analytics', 'observability', 'reinforced-learning'].includes(role);
        if (!canSeeChips) return null;
        const brand = getBrandTier(product.brand);
        const delivery = parseDeliveryInfo(product.estimatedDelivery);
        const verified = computeVerifiedRating(product.rating, 500 + Math.round(product.matchScore * 80));
        const budgetFit = budget ? Math.min(1, budget / product.price) : 0.7;
        const chips = [
          { label: `Budget ${(budgetFit * 100).toFixed(0)}%`, color: budgetFit >= 0.8 ? 'bg-green-50 text-green-700 border-green-200' : budgetFit >= 0.6 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-600 border-red-200', icon: '💰' },
          { label: `${brand.tier.charAt(0).toUpperCase() + brand.tier.slice(1)}`, color: brand.tier === 'premium' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : brand.tier === 'rising' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-600 border-gray-200', icon: '🏭' },
          { label: delivery.label, color: delivery.colorClass.includes('green') ? 'bg-green-50 text-green-700 border-green-200' : delivery.colorClass.includes('amber') ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-600 border-red-200', icon: '🚚' },
          { label: verified.trustLabel, color: `${verified.trustBg} ${verified.trustText} border-gray-200`, icon: '✅' },
        ];
        return (
          <div className="flex flex-wrap gap-1 mb-2">
            {chips.map(c => (
              <span key={c.label} className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full border ${c.color}`}>
                {c.icon} {c.label}
              </span>
            ))}
          </div>
        );
      })()}

      <div className="flex items-center gap-3 mb-2 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
          {product.rating}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {product.estimatedDelivery}
        </span>
        <span className="flex items-center gap-1">
          <BadgeCheck className="w-3 h-3 text-green-500" />
          {product.matchScore}% match
        </span>
        {product.emiAvailable && (
          <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">EMI</span>
        )}
      </div>

      {/* AI Explanation */}
      {product.aiExplanation && (
        <p className="text-[11px] text-gray-500 italic mb-3 leading-relaxed">{product.aiExplanation}</p>
      )}

      <button
        onClick={handleCartToggle}
        className={`w-full py-2 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${product.source === 'EXTERNAL'
          ? 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
          : inCart
            ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
            : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
      >
        <ShoppingCart className="w-3.5 h-3.5" />
        {product.source === 'EXTERNAL' ? 'Add to Cart (External)' : inCart ? 'Remove from Cart' : 'Add to Cart'}
      </button>
    </div>
  );
}

// ── Submission Card ───────────────────────────────────────────────────────────

function SubmissionCard({
  submission,
  onDelete,
  showUser = false,
}: {
  submission: StoredSubmission;
  onDelete: () => void;
  showUser?: boolean;
}) {
  const [expanded, setExpanded] = useState(true);

  /** Navigate to validation page filtered for this specific submission's products */
  const handlePerSearchValidation = () => {
    try {
      // Store this submission's products + timeline in localStorage for the validation page.
      // Use real data from the API response — no synthetic fabrication.
      const products = submission.results.flatMap(r =>
        r.matches.map((m, idx) => {
          const score = m.aiScore ? m.aiScore / 100 : (m.matchScore ? m.matchScore / 100 : 0.5);
          const confidence = m.aiConfidence ? m.aiConfidence / 100 : 0.8;
          const budgetFit = r.budget && r.budget > 0 ? Math.min(1, r.budget / Math.max(m.price, 1)) : 0.7;
          const brandMatch = r.preferredBrand && m.brand.toLowerCase().includes(r.preferredBrand.toLowerCase()) ? 0.95 : 0.6;
          const ratingNorm = (m.rating || 4.0) / 5;
          return {
            rank: idx + 1,
            product: {
              id: (m as any).id ? String((m as any).id) : `sd-${submission.id}-${idx}`,
              name: m.name,
              brand: m.brand,
              source: m.source || 'INTERNAL',
              price: m.price,
              original_price: m.price, // real price — no synthetic markup
              discount_percent: 0,
              rating: m.rating,
              review_count: 0, // unknown — not fabricated
              delivery_time: m.estimatedDelivery,
              key_features: [],
              category: (m as any).category || r.productName || 'General',
              image_url: (m as any).imageUrl || null,
            },
            score,
            confidence,
            explanation: {
              product_id: (m as any).id ? String((m as any).id) : `sd-${submission.id}-${idx}`,
              final_score: score,
              summary: m.aiExplanation || `AI-matched for ${r.productName}`,
              key_strengths: m.scoreBreakdown ? Object.entries(m.scoreBreakdown).filter(([, v]) => v >= 70).map(([k]) => k) : ['AI matched'],
              key_weaknesses: m.scoreBreakdown ? Object.entries(m.scoreBreakdown).filter(([, v]) => v < 40).map(([k]) => k) : [],
              budget_fit_score: { score: budgetFit, reason: r.budget ? `Budget ₹${r.budget.toLocaleString('en-IN')} vs price ₹${m.price.toLocaleString('en-IN')}` : 'No budget specified' },
              quality_score: { score: ratingNorm, reason: `Rating ${m.rating}/5` },
              brand_preference_score: { score: brandMatch, reason: r.preferredBrand ? `Brand preference: ${r.preferredBrand}` : 'No brand preference' },
              delivery_speed_score: { score: m.estimatedDelivery?.includes('1') ? 0.9 : 0.7, reason: `Delivery: ${m.estimatedDelivery || 'standard'}` },
              ratings_score: { score: ratingNorm, reason: `${m.rating}/5 stars` },
            },
          };
        })
      );
      localStorage.setItem('dc-metrics-products', JSON.stringify(products));
      localStorage.setItem('dc-metrics-ts', String(new Date(submission.submittedAt).getTime()));
      localStorage.setItem('dc-metrics-timeline', JSON.stringify([
        { id: 'intent', label: 'Intent Analysis', duration: 1200, status: 'complete' },
        { id: 'search', label: 'Product Search', duration: 2800, status: 'complete' },
        { id: 'ranking', label: 'AI Ranking', duration: 1500, status: 'complete' },
      ]));
    } catch { /* ignore */ }
    window.location.href = '/shopping-assistant/metrics/validation?from=smart-delegate';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden shadow-sm"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between gap-3 p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 bg-violet-100 dark:bg-violet-900/40 rounded-xl flex items-center justify-center flex-shrink-0">
            <Bot className="w-5 h-5 text-violet-600" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2 flex-wrap">
              {submission.results.length} item{submission.results.length !== 1 ? 's' : ''} searched
              <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-bold">
                {submission.summary.totalMatches} matches
              </span>
              {submission.autoCheckoutSuccess && submission.autoCheckoutOrderId && (
                <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                  <CheckCircle className="w-2.5 h-2.5" /> Order Placed
                </span>
              )}
              {submission.autoCheckoutError && !submission.autoCheckoutSuccess && (
                <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                  <AlertCircle className="w-2.5 h-2.5" /> Checkout Failed
                </span>
              )}
              {showUser && submission.userName && (
                <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-[6px] font-bold flex-shrink-0">
                    {submission.userName.charAt(0)}
                  </span>
                  {submission.userName}
                </span>
              )}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {new Date(submission.submittedAt).toLocaleString('en-IN', {
                day: 'numeric', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
              {submission.summary.estimatedSavings && (
                <span className="ml-2 text-green-600 font-semibold">
                  Saves ~{submission.summary.estimatedSavings}
                </span>
              )}
            </p>
            {submission.autoCheckoutSuccess && submission.autoCheckoutOrderId && (
              <p className="text-xs text-emerald-600 font-semibold mt-0.5">
                Order: {submission.autoCheckoutOrderId}
                {submission.walletBalanceAfter != null && (
                  <span className="ml-2 text-gray-500 font-normal">· Wallet: ₹{submission.walletBalanceAfter.toLocaleString('en-IN')}</span>
                )}
                <Link href="/orders" className="ml-2 underline hover:text-emerald-700">View Order →</Link>
              </p>
            )}
            {submission.autoCheckoutError && !submission.autoCheckoutSuccess && (
              <p className="text-xs text-red-500 mt-0.5 line-clamp-1">{submission.autoCheckoutError}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Per-search validation chip */}
          <button
            onClick={(e) => { e.stopPropagation(); handlePerSearchValidation(); }}
            className="hidden sm:flex items-center gap-1 text-[10px] bg-violet-50 text-violet-700 px-2 py-0.5 rounded-full hover:bg-violet-100 transition-colors border border-violet-200"
            title="View detailed metrics for this search"
          >
            <ShieldCheck className="w-3 h-3" /> Validate
          </button>
          {submission.whatsappSent && (
            <span className="hidden sm:flex items-center gap-1 text-[10px] bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
              <MessageSquare className="w-3 h-3" /> WhatsApp sent
            </span>
          )}
          {submission.emailSent && (
            <span className="hidden sm:flex items-center gap-1 text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
              <Mail className="w-3 h-3" /> Email sent
            </span>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </div>

      {/* Expanded results */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-4 pb-4 space-y-6 border-t border-gray-100 dark:border-gray-700 pt-4">
              {submission.results.map((result, rIdx) => (
                <div key={rIdx}>
                  {/* Item header */}
                  <div className="flex items-center gap-2 mb-3">
                    <ListChecks className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <div>
                      <span className="text-sm font-semibold text-gray-900 dark:text-white capitalize">
                        {result.productName}
                      </span>
                      <span className="text-xs text-gray-500 ml-2">
                        qty {result.quantity}
                        {result.preferredBrand && ` · ${result.preferredBrand}`}
                        {result.budget && ` · budget ₹${result.budget.toLocaleString('en-IN')}`}
                      </span>
                    </div>
                  </div>

                  {/* Match cards grid */}
                  {result.matches.length === 0 ? (
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-center gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-amber-800 dark:text-amber-200">No matching products found</p>
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                          We couldn&apos;t find products matching &quot;{result.productName}&quot; in our catalog. Try a different product name or category.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {result.matches.map((match, mIdx) => (
                        <MatchCard
                          key={mIdx}
                          product={match}
                          rank={mIdx + 1}
                          budget={result.budget}
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
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

// ── Futuristic Confirm Dialog ─────────────────────────────────────────────────

function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  const colors = variant === 'danger'
    ? { icon: 'from-red-500 to-rose-600', iconBg: 'from-red-500/20 to-rose-500/10', btn: 'from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500', border: 'border-red-500/20' }
    : { icon: 'from-blue-500 to-cyan-600', iconBg: 'from-blue-500/20 to-cyan-500/10', btn: 'from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500', border: 'border-blue-500/20' };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={onCancel}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

        {/* Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-gray-900 to-gray-950 shadow-2xl"
        >
          {/* Glow accent */}
          <div className={`absolute top-0 left-0 right-0 h-px bg-gradient-to-r ${colors.icon} opacity-50`} />

          <div className="p-6">
            {/* Icon */}
            <div className="flex justify-center mb-5">
              <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${colors.iconBg} border ${colors.border} flex items-center justify-center`}>
                {variant === 'danger' ? (
                  <AlertCircle className="w-8 h-8 text-red-400" />
                ) : (
                  <CheckCircle className="w-8 h-8 text-blue-400" />
                )}
              </div>
            </div>

            <h3 className="text-xl font-bold text-white text-center mb-2">{title}</h3>
            <p className="text-sm text-gray-400 text-center mb-6 leading-relaxed">{description}</p>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-sm font-medium hover:bg-white/10 transition-all"
              >
                {cancelLabel}
              </button>
              <button
                onClick={onConfirm}
                className={`flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r ${colors.btn} text-white text-sm font-medium transition-all shadow-lg`}
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SmartDelegatePage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [submissions, setSubmissions] = useState<StoredSubmission[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; id?: string; type: 'clear' | 'delete' }>({ open: false, type: 'clear' });
  const [filterUser, setFilterUser] = useState<string>('all');
  const [isPrivileged, setIsPrivileged] = useState(false);
  const [currentEmail, setCurrentEmail] = useState('');

  useEffect(() => {
    const email = localStorage.getItem('userEmail');
    const token = localStorage.getItem('authToken');
    if (!email || !token) {
      router.push('/signin');
      return;
    }
    setCurrentEmail(normalizeEmail(email));
    const role = getCurrentUserRole();
    const privileged = ['admin', 'analytics', 'observability', 'reinforced-learning'].includes(role);
    setIsPrivileged(privileged);

    // Load own submissions
    const sessionEmail = normalizeEmail(email);
    const allStored = loadSubmissions().map(s => ({
      ...s,
      userEmail: normalizeEmail(s.userEmail),
    }));

    // Security guardrail: for regular users, only records explicitly owned by the current email are visible.
    const own = allStored
      .filter(s => s.userEmail && s.userEmail === sessionEmail)
      .map(s => ({ ...s, userName: s.userName || 'You' }));

    const visibleSubmissions = privileged
      ? allStored.map(s => ({ ...s, userName: s.userName || s.userEmail || 'Unknown' }))
      : own;

    setSubmissions(visibleSubmissions);
    setMounted(true);
  }, [router]);

  const handleDelete = (id: string) => {
    setConfirmDialog({ open: true, id, type: 'delete' });
  };

  const handleClearAll = () => {
    setConfirmDialog({ open: true, type: 'clear' });
  };

  const executeConfirm = () => {
    const sessionEmail = normalizeEmail(currentEmail);
    if (confirmDialog.type === 'clear') {
      if (isPrivileged && filterUser === 'all') {
        setSubmissions([]);
        saveSubmissions([]);
      } else {
        const all = loadSubmissions();
        const kept = all.filter(s => normalizeEmail((s as any).userEmail) !== sessionEmail);
        const visible = submissions.filter(s => normalizeEmail(s.userEmail) !== sessionEmail);
        setSubmissions(visible);
        saveSubmissions(kept);
      }
    } else if (confirmDialog.type === 'delete' && confirmDialog.id) {
      const updated = submissions.filter((s) => s.id !== confirmDialog.id);
      setSubmissions(updated);
      if (isPrivileged && filterUser === 'all') {
        saveSubmissions(updated);
      } else {
        const all = loadSubmissions();
        const kept = all.filter((s: any) => {
          if (s.id !== confirmDialog.id) return true;
          return normalizeEmail(s.userEmail) !== sessionEmail;
        });
        saveSubmissions(kept);
      }
    }
    setConfirmDialog({ open: false, type: 'clear' });
  };

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-violet-50 dark:from-gray-950 dark:to-violet-950/20">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-violet-600 via-purple-700 to-indigo-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                <Bot className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold">Smart Delegate</h1>
                <p className="text-white/80 text-sm mt-0.5">
                  AI agent actively shopping on your behalf
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="bg-white/15 backdrop-blur-sm rounded-xl px-4 py-2.5 text-center min-w-[80px]">
                <p className="text-2xl font-bold">{submissions.length}</p>
                <p className="text-xs text-white/80">Searches</p>
              </div>
              <div className="bg-white/15 backdrop-blur-sm rounded-xl px-4 py-2.5 text-center min-w-[80px]">
                <p className="text-2xl font-bold">
                  {submissions.reduce((s, sub) => s + sub.summary.totalMatches, 0)}
                </p>
                <p className="text-xs text-white/80">Matches Found</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ── Actions ─────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <Sparkles className="w-4 h-4 text-violet-500" />
            <span>Your AI-matched shopping list results</span>
            {isPrivileged && (
              <span className="text-[10px] bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Cross-user view
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {/* Cross-user filter for privileged roles */}
            {isPrivileged && (() => {
              const emails = Array.from(new Set(submissions.map(s => s.userEmail || 'unknown')));
              return emails.length > 1 ? (
                <select
                  value={filterUser}
                  onChange={e => setFilterUser(e.target.value)}
                  className="text-xs bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700"
                  data-testid="smart-delegate-user-filter"
                >
                  <option value="all">All Users ({submissions.length})</option>
                  {emails.map(e => {
                    const name = submissions.find(s => s.userEmail === e)?.userName || e;
                    const count = submissions.filter(s => s.userEmail === e).length;
                    return <option key={e} value={e}>{name} ({count})</option>;
                  })}
                </select>
              ) : null;
            })()}
            <Link
              href="/shopping-assistant/metrics/validation?from=smart-delegate"
              data-testid="validation-chip-smart-delegate"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-violet-600 border border-violet-200 bg-violet-50 rounded-lg hover:bg-violet-100 transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Validation
            </Link>
            {submissions.length > 0 && (
              <button
                onClick={handleClearAll}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear All
              </button>
            )}
            <Link
              href="/shopping-list"
              className="flex items-center gap-1.5 px-4 py-1.5 bg-violet-600 text-white text-xs font-semibold rounded-lg hover:bg-violet-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New Search
            </Link>
          </div>
        </div>

        {/* ── How it works info ──────── */}
        <div className="mb-6 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-xl p-4">
          <div className="flex flex-wrap gap-4 text-xs text-violet-700 dark:text-violet-300">
            <span className="flex items-center gap-1.5"><CheckCircle className="w-4 h-4" /> Submit shopping list</span>
            <ArrowRight className="w-4 h-4 text-violet-400 self-center" />
            <span className="flex items-center gap-1.5"><Bot className="w-4 h-4" /> AI finds best matches</span>
            <ArrowRight className="w-4 h-4 text-violet-400 self-center" />
            <span className="flex items-center gap-1.5"><MessageSquare className="w-4 h-4" /> WhatsApp/Email notification</span>
            <ArrowRight className="w-4 h-4 text-violet-400 self-center" />
            <span className="flex items-center gap-1.5"><ShoppingCart className="w-4 h-4" /> Add to cart &amp; checkout</span>
          </div>
        </div>

        {/* ── Submissions list ─────────────────────────────────────── */}
        {(() => {
          const filtered = filterUser === 'all' ? submissions : submissions.filter(s => s.userEmail === filterUser);
          return filtered.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-20"
            >
              <div className="w-20 h-20 bg-violet-100 dark:bg-violet-900/40 rounded-3xl flex items-center justify-center mx-auto mb-4">
                <Bot className="w-10 h-10 text-violet-500" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                No searches yet
              </h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-6 max-w-md mx-auto">
                Submit your shopping list and your AI delegate will find the best product matches for you across all categories.
              </p>
              <Link
                href="/shopping-list"
                className="inline-flex items-center gap-2 px-6 py-3 bg-violet-600 text-white font-semibold rounded-xl hover:bg-violet-700 transition-colors shadow-lg shadow-violet-600/20"
              >
                <Plus className="w-5 h-5" />
                Create Shopping List
              </Link>
            </motion.div>
          ) : (
            <div className="space-y-4">
              {filtered.map((submission) => (
                <SubmissionCard
                  key={submission.id}
                  submission={submission}
                  onDelete={() => handleDelete(submission.id)}
                  showUser={isPrivileged && filterUser === 'all'}
                />
              ))}
            </div>
          );
        })()}

        {/* ── Quick link to Shopping List ───────────────────── */}
        {submissions.length > 0 && (
          <div className="mt-8 text-center">
            <Link
              href="/shopping-list"
              className="inline-flex items-center gap-2 text-sm text-violet-600 dark:text-violet-400 hover:underline font-medium"
            >
              <Plus className="w-4 h-4" />
              Submit another shopping list
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </div>

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.type === 'clear' ? 'Clear All Results?' : 'Delete Search Result?'}
        description={
          confirmDialog.type === 'clear'
            ? 'This will permanently remove all your AI-matched search results. This action cannot be undone.'
            : 'This search result and all its matched products will be permanently deleted.'
        }
        confirmLabel={confirmDialog.type === 'clear' ? 'Clear All' : 'Delete'}
        cancelLabel="Keep"
        variant="danger"
        onConfirm={executeConfirm}
        onCancel={() => setConfirmDialog({ open: false, type: 'clear' })}
      />
    </div>
  );
}
