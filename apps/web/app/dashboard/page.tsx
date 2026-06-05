'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShoppingCart,
  Sparkles,
  TrendingUp,
  Heart,
  ArrowRight,
  Clock,
  Package,
  User,
  Brain,
  Shield,
  BarChart3,
  Eye,
  Activity,
  ListChecks,
  Wallet,
  ShieldCheck,
  BookOpen,
} from 'lucide-react';
import { getCurrentUserRole, type AppRole, DEMO_USERS, getCurrentSubscription } from '@/lib/admin-auth';

// ── Role configuration: quick actions per role ──────────────────────────────
const ROLE_ACTIONS: Record<AppRole, { icon: any; title: string; desc: string; href: string; gradient: string }[]> = {
  admin: [
    { icon: Shield, title: 'Admin Panel', desc: 'Users, stats & system health', href: '/admin', gradient: 'from-red-500 to-red-600' },
    { icon: Brain, title: 'Self-Learning', desc: 'AI reinforcement & supervised learning', href: '/admin/learning', gradient: 'from-purple-500 to-fuchsia-600' },
    { icon: Eye, title: 'Observability', desc: 'Transactions & audit trail', href: '/observability', gradient: 'from-indigo-500 to-blue-600' },
    { icon: ShieldCheck, title: 'Metrics Validation', desc: 'Search quality & ranking analysis', href: '/shopping-assistant/metrics/validation', gradient: 'from-amber-500 to-orange-500' },
    { icon: BarChart3, title: 'Analytics', desc: 'Sales & traffic analytics', href: '/admin/analytics', gradient: 'from-cyan-500 to-blue-500' },
    { icon: ListChecks, title: 'Shopping List', desc: 'AI-powered shopping assistant', href: '/shopping-list', gradient: 'from-green-500 to-emerald-600' },
  ],
  analytics: [
    { icon: Shield, title: 'Admin Panel', desc: 'Analytics, stats & system health', href: '/admin', gradient: 'from-red-500 to-red-600' },
    { icon: BarChart3, title: 'Analytics', desc: 'Sales & traffic analytics', href: '/admin/analytics', gradient: 'from-cyan-500 to-blue-500' },
    { icon: Brain, title: 'Self-Learning', desc: 'AI learning records', href: '/admin/learning', gradient: 'from-purple-500 to-fuchsia-600' },
    { icon: Eye, title: 'Observability', desc: 'Transactions & audit trail', href: '/observability', gradient: 'from-indigo-500 to-blue-600' },
    { icon: ShieldCheck, title: 'Metrics Validation', desc: 'Search quality analysis', href: '/shopping-assistant/metrics/validation', gradient: 'from-amber-500 to-orange-500' },
    { icon: ListChecks, title: 'Shopping List', desc: 'AI-powered shopping assistant', href: '/shopping-list', gradient: 'from-green-500 to-emerald-600' },
  ],
  'reinforced-learning': [
    { icon: Brain, title: 'Self-Learning', desc: 'Reinforced learning dashboard', href: '/admin/learning', gradient: 'from-purple-500 to-fuchsia-600' },
    { icon: BookOpen, title: 'Smart Delegate', desc: 'AI delegation results', href: '/smart-delegate', gradient: 'from-pink-500 to-rose-600' },
    { icon: ListChecks, title: 'Shopping List', desc: 'AI-powered shopping assistant', href: '/shopping-list', gradient: 'from-green-500 to-emerald-600' },
    { icon: ShoppingCart, title: 'Browse Products', desc: 'Explore our product catalog', href: '/products', gradient: 'from-blue-500 to-blue-600' },
  ],
  observability: [
    { icon: Eye, title: 'Observability', desc: 'Transactions & audit trail', href: '/observability', gradient: 'from-indigo-500 to-blue-600' },
    { icon: Brain, title: 'Self-Learning', desc: 'AI learning records', href: '/admin/learning', gradient: 'from-purple-500 to-fuchsia-600' },
    { icon: Activity, title: 'System Health', desc: 'Monitor platform health', href: '/observability', gradient: 'from-emerald-500 to-green-600' },
    { icon: ListChecks, title: 'Shopping List', desc: 'AI-powered shopping assistant', href: '/shopping-list', gradient: 'from-green-500 to-emerald-600' },
  ],
  aiplus: [
    { icon: Sparkles, title: 'AI+ Assistant', desc: 'Premium AI recommendations', href: '/ai-assistant', gradient: 'from-purple-500 to-purple-600' },
    { icon: ListChecks, title: 'Shopping List', desc: 'AI-powered auto-checkout', href: '/shopping-list', gradient: 'from-green-500 to-emerald-600' },
    { icon: BookOpen, title: 'Smart Delegate', desc: 'AI delegation & search', href: '/smart-delegate', gradient: 'from-pink-500 to-rose-600' },
    { icon: ShoppingCart, title: 'Browse Products', desc: 'Explore our product catalog', href: '/products', gradient: 'from-blue-500 to-blue-600' },
  ],
  basic: [
    { icon: ShoppingCart, title: 'Browse Products', desc: 'Explore our full product catalog', href: '/products', gradient: 'from-blue-500 to-blue-600' },
    { icon: Sparkles, title: 'Smart Assistant', desc: 'Get smart recommendations', href: '/ai-assistant', gradient: 'from-purple-500 to-purple-600' },
    { icon: ListChecks, title: 'Shopping List', desc: 'AI-powered shopping assistant', href: '/shopping-list', gradient: 'from-green-500 to-emerald-600' },
    { icon: Heart, title: 'Wishlist', desc: 'Your saved items', href: '/wishlist', gradient: 'from-red-500 to-red-600' },
  ],
  customer: [
    { icon: ShoppingCart, title: 'Browse Products', desc: 'Explore our full product catalog', href: '/products', gradient: 'from-blue-500 to-blue-600' },
    { icon: Sparkles, title: 'Smart Assistant', desc: 'Get smart recommendations', href: '/ai-assistant', gradient: 'from-purple-500 to-purple-600' },
    { icon: TrendingUp, title: 'Trending Now', desc: 'Popular products this week', href: '/products?trending=true', gradient: 'from-green-500 to-green-600' },
    { icon: Heart, title: 'Wishlist', desc: 'Your saved items', href: '/wishlist', gradient: 'from-red-500 to-red-600' },
  ],
};

const ROLE_LABELS: Record<AppRole, { label: string; color: string; desc: string }> = {
  admin: { label: 'Admin', color: 'text-red-600 bg-red-50 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800', desc: 'Full system access' },
  analytics: { label: 'Analytics', color: 'text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800', desc: 'Data & metrics access' },
  'reinforced-learning': { label: 'Reinforced Learning', color: 'text-pink-600 bg-pink-50 border-pink-200 dark:bg-pink-900/20 dark:text-pink-400 dark:border-pink-800', desc: 'AI learning management' },
  observability: { label: 'Observability', color: 'text-indigo-600 bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-800', desc: 'System monitoring' },
  aiplus: { label: 'AI+', color: 'text-purple-600 bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800', desc: 'Premium AI features' },
  basic: { label: 'Basic', color: 'text-slate-600 bg-slate-50 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600', desc: 'Standard access' },
  customer: { label: 'Customer', color: 'text-slate-600 bg-slate-50 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600', desc: 'Shopping access' },
};

function ActivitySummary({ role }: { role: AppRole }) {
  const [orders, setOrders] = useState<any[]>([]);
  const [sessions, setSessions] = useState(0);
  const [totalSpend, setTotalSpend] = useState(0);

  useEffect(() => {
    try {
      const storedOrders = JSON.parse(localStorage.getItem('orders') || '[]');
      setOrders(storedOrders.slice(0, 5));
      setTotalSpend(storedOrders.reduce((s: number, o: any) => s + (o.total || 0), 0));
    } catch { /* ignore */ }
    try {
      const storedSessions = JSON.parse(localStorage.getItem('dc-search-sessions') || '[]');
      setSessions(storedSessions.length);
    } catch { /* ignore */ }
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white"><ShoppingCart className="w-4 h-4" /></div>
          <span className="text-sm font-semibold text-slate-900 dark:text-white">Orders</span>
        </div>
        <p className="text-3xl font-bold text-slate-900 dark:text-white">{orders.length}</p>
        <p className="text-xs text-slate-500 mt-1">Total orders placed</p>
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 text-white"><Wallet className="w-4 h-4" /></div>
          <span className="text-sm font-semibold text-slate-900 dark:text-white">Spending</span>
        </div>
        <p className="text-3xl font-bold text-slate-900 dark:text-white">
          {totalSpend > 0 ? `₹${totalSpend.toLocaleString('en-IN')}` : '₹0'}
        </p>
        <p className="text-xs text-slate-500 mt-1">Total spend across orders</p>
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-fuchsia-600 text-white"><Activity className="w-4 h-4" /></div>
          <span className="text-sm font-semibold text-slate-900 dark:text-white">AI Sessions</span>
        </div>
        <p className="text-3xl font-bold text-slate-900 dark:text-white">{sessions}</p>
        <p className="text-xs text-slate-500 mt-1">Search & validation sessions</p>
      </motion.div>
    </div>
  );
}

function RecentOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  useEffect(() => {
    try { setOrders(JSON.parse(localStorage.getItem('orders') || '[]').slice(0, 5)); } catch { /* ignore */ }
  }, []);
  if (orders.length === 0) return null;
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Recent Orders</h3>
        <Link href="/orders" className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
          View All <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-900">
            <tr>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Order</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Total</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Status</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Date</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o: any, i: number) => (
              <tr key={i} className="border-t border-slate-100 dark:border-slate-700">
                <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-white">{o.orderNumber || o.id}</td>
                <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">₹{(o.total || 0).toLocaleString('en-IN')}</td>
                <td className="px-4 py-2.5">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${o.status === 'confirmed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : o.status === 'pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                    }`}>{o.status || 'unknown'}</span>
                </td>
                <td className="px-4 py-2.5 text-xs text-slate-500">{o.createdAt ? new Date(o.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ email: string; name?: string; displayName?: string } | null>(null);
  const [role, setRole] = useState<AppRole>('customer');
  const [subscription, setSubscription] = useState<string>('BASIC');

  useEffect(() => {
    const userEmail = localStorage.getItem('userEmail');
    const authToken = localStorage.getItem('authToken');
    if (!userEmail || !authToken) { router.push('/signin'); return; }

    const currentRole = getCurrentUserRole();
    const currentSub = getCurrentSubscription();
    const demoUser = DEMO_USERS.find(u => u.email === userEmail.toLowerCase());

    setUser({
      email: userEmail,
      name: userEmail.split('@')[0],
      displayName: demoUser?.displayName || userEmail.split('@')[0],
    });
    setRole(currentRole);
    setSubscription(currentSub);
  }, [router]);

  const roleInfo = ROLE_LABELS[role] || ROLE_LABELS.customer;
  const actions = ROLE_ACTIONS[role] || ROLE_ACTIONS.customer;

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-950">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-950">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Welcome + Role Badge */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <div className="flex items-start sm:items-end justify-between flex-wrap gap-4">
            <div>
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-1">Welcome back</p>
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white">
                {user.displayName || user.name}
              </h2>
              <div className="flex items-center gap-2 mt-2">
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${roleInfo.color}`}>
                  {roleInfo.label}
                </span>
                {subscription === 'AI_PLUS' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800">
                    <Sparkles className="w-3 h-3" /> AI+
                  </span>
                )}
                <span className="text-xs text-slate-400">{user.email}</span>
              </div>
            </div>
            <Link href="/profile">
              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl text-sm font-semibold hover:shadow-lg transition-all">
                <User className="w-4 h-4" /> Profile Settings
              </motion.button>
            </Link>
          </div>
        </motion.div>

        {/* Activity Summary */}
        <ActivitySummary role={role} />

        {/* Quick Actions — role-specific */}
        <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="mb-10">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {actions.map((action) => {
              const Icon = action.icon;
              return (
                <motion.div key={action.href} whileHover={{ y: -3 }}>
                  <Link href={action.href}>
                    <div className="h-full p-5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:shadow-md hover:border-blue-200 dark:hover:border-blue-800 transition-all cursor-pointer group">
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${action.gradient} flex items-center justify-center mb-3 group-hover:shadow-lg transition-all`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-0.5">{action.title}</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{action.desc}</p>
                      <div className="mt-3 flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-medium text-xs group-hover:gap-2.5 transition-all">
                        Open <ArrowRight className="w-3 h-3" />
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </motion.section>

        {/* Recent Orders */}
        <RecentOrders />

        {/* Smart CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="p-6 sm:p-8 bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-800 rounded-xl text-white text-center"
        >
          <h3 className="text-xl sm:text-2xl font-bold mb-2">Ready to Find Your Perfect Product?</h3>
          <p className="mb-5 text-sm opacity-90">Use our AI assistant to get personalized recommendations</p>
          <Link href="/ai-assistant">
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              className="px-7 py-2.5 bg-white text-blue-600 rounded-xl text-sm font-semibold hover:shadow-lg transition-all inline-flex items-center gap-2">
              Launch Smart Assistant <ArrowRight className="w-4 h-4" />
            </motion.button>
          </Link>
        </motion.div>
      </main>
    </div>
  );
}
