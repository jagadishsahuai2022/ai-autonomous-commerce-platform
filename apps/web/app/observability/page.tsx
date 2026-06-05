'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, AlertTriangle, CheckCircle, XCircle, Clock, RefreshCw,
  Eye, Shield, TrendingUp, Loader2, ChevronDown, ChevronUp,
  RotateCcw, Search, Filter, ArrowLeft, Zap, IndianRupee,
  AlertOctagon, BarChart3, History, ShieldAlert, FileText, Lock,
  Brain, Database, Server, Users, ShoppingCart,
} from 'lucide-react';
import Link from 'next/link';
import { hasPageAccess } from '@/lib/admin-auth';
import {
  getRecentTransactions,
  getStuckTransactions,
  getAuditLogEntries,
  getSuspiciousEntries,
  getTransactionStats,
  replayStuckTransaction,
  seedDemoDataIfEmpty,
  captureUserActivity,
  type WalletTransaction,
  type AuditEntry,
  type TransactionState,
} from '@/lib/wallet-transactions';

const STATE_COLORS: Record<TransactionState, string> = {
  initiated: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  debit_pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  debited: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  order_placed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  order_failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  refund_pending: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  refund_processing: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  refunded: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  stuck: 'bg-red-200 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

type DashboardTab = 'overview' | 'transactions' | 'orders' | 'ai-queries' | 'stuck' | 'audit' | 'system-health' | 'journey-events' | 'funnel' | 'fallback-audit';

const JOURNEY_COLORS: Record<string, string> = {
  product_clicked: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  wishlist_added: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  wishlist_removed: 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400',
  cart_added: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  cart_removed: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  checkout_started: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  payment_started: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  payment_success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  payment_failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  order_placed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  order_failed: 'bg-red-200 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

function formatCurrency(n: number) {
  return `₹${n.toLocaleString('en-IN')}`;
}

function formatDate(d: string) {
  return new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function StatBox({ icon: Icon, label, value, color, sub }: { icon: any; label: string; value: string | number; color: string; sub?: string }) {
  const bg = color === 'green' ? 'bg-green-100 dark:bg-green-900/30' : color === 'red' ? 'bg-red-100 dark:bg-red-900/30' : color === 'amber' ? 'bg-amber-100 dark:bg-amber-900/30' : color === 'blue' ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-indigo-100 dark:bg-indigo-900/30';
  const ic = color === 'green' ? 'text-green-600' : color === 'red' ? 'text-red-600' : color === 'amber' ? 'text-amber-600' : color === 'blue' ? 'text-blue-600' : 'text-indigo-600';
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`p-1.5 rounded-lg ${bg}`}><Icon className={`w-4 h-4 ${ic}`} /></div>
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
      </div>
      <p className="text-xl font-bold text-slate-900 dark:text-white">{value}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function ObservabilityDashboard() {
  const [mounted, setMounted] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!hasPageAccess('/observability')) {
      setAccessDenied(true);
    }
  }, []);

  if (!mounted) return null;

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <Lock className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-slate-900 mb-2">Access Restricted</h1>
          <p className="text-sm text-slate-500 mb-6">
            The Observability Dashboard is restricted to <strong>Observability</strong>,{' '}
            <strong>Analytics</strong>, and <strong>Admin</strong> roles.
          </p>
          <Link
            href="/account"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Account
          </Link>
        </div>
      </div>
    );
  }

  return <ObservabilityContent />;
}

function ObservabilityContent() {
  const [tab, setTab] = useState<DashboardTab>('overview');
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [stuckTxns, setStuckTxns] = useState<WalletTransaction[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [suspicious, setSuspicious] = useState<AuditEntry[]>([]);
  const [stats, setStats] = useState({ total: 0, completed: 0, stuck: 0, failed: 0, pendingRefunds: 0, totalRefunded: 0, totalDebited: 0 });
  const [expandedTxn, setExpandedTxn] = useState<string | null>(null);
  const [replayingId, setReplayingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [mounted, setMounted] = useState(false);
  const [dbData, setDbData] = useState<any>(null);
  const [dbLoading, setDbLoading] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const fetchDbData = useCallback(async () => {
    // Re-read from localStorage on every fetch so we pick up upgraded sess_ tokens
    // that replace the initial admin-* placeholder after authenticateAdmin fires.
    const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
    const userEmail = typeof window !== 'undefined' ? localStorage.getItem('userEmail') : null;
    if (!token) return;
    setDbLoading(true);
    try {
      const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
      if (userEmail) headers['x-user-email'] = userEmail;
      const res = await fetch('/api/observability', { headers });
      if (res.ok) {
        const data = await res.json();
        setDbData(data);
        setLastRefreshed(new Date());
        setDbError(null);
      } else {
        setDbError(`HTTP ${res.status}`);
      }
    } catch {
      setDbError('Network error');
    } finally {
      setDbLoading(false);
    }
  }, []);

  const refresh = useCallback(() => {
    setTransactions(getRecentTransactions(100));
    setStuckTxns(getStuckTransactions());
    setAuditLog(getAuditLogEntries(200));
    setSuspicious(getSuspiciousEntries());
    setStats(getTransactionStats());
    fetchDbData();
  }, [fetchDbData]);

  // Retry fetchDbData whenever authenticateAdmin upgrades the token from
  // the placeholder "admin-*" value to a real "sess_*" session token.
  useEffect(() => {
    const handler = () => fetchDbData();
    window.addEventListener('authUpdated', handler);
    return () => window.removeEventListener('authUpdated', handler);
  }, [fetchDbData]);

  useEffect(() => {
    setMounted(true);
    seedDemoDataIfEmpty();
    captureUserActivity('/observability', 'page_view');
    refresh();
    const interval = setInterval(() => fetchDbData(), 30000);
    return () => clearInterval(interval);
  }, [refresh, fetchDbData]);

  const handleReplay = async (txnId: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
    if (!token) return;
    setReplayingId(txnId);
    try {
      await replayStuckTransaction(txnId, token);
      refresh();
    } catch (err: any) {
      console.error('Replay failed:', err.message);
    }
    setReplayingId(null);
  };

  const filteredTxns = transactions.filter(t => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return t.id.toLowerCase().includes(q) || t.orderId?.toLowerCase().includes(q) || t.state.includes(q);
  });

  if (!mounted) return null;

  const hasRealData = !!dbData && !dbError;
  const displayStats = hasRealData ? {
    total: dbData.walletStats.total,
    completed: dbData.walletStats.completed,
    stuck: stats.stuck,
    failed: dbData.walletStats.failed,
    pendingRefunds: stats.pendingRefunds,
    totalRefunded: dbData.walletStats.totalRefunded,
    totalDebited: dbData.walletStats.totalDebited,
  } : stats;

  const journeyEvents: any[] = (hasRealData && dbData.journeyEvents) ? dbData.journeyEvents : [];
  const journeyFunnel: Record<string, number> = (hasRealData && dbData.journeyFunnel) ? dbData.journeyFunnel : {};

  const FUNNEL_STAGES = [
    { key: 'product_clicked', label: 'Product Viewed', icon: Eye },
    { key: 'wishlist_added', label: 'Wishlisted', icon: TrendingUp },
    { key: 'cart_added', label: 'Added to Cart', icon: ShoppingCart },
    { key: 'checkout_started', label: 'Checkout', icon: Zap },
    { key: 'payment_started', label: 'Payment', icon: IndianRupee },
    { key: 'payment_success', label: 'Paid', icon: CheckCircle },
    { key: 'order_placed', label: 'Order Placed', icon: Activity },
  ];

  const TABS: { id: DashboardTab; label: string; icon: any; badge?: number; isDb?: boolean }[] = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'journey-events', label: 'Journey Events', icon: Activity, badge: journeyEvents.length, isDb: true },
    { id: 'funnel', label: 'Funnel', icon: TrendingUp, isDb: true },
    { id: 'transactions', label: 'Transactions', icon: History, badge: hasRealData ? dbData.walletStats?.total : stats.total },
    { id: 'orders', label: 'Orders', icon: ShoppingCart, badge: hasRealData ? dbData.orderStats?.total : undefined, isDb: true },
    { id: 'ai-queries', label: 'AI Queries', icon: Brain, badge: hasRealData ? dbData.aiStats?.totalQueries : undefined, isDb: true },
    { id: 'stuck', label: 'Stuck / Suspicious', icon: ShieldAlert, badge: stuckTxns.length + suspicious.length },
    { id: 'audit', label: 'Audit Log', icon: FileText, badge: hasRealData ? dbData.auditLog?.length : auditLog.length },
    { id: 'system-health', label: 'System Health', icon: Server, isDb: true },
    { id: 'fallback-audit', label: 'Fallback Audit', icon: Shield },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-violet-950/30 to-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-violet-600 to-cyan-600 rounded-xl text-white shadow-lg shadow-violet-600/30">
              <Activity className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-violet-300 to-cyan-300 bg-clip-text text-transparent">DelegateCart Intelligence Hub</h1>
              <p className="text-sm text-slate-400 flex items-center gap-2">
                User journey tracking, transactions &amp; system health
                {hasRealData && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-900/30 text-green-400 text-[10px] font-semibold rounded-full border border-green-800/50">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    LIVE
                  </span>
                )}
                {dbError && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-900/30 text-amber-400 text-[10px] font-semibold rounded-full border border-amber-800/50">
                    Cached
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {lastRefreshed && (
                <span className="hidden sm:block text-[11px] text-slate-500">
                  {lastRefreshed.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              )}
              <button onClick={refresh} disabled={dbLoading}
                className="p-2.5 bg-slate-800 border border-slate-700 rounded-xl hover:bg-slate-700 transition-colors disabled:opacity-50">
                <RefreshCw className={`w-4 h-4 text-slate-400 ${dbLoading ? 'animate-spin' : ''}`} />
              </button>
              <Link href="/account" className="hidden sm:flex items-center gap-1 text-sm text-violet-400 hover:text-violet-300 font-medium">
                <ArrowLeft className="w-4 h-4" /> Account
              </Link>
            </div>
          </div>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-slate-800/80 border border-slate-700 rounded-xl p-1 overflow-x-auto">
          {TABS.map(({ id, label, icon: Icon, badge, isDb }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${tab === id ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                }`}>
              <Icon className="w-4 h-4" />{label}
              {isDb && !hasRealData && <Database className="w-3 h-3 opacity-40" />}
              {badge !== undefined && badge > 0 && (
                <span className={`ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full ${tab === id ? 'bg-white/20 text-white' : id === 'stuck' && badge > 0 ? 'bg-red-900/50 text-red-400' : 'bg-slate-700 text-slate-300'
                  }`}>{badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {tab === 'overview' && (
          <div className="space-y-6">
            {dbError && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 flex items-center gap-3 text-sm">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="text-amber-700 dark:text-amber-300">Real-time DB data unavailable ({dbError}). Showing local cache.</span>
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              <StatBox icon={Activity} label="Total" value={displayStats.total} color="blue" />
              <StatBox icon={CheckCircle} label="Completed" value={displayStats.completed} color="green" />
              <StatBox icon={AlertOctagon} label="Stuck" value={displayStats.stuck} color="red" sub={displayStats.stuck > 0 ? 'Action needed' : 'All clear'} />
              <StatBox icon={XCircle} label="Failed" value={displayStats.failed} color="amber" />
              <StatBox icon={Clock} label="Pending Refunds" value={displayStats.pendingRefunds} color="amber" />
              <StatBox icon={IndianRupee} label="Refunded" value={formatCurrency(displayStats.totalRefunded)} color="green" />
              <StatBox icon={TrendingUp} label="Debited" value={formatCurrency(displayStats.totalDebited)} color="blue" />
            </div>

            {hasRealData && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <ShoppingCart className="w-4 h-4 text-indigo-600" />
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Order Pipeline</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-2">
                      <p className="text-slate-400">Total Orders</p>
                      <p className="text-lg font-bold text-slate-900 dark:text-white">{dbData.orderStats.total}</p>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2">
                      <p className="text-green-600">Revenue</p>
                      <p className="text-lg font-bold text-green-700 dark:text-green-400">{formatCurrency(dbData.orderStats.totalRevenue)}</p>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2">
                      <p className="text-blue-600">Processing</p>
                      <p className="text-base font-bold text-blue-700 dark:text-blue-400">{dbData.orderStats.processing}</p>
                    </div>
                    <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-2">
                      <p className="text-red-600">Failed</p>
                      <p className="text-base font-bold text-red-700 dark:text-red-400">{dbData.orderStats.failed}</p>
                    </div>
                  </div>
                  <button onClick={() => setTab('orders')} className="mt-3 text-xs text-indigo-600 hover:text-indigo-700 font-medium">View Orders →</button>
                </div>
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Brain className="w-4 h-4 text-purple-600" />
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">AI Query Monitor</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-2">
                      <p className="text-slate-400">Total Queries</p>
                      <p className="text-lg font-bold text-slate-900 dark:text-white">{dbData.aiStats.totalQueries}</p>
                    </div>
                    <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-2">
                      <p className="text-purple-600">Last 24h</p>
                      <p className="text-lg font-bold text-purple-700 dark:text-purple-400">{dbData.aiStats.last24h}</p>
                    </div>
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-2">
                      <p className="text-indigo-600">Unique Users</p>
                      <p className="text-base font-bold text-indigo-700 dark:text-indigo-400">{dbData.aiStats.uniqueUsers}</p>
                    </div>
                    <div className="bg-teal-50 dark:bg-teal-900/20 rounded-lg p-2">
                      <p className="text-teal-600">Active</p>
                      <p className="text-base font-bold text-teal-700 dark:text-teal-400">{dbData.aiStats.activeRecords}</p>
                    </div>
                  </div>
                  <button onClick={() => setTab('ai-queries')} className="mt-3 text-xs text-purple-600 hover:text-purple-700 font-medium">View AI Queries →</button>
                </div>
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Server className="w-4 h-4 text-emerald-600" />
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">System Health</h3>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                      <span className="text-slate-500">Database</span>
                      <span className={`font-semibold px-2 py-0.5 rounded-full text-[10px] ${dbData.systemHealth.status === 'healthy' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {dbData.systemHealth.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                      <span className="text-slate-500">DB Response</span>
                      <span className={`font-semibold ${dbData.systemHealth.dbResponseMs < 100 ? 'text-green-600' : dbData.systemHealth.dbResponseMs < 500 ? 'text-amber-600' : 'text-red-600'}`}>
                        {dbData.systemHealth.dbResponseMs}ms
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                      <span className="text-slate-500">Analytics 24h</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{dbData.analyticsStats.total24h} events</span>
                    </div>
                  </div>
                  <button onClick={() => setTab('system-health')} className="mt-3 text-xs text-emerald-600 hover:text-emerald-700 font-medium">View Details →</button>
                </div>
              </div>
            )}

            {/* Stuck Alert */}
            {stuckTxns.length > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <h3 className="font-semibold text-red-800 dark:text-red-200">{stuckTxns.length} Stuck Transaction{stuckTxns.length > 1 ? 's' : ''} — Action Required</h3>
                </div>
                <div className="space-y-2">
                  {stuckTxns.slice(0, 3).map(txn => (
                    <div key={txn.id} className="flex items-center justify-between bg-white dark:bg-slate-800 rounded-lg p-3 border border-red-100 dark:border-red-800/50">
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">{txn.orderId || txn.id}</p>
                        <p className="text-xs text-red-600">{txn.failureReason}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900 dark:text-white">{formatCurrency(txn.amount)}</span>
                        <button onClick={() => handleReplay(txn.id)} disabled={replayingId === txn.id}
                          className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-1">
                          {replayingId === txn.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                          Replay
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {stuckTxns.length > 3 && (
                  <button onClick={() => setTab('stuck')} className="mt-2 text-xs text-red-600 hover:text-red-700 font-medium">
                    View all {stuckTxns.length} stuck transactions →
                  </button>
                )}
              </motion.div>
            )}

            {/* Recent Activity */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <History className="w-4 h-4 text-slate-500" /> Recent Transactions
                  {hasRealData && <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full font-semibold">DB</span>}
                </h3>
                <button onClick={() => setTab('transactions')} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">View All →</button>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {hasRealData && dbData.recentTransactions.length > 0 ? (
                  dbData.recentTransactions.slice(0, 8).map((txn: any) => (
                    <div key={txn.id} className="px-5 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`p-1.5 rounded-lg ${txn.status === 'completed' ? 'bg-green-100 dark:bg-green-900/30' : txn.status === 'failed' ? 'bg-red-100 dark:bg-red-900/30' : 'bg-blue-100 dark:bg-blue-900/30'}`}>
                          {txn.status === 'completed' ? <CheckCircle className="w-3.5 h-3.5 text-green-600" /> : txn.status === 'failed' ? <AlertTriangle className="w-3.5 h-3.5 text-red-600" /> : <Clock className="w-3.5 h-3.5 text-blue-600" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{txn.userName || txn.userId || 'Unknown'}</p>
                          <p className="text-[11px] text-slate-400">{formatDate(txn.createdAt)} · {txn.type}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${txn.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : txn.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{txn.status}</span>
                        <span className="text-sm font-semibold text-slate-900 dark:text-white">{formatCurrency(txn.amount)}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <>
                    {transactions.length === 0 && (
                      <div className="p-8 text-center text-sm text-slate-400">No wallet transactions yet. Transactions will appear here when you make wallet payments.</div>
                    )}
                    {transactions.slice(0, 8).map(txn => (
                      <div key={txn.id} className="px-5 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`p-1.5 rounded-lg ${txn.state === 'completed' ? 'bg-green-100 dark:bg-green-900/30' : txn.state === 'stuck' ? 'bg-red-100 dark:bg-red-900/30' : 'bg-blue-100 dark:bg-blue-900/30'}`}>
                            {txn.state === 'completed' ? <CheckCircle className="w-3.5 h-3.5 text-green-600" /> : txn.state === 'stuck' ? <AlertTriangle className="w-3.5 h-3.5 text-red-600" /> : <Clock className="w-3.5 h-3.5 text-blue-600" />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{txn.orderId || txn.id}</p>
                            <p className="text-[11px] text-slate-400">{formatDate(txn.createdAt)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${STATE_COLORS[txn.state]}`}>{txn.state.replace('_', ' ')}</span>
                          <span className="text-sm font-semibold text-slate-900 dark:text-white">{formatCurrency(txn.amount)}</span>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Transactions Tab */}
        {tab === 'transactions' && (
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search by ID, order, or state..."
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
              {filteredTxns.length === 0 && (
                <div className="p-8 text-center text-sm text-slate-400">No transactions found.</div>
              )}
              {filteredTxns.map(txn => (
                <div key={txn.id} className="border-b border-slate-100 dark:border-slate-700 last:border-0">
                  <div className="px-5 py-3.5 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50"
                    onClick={() => setExpandedTxn(expandedTxn === txn.id ? null : txn.id)}>
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full whitespace-nowrap ${STATE_COLORS[txn.state]}`}>{txn.state.replace('_', ' ')}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{txn.orderId || txn.id}</p>
                        <p className="text-[11px] text-slate-400">{formatDate(txn.createdAt)} · Retries: {txn.retryCount}/{txn.maxRetries}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-slate-900 dark:text-white">{formatCurrency(txn.amount)}</span>
                      {expandedTxn === txn.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </div>
                  </div>
                  <AnimatePresence>
                    {expandedTxn === txn.id && (
                      <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                        <div className="px-5 pb-4 space-y-3">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                            <div><span className="text-slate-400">Transaction ID</span><p className="font-mono text-slate-700 dark:text-slate-300 break-all">{txn.id}</p></div>
                            <div><span className="text-slate-400">Idempotency Key</span><p className="font-mono text-slate-700 dark:text-slate-300 break-all">{txn.idempotencyKey}</p></div>
                            <div><span className="text-slate-400">Refund Amount</span><p className="font-medium">{txn.refundAmount ? formatCurrency(txn.refundAmount) : 'N/A'}</p></div>
                            <div><span className="text-slate-400">Refunded At</span><p className="font-medium">{txn.refundedAt ? formatDate(txn.refundedAt) : 'N/A'}</p></div>
                          </div>
                          {txn.failureReason && (
                            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
                              <p className="text-xs font-medium text-red-700 dark:text-red-300">Failure Reason: {txn.failureReason}</p>
                            </div>
                          )}
                          <div>
                            <p className="text-xs font-semibold text-slate-500 mb-2">State History</p>
                            <div className="flex flex-wrap gap-1.5">
                              {txn.stateHistory.map((sh, i) => (
                                <span key={i} className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${STATE_COLORS[sh.state]}`}>
                                  {sh.state.replace('_', ' ')} {sh.reason ? `(${sh.reason})` : ''}
                                </span>
                              ))}
                            </div>
                          </div>
                          {txn.state === 'stuck' && (
                            <button onClick={() => handleReplay(txn.id)} disabled={replayingId === txn.id}
                              className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2">
                              {replayingId === txn.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                              Replay Transaction
                            </button>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stuck/Suspicious Tab */}
        {tab === 'stuck' && (
          <div className="space-y-6">
            {/* Stuck Transactions */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-700">
                <h3 className="text-sm font-semibold text-red-700 dark:text-red-400 flex items-center gap-2">
                  <AlertOctagon className="w-4 h-4" /> Stuck Transactions ({stuckTxns.length})
                </h3>
              </div>
              {stuckTxns.length === 0 && (
                <div className="p-8 text-center">
                  <CheckCircle className="w-10 h-10 mx-auto text-green-400 mb-2" />
                  <p className="text-sm text-slate-500">No stuck transactions. All workflows are healthy.</p>
                </div>
              )}
              {stuckTxns.map(txn => (
                <div key={txn.id} className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 last:border-0">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{txn.orderId || txn.id}</p>
                      <p className="text-xs text-slate-400">{formatDate(txn.createdAt)} · {formatCurrency(txn.amount)}</p>
                    </div>
                    <button onClick={() => handleReplay(txn.id)} disabled={replayingId === txn.id}
                      className="px-4 py-2 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-1.5">
                      {replayingId === txn.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                      Replay
                    </button>
                  </div>
                  <p className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{txn.failureReason || 'Unknown failure'}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {txn.stateHistory.map((sh, i) => (
                      <span key={i} className={`px-1.5 py-0.5 text-[9px] rounded-full ${STATE_COLORS[sh.state]}`}>{sh.state.replace('_', ' ')}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Suspicious Activity */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-700">
                <h3 className="text-sm font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4" /> Suspicious Activity ({suspicious.length})
                </h3>
              </div>
              {suspicious.length === 0 && (
                <div className="p-8 text-center">
                  <Shield className="w-10 h-10 mx-auto text-green-400 mb-2" />
                  <p className="text-sm text-slate-500">No suspicious activity detected.</p>
                </div>
              )}
              {suspicious.slice(0, 20).map(entry => (
                <div key={entry.id} className="px-5 py-3 border-b border-slate-100 dark:border-slate-700 last:border-0 hover:bg-amber-50/50 dark:hover:bg-amber-900/10">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{entry.action.replace('_', ' ')}</p>
                      <p className="text-xs text-slate-400">{formatDate(entry.timestamp)} · {formatCurrency(entry.amount)}</p>
                    </div>
                    <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${STATE_COLORS[entry.newState]}`}>{entry.newState.replace('_', ' ')}</span>
                  </div>
                  {entry.reason && <p className="text-xs text-amber-600 mt-1">{entry.reason}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Audit Log Tab */}
        {tab === 'audit' && (
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-500" /> Full Audit Trail
                {hasRealData ? (
                  <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full font-semibold">DB · {dbData.auditLog.length} entries</span>
                ) : (
                  <span className="text-slate-400 font-normal">({auditLog.length} entries)</span>
                )}
              </h3>
            </div>
            {hasRealData && dbData.auditLog.length > 0 ? (
              <div className="divide-y divide-slate-100 dark:divide-slate-700 max-h-[600px] overflow-y-auto">
                {dbData.auditLog.map((entry: any) => (
                  <div key={entry.id} className="px-5 py-3 text-xs hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{String(entry.event_name || entry.eventName || '').replace(/_/g, ' ')}</span>
                      <span className="text-slate-400 font-mono">{formatDate(entry.created_at || entry.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-3 text-slate-400">
                      <span>{entry.user_email || entry.userId || 'System'}</span>
                      {(entry.page || entry.source || entry.event_type) && <><span>·</span><span>{entry.page || entry.source || entry.event_type}</span></>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                {auditLog.length === 0 && (
                  <div className="p-8 text-center text-sm text-slate-400">No audit entries yet.</div>
                )}
                <div className="divide-y divide-slate-100 dark:divide-slate-700 max-h-[600px] overflow-y-auto">
                  {auditLog.map(entry => (
                    <div key={entry.id} className={`px-5 py-3 text-xs hover:bg-slate-50 dark:hover:bg-slate-700/50 ${entry.suspicious ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''}`}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          {entry.suspicious && <AlertTriangle className="w-3 h-3 text-amber-500" />}
                          <span className="font-semibold text-slate-700 dark:text-slate-300">{entry.action.replace(/_/g, ' ')}</span>
                          {entry.previousState && (
                            <span className="text-slate-400">{entry.previousState} → {entry.newState}</span>
                          )}
                        </div>
                        <span className="text-slate-400 font-mono">{formatDate(entry.timestamp)}</span>
                      </div>
                      <div className="flex items-center gap-4 text-slate-400">
                        <span>Txn: {entry.transactionId.slice(0, 20)}...</span>
                        <span>{formatCurrency(entry.amount)}</span>
                        <span>Source: {entry.source}</span>
                      </div>
                      {entry.reason && <p className="text-amber-600 mt-0.5">{entry.reason}</p>}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Orders Tab */}
        {tab === 'orders' && (
          <div className="space-y-4">
            {!hasRealData ? (
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-8 text-center">
                <Database className="w-10 h-10 mx-auto text-slate-300 mb-3" />
                <p className="text-sm text-slate-500">Real-time order data requires database access.{dbError ? ` Error: ${dbError}` : ''}</p>
                <button onClick={fetchDbData} disabled={dbLoading} className="mt-3 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 mx-auto">
                  {dbLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Retry Connection'}
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <StatBox icon={ShoppingCart} label="Total" value={dbData.orderStats.total} color="blue" />
                  <StatBox icon={CheckCircle} label="Confirmed" value={dbData.orderStats.confirmed} color="green" />
                  <StatBox icon={Clock} label="Processing" value={dbData.orderStats.processing} color="amber" />
                  <StatBox icon={XCircle} label="Failed" value={dbData.orderStats.failed} color="red" />
                  <StatBox icon={TrendingUp} label="Last 24h" value={dbData.orderStats.recent24h} color="indigo" />
                  <StatBox icon={IndianRupee} label="Revenue" value={formatCurrency(dbData.orderStats.totalRevenue)} color="green" />
                </div>
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-700">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                      <ShoppingCart className="w-4 h-4 text-slate-500" /> Recent Orders ({dbData.recentOrders.length})
                      <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full font-semibold">LIVE DB</span>
                    </h3>
                  </div>
                  {dbData.recentOrders.length === 0 && (
                    <div className="p-8 text-center text-sm text-slate-400">No recent orders found.</div>
                  )}
                  <div className="divide-y divide-slate-100 dark:divide-slate-700">
                    {dbData.recentOrders.map((order: any) => (
                      <div key={order.id} className="px-5 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`p-1.5 rounded-lg ${order.status === 'confirmed' || order.status === 'delivered' ? 'bg-green-100 dark:bg-green-900/30' : order.status === 'failed' || order.status === 'cancelled' ? 'bg-red-100 dark:bg-red-900/30' : 'bg-blue-100 dark:bg-blue-900/30'}`}>
                            {order.status === 'confirmed' || order.status === 'delivered' ? <CheckCircle className="w-3.5 h-3.5 text-green-600" /> : order.status === 'failed' || order.status === 'cancelled' ? <XCircle className="w-3.5 h-3.5 text-red-600" /> : <Clock className="w-3.5 h-3.5 text-blue-600" />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{order.userName || 'Unknown User'}</p>
                            <p className="text-[11px] text-slate-400">{formatDate(order.createdAt)} · #{String(order.id).slice(0, 8)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${order.status === 'confirmed' || order.status === 'delivered' ? 'bg-emerald-100 text-emerald-700' : order.status === 'failed' || order.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{order.status}</span>
                          <span className="text-sm font-semibold text-slate-900 dark:text-white">{formatCurrency(order.totalAmount)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* AI Queries Tab */}
        {tab === 'ai-queries' && (
          <div className="space-y-4">
            {!hasRealData ? (
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-8 text-center">
                <Brain className="w-10 h-10 mx-auto text-slate-300 mb-3" />
                <p className="text-sm text-slate-500">AI query data requires database access.{dbError ? ` Error: ${dbError}` : ''}</p>
                <button onClick={fetchDbData} disabled={dbLoading} className="mt-3 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 mx-auto">
                  {dbLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Retry Connection'}
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatBox icon={Brain} label="Total Queries" value={dbData.aiStats.totalQueries} color="indigo" />
                  <StatBox icon={Users} label="Unique Users" value={dbData.aiStats.uniqueUsers} color="blue" />
                  <StatBox icon={Activity} label="Last 24h" value={dbData.aiStats.last24h} color="green" />
                  <StatBox icon={Zap} label="Active Records" value={dbData.aiStats.activeRecords} color="amber" />
                </div>
                {dbData.topAiQueries.length > 0 && (
                  <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-700">
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-purple-500" /> Top Queries (Last 7 Days)
                      </h3>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-slate-700">
                      {dbData.topAiQueries.map((q: any, i: number) => (
                        <div key={i} className="px-5 py-3 flex items-center gap-4">
                          <span className="text-xs font-bold text-slate-300 w-5">{i + 1}</span>
                          <p className="flex-1 text-sm text-slate-700 dark:text-slate-300 truncate">{q.queryText}</p>
                          <span className="text-xs font-semibold text-purple-600 bg-purple-50 dark:bg-purple-900/20 px-2 py-0.5 rounded-full">{q.count}×</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-700">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                      <Brain className="w-4 h-4 text-slate-500" /> Recent AI Queries
                      <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full font-semibold">LIVE DB</span>
                    </h3>
                  </div>
                  {dbData.recentAiQueries.length === 0 && (
                    <div className="p-8 text-center text-sm text-slate-400">No AI queries recorded yet. Queries from the Shopping Assistant will appear here.</div>
                  )}
                  <div className="divide-y divide-slate-100 dark:divide-slate-700">
                    {dbData.recentAiQueries.map((q: any) => (
                      <div key={q.id} className="px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-slate-700 dark:text-slate-200">{q.queryText}</p>
                            <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-400">
                              <span>{q.userName || q.userEmail || 'Anonymous'}</span>
                              <span>·</span>
                              <span>{formatDate(q.createdAt)}</span>
                              {q.intentCategory && <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400 rounded-full font-medium">{q.intentCategory}</span>}
                            </div>
                          </div>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${q.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                            {q.isActive ? 'active' : 'archived'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* System Health Tab */}
        {/* ── Journey Events Tab ─────────────────────────────────────────── */}
        {tab === 'journey-events' && (
          <div className="space-y-4">
            {!hasRealData ? (
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-8 text-center">
                <Activity className="w-10 h-10 mx-auto text-violet-300 mb-3" />
                <p className="text-sm text-slate-500">Journey Events data requires database access. {dbError ? `Error: ${dbError}` : ''}</p>
                <button onClick={fetchDbData} disabled={dbLoading} className="mt-3 px-4 py-2 bg-violet-600 text-white text-sm rounded-lg hover:bg-violet-700 disabled:opacity-50 flex items-center gap-2 mx-auto">
                  {dbLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Connect DB
                </button>
              </div>
            ) : journeyEvents.length === 0 ? (
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-8 text-center">
                <Activity className="w-10 h-10 mx-auto text-violet-300 mb-3" />
                <p className="text-sm text-slate-500">No journey events recorded yet. Browse products to generate events.</p>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-violet-500" /> Live Journey Events
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-violet-100 text-violet-700 rounded-full">{journeyEvents.length}</span>
                  </h3>
                  <span className="text-[11px] text-slate-400">Latest 200 events</span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-700 max-h-[600px] overflow-y-auto">
                  {journeyEvents.map((ev: any) => (
                    <div key={ev.id} className="px-5 py-3 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                      <span className={`mt-0.5 px-2 py-0.5 text-[10px] font-bold rounded-full whitespace-nowrap ${JOURNEY_COLORS[ev.eventType] ?? 'bg-slate-100 text-slate-600'}`}>
                        {ev.eventType.replace(/_/g, ' ')}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">
                            {ev.userName ?? ev.userEmail ?? `Session ${String(ev.sessionId).slice(-8)}`}
                          </span>
                          {ev.productName && (
                            <span className="text-xs text-slate-500 truncate">→ {ev.productName}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          {ev.productCategory && <span className="text-[10px] text-slate-400">{ev.productCategory}</span>}
                          {ev.productPrice && <span className="text-[10px] text-slate-400">₹{Number(ev.productPrice).toLocaleString('en-IN')}</span>}
                          {ev.journeyId && <span className="text-[10px] px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded">{String(ev.journeyId).slice(-8)}</span>}
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0">{formatDate(ev.createdAt)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Funnel Analysis Tab ──────────────────────────────────────────── */}
        {tab === 'funnel' && (
          <div className="space-y-6">
            {!hasRealData ? (
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-8 text-center">
                <TrendingUp className="w-10 h-10 mx-auto text-violet-300 mb-3" />
                <p className="text-sm text-slate-500">Funnel data requires database access. {dbError ? `Error: ${dbError}` : ''}</p>
              </div>
            ) : (
              <>
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-violet-500" /> Purchase Funnel (Last 24 Hours)
                  </h3>
                  <div className="space-y-3">
                    {FUNNEL_STAGES.map((stage, idx) => {
                      const count = journeyFunnel[stage.key] ?? 0;
                      const topCount = journeyFunnel[FUNNEL_STAGES[0].key] ?? 1;
                      const prevCount = idx > 0 ? (journeyFunnel[FUNNEL_STAGES[idx - 1].key] ?? 0) : count;
                      const pct = Math.round((count / (topCount || 1)) * 100);
                      const convPct = idx > 0 && prevCount > 0 ? Math.round((count / prevCount) * 100) : 100;
                      return (
                        <div key={stage.key} className="flex items-center gap-3">
                          <div className="w-32 shrink-0">
                            <div className="text-xs font-medium text-slate-600 dark:text-slate-400">{stage.label}</div>
                            <div className="text-[10px] text-slate-400">{count.toLocaleString()} events</div>
                          </div>
                          <div className="flex-1 h-8 bg-slate-100 dark:bg-slate-700 rounded-lg overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-lg transition-all duration-700 flex items-center justify-end pr-2"
                              style={{ width: `${Math.max(pct, 2)}%` }}
                            >
                              {pct > 15 && <span className="text-[10px] font-bold text-white">{pct}%</span>}
                            </div>
                          </div>
                          {idx > 0 && (
                            <div className={`w-14 text-right text-[11px] font-bold ${convPct >= 70 ? 'text-green-600' : convPct >= 40 ? 'text-amber-600' : 'text-red-600'
                              }`}>
                              {convPct}% →
                            </div>
                          )}
                          {idx === 0 && <div className="w-14" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
                {/* Summary stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: 'Product Views', key: 'product_clicked', color: 'blue' },
                    { label: 'Cart Adds', key: 'cart_added', color: 'violet' },
                    { label: 'Payments', key: 'payment_success', color: 'green' },
                    { label: 'Orders', key: 'order_placed', color: 'emerald' },
                  ].map(item => (
                    <StatBox key={item.key} icon={Activity} label={item.label} value={(journeyFunnel[item.key] ?? 0).toLocaleString()} color={item.color} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {tab === 'system-health' && (
          <div className="space-y-4">
            {!hasRealData ? (
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-8 text-center">
                <Server className="w-10 h-10 mx-auto text-slate-300 mb-3" />
                <p className="text-sm text-slate-500">System health data requires database access.{dbError ? ` Error: ${dbError}` : ''}</p>
                <button onClick={fetchDbData} disabled={dbLoading} className="mt-3 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 mx-auto">
                  {dbLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Retry Connection'}
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`p-2 rounded-xl ${dbData.systemHealth.status === 'healthy' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                        <Database className={`w-5 h-5 ${dbData.systemHealth.status === 'healthy' ? 'text-green-600' : 'text-red-600'}`} />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Database</h3>
                        <p className={`text-xs font-medium ${dbData.systemHealth.status === 'healthy' ? 'text-green-600' : 'text-red-600'}`}>{dbData.systemHealth.status.toUpperCase()}</p>
                      </div>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between p-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                        <span className="text-slate-400">Response Time</span>
                        <span className={`font-semibold ${dbData.systemHealth.dbResponseMs < 100 ? 'text-green-600' : dbData.systemHealth.dbResponseMs < 500 ? 'text-amber-600' : 'text-red-600'}`}>{dbData.systemHealth.dbResponseMs}ms</span>
                      </div>
                      <div className="flex justify-between p-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                        <span className="text-slate-400">Last Check</span>
                        <span className="font-medium text-slate-600 dark:text-slate-400">{formatDate(dbData.systemHealth.checkedAt)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl">
                        <Activity className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Analytics</h3>
                        <p className="text-xs text-slate-400">Last 24 hours</p>
                      </div>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between p-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                        <span className="text-slate-400">Total Events</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{dbData.analyticsStats.total24h}</span>
                      </div>
                      <div className="flex justify-between p-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                        <span className="text-slate-400">Unique Users</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{dbData.analyticsStats.uniqueUsers24h}</span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
                        <Brain className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">AI Engine</h3>
                        <p className="text-xs text-slate-400">SmartIntent v2</p>
                      </div>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between p-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                        <span className="text-slate-400">Total Queries</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{dbData.aiStats.totalQueries}</span>
                      </div>
                      <div className="flex justify-between p-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                        <span className="text-slate-400">Last 24h</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{dbData.aiStats.last24h}</span>
                      </div>
                    </div>
                  </div>
                </div>
                {dbData.analyticsStats.topEvents?.length > 0 && (
                  <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-700">
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-slate-500" /> Top Events (24h)
                      </h3>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-slate-700">
                      {dbData.analyticsStats.topEvents.map((ev: any, i: number) => (
                        <div key={i} className="px-5 py-3 flex items-center gap-4">
                          <span className="text-xs font-bold text-slate-300 w-5">{i + 1}</span>
                          <p className="flex-1 text-sm text-slate-700 dark:text-slate-300">{String(ev.event_name || ev.eventName || '').replace(/_/g, ' ')}</p>
                          <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-full">{ev.count}×</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {tab === 'fallback-audit' && <FallbackAuditTab />}
      </div>
    </div>
  );
}

// ── Fallback Audit Tab ───────────────────────────────────────────────────────
// Tracks all fallback code paths: how often primary code executes vs fallback,
// which Python services are actually reachable, and user-level audit trail.

interface FallbackEntry {
  id: string;
  module: string;
  file: string;
  description: string;
  primaryHits: number;
  fallbackHits: number;
  lastTriggeredAt: string;
  lastUser?: string;
  severity: 'info' | 'warning' | 'critical';
  status: 'healthy' | 'degraded' | 'failing';
}

interface PythonServiceStatus {
  name: string;
  port: number;
  endpoint: string;
  status: 'active' | 'unreachable' | 'orphaned';
  description: string;
  calledFrom: string;
  lastCheck?: string;
  responseMs?: number;
}

function FallbackAuditTab() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [serviceChecks, setServiceChecks] = useState<PythonServiceStatus[]>([]);
  const [checking, setChecking] = useState(false);
  const [fallbackEntries, setFallbackEntries] = useState<FallbackEntry[]>([]);

  // Static audit registry of all fallback patterns in the codebase
  const FALLBACK_REGISTRY: FallbackEntry[] = [
    {
      id: 'ranking-python-delegation',
      module: 'Smart Intent',
      file: 'lib/smart-intent/ranking-engine.ts',
      description: 'Python V2 ranking service delegation → TypeScript in-process scoring fallback',
      primaryHits: 0,
      fallbackHits: 0,
      lastTriggeredAt: '',
      severity: 'critical',
      status: 'healthy',
    },
    {
      id: 'intent-analyze-ranking',
      module: 'Intent API',
      file: 'app/api/intent/analyze/route.ts',
      description: 'Ranked products from Python → hardcoded demo products fallback',
      primaryHits: 0,
      fallbackHits: 0,
      lastTriggeredAt: '',
      severity: 'critical',
      status: 'healthy',
    },
    {
      id: 'product-aggregator-external',
      module: 'Product Aggregator',
      file: 'product-aggregator/services/product_aggregator_service.py',
      description: 'External product aggregation (Amazon/Flipkart) → empty results fallback',
      primaryHits: 0,
      fallbackHits: 0,
      lastTriggeredAt: '',
      severity: 'warning',
      status: 'healthy',
    },
    {
      id: 'ai-service-enrichment',
      module: 'AI Service',
      file: 'ai-service/app/main.py',
      description: 'AI product enrichment via LLM → passthrough without enrichment',
      primaryHits: 0,
      fallbackHits: 0,
      lastTriggeredAt: '',
      severity: 'info',
      status: 'healthy',
    },
    {
      id: 'intent-parser-groq',
      module: 'Intent Parser',
      file: 'intent-parser/main.py',
      description: 'Groq LLM intent parsing → regex-based keyword extraction fallback',
      primaryHits: 0,
      fallbackHits: 0,
      lastTriggeredAt: '',
      severity: 'warning',
      status: 'healthy',
    },
    {
      id: 'shopping-list-auto-checkout',
      module: 'Shopping List',
      file: 'app/api/shopping-list/route.ts',
      description: 'Auto-checkout for native DB products → restriction for external aggregator products',
      primaryHits: 0,
      fallbackHits: 0,
      lastTriggeredAt: '',
      severity: 'info',
      status: 'healthy',
    },
    {
      id: 'wallet-payment',
      module: 'Wallet',
      file: 'lib/db.ts → createOrderWithWalletPayment',
      description: 'Wallet atomic payment → manual checkout guidance fallback',
      primaryHits: 0,
      fallbackHits: 0,
      lastTriggeredAt: '',
      severity: 'critical',
      status: 'healthy',
    },
    {
      id: 'search-session-persist',
      module: 'Search Session',
      file: 'lib/search-session.ts',
      description: 'DB session persistence → localStorage-only fallback',
      primaryHits: 0,
      fallbackHits: 0,
      lastTriggeredAt: '',
      severity: 'info',
      status: 'healthy',
    },
    {
      id: 'sphere-3d-render',
      module: 'Products Page',
      file: 'components/sphere/CategorySphereWrapper.tsx',
      description: 'WebGL 3D category sphere → horizontal chip scroll fallback',
      primaryHits: 0,
      fallbackHits: 0,
      lastTriggeredAt: '',
      severity: 'info',
      status: 'healthy',
    },
    {
      id: 'external-products-filter',
      module: 'External Products',
      file: 'lib/external-products-setting.ts',
      description: 'External product filter toggle → include all products fallback',
      primaryHits: 0,
      fallbackHits: 0,
      lastTriggeredAt: '',
      severity: 'info',
      status: 'healthy',
    },
  ];

  // Load persisted fallback data from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('dc-fallback-audit');
      if (stored) {
        const parsed = JSON.parse(stored) as FallbackEntry[];
        // Merge stored counts with registry
        const merged = FALLBACK_REGISTRY.map(entry => {
          const match = parsed.find((s: FallbackEntry) => s.id === entry.id);
          return match ? { ...entry, primaryHits: match.primaryHits, fallbackHits: match.fallbackHits, lastTriggeredAt: match.lastTriggeredAt, lastUser: match.lastUser, status: match.status } : entry;
        });
        setFallbackEntries(merged);
      } else {
        setFallbackEntries(FALLBACK_REGISTRY);
      }
    } catch {
      setFallbackEntries(FALLBACK_REGISTRY);
    }
  }, []);

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Service metadata (description/calledFrom) is static — kept client-side.
  // Health status is fetched server-side via /api/health/services so the
  // web server uses Docker internal hostnames instead of the user's localhost.
  const SERVICE_META: Record<string, Pick<PythonServiceStatus, 'description' | 'calledFrom' | 'endpoint'>> = {
    'Product Ranking Engine': { endpoint: '/health', description: 'V2 22-dimension scoring engine. Called via HTTP from ranking-engine.ts for /rank/v2 and /config/weights', calledFrom: 'lib/smart-intent/ranking-engine.ts (rankViaService)' },
    'AI Service': { endpoint: '/health', description: 'AI product enrichment & LLM processing. Kafka-driven, no direct HTTP calls from web app', calledFrom: 'Kafka consumer (background processing only)' },
    'Intent Parser': { endpoint: '/health', description: 'Groq LLM-based intent classification. Kafka-driven, no direct HTTP calls from web app', calledFrom: 'Kafka consumer (background processing only)' },
    'Product Aggregator': { endpoint: '/health', description: 'Amazon/Flipkart product aggregation. Kafka-driven, no direct HTTP from web app', calledFrom: 'Kafka consumer (background processing only)' },
  };

  const checkServices = useCallback(async () => {
    setChecking(true);
    try {
      const res = await fetch('/api/health/services', { cache: 'no-store' });
      if (res.ok) {
        const data: Array<{ name: string; port: number; status: 'active' | 'unreachable'; responseMs: number }> = await res.json();
        const merged: PythonServiceStatus[] = data.map((svc) => ({
          ...svc,
          status: svc.status,
          endpoint: SERVICE_META[svc.name]?.endpoint ?? '/health',
          description: SERVICE_META[svc.name]?.description ?? '',
          calledFrom: SERVICE_META[svc.name]?.calledFrom ?? '',
          lastCheck: new Date().toISOString(),
        }));
        setServiceChecks(merged);
      }
    } catch {
      // Leave previous state on network error
    }
    setChecking(false);
  }, []);

  useEffect(() => { checkServices(); }, [checkServices]);

  const totalPrimary = fallbackEntries.reduce((s, e) => s + e.primaryHits, 0);
  const totalFallback = fallbackEntries.reduce((s, e) => s + e.fallbackHits, 0);
  const healthyCount = fallbackEntries.filter(e => e.status === 'healthy').length;
  const degradedCount = fallbackEntries.filter(e => e.status === 'degraded').length;
  const failingCount = fallbackEntries.filter(e => e.status === 'failing').length;
  const activeServices = serviceChecks.filter(s => s.status === 'active').length;

  const severityIcon = (sev: string) => {
    switch (sev) {
      case 'critical': return <AlertOctagon className="w-3.5 h-3.5 text-red-500" />;
      case 'warning': return <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />;
      default: return <Eye className="w-3.5 h-3.5 text-blue-500" />;
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'healthy': return <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">HEALTHY</span>;
      case 'degraded': return <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">DEGRADED</span>;
      case 'failing': return <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">FAILING</span>;
      default: return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Summary KPI tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatBox icon={CheckCircle} label="Primary Exec" value={totalPrimary} color="green" sub="Total primary path hits" />
        <StatBox icon={AlertTriangle} label="Fallback Exec" value={totalFallback} color="amber" sub="Total fallback path hits" />
        <StatBox icon={Shield} label="Healthy" value={healthyCount} color="green" sub={`of ${fallbackEntries.length} paths`} />
        <StatBox icon={AlertOctagon} label="Degraded" value={degradedCount} color="amber" sub="Need attention" />
        <StatBox icon={XCircle} label="Failing" value={failingCount} color="red" sub="Immediate action" />
        <StatBox icon={Server} label="Python Services" value={`${activeServices}/${serviceChecks.length}`} color="blue" sub="Reachable" />
      </div>

      {/* Python Services Health */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Server className="w-4 h-4 text-indigo-500" /> Python Microservices Status
          </h3>
          <button onClick={checkServices} disabled={checking} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1">
            {checking ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Refresh
          </button>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          {serviceChecks.map((svc) => {
            const isExpanded = expanded.has(`svc-${svc.name}`);
            return (
              <div key={svc.name}>
                <button onClick={() => toggleExpand(`svc-${svc.name}`)} className="w-full px-5 py-3 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors text-left">
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${svc.status === 'active' ? 'bg-green-500 shadow-green-500/50 shadow-sm' : svc.status === 'unreachable' ? 'bg-red-500 shadow-red-500/50 shadow-sm' : 'bg-gray-400'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{svc.name}</p>
                    <p className="text-[11px] text-slate-400 truncate">Port {svc.port} • {svc.status === 'active' ? `${svc.responseMs}ms` : svc.status}</p>
                  </div>
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${svc.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : svc.status === 'unreachable' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
                    {svc.status === 'active' ? 'ACTIVE' : svc.status === 'unreachable' ? 'DOWN' : 'ORPHANED'}
                  </span>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </button>
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                      <div className="px-5 pb-4 pt-1 space-y-2 text-xs">
                        <div className="p-3 bg-slate-50 dark:bg-slate-700/40 rounded-lg space-y-1.5">
                          <p className="text-slate-600 dark:text-slate-300"><strong>Description:</strong> {svc.description}</p>
                          <p className="text-slate-500 dark:text-slate-400"><strong>Called from:</strong> {svc.calledFrom}</p>
                          {svc.lastCheck && <p className="text-slate-400"><strong>Last check:</strong> {formatDate(svc.lastCheck)}</p>}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fallback Code Paths Registry */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-700">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Shield className="w-4 h-4 text-violet-500" /> Fallback Code Paths Registry
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">All resilience fallback patterns across the codebase. Expand each for full details.</p>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          {fallbackEntries.map((entry) => {
            const isExpanded = expanded.has(entry.id);
            const total = entry.primaryHits + entry.fallbackHits;
            const fallbackPct = total > 0 ? Math.round(entry.fallbackHits / total * 100) : 0;
            return (
              <div key={entry.id}>
                <button onClick={() => toggleExpand(entry.id)} className="w-full px-5 py-3.5 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors text-left">
                  {severityIcon(entry.severity)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{entry.description}</p>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">{entry.module} • {entry.file}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {statusBadge(entry.status)}
                    {total > 0 && (
                      <span className="text-[10px] text-slate-400 tabular-nums">
                        {entry.primaryHits}P / {entry.fallbackHits}F
                      </span>
                    )}
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </div>
                </button>
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                      <div className="px-5 pb-4 pt-1 space-y-3">
                        <div className="grid grid-cols-3 gap-3">
                          <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
                            <p className="text-lg font-bold text-green-700 dark:text-green-400 tabular-nums">{entry.primaryHits}</p>
                            <p className="text-[10px] text-green-600 dark:text-green-500 font-medium">Primary Executions</p>
                          </div>
                          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-center">
                            <p className="text-lg font-bold text-amber-700 dark:text-amber-400 tabular-nums">{entry.fallbackHits}</p>
                            <p className="text-[10px] text-amber-600 dark:text-amber-500 font-medium">Fallback Executions</p>
                          </div>
                          <div className="p-3 bg-slate-50 dark:bg-slate-700/40 rounded-lg text-center">
                            <p className="text-lg font-bold text-slate-700 dark:text-slate-300 tabular-nums">{fallbackPct}%</p>
                            <p className="text-[10px] text-slate-500 font-medium">Fallback Rate</p>
                          </div>
                        </div>
                        {total > 0 && (
                          <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${100 - fallbackPct}%` }} />
                          </div>
                        )}
                        <div className="p-3 bg-slate-50 dark:bg-slate-700/40 rounded-lg text-xs space-y-1.5">
                          <p className="text-slate-600 dark:text-slate-300"><strong>Module:</strong> {entry.module}</p>
                          <p className="text-slate-500 dark:text-slate-400"><strong>File:</strong> <code className="text-[11px] bg-slate-200 dark:bg-slate-600 px-1 py-0.5 rounded">{entry.file}</code></p>
                          <p className="text-slate-500 dark:text-slate-400"><strong>Severity:</strong> <span className={entry.severity === 'critical' ? 'text-red-600 font-semibold' : entry.severity === 'warning' ? 'text-amber-600 font-semibold' : 'text-blue-600'}>{entry.severity.toUpperCase()}</span></p>
                          {entry.lastTriggeredAt && <p className="text-slate-400"><strong>Last triggered:</strong> {formatDate(entry.lastTriggeredAt)}</p>}
                          {entry.lastUser && <p className="text-slate-400"><strong>Last user:</strong> {entry.lastUser}</p>}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
