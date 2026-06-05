'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Package, MapPin, CreditCard, Bell, Shield, HelpCircle,
  Sparkles, Brain, Zap, ChevronRight, Star,
  Bot, Clock, ShoppingBag, LogOut, User, Wallet,
  BarChart3, CheckCircle, AlertTriangle, ArrowRight,
  MessageSquare, Settings, Gift, TrendingUp, Heart,
  ListChecks, History, XCircle, LayoutDashboard, Target,
} from 'lucide-react';
import { getCurrentUserRole, type AppRole } from '@/lib/admin-auth';
import { clearUserSession } from '@/lib/session';

// ─── Types ───────────────────────────────────────────────────────────────────

type Order = {
  id: string;
  dbId: number | null;
  date: string;
  status: 'delivered' | 'processing' | 'shipped' | 'cancelled';
  total: number;
  items: { name: string; qty: number; price: number; productId?: number | null }[];
  aiAssisted: boolean;
};

type AIFeature = {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  status: 'active' | 'ready' | 'setup';
  metric: string;
  href: string;
};

type AccountSection = {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  gradient: string;
  adminOnly?: boolean;
  visibleToRoles?: AppRole[];
};

// ─── Constants ───────────────────────────────────────────────────────────────

const AI_FEATURES: AIFeature[] = [
  {
    id: 'delegate',
    title: 'Smart Delegate',
    description: 'AI agent actively shopping on your behalf',
    icon: Bot,
    gradient: 'from-violet-600 to-purple-700',
    status: 'active',
    metric: '3 active tasks',
    href: '/smart-delegate',
  },
  {
    id: 'budget',
    title: 'AI Budget Tracker',
    description: 'Smart spending insights and budget alerts',
    icon: Wallet,
    gradient: 'from-green-500 to-emerald-600',
    status: 'active',
    metric: '₹24,500 this month',
    href: '/budget-tracker',
  },
  {
    id: 'alerts',
    title: 'Price Drop Alerts',
    description: 'AI monitors prices across platforms',
    icon: Bell,
    gradient: 'from-orange-500 to-amber-600',
    status: 'active',
    metric: '7 items tracked',
    href: '/price-alerts',
  },
  {
    id: 'predictor',
    title: 'Purchase Predictor',
    description: 'AI anticipates your next product need',
    icon: Brain,
    gradient: 'from-blue-500 to-indigo-600',
    status: 'ready',
    metric: '94% accuracy',
    href: '/purchase-predictor',
  },
];

const ACCOUNT_SECTIONS: AccountSection[] = [
  {
    id: 'orders',
    title: 'Your Orders',
    description: 'Track, return, or buy again — with AI summaries',
    icon: Package,
    href: '/orders',
    gradient: 'from-orange-500 to-amber-500',
  },
  {
    id: 'failed-orders',
    title: 'Failed Orders',
    description: 'Track failed checkouts, refunds & retry orders',
    icon: XCircle,
    href: '/failed-orders',
    gradient: 'from-red-500 to-rose-500',
  },
  {
    id: 'wishlist',
    title: 'Your Wishlist',
    description: 'Saved items with AI deal notifications',
    icon: Heart,
    href: '/wishlist',
    gradient: 'from-rose-500 to-pink-500',
  },
  {
    id: 'addresses',
    title: 'Your Addresses',
    description: 'Manage delivery addresses for fast checkout',
    icon: MapPin,
    href: '/addresses',
    gradient: 'from-blue-500 to-cyan-500',
  },
  {
    id: 'payment',
    title: 'Payment Methods',
    description: 'Saved cards, UPI, wallet, and net banking',
    icon: CreditCard,
    href: '/payment-methods',
    gradient: 'from-green-500 to-emerald-500',
  },
  {
    id: 'security',
    title: 'Login & Security',
    description: 'Password, 2FA, and connected accounts',
    icon: Shield,
    href: '/account/security',
    gradient: 'from-purple-500 to-violet-500',
  },
  {
    id: 'notifications',
    title: 'Notifications',
    description: 'Price alerts, AI updates, and order status',
    icon: Bell,
    href: '/account/notifications',
    gradient: 'from-pink-500 to-rose-500',
  },
  {
    id: 'ai-settings',
    title: 'AI Preferences',
    description: 'Configure how your AI delegate behaves',
    icon: Settings,
    href: '/ai-preferences',
    gradient: 'from-violet-500 to-purple-600',
  },
  {
    id: 'help',
    title: 'Help & Support',
    description: 'AI chat support, FAQs, and contact options',
    icon: HelpCircle,
    href: '/account/help',
    gradient: 'from-teal-500 to-cyan-500',
  },
  {
    id: 'admin-panel',
    title: 'Admin Panel',
    description: 'Analytics, charts, system stats & platform overview',
    icon: LayoutDashboard,
    href: '/admin',
    gradient: 'from-slate-600 to-gray-800',
    adminOnly: true,
    visibleToRoles: ['admin', 'analytics'],
  },
  {
    id: 'observability',
    title: 'Observability Dashboard',
    description: 'Transaction monitoring, stuck workflows & audit trail',
    icon: BarChart3,
    href: '/observability',
    gradient: 'from-indigo-500 to-blue-600',
    adminOnly: true,
    visibleToRoles: ['admin', 'analytics', 'observability'],
  },
  {
    id: 'learning',
    title: 'Self-Learning Dashboard',
    description: 'AI reinforcement & supervised learning management',
    icon: Brain,
    href: '/admin/learning',
    gradient: 'from-purple-600 to-fuchsia-600',
    adminOnly: true,
    visibleToRoles: ['admin', 'analytics', 'reinforced-learning'],
  },
  {
    id: 'metrics-validation',
    title: 'Metrics Validation',
    description: 'Cross-check Avg Score & Time Saved metrics per user & query',
    icon: CheckCircle,
    href: '/shopping-assistant/metrics/validation?from=default',
    gradient: 'from-amber-500 to-orange-500',
    adminOnly: true,
    visibleToRoles: ['admin', 'analytics'],
  },
  {
    id: 'learning-insights',
    title: 'Learning Insights',
    description: 'Dimension effectiveness, weight changes & ranking performance',
    icon: Brain,
    href: '/admin/learning-insights',
    gradient: 'from-violet-500 to-purple-600',
    adminOnly: true,
    visibleToRoles: ['admin', 'analytics'],
  },
  {
    id: 'scoring-dimensions',
    title: 'Scoring Dimensions',
    description: 'Manage 22 ranking dimensions & weight distribution',
    icon: Target,
    href: '/admin/scoring-dimensions',
    gradient: 'from-blue-500 to-indigo-600',
    adminOnly: true,
    visibleToRoles: ['admin', 'analytics'],
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function FailedOrdersPreview() {
  const [failures, setFailures] = useState<Array<{ id: number; type: string; reason: string; date: string; retryable: boolean; amount: number | null }>>([]);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('failedCheckouts') || '[]');
      const mapped = stored.slice(0, 3).map((f: any, idx: number) => ({
        id: idx,
        type: f.failureCode || 'unknown',
        reason: f.failureReason || f.error || 'Unknown failure',
        date: f.timestamp || new Date().toISOString(),
        retryable: f.failureCode !== 'NO_MATCHING_PRODUCT',
        amount: f.items?.[0]?.budget ? parseInt(f.items[0].budget) : null,
      }));
      setFailures(mapped);
    } catch { }
  }, []);

  if (failures.length === 0) return null;

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <XCircle className="w-5 h-5 text-red-500" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Failed Orders / Checkouts</h2>
          <span className="text-xs bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 font-semibold px-2 py-0.5 rounded-full">
            {failures.length}
          </span>
        </div>
        <Link href="/failed-orders" className="text-sm text-red-600 hover:text-red-700 font-medium flex items-center gap-1">
          View All <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
        {failures.map((f, idx) => (
          <div key={f.id}
            className={`flex items-center gap-3 p-4 ${idx < failures.length - 1 ? 'border-b border-gray-100 dark:border-gray-800' : ''} hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors`}>
            <div className="w-10 h-10 bg-red-50 dark:bg-red-900/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-red-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">{f.reason}</span>
                {f.retryable && (
                  <span className="text-[10px] font-semibold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded-full">
                    Retryable
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {new Date(f.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
            {f.amount && (
              <p className="text-sm font-bold text-gray-900 dark:text-white">₹{f.amount.toLocaleString('en-IN')}</p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-3">
        <Link href="/failed-orders"
          className="block w-full text-center py-2.5 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors">
          View All Failed Orders & Refund Status →
        </Link>
      </div>
    </section>
  );
}

function StatusBadge({ status }: { status: Order['status'] }) {
  const map = {
    delivered: { label: 'Delivered', className: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' },
    shipped: { label: 'Shipped', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' },
    processing: { label: 'Processing', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' },
    cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
  };
  const entry = map[status as keyof typeof map] ?? { label: String(status ?? 'Unknown'), className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400' };
  const { label, className } = entry;
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${className}`}>{label}</span>;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AccountPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<{ email: string; name: string; provider?: string } | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [cartCount, setCartCount] = useState(0);
  const [wishlistCount, setWishlistCount] = useState(0);

  useEffect(() => {
    const email = localStorage.getItem('userEmail');
    const token = localStorage.getItem('authToken');
    if (!email || !token) {
      router.push('/signin');
      return;
    }
    const provider = token.startsWith('oauth-google') ? 'Google' : token.startsWith('oauth-microsoft') ? 'Microsoft' : undefined;
    setUser({ email, name: email.split('@')[0], provider });

    // Load real cart / wishlist counts from localStorage
    try {
      const cart = JSON.parse(localStorage.getItem('cart') || '[]');
      setCartCount(cart.reduce((s: number, i: any) => s + (i.quantity || 1), 0));
      const wl = JSON.parse(localStorage.getItem('wishlist') || '[]');
      setWishlistCount(wl.length);
    } catch { }

    // Fetch orders from DB API, fall back to localStorage
    fetch('/api/orders', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('failed');
        return res.json();
      })
      .then((data) => {
        const dbOrders: Order[] = Array.isArray(data.orders)
          ? data.orders.map((o: any) => ({
            id: o.orderNumber || o.id,
            dbId: o.id || null,
            date: o.createdAt || new Date().toISOString(),
            status: (['delivered', 'processing', 'shipped', 'cancelled'].includes(o.status)
              ? o.status : 'processing') as Order['status'],
            total: Number(o.total) || 0,
            items: Array.isArray(o.items) ? o.items.map((i: any) => ({
              name: i.productName || i.name || 'Product',
              qty: i.quantity || 1,
              price: Number(i.price) || 0,
              productId: i.productId && Number.isInteger(Number(i.productId)) && Number(i.productId) > 0 ? Number(i.productId) : null,
            })) : [],
            aiAssisted: Boolean(o.aiAssisted),
          }))
          : [];

        if (dbOrders.length > 0) {
          setOrders(dbOrders);
        } else {
          // Fall back to localStorage if DB is empty
          loadLocalOrders();
        }
      })
      .catch(() => loadLocalOrders());

    function loadLocalOrders() {
      try {
        const saved = JSON.parse(localStorage.getItem('orders') || 'null');
        if (Array.isArray(saved) && saved.length > 0) {
          const normalized: Order[] = saved.map((o: any) => ({
            id: o.id || `ORD-${Date.now()}`,
            dbId: null,
            date: o.date || o.createdAt || new Date().toISOString(),
            status: (['delivered', 'processing', 'shipped', 'cancelled'].includes(o.status)
              ? o.status
              : o.status === 'confirmed' ? 'processing' : 'processing') as Order['status'],
            total: o.total || 0,
            items: Array.isArray(o.items)
              ? o.items.map((i: any) => ({
                name: i.name || 'Product',
                qty: i.quantity || i.qty || 1,
                price: i.price || 0,
              }))
              : [],
            aiAssisted: o.aiAssisted === true ||
              (o.items && o.items.some((i: any) =>
                (i.name || '').match(/5G|5-Star|Inverter|Pro Max|Galaxy|Pixel|MacBook|AirPods/i)
              )),
          }));
          setOrders(normalized);
        }
      } catch { }
    }

    setMounted(true);
  }, [router]);

  const handleLogout = () => {
    clearUserSession();
    localStorage.removeItem('authToken');
    localStorage.removeItem('userEmail');
    window.dispatchEvent(new Event('authUpdated'));
    router.push('/');
  };

  if (!mounted || !user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const initials = user.name.slice(0, 2).toUpperCase();
  const totalSpend = orders.filter(o => o.status !== 'cancelled')
    .reduce((s, o) => s + o.total, 0);
  const aiAssistedCount = orders.filter(o => o.aiAssisted).length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* ── Hero Banner ─────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-violet-600 via-purple-700 to-blue-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col sm:flex-row sm:items-center gap-6">
            {/* Avatar */}
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center text-3xl font-bold shadow-xl">
                {initials}
              </div>
              {user.provider && (
                <span className="absolute -bottom-1 -right-1 bg-white text-violet-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-violet-200 shadow">
                  {user.provider === 'Google' ? 'G' : 'M'}
                </span>
              )}
            </div>

            {/* User info */}
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold mb-1">Hello, {user.name}!</h1>
              <p className="text-white/80 text-sm">{user.email}</p>
              {user.provider && (
                <span className="mt-1 inline-block text-xs bg-white/20 px-2 py-0.5 rounded-full">
                  Signed in via {user.provider}
                </span>
              )}
            </div>

            {/* Stat pills */}
            <div className="flex flex-wrap gap-3">
              {[
                { label: 'Total Orders', value: orders.length },
                { label: 'Cart Items', value: cartCount },
                { label: 'Wishlist', value: wishlistCount },
                { label: 'AI-Assisted', value: aiAssistedCount },
              ].map(({ label, value }) => (
                <div key={label} className="bg-white/15 backdrop-blur-sm rounded-xl px-4 py-2.5 text-center min-w-[80px]">
                  <p className="text-2xl font-bold">{value}</p>
                  <p className="text-xs text-white/80 mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="self-start sm:self-center flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-sm font-medium transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">

        {/* ── AI Features Section ─────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-violet-600" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Your AI Features</h2>
            <span className="text-xs bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 font-semibold px-2 py-0.5 rounded-full ml-1">
              DelegateCart Exclusive
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {AI_FEATURES.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                >
                  <Link href={feature.href}>
                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 hover:shadow-md hover:border-violet-300 dark:hover:border-violet-700 transition-all group cursor-pointer h-full">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-3 shadow-sm`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-0.5 group-hover:text-violet-700 dark:group-hover:text-violet-400 transition-colors">
                        {feature.title}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-2">{feature.description}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/30 px-2 py-0.5 rounded-full">
                          {feature.metric}
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${feature.status === 'active'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400'
                          }`}>
                          {feature.status.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* ── Recent Orders ───────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-orange-500" />
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Your Orders</h2>
            </div>
            <Link href="/orders" className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
              View All <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
            {orders.slice(0, 3).map((order, idx) => (
              <div
                key={order.id}
                className={`flex flex-col sm:flex-row sm:items-center gap-3 p-4 ${idx < orders.length - 1 ? 'border-b border-gray-100 dark:border-gray-800' : ''
                  } hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors`}
              >
                {/* Order icon */}
                <div className="w-10 h-10 bg-orange-50 dark:bg-orange-900/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Package className="w-5 h-5 text-orange-500" />
                </div>

                {/* Order details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{order.id}</span>
                    <StatusBadge status={order.status} />
                    {order.aiAssisted && (
                      <span className="text-[10px] font-semibold bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-400 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                        <Sparkles className="w-2.5 h-2.5" /> AI
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {order.items.map(i => i.name).join(', ')}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    {new Date(order.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>

                {/* Price & Actions */}
                <div className="flex items-center gap-3 sm:text-right">
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">
                      ₹{order.total.toLocaleString('en-IN')}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{order.items.length} item{order.items.length > 1 ? 's' : ''}</p>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => router.push(`/orders/${order.dbId || order.id}`)}
                      className="text-xs px-2.5 py-1 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300 font-medium">
                      Details
                    </button>
                    {order.status === 'delivered' && (
                      <button
                        onClick={() => {
                          try {
                            const cart: any[] = JSON.parse(localStorage.getItem('cart') || '[]');
                            order.items.forEach((item) => {
                              const existing = cart.find((c: any) => c.name === item.name);
                              if (existing) {
                                existing.quantity = (existing.quantity || 1) + item.qty;
                              } else {
                                const pid = item.productId ? String(item.productId) : `rebuy-${order.id}`;
                                cart.push({
                                  id: `cart-${Date.now()}-${Math.random()}`,
                                  productId: pid,
                                  name: item.name,
                                  price: item.price,
                                  quantity: item.qty,
                                  image: '/product-placeholder.svg',
                                  stock: 99,
                                });
                              }
                            });
                            localStorage.setItem('cart', JSON.stringify(cart));
                            window.dispatchEvent(new Event('cartUpdated'));
                            router.push('/cart');
                          } catch { }
                        }}
                        className="text-xs px-2.5 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 transition-colors font-medium">
                        Buy Again
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {orders.length === 0 && (
              <div className="text-center py-12">
                <ShoppingBag className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">No orders yet</p>
                <Link href="/products" className="mt-3 inline-block text-sm text-blue-600 font-medium hover:text-blue-700">
                  Start Shopping
                </Link>
              </div>
            )}
          </div>

          {/* Spending summary */}
          {orders.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-3">
              {[
                { label: 'Total Spent', value: `₹${totalSpend.toLocaleString('en-IN')}`, color: 'text-gray-900 dark:text-white', href: '/spending' },
                { label: 'AI-Assisted', value: `${aiAssistedCount} orders`, color: 'text-violet-700 dark:text-violet-400', href: '/orders' },
                { label: 'Avg. Order', value: orders.length ? `₹${Math.round(totalSpend / orders.length).toLocaleString('en-IN')}` : '–', color: 'text-gray-900 dark:text-white', href: '/order-insights' },
              ].map(({ label, value, color, href }) => (
                <Link key={label} href={href}>
                  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3 text-center hover:shadow-md hover:border-blue-300 transition-all cursor-pointer">
                    <p className={`font-bold text-sm ${color}`}>{value}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* ── Failed Orders / Checkouts ─────────────────────────── */}
        <FailedOrdersPreview />

        {/* ── Account Sections Grid ───────────────────────────────── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <User className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Account Settings</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {ACCOUNT_SECTIONS.filter(s => {
              if (!s.adminOnly) return true;
              if (s.visibleToRoles) {
                const role = getCurrentUserRole();
                return s.visibleToRoles.includes(role);
              }
              return ['admin@delegatecart.com', 'admin@example.com'].includes(user?.email || '');
            }).map((section, i) => {
              const Icon = section.icon;
              return (
                <motion.div
                  key={section.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Link href={section.href}>
                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition-all group cursor-pointer h-full flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${section.gradient} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 dark:text-white text-sm group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">
                          {section.title}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{section.description}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors flex-shrink-0 mt-0.5" />
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* ── AI Insights Banner ──────────────────────────────────── */}
        <section>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-violet-600 to-purple-700 rounded-2xl p-6 text-white"
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-inner">
                <Bot className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold mb-1">Your AI Delegate is Ready</h3>
                <p className="text-white/80 text-sm">
                  Tell DelegateCart what you need — your AI agent will search, compare prices, and
                  recommend the best products across all platforms. You approve before anything is
                  purchased.
                </p>
              </div>
              <Link href="/shopping-assistant">
                <button className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 bg-white text-violet-700 font-semibold rounded-xl hover:shadow-lg transition-all text-sm">
                  <Zap className="w-4 h-4" />
                  Launch Smart Assistant
                </button>
              </Link>
            </div>

            {/* Quick insight pills */}
            <div className="mt-4 flex flex-wrap gap-2">
              {[
                { icon: TrendingUp, text: 'Saved ₹4,200 via AI price comparison' },
                { icon: Clock, text: '3 tasks completed this week' },
                { icon: BarChart3, text: '88% avg confidence score' },
              ].map(({ icon: I, text }) => (
                <div key={text} className="flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1 text-xs text-white/90">
                  <I className="w-3 h-3" />
                  {text}
                </div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* ── Help & Support Quick Links ──────────────────────────── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <HelpCircle className="w-5 h-5 text-teal-600" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Help & Support</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                icon: MessageSquare,
                title: 'AI Chat Support',
                description: 'Instant answers via our AI support agent',
                action: 'Start Chat',
                href: '/ai-assistant',
                color: 'violet',
              },
              {
                icon: Gift,
                title: 'Returns & Refunds',
                description: 'Easy returns with AI tracking support',
                action: 'Initiate Return',
                href: '/account/returns',
                color: 'orange',
              },
              {
                icon: Star,
                title: 'Rate & Review',
                description: 'Share your experience with products',
                action: 'Write Review',
                href: '/products',
                color: 'yellow',
              },
            ].map(({ icon: Icon, title, description, action, href, color }) => (
              <div
                key={title}
                className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 hover:shadow-md transition-all"
              >
                <div className={`w-10 h-10 rounded-xl bg-${color}-50 dark:bg-${color}-900/20 flex items-center justify-center mb-3`}>
                  <Icon className={`w-5 h-5 text-${color}-600 dark:text-${color}-400`} />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-1">{title}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{description}</p>
                <Link
                  href={href}
                  className={`text-xs font-semibold text-${color}-600 dark:text-${color}-400 hover:underline flex items-center gap-1`}
                >
                  {action} <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}
