'use client';

import { motion } from 'framer-motion';
import { Trophy, Star, Truck, TrendingUp, TrendingDown, Minus, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RankedProduct } from '@/types/shopping-assistant';

interface ComparisonTableProps {
  products: RankedProduct[];
  highlightTopPick?: boolean;
  className?: string;
}

interface ComparisonRow {
  label: string;
  getValue: (p: RankedProduct) => string | number;
  isBetter?: (a: string | number, b: string | number) => boolean; // returns true if a > b
  format?: (v: string | number) => string;
  highlight?: boolean;
}

const ROWS: ComparisonRow[] = [
  {
    label: 'Price',
    getValue: (p) => p.product.price,
    isBetter: (a, b) => Number(a) < Number(b), // lower is better
    format: (v) => `₹${Number(v).toLocaleString('en-IN')}`,
    highlight: true,
  },
  {
    label: 'AI Score',
    getValue: (p) => Math.round(p.score * 100),
    isBetter: (a, b) => Number(a) > Number(b),
    format: (v) => `${v}/100`,
    highlight: true,
  },
  {
    label: 'Confidence',
    getValue: (p) => Math.round(p.confidence * 100),
    isBetter: (a, b) => Number(a) > Number(b),
    format: (v) => `${v}%`,
  },
  {
    label: 'Rating',
    getValue: (p) => p.product.rating,
    isBetter: (a, b) => Number(a) > Number(b),
    format: (v) => `★ ${v}`,
  },
  {
    label: 'Reviews',
    getValue: (p) => p.product.review_count,
    isBetter: (a, b) => Number(a) > Number(b),
    format: (v) => Number(v).toLocaleString(),
  },
  {
    label: 'Delivery',
    getValue: (p) => p.product.delivery_time,
    format: (v) => String(v),
  },
  {
    label: 'Brand',
    getValue: (p) => p.product.brand,
    format: (v) => String(v),
  },
  {
    label: 'Budget fit',
    getValue: (p) => Math.round(p.explanation.budget_fit_score.score * 100),
    isBetter: (a, b) => Number(a) > Number(b),
    format: (v) => `${v}%`,
  },
  {
    label: 'Quality',
    getValue: (p) => Math.round(p.explanation.quality_score.score * 100),
    isBetter: (a, b) => Number(a) > Number(b),
    format: (v) => `${v}%`,
  },
];

function WinnerIndicator({ isWinner }: { isWinner: boolean }) {
  if (!isWinner) return null;
  return (
    <motion.span
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      className="inline-flex items-center justify-center w-4 h-4 bg-violet-100 dark:bg-violet-900/50 rounded-full ml-1"
    >
      <Check className="w-2.5 h-2.5 text-violet-600 dark:text-violet-400" />
    </motion.span>
  );
}

export function ComparisonTable({
  products,
  highlightTopPick = true,
  className,
}: ComparisonTableProps) {
  if (products.length < 2) return null;

  // Find top pick (rank 1 or highest score)
  const topPickId = products.reduce((best, p) =>
    p.score > best.score ? p : best, products[0]).product.id;

  return (
    <div className={cn('bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden', className)}>
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-500" />
          Product Comparison
        </h3>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{products.length} products compared</p>
      </div>

      {/* Scrollable table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-max">
          {/* Product names row */}
          <thead>
            <tr className="border-b border-gray-50 dark:border-gray-800">
              <th className="text-left p-3 pl-5 w-28 sticky left-0 bg-white dark:bg-gray-900 z-10">
                <span className="text-xs text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wide">Feature</span>
              </th>
              {products.map((p, i) => {
                const isTop = highlightTopPick && p.product.id === topPickId;
                return (
                  <th
                    key={p.product.id}
                    className={cn(
                      'p-3 text-left min-w-[160px]',
                      isTop && 'bg-violet-50 dark:bg-violet-950/20'
                    )}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      {isTop && <Trophy className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
                      <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 line-clamp-2">
                        {p.product.name}
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500">{p.product.brand}</span>
                    {isTop && (
                      <div className="mt-1">
                        <span className="text-[10px] font-semibold text-violet-600 dark:text-violet-400 bg-violet-100 dark:bg-violet-900/40 px-1.5 py-0.5 rounded-full">
                          AI Top Pick
                        </span>
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Data rows */}
          <tbody>
            {ROWS.map((row, rowIdx) => {
              const values = products.map((p) => row.getValue(p));
              const numericValues = values.map((v) => Number(v));

              // Find best value for this row
              let bestIdx = -1;
              if (row.isBetter) {
                bestIdx = values.reduce<number>((best, val, i) => {
                  if (best === -1) return i;
                  return row.isBetter!(val, values[best]) ? i : best;
                }, -1);
              }

              return (
                <motion.tr
                  key={row.label}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: rowIdx * 0.04 }}
                  className={cn(
                    'border-b border-gray-50 dark:border-gray-800/50 last:border-0',
                    row.highlight && 'bg-gray-50/50 dark:bg-gray-800/20'
                  )}
                >
                  <td className="p-3 pl-5 text-xs font-medium text-gray-500 dark:text-gray-400 sticky left-0 bg-white dark:bg-gray-900 whitespace-nowrap">
                    {row.label}
                  </td>
                  {products.map((p, colIdx) => {
                    const val = values[colIdx];
                    const formattedVal = row.format ? row.format(val) : String(val);
                    const isTop = highlightTopPick && p.product.id === topPickId;
                    const isBest = bestIdx === colIdx;

                    return (
                      <td
                        key={p.product.id}
                        className={cn(
                          'p-3 text-xs',
                          isTop && 'bg-violet-50/50 dark:bg-violet-950/10'
                        )}
                      >
                        <div className="flex items-center gap-1">
                          <span
                            className={cn(
                              'font-medium',
                              isBest
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-gray-600 dark:text-gray-400'
                            )}
                          >
                            {formattedVal}
                          </span>
                          {isBest && row.isBetter && (
                            <TrendingUp className="w-3 h-3 text-green-500" />
                          )}
                          <WinnerIndicator isWinner={isBest && !!row.isBetter} />
                        </div>
                      </td>
                    );
                  })}
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Summary row */}
      <div className="px-5 py-3 bg-gray-50 dark:bg-gray-800/30 border-t border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-3.5 h-3.5 text-green-500" />
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Green values indicate the better option in each category
          </span>
        </div>
      </div>
    </div>
  );
}
