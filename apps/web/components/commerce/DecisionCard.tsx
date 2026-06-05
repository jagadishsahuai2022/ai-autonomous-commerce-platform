'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, TrendingUp, Star, Zap } from 'lucide-react';
import Image from 'next/image';
import { ProgressBar } from '@/components/shared/ProgressBar';
import { cn } from '@/lib/utils/cn';

export interface DecisionCardProps {
  product: {
    id: string;
    name: string;
    image?: string;
    price: number;
    rating?: number;
  };
  reasoning: string[];
  confidence: number;
  onApprove: () => void;
  onReject?: () => void;
  onModify?: () => void;
  className?: string;
}

export function DecisionCard({
  product,
  reasoning,
  confidence,
  onApprove,
  onReject,
  onModify,
  className = '',
}: DecisionCardProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);

  const confidenceColor = 
    confidence >= 0.8 ? 'from-green-500 to-emerald-500' :
    confidence >= 0.6 ? 'from-amber-500 to-orange-500' :
    'from-red-500 to-pink-500';

  const confidenceLabel = 
    confidence >= 0.8 ? 'Perfect Match' :
    confidence >= 0.6 ? 'Good Option' :
    'Consider';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.3 }}
      className={cn(
        'neon-box rounded-2xl overflow-hidden',
        'bg-gradient-to-br from-white to-gray-50',
        'dark:from-slate-800 dark:to-slate-900',
        'border border-primary-200/50 dark:border-primary-500/20',
        'shadow-lg hover:shadow-[0_0_30px_rgba(99,102,241,0.2)]',
        'transition-all duration-300',
        className
      )}
    >
      <div className="p-6 space-y-4">
        {/* Product Header */}
        <div className="flex gap-4 items-start">
          {product.image && (
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800"
            >
              <Image
                src={product.image}
                alt={product.name}
                width={80}
                height={80}
                className="w-full h-full object-cover"
              />
            </motion.div>
          )}

          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white truncate mb-1">{product.name}</h3>
            <div className="flex items-center gap-3 flex-wrap text-sm">
              <span className="text-2xl font-bold text-primary-600 dark:text-primary-400">₹{product.price?.toLocaleString('en-IN')}</span>
              {product.rating && (
                <div className="flex items-center gap-1 bg-amber-50 dark:bg-amber-900/30 px-2 py-1 rounded-full">
                  <Star size={14} className="text-amber-500 fill-amber-500" />
                  <span className="font-semibold text-amber-700 dark:text-amber-300">{product.rating}</span>
                </div>
              )}
            </div>
          </div>

          {/* Confidence Badge */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className={cn(
              'flex-shrink-0 px-3 py-2 rounded-full',
              'bg-gradient-to-r', confidenceColor,
              'text-white text-xs font-bold flex items-center gap-1',
              'shadow-lg'
            )}
          >
            <CheckCircle2 size={16} />
            <span>{Math.round(confidence * 100)}%</span>
          </motion.div>
        </div>

        {/* AI Reasoning */}
        <motion.div
          initial={false}
          animate={{ height: isExpanded ? 'auto' : '80px' }}
          className="overflow-hidden border-t border-gray-200 dark:border-gray-700 pt-4"
        >
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-3 flex items-center gap-2">
            <Zap size={14} className="text-primary-600 dark:text-primary-400" />
            Why This Product?
          </h4>
          <ul className="space-y-2">
            {reasoning.map((reason, idx) => (
              <motion.li
                key={idx}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="flex gap-2 text-sm text-gray-700 dark:text-gray-300"
              >
                <span className="text-primary-500 dark:text-primary-400 font-bold">•</span>
                <span>{reason}</span>
              </motion.li>
            ))}
          </ul>
        </motion.div>

        {/* Expand Toggle */}
        {reasoning.length > 3 && (
          <motion.button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full text-xs font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors py-1"
          >
            {isExpanded ? 'Show Less' : `Show All (${reasoning.length})`}
          </motion.button>
        )}

        {/* Confidence Progress Bar */}
        <div className="space-y-2 border-t border-gray-200 dark:border-gray-700 pt-4">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-gray-700 dark:text-gray-300">AI Confidence</span>
            <span className="text-primary-600 dark:text-primary-400 font-bold">{confidenceLabel}</span>
          </div>
          <ProgressBar value={confidence} max={1} showPercentage={false} animated />
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-3 gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
          {onReject && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onReject}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Reject
            </motion.button>
          )}

          {onModify && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onModify}
              className="px-3 py-2 rounded-lg border border-primary-300 dark:border-primary-600 text-primary-700 dark:text-primary-300 font-semibold text-sm hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
            >
              Modify
            </motion.button>
          )}

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onApprove}
            className="col-span={onReject && onModify ? 1 : 2} px-4 py-2 rounded-lg bg-gradient-to-r from-primary-600 to-accent-500 text-white font-semibold text-sm shadow-lg hover:shadow-ai-glow transition-all active:scale-95"
          >
            Approve
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
