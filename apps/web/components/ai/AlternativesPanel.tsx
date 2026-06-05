'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Star, Truck, ChevronRight, ExternalLink, X } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ConfidenceIndicator } from './ConfidenceIndicator';
import type { RankedProduct } from '@/types/shopping-assistant';

interface AlternativesPanelProps {
  alternatives: RankedProduct[];
  topPick?: RankedProduct;
  onSelect?: (product: RankedProduct) => void;
  onCompare?: (products: RankedProduct[]) => void;
  onMoreInfo?: (product: RankedProduct) => void;
  className?: string;
}

function AlternativeRow({
  product,
  index,
  onSelect,
  onCompare,
  onMoreInfo,
}: {
  product: RankedProduct;
  index: number;
  onSelect?: (product: RankedProduct) => void;
  onCompare?: (product: RankedProduct) => void;
  onMoreInfo?: (product: RankedProduct) => void;
}) {
  const { product: p, confidence, explanation } = product;
  const confidencePct = Math.round(confidence * 100);

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1, duration: 0.3 }}
      className="border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden"
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Rank badge */}
          <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400">#{product.rank}</span>
          </div>

          {/* Product info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 line-clamp-1">{p.name}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">{p.brand}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm font-bold text-gray-900 dark:text-gray-100">₹{p.price.toLocaleString('en-IN')}</span>
              <div className="flex items-center gap-0.5 text-xs text-gray-400">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                <span>{p.rating}</span>
              </div>
              <div className="flex items-center gap-0.5 text-xs text-gray-400">
                <Truck className="w-3 h-3" />
                <span>{p.delivery_time}</span>
              </div>
            </div>
          </div>

          <ConfidenceIndicator score={confidencePct} size="sm" />
        </div>

        {/* Why not top pick */}
        <div className="mt-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2.5">
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2">
            {explanation.summary}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={() => onMoreInfo?.(product)}
            className="flex items-center gap-0.5 text-xs text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            More info
          </button>
          <span className="text-gray-200 dark:text-gray-700">•</span>
          <button
            onClick={() => onCompare?.(product)}
            className="text-xs text-blue-500 hover:text-blue-600 transition-colors"
          >
            Compare
          </button>
          <div className="flex-1" />
          <button
            onClick={() => onSelect?.(product)}
            className="flex items-center gap-0.5 text-xs font-medium text-violet-600 dark:text-violet-400 hover:text-violet-700 transition-colors"
          >
            Select <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export function AlternativesPanel({
  alternatives,
  topPick,
  onSelect,
  onCompare,
  onMoreInfo,
  className,
}: AlternativesPanelProps) {
  const [compareList, setCompareList] = useState<RankedProduct[]>([]);
  const [showCompareBar, setShowCompareBar] = useState(false);

  const handleCompare = (product: RankedProduct) => {
    const isAdded = compareList.some((p) => p.product.id === product.product.id);
    const newList = isAdded
      ? compareList.filter((p) => p.product.id !== product.product.id)
      : compareList.length < 3 ? [...compareList, product] : compareList;
    setCompareList(newList);
    setShowCompareBar(newList.length > 0);
  };

  if (alternatives.length === 0) return null;

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          {alternatives.length} Alternative{alternatives.length > 1 ? 's' : ''} Considered
        </h3>
        {topPick && (
          <span className="text-xs text-gray-400 dark:text-gray-500">
            vs #{topPick.rank} pick
          </span>
        )}
      </div>

      <div className="space-y-2">
        {alternatives.map((alt, i) => (
          <AlternativeRow
            key={alt.product.id}
            product={alt}
            index={i}
            onSelect={onSelect}
            onCompare={handleCompare}
            onMoreInfo={onMoreInfo}
          />
        ))}
      </div>

      {/* Compare bar */}
      <AnimatePresence>
        {showCompareBar && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-full px-4 py-2.5 shadow-xl flex items-center gap-3"
          >
            <span className="text-sm font-medium">
              {compareList.length} selected
            </span>
            <button
              onClick={() => onCompare?.(topPick ? [topPick, ...compareList] : compareList)}
              disabled={compareList.length < 1}
              className="bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium px-3 py-1 rounded-full transition-colors disabled:opacity-50"
            >
              Compare now
            </button>
            <button
              onClick={() => { setCompareList([]); setShowCompareBar(false); }}
              className="p-1 hover:bg-white/10 dark:hover:bg-gray-900/10 rounded-full transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
