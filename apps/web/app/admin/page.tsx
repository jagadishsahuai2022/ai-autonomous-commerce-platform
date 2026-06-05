'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Package, ShoppingCart, Brain, BarChart3, ArrowRight,
  Database, Shield, Activity, RefreshCw, Loader2, ShieldCheck,
  Eye, X, AlertTriangle, Search, Zap, Award, Sliders,
} from 'lucide-react';
import Link from 'next/link';
import { getCurrentUserRole, type AppRole } from '@/lib/admin-auth';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid,
  Area, AreaChart, Legend,
} from 'recharts';

// ── Types ──────────────────────────────────────────────────
interface AdminStats {
  totalUsers: number;
  totalProducts: number;
  activeOrders: number;
  totalSellers: number;
  learningRecords: number;
  validationSessions: number;
  recentOrders7d: number;
  recentSessions24h: number;
  pendingApprovals: number;
  dataSource: string;
}

interface AnalyticsData {
  dataSource: string;
  users: { byRole: { role: string; count: number }[]; signupTrend: { day: string; count: number }[] };
  orders: { byStatus: { status: string; count: number }[]; trend: { day: string; count: number; total: number }[]; topUsers: { name: string; email: string; total: number; count: number }[] };
  learning: { trend: { day: string; count: number }[]; byUser: { user: string; count: number }[]; topQueries: { query: string; count: number }[]; stats: { total: number; enriched: number; active: number } };
  validation: { trend: { day: string; count: number }[]; byUser: { user: string; count: number }[] };
  products: { byCategory: { category: string; count: number }[]; lowStock: { name: string; stock: number; category: string }[] };
}

const CHART_COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4'];
const ROLE_COLORS: Record<string, string> = { admin: '#ef4444', analytics: '#3b82f6', aiplus: '#a855f7', observability: '#6366f1', 'reinforced-learning': '#ec4899', basic: '#6b7280', customer: '#22c55e' };

function AnalyticsModal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
          onClick={e => e.stopPropagation()} className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"><X className="w-5 h-5 text-slate-500" /></button>
          </div>
          <div className="p-6 overflow-y-auto max-h-[70vh]">{children}</div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function ChartCard({ title, icon: Icon, gradient, children, onClick }: { title: string; icon: any; gradient: string; children: React.ReactNode; onClick?: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} whileHover={onClick ? { scale: 1.01 } : undefined}
      onClick={onClick} className={`bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden ${onClick ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''}`}>
      <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
        <div className={`p-1.5 rounded-lg bg-gradient-to-br ${gradient} text-white`}><Icon className="w-3.5 h-3.5" /></div>
        <span className="text-sm font-semibold text-slate-800 dark:text-white">{title}</span>
        {onClick && <span className="ml-auto text-[10px] text-slate-400 font-medium">Click for details</span>}
      </div>
      <div className="p-4">{children}</div>
    </motion.div>
  );
}

function CTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.color }} />{p.name}: <strong>{typeof p.value === 'number' ? p.value.toLocaleString('en-IN') : p.value}</strong>
        </p>
      ))}
    </div>
  );
}

export default function AdminPanel() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [strictProd, setStrictProd] = useState(false);
  const [useRealDbData, setUseRealDbData] = useState(false);
  const [allowExternal, setAllowExternal] = useState(true);
  const [modal, setModal] = useState<{ title: string; data: any; type: string } | null>(null);
  const [currentRole, setCurrentRole] = useState<AppRole>('admin');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setStrictProd(localStorage.getItem('dc-strict-prod-mode') === 'true');
      setUseRealDbData(localStorage.getItem('dc-use-real-db-data') === 'true');
      setAllowExternal(localStorage.getItem('dc-allow-external-products') !== 'false');
      setCurrentRole(getCurrentUserRole());
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [sr, ar] = await Promise.all([fetch('/api/admin/stats'), fetch('/api/admin/analytics')]);
      if (sr.ok) setStats(await sr.json());
      if (ar.ok) setAnalytics(await ar.json());
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleStrictProd = () => { const n = !strictProd; setStrictProd(n); localStorage.setItem('dc-strict-prod-mode', String(n)); };
  const toggleRealDbData = () => { const n = !useRealDbData; setUseRealDbData(n); localStorage.setItem('dc-use-real-db-data', String(n)); };
  const toggleAllowExternal = () => { const n = !allowExternal; setAllowExternal(n); localStorage.setItem('dc-allow-external-products', String(n)); window.dispatchEvent(new CustomEvent('externalProductsToggle', { detail: { allowed: n } })); };
  const fmtDay = (d: string) => { try { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }); } catch { return d; } };

  const userRolePie = useMemo(() => (analytics?.users.byRole || []).map(r => ({ ...r, fill: ROLE_COLORS[r.role] || '#94a3b8' })), [analytics]);
  const orderStatusPie = useMemo(() => (analytics?.orders.byStatus || []).map((r, i) => ({ ...r, fill: CHART_COLORS[i % CHART_COLORS.length] })), [analytics]);

  const statCards = [
    { label: 'Total Users', value: stats?.totalUsers, icon: Users, gradient: 'from-blue-500 to-blue-600', href: currentRole === 'admin' ? '/admin/dashboard' : '/admin' },
    { label: 'Products', value: stats?.totalProducts, icon: Package, gradient: 'from-green-500 to-emerald-600', href: '/products' },
    { label: 'Orders', value: stats?.activeOrders, icon: ShoppingCart, gradient: 'from-purple-500 to-violet-600', href: '/orders' },
    { label: 'AI Learning', value: stats?.learningRecords, icon: Brain, gradient: 'from-fuchsia-500 to-pink-600', href: '/admin/learning' },
    { label: 'Validations', value: stats?.validationSessions, icon: ShieldCheck, gradient: 'from-amber-500 to-orange-600', href: '/shopping-assistant/metrics/validation' },
    { label: 'Sessions 24h', value: stats?.recentSessions24h, icon: Activity, gradient: 'from-cyan-500 to-teal-600', href: '/shopping-assistant/metrics/validation' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-1">Admin Dashboard</h1>
              <p className="text-slate-600 dark:text-gray-400 text-sm">Real-time analytics & system health</p>
            </div>
            <div className="flex items-center gap-3">
              <span data-testid="data-source-badge" className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${stats?.dataSource === 'database' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                <Database className="w-3 h-3" />{stats?.dataSource === 'database' ? 'Live DB' : stats?.dataSource || 'Loading...'}
              </span>
              <button onClick={toggleStrictProd} data-testid="strict-prod-toggle"
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${strictProd ? 'bg-red-50 text-red-700 border-red-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                <Shield className="w-3 h-3" />{strictProd ? 'Strict PROD Mode ON' : 'Strict PROD Mode OFF'}
              </button>
              <button onClick={toggleRealDbData} data-testid="real-db-data-toggle"
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${useRealDbData ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                <Database className="w-3 h-3" />{useRealDbData ? 'Real DB Data ON' : 'Use Real DB Data'}
              </button>
              <button onClick={toggleAllowExternal} data-testid="external-products-toggle"
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${allowExternal ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                <Search className="w-3 h-3" />{allowExternal ? 'External Products ON' : 'External Products OFF'}
              </button>
              <button onClick={fetchData} disabled={loading} className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition-colors">
                {loading ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" /> : <RefreshCw className="w-4 h-4 text-slate-500" />}
              </button>
            </div>
          </div>
        </motion.div>

        {strictProd && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="mb-6 bg-red-50 border border-red-200 text-red-800 p-3 rounded-xl flex items-center gap-2 text-sm">
            <Shield className="w-4 h-4 flex-shrink-0" /><span><strong>Strict PROD Data Source</strong> — Only real database records shown.</span>
          </motion.div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          {statCards.map((stat, i) => {
            const Ic = stat.icon; return (
              <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <Link href={stat.href}>
                  <div className="bg-white rounded-xl p-4 border border-slate-200 hover:shadow-md transition-shadow cursor-pointer group">
                    <div className={`p-2 rounded-lg bg-gradient-to-br ${stat.gradient} text-white mb-2 w-fit`}><Ic className="w-4 h-4" /></div>
                    <p className="text-2xl font-bold text-slate-900">{loading ? <span className="inline-block w-8 h-6 bg-slate-200 rounded animate-pulse" /> : (stat.value ?? 0)}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{stat.label}</p>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
          <ChartCard title="Users by Role" icon={Users} gradient="from-blue-500 to-indigo-600"
            onClick={() => setModal({ title: 'User Analytics', type: 'users', data: analytics?.users })}>
            {userRolePie.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart><Pie data={userRolePie} dataKey="count" nameKey="role" cx="50%" cy="50%" outerRadius={80} label={(props: any) => `${props.role} (${props.count})`} labelLine={false} fontSize={11}>
                  {userRolePie.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Pie><Tooltip content={<CTooltip />} /></PieChart>
              </ResponsiveContainer>
            ) : <div className="h-[220px] flex items-center justify-center text-sm text-slate-400">No user data</div>}
          </ChartCard>

          <ChartCard title="Orders by Status" icon={ShoppingCart} gradient="from-purple-500 to-violet-600"
            onClick={() => setModal({ title: 'Order Analytics', type: 'orders', data: analytics?.orders })}>
            {orderStatusPie.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart><Pie data={orderStatusPie} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={80} label={(props: any) => `${props.status} (${props.count})`} labelLine={false} fontSize={11}>
                  {orderStatusPie.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie><Tooltip content={<CTooltip />} /></PieChart>
              </ResponsiveContainer>
            ) : <div className="h-[220px] flex items-center justify-center text-sm text-slate-400">No order data</div>}
          </ChartCard>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
          <ChartCard title="AI Learning Queries (30d)" icon={Brain} gradient="from-fuchsia-500 to-pink-600"
            onClick={() => setModal({ title: 'Self-Learning Analytics', type: 'learning', data: analytics?.learning })}>
            {(analytics?.learning.trend.length || 0) > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={analytics!.learning.trend}>
                  <defs><linearGradient id="lf" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#d946ef" stopOpacity={0.3} /><stop offset="95%" stopColor="#d946ef" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="day" tickFormatter={fmtDay} fontSize={10} tick={{ fill: '#94a3b8' }} /><YAxis fontSize={10} tick={{ fill: '#94a3b8' }} allowDecimals={false} />
                  <Tooltip content={<CTooltip />} /><Area type="monotone" dataKey="count" stroke="#d946ef" fill="url(#lf)" strokeWidth={2} name="Queries" />
                </AreaChart>
              </ResponsiveContainer>
            ) : <div className="h-[220px] flex items-center justify-center text-sm text-slate-400">No recent learning data</div>}
          </ChartCard>

          <ChartCard title="Validation Sessions (30d)" icon={ShieldCheck} gradient="from-amber-500 to-orange-600"
            onClick={() => setModal({ title: 'Validation Analytics', type: 'validation', data: analytics?.validation })}>
            {(analytics?.validation.trend.length || 0) > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={analytics!.validation.trend}>
                  <defs><linearGradient id="vf" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} /><stop offset="95%" stopColor="#f59e0b" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="day" tickFormatter={fmtDay} fontSize={10} tick={{ fill: '#94a3b8' }} /><YAxis fontSize={10} tick={{ fill: '#94a3b8' }} allowDecimals={false} />
                  <Tooltip content={<CTooltip />} /><Area type="monotone" dataKey="count" stroke="#f59e0b" fill="url(#vf)" strokeWidth={2} name="Sessions" />
                </AreaChart>
              </ResponsiveContainer>
            ) : <div className="h-[220px] flex items-center justify-center text-sm text-slate-400">No recent validation data</div>}
          </ChartCard>
        </div>

        {/* Charts Row 3 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
          <ChartCard title="Top Searched Queries" icon={Search} gradient="from-indigo-500 to-violet-600"
            onClick={() => setModal({ title: 'Most Searched Queries', type: 'topQueries', data: analytics?.learning.topQueries })}>
            {(analytics?.learning.topQueries.length || 0) > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={analytics!.learning.topQueries.slice(0, 8)} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis type="number" fontSize={10} tick={{ fill: '#94a3b8' }} />
                  <YAxis dataKey="query" type="category" width={120} fontSize={10} tick={{ fill: '#64748b' }} tickFormatter={v => v.length > 18 ? v.slice(0, 18) + '…' : v} />
                  <Tooltip content={<CTooltip />} /><Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} name="Count" />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="h-[220px] flex items-center justify-center text-sm text-slate-400">No query data</div>}
          </ChartCard>

          <ChartCard title="Top Users by Order Value" icon={Award} gradient="from-green-500 to-emerald-600"
            onClick={() => setModal({ title: 'Top Users by Purchase Amount', type: 'topUsers', data: analytics?.orders.topUsers })}>
            {(analytics?.orders.topUsers.length || 0) > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={analytics!.orders.topUsers.slice(0, 8)} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis type="number" fontSize={10} tick={{ fill: '#94a3b8' }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                  <YAxis dataKey="name" type="category" width={100} fontSize={10} tick={{ fill: '#64748b' }} tickFormatter={v => v?.length > 14 ? v.slice(0, 14) + '…' : v || 'Unknown'} />
                  <Tooltip content={<CTooltip />} /><Bar dataKey="total" fill="#22c55e" radius={[0, 4, 4, 0]} name="Total (₹)" />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="h-[220px] flex items-center justify-center text-sm text-slate-400">No purchase data</div>}
          </ChartCard>
        </div>

        {/* Row 4: AI Stats + Low Stock */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
          <ChartCard title="AI Enrichment Status" icon={Zap} gradient="from-violet-500 to-purple-600">
            <div className="space-y-3">
              {[{ label: 'Total Records', value: analytics?.learning.stats.total || 0, color: 'bg-indigo-500' },
              { label: 'AI Enriched', value: analytics?.learning.stats.enriched || 0, color: 'bg-green-500' },
              { label: 'Active', value: analytics?.learning.stats.active || 0, color: 'bg-blue-500' },
              { label: 'Inactive', value: (analytics?.learning.stats.total || 0) - (analytics?.learning.stats.active || 0), color: 'bg-slate-400' },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${item.color}`} /><span className="text-sm text-slate-600 flex-1">{item.label}</span>
                  <span className="text-sm font-bold text-slate-900">{item.value}</span>
                </div>
              ))}
              {(analytics?.learning.stats.total || 0) > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-100"><div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>Enrichment Rate:</span>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full" style={{ width: `${Math.round((analytics!.learning.stats.enriched / analytics!.learning.stats.total) * 100)}%` }} />
                  </div>
                  <span className="font-semibold">{Math.round((analytics!.learning.stats.enriched / analytics!.learning.stats.total) * 100)}%</span>
                </div></div>
              )}
            </div>
          </ChartCard>

          <ChartCard title="Products by Category" icon={Package} gradient="from-green-500 to-teal-600">
            {(analytics?.products.byCategory.length || 0) > 0 ? (
              <ResponsiveContainer width="100%" height={Math.max(180, analytics!.products.byCategory.length * 28)}>
                <BarChart data={analytics!.products.byCategory} layout="vertical" margin={{ left: 0, right: 12, top: 4, bottom: 4 }}>
                  <XAxis type="number" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="category" width={90} fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip content={<CTooltip />} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {analytics!.products.byCategory.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="h-[180px] flex items-center justify-center text-sm text-slate-400">0 products in DB</div>}
          </ChartCard>

          <ChartCard title="Low Stock Alert (<10)" icon={AlertTriangle} gradient="from-red-500 to-rose-600">
            {(analytics?.products.lowStock.length || 0) > 0 ? (
              <div className="space-y-2 max-h-[180px] overflow-y-auto">
                {analytics!.products.lowStock.slice(0, 10).map((p, i) => (
                  <div key={i} className="flex items-center justify-between py-1 border-b border-slate-50 last:border-0">
                    <span className="text-xs text-slate-700 truncate flex-1">{p.name}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${p.stock === 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                      {p.stock === 0 ? 'Out of Stock' : `${p.stock} left`}
                    </span>
                  </div>
                ))}
              </div>
            ) : <div className="h-[180px] flex items-center justify-center text-sm text-slate-400">{(stats?.totalProducts || 0) === 0 ? 'No products in database' : 'All well-stocked'}</div>}
          </ChartCard>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Self-Learning Dashboard', desc: 'AI reinforcement & supervised learning', href: '/admin/learning', icon: Brain, gradient: 'from-purple-600 to-fuchsia-600' },
            { label: 'Observability', desc: 'Transaction monitoring & audit trail', href: '/observability', icon: Eye, gradient: 'from-indigo-500 to-blue-600' },
            { label: 'Metrics Validation', desc: 'Search quality & ranking analysis', href: '/shopping-assistant/metrics/validation', icon: ShieldCheck, gradient: 'from-amber-500 to-orange-500' },
            ...(currentRole === 'admin' ? [{ label: 'User Management', desc: 'Roles, subscriptions & impersonation', href: '/admin/dashboard', icon: Users, gradient: 'from-blue-500 to-cyan-500' }] : []),
            { label: 'Categories', desc: 'Manage product categories & subcategories', href: '/admin/categories', icon: Package, gradient: 'from-violet-500 to-purple-600' },
            { label: 'Analytics', desc: 'Sales & traffic analytics', href: '/admin/analytics', icon: BarChart3, gradient: 'from-cyan-500 to-blue-500' },
            { label: 'Search Weights', desc: 'Configure Smart Intent Engine scoring weights', href: '/admin/search-weights', icon: Sliders, gradient: 'from-indigo-500 to-blue-600' },
            { label: 'Products Catalog', desc: 'Browse & search all products', href: '/products', icon: Package, gradient: 'from-green-500 to-emerald-600' },
          ].map(link => (
            <Link key={link.href} href={link.href}>
              <motion.div whileHover={{ scale: 1.02 }} className="bg-white border border-slate-200 rounded-xl p-5 flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer">
                <div className={`p-3 rounded-xl bg-gradient-to-br ${link.gradient} text-white`}><link.icon className="w-5 h-5" /></div>
                <div className="flex-1"><p className="font-semibold text-slate-900 text-sm">{link.label}</p><p className="text-xs text-slate-500">{link.desc}</p></div>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </motion.div>
            </Link>
          ))}
        </div>

        {/* Users CTA — admin only */}
        {currentRole === 'admin' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl border border-slate-200 p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 text-white"><Users className="w-5 h-5" /></div>
              <div><p className="font-semibold text-slate-900 text-sm">Registered Users</p><p className="text-xs text-slate-500">{stats?.totalUsers ?? '—'} in database</p></div>
            </div>
            <Link href="/admin/dashboard" className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">Manage <ArrowRight className="w-3 h-3" /></Link>
          </motion.div>
        )}
      </div>

      {/* Modals */}
      {modal && (
        <AnalyticsModal title={modal.title} onClose={() => setModal(null)}>
          {modal.type === 'users' && modal.data && (
            <div className="space-y-6">
              <table className="w-full text-sm"><thead><tr className="bg-slate-50"><th className="px-4 py-2 text-left">Role</th><th className="px-4 py-2 text-right">Count</th><th className="px-4 py-2 text-right">%</th></tr></thead>
                <tbody>{(modal.data.byRole || []).map((r: any) => {
                  const t = (modal.data.byRole || []).reduce((s: number, x: any) => s + x.count, 0);
                  return (<tr key={r.role} className="border-b border-slate-100"><td className="px-4 py-2"><span className="inline-flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: ROLE_COLORS[r.role] || '#94a3b8' }} />{r.role}</span></td><td className="px-4 py-2 text-right font-bold">{r.count}</td><td className="px-4 py-2 text-right text-slate-500">{t > 0 ? ((r.count / t) * 100).toFixed(1) : 0}%</td></tr>);
                })}</tbody></table>
              {(modal.data.signupTrend || []).length > 0 && (<div><h3 className="text-sm font-semibold text-slate-700 mb-3">Signup Trend (30d)</h3>
                <ResponsiveContainer width="100%" height={200}><LineChart data={modal.data.signupTrend}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="day" tickFormatter={fmtDay} fontSize={10} /><YAxis fontSize={10} allowDecimals={false} /><Tooltip content={<CTooltip />} /><Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} name="Signups" dot={{ fill: '#3b82f6', r: 3 }} /></LineChart></ResponsiveContainer>
              </div>)}
            </div>
          )}
          {modal.type === 'orders' && modal.data && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{(modal.data.byStatus || []).map((r: any, i: number) => (
                <div key={r.status} className="p-3 rounded-lg border border-slate-100"><div className="flex items-center gap-2 mb-1"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} /><span className="text-xs text-slate-500">{r.status}</span></div><span className="text-xl font-bold text-slate-900">{r.count}</span></div>
              ))}</div>
              {(modal.data.topUsers || []).length > 0 && (<div><h3 className="text-sm font-semibold text-slate-700 mb-3">Top Users by Purchase</h3>
                <table className="w-full text-sm"><thead><tr className="bg-slate-50"><th className="px-4 py-2 text-left">User</th><th className="px-4 py-2 text-left">Email</th><th className="px-4 py-2 text-right">Orders</th><th className="px-4 py-2 text-right">Total</th></tr></thead>
                  <tbody>{(modal.data.topUsers || []).map((u: any) => (<tr key={u.email} className="border-b border-slate-100"><td className="px-4 py-2 font-medium">{u.name || 'Unknown'}</td><td className="px-4 py-2 text-slate-500">{u.email}</td><td className="px-4 py-2 text-right">{u.count}</td><td className="px-4 py-2 text-right font-bold">₹{u.total.toLocaleString('en-IN')}</td></tr>))}</tbody></table>
              </div>)}
            </div>
          )}
          {modal.type === 'learning' && modal.data && (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-indigo-50 text-center"><p className="text-2xl font-bold text-indigo-700">{modal.data.stats?.total || 0}</p><p className="text-xs text-indigo-600">Total</p></div>
                <div className="p-3 rounded-lg bg-green-50 text-center"><p className="text-2xl font-bold text-green-700">{modal.data.stats?.enriched || 0}</p><p className="text-xs text-green-600">AI Enriched</p></div>
                <div className="p-3 rounded-lg bg-blue-50 text-center"><p className="text-2xl font-bold text-blue-700">{modal.data.stats?.active || 0}</p><p className="text-xs text-blue-600">Active</p></div>
              </div>
              {(modal.data.byUser || []).length > 0 && (<div><h3 className="text-sm font-semibold text-slate-700 mb-3">Queries by User</h3>
                <table className="w-full text-sm"><thead><tr className="bg-slate-50"><th className="px-4 py-2 text-left">User</th><th className="px-4 py-2 text-right">Queries</th></tr></thead>
                  <tbody>{(modal.data.byUser || []).map((u: any) => (<tr key={u.user} className="border-b border-slate-100"><td className="px-4 py-2">{u.user}</td><td className="px-4 py-2 text-right font-bold">{u.count}</td></tr>))}</tbody></table>
              </div>)}
            </div>
          )}
          {modal.type === 'validation' && modal.data && (modal.data.byUser || []).length > 0 && (
            <table className="w-full text-sm"><thead><tr className="bg-slate-50"><th className="px-4 py-2 text-left">User</th><th className="px-4 py-2 text-right">Sessions</th></tr></thead>
              <tbody>{(modal.data.byUser || []).map((u: any) => (<tr key={u.user} className="border-b border-slate-100"><td className="px-4 py-2">{u.user}</td><td className="px-4 py-2 text-right font-bold">{u.count}</td></tr>))}</tbody></table>
          )}
          {modal.type === 'topQueries' && Array.isArray(modal.data) && (
            <table className="w-full text-sm"><thead><tr className="bg-slate-50"><th className="px-4 py-2 text-left">#</th><th className="px-4 py-2 text-left">Query</th><th className="px-4 py-2 text-right">Count</th></tr></thead>
              <tbody>{modal.data.map((q: any, i: number) => (<tr key={i} className="border-b border-slate-100"><td className="px-4 py-2 text-slate-400">{i + 1}</td><td className="px-4 py-2 font-medium">{q.query}</td><td className="px-4 py-2 text-right font-bold">{q.count}</td></tr>))}</tbody></table>
          )}
          {modal.type === 'topUsers' && Array.isArray(modal.data) && (
            <table className="w-full text-sm"><thead><tr className="bg-slate-50"><th className="px-4 py-2 text-left">#</th><th className="px-4 py-2 text-left">User</th><th className="px-4 py-2 text-right">Orders</th><th className="px-4 py-2 text-right">Total</th></tr></thead>
              <tbody>{modal.data.map((u: any, i: number) => (<tr key={i} className="border-b border-slate-100"><td className="px-4 py-2 text-slate-400">{i + 1}</td><td className="px-4 py-2 font-medium">{u.name || 'Unknown'}</td><td className="px-4 py-2 text-right">{u.count}</td><td className="px-4 py-2 text-right font-bold">₹{u.total.toLocaleString('en-IN')}</td></tr>))}</tbody></table>
          )}
        </AnalyticsModal>
      )}
    </div>
  );
}
