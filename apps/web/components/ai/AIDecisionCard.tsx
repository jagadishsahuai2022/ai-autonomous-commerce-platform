'use client';

import { motion } from 'framer-motion';
import { Star, Truck, TrendingUp, TrendingDown, ChevronDown, ChevronUp, Zap, ExternalLink, Shield } from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ConfidenceIndicator } from './ConfidenceIndicator';
import { getBrandTier, parseDeliveryInfo, computeVerifiedRating } from '@/lib/scoring/product-scoring';
import { getCurrentUserRole } from '@/lib/admin-auth';
import type { RankedProduct } from '@/types/shopping-assistant';

interface AIDecisionCardProps {
  product: RankedProduct;
  rank?: number;
  isTopPick?: boolean;
  onSelect?: (product: RankedProduct) => void;
  /** Called when the product name/title is clicked — opens detail modal */
  onProductNameClick?: (product: RankedProduct) => void;
  className?: string;
}

function ScoreBar({ label, score, icon }: { label: string; score: number; icon?: React.ReactNode }) {
  const color = score >= 0.8 ? 'bg-green-500' : score >= 0.6 ? 'bg-amber-500' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      {icon && <span className="text-gray-400 dark:text-gray-500 flex-shrink-0">{icon}</span>}
      <span className="text-xs text-gray-500 dark:text-gray-400 w-20 flex-shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', color)}
          initial={{ width: 0 }}
          animate={{ width: `${score * 100}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
        />
      </div>
      <span className="text-xs font-medium text-gray-600 dark:text-gray-300 w-8 text-right">
        {Math.round(score * 100)}
      </span>
    </div>
  );
}

export function AIDecisionCard({
  product,
  rank = 1,
  isTopPick = false,
  onSelect,
  onProductNameClick,
  className,
}: AIDecisionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { product: p, confidence, explanation } = product;
  const confidencePct = Math.round(confidence * 100);
  const discountPct = p.discount_percent ?? (p.original_price ? Math.round((1 - p.price / p.original_price) * 100) : 0);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={cn(
        'relative rounded-2xl border bg-white dark:bg-gray-900 shadow-sm overflow-hidden',
        isTopPick
          ? 'border-violet-400 dark:border-violet-500 shadow-violet-100 dark:shadow-violet-900/20 shadow-md'
          : 'border-gray-200 dark:border-gray-700',
        className
      )}
    >
      {/* Top pick badge */}
      {isTopPick && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500" />
      )}

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex-1 min-w-0">
            {isTopPick && (
              <div className="flex items-center gap-1.5 mb-1.5">
                <Zap className="w-3.5 h-3.5 text-violet-500" />
                <span className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wide">
                  AI Top Pick
                </span>
              </div>
            )}
            {!isTopPick && rank > 0 && (
              <span className="text-xs text-gray-400 dark:text-gray-500 mb-1 block">#{rank} ranked</span>
            )}
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm leading-snug line-clamp-2">
              {onProductNameClick ? (
                <button
                  type="button"
                  className="text-left hover:text-violet-600 dark:hover:text-violet-400 hover:underline transition-colors"
                  onClick={e => { e.stopPropagation(); onProductNameClick(product); }}
                  title="View product details"
                >
                  {p.name}
                </button>
              ) : (
                <Link href={`/products?q=${encodeURIComponent(p.name)}`} className="hover:text-violet-600 dark:hover:text-violet-400 hover:underline transition-colors" onClick={e => e.stopPropagation()}>
                  {p.name}
                </Link>
              )}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{p.brand}</p>
          </div>
          <ConfidenceIndicator score={confidencePct} size="md" />
        </div>

        {/* Price row */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl font-bold text-gray-900 dark:text-gray-100">
            ₹{p.price.toLocaleString('en-IN')}
          </span>
          {p.original_price && (
            <span className="text-sm text-gray-400 line-through">₹{p.original_price.toLocaleString('en-IN')}</span>
          )}
          {discountPct > 0 && (
            <span className="text-xs font-semibold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/40 px-1.5 py-0.5 rounded-full">
              -{discountPct}%
            </span>
          )}
        </div>

        {/* Quick stats */}
        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mb-4">
          <div className="flex items-center gap-1">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            <span className="font-medium text-gray-700 dark:text-gray-300">{p.rating}</span>
            <span>({p.review_count.toLocaleString()})</span>
          </div>
          <span className="text-gray-300 dark:text-gray-600">•</span>
          <div className="flex items-center gap-1">
            <Truck className="w-3.5 h-3.5 text-blue-400" />
            <span>{p.delivery_time}</span>
          </div>
          <span className="text-gray-300 dark:text-gray-600">•</span>
          <span className="capitalize text-gray-400 dark:text-gray-500">{p.source}</span>
        </div>

        {/* Validation chips — visible to elevated roles */}
        {(() => {
          try {
            const role = typeof window !== 'undefined' ? getCurrentUserRole() : 'customer';
            const canSee = ['admin', 'analytics', 'observability', 'reinforced-learning'].includes(role);
            if (!canSee) return null;
            const brand = getBrandTier(p.brand);
            const delivery = parseDeliveryInfo(p.delivery_time);
            const verified = computeVerifiedRating(p.rating, p.review_count);
            return (
              <div className="flex flex-wrap gap-1 mb-3" data-testid="validation-chips">
                <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full border ${brand.tier === 'premium' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : brand.tier === 'rising' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                  🏭 {brand.tier.charAt(0).toUpperCase() + brand.tier.slice(1)} · {brand.country}
                </span>
                <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full border ${delivery.colorClass.includes('green') ? 'bg-green-50 text-green-700 border-green-200' : delivery.colorClass.includes('amber') ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
                  🚚 {delivery.label}
                </span>
                <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full border ${verified.trustBg} ${verified.trustText} border-gray-200`}>
                  ✅ {verified.trustLabel}
                </span>
                <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full border bg-violet-50 text-violet-700 border-violet-200`}>
                  🛡️ Score {Math.round(product.score * 100)}%
                </span>
              </div>
            );
          } catch { return null; }
        })()}

        {/* AI Summary */}
        <div className="bg-violet-50 dark:bg-violet-950/30 rounded-xl p-3 mb-4 border border-violet-100 dark:border-violet-900/50">
          <p className="text-xs font-medium text-violet-700 dark:text-violet-300 flex items-center gap-1.5 mb-1.5">
            <Zap className="w-3 h-3" /> Why AI chose this
          </p>
          <p className="text-xs text-violet-600 dark:text-violet-400 leading-relaxed">
            {explanation.summary}
          </p>
        </div>

        {/* Strengths preview */}
        {explanation.key_strengths.length > 0 && (
          <div className="space-y-1 mb-3">
            {explanation.key_strengths.slice(0, 2).map((s, i) => (
              <div key={i} className="flex items-start gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                <TrendingUp className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                <span>{s}</span>
              </div>
            ))}
            {explanation.key_weaknesses.slice(0, 1).map((w, i) => (
              <div key={i} className="flex items-start gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                <TrendingDown className="w-3 h-3 text-red-400 mt-0.5 flex-shrink-0" />
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}

        {/* Expandable score breakdown */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors mb-3"
        >
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {expanded ? 'Hide' : 'Show'} score breakdown
        </button>

        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-2 mb-4 pt-1"
          >
            <ScoreBar label="Budget fit" score={explanation.budget_fit_score.score} />
            <ScoreBar label="Quality" score={explanation.quality_score.score} />
            <ScoreBar label="Brand" score={explanation.brand_preference_score.score} />
            <ScoreBar label="Delivery" score={explanation.delivery_speed_score.score} />
            <ScoreBar label="Ratings" score={explanation.ratings_score.score} />
          </motion.div>
        )}

        {/* CTA */}
        <button
          onClick={() => onSelect?.(product)}
          className={cn(
            'w-full py-2.5 px-4 rounded-xl text-sm font-semibold transition-all duration-200',
            isTopPick
              ? 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white shadow-sm shadow-violet-200 dark:shadow-violet-900/30'
              : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200'
          )}
        >
          {isTopPick ? 'Select This Product' : 'View Details'}
          {isTopPick && <ExternalLink className="inline w-3.5 h-3.5 ml-1.5" />}
        </button>
      </div>
    </motion.div>
  );
}
