'use client';

import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ProductCard } from '@/components/product/DCProductCard';
import { useFeaturedProducts } from '@/hooks/useProducts';
import { Skeleton } from '@/components/ui/skeleton';
import { Star, Zap, TrendingUp, Shield, ChevronRight, Brain, Sparkles, ShoppingBag, ArrowRight, Cpu, MessageSquare, Wallet, ListChecks, Globe, Clock, Tag, Flame } from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';

const CATEGORIES = [
  { name: 'Electronics', emoji: '💻', slug: 'electronics', color: 'from-blue-500 to-cyan-500' },
  { name: 'Fashion', emoji: '👗', slug: 'fashion', color: 'from-pink-500 to-rose-500' },
  { name: 'Home', emoji: '🏠', slug: 'home', color: 'from-amber-500 to-orange-500' },
  { name: 'Beauty', emoji: '💄', slug: 'beauty', color: 'from-purple-500 to-fuchsia-500' },
  { name: 'Sports', emoji: '⚽', slug: 'sports', color: 'from-green-500 to-emerald-500' },
  { name: 'Books', emoji: '📚', slug: 'books', color: 'from-indigo-500 to-violet-500' },
  { name: 'Toys', emoji: '🧸', slug: 'toys', color: 'from-red-500 to-pink-500' },
  { name: 'Kitchen', emoji: '🍳', slug: 'kitchen', color: 'from-teal-500 to-cyan-500' },
  { name: 'Stationery', emoji: '✏️', slug: 'stationery', color: 'from-yellow-500 to-amber-500' },
  { name: 'Fitness', emoji: '💪', slug: 'fitness', color: 'from-lime-500 to-green-500' },
];

const AI_FEATURES = [
  { icon: Brain, title: 'Smart Shopping Assistant', desc: 'Find exactly what you need with smart search & recommendations', href: '/shopping-assistant', gradient: 'from-violet-600 to-purple-600' },
  { icon: ListChecks, title: 'Smart Delegate', desc: 'Let AI shop for you — just describe what you want', href: '/smart-delegate', gradient: 'from-blue-600 to-cyan-600' },
  { icon: Sparkles, title: 'AI+ Premium Lists', desc: 'Submit a list and get auto-curated carts delivered', href: '/ai-plus', gradient: 'from-amber-500 to-orange-600' },
  { icon: Wallet, title: 'DelegateCart Wallet', desc: 'Fast checkout with built-in wallet & rewards', href: '/wallet', gradient: 'from-emerald-600 to-teal-600' },
];

function useSearchHistory() {
  const [history, setHistory] = useState<string[]>([]);
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('searchHistory') || '[]');
      setHistory(Array.isArray(stored) ? stored.slice(0, 3) : []);
    } catch {
      setHistory([]);
    }
  }, []);
  return history;
}

function useRecentlyViewed() {
  const [products, setProducts] = useState<import('@/types').Product[]>([]);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('__dc_session_context');
      if (!raw) return;
      const ctx = JSON.parse(raw);
      const ids: string[] = ctx.recentlyViewed || [];
      if (!ids.length) return;
      // Fetch product details for recently viewed IDs
      const fetchProducts = async () => {
        try {
          const res = await fetch(`/api/products?take=50`);
          if (!res.ok) return;
          const data = await res.json();
          const all = data?.products || data?.data || [];
          const matched = ids.slice(0, 10).map(id =>
            all.find((p: any) => String(p.id) === id)
          ).filter(Boolean).map((p: any) => ({
            id: String(p.id), name: p.name, description: p.description || '', price: p.price,
            originalPrice: p.originalPrice, rating: p.rating || 4.0, reviews: p.reviewCount || 0,
            reviewCount: p.reviewCount || 0, image: p.image || p.images?.[0] || '/product-placeholder.svg',
            category: p.category, delivery: p.delivery ?? { daysMin: 2, daysMax: 5, free: true },
            brand: p.brand || 'DelegateCart', inStock: p.inStock ?? true,
            codAvailable: p.codAvailable ?? true, hasEMI: p.hasEMI ?? (p.price > 5000),
          }));
          setProducts(matched);
        } catch { /* ignore */ }
      };
      fetchProducts();
    } catch { /* ignore */ }
  }, []);
  return products;
}

export default function Home() {
  const { data: featuredData, isLoading } = useFeaturedProducts();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const rawProducts = Array.isArray(featuredData) ? featuredData.slice(0, 10) : [];

  const products: import('@/types').Product[] = rawProducts.map((p: any) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    price: p.price,
    originalPrice: p.originalPrice,
    rating: typeof p.rating === 'number' ? p.rating : 4.0,
    reviews: p.reviewCount || 0,
    reviewCount: p.reviewCount || 0,
    image: p.image || p.images?.[0] || '/product-placeholder.svg',
    category: p.category,
    delivery: p.delivery ?? { daysMin: 2, daysMax: 5, free: true },
    brand: p.brand || 'DelegateCart',
    inStock: p.inStock ?? true,
    codAvailable: p.codAvailable ?? true,
    hasEMI: p.hasEMI ?? (p.price > 5000),
  }));
  const searchHistory = useSearchHistory();
  const recentlyViewed = useRecentlyViewed();

  const handleAddToCart = (product: import('@/types').Product) => {
    try {
      const raw = localStorage.getItem('cart');
      const cart: any[] = raw ? JSON.parse(raw) : [];
      const existing = cart.find((i) => i.productId === product.id);
      if (existing) {
        existing.quantity = (existing.quantity || 1) + 1;
      } else {
        cart.push({ id: `cart-${product.id}-${Date.now()}`, productId: product.id, name: product.name, price: product.price, quantity: 1, image: product.image, stock: product.inStock ? 99 : 0 });
      }
      localStorage.setItem('cart', JSON.stringify(cart));
      window.dispatchEvent(new Event('cartUpdated'));
    } catch { }
  };

  const handleWishlist = (product: import('@/types').Product) => {
    try {
      const raw = localStorage.getItem('wishlist');
      const list: any[] = raw ? JSON.parse(raw) : [];
      const idx = list.findIndex((i) => i.id === product.id);
      if (idx !== -1) list.splice(idx, 1);
      else list.push({ id: product.id, name: product.name, price: product.price, originalPrice: product.originalPrice, image: product.image, rating: product.rating, reviewCount: product.reviewCount, category: product.category, brand: product.brand, inStock: product.inStock });
      localStorage.setItem('wishlist', JSON.stringify(list));
    } catch { }
  };

  const enrichedProducts = useMemo(() =>
    products.map((p, i) => ({
      ...p,
      trustScore: 72 + (i * 7) % 28,
      priceTrend: (['down', 'stable', 'up', 'down', 'stable'] as const)[i % 5],
      priceTrendPct: [12, 0, 8, 15, 0][i % 5],
      aiRecommended: i === 0 || i === 3,
      aiConfidence: 85 + (i * 3) % 15,
    })),
    [products]);

  const aiPickProducts = enrichedProducts.filter(p => p.aiRecommended);
  const trendingProducts = enrichedProducts.filter((_, i) => i % 3 !== 0).slice(0, 5);

  // Best Deals: sorted by discount percentage
  const bestDeals = useMemo(() =>
    [...enrichedProducts]
      .filter(p => p.originalPrice && p.originalPrice > p.price)
      .sort((a, b) => {
        const discA = a.originalPrice ? (a.originalPrice - a.price) / a.originalPrice : 0;
        const discB = b.originalPrice ? (b.originalPrice - b.price) / b.originalPrice : 0;
        return discB - discA;
      })
      .slice(0, 5),
    [enrichedProducts]);

  // Top Rated: sorted by rating then reviews
  const topRated = useMemo(() =>
    [...enrichedProducts]
      .sort((a, b) => b.rating - a.rating || b.reviews - a.reviews)
      .slice(0, 5),
    [enrichedProducts]);

  return (
    <div className="w-full bg-gradient-to-b from-slate-50 via-white to-slate-50 text-slate-900 min-h-screen">
      {/* ═══════════════════ HERO ═══════════════════ */}
      <section className="relative overflow-hidden">
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-violet-50" />
        <div className="absolute inset-0 opacity-40">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-200 rounded-full blur-[128px] animate-pulse" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-200 rounded-full blur-[128px] animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-cyan-200 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '2s' }} />
        </div>
        {/* Grid pattern overlay */}
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(rgba(99,102,241,.15) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,.15) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />

        <div className="relative max-w-7xl mx-auto px-4 pt-16 pb-20 sm:pt-24 sm:pb-28">
          <div className="text-center max-w-3xl mx-auto">
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-indigo-200 bg-white/70 backdrop-blur-sm mb-6 shadow-sm"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
              <span className="text-xs font-medium text-indigo-700">AI-Powered Commerce Platform</span>
            </motion.div>

            {/* Heading */}
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.1] mb-6"
            >
              <span className="text-slate-900">The Future of</span>
              <br />
              <span className="bg-gradient-to-r from-violet-600 via-blue-600 to-cyan-600 bg-clip-text text-transparent">
                Smart Shopping
              </span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-base sm:text-lg text-slate-600 mb-8 max-w-xl mx-auto leading-relaxed"
            >
              Discover, compare, and shop with an AI assistant that understands your preferences. Real-time recommendations, automated checkouts, and wallet-powered payments.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-3 justify-center"
            >
              <Link
                href="/shopping-assistant"
                className="group inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white rounded-xl font-semibold text-sm shadow-lg shadow-violet-600/30 transition-all"
              >
                <MessageSquare size={16} />
                Chat with Smart Assistant
                <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link
                href="/products"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 rounded-xl font-semibold text-sm shadow-sm transition-all"
              >
                <ShoppingBag size={16} />
                Browse Products
              </Link>
            </motion.div>
          </div>

          {/* Stats Row */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto"
          >
            {[
              { label: 'Products', value: '100K+', icon: ShoppingBag },
              { label: 'AI Confidence', value: '95%', icon: Brain },
              { label: 'Categories', value: '50+', icon: Globe },
              { label: 'Fast Delivery', value: '1-3 days', icon: Zap },
            ].map((stat, i) => (
              <div key={stat.label} className="text-center p-4 rounded-xl bg-white/70 backdrop-blur-sm border border-indigo-100 shadow-sm">
                <stat.icon size={18} className="mx-auto mb-2 text-violet-600" />
                <p className="text-xl font-bold text-slate-900">{stat.value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════ AI FEATURES ═══════════════════ */}
      <section className="relative py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-50 border border-violet-200 mb-4">
              <Cpu size={12} className="text-violet-600" />
              <span className="text-xs font-medium text-violet-700">AI-Powered Features</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-3">Built for the Next Generation</h2>
            <p className="text-sm text-slate-500 max-w-lg mx-auto">Every feature is designed to save you time and money with intelligent automation.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {AI_FEATURES.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
              >
                <Link href={feature.href} className="group block h-full">
                  <div className="relative h-full p-5 rounded-2xl bg-white border border-slate-200 hover:border-indigo-200 hover:shadow-lg transition-all overflow-hidden">
                    {/* Glow on hover */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-5 transition-opacity`} />
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4 shadow-sm`}>
                      <feature.icon size={20} className="text-white" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-800 mb-1.5">{feature.title}</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">{feature.desc}</p>
                    <div className="mt-3 flex items-center gap-1 text-xs font-medium text-slate-400 group-hover:text-violet-600 transition-colors">
                      Explore <ChevronRight size={12} />
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════ CATEGORIES ═══════════════════ */}
      <section className="py-12 bg-gradient-to-r from-slate-50 via-indigo-50/30 to-slate-50 border-y border-slate-200/50">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-lg font-bold text-slate-900 mb-5 flex items-center gap-2">
            <span className="w-1 h-5 bg-gradient-to-b from-violet-500 to-blue-500 rounded-full" />
            Shop by Category
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
            {CATEGORIES.map((cat, i) => (
              <motion.div
                key={cat.name}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.04 }}
              >
                <Link
                  href={`/products?category=${cat.slug}`}
                  className="flex-shrink-0 flex flex-col items-center gap-2 w-20 group"
                >
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${cat.color} flex items-center justify-center text-2xl shadow-md group-hover:scale-110 transition-transform`}>
                    {cat.emoji}
                  </div>
                  <span className="text-[11px] font-medium text-slate-600 group-hover:text-slate-900 transition-colors text-center leading-tight">{cat.name}</span>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════ AI PICKS ═══════════════════ */}
      {mounted && !isLoading && aiPickProducts.length > 0 && (
        <section className="py-12 bg-gradient-to-b from-white via-violet-50/20 to-white">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center shadow-sm">
                  <Brain size={16} className="text-white" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    AI Picks For You
                    <span className="inline-flex items-center gap-1 bg-violet-50 text-violet-600 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-violet-200">
                      <Sparkles size={9} /> Personalized
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500">Curated by AI based on trending products</p>
                </div>
              </div>
              <Link href="/shopping-assistant" className="text-xs text-violet-600 hover:text-violet-700 font-medium flex items-center gap-0.5 transition-colors">
                View All <ChevronRight size={12} />
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {aiPickProducts.map((product, i) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  viewport={{ once: true }}
                >
                  <div className="relative">
                    <ProductCard
                      product={product}
                      onAddToCart={() => handleAddToCart(product)}
                      onWishlist={() => handleWishlist(product)}
                    />
                    {product.aiConfidence && (
                      <div className="absolute -top-1 -right-1 bg-gradient-to-r from-violet-600 to-purple-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-lg shadow-violet-600/30">
                        {product.aiConfidence}% match
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════ TRENDING / SEARCH HISTORY ═══════════════════ */}
      <AnimatePresence>
        {mounted && searchHistory.length > 0 && !isLoading && trendingProducts.length > 0 && (
          <motion.section
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="py-10 border-y border-slate-200/50"
          >
            <div className="max-w-7xl mx-auto px-4">
              <div className="flex items-center gap-2 mb-5">
                <Flame size={16} className="text-orange-500" />
                <h2 className="text-base font-bold text-slate-900">
                  Because you searched &ldquo;{searchHistory[0]}&rdquo;
                </h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {trendingProducts.map((product, i) => (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                  >
                    <ProductCard
                      product={product}
                      onAddToCart={() => handleAddToCart(product)}
                      onWishlist={() => handleWishlist(product)}
                    />
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* ═══════════════════ FEATURED PRODUCTS ═══════════════════ */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="w-1 h-5 bg-gradient-to-b from-blue-500 to-cyan-500 rounded-full" />
              Featured Products
            </h2>
            <Link
              href="/products"
              className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-0.5 transition-colors"
            >
              View All <ArrowRight size={12} />
            </Link>
          </div>

          {isLoading || !mounted ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {[...Array(10)].map((_, i) => (
                <Skeleton key={i} className="h-56 rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {enrichedProducts.map((product, i) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  viewport={{ once: true }}
                >
                  <ProductCard
                    product={product}
                    onAddToCart={() => handleAddToCart(product)}
                    onWishlist={() => handleWishlist(product)}
                  />
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ═══════════════════ BEST DEALS ═══════════════════ */}
      {mounted && !isLoading && bestDeals.length > 0 && (
        <section className="py-12 bg-gradient-to-b from-white via-orange-50/20 to-white">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-sm">
                  <Tag size={16} className="text-white" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    Best Deals
                    <span className="inline-flex items-center gap-1 bg-red-50 text-red-600 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-red-200">
                      <Zap size={9} /> Limited Time
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500">Biggest discounts right now</p>
                </div>
              </div>
              <Link href="/products" className="text-xs text-orange-600 hover:text-orange-700 font-medium flex items-center gap-0.5 transition-colors">
                All Deals <ChevronRight size={12} />
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {bestDeals.map((product, i) => (
                <motion.div key={product.id} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} viewport={{ once: true }}>
                  <ProductCard product={product} onAddToCart={() => handleAddToCart(product)} onWishlist={() => handleWishlist(product)} />
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════ TOP RATED ═══════════════════ */}
      {mounted && !isLoading && topRated.length > 0 && (
        <section className="py-12 border-t border-slate-200/50">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-yellow-500 flex items-center justify-center shadow-sm">
                  <Star size={16} className="text-white" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Top Rated Products</h2>
                  <p className="text-xs text-slate-500">Highest customer ratings</p>
                </div>
              </div>
              <Link href="/products" className="text-xs text-amber-600 hover:text-amber-700 font-medium flex items-center gap-0.5 transition-colors">
                View All <ChevronRight size={12} />
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {topRated.map((product, i) => (
                <motion.div key={product.id} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} viewport={{ once: true }}>
                  <ProductCard product={product} onAddToCart={() => handleAddToCart(product)} onWishlist={() => handleWishlist(product)} />
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════ RECENTLY VIEWED ═══════════════════ */}
      {mounted && recentlyViewed.length > 0 && (
        <section className="py-12 bg-gradient-to-b from-slate-50 to-white border-t border-slate-200/50">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center shadow-sm">
                <Clock size={16} className="text-white" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Recently Viewed</h2>
                <p className="text-xs text-slate-500">Pick up where you left off</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {recentlyViewed.slice(0, 5).map((product, i) => (
                <motion.div key={product.id} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} viewport={{ once: true }}>
                  <ProductCard product={product} onAddToCart={() => handleAddToCart(product)} onWishlist={() => handleWishlist(product)} />
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════ TRUST BADGES ═══════════════════ */}
      <section className="py-10 border-t border-slate-200/50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Zap, title: 'Lightning Fast', desc: 'Free delivery on orders', color: 'text-amber-500' },
              { icon: Shield, title: 'Secure Payments', desc: 'Bank-level encryption', color: 'text-green-600' },
              { icon: Star, title: 'Top Rated', desc: 'Verified reviews only', color: 'text-blue-600' },
              { icon: TrendingUp, title: 'Best Prices', desc: 'AI tracks price drops', color: 'text-violet-600' },
            ].map((item) => (
              <div key={item.title} className="flex items-center gap-3 p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
                <item.icon size={20} className={item.color} />
                <div>
                  <p className="text-xs font-semibold text-slate-800">{item.title}</p>
                  <p className="text-[11px] text-slate-500">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════ CTA ═══════════════════ */}
      <section className="relative overflow-hidden py-16">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-50 to-violet-50" />
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-0 right-0 w-96 h-96 bg-violet-200 rounded-full blur-[100px]" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-200 rounded-full blur-[100px]" />
        </div>
        <div className="relative max-w-2xl mx-auto px-4 text-center">
          <h3 className="text-2xl font-bold text-slate-900 mb-3">
            Ready to Shop Smarter?
          </h3>
          <p className="text-sm text-slate-600 mb-6">
            Join thousands of shoppers using AI to find the best products at the best prices.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/shopping-assistant"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-600 to-blue-600 text-white rounded-xl font-semibold text-sm hover:from-violet-700 hover:to-blue-700 transition-colors shadow-lg shadow-violet-600/30"
            >
              <Brain size={16} />
              Start AI Shopping
            </Link>
            <Link
              href="/products"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-semibold text-sm hover:bg-slate-50 transition-colors shadow-sm"
            >
              Browse All Products
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}


