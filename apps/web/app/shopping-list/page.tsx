'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Trash2,
  Send,
  ShoppingCart,
  Loader2,
  CheckCircle,
  ShieldCheck,
  AlertCircle,
  ListChecks,
  Sparkles,
  Mail,
  MessageSquare,
  X,
  Zap,
  Tag,
  Layers,
  Search,
  ChevronDown,
} from 'lucide-react';
import Link from 'next/link';
import { notifyOrderSuccess, notifyOrderFailed } from '@/lib/notifications';

// ── Lookup Types ─────────────────────────────────────────────────────────────

interface LookupItem {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  productCount: number;
  categoryId?: number;
  categoryName?: string;
  tagType?: string;
}

// ── Types ────────────────────────────────────────────────────────────────────

interface ShoppingListItem {
  id: string;
  productName: string;           // mandatory, alphanumeric
  preferredBrand: string;        // optional, alphanumeric
  budget: string;                // optional, numeric only
  quantity: string;              // mandatory, numeric only
  deliveryDays: string;          // optional, numeric only
  paymentMethod: string;         // optional
  emiOnly: boolean;              // optional
  attributes: Array<{ key: string; value: string }>;  // specific traits/attributes, max 10
  categoryId: string;              // optional selected category ID
  categoryName: string;            // optional category display name
  subCategoryId: string;           // optional selected subcategory ID
  subCategoryName: string;         // optional subcategory display name
  tagIds: number[];                // optional selected tag IDs
  tagNames: string[];              // optional tag display names
}

interface ShoppingListState {
  items: ShoppingListItem[];
  status: 'idle' | 'submitting' | 'submitted' | 'error';
  error: string | null;
}

const PAYMENT_METHODS = [
  { value: '', label: 'Any' },
  { value: 'wallet', label: 'Wallet' },
  { value: 'upi', label: 'UPI' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'debit_card', label: 'Debit Card' },
  { value: 'net_banking', label: 'Net Banking' },
  { value: 'cod', label: 'Cash on Delivery' },
  { value: 'emi', label: 'EMI' },
];

function createEmptyItem(): ShoppingListItem {
  return {
    id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    productName: '',
    preferredBrand: '',
    budget: '',
    quantity: '1',
    deliveryDays: '',
    paymentMethod: '',
    emiOnly: false,
    attributes: [],
    categoryId: '',
    categoryName: '',
    subCategoryId: '',
    subCategoryName: '',
    tagIds: [],
    tagNames: [],
  };
}

// ── Debounced Lookup Hook ────────────────────────────────────────────────────

function useLookup(type: string, query: string, extraParams?: Record<string, string>) {
  const [items, setItems] = useState<LookupItem[]>([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Clear previous timer
    if (timerRef.current) clearTimeout(timerRef.current);
    if (abortRef.current) abortRef.current.abort();

    // Need at least 2 chars OR empty for initial load of categories
    if (query.length > 0 && query.length < 2) {
      setItems([]);
      return;
    }

    // Debounce 300ms
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const params = new URLSearchParams({ type, limit: '20' });
        if (query.length >= 2) params.set('q', query);
        if (extraParams) {
          for (const [k, v] of Object.entries(extraParams)) {
            if (v) params.set(k, v);
          }
        }
        const res = await fetch(`/api/lookup?${params.toString()}`, { signal: controller.signal });
        if (!res.ok) throw new Error('Lookup failed');
        const data = await res.json();
        setItems(data.items || []);
      } catch (err: unknown) {
        if ((err as Error).name !== 'AbortError') setItems([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [type, query, extraParams ? JSON.stringify(extraParams) : '']);

  return { items, loading };
}

// ── Validation ───────────────────────────────────────────────────────────────

function validateItem(item: ShoppingListItem): string | null {
  if (!item.productName.trim()) return 'Product name is required';
  // Allow letters, digits, spaces, hyphens, dots — covers model names like "WH-1000XM5"
  if (!/^[a-zA-Z0-9 \-\.]+$/.test(item.productName.trim())) return 'Product name: use letters, numbers, spaces, hyphens or dots only';
  if (item.preferredBrand && !/^[a-zA-Z0-9 \-]*$/.test(item.preferredBrand)) return 'Brand name must be alphanumeric';
  if (item.budget && !/^\d+$/.test(item.budget)) return 'Budget must be numeric';
  if (!item.quantity.trim() || !/^\d+$/.test(item.quantity) || parseInt(item.quantity) < 1) return 'Quantity must be at least 1';
  if (item.deliveryDays && !/^\d+$/.test(item.deliveryDays)) return 'Delivery days must be numeric';
  return null;
}

// ── Free-text input with suggestion autocomplete ──────────────────────────────
// Unlike SearchableDropdown (which forces a selection), this component allows
// free-text entry AND shows suggestions from the lookup API (2+ chars trigger).

function AutocompleteInput({
  value,
  onChange,
  type,
  placeholder,
  label,
  required,
  sanitize,
}: {
  value: string;
  onChange: (val: string) => void;
  type: 'productNames' | 'brands';
  placeholder: string;
  label: string;
  required?: boolean;
  sanitize?: (val: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { items, loading } = useLookup(type, value);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const showDropdown = open && value.length >= 2 && (loading || items.length > 0);

  return (
    <div ref={wrapperRef} className="relative">
      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={e => {
            const raw = sanitize ? sanitize(e.target.value) : e.target.value;
            onChange(raw);
            setOpen(true);
          }}
          onFocus={() => { if (value.length >= 2) setOpen(true); }}
          placeholder={placeholder}
          className="w-full px-3 py-2 pr-8 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          autoComplete="off"
        />
        {loading && value.length >= 2 && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 animate-spin" />
        )}
      </div>
      {showDropdown && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-48 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-3 text-xs text-slate-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Searching...
            </div>
          ) : items.length === 0 ? (
            <div className="py-3 text-center text-xs text-slate-400">No suggestions found</div>
          ) : (
            items.map((item) => (
              <button
                key={`${item.id}-${item.name}`}
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => { onChange(item.name); setOpen(false); }}
                className="w-full px-3 py-2 text-left hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors border-b border-slate-50 dark:border-slate-700/50 last:border-b-0"
              >
                <div className="text-xs font-medium text-slate-800 dark:text-slate-200">{item.name}</div>
                <div className="text-[10px] text-slate-400">{item.productCount} product{item.productCount !== 1 ? 's' : ''}</div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Searchable Autocomplete Dropdown ─────────────────────────────────────────

function SearchableDropdown({
  label,
  icon: Icon,
  placeholder,
  value,
  displayValue,
  type,
  extraParams,
  onSelect,
  onClear,
  disabled,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  placeholder: string;
  value: string | number;
  displayValue: string;
  type: string;
  extraParams?: Record<string, string>;
  onSelect: (item: LookupItem) => void;
  onClear: () => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { items, loading } = useLookup(type, search, extraParams);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Load initial items when dropdown opens with no search
  const handleOpen = () => {
    if (disabled) return;
    setOpen(true);
    setSearch('');
  };

  return (
    <div ref={wrapperRef} className="relative">
      <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1">
        <Icon className="w-3 h-3" /> {label}
      </label>
      {value ? (
        <div className="flex items-center gap-1 w-full px-3 py-2 border border-blue-300 dark:border-blue-600 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-sm">
          <span className="flex-1 truncate text-blue-700 dark:text-blue-300 font-medium">{displayValue}</span>
          <button type="button" onClick={onClear} className="p-0.5 text-blue-400 hover:text-red-500 transition-colors" title="Clear">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleOpen}
          disabled={disabled}
          className={`flex items-center gap-2 w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm text-slate-400 dark:text-slate-500 hover:border-blue-400 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <Search className="w-3.5 h-3.5" />
          <span className="flex-1 text-left truncate">{placeholder}</span>
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      )}
      {open && !value && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-56 overflow-hidden">
          <div className="p-2 border-b border-slate-100 dark:border-slate-700">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Type 2+ chars to search..."
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded bg-slate-50 dark:bg-slate-700 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              autoFocus
            />
          </div>
          <div className="overflow-y-auto max-h-44">
            {loading ? (
              <div className="flex items-center justify-center py-4 text-xs text-slate-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Searching...
              </div>
            ) : items.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-400">
                {search.length > 0 && search.length < 2 ? 'Type at least 2 characters' : 'No results found'}
              </div>
            ) : (
              items.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => { onSelect(item); setOpen(false); setSearch(''); }}
                  className="w-full px-3 py-2 text-left hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors border-b border-slate-50 dark:border-slate-700/50 last:border-b-0"
                >
                  <div className="text-xs font-medium text-slate-800 dark:text-slate-200">{item.name}</div>
                  <div className="text-[10px] text-slate-400 flex items-center gap-2">
                    {item.tagType && <span className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">{item.tagType}</span>}
                    {item.categoryName && <span>in {item.categoryName}</span>}
                    <span>{item.productCount.toLocaleString('en-IN')} products</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Multi-Select Tag Picker ──────────────────────────────────────────────────

function TagPicker({
  selectedIds,
  selectedNames,
  onAdd,
  onRemove: onRemoveTag,
}: {
  selectedIds: number[];
  selectedNames: string[];
  onAdd: (item: LookupItem) => void;
  onRemove: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { items, loading } = useLookup('tags', search);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const available = useMemo(() => items.filter(i => !selectedIds.includes(i.id)), [items, selectedIds]);

  return (
    <div ref={wrapperRef} className="relative">
      {/* Clickable header — opens/closes the tag picker dropdown */}
      <button
        type="button"
        onClick={() => { setOpen(prev => !prev); setSearch(''); }}
        className="w-full flex items-center justify-between mb-1 group"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          <Tag className="w-3 h-3" /> Tags
          <span className={`font-normal transition-colors ${selectedIds.length > 0 ? 'text-blue-600 dark:text-blue-400 font-semibold' : 'text-slate-400'}`}>
            ({selectedIds.length} selected)
          </span>
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500 transition-all duration-200 ${open ? 'rotate-180 text-blue-500' : ''}`} />
      </button>
      {/* Selected tag chips */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-1">
          {selectedIds.map((id, idx) => (
            <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full border border-blue-200 dark:border-blue-700">
              {selectedNames[idx]}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onRemoveTag(id); }}
                className="hover:text-red-500 transition-colors ml-0.5"
                title={`Remove ${selectedNames[idx]}`}
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      {/* Hint text when no tags selected and closed */}
      {selectedIds.length === 0 && !open && (
        <p className="text-[10px] text-slate-400 dark:text-slate-500 italic">Click to add tags to refine search</p>
      )}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-56 overflow-hidden">
          <div className="p-2 border-b border-slate-100 dark:border-slate-700">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search tags (2+ chars)..."
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded bg-slate-50 dark:bg-slate-700 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              autoFocus
            />
          </div>
          <div className="overflow-y-auto max-h-44">
            {loading ? (
              <div className="flex items-center justify-center py-4 text-xs text-slate-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Searching...
              </div>
            ) : available.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-400">
                {search.length > 0 && search.length < 2 ? 'Type at least 2 characters' : 'No more tags found'}
              </div>
            ) : (
              available.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => { onAdd(item); setSearch(''); }}
                  className="w-full px-3 py-2 text-left hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors border-b border-slate-50 dark:border-slate-700/50 last:border-b-0"
                >
                  <div className="text-xs font-medium text-slate-800 dark:text-slate-200">{item.name}</div>
                  <div className="text-[10px] text-slate-400 flex items-center gap-2">
                    {item.tagType && <span className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">{item.tagType}</span>}
                    <span>{item.productCount.toLocaleString('en-IN')} products</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Item Row Component ───────────────────────────────────────────────────────

function ShoppingListItemRow({
  item,
  index,
  onChange,
  onRemove,
  onAttributeChange,
  onCategoryChange,
  onSubCategoryChange,
  onTagAdd,
  onTagRemove,
  validationError,
  autoCheckout,
}: {
  item: ShoppingListItem;
  index: number;
  onChange: (id: string, field: keyof ShoppingListItem, value: string | boolean) => void;
  onRemove: (id: string) => void;
  onAttributeChange: (id: string, attributes: Array<{ key: string; value: string }>) => void;
  onCategoryChange: (id: string, categoryId: string, categoryName: string) => void;
  onSubCategoryChange: (id: string, subCategoryId: string, subCategoryName: string) => void;
  onTagAdd: (id: string, tagId: number, tagName: string) => void;
  onTagRemove: (id: string, tagId: number) => void;
  validationError: string | null;
  autoCheckout?: boolean;
}) {
  const [attrError, setAttrError] = useState<string | null>(null);

  const handleAddAttribute = () => {
    if (item.attributes.length >= 10) {
      setAttrError('Maximum 10 attributes allowed');
      return;
    }
    // Check if any existing attribute is empty
    const hasEmpty = item.attributes.some(a => !a.key.trim() || !a.value.trim());
    if (hasEmpty) {
      setAttrError('Fill all existing attribute fields before adding more');
      return;
    }
    setAttrError(null);
    onAttributeChange(item.id, [...item.attributes, { key: '', value: '' }]);
  };

  const handleAttrFieldChange = (idx: number, field: 'key' | 'value', val: string) => {
    setAttrError(null);
    const updated = [...item.attributes];
    updated[idx] = { ...updated[idx], [field]: val };
    onAttributeChange(item.id, updated);
  };

  const handleRemoveAttr = (idx: number) => {
    setAttrError(null);
    onAttributeChange(item.id, item.attributes.filter((_, i) => i !== idx));
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="border border-slate-200 dark:border-slate-700 rounded-xl p-5 bg-white dark:bg-slate-800 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex items-center justify-between mb-4">
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 dark:text-blue-400">
          <ShoppingCart className="w-4 h-4" />
          Item #{index + 1}
        </span>
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          title="Remove item"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Product Name (mandatory) — with autocomplete suggestions from DB */}
        <div className="sm:col-span-2 lg:col-span-1">
          <AutocompleteInput
            value={item.productName}
            onChange={val => onChange(item.id, 'productName', val)}
            type="productNames"
            placeholder="e.g., Washing Machine"
            label="Product Name"
            required
            sanitize={v => v.replace(/[^a-zA-Z0-9 \-\.]/g, '')}
          />
        </div>

        {/* Preferred Brand (optional) — with autocomplete suggestions from DB */}
        <div>
          <AutocompleteInput
            value={item.preferredBrand}
            onChange={val => onChange(item.id, 'preferredBrand', val)}
            type="brands"
            placeholder="e.g., Samsung"
            label="Preferred Brand"
            sanitize={v => v.replace(/[^a-zA-Z0-9 \-]/g, '')}
          />
        </div>

        {/* Budget (optional, numeric) */}
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            Budget (₹)
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={item.budget}
            onChange={(e) => onChange(item.id, 'budget', e.target.value.replace(/[^0-9]/g, ''))}
            placeholder="e.g., 25000"
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        {/* Quantity (mandatory, numeric) */}
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            Quantity <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={item.quantity}
            onChange={(e) => onChange(item.id, 'quantity', e.target.value.replace(/[^0-9]/g, ''))}
            placeholder="1"
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        {/* Delivery Days (optional, numeric) */}
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            Preferred Delivery (days)
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={item.deliveryDays}
            onChange={(e) => onChange(item.id, 'deliveryDays', e.target.value.replace(/[^0-9]/g, ''))}
            placeholder="e.g., 3"
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        {/* Payment Method (optional) */}
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            Payment Method
            {autoCheckout && <span className="ml-1 text-[10px] text-blue-600">(Wallet only)</span>}
          </label>
          <select
            value={autoCheckout ? 'wallet' : item.paymentMethod}
            onChange={(e) => onChange(item.id, 'paymentMethod', e.target.value)}
            disabled={autoCheckout}
            className={`w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none ${autoCheckout ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        {/* EMI Only (optional) */}
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={item.emiOnly}
              onChange={(e) => onChange(item.id, 'emiOnly', e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <span className="text-sm text-slate-600 dark:text-slate-400">EMI Only</span>
          </label>
        </div>
      </div>

      {/* Category / SubCategory / Tags — optional search refinement */}
      <div className="mt-4 border-t border-slate-100 dark:border-slate-700 pt-3">
        <div className="flex items-center gap-1.5 mb-3">
          <Layers className="w-3.5 h-3.5 text-indigo-500" />
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
            Search Refinement <span className="font-normal text-slate-400">(optional — improves result accuracy)</span>
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <SearchableDropdown
            label="Category"
            icon={Layers}
            placeholder="Select a category..."
            value={item.categoryId}
            displayValue={item.categoryName}
            type="categories"
            onSelect={(cat) => onCategoryChange(item.id, String(cat.id), cat.name)}
            onClear={() => onCategoryChange(item.id, '', '')}
          />
          <SearchableDropdown
            label="SubCategory"
            icon={Layers}
            placeholder={item.categoryId ? 'Select subcategory...' : 'Select category first'}
            value={item.subCategoryId}
            displayValue={item.subCategoryName}
            type="subcategories"
            extraParams={item.categoryId ? { categoryId: item.categoryId } : undefined}
            onSelect={(sub) => onSubCategoryChange(item.id, String(sub.id), sub.name)}
            onClear={() => onSubCategoryChange(item.id, '', '')}
            disabled={!item.categoryId}
          />
          <div className="sm:col-span-2 lg:col-span-1">
            <TagPicker
              selectedIds={item.tagIds}
              selectedNames={item.tagNames}
              onAdd={(tag) => onTagAdd(item.id, tag.id, tag.name)}
              onRemove={(tagId) => onTagRemove(item.id, tagId)}
            />
          </div>
        </div>
      </div>

      {/* Specific Attributes/Traits (key-value pairs) */}
      <div className="mt-4 border-t border-slate-100 dark:border-slate-700 pt-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
            <Tag className="w-3 h-3" /> Specific Attributes ({item.attributes.length}/10)
          </span>
          <button type="button" onClick={handleAddAttribute}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium disabled:text-slate-400"
            disabled={item.attributes.length >= 10}>
            <Plus className="w-3 h-3" /> Add Attribute
          </button>
        </div>
        {item.attributes.map((attr, idx) => (
          <div key={idx} className="flex items-center gap-2 mb-2">
            <input type="text" value={attr.key} onChange={e => handleAttrFieldChange(idx, 'key', e.target.value)}
              placeholder="e.g., Color" className="flex-1 px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            <span className="text-slate-400 text-xs">=</span>
            <input type="text" value={attr.value} onChange={e => handleAttrFieldChange(idx, 'value', e.target.value)}
              placeholder="e.g., Silver" className="flex-1 px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            <button type="button" onClick={() => handleRemoveAttr(idx)} className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
        {attrError && (
          <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
            <AlertCircle className="w-3 h-3" /> {attrError}
          </p>
        )}
        {item.attributes.length === 0 && (
          <p className="text-xs text-slate-400 dark:text-slate-500 italic">
            Add specific traits like Color=Red, Size=XL, RAM=8GB to fine-tune search results
          </p>
        )}
      </div>

      {validationError && (
        <div className="mt-3 flex items-center gap-2 text-xs text-red-600">
          <AlertCircle className="w-3 h-3 flex-shrink-0" />
          {validationError}
        </div>
      )}
    </motion.div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function ShoppingListPage() {
  const [state, setState] = useState<ShoppingListState>({
    items: [createEmptyItem()],
    status: 'idle',
    error: null,
  });
  const [validationErrors, setValidationErrors] = useState<Record<string, string | null>>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [cacheInfo, setCacheInfo] = useState<string | null>(null);
  const [forceFresh, setForceFresh] = useState(false);
  const [autoCheckout, setAutoCheckout] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [hasShoppingActivity, setHasShoppingActivity] = useState(false);

  // Check if user has prior shopping activity (show validation chip only after a search)
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('shoppingListResults') || '[]');
      if (Array.isArray(saved) && saved.length > 0) setHasShoppingActivity(true);
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    const savedEnabled = localStorage.getItem('autoPurchaseEnabled') === 'true';
    const savedTerms =
      localStorage.getItem('profileTermsAccepted') === 'true' ||
      localStorage.getItem('shoppingListTermsAccepted') === 'true';
    if (savedEnabled) {
      setAutoCheckout(true);
      if (savedTerms) setTermsAccepted(true);
    }
  }, []);

  const handleChange = useCallback(
    (id: string, field: keyof ShoppingListItem, value: string | boolean) => {
      setState((prev) => ({
        ...prev,
        items: prev.items.map((item) =>
          item.id === id ? { ...item, [field]: value } : item
        ),
      }));
      // Clear validation error for this field
      setValidationErrors((prev) => ({ ...prev, [id]: null }));
    },
    []
  );

  const handleAttributeChange = useCallback(
    (id: string, attributes: Array<{ key: string; value: string }>) => {
      setState((prev) => ({
        ...prev,
        items: prev.items.map((item) =>
          item.id === id ? { ...item, attributes } : item
        ),
      }));
    },
    []
  );

  const handleCategoryChange = useCallback(
    (id: string, categoryId: string, categoryName: string) => {
      setState((prev) => ({
        ...prev,
        items: prev.items.map((item) =>
          item.id === id
            ? { ...item, categoryId, categoryName, subCategoryId: '', subCategoryName: '' }
            : item
        ),
      }));
    },
    []
  );

  const handleSubCategoryChange = useCallback(
    (id: string, subCategoryId: string, subCategoryName: string) => {
      setState((prev) => ({
        ...prev,
        items: prev.items.map((item) =>
          item.id === id ? { ...item, subCategoryId, subCategoryName } : item
        ),
      }));
    },
    []
  );

  const handleTagAdd = useCallback(
    (id: string, tagId: number, tagName: string) => {
      setState((prev) => ({
        ...prev,
        items: prev.items.map((item) =>
          item.id === id && !item.tagIds.includes(tagId)
            ? { ...item, tagIds: [...item.tagIds, tagId], tagNames: [...item.tagNames, tagName] }
            : item
        ),
      }));
    },
    []
  );

  const handleTagRemove = useCallback(
    (id: string, tagId: number) => {
      setState((prev) => ({
        ...prev,
        items: prev.items.map((item) => {
          if (item.id !== id) return item;
          const idx = item.tagIds.indexOf(tagId);
          if (idx === -1) return item;
          return {
            ...item,
            tagIds: item.tagIds.filter((_, i) => i !== idx),
            tagNames: item.tagNames.filter((_, i) => i !== idx),
          };
        }),
      }));
    },
    []
  );

  const handleAddItem = useCallback(() => {
    setState((prev) => ({ ...prev, items: [...prev.items, createEmptyItem()] }));
  }, []);

  const handleRemoveItem = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      items: prev.items.length > 1 ? prev.items.filter((i) => i.id !== id) : prev.items,
    }));
    setValidationErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const handleSubmit = async () => {
    // Validate all items
    const errors: Record<string, string | null> = {};
    let hasError = false;
    for (const item of state.items) {
      const err = validateItem(item);
      errors[item.id] = err;
      if (err) hasError = true;
    }
    setValidationErrors(errors);
    if (hasError) return;

    setState((prev) => ({ ...prev, status: 'submitting', error: null }));

    // Read WhatsApp number from localStorage (set in profile/notifications page)
    const whatsappNumber = localStorage.getItem('whatsappNumber') || null;
    const authToken = localStorage.getItem('authToken') || null;

    try {
      const res = await fetch('/api/shopping-list', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          items: state.items.map((item) => ({
            productName: item.productName.trim(),
            preferredBrand: item.preferredBrand.trim() || null,
            budget: item.budget ? parseInt(item.budget) : null,
            quantity: parseInt(item.quantity),
            deliveryDays: item.deliveryDays ? parseInt(item.deliveryDays) : null,
            paymentMethod: autoCheckout ? 'wallet' : (item.paymentMethod || null),
            emiOnly: item.emiOnly,
            attributes: item.attributes.filter(a => a.key.trim() && a.value.trim()),
            categoryId: item.categoryId ? parseInt(item.categoryId) : null,
            subCategoryId: item.subCategoryId ? parseInt(item.subCategoryId) : null,
            tagIds: item.tagIds.length > 0 ? item.tagIds : null,
          })),
          whatsappNumber,
          forceFresh,
          autoCheckout,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to submit shopping list');
      }

      const data = await res.json();

      // ── Persist results to localStorage for Smart Delegate page ──
      try {
        const sessionEmail = (localStorage.getItem('userEmail') || '').toLowerCase();
        const sessionName = sessionEmail ? sessionEmail.split('@')[0] : 'You';
        let existing: any[] = [];
        try { existing = JSON.parse(localStorage.getItem('shoppingListResults') || '[]'); } catch { existing = []; }
        existing.unshift({
          id: data.listId || `sl-${Date.now()}`,
          submittedAt: new Date().toISOString(),
          results: data.results || [],
          summary: data.summary || { totalItems: state.items.length, totalMatches: 0, estimatedSavings: '' },
          whatsappSent: data.whatsappSent || false,
          emailSent: data.emailSent || false,
          fromCache: data.fromCache || false,
          // Auto-checkout status — persisted so Smart Delegate can show order confirmation
          autoCheckoutSuccess: data.autoCheckout?.success ?? false,
          autoCheckoutOrderId: data.autoCheckout?.success ? data.autoCheckout.orderId : null,
          autoCheckoutError: data.autoCheckout && !data.autoCheckout.success ? data.autoCheckout.error : null,
          walletBalanceAfter: (data.autoCheckout as any)?.walletBalanceAfter ?? null,
          userEmail: sessionEmail,
          userName: sessionName,
        });
        localStorage.setItem('shoppingListResults', JSON.stringify(existing.slice(0, 20)));
        setHasShoppingActivity(true);

        // Persist to DB for RBAC-aware cross-user analytics
        // Fix: use productName (not i.name/i.product) and normalize products to RankedProduct format
        const queryText = state.items.map((i) => i.productName).filter(Boolean).join(', ') || 'Shopping list search';
        const normalizedProducts = (data.results || []).flatMap((r: any) =>
          (r.matches || []).map((m: any, idx: number) => ({
            rank: idx + 1,
            product: {
              id: m.id || `sl-${Date.now()}-${idx}`,
              name: m.name || m.productName || 'Unknown Product',
              brand: m.brand || 'Unknown',
              price: typeof m.price === 'number' ? m.price : 0,
              original_price: m.original_price || m.price || 0,
              rating: typeof m.rating === 'number' ? m.rating : 0,
              review_count: typeof m.review_count === 'number' ? m.review_count : 0,
              delivery_time: m.delivery_time || '3-5 days',
              key_features: Array.isArray(m.key_features) ? m.key_features : [],
              category: m.category || r.productName || 'General',
              image_url: m.image_url || null,
              discount_percent: m.discount_percent || 0,
            },
            score: typeof m.score === 'number' ? m.score : (typeof m.aiScore === 'number' ? m.aiScore / 100 : 0.5),
            confidence: typeof m.confidence === 'number' ? m.confidence : 0.8,
            explanation: m.explanation || {
              budget_fit_score: { score: 0.5, reason: 'Budget evaluated from shopping list' },
            },
          }))
        );
        // Build minimal timeline for shopping list (no pipeline steps — single aggregate)
        const slTimeline = data.summary?.processingTime ? [
          { id: 'shopping-list-process', label: 'Shopping List Processing', duration: data.summary.processingTime, status: 'done' },
        ] : [];
        import('@/lib/search-session').then(({ saveSearchSession }) => {
          saveSearchSession({
            userExternalId: localStorage.getItem('dc-user-id') || 'anonymous',
            userEmail: localStorage.getItem('userEmail') || undefined,
            queryText,
            sessionSource: 'shopping-list',
            productsJson: normalizedProducts,
            timelineJson: slTimeline,
            metricsJson: data.summary ?? {},
          });
        }).catch(() => {/* silent */ });
      } catch { /* ignore */ }

      // ── Auto-Checkout: save order to localStorage if successful ──
      if (data.autoCheckout?.success && data.autoCheckout.orderId) {
        try {
          const orderItems = (data.results || []).map((r: any) => {
            const best = r.matches?.[0];
            return {
              id: Math.floor(Math.random() * 100000),
              name: best?.name || r.productName,
              productName: best?.name || r.productName,
              price: best?.price || 0,
              quantity: r.quantity || 1,
            };
          });
          const orderTotal = orderItems.reduce((s: number, i: any) => s + i.price * i.quantity, 0);
          const existingOrders = JSON.parse(localStorage.getItem('orders') || '[]');
          existingOrders.unshift({
            id: data.autoCheckout.orderId,
            orderNumber: data.autoCheckout.orderId,
            total: orderTotal,
            status: 'confirmed',
            aiAssisted: true,
            paymentMethod: 'auto',
            createdAt: new Date().toISOString(),
            items: orderItems,
          });
          localStorage.setItem('orders', JSON.stringify(existingOrders.slice(0, 50)));
          // Send order success notifications (email, WhatsApp, SMS)
          notifyOrderSuccess(data.autoCheckout.orderId, orderTotal, orderItems.map((i: any) => i.name));
        } catch { /* ignore */ }
      }

      // ── Auto-Checkout FAILED: record in Failed Checkouts ──
      if (data.autoCheckout && !data.autoCheckout.success) {
        try {
          const failureReasonMap: Record<string, string> = {
            NO_MATCHING_PRODUCT: 'No matching product found',
            ORDER_BUDGET_EXCEEDED: 'Payment amount exceeds allowed per-order budget',
            MONTHLY_BUDGET_EXCEEDED: 'Monthly AI checkout budget exceeded allowed amount',
            DAILY_LIMIT_EXCEEDED: 'Daily wallet spending limit exceeded',
            INSUFFICIENT_WALLET_BALANCE: 'Insufficient wallet balance',
            WALLET_NOT_AI_AUTHORIZED: 'Wallet not authorized for AI auto-checkout – enable in Wallet Settings',
            WALLET_LOCKED: 'Wallet is locked or unavailable',
            PAYMENT_FAILURE: 'Payment failure',
            NETWORK_ERROR: 'Network latency failure',
            PAYMENT_PARTNER_DOWN: 'Payment processing partner is down',
          };
          const failureCode = data.autoCheckout.failureCode || 'UNKNOWN';
          const failedCheckouts = JSON.parse(localStorage.getItem('failedCheckouts') || '[]');
          failedCheckouts.unshift({
            id: `fail-${Date.now()}`,
            timestamp: new Date().toISOString(),
            items: state.items.map((item) => ({
              productName: item.productName,
              brand: item.preferredBrand,
              budget: item.budget,
              quantity: item.quantity,
            })),
            failureCode,
            failureReason: failureReasonMap[failureCode] || data.autoCheckout.error || 'Unknown failure',
            error: data.autoCheckout.error,
          });
          localStorage.setItem('failedCheckouts', JSON.stringify(failedCheckouts.slice(0, 50)));
          // Send order failure notifications (email, WhatsApp, SMS)
          const totalAmount = state.items.reduce((s, i) => s + (parseInt(i.budget) || 0), 0);
          notifyOrderFailed(`fail-${Date.now()}`, failureReasonMap[failureCode] || 'Unknown failure', totalAmount > 0 ? totalAmount : 0);
        } catch { /* ignore */ }
      }

      setFromCache(data.fromCache || false);
      setCacheInfo(data.cacheInfo || null);
      setState({ items: [createEmptyItem()], status: 'submitted', error: null });

      // ── Show appropriate success/failure message ──
      if (data.autoCheckout?.success && data.autoCheckout.orderId) {
        // Auto-checkout succeeded — prominent order confirmation, stays until dismissed
        const walletMsg = (data.autoCheckout as any).walletBalanceAfter != null
          ? ` Wallet balance: ₹${((data.autoCheckout as any).walletBalanceAfter as number).toLocaleString('en-IN')}.`
          : '';
        setSuccessMessage(
          `✅ Auto-Checkout Complete! Order ${data.autoCheckout.orderId} placed successfully.${walletMsg} Check your Orders page for tracking details.`
        );
        // Don't auto-dismiss order confirmations — let user read and dismiss manually
      } else if (data.autoCheckout && !data.autoCheckout.success) {
        // Auto-checkout was attempted but failed — show clear failure message
        const failureMsg = data.autoCheckout.error || 'Auto-checkout was not possible for these items.';
        setState((prev) => ({
          ...prev,
          error: `⚠️ Auto-Checkout Failed: ${failureMsg} Your shopping list has been saved — view results on the Smart Delegate page.`,
        }));
        setSuccessMessage(null);
        return; // Don't show generic success since it failed
      } else {
        // Plain search (no auto-checkout)
        setSuccessMessage(
          data.message || 'Shopping list submitted! Our AI agent will find the best matches and notify you.'
        );
        // Auto-dismiss generic success after 10 seconds (not for order confirmations)
        setTimeout(() => setSuccessMessage(null), 10000);
      }
    } catch (err: any) {
      setState((prev) => ({ ...prev, status: 'error', error: err.message }));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-950 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-600 rounded-xl text-white">
              <ListChecks className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Shopping List</h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Create your list and our AI agent will find the best deals for you
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>
              Our AI agent will search for the best matching products, compare prices, and send you the results via
              <Mail className="w-3 h-3 inline mx-1" />email and
              <MessageSquare className="w-3 h-3 inline mx-1" />WhatsApp (if configured in your{' '}
              <Link href="/profile" className="text-blue-600 underline">profile</Link>).
            </span>
          </div>
          {/* Quick Links */}
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/smart-delegate" className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors border border-blue-200 dark:border-blue-800">
              <Sparkles className="w-3 h-3" /> Smart Delegate
            </Link>
            {hasShoppingActivity && (
              <Link href="/shopping-assistant/metrics/validation?from=shopping-list" data-testid="validation-chip-shopping-list" className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-violet-600 bg-violet-50 dark:bg-violet-900/20 dark:text-violet-400 rounded-lg hover:bg-violet-100 dark:hover:bg-violet-900/30 transition-colors border border-violet-200 dark:border-violet-800">
                <ShieldCheck className="w-3 h-3" /> Validation
              </Link>
            )}
            <Link href="/orders" className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors border border-green-200 dark:border-green-800">
              <CheckCircle className="w-3 h-3" /> Order History
            </Link>
            <Link href="/checkout-failures" className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors border border-amber-200 dark:border-amber-800">
              <AlertCircle className="w-3 h-3" /> Failed Checkouts
            </Link>
          </div>
        </motion.div>

        {/* Success Message */}
        <AnimatePresence>
          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 p-4 rounded-xl flex items-start gap-3"
            >
              <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-sm">{successMessage}</p>
                <Link href="/smart-delegate" className="text-xs text-green-700 dark:text-green-300 underline mt-1 inline-block">
                  View results in Smart Delegate →
                </Link>
              </div>
              <button onClick={() => setSuccessMessage(null)} className="ml-auto">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        {state.error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 p-4 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm">{state.error}</p>
          </div>
        )}

        {/* Item List */}
        <div className="space-y-4 mb-6">
          <AnimatePresence>
            {state.items.map((item, i) => (
              <ShoppingListItemRow
                key={item.id}
                item={item}
                index={i}
                onChange={handleChange}
                onRemove={handleRemoveItem}
                onAttributeChange={handleAttributeChange}
                onCategoryChange={handleCategoryChange}
                onSubCategoryChange={handleSubCategoryChange}
                onTagAdd={handleTagAdd}
                onTagRemove={handleTagRemove}
                validationError={validationErrors[item.id] ?? null}
                autoCheckout={autoCheckout}
              />
            ))}
          </AnimatePresence>
        </div>

        {/* Cache Info Banner */}
        {fromCache && cacheInfo && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 p-3 rounded-xl flex items-center gap-2 text-sm"
          >
            <span className="text-lg">💾</span>
            <span>{cacheInfo}</span>
          </motion.div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={handleAddItem}
            className="flex items-center justify-center gap-2 px-5 py-2.5 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:border-blue-400 hover:text-blue-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Another Item
          </button>

          <div className="flex flex-col gap-2 flex-1 sm:flex-row sm:items-center">
            {/* Show Auto-Checkout button when auto-checkout enabled + terms accepted */}
            {autoCheckout && termsAccepted ? (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={state.status === 'submitting'}
                className="flex items-center justify-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-xl text-sm font-medium shadow-lg shadow-green-600/20 transition-colors"
              >
                {state.status === 'submitting' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4" />
                )}
                {state.status === 'submitting' ? 'Processing...' : '🚀 Auto-Checkout'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={state.status === 'submitting'}
                className="flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl text-sm font-medium shadow-lg shadow-blue-600/20 transition-colors"
              >
                {state.status === 'submitting' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {state.status === 'submitting' ? 'Submitting...' : 'Submit List for AI Search'}
              </button>
            )}

            <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-600 dark:text-slate-400 px-1">
              <input
                type="checkbox"
                checked={forceFresh}
                onChange={(e) => setForceFresh(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span>🔄 Force fresh search (skip cache)</span>
            </label>
          </div>
        </div>

        {/* Auto Checkout Options */}
        <div className="mt-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={autoCheckout}
              onChange={(e) => {
                setAutoCheckout(e.target.checked);
                if (!e.target.checked) setTermsAccepted(false);
              }}
              className="w-5 h-5 text-blue-600 rounded mt-0.5"
            />
            <div>
              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                Enable AI Auto-Checkout
              </span>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Allow our AI agent to automatically place orders when all items are found matching your specifications and within your approved payment limit.
              </p>
            </div>
          </label>

          <AnimatePresence>
            {autoCheckout && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 pl-8 space-y-3"
              >
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                  <p className="text-xs text-blue-800 dark:text-blue-200">
                    <strong>Auto-checkout conditions:</strong>
                  </p>
                  <ul className="text-xs text-blue-700 dark:text-blue-300 mt-1 space-y-0.5 list-disc list-inside">
                    <li>All items must be found with exact product details</li>
                    <li>Payment method must match your selection</li>
                    <li>Total amount must be within your auto-payment limit</li>
                    <li>All items must be available in the specified quantity</li>
                  </ul>
                </div>

                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => {
                      setTermsAccepted(e.target.checked);
                      if (e.target.checked) localStorage.setItem('shoppingListTermsAccepted', 'true');
                      else localStorage.removeItem('shoppingListTermsAccepted');
                    }}
                    className="w-4 h-4 text-blue-600 rounded mt-0.5"
                  />
                  <span className="text-xs text-slate-600 dark:text-slate-400">
                    I agree to the{' '}
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); setShowTermsModal(true); }}
                      className="text-blue-600 hover:text-blue-800 underline font-medium"
                    >
                      Terms &amp; Conditions for Auto-Checkout
                    </button>
                  </span>
                </label>

                {autoCheckout && !termsAccepted && (
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Please accept the terms to enable auto-checkout
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Info */}
        <div className="mt-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            How it works
          </h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-slate-600 dark:text-slate-400">
            <li>Add your desired products with optional preferences (brand, budget, delivery).</li>
            <li>Submit the list — our AI agent picks it up and searches across vendors.</li>
            <li>The agent finds the best matching products for each item in your list.</li>
            <li>You receive the results via email and WhatsApp with comparison details.</li>
            <li>If auto-checkout is enabled and within your approved limit, the agent places the order for you.</li>
            <li>For orders above your auto-approved limit, you&apos;ll be asked for approval via email or WhatsApp.</li>
          </ol>
        </div>

        {/* Terms & Conditions Modal */}
        <AnimatePresence>
          {showTermsModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
              onClick={() => setShowTermsModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    Auto-Checkout Terms &amp; Conditions
                  </h2>
                  <button
                    onClick={() => setShowTermsModal(false)}
                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-500" />
                  </button>
                </div>
                <div className="overflow-y-auto px-6 py-4 text-sm text-slate-700 dark:text-slate-300 space-y-4">
                  <p className="font-semibold text-slate-900 dark:text-white">Effective Date: March 2026</p>

                  <section>
                    <h3 className="font-semibold text-slate-900 dark:text-white mb-1">1. Overview</h3>
                    <p>By enabling Auto-Checkout, you authorize DelegateCart&apos;s AI agent to automatically place orders on your behalf when all specified conditions are met. This feature is designed to streamline your shopping experience for routine purchases.</p>
                  </section>

                  <section>
                    <h3 className="font-semibold text-slate-900 dark:text-white mb-1">2. Auto-Checkout Conditions</h3>
                    <p>An automatic order will only be placed when ALL of the following conditions are satisfied:</p>
                    <ul className="list-disc list-inside mt-1 space-y-0.5 text-xs">
                      <li>Every item in your shopping list has an exact product match in our catalog.</li>
                      <li>The selected payment method for each item is available and validated.</li>
                      <li>The total order amount does not exceed your configured auto-payment limit.</li>
                      <li>All items are in stock with the required quantity available.</li>
                      <li>Your account is in good standing with no pending disputes.</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="font-semibold text-slate-900 dark:text-white mb-1">3. Payment Authorization</h3>
                    <p>For Cash on Delivery (COD): Orders will be placed and you will pay upon delivery. For online payments (UPI, Credit/Debit Card, Net Banking): The total amount will be charged to your default payment method. You are responsible for ensuring sufficient funds or credit limit.</p>
                  </section>

                  <section>
                    <h3 className="font-semibold text-slate-900 dark:text-white mb-1">4. Payment Limits</h3>
                    <p>Auto-checkout is subject to your configured payment limit. Orders exceeding this limit will require manual approval via email or WhatsApp notification. You can update your auto-payment limit in your profile settings at any time.</p>
                  </section>

                  <section>
                    <h3 className="font-semibold text-slate-900 dark:text-white mb-1">5. Order Failures &amp; Risks</h3>
                    <ul className="list-disc list-inside mt-1 space-y-0.5 text-xs">
                      <li><strong>Payment Failure:</strong> If a payment fails, the order will be cancelled and you will be notified immediately. No charges will be applied for failed transactions.</li>
                      <li><strong>Stock Changes:</strong> If an item goes out of stock between search and checkout, the entire order will be held pending and you will be notified for manual review.</li>
                      <li><strong>Price Changes:</strong> If the price changes by more than 5% from the quoted amount, the order will require your manual approval.</li>
                      <li><strong>Delivery Delays:</strong> DelegateCart is not responsible for delivery delays caused by third-party vendors or logistics providers.</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="font-semibold text-slate-900 dark:text-white mb-1">6. Cancellation &amp; Returns</h3>
                    <p>Auto-checkout orders follow the same cancellation and return policies as manual orders. You may cancel within the standard cancellation window. Return policies are governed by the individual product and vendor terms.</p>
                  </section>

                  <section>
                    <h3 className="font-semibold text-slate-900 dark:text-white mb-1">7. Liability</h3>
                    <p>DelegateCart shall not be liable for any losses arising from auto-checkout orders placed in accordance with your configured preferences. By enabling this feature, you acknowledge that orders are placed programmatically and accept responsibility for maintaining accurate preferences and payment information.</p>
                  </section>

                  <section>
                    <h3 className="font-semibold text-slate-900 dark:text-white mb-1">8. Disabling Auto-Checkout</h3>
                    <p>You can disable auto-checkout at any time by unchecking the option in the Shopping List page or in your Profile Settings. Pending auto-checkout orders that have not yet been placed will be cancelled.</p>
                  </section>

                  <section>
                    <h3 className="font-semibold text-slate-900 dark:text-white mb-1">9. Data Privacy</h3>
                    <p>Your shopping preferences and auto-checkout settings are stored securely. We do not share your payment information with third parties except as required to process your orders.</p>
                  </section>

                  <section>
                    <h3 className="font-semibold text-slate-900 dark:text-white mb-1">10. Changes to Terms</h3>
                    <p>DelegateCart reserves the right to modify these terms at any time. You will be notified of significant changes and may need to re-accept the updated terms to continue using auto-checkout.</p>
                  </section>
                </div>
                <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                  <p className="text-xs text-slate-500">Last updated: March 2026</p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowTermsModal(false)}
                      className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-lg transition-colors"
                    >
                      Close
                    </button>
                    <button
                      onClick={() => { setTermsAccepted(true); setShowTermsModal(false); localStorage.setItem('shoppingListTermsAccepted', 'true'); }}
                      className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                    >
                      I Accept
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
