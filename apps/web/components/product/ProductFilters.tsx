'use client';

import React from 'react';
import { ChevronDown, X, RotateCcw } from 'lucide-react';
import type { CategoryItem } from '@/services/product.service';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FilterState {
  categories: string[];    // multi-select category names (exact match, case-sensitive)
  rating: string | null;   // '4plus' | '3plus' | '2plus' | null
  priceMin: number;
  priceMax: number;
  discountRange: string[]; // '50plus' | '30plus' | '10plus'
  deliveryOptions: string[]; // 'free' | 'express' | 'cod'
}

export const INITIAL_FILTER_STATE: FilterState = {
  categories: [],
  rating: null,
  priceMin: 0,
  priceMax: 500000,
  discountRange: [],
  deliveryOptions: [],
};

interface ProductFiltersProps {
  isOpen?: boolean;
  onClose?: () => void;

  // Unified controlled filter state (lives in page — NOT inside this component)
  filterState: FilterState;
  onFilterChange: (next: FilterState) => void;

  // Dynamic categories from API
  categories?: CategoryItem[];
  categoriesLoading?: boolean;
}

// ─── Static filter options ────────────────────────────────────────────────────

const RATING_OPTIONS = [
  { id: '4plus', label: '4★ & above' },
  { id: '3plus', label: '3★ & above' },
  { id: '2plus', label: '2★ & above' },
];

const DISCOUNT_OPTIONS = [
  { id: '50plus', label: '50% or more' },
  { id: '30plus', label: '30% – 50%' },
  { id: '10plus', label: '10% – 30%' },
];

// Map to real product data fields
const DELIVERY_OPTIONS = [
  { id: 'free',    label: 'Free Delivery',    hint: '(Price > ₹499)' },
  { id: 'express', label: 'Express Delivery', hint: '(≤ 2 days)' },
  { id: 'cod',     label: 'Cash on Delivery', hint: '' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function ProductFilters({
  isOpen = true,
  onClose,
  filterState,
  onFilterChange,
  categories = [],
  categoriesLoading = false,
}: ProductFiltersProps) {
  const [expandedGroups, setExpandedGroups] = React.useState<Record<string, boolean>>({
    price: true,
    category: true,
    rating: true,
    delivery: false,
    discount: false,
  });

  const toggleGroup = (key: string) => setExpandedGroups(p => ({ ...p, [key]: !p[key] }));

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const toggleCategory = (name: string) => {
    const next = filterState.categories.includes(name)
      ? filterState.categories.filter(c => c !== name)
      : [...filterState.categories, name];
    onFilterChange({ ...filterState, categories: next });
  };

  const setRating = (id: string) => {
    onFilterChange({
      ...filterState,
      rating: filterState.rating === id ? null : id,
    });
  };

  const toggleDiscount = (id: string) => {
    const next = filterState.discountRange.includes(id)
      ? filterState.discountRange.filter(d => d !== id)
      : [...filterState.discountRange, id];
    onFilterChange({ ...filterState, discountRange: next });
  };

  const toggleDelivery = (id: string) => {
    const next = filterState.deliveryOptions.includes(id)
      ? filterState.deliveryOptions.filter(d => d !== id)
      : [...filterState.deliveryOptions, id];
    onFilterChange({ ...filterState, deliveryOptions: next });
  };

  const clearAll = () => onFilterChange({ ...INITIAL_FILTER_STATE });

  const activeCount = (
    filterState.categories.length +
    (filterState.rating ? 1 : 0) +
    filterState.discountRange.length +
    filterState.deliveryOptions.length +
    (filterState.priceMin > 0 || filterState.priceMax < 500000 ? 1 : 0)
  );

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Panel */}
      <div
        role="dialog"
        aria-label="Product filters"
        className={`fixed lg:relative inset-y-0 left-0 z-50 lg:z-0 w-72 bg-gray-900
          border-r border-white/10 transform transition-transform duration-300
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 sticky top-0 bg-gray-900 z-10">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-white text-sm">Filters</h2>
            {activeCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-violet-500 text-white text-[10px] font-bold">
                {activeCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {activeCount > 0 && (
              <button
                onClick={clearAll}
                title="Clear all filters"
                className="flex items-center gap-1 px-2 py-1 text-[11px] text-violet-400 hover:bg-violet-900/20 rounded-lg transition-colors font-medium"
              >
                <RotateCcw size={11} />
                Clear all
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/10 rounded-lg lg:hidden text-gray-400 hover:text-white transition-colors"
              aria-label="Close filters"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── Scrollable content ── */}
        <div className="overflow-y-auto h-[calc(100%-56px)] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full">
          <div className="p-3 space-y-1">

            {/* ── Price ── */}
            <FilterGroup title="Price" groupKey="price" expanded={!!expandedGroups.price} onToggle={toggleGroup}>
              <div className="space-y-3 pt-1">
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] text-gray-400 font-medium">MIN</label>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-xs text-gray-500">₹</span>
                      <input
                        type="number"
                        min={0}
                        max={filterState.priceMax - 1}
                        step={500}
                        value={filterState.priceMin}
                        onChange={e => onFilterChange({ ...filterState, priceMin: Math.min(Number(e.target.value), filterState.priceMax - 1) })}
                        className="w-full text-xs border border-white/10 rounded-lg px-2 py-1.5 bg-gray-800/80 text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                      />
                    </div>
                  </div>
                  <span className="text-gray-600 mt-4">—</span>
                  <div className="flex-1">
                    <label className="text-[10px] text-gray-400 font-medium">MAX</label>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-xs text-gray-500">₹</span>
                      <input
                        type="number"
                        min={filterState.priceMin + 1}
                        max={500000}
                        step={500}
                        value={filterState.priceMax}
                        onChange={e => onFilterChange({ ...filterState, priceMax: Math.max(Number(e.target.value), filterState.priceMin + 1) })}
                        className="w-full text-xs border border-white/10 rounded-lg px-2 py-1.5 bg-gray-800/80 text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <input
                    type="range"
                    min={0}
                    max={500000}
                    step={1000}
                    value={filterState.priceMin}
                    onChange={e => onFilterChange({ ...filterState, priceMin: Math.min(Number(e.target.value), filterState.priceMax - 1000) })}
                    className="w-full accent-violet-500"
                    aria-label="Minimum price"
                  />
                  <input
                    type="range"
                    min={0}
                    max={500000}
                    step={1000}
                    value={filterState.priceMax}
                    onChange={e => onFilterChange({ ...filterState, priceMax: Math.max(Number(e.target.value), filterState.priceMin + 1000) })}
                    className="w-full accent-violet-500"
                    aria-label="Maximum price"
                  />
                </div>
                <div className="flex justify-between text-[10px] text-gray-500">
                  <span>₹{filterState.priceMin.toLocaleString('en-IN')}</span>
                  <span>₹{filterState.priceMax.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </FilterGroup>

            {/* ── Category ── */}
            <FilterGroup title="Category" groupKey="category" expanded={!!expandedGroups.category} onToggle={toggleGroup}>
              {categoriesLoading ? (
                <div className="space-y-2 py-1">
                  {[1, 2, 3, 4].map(n => (
                    <div key={n} className="h-4 rounded bg-white/10 animate-pulse" style={{ width: `${60 + n * 8}%` }} />
                  ))}
                </div>
              ) : (
                <div className="space-y-1 max-h-48 overflow-y-auto [&::-webkit-scrollbar]:w-0.5">
                  {categories.map(cat => (
                    <CheckboxRow
                      key={cat.name}
                      id={`cat-${cat.name}`}
                      label={cat.name}
                      count={cat.count}
                      checked={filterState.categories.includes(cat.name)}
                      onChange={() => toggleCategory(cat.name)}
                    />
                  ))}
                </div>
              )}
            </FilterGroup>

            {/* ── Rating ── */}
            <FilterGroup title="Rating" groupKey="rating" expanded={!!expandedGroups.rating} onToggle={toggleGroup}>
              <div className="space-y-1">
                {RATING_OPTIONS.map(opt => (
                  <CheckboxRow
                    key={opt.id}
                    id={`rating-${opt.id}`}
                    label={opt.label}
                    checked={filterState.rating === opt.id}
                    onChange={() => setRating(opt.id)}
                    type="radio"
                  />
                ))}
              </div>
            </FilterGroup>

            {/* ── Discount ── */}
            <FilterGroup title="Discount" groupKey="discount" expanded={!!expandedGroups.discount} onToggle={toggleGroup}>
              <div className="space-y-1">
                {DISCOUNT_OPTIONS.map(opt => (
                  <CheckboxRow
                    key={opt.id}
                    id={`disc-${opt.id}`}
                    label={opt.label}
                    checked={filterState.discountRange.includes(opt.id)}
                    onChange={() => toggleDiscount(opt.id)}
                  />
                ))}
              </div>
            </FilterGroup>

            {/* ── Delivery ── */}
            <FilterGroup title="Delivery" groupKey="delivery" expanded={!!expandedGroups.delivery} onToggle={toggleGroup}>
              <div className="space-y-1">
                {DELIVERY_OPTIONS.map(opt => (
                  <CheckboxRow
                    key={opt.id}
                    id={`del-${opt.id}`}
                    label={opt.label}
                    hint={opt.hint}
                    checked={filterState.deliveryOptions.includes(opt.id)}
                    onChange={() => toggleDelivery(opt.id)}
                  />
                ))}
              </div>
            </FilterGroup>

          </div>
        </div>
      </div>
    </>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FilterGroup({
  title,
  groupKey,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  groupKey: string;
  expanded: boolean;
  onToggle: (key: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-white/10 last:border-0 pb-3 last:pb-0">
      <button
        type="button"
        onClick={() => onToggle(groupKey)}
        className="w-full flex items-center justify-between py-2.5 font-semibold text-sm text-gray-200 hover:text-violet-400 transition-colors"
        aria-expanded={expanded}
      >
        {title}
        <ChevronDown
          size={15}
          className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        />
      </button>
      {expanded && <div className="pb-1">{children}</div>}
    </div>
  );
}

function CheckboxRow({
  id,
  label,
  count,
  checked,
  onChange,
  type = 'checkbox',
  hint,
}: {
  id: string;
  label: string;
  count?: number;
  hint?: string;
  checked: boolean;
  onChange: () => void;
  type?: 'checkbox' | 'radio';
}) {
  return (
    <label
      htmlFor={id}
      className={`flex items-center gap-2.5 cursor-pointer px-1 py-1.5 rounded-lg transition-colors group
        ${checked
          ? 'text-violet-300 bg-violet-900/25'
          : 'text-gray-300 hover:bg-white/10'
        }`}
    >
      <input
        id={id}
        type={type}
        name={type === 'radio' ? 'rating' : id}
        checked={checked}
        onChange={onChange}
        className="w-3.5 h-3.5 cursor-pointer accent-violet-600 flex-shrink-0"
      />
      <span className="text-xs font-medium flex-1">{label}</span>
      {hint && <span className="text-[10px] text-gray-500">{hint}</span>}
      {count != null && (
        <span className="text-[10px] text-gray-500 ml-auto">
          ({count >= 1000 ? `${Math.round(count / 1000)}K` : count})
        </span>
      )}
    </label>
  );
}

export default ProductFilters;

