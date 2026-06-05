/**
 * CategorySphereFallback — Horizontal scrollable category list.
 *
 * Renders when:
 *  - WebGL unavailable
 *  - Device has < 4 CPU cores
 *  - FPS dropped below 40 after sphere started
 *
 * Zero Three.js dependency. Pure Tailwind + framer-motion.
 */

'use client';

import { useRef } from 'react';
import { motion } from 'framer-motion';

const CATEGORY_META: Record<string, { emoji: string; gradient: string }> = {
  Electronics: { emoji: '💻', gradient: 'from-violet-600 to-indigo-600' },
  Fashion: { emoji: '👗', gradient: 'from-pink-600 to-rose-500' },
  Groceries: { emoji: '🛒', gradient: 'from-emerald-600 to-teal-500' },
  'Home & Kitchen': { emoji: '🏠', gradient: 'from-amber-500 to-orange-500' },
  Sports: { emoji: '⚽', gradient: 'from-blue-600 to-sky-500' },
  Books: { emoji: '📚', gradient: 'from-purple-600 to-violet-500' },
  Clothing: { emoji: '👔', gradient: 'from-pink-500 to-fuchsia-500' },
  Shoes: { emoji: '👟', gradient: 'from-cyan-600 to-blue-500' },
  Toys: { emoji: '🧸', gradient: 'from-red-500 to-orange-400' },
  Beauty: { emoji: '💄', gradient: 'from-rose-500 to-pink-400' },
  Automotive: { emoji: '🚗', gradient: 'from-gray-700 to-gray-500' },
  Garden: { emoji: '🌱', gradient: 'from-green-600 to-lime-500' },
};

const DEFAULT_META = { emoji: '🏷️', gradient: 'from-slate-600 to-gray-500' };

export interface CategorySphereFallbackProps {
  categories: Array<{ name: string; count: number }>;
  selectedCategory: string | null;
  onCategorySelect: (name: string) => void;
}

export function CategorySphereFallback({
  categories,
  selectedCategory,
  onCategorySelect,
}: CategorySphereFallbackProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <section
      data-testid="sphere-fallback"
      aria-label="Category browser"
      className="w-full py-4 px-4"
    >
      <div className="flex items-center gap-3 mb-3">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
          Browse by Category
        </span>
        <span className="flex-1 h-px bg-slate-200 dark:bg-gray-700" />
        {selectedCategory && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={() => onCategorySelect('')}
            className="text-[10px] px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-300 font-semibold border border-violet-200/60 hover:bg-violet-200 transition-colors"
          >
            Clear ×
          </motion.button>
        )}
      </div>

      {/* Horizontal scrollable chips */}
      <div
        ref={scrollRef}
        className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {categories.map((cat, i) => {
          const meta = CATEGORY_META[cat.name] ?? DEFAULT_META;
          const isActive = cat.name === selectedCategory;

          return (
            <motion.button
              key={cat.name}
              data-testid={`category-chip-${cat.name.replace(/\s+/g, '-').toLowerCase()}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04, type: 'spring', stiffness: 300, damping: 25 }}
              onClick={() => onCategorySelect(cat.name)}
              className={`
                flex-shrink-0 snap-start flex items-center gap-2 px-4 py-2.5 rounded-2xl
                text-sm font-semibold transition-all duration-200
                focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500
                ${isActive
                  ? `bg-gradient-to-r ${meta.gradient} text-white shadow-lg shadow-violet-500/30 scale-105`
                  : 'bg-white dark:bg-gray-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-gray-700 hover:border-violet-300 hover:shadow-md hover:scale-102'
                }
              `}
              aria-pressed={isActive}
            >
              <span className="text-lg leading-none">{meta.emoji}</span>
              <span className="whitespace-nowrap">{cat.name}</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-normal ${
                  isActive
                    ? 'bg-white/25 text-white'
                    : 'bg-slate-100 dark:bg-gray-700 text-slate-500 dark:text-slate-400'
                }`}
              >
                {cat.count >= 1000 ? `${Math.round(cat.count / 1000)}k` : cat.count}
              </span>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}
