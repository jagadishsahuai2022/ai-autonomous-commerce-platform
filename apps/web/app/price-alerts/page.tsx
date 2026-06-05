'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bell, TrendingDown, TrendingUp, Star, ShoppingCart,
  Plus, Trash2, CheckCircle, Clock, AlertCircle,
  Sparkles, ArrowRight, Eye, Package, Zap, Tag,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TrackedItem {
  id: string;
  name: string;
  brand: string;
  category: string;
  targetPrice: number;
  currentPrice: number;
  originalPrice: number;
  alertEnabled: boolean;
  lastChecked: string;
  priceHistory: { date: string; price: number }[];
  imageEmoji: string;
}

// ── Default tracked items ─────────────────────────────────────────────────────

const DEFAULT_ITEMS: TrackedItem[] = [
  {
    id: 'pa-1',
    name: 'Apple iPhone 15 Pro',
    brand: 'Apple',
    category: 'Phones',
    targetPrice: 110000,
    currentPrice: 124900,
    originalPrice: 134900,
    alertEnabled: true,
    lastChecked: new Date().toISOString(),
    priceHistory: [
      { date: '2026-01-01', price: 134900 },
      { date: '2026-02-01', price: 129900 },
      { date: '2026-03-01', price: 124900 },
    ],
    imageEmoji: '📱',
  },
  {
    id: 'pa-2',
    name: 'Sony WH-1000XM5',
    brand: 'Sony',
    category: 'Audio',
    targetPrice: 22000,
    currentPrice: 26990,
    originalPrice: 29990,
    alertEnabled: true,
    lastChecked: new Date().toISOString(),
    priceHistory: [
      { date: '2026-01-01', price: 29990 },
      { date: '2026-02-01', price: 27490 },
      { date: '2026-03-01', price: 26990 },
    ],
    imageEmoji: '🎧',
  },
  {
    id: 'pa-3',
    name: 'LG 55" OLED C3',
    brand: 'LG',
    category: 'TV',
    targetPrice: 100000,
    currentPrice: 119990,
    originalPrice: 149990,
    alertEnabled: false,
    lastChecked: new Date().toISOString(),
    priceHistory: [
      { date: '2026-01-01', price: 149990 },
      { date: '2026-02-01', price: 134990 },
      { date: '2026-03-01', price: 119990 },
    ],
    imageEmoji: '📺',
  },
  {
    id: 'pa-4',
    name: 'MacBook Air M3',
    brand: 'Apple',
    category: 'Laptop',
    targetPrice: 105000,
    currentPrice: 114900,
    originalPrice: 129900,
    alertEnabled: true,
    lastChecked: new Date().toISOString(),
    priceHistory: [
      { date: '2026-01-01', price: 129900 },
      { date: '2026-02-01', price: 119900 },
      { date: '2026-03-01', price: 114900 },
    ],
    imageEmoji: '💻',
  },
  {
    id: 'pa-5',
    name: 'Samsung Galaxy Tab S9',
    brand: 'Samsung',
    category: 'Tablet',
    targetPrice: 65000,
    currentPrice: 74999,
    originalPrice: 84999,
    alertEnabled: true,
    lastChecked: new Date().toISOString(),
    priceHistory: [
      { date: '2026-01-01', price: 84999 },
      { date: '2026-02-01', price: 79999 },
      { date: '2026-03-01', price: 74999 },
    ],
    imageEmoji: '📟',
  },
  {
    id: 'pa-6',
    name: 'Daikin 1.5 Ton 5-Star Inverter AC',
    brand: 'Daikin',
    category: 'AC',
    targetPrice: 38000,
    currentPrice: 42990,
    originalPrice: 52990,
    alertEnabled: false,
    lastChecked: new Date().toISOString(),
    priceHistory: [
      { date: '2026-01-01', price: 52990 },
      { date: '2026-02-01', price: 47990 },
      { date: '2026-03-01', price: 42990 },
    ],
    imageEmoji: '❄️',
  },
  {
    id: 'pa-7',
    name: 'IFB 6.5 Kg Front Load Washing Machine',
    brand: 'IFB',
    category: 'Washing Machine',
    targetPrice: 20000,
    currentPrice: 24990,
    originalPrice: 34990,
    alertEnabled: true,
    lastChecked: new Date().toISOString(),
    priceHistory: [
      { date: '2026-01-01', price: 34990 },
      { date: '2026-02-01', price: 28990 },
      { date: '2026-03-01', price: 24990 },
    ],
    imageEmoji: '🫧',
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function loadItems(): TrackedItem[] {
  try {
    const raw = localStorage.getItem('priceAlertItems');
    return raw ? JSON.parse(raw) : DEFAULT_ITEMS;
  } catch { return DEFAULT_ITEMS; }
}

function saveItems(items: TrackedItem[]) {
  localStorage.setItem('priceAlertItems', JSON.stringify(items));
}

function addToCart(item: TrackedItem) {
  try {
    const raw = localStorage.getItem('cart');
    const cart: any[] = raw ? JSON.parse(raw) : [];
    if (!cart.find((c) => c.productId === item.id)) {
      cart.push({
        id: `cart-${Date.now()}`,
        productId: item.id,
        name: item.name,
        price: item.currentPrice,
        quantity: 1,
        stock: 99,
      });
      localStorage.setItem('cart', JSON.stringify(cart));
      window.dispatchEvent(new Event('cartUpdated'));
    }
  } catch {}
}

// ── Price Trend mini-chart ────────────────────────────────────────────────────

function PriceTrend({ history }: { history: { date: string; price: number }[] }) {
  if (history.length < 2) return null;
  const min = Math.min(...history.map((h) => h.price));
  const max = Math.max(...history.map((h) => h.price));
  const range = max - min || 1;
  const W = 80, H = 28;
  const pts = history.map((h, i) => ({
    x: (i / (history.length - 1)) * W,
    y: H - ((h.price - min) / range) * H,
  }));
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const trending = history[history.length - 1].price < history[0].price;
  return (
    <svg width={W} height={H} className="overflow-visible">
      <path d={d} fill="none" stroke={trending ? '#22c55e' : '#ef4444'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="3" fill={trending ? '#22c55e' : '#ef4444'} />
    </svg>
  );
}

// ── Item Card ─────────────────────────────────────────────────────────────────

function AlertCard({
  item,
  onToggleAlert,
  onRemove,
}: {
  item: TrackedItem;
  onToggleAlert: () => void;
  onRemove: () => void;
}) {
  const discount = Math.round(((item.originalPrice - item.currentPrice) / item.originalPrice) * 100);
  const dropNeeded = Math.max(0, item.currentPrice - item.targetPrice);
  const atTarget = item.currentPrice <= item.targetPrice;
  const trending = item.priceHistory.length >= 2 &&
    item.priceHistory[item.priceHistory.length - 1].price < item.priceHistory[0].price;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white dark:bg-gray-900 border rounded-2xl p-4 hover:shadow-md transition-shadow ${
        atTarget ? 'border-green-300 ring-1 ring-green-100' : 'border-gray-200 dark:border-gray-700'
      }`}
    >
      {atTarget && (
        <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-2 py-1 mb-3 font-semibold">
          <CheckCircle className="w-3.5 h-3.5" /> Price dropped to your target!
        </div>
      )}

      <div className="flex items-start gap-3 mb-3">
        <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
          {item.imageEmoji}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-1">{item.name}</p>
          <p className="text-xs text-gray-400">{item.brand} · {item.category}</p>
        </div>
        <button onClick={onRemove} className="p-1 text-gray-300 hover:text-red-400 rounded transition-colors flex-shrink-0">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-end justify-between gap-2 mb-3">
        <div>
          <p className="text-xl font-bold text-gray-900 dark:text-white">₹{item.currentPrice.toLocaleString('en-IN')}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-gray-400 line-through">₹{item.originalPrice.toLocaleString('en-IN')}</span>
            <span className="text-xs bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-semibold">{discount}% OFF</span>
          </div>
        </div>
        <div className="text-right">
          <PriceTrend history={item.priceHistory} />
          <p className={`text-xs mt-1 flex items-center gap-1 justify-end ${trending ? 'text-green-600' : 'text-red-500'}`}>
            {trending ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
            {trending ? 'Dropping' : 'Rising'}
          </p>
        </div>
      </div>

      <div className={`text-xs px-2 py-1.5 rounded-lg mb-3 flex items-center gap-1.5 ${
        atTarget ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'
      }`}>
        <Tag className="w-3 h-3 flex-shrink-0" />
        Target: ₹{item.targetPrice.toLocaleString('en-IN')}
        {!atTarget && ` · Drop needed: ₹${dropNeeded.toLocaleString('en-IN')}`}
        {atTarget && ' · Target reached! ✓'}
      </div>

      <div className="flex gap-2">
        <button
          onClick={onToggleAlert}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
            item.alertEnabled
              ? 'bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-100'
              : 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100'
          }`}
        >
          <Bell className="w-3.5 h-3.5" />
          {item.alertEnabled ? 'Alert On' : 'Alert Off'}
        </button>
        <button
          onClick={() => addToCart(item)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors"
        >
          <ShoppingCart className="w-3.5 h-3.5" />
          Add to Cart
        </button>
      </div>
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PriceAlertsPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState<TrackedItem[]>([]);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const email = localStorage.getItem('userEmail');
    if (!token || !email) { router.push('/signin'); return; }
    setItems(loadItems());
    setMounted(true);
  }, [router]);

  const updateItems = (next: TrackedItem[]) => {
    setItems(next);
    saveItems(next);
  };

  const toggleAlert = (id: string) =>
    updateItems(items.map((i) => i.id === id ? { ...i, alertEnabled: !i.alertEnabled } : i));

  const removeItem = (id: string) =>
    updateItems(items.filter((i) => i.id !== id));

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const alertsOn = items.filter((i) => i.alertEnabled).length;
  const atTarget = items.filter((i) => i.currentPrice <= i.targetPrice).length;
  const totalDrop = items.reduce((s, i) => s + (i.originalPrice - i.currentPrice), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 dark:from-gray-950 dark:to-orange-950/20">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                <Bell className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold">Price Drop Alerts</h1>
                <p className="text-white/80 text-sm mt-0.5">AI monitors prices across platforms</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              {[
                { label: 'Tracked', value: items.length },
                { label: 'Alerts On', value: alertsOn },
                { label: 'At Target', value: atTarget },
                { label: 'Total Savings', value: `₹${(totalDrop/1000).toFixed(0)}K` },
              ].map(({ label, value }) => (
                <div key={label} className="bg-white/15 backdrop-blur-sm rounded-xl px-4 py-2.5 text-center min-w-[70px]">
                  <p className="text-lg font-bold">{value}</p>
                  <p className="text-xs text-white/80">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* Info banner */}
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4 text-sm text-orange-700 dark:text-orange-300 flex items-start gap-2">
          <Sparkles className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>
            AI monitors prices every 6 hours across 50+ platforms. You'll receive WhatsApp &amp; email alerts when prices drop to your target.
            Configure your WhatsApp number in <Link href="/profile" className="underline font-semibold">Profile Settings</Link>.
          </span>
        </div>

        {/* Items grid */}
        {items.length === 0 ? (
          <div className="text-center py-20">
            <Bell className="w-16 h-16 mx-auto text-orange-300 mb-4" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No items tracked</h2>
            <p className="text-gray-500 mb-6">Browse products and click "Track Price" to add items here</p>
            <Link
              href="/products"
              className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 transition-colors"
            >
              <Eye className="w-5 h-5" /> Browse Products
            </Link>
          </div>
        ) : (
          <>
            {/* At target items */}
            {atTarget > 0 && (
              <div>
                <h2 className="text-sm font-bold text-green-700 dark:text-green-400 mb-3 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4" /> Price Target Reached ({atTarget})
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {items.filter(i => i.currentPrice <= i.targetPrice).map(item => (
                    <AlertCard key={item.id} item={item} onToggleAlert={() => toggleAlert(item.id)} onRemove={() => removeItem(item.id)} />
                  ))}
                </div>
              </div>
            )}

            {/* Tracking items */}
            <div>
              <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5">
                <Bell className="w-4 h-4" /> Tracking ({items.filter(i => i.currentPrice > i.targetPrice).length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {items.filter(i => i.currentPrice > i.targetPrice).map(item => (
                  <AlertCard key={item.id} item={item} onToggleAlert={() => toggleAlert(item.id)} onRemove={() => removeItem(item.id)} />
                ))}
              </div>
            </div>
          </>
        )}

        {/* CTA */}
        <div className="bg-gradient-to-br from-orange-500 to-amber-600 text-white rounded-2xl p-6 text-center">
          <Zap className="w-8 h-8 mx-auto mb-2" />
          <h3 className="text-lg font-bold mb-1">Add More Products to Track</h3>
          <p className="text-white/80 text-sm mb-4">Browse our product catalog and set price targets</p>
          <Link
            href="/products"
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-white text-orange-600 font-semibold rounded-xl hover:bg-orange-50 transition-colors"
          >
            <Package className="w-4 h-4" /> Browse Products <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
