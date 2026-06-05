/**
 * Product Recommendation Carousel Component
 * Production-grade responsive carousel — horizontal scroll, no page stretch.
 * Cards are contained within a fixed-width scroll region; the outer wrapper
 * never grows beyond its parent via overflow-hidden + w-full + min-w-0.
 */

'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ShoppingCart, Star, Truck, Zap, Info, XCircle, Award, TrendingUp, Globe, Store, X } from 'lucide-react';
import type { RankedProduct } from '@/types/shopping-assistant';

// ── Cart helpers ─────────────────────────────────────────────────────────────

function getCartIds(): Set<string> {
  try {
    const raw = localStorage.getItem('cart');
    const cart: Array<{ productId: string }> = raw ? JSON.parse(raw) : [];
    return new Set(cart.map((i) => i.productId));
  } catch {
    return new Set();
  }
}

function addToCart(product: RankedProduct) {
  try {
    const raw = localStorage.getItem('cart');
    const cart: Array<{
      id: string; productId: string; name: string;
      price: number; quantity: number; stock: number;
      image?: string; source?: string;
    }> = raw ? JSON.parse(raw) : [];
    const existing = cart.find((i) => i.productId === product.product.id);
    if (!existing) {
      const isSynthetic = product.product.id.startsWith('synth-');
      cart.push({
        id: `cart-${product.product.id}-${Date.now()}`,
        productId: product.product.id,
        name: product.product.name,
        price: product.product.price,
        quantity: 1,
        stock: 99,
        image: product.product.imageUrl || '/product-placeholder.svg',
        source: isSynthetic ? 'INTERNAL' : 'INTERNAL',
      });
      localStorage.setItem('cart', JSON.stringify(cart));
      window.dispatchEvent(new Event('cartUpdated'));
    }
  } catch { /* ignore */ }
}

function removeFromCart(productId: string) {
  try {
    const raw = localStorage.getItem('cart');
    const cart: Array<{ productId: string }> = raw ? JSON.parse(raw) : [];
    const updated = cart.filter((i) => i.productId !== productId);
    localStorage.setItem('cart', JSON.stringify(updated));
    window.dispatchEvent(new Event('cartUpdated'));
  } catch { /* ignore */ }
}

import { ProductDetailModal as FullProductDetailModal } from './ProductDetailModal';

// ── Source Badge ─────────────────────────────────────────────────────────────

const SourceBadge: React.FC<{ isExternal?: boolean; size?: 'sm' | 'xs' }> = ({ isExternal, size = 'sm' }) => {
  const label = isExternal ? 'External product — not in DelegateCart catalog' : 'Native product — in DelegateCart catalog';
  const testId = isExternal ? 'external-badge' : 'native-badge';
  if (isExternal) {
    return (
      <span
        title={label}
        data-testid={testId}
        className={`inline-flex items-center gap-1 bg-amber-100 text-amber-700 font-semibold rounded-full ${size === 'xs' ? 'text-[9px] px-1 py-0.5' : 'text-[10px] px-1.5 py-0.5'}`}
      >
        <Globe className={size === 'xs' ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
        External
      </span>
    );
  }
  return (
    <span
      title={label}
      data-testid={testId}
      className={`inline-flex items-center gap-1 bg-green-100 text-green-700 font-semibold rounded-full ${size === 'xs' ? 'text-[9px] px-1 py-0.5' : 'text-[10px] px-1.5 py-0.5'}`}
    >
      <Store className={size === 'xs' ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
      Native
    </span>
  );
};

// ── Product Detail Modal ──────────────────────────────────────────────────────

const ProductDetailModal: React.FC<{ product: RankedProduct | null; onClose: () => void }> = ({ product, onClose }) => {
  if (!product) return null;
  const p = product.product;
  return (
    <div
      className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
      data-testid="product-detail-modal"
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky header */}
        <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-gray-100 bg-white sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <SourceBadge isExternal={p.isExternal} />
            <span className="text-xs bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded-full">
              Rank #{product.rank}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close product details"
            data-testid="product-detail-close"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* Image */}
          {p.imageUrl && (
            <div className="w-full h-48 bg-gray-50 rounded-xl overflow-hidden flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.imageUrl} alt={p.name} className="max-w-full max-h-full object-contain" loading="lazy" />
            </div>
          )}

          {/* Name + brand + price */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 leading-tight">{p.name}</h3>
            <p className="text-sm text-gray-500 mt-0.5">{p.brand}</p>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-2xl font-extrabold text-gray-900">₹{p.price.toLocaleString()}</span>
              {p.original_price > p.price && (
                <span className="text-sm text-gray-400 line-through">₹{p.original_price.toLocaleString()}</span>
              )}
              {p.discount_percent > 0 && (
                <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">
                  {p.discount_percent}% OFF
                </span>
              )}
            </div>
          </div>

          {/* AI Score summary */}
          <div className="bg-blue-50 rounded-xl p-3">
            <p className="text-xs font-semibold text-blue-800 mb-1">AI Score: {(product.score * 100).toFixed(0)}% · Confidence: {(product.confidence * 100).toFixed(0)}%</p>
            <p className="text-xs text-gray-700 leading-relaxed">{product.explanation.summary}</p>
          </div>

          {/* Score breakdown */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-gray-700 mb-2">Score Breakdown</p>
            {[
              { label: 'Quality', score: product.explanation.quality_score.score, reason: product.explanation.quality_score.reason, color: 'from-purple-400 to-purple-600' },
              { label: 'Budget Fit', score: product.explanation.budget_fit_score.score, reason: product.explanation.budget_fit_score.reason, color: 'from-green-400 to-green-600' },
              { label: 'Rating', score: product.explanation.ratings_score.score, reason: product.explanation.ratings_score.reason, color: 'from-amber-400 to-amber-600' },
              { label: 'Delivery', score: product.explanation.delivery_speed_score.score, reason: product.explanation.delivery_speed_score.reason, color: 'from-blue-400 to-blue-600' },
              { label: 'Brand', score: product.explanation.brand_preference_score.score, reason: product.explanation.brand_preference_score.reason, color: 'from-pink-400 to-pink-600' },
            ].map(({ label, score, reason, color }) => (
              <div key={label} className="flex items-center gap-2">
                <span className="text-xs text-gray-600 w-16 flex-shrink-0">{label}</span>
                <div className="flex-1 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                  <div className={`h-full bg-gradient-to-r ${color}`} style={{ width: `${score * 100}%` }} />
                </div>
                <span className="text-xs font-medium text-gray-700 w-8 text-right">{(score * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>

          {/* Strengths / Weaknesses */}
          {product.explanation.key_strengths.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-green-700 mb-1">✓ Strengths</p>
              <ul className="space-y-0.5">
                {product.explanation.key_strengths.map((s, i) => (
                  <li key={i} className="text-xs text-gray-600 flex items-start gap-1">
                    <span className="text-green-500 mt-0.5 flex-shrink-0">•</span>{s}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {product.explanation.key_weaknesses.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-amber-700 mb-1">⚠ Considerations</p>
              <ul className="space-y-0.5">
                {product.explanation.key_weaknesses.map((w, i) => (
                  <li key={i} className="text-xs text-gray-600 flex items-start gap-1">
                    <span className="text-amber-500 mt-0.5 flex-shrink-0">•</span>{w}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Key features */}
          {p.key_features.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-1.5">Key Features</p>
              <div className="flex flex-wrap gap-1.5">
                {p.key_features.map((f, i) => (
                  <span key={i} className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-lg">{f}</span>
                ))}
              </div>
            </div>
          )}

          {/* Meta row */}
          <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
            <span>⭐ {p.rating}/5 ({p.review_count?.toLocaleString()} reviews)</span>
            <span className="text-blue-600 font-medium">{p.delivery_time}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Main Carousel ────────────────────────────────────────────────────────────

interface ProductRecommendationCarouselProps {
  products: RankedProduct[];
  onSelectProduct?: (product: RankedProduct) => void;
  showComparison?: boolean;
  onCompareToggle?: () => void;
}

export const ProductRecommendationCarousel: React.FC<ProductRecommendationCarouselProps> = ({
  products,
  onSelectProduct,
  showComparison = false,
  onCompareToggle,
}) => {
  const [showDetails, setShowDetails] = useState<string | null>(null);
  const [cartIds, setCartIds] = useState<Set<string>>(new Set());
  const [scrollPos, setScrollPos] = useState(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [detailProduct, setDetailProduct] = useState<RankedProduct | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Sync cart state on mount and on cartUpdated events
  useEffect(() => {
    const sync = () => setCartIds(getCartIds());
    sync();
    window.addEventListener('cartUpdated', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('cartUpdated', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const updateScrollState = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    setScrollPos(el.scrollLeft);
  }, []);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener('scroll', updateScrollState, { passive: true });
    // Recalculate when the container or its content resizes (image loads, layout shifts)
    const ro = new ResizeObserver(() => updateScrollState());
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', updateScrollState);
      ro.disconnect();
    };
  }, [updateScrollState]);

  const handleToggleCart = useCallback((product: RankedProduct) => {
    const inCart = cartIds.has(product.product.id);
    if (inCart) {
      removeFromCart(product.product.id);
    } else {
      addToCart(product);
      onSelectProduct?.(product);
    }
    setCartIds(getCartIds());
  }, [cartIds, onSelectProduct]);

  const handleScroll = (direction: 'left' | 'right') => {
    const container = scrollContainerRef.current;
    if (!container) return;
    // Scroll by ~1.5 card widths for smooth paging
    const scrollAmount = 256 + 12; // card width + gap
    container.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
  };

  const topProduct = products[0];
  const avgConfidence = products.reduce((s, p) => s + p.confidence, 0) / products.length;

  return (
    /* KEY: w-full + min-w-0 + overflow-hidden prevents ANY child from stretching the page */
    <div className="w-full min-w-0 overflow-hidden space-y-3" data-testid="product-carousel">
      {/* Product Detail Modal — rendered at top level of carousel */}
      <FullProductDetailModal
        productId={detailProduct?.product.id ?? null}
        rankedProduct={detailProduct}
        onClose={() => setDetailProduct(null)}
      />
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <h3 className="font-bold text-gray-900 flex items-center gap-2 text-sm">
            <Award className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <span>Top Recommendations</span>
            <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded-full">
              {products.length}
            </span>
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            AI confidence: <span className="font-semibold text-green-600">{(avgConfidence * 100).toFixed(0)}%</span>
            {' · '}Scroll to see all ›
          </p>
        </div>
        {onCompareToggle && (
          <button
            onClick={onCompareToggle}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors flex-shrink-0 ${showComparison
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600'
              }`}
          >
            Compare
          </button>
        )}
      </div>

      {/* ── Best Match Banner ───────────────────────────────────────────── */}
      {topProduct && (
        <div className="bg-gradient-to-r from-amber-50 via-yellow-50 to-orange-50 border border-yellow-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Left: labels + name */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              <span className="inline-flex items-center gap-1 bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-0.5 rounded-full">
                <TrendingUp className="w-3 h-3" /> Best Match
              </span>
              <span className="bg-green-100 text-green-800 text-xs font-semibold px-2 py-0.5 rounded-full">
                {(topProduct.score * 100).toFixed(0)}% Score
              </span>
              {topProduct.product.discount_percent > 0 && (
                <span className="bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                  {topProduct.product.discount_percent}% OFF
                </span>
              )}
            </div>
            <p className="text-sm font-bold text-gray-900 line-clamp-1">{topProduct.product.name}</p>
            <p className="text-xs text-gray-500">{topProduct.product.brand} · {topProduct.product.delivery_time}</p>
          </div>

          {/* Right: price + CTA */}
          <div className="flex sm:flex-col items-center sm:items-end gap-3 flex-shrink-0">
            <div className="text-right">
              <p className="text-lg font-bold text-gray-900">₹{topProduct.product.price.toLocaleString()}</p>
              {topProduct.product.original_price > topProduct.product.price && (
                <p className="text-xs text-gray-400 line-through">₹{topProduct.product.original_price.toLocaleString()}</p>
              )}
            </div>
            <CartToggleButton
              inCart={cartIds.has(topProduct.product.id)}
              onClick={() => handleToggleCart(topProduct)}
              variant="highlight"
            />
          </div>
        </div>
      )}

      {/* ── Carousel Scroll Region ──────────────────────────────────────── */}
      {/*
        CRITICAL LAYOUT FIX:
        - `relative overflow-hidden w-full` prevents the carousel from ever stretching the parent
        - `scrollContainerRef` gets `w-full overflow-x-auto` so it knows its own width
        - Cards use `flex-shrink-0 w-56 sm:w-64` for predictable sizes
        - Arrow buttons are overlaid absolutely, inside the overflow-hidden boundary
      */}
      <div className="relative overflow-hidden w-full group" data-testid="carousel-viewport">
        {/* Left fade + nav arrow */}
        <div
          className={`absolute left-0 top-0 bottom-0 w-12 z-10 pointer-events-none bg-gradient-to-r from-white/80 to-transparent transition-opacity duration-200 ${canScrollLeft ? 'opacity-100' : 'opacity-0'
            }`}
        />
        <button
          onClick={() => handleScroll('left')}
          aria-label="Scroll left"
          className={`absolute left-1 top-1/2 -translate-y-1/2 z-20 w-8 h-8 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-md hover:shadow-lg hover:bg-gray-50 transition-all ${canScrollLeft
              ? 'opacity-100 pointer-events-auto'
              : 'opacity-0 pointer-events-none group-hover:opacity-40'
            }`}
        >
          <ChevronLeft className="w-4 h-4 text-gray-600" />
        </button>

        {/* Scroll container — w-full is essential */}
        <div
          ref={scrollContainerRef}
          className="w-full overflow-x-auto pb-2 hide-scrollbar"
          data-testid="carousel-scroll"
        >
          {/* flex + w-max lets cards stay fixed-width while enabling scroll */}
          <div className="flex gap-3 px-1 w-max">
            {products.map((product, idx) => (
              <ProductCard
                key={`${product.product.id}_${idx}`}
                product={product}
                rank={product.rank}
                inCart={cartIds.has(product.product.id)}
                onToggleCart={() => handleToggleCart(product)}
                isExpanded={showDetails === product.product.id}
                onToggleDetails={() =>
                  setShowDetails(showDetails === product.product.id ? null : product.product.id)
                }
                onOpenDetail={() => setDetailProduct(product)}
              />
            ))}
          </div>
        </div>

        {/* Right fade + nav arrow */}
        <div
          className={`absolute right-0 top-0 bottom-0 w-12 z-10 pointer-events-none bg-gradient-to-l from-white/80 to-transparent transition-opacity duration-200 ${canScrollRight ? 'opacity-100' : 'opacity-0'
            }`}
        />
        <button
          onClick={() => handleScroll('right')}
          aria-label="Scroll right"
          className={`absolute right-1 top-1/2 -translate-y-1/2 z-20 w-8 h-8 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-md hover:shadow-lg hover:bg-gray-50 transition-all ${canScrollRight
              ? 'opacity-100 pointer-events-auto'
              : 'opacity-0 pointer-events-none group-hover:opacity-40'
            }`}
        >
          <ChevronRight className="w-4 h-4 text-gray-600" />
        </button>
      </div>

      {/* ── Scroll Position Dots ────────────────────────────────────────── */}
      {products.length > 2 && (
        <div className="flex justify-center gap-1.5" aria-hidden>
          {products.map((_, idx) => {
            const el = scrollContainerRef.current;
            const cardWidth = 268; // 256px + 12px gap approx
            const activeIdx = el ? Math.round(el.scrollLeft / cardWidth) : 0;
            return (
              <button
                key={idx}
                onClick={() => {
                  scrollContainerRef.current?.scrollTo({ left: idx * cardWidth, behavior: 'smooth' });
                }}
                className={`h-1.5 rounded-full transition-all duration-300 ${idx === activeIdx ? 'w-5 bg-blue-500' : 'w-1.5 bg-gray-300 hover:bg-gray-400'
                  }`}
              />
            );
          })}
        </div>
      )}

      {/* ── Scoring Legend ──────────────────────────────────────────────── */}
      <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-xs text-gray-600">
        <div className="flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" />
          <span>Quality: build &amp; features</span>
        </div>
        <div className="flex items-center gap-1.5">
          <ShoppingCart className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
          <span>Price: budget fit</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Star className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
          <span>Rating: reviews</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Truck className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />
          <span>Delivery: speed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
          <span>Confidence: reliability</span>
        </div>
      </div>
    </div>
  );
};

// ── Cart Toggle Button ───────────────────────────────────────────────────────

const CartToggleButton: React.FC<{
  inCart: boolean;
  onClick: () => void;
  variant?: 'highlight' | 'card';
}> = ({ inCart, onClick, variant = 'card' }) => {
  if (variant === 'highlight') {
    return (
      <button
        onClick={onClick}
        data-testid="cart-toggle-highlight"
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap flex-shrink-0 shadow-sm hover:shadow-md ${inCart
            ? 'bg-red-500 hover:bg-red-600 text-white'
            : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
      >
        {inCart ? (
          <><XCircle className="w-4 h-4" /> Remove from Cart</>
        ) : (
          <><ShoppingCart className="w-4 h-4" /> Add to Cart</>
        )}
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      data-testid="cart-toggle-card"
      className={`flex-1 flex items-center justify-center gap-1.5 text-white text-xs font-semibold py-2 rounded-lg transition-all ${inCart
          ? 'bg-red-500 hover:bg-red-600'
          : 'bg-blue-600 hover:bg-blue-700'
        }`}
    >
      {inCart ? (
        <><XCircle className="w-3.5 h-3.5" /> Remove</>
      ) : (
        <><ShoppingCart className="w-3.5 h-3.5" /> Add to Cart</>
      )}
    </button>
  );
};

// ── Product Card ─────────────────────────────────────────────────────────────

interface ProductCardProps {
  product: RankedProduct;
  rank: number;
  inCart: boolean;
  onToggleCart: () => void;
  isExpanded?: boolean;
  onToggleDetails?: () => void;
  onOpenDetail?: () => void;
}

const RANK_COLORS = ['from-yellow-400 to-amber-500', 'from-gray-400 to-gray-500', 'from-orange-400 to-orange-500'];

const ProductCard: React.FC<ProductCardProps> = ({
  product,
  rank,
  inCart,
  onToggleCart,
  isExpanded = false,
  onToggleDetails,
  onOpenDetail,
}) => {
  const scoreColor = (score: number) => {
    if (score >= 0.75) return 'text-green-700 bg-green-50';
    if (score >= 0.5) return 'text-amber-700 bg-amber-50';
    return 'text-red-700 bg-red-50';
  };

  const rankGradient = RANK_COLORS[rank - 1] ?? 'from-blue-500 to-blue-600';

  return (
    /* flex-shrink-0 + fixed width — cards never shrink or grow, scroll container handles overflow */
    <div
      className={`flex-shrink-0 w-56 sm:w-64 bg-white rounded-2xl overflow-hidden transition-all duration-200 ${isExpanded
          ? 'ring-2 ring-blue-500 shadow-xl'
          : 'border border-gray-200 hover:border-blue-300 hover:shadow-lg shadow-sm'
        }`}
      data-testid="product-card"
    >
      {/* Card Top — gradient header with rank + score */}
      <div className={`bg-gradient-to-r ${rankGradient} p-3`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <span className="bg-white/20 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
              {rank}
            </span>
            {product.product.discount_percent > 0 && (
              <span className="bg-white/20 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                -{product.product.discount_percent}%
              </span>
            )}
            <SourceBadge isExternal={product.product.isExternal} size="xs" />
          </div>
          <span className={`text-xs font-bold px-2 py-1 rounded-lg bg-white/90 ${scoreColor(product.score)}`}>
            {(product.score * 100).toFixed(0)}%
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-extrabold text-white">₹{product.product.price.toLocaleString()}</span>
          {product.product.original_price > product.product.price && (
            <span className="text-xs text-white/70 line-through">₹{product.product.original_price.toLocaleString()}</span>
          )}
        </div>
      </div>

      {/* Card Body — click on image/name area to open detail modal */}
      <div className="p-3 space-y-2.5">
        {/* Clickable product image + name area */}
        <button
          className="w-full text-left group"
          onClick={onOpenDetail}
          title="Click to view product details"
          data-testid="product-card-detail-trigger"
        >
          {/* Product Image */}
          {product.product.imageUrl && (
            <div className="w-full h-32 bg-gray-50 rounded-lg overflow-hidden flex items-center justify-center mb-2 group-hover:ring-2 group-hover:ring-blue-300 transition-all">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={product.product.imageUrl}
                alt={product.product.name}
                className="max-w-full max-h-full object-contain"
                loading="lazy"
              />
            </div>
          )}
          {/* Product Name + Brand */}
          <div>
            <p className="text-sm font-bold text-gray-900 line-clamp-2 leading-tight group-hover:text-blue-600 transition-colors">{product.product.name}</p>
            <p className="text-xs text-gray-500 mt-0.5">{product.product.brand}</p>
          </div>
        </button>

        {/* Score Bars */}
        <div className="space-y-1.5">
          <ScoreRow label="Quality" score={product.explanation.quality_score.score} color="from-purple-400 to-purple-600" />
          <ScoreRow label="Price" score={product.explanation.budget_fit_score.score} color="from-green-400 to-green-600" />
          <ScoreRow label="Rating" score={product.explanation.ratings_score.score} color="from-amber-400 to-amber-600" />
          <ScoreRow label="Delivery" score={product.explanation.delivery_speed_score.score} color="from-blue-400 to-blue-600" />
        </div>

        {/* Rating + Delivery mini row */}
        <div className="flex items-center justify-between text-xs text-gray-600 pt-1 border-t border-gray-100">
          <span>⭐ {product.product.rating}/5 <span className="text-gray-400">({product.product.review_count})</span></span>
          <span className="text-blue-600 font-medium">{product.product.delivery_time}</span>
        </div>

        {/* Key Features */}
        {product.product.key_features.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {product.product.key_features.slice(0, 3).map((f, i) => (
              <span key={i} className="bg-gray-100 text-gray-600 text-[10px] px-1.5 py-0.5 rounded-md">{f}</span>
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-1.5 pt-1">
          <CartToggleButton inCart={inCart} onClick={onToggleCart} variant="card" />
          <button
            onClick={onOpenDetail}
            title="View full product details"
            data-testid="product-detail-btn"
            className="px-3 py-2 bg-gray-100 hover:bg-blue-100 hover:text-blue-700 text-gray-600 text-sm rounded-lg transition-colors flex-shrink-0"
          >
            <Info className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Expanded Details Drawer */}
      {isExpanded && (
        <div className="bg-blue-50/50 border-t border-blue-100 p-3 text-xs space-y-2">
          <p className="text-gray-700 leading-relaxed">{product.explanation.summary}</p>
          {product.explanation.key_strengths.length > 0 && (
            <div>
              <p className="font-semibold text-green-700 mb-1">✓ Strengths</p>
              <ul className="space-y-0.5">
                {product.explanation.key_strengths.map((s, i) => (
                  <li key={i} className="text-gray-600 flex items-start gap-1">
                    <span className="text-green-500 mt-0.5">•</span>{s}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {product.explanation.key_weaknesses.length > 0 && (
            <div>
              <p className="font-semibold text-amber-700 mb-1">⚠ Considerations</p>
              <ul className="space-y-0.5">
                {product.explanation.key_weaknesses.map((w, i) => (
                  <li key={i} className="text-gray-600 flex items-start gap-1">
                    <span className="text-amber-500 mt-0.5">•</span>{w}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Score Row ────────────────────────────────────────────────────────────────

const ScoreRow: React.FC<{ label: string; score: number; color: string }> = ({ label, score, color }) => (
  <div className="flex items-center gap-2">
    <span className="text-xs font-medium text-gray-700 w-14">{label}</span>
    <div className="flex-1 bg-gray-200 rounded-full h-1.5 overflow-hidden">
      <div className={`h-full bg-gradient-to-r ${color} transition-all`} style={{ width: `${score * 100}%` }} />
    </div>
    <span className="text-xs font-semibold text-gray-900 w-10 text-right">{(score * 100).toFixed(0)}%</span>
  </div>
);
