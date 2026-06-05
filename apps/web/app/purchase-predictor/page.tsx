'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Brain, TrendingUp, ShoppingCart, Star, Zap, Clock,
  CheckCircle, RefreshCw, ChevronRight, Sparkles,
  BarChart3, Target, ArrowRight, Package, Heart,
  Lightbulb, AlertCircle,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Prediction {
  id: string;
  name: string;
  category: string;
  brand: string;
  confidence: number;
  reason: string;
  price: number;
  discountedPrice: number;
  estimatedNeedDate: string;
  priority: 'high' | 'medium' | 'low';
  emoji: string;
}

interface InsightCard {
  title: string;
  value: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function generatePredictions(orders: any[]): Prediction[] {
  const BASE_PREDICTIONS: Prediction[] = [
    {
      id: 'pp-1',
      name: 'Apple AirPods Pro 2',
      category: 'Audio',
      brand: 'Apple',
      confidence: 94,
      reason: 'Based on your iPhone purchase and audio interest patterns',
      price: 26900,
      discountedPrice: 22990,
      estimatedNeedDate: 'Next 2 weeks',
      priority: 'high',
      emoji: '🎧',
    },
    {
      id: 'pp-2',
      name: 'Samsung Galaxy Watch 6',
      category: 'Wearables',
      brand: 'Samsung',
      confidence: 87,
      reason: 'Complements your Samsung phone; popular with similar buyers',
      price: 34999,
      discountedPrice: 29999,
      estimatedNeedDate: 'Next month',
      priority: 'high',
      emoji: '⌚',
    },
    {
      id: 'pp-3',
      name: 'Anker 65W USB-C Charger',
      category: 'Accessories',
      brand: 'Anker',
      confidence: 81,
      reason: 'Your current devices all support fast charging',
      price: 3999,
      discountedPrice: 2999,
      estimatedNeedDate: 'Next 3 weeks',
      priority: 'medium',
      emoji: '🔌',
    },
    {
      id: 'pp-4',
      name: 'LG 260L Double Door Refrigerator',
      category: 'Appliances',
      brand: 'LG',
      confidence: 76,
      reason: 'Most buyers who purchase washing machines also need a refrigerator',
      price: 26990,
      discountedPrice: 23990,
      estimatedNeedDate: '1-2 months',
      priority: 'medium',
      emoji: '🧊',
    },
    {
      id: 'pp-5',
      name: 'Kindle Paperwhite',
      category: 'E-Readers',
      brand: 'Amazon',
      confidence: 72,
      reason: 'Popular among tech-savvy users in your demographic',
      price: 14999,
      discountedPrice: 12999,
      estimatedNeedDate: 'Next month',
      priority: 'medium',
      emoji: '📖',
    },
    {
      id: 'pp-6',
      name: 'Logitech MX Master 3 Mouse',
      category: 'Accessories',
      brand: 'Logitech',
      confidence: 68,
      reason: 'MacBook users frequently purchase this as a companion device',
      price: 9995,
      discountedPrice: 7995,
      estimatedNeedDate: '2-3 months',
      priority: 'low',
      emoji: '🖱️',
    },
    {
      id: 'pp-7',
      name: 'Instant Pot Duo 7-in-1',
      category: 'Kitchen',
      brand: 'Instant Pot',
      confidence: 63,
      reason: 'Popular home appliance upgrade for households with AC/washer',
      price: 8999,
      discountedPrice: 6999,
      estimatedNeedDate: '3-4 months',
      priority: 'low',
      emoji: '🫕',
    },
  ];

  return BASE_PREDICTIONS;
}

function addToCart(prediction: Prediction) {
  try {
    const raw = localStorage.getItem('cart');
    const cart: any[] = raw ? JSON.parse(raw) : [];
    if (!cart.find((c) => c.productId === prediction.id)) {
      cart.push({
        id: `cart-${Date.now()}`,
        productId: prediction.id,
        name: prediction.name,
        price: prediction.discountedPrice,
        quantity: 1,
        stock: 99,
      });
      localStorage.setItem('cart', JSON.stringify(cart));
      localStorage.setItem('cartFromAI', 'true');
      window.dispatchEvent(new Event('cartUpdated'));
    }
  } catch { }
}

function addToWishlist(prediction: Prediction) {
  try {
    const raw = localStorage.getItem('wishlist');
    const wl: any[] = raw ? JSON.parse(raw) : [];
    if (!wl.find((w) => w.id === prediction.id)) {
      wl.push({ id: prediction.id, name: prediction.name, price: prediction.discountedPrice, addedAt: new Date().toISOString() });
      localStorage.setItem('wishlist', JSON.stringify(wl));
    }
  } catch { }
}

// ── Prediction Card ───────────────────────────────────────────────────────────

function PredictionCard({ prediction }: { prediction: Prediction }) {
  const [inCart, setInCart] = useState(false);
  const [inWishlist, setInWishlist] = useState(false);
  const discount = Math.round(((prediction.price - prediction.discountedPrice) / prediction.price) * 100);

  useEffect(() => {
    const check = () => {
      try {
        const cart: any[] = JSON.parse(localStorage.getItem('cart') || '[]');
        const wl: any[] = JSON.parse(localStorage.getItem('wishlist') || '[]');
        setInCart(cart.some((c) => c.productId === prediction.id));
        setInWishlist(wl.some((w) => w.id === prediction.id));
      } catch { }
    };
    check();
    window.addEventListener('cartUpdated', check);
    return () => window.removeEventListener('cartUpdated', check);
  }, [prediction.id]);

  const priorityBadge = {
    high: 'bg-red-100 text-red-700',
    medium: 'bg-amber-100 text-amber-700',
    low: 'bg-gray-100 text-gray-600',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 hover:shadow-md transition-shadow"
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
          {prediction.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${priorityBadge[prediction.priority]}`}>
              {prediction.priority.toUpperCase()}
            </span>
            <span className="text-[10px] text-gray-400">{prediction.category}</span>
          </div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-1">{prediction.name}</p>
          <p className="text-xs text-gray-400">{prediction.brand}</p>
        </div>
      </div>

      {/* Confidence */}
      <div className="mb-3">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-500">AI Confidence</span>
          <span className="font-bold text-blue-600">{prediction.confidence}%</span>
        </div>
        <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${prediction.confidence}%` }}
            transition={{ duration: 0.6 }}
            className={`h-full rounded-full ${prediction.confidence >= 85 ? 'bg-green-500' : prediction.confidence >= 70 ? 'bg-blue-500' : 'bg-amber-500'}`}
          />
        </div>
      </div>

      {/* Reason */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2.5 mb-3 flex items-start gap-2">
        <Lightbulb className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">{prediction.reason}</p>
      </div>

      {/* Price */}
      <div className="flex items-end justify-between mb-3">
        <div>
          <p className="text-lg font-bold text-gray-900 dark:text-white">₹{prediction.discountedPrice.toLocaleString('en-IN')}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-xs text-gray-400 line-through">₹{prediction.price.toLocaleString('en-IN')}</span>
            {discount > 0 && <span className="text-xs bg-red-50 text-red-600 px-1 py-0.5 rounded font-semibold">{discount}% OFF</span>}
          </div>
        </div>
        <div className="text-right text-xs text-gray-500">
          <Clock className="w-3 h-3 inline mr-0.5" />
          {prediction.estimatedNeedDate}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => {
            addToWishlist(prediction);
            setInWishlist(true);
          }}
          disabled={inWishlist}
          className={`flex items-center justify-center gap-1 px-2.5 py-2 rounded-lg text-xs font-semibold transition-colors border ${inWishlist ? 'bg-pink-50 text-pink-600 border-pink-200' : 'bg-white text-gray-500 border-gray-200 hover:border-pink-300 hover:text-pink-500'
            }`}
        >
          <Heart className="w-3.5 h-3.5" />
          {inWishlist ? 'Saved' : 'Save'}
        </button>
        <button
          onClick={() => {
            if (!inCart) { addToCart(prediction); setInCart(true); }
          }}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors ${inCart ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
        >
          <ShoppingCart className="w-3.5 h-3.5" />
          {inCart ? 'In Cart' : 'Add to Cart'}
        </button>
      </div>
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PurchasePredictorPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const email = localStorage.getItem('userEmail');
    if (!token || !email) { router.push('/signin'); return; }
    const savedOrders = JSON.parse(localStorage.getItem('orders') || '[]');
    setOrders(savedOrders);
    setPredictions(generatePredictions(savedOrders));
    setMounted(true);
  }, [router]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await new Promise(r => setTimeout(r, 1500));
    setPredictions(generatePredictions(orders));
    setRefreshing(false);
  };

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const highConfidence = predictions.filter(p => p.confidence >= 85).length;
  const avgConfidence = predictions.length > 0
    ? Math.round(predictions.reduce((s, p) => s + p.confidence, 0) / predictions.length)
    : 0;

  const INSIGHTS: InsightCard[] = [
    { title: 'Prediction Accuracy', value: `${avgConfidence}%`, description: 'Average confidence across all predictions', icon: Target, color: 'text-blue-600' },
    { title: 'High Priority', value: String(predictions.filter(p => p.priority === 'high').length), description: 'Items you likely need soon', icon: AlertCircle, color: 'text-red-500' },
    { title: 'Potential Savings', value: `₹${predictions.reduce((s, p) => s + (p.price - p.discountedPrice), 0).toLocaleString('en-IN')}`, description: 'If you buy at predicted prices', icon: TrendingUp, color: 'text-green-600' },
    { title: 'Past Orders Analyzed', value: String(orders.length), description: 'Orders used to train predictions', icon: BarChart3, color: 'text-purple-600' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-950 dark:to-blue-950/20">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                <Brain className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold">Purchase Predictor</h1>
                <p className="text-white/80 text-sm mt-0.5">AI anticipates your next product need</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              {[
                { label: 'Predictions', value: predictions.length },
                { label: 'High Confidence', value: highConfidence },
                { label: 'Avg Accuracy', value: `${avgConfidence}%` },
              ].map(({ label, value }) => (
                <div key={label} className="bg-white/15 backdrop-blur-sm rounded-xl px-4 py-2.5 text-center min-w-[80px]">
                  <p className="text-xl font-bold">{value}</p>
                  <p className="text-xs text-white/80">{label}</p>
                </div>
              ))}
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="bg-white/20 hover:bg-white/30 disabled:opacity-50 rounded-xl px-4 py-2.5 flex flex-col items-center justify-center min-w-[70px]"
              >
                <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
                <span className="text-xs mt-0.5">Refresh</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* Insights bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {INSIGHTS.map(({ title, value, description, icon: Icon, color }) => (
            <div key={title} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
              <Icon className={`w-5 h-5 ${color} mb-2`} />
              <p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p>
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mt-0.5">{title}</p>
              <p className="text-xs text-gray-400 mt-0.5">{description}</p>
            </div>
          ))}
        </div>

        {/* Info banner */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 text-sm text-blue-700 dark:text-blue-300 flex items-start gap-2">
          <Sparkles className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>
            AI analyzes your order history, browsing patterns, and seasonal trends to predict what you'll likely need next.
            {orders.length === 0 && ' Place some orders first to get personalized predictions!'}
          </span>
        </div>

        {/* High Priority predictions */}
        {predictions.filter(p => p.priority === 'high').length > 0 && (
          <section>
            <h2 className="text-base font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Zap className="w-5 h-5 text-red-500" /> You'll Likely Need Soon
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {predictions.filter(p => p.priority === 'high').map(p => (
                <PredictionCard key={p.id} prediction={p} />
              ))}
            </div>
          </section>
        )}

        {/* Medium & Low priority */}
        {predictions.filter(p => p.priority !== 'high').length > 0 && (
          <section>
            <h2 className="text-base font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-500" /> Also Recommended
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {predictions.filter(p => p.priority !== 'high').map(p => (
                <PredictionCard key={p.id} prediction={p} />
              ))}
            </div>
          </section>
        )}

        {/* CTA */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold mb-1">Improve Prediction Accuracy</h3>
            <p className="text-white/80 text-sm">The more you shop, the smarter your predictions become</p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/shopping-list"
              className="flex items-center gap-2 px-5 py-2.5 bg-white/20 hover:bg-white/30 text-white font-semibold rounded-xl transition-colors text-sm"
            >
              <Package className="w-4 h-4" /> Shopping List
            </Link>
            <Link
              href="/products"
              className="flex items-center gap-2 px-5 py-2.5 bg-white text-blue-700 font-semibold rounded-xl hover:bg-blue-50 transition-colors text-sm"
            >
              Shop Now <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
